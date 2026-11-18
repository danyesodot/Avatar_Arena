// שרת המשחק – זירת האווטאר
// סימולציה סמכותית בשרת, בוטים, סערה מתכווצת וחיבור WebSocket
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const { CHARACTERS, BY_ID, WALL } = require('./shared/characters.js');

const PORT = process.env.PORT || 3000;
const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const WORLD = 3000;
const PR = 22; // רדיוס שחקן
const LOBBY_BOTS = 4;
const MAX_BOTS = 24;

// ---------------------------------------------------------------- קבצים סטטיים
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const PUBLIC = path.join(__dirname, 'public');
const SHARED = path.join(__dirname, 'shared');

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  if (url === '/portraits.json') {
    // רשימת תמונות מותאמות אישית שהמשתמש שם בתיקייה public/portraits
    let files = [];
    try { files = fs.readdirSync(path.join(PUBLIC, 'portraits')).filter(f => /\.(png|jpe?g|webp)$/i.test(f)); } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(files));
  }
  let base = PUBLIC, rel = url;
  if (url.startsWith('/shared/')) { base = SHARED; rel = url.slice(7); }
  const file = path.normalize(path.join(base, rel));
  if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------------------------------------------------------------- עזרים
let seed = (Date.now() % 100000) + 7;
function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const d2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
let nextId = 1;
const newId = () => nextId++;

// ---------------------------------------------------------------- מפה
function generateMap() {
  const obstacles = [];
  const ponds = [];
  const free = (x, y, r, pad = 30) => {
    if (x < r + 40 || y < r + 40 || x > WORLD - r - 40 || y > WORLD - r - 40) return false;
    for (const o of obstacles) if (d2(x, y, o.x, o.y) < (r + o.r + pad) ** 2) return false;
    for (const p of ponds) if (d2(x, y, p.x, p.y) < (r + p.r + pad) ** 2) return false;
    return true;
  };
  // אגמים
  for (let i = 0, tries = 0; i < 9 && tries < 500; tries++) {
    const r = 110 + rand() * 120, x = rand() * WORLD, y = rand() * WORLD;
    if (d2(x, y, WORLD / 2, WORLD / 2) < 300 * 300) continue;
    if (free(x, y, r, 120)) { ponds.push({ x, y, r }); i++; }
  }
  // מקדש במרכז – עמודים במעגל
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    obstacles.push({ t: 'pillar', x: WORLD / 2 + Math.cos(a) * 230, y: WORLD / 2 + Math.sin(a) * 230, r: 26 });
  }
  // חורשות עצים
  for (let g = 0; g < 16; g++) {
    const gx = rand() * WORLD, gy = rand() * WORLD;
    for (let k = 0; k < 7; k++) {
      const r = 26 + rand() * 10, x = gx + (rand() - 0.5) * 340, y = gy + (rand() - 0.5) * 340;
      if (free(x, y, r, 26)) obstacles.push({ t: 'tree', x, y, r });
    }
  }
  // סלעים
  for (let i = 0, tries = 0; i < 70 && tries < 3000; tries++) {
    const r = 28 + rand() * 38, x = rand() * WORLD, y = rand() * WORLD;
    if (d2(x, y, WORLD / 2, WORLD / 2) < 330 * 330) continue;
    if (free(x, y, r, 50)) { obstacles.push({ t: 'rock', x, y, r }); i++; }
  }
  // עצים בודדים
  for (let i = 0, tries = 0; i < 60 && tries < 3000; tries++) {
    const r = 24 + rand() * 10, x = rand() * WORLD, y = rand() * WORLD;
    if (free(x, y, r, 40)) { obstacles.push({ t: 'tree', x, y, r }); i++; }
  }
  obstacles.forEach(o => { o.x = Math.round(o.x); o.y = Math.round(o.y); o.r = Math.round(o.r); });
  ponds.forEach(o => { o.x = Math.round(o.x); o.y = Math.round(o.y); o.r = Math.round(o.r); });
  return { size: WORLD, obstacles, ponds };
}

const MAP = generateMap();
const inWater = (x, y) => MAP.ponds.some(p => d2(x, y, p.x, p.y) < (p.r - 10) ** 2);

// ---------------------------------------------------------------- מצב החדר
const room = {
  phase: 'lobby', // lobby | countdown | match | ended
  timer: 0,
  players: new Map(),
  projectiles: [],
  walls: [],
  pickups: [],
  pending: [], // התקפות מושהות
  events: [],
  storm: null,
  winner: null,
  matchTime: 0,
  pickupTimer: 0,
  difficulty: 'easy',
};

const BOT_NAMES = ['שומר הלוטוס', 'לוחם החופש', 'סוכן דאי לי', 'נזיר נודד', 'ציידת ראשים', 'פיראט הים', 'סוחר הכרוב', 'צוער אש',
  'חייל אדמה', 'נווד המדבר', 'שודד הביצות', 'מאסטר פאי שו', 'לוחמת קיושי', 'נווטת צפונית', 'אביר הרוח', 'רוח היער',
  'אמן החרב', 'חייל ים', 'שליח ממושאו', 'ינשוף הספרייה', 'סייר הקוטב', 'רוכב הביזון', 'צייד הלמורים', 'שומר החומה'];

function emit(ev) { room.events.push(ev); }

function makePlayer(id, name, char, isBot) {
  const def = BY_ID[char] || CHARACTERS[0];
  return {
    id, name, char: def.id, isBot, ws: null,
    x: WORLD / 2, y: WORLD / 2, vx: 0, vy: 0, kvx: 0, kvy: 0,
    hp: def.hp, maxHp: def.hp, alive: false, spectator: false, deadT: 0,
    aim: 0, input: { mx: 0, my: 0, a: 0, ax: 0, ay: 0, b: 0 },
    cd: { primary: 0, q: 0, e: 0, def: 0, ult: 0, wall: 0 },
    cdMax: { primary: 1, q: 1, e: 1, def: 1, ult: 1, wall: 1 },
    ult: 0, kills: 0, dmgDone: 0, place: 0,
    st: freshStatus(), dash: null, casting: null,
    lastAttacker: null, lastAttackerT: 0,
    ai: isBot ? { strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 0, stuckT: 0, lx: 0, ly: 0, wx: rnd(300, WORLD - 300), wy: rnd(300, WORLD - 300), aimErr: 0, thinkT: 0 } : null,
  };
}

function freshStatus() {
  return { stun: 0, root: 0, chiblock: 0, invuln: 0, stealth: 0, slow: null, burn: null, shield: null, buff: null };
}

function blocked(x, y, r) {
  for (const o of MAP.obstacles) if (d2(x, y, o.x, o.y) < (r + o.r) ** 2) return true;
  for (const w of room.walls) if (d2(x, y, w.x, w.y) < (r + w.r) ** 2) return true;
  return false;
}

function findSpawn(insideStorm) {
  for (let i = 0; i < 400; i++) {
    let x, y;
    if (insideStorm && room.storm) {
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * room.storm.r * 0.85;
      x = room.storm.x + Math.cos(a) * rr; y = room.storm.y + Math.sin(a) * rr;
    } else { x = rnd(120, WORLD - 120); y = rnd(120, WORLD - 120); }
    x = clamp(x, 80, WORLD - 80); y = clamp(y, 80, WORLD - 80);
    if (blocked(x, y, PR + 10) || inWater(x, y)) continue;
    let ok = true;
    for (const p of room.players.values()) if (p.alive && d2(x, y, p.x, p.y) < 260 * 260) { ok = false; break; }
    if (ok || i > 300) return { x, y };
  }
  return { x: WORLD / 2, y: WORLD / 2 + 100 };
}

function spawnPlayer(p, pos) {
  const def = BY_ID[p.char];
  const s = pos || findSpawn(room.phase === 'match');
  p.x = s.x; p.y = s.y; p.vx = p.vy = p.kvx = p.kvy = 0;
  p.hp = p.maxHp = Math.round(def.hp * (p.isBot ? botDiff().hp : 1)); p.alive = true; p.spectator = false;
  p.st = freshStatus(); p.dash = null; p.casting = null;
  p.st.invuln = 1.2; // הגנת הופעה
  for (const k in p.cd) p.cd[k] = 0;
}

// ---------------------------------------------------------------- נזק ואפקטים
function dmgMultOf(p) { return p && p.st.buff && p.st.buff.dmgMult ? p.st.buff.dmgMult : 1; }

function damage(target, amount, src, opts = {}) {
  if (!target.alive) return 0;
  if (target.st.invuln > 0 && !opts.storm) return 0;
  if (src && src.id === target.id) return 0;
  let dmg = amount;
  // בוטים פוגעים פחות בשחקנים אנושיים, לפי רמת הקושי
  if (src && src.isBot && !target.isBot) dmg *= botDiff().dmg;
  const sh = target.st.shield;
  if (sh && !opts.storm) {
    if (sh.reduce) dmg *= 1 - sh.reduce;
    if (sh.absorb) {
      const used = Math.min(sh.absorb, dmg);
      sh.absorb -= used; dmg -= used;
      if (sh.absorb <= 0.01) { target.st.shield = null; emit({ e: 'shieldbreak', p: target.id }); }
    }
  }
  const bf = target.st.buff;
  if (bf && bf.reduce && !opts.storm) dmg *= 1 - bf.reduce;
  if (dmg <= 0) { emit({ e: 'block', x: Math.round(target.x), y: Math.round(target.y) - 30 }); return 0; }
  target.hp -= dmg;
  target.ult = Math.min(100, target.ult + dmg * 0.35);
  if (src) {
    src.ult = Math.min(100, src.ult + dmg * 0.6);
    src.dmgDone += dmg;
    if (src.st.stealth > 0) { src.st.stealth = 0; if (src.st.buff && src.st.buff.stealth) src.st.buff.stealth = false; }
    target.lastAttacker = src.id; target.lastAttackerT = 4;
  }
  emit({ e: 'hit', x: Math.round(target.x), y: Math.round(target.y), v: Math.round(dmg), p: target.id, s: opts.style || '' });
  if (target.hp <= 0) kill(target, src, opts);
  return dmg;
}

function applyFx(target, fx, src, dx, dy, cx, cy) {
  if (!fx || !target.alive || target.st.invuln > 0) return;
  const armored = target.st.shield && target.st.shield.reduce >= 0.5;
  const kMul = armored ? 0.35 : 1;
  if (fx.knock) {
    const l = Math.hypot(dx, dy) || 1;
    target.kvx += (dx / l) * fx.knock * kMul; target.kvy += (dy / l) * fx.knock * kMul;
  }
  if (fx.pull && cx !== undefined) {
    const ex = cx - target.x, ey = cy - target.y, l = Math.hypot(ex, ey) || 1;
    target.kvx += (ex / l) * Math.min(fx.pull, l * 3); target.kvy += (ey / l) * Math.min(fx.pull, l * 3);
  }
  if (fx.stun) { target.st.stun = Math.max(target.st.stun, fx.stun * (armored ? 0.5 : 1)); target.casting = null; }
  if (fx.root) target.st.root = Math.max(target.st.root, fx.root);
  if (fx.chiblock) { target.st.chiblock = Math.max(target.st.chiblock, fx.chiblock); target.casting = null; }
  if (fx.slow) target.st.slow = { mult: fx.slow[0], t: fx.slow[1] };
  if (fx.burn) target.st.burn = { dps: fx.burn[0], t: fx.burn[1], src: src ? src.id : null };
}

function kill(target, src, opts) {
  target.alive = false; target.hp = 0; target.deadT = 0; target.dash = null; target.casting = null;
  let killer = src;
  if (!killer && target.lastAttacker && target.lastAttackerT > 0) killer = room.players.get(target.lastAttacker);
  if (killer && killer.id !== target.id) killer.kills++;
  emit({ e: 'kill', k: killer ? killer.name : (opts.storm ? 'הסערה' : ''), kc: killer ? killer.char : '', v: target.name, vc: target.char,
    ki: killer ? killer.id : 0, vi: target.id, x: Math.round(target.x), y: Math.round(target.y) });
  if (room.phase === 'match') {
    target.place = aliveCount() + 1;
    room.pickups.push({ id: newId(), t: 'hp', x: target.x, y: target.y });
    if (Math.random() < 0.6) room.pickups.push({ id: newId(), t: 'ult', x: target.x + 30, y: target.y + 10 });
  }
}

function aliveCount() { let n = 0; for (const p of room.players.values()) if (p.alive) n++; return n; }

// ---------------------------------------------------------------- הפעלת יכולות
function canCast(p, slot) {
  if (!p.alive || p.st.stun > 0 || p.casting || p.dash) return false;
  if (p.cd[slot] > 0) return false;
  if (slot === 'ult' && p.ult < 100) return false;
  if (p.st.chiblock > 0) {
    const def = BY_ID[p.char];
    if (slot !== 'primary' && slot !== 'wall') return false;
    if (slot === 'primary' && def.element !== 'none') return false;
  }
  return true;
}

function cast(p, slot) {
  const def = BY_ID[p.char];
  if (slot === 'wall') {
    const cdm = p.st.buff && p.st.buff.cdMult ? p.st.buff.cdMult : 1;
    p.cd.wall = p.cdMax.wall = WALL.cd * cdm;
    buildWall(p);
    return;
  }
  const a = def.abilities[slot];
  if (!a) return;
  const cdm = p.st.buff && p.st.buff.cdMult ? p.st.buff.cdMult : 1;
  if (slot === 'ult') { p.ult = 0; p.cd.ult = 1; p.cdMax.ult = 1; emit({ e: 'ult', p: p.id, n: a.name, c: p.char }); }
  else { p.cd[slot] = p.cdMax[slot] = (a.cd || 0.5) * cdm; }
  if (p.st.stealth > 0 && slot !== 'e') { p.st.stealth = 0; }
  emit({ e: 'cast', p: p.id, s: a.style, k: a.kind, sl: slot });
  execute(p, a);
}

function execute(p, a) {
  const aim = p.aim, cx = Math.cos(aim), cy = Math.sin(aim);
  switch (a.kind) {
    case 'projectile': {
      const n = a.count || 1;
      for (let i = 0; i < n; i++) {
        let ang;
        if (a.ring) ang = aim + (i / n) * Math.PI * 2;
        else ang = n === 1 ? aim : aim - a.spread / 2 + (a.spread * i) / (n - 1);
        const vx = Math.cos(ang) * a.speed, vy = Math.sin(ang) * a.speed;
        room.projectiles.push({
          id: newId(), owner: p.id, x: p.x + Math.cos(ang) * (PR + 6), y: p.y + Math.sin(ang) * (PR + 6), vx, vy, speed: a.speed,
          r: a.r, dmg: a.dmg, range: a.range, traveled: 0, fx: a.fx, style: a.style, pierce: !!a.pierce,
          returning: !!a.returning, back: false, hit: new Set(),
        });
      }
      break;
    }
    case 'melee': {
      emit({ e: 'melee', p: p.id, x: Math.round(p.x), y: Math.round(p.y), a: +aim.toFixed(2), arc: a.arc, r: a.range, s: a.style });
      const mult = dmgMultOf(p);
      for (const t of room.players.values()) {
        if (t === p || !t.alive) continue;
        const dd = Math.sqrt(d2(p.x, p.y, t.x, t.y));
        if (dd > a.range + PR) continue;
        const ang = Math.atan2(t.y - p.y, t.x - p.x);
        if (dd > PR * 1.5 && Math.abs(angDiff(ang, aim)) > a.arc / 2) continue;
        if (damage(t, a.dmg * mult, p, { style: a.style }) > 0 || t.st.invuln <= 0) applyFx(t, a.fx, p, t.x - p.x, t.y - p.y);
      }
      for (const w of room.walls) {
        const dd = Math.sqrt(d2(p.x, p.y, w.x, w.y));
        if (dd > a.range + w.r) continue;
        if (Math.abs(angDiff(Math.atan2(w.y - p.y, w.x - p.x), aim)) > a.arc / 2) continue;
        w.hp -= a.dmg * mult;
      }
      break;
    }
    case 'dash': {
      let dx = cx, dy = cy;
      if (a.back) { dx = -cx; dy = -cy; }
      else if (a.style === 'roll' && (p.input.mx || p.input.my)) { const l = Math.hypot(p.input.mx, p.input.my); dx = p.input.mx / l; dy = p.input.my / l; }
      const sp = a.dist / a.dur;
      p.dash = { vx: dx * sp, vy: dy * sp, t: a.dur, dmg: a.dmg || 0, fx: a.fx, hit: new Set(), fly: !!a.fly, landing: a.landing, style: a.style };
      if (a.invuln) p.st.invuln = Math.max(p.st.invuln, a.invuln);
      p.st.root = 0;
      emit({ e: 'dash', p: p.id, s: a.style });
      break;
    }
    case 'aoe': {
      let x = p.x, y = p.y, follow = a.at === 'self' ? p.id : 0;
      if (a.at === 'target') {
        const tx = p.input.ax - p.x, ty = p.input.ay - p.y, l = Math.hypot(tx, ty);
        const r = Math.min(l, a.range);
        x = p.x + (l ? tx / l : cx) * r; y = p.y + (l ? ty / l : cy) * r;
      }
      const pulses = a.pulses || 1;
      for (let i = 0; i < pulses; i++) {
        room.pending.push({ t: (a.delay || 0) + i * (a.interval || 0), x, y, follow, radius: a.radius, dmg: a.dmg, fx: a.fx, owner: p.id, style: a.style });
      }
      if ((a.delay || 0) >= 0.2) emit({ e: 'warn', x: Math.round(x), y: Math.round(y), r: a.radius, d: a.delay, s: a.style, f: follow });
      break;
    }
    case 'shield': {
      p.st.shield = { t: a.dur, absorb: a.absorb || 0, reduce: a.reduce || 0, reflect: !!a.reflect, selfSlow: a.selfSlow || 1, style: a.style };
      emit({ e: 'shield', p: p.id, s: a.style });
      break;
    }
    case 'heal': {
      const amt = a.amount * (a.waterBonus && inWater(p.x, p.y) ? a.waterBonus : 1);
      p.hp = Math.min(p.maxHp, p.hp + amt);
      p.st.burn = null; p.st.slow = null;
      if (a.speedBuff) p.st.buff = { t: a.speedBuff[1], speedMult: a.speedBuff[0], style: a.style };
      emit({ e: 'heal', p: p.id, v: Math.round(amt), s: a.style });
      break;
    }
    case 'beam': {
      p.casting = { t: a.charge, a };
      emit({ e: 'charge', p: p.id, d: a.charge, s: a.style });
      break;
    }
    case 'buff': {
      p.st.buff = { t: a.dur, dmgMult: a.dmgMult || 1, speedMult: a.speedMult || 1, cdMult: a.cdMult || 1, reduce: a.reduce || 0,
        fly: !!a.fly, stealth: !!a.stealth, style: a.style };
      if (a.stealth) p.st.stealth = a.dur;
      if (a.invuln) p.st.invuln = Math.max(p.st.invuln, a.dur);
      if (a.cdMult && a.cdMult < 1) for (const k in p.cd) if (k !== 'ult') p.cd[k] *= a.cdMult;
      emit({ e: 'buff', p: p.id, s: a.style, d: a.dur });
      if (a.burst) room.pending.push({ t: 0, x: p.x, y: p.y, follow: p.id, radius: a.burst.radius, dmg: a.burst.dmg, fx: a.burst.fx, owner: p.id, style: a.style });
      break;
    }
    case 'multi':
      for (const part of a.parts) execute(p, part);
      break;
    case 'wallring': {
      const el = BY_ID[p.char].element;
      for (let i = 0; i < a.count; i++) {
        const ang = (i / a.count) * Math.PI * 2;
        addWall(p.x + Math.cos(ang) * a.dist, p.y + Math.sin(ang) * a.dist, a.hp, a.life, el, p.id, true);
      }
      break;
    }
  }
}

function addWall(x, y, hp, life, el, owner, force) {
  x = clamp(x, 30, WORLD - 30); y = clamp(y, 30, WORLD - 30);
  for (const o of MAP.obstacles) if (d2(x, y, o.x, o.y) < (o.r + 10) ** 2) return;
  // לא לבנות בתוך שחקן
  if (!force) for (const t of room.players.values()) if (t.alive && d2(x, y, t.x, t.y) < (PR + 20) ** 2) return;
  room.walls.push({ id: newId(), x, y, r: 22, hp, maxHp: hp, life, el, owner });
  // הדיפת שחקנים מתוך החומה
  for (const t of room.players.values()) {
    if (!t.alive) continue;
    const dd = Math.sqrt(d2(x, y, t.x, t.y));
    if (dd < PR + 22) { const l = dd || 1; t.x = x + ((t.x - x) / l) * (PR + 24); t.y = y + ((t.y - y) / l) * (PR + 24); }
  }
}

function buildWall(p) {
  const el = BY_ID[p.char].element;
  const hp = WALL.hp * (el === 'earth' ? 1.6 : 1);
  const cx = Math.cos(p.aim), cy = Math.sin(p.aim);
  const bx = p.x + cx * 75, by = p.y + cy * 75;
  for (let i = 0; i < WALL.count; i++) {
    const off = (i - (WALL.count - 1) / 2) * 40;
    addWall(bx - cy * off, by + cx * off, hp, WALL.life, el, p.id);
  }
  emit({ e: 'build', p: p.id, x: Math.round(bx), y: Math.round(by), el });
}

function fireBeam(p, a) {
  const n = a.count || 1;
  const mult = dmgMultOf(p);
  for (let i = 0; i < n; i++) {
    const ang = n === 1 ? p.aim : p.aim - a.spread / 2 + (a.spread * i) / (n - 1);
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const sx = p.x + dx * PR, sy = p.y + dy * PR;
    let len = a.range;
    // חסימה ע"י מכשולים וחומות
    const consider = (o, isWall) => {
      const ox = o.x - sx, oy = o.y - sy, proj = ox * dx + oy * dy;
      if (proj < 0 || proj > len) return;
      const perp2 = ox * ox + oy * oy - proj * proj;
      if (perp2 > o.r * o.r) return;
      const hit = proj - Math.sqrt(o.r * o.r - perp2);
      if (hit < len) { len = Math.max(0, hit); if (isWall) o._beamHit = true; }
    };
    for (const o of MAP.obstacles) consider(o, false);
    for (const w of room.walls) { w._beamHit = false; consider(w, true); }
    for (const w of room.walls) if (w._beamHit) { w.hp -= a.dmg * 2; break; }
    const ex = sx + dx * len, ey = sy + dy * len;
    emit({ e: 'beam', x1: Math.round(sx), y1: Math.round(sy), x2: Math.round(ex), y2: Math.round(ey), s: a.style, w: a.width });
    for (const t of room.players.values()) {
      if (t === p || !t.alive) continue;
      const ox = t.x - sx, oy = t.y - sy, proj = ox * dx + oy * dy;
      if (proj < -PR || proj > len + PR) continue;
      const perp = Math.abs(ox * dy - oy * dx);
      if (perp > a.width / 2 + PR) continue;
      if (t.st.shield && t.st.shield.reflect) {
        // הפניית ברק – חוזר אל המטיל
        emit({ e: 'beam', x1: Math.round(t.x), y1: Math.round(t.y), x2: Math.round(p.x), y2: Math.round(p.y), s: a.style, w: a.width });
        emit({ e: 'reflect', x: Math.round(t.x), y: Math.round(t.y) });
        damage(p, a.dmg * dmgMultOf(t), t, { style: a.style });
        applyFx(p, a.fx, t, p.x - t.x, p.y - t.y);
        continue;
      }
      if (t.st.invuln > 0) continue;
      damage(t, a.dmg * mult, p, { style: a.style });
      applyFx(t, a.fx, p, dx, dy);
    }
  }
}

function resolveAoe(z) {
  const owner = room.players.get(z.owner);
  if (z.follow) { const f = room.players.get(z.follow); if (f && f.alive) { z.x = f.x; z.y = f.y; } else if (!f || !f.alive) return; }
  emit({ e: 'aoe', x: Math.round(z.x), y: Math.round(z.y), r: z.radius, s: z.style });
  const mult = dmgMultOf(owner);
  for (const t of room.players.values()) {
    if (!t.alive || t.id === z.owner) continue;
    if (d2(z.x, z.y, t.x, t.y) > (z.radius + PR) ** 2) continue;
    if (t.st.invuln > 0) continue;
    if (z.dmg) damage(t, z.dmg * mult, owner, { style: z.style });
    applyFx(t, z.fx, owner, t.x - z.x || 1, t.y - z.y, z.x, z.y);
  }
  for (const w of room.walls) if (d2(z.x, z.y, w.x, w.y) < (z.radius + w.r) ** 2 && w.owner !== z.owner) w.hp -= (z.dmg || 10) * 1.5;
}

// ---------------------------------------------------------------- סערה
const STORM_PHASES = [
  { wait: 25, shrink: 25, frac: 0.62, dps: 2 },
  { wait: 20, shrink: 20, frac: 0.55, dps: 4 },
  { wait: 16, shrink: 18, frac: 0.5, dps: 7 },
  { wait: 12, shrink: 15, frac: 0.45, dps: 10 },
  { wait: 10, shrink: 15, frac: 0.0, dps: 16 },
];

function startStorm() {
  const r = WORLD * 0.74;
  room.storm = { x: WORLD / 2, y: WORLD / 2, r, fx: WORLD / 2, fy: WORLD / 2, fr: r, tx: WORLD / 2, ty: WORLD / 2, tr: r, i: 0, state: 'wait', t: STORM_PHASES[0].wait, dps: 1 };
  planStorm();
}

function planStorm() {
  const s = room.storm, ph = STORM_PHASES[s.i];
  s.fx = s.x; s.fy = s.y; s.fr = s.r;
  s.tr = Math.max(0, s.r * ph.frac);
  const maxOff = Math.max(0, s.r - s.tr) * 0.8;
  for (let k = 0; k < 30; k++) {
    const a = Math.random() * Math.PI * 2, o = Math.random() * maxOff;
    const tx = s.x + Math.cos(a) * o, ty = s.y + Math.sin(a) * o;
    if (tx > 300 && ty > 300 && tx < WORLD - 300 && ty < WORLD - 300) { s.tx = tx; s.ty = ty; return; }
  }
  s.tx = s.x; s.ty = s.y;
}

function updateStorm() {
  const s = room.storm;
  if (!s) return;
  const ph = STORM_PHASES[Math.min(s.i, STORM_PHASES.length - 1)];
  s.t -= DT;
  if (s.state === 'wait') {
    if (s.t <= 0) { s.state = 'shrink'; s.t = ph.shrink; s.dps = ph.dps; emit({ e: 'storm' }); }
  } else if (s.state === 'shrink') {
    const k = 1 - Math.max(0, s.t) / ph.shrink;
    s.x = s.fx + (s.tx - s.fx) * k; s.y = s.fy + (s.ty - s.fy) * k; s.r = s.fr + (s.tr - s.fr) * k;
    if (s.t <= 0) {
      s.i++;
      if (s.i >= STORM_PHASES.length) { s.state = 'final'; s.t = 0; s.dps = 20; }
      else { s.state = 'wait'; s.t = STORM_PHASES[s.i].wait; planStorm(); }
    }
  }
  for (const p of room.players.values()) {
    if (!p.alive) continue;
    if (d2(p.x, p.y, s.x, s.y) > s.r * s.r) {
      p.stormTick = (p.stormTick || 0) + DT;
      if (p.stormTick >= 0.5) { p.stormTick = 0; damage(p, s.dps * 0.5, null, { storm: true, style: 'storm' }); }
    }
  }
}

// ---------------------------------------------------------------- בוטים
// רמות קושי: כמה הבוט מפספס, כמה מהר הוא מסתובב, כמה הוא יורה ואיזה נזק הוא עושה
const DIFFICULTY = {
  training: { name: 'אימון', aimErr: 0.55, turn: 2.2, lead: 0,    fire: 0.35, abil: 0.2,  dmg: 0.45, hp: 0.8,  react: [0.9, 1.5], sight: 550, strafe: 0.35, def: 0.2 },
  easy:     { name: 'קל',    aimErr: 0.42, turn: 3,   lead: 0.15, fire: 0.5,  abil: 0.35, dmg: 0.6,  hp: 0.85, react: [0.6, 1.1], sight: 650, strafe: 0.5,  def: 0.35 },
  medium:   { name: 'בינוני', aimErr: 0.24, turn: 5,   lead: 0.45, fire: 0.75, abil: 0.65, dmg: 0.8,  hp: 1,    react: [0.35, 0.7], sight: 750, strafe: 0.7, def: 0.7 },
  hard:     { name: 'קשה',   aimErr: 0.12, turn: 9,   lead: 0.75, fire: 1,    abil: 1,    dmg: 1,    hp: 1,    react: [0.2, 0.4], sight: 850, strafe: 0.85, def: 1 },
};
function botDiff() { return DIFFICULTY[room.phase === 'lobby' ? 'training' : room.difficulty] || DIFFICULTY.easy; }

function botThink(b) {
  const ai = b.ai, def = BY_ID[b.char], A = def.abilities;
  const D = botDiff();
  const inp = b.input;
  inp.b = 0;
  if (!b.alive) return;
  ai.thinkT -= DT;
  // מטרה
  // שומרים על אותה מטרה כל עוד היא קרובה, כדי שלא כולם יתנפלו על אותו שחקן
  let target = null, best = D.sight * D.sight;
  const cur = ai.target && room.players.get(ai.target);
  if (cur && cur.alive && !(cur.st.stealth > 0 && !def.seismic) && d2(b.x, b.y, cur.x, cur.y) < (D.sight + 150) ** 2) target = cur;
  else for (const t of room.players.values()) {
    if (t === b || !t.alive) continue;
    if (t.st.stealth > 0 && !def.seismic) continue;
    const dd = d2(b.x, b.y, t.x, t.y);
    if (dd < best) { best = dd; target = t; }
  }
  if ((target ? target.id : 0) !== ai.target) ai.react = rnd(D.react[0], D.react[1]); // זמן תגובה למטרה חדשה
  ai.target = target ? target.id : 0;
  // אם מישהו תקף אותנו לאחרונה – מגיבים אליו
  if (b.lastAttacker && b.lastAttackerT > 3.5) { const a = room.players.get(b.lastAttacker); if (a && a.alive && d2(b.x, b.y, a.x, a.y) < 900 * 900) { target = a; ai.target = a.id; } }
  let mx = 0, my = 0;
  // בריחה מהסערה
  const s = room.storm;
  let stormPull = 0;
  if (s) {
    const safeR = s.state === 'shrink' || s.state === 'wait' ? Math.min(s.r, s.tr + (s.r - s.tr) * 0.4) : s.r;
    const ddc = Math.sqrt(d2(b.x, b.y, s.tx, s.ty));
    const dOut = Math.sqrt(d2(b.x, b.y, s.x, s.y)) - s.r;
    if (dOut > -100 || ddc > safeR - 60) {
      stormPull = dOut > -100 ? 2.5 : 1;
      mx += ((s.tx - b.x) / (ddc || 1)) * stormPull; my += ((s.ty - b.y) / (ddc || 1)) * stormPull;
    }
  }
  if (target) {
    const dx = target.x - b.x, dy = target.y - b.y, dd = Math.hypot(dx, dy) || 1;
    const melee = A.primary.kind === 'melee';
    const pref = melee ? 55 : Math.min(360, (A.primary.range || 400) * 0.6);
    const nx = dx / dd, ny = dy / dd;
    let f = 0;
    if (dd > pref + 50) f = 1; else if (dd < pref - 70) f = -0.8;
    ai.strafeT -= DT;
    if (ai.strafeT <= 0) { ai.strafeT = rnd(0.6, 1.8); if (Math.random() < 0.5) ai.strafe *= -1; }
    const strafe = (melee && dd < 140 ? 0.4 : 0.85) * D.strafe;
    mx += nx * f + -ny * ai.strafe * strafe; my += ny * f + nx * ai.strafe * strafe;
    // כוונה: שגיאה אקראית, הובלה חלקית וסיבוב איטי לעבר המטרה
    if (ai.thinkT <= 0) {
      ai.aimErr = rnd(-1, 1) * D.aimErr;
      ai.firing = Math.random() < D.fire; // לפעמים הבוט "מהסס" ולא יורה
      ai.thinkT = rnd(0.35, 0.7);
    }
    const ps = A.primary.speed || 900;
    const lead = A.primary.kind === 'projectile' ? (dd / ps) * D.lead : 0;
    const axp = target.x + target.vx * lead, ayp = target.y + target.vy * lead;
    const want = Math.atan2(ayp - b.y, axp - b.x) + ai.aimErr;
    if (ai.aim === undefined) ai.aim = want;
    const da = angDiff(want, ai.aim), maxTurn = D.turn * DT;
    ai.aim += clamp(da, -maxTurn, maxTurn);
    b.input.a = ai.aim;
    inp.ax = axp + rnd(-1, 1) * D.aimErr * 200; inp.ay = ayp + rnd(-1, 1) * D.aimErr * 200;
    ai.react = (ai.react || 0) - DT;
    const ready = ai.react <= 0 && Math.abs(da) < 0.6;
    const range = melee ? A.primary.range + 25 : (A.primary.range || 500) * 0.92;
    if (ready && ai.firing && dd < range) inp.b |= 1;
    const r = Math.random();
    const qr = abilityRange(A.q), er = abilityRange(A.e);
    if (ready) {
      if (dd < qr && r < 0.035 * D.abil) inp.b |= 2;
      if (dd < er && r > 1 - 0.035 * D.abil) inp.b |= 4;
      if (b.ult >= 100 && dd < Math.max(260, abilityRange(A.ult) * 0.8) && Math.random() < 0.08 * D.abil) inp.b |= 16;
    }
    if (b.hp < b.maxHp * 0.5 && dd < 320 && Math.random() < 0.04 * D.def) inp.b |= 8;
    if (A.e.kind === 'heal' && b.hp < b.maxHp * 0.6 && Math.random() < D.def) inp.b |= 4;
    if (A.e.kind === 'buff' && A.e.stealth && b.hp < b.maxHp * 0.45 && Math.random() < D.def) inp.b |= 4;
    if (b.hp < b.maxHp * 0.35 && dd > 150 && dd < 500 && Math.random() < 0.02 * D.def) inp.b |= 32;
  } else {
    // שיטוט / איסוף פריטים
    let pk = null, pb = 650 * 650;
    for (const it of room.pickups) { const dd = d2(b.x, b.y, it.x, it.y); if (dd < pb) { pb = dd; pk = it; } }
    let gx = ai.wx, gy = ai.wy;
    if (pk) { gx = pk.x; gy = pk.y; }
    if (s) { const dd = Math.sqrt(d2(gx, gy, s.tx, s.ty)); if (dd > s.tr * 0.8) { gx = s.tx + rnd(-100, 100); gy = s.ty + rnd(-100, 100); ai.wx = gx; ai.wy = gy; } }
    const dx = gx - b.x, dy = gy - b.y, dd = Math.hypot(dx, dy) || 1;
    if (dd < 60) { ai.wx = rnd(300, WORLD - 300); ai.wy = rnd(300, WORLD - 300); }
    mx += dx / dd; my += dy / dd;
    b.input.a = ai.aim = Math.atan2(dy, dx);
  }
  // התחמקות מתקיעות
  ai.stuckT += DT;
  if (ai.stuckT > 0.5) {
    const moved = Math.hypot(b.x - ai.lx, b.y - ai.ly);
    if (moved < 25 && (mx || my)) { ai.strafe *= -1; ai.unstuck = 0.6; ai.ux = rnd(-1, 1); ai.uy = rnd(-1, 1); }
    ai.lx = b.x; ai.ly = b.y; ai.stuckT = 0;
  }
  if (ai.unstuck > 0) { ai.unstuck -= DT; mx += ai.ux * 2; my += ai.uy * 2; }
  const l = Math.hypot(mx, my);
  inp.mx = l > 0.1 ? mx / l : 0; inp.my = l > 0.1 ? my / l : 0;
}

function abilityRange(a) {
  if (!a) return 0;
  switch (a.kind) {
    case 'projectile': return a.ring ? a.range * 0.6 : a.range * 0.85;
    case 'melee': return a.range + 20;
    case 'dash': return a.dmg || a.landing ? a.dist : 250;
    case 'aoe': return a.at === 'target' ? a.range : a.radius;
    case 'beam': return a.range * 0.9;
    case 'buff': return a.burst ? a.burst.radius + 100 : 400;
    case 'multi': return 300;
    default: return 250;
  }
}

function addBot(char) {
  const id = newId();
  const used = new Set([...room.players.values()].map(p => p.name));
  let name = BOT_NAMES.find(n => !used.has(n)) || ('בוט ' + id);
  const c = char || CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id;
  const b = makePlayer(id, name, c, true);
  room.players.set(id, b);
  return b;
}

function removeBots() { for (const [id, p] of room.players) if (p.isBot) room.players.delete(id); }

// ---------------------------------------------------------------- פריטים
const PICKUP_TYPES = ['hp', 'hp', 'ult', 'shield'];
function spawnPickup() {
  for (let i = 0; i < 50; i++) {
    let x = rnd(100, WORLD - 100), y = rnd(100, WORLD - 100);
    if (room.storm && room.phase === 'match') {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * room.storm.r * 0.9;
      x = clamp(room.storm.x + Math.cos(a) * r, 80, WORLD - 80); y = clamp(room.storm.y + Math.sin(a) * r, 80, WORLD - 80);
    }
    if (blocked(x, y, 20)) continue;
    room.pickups.push({ id: newId(), t: PICKUP_TYPES[Math.floor(Math.random() * PICKUP_TYPES.length)], x, y });
    return;
  }
}

function updatePickups() {
  room.pickupTimer -= DT;
  const cap = room.phase === 'match' ? 34 : 16;
  if (room.pickupTimer <= 0) { room.pickupTimer = room.phase === 'match' ? 5 : 3; if (room.pickups.length < cap) spawnPickup(); }
  for (let i = room.pickups.length - 1; i >= 0; i--) {
    const it = room.pickups[i];
    for (const p of room.players.values()) {
      if (!p.alive || d2(p.x, p.y, it.x, it.y) > (PR + 18) ** 2) continue;
      if (it.t === 'hp' && p.hp >= p.maxHp) continue;
      if (it.t === 'hp') { p.hp = Math.min(p.maxHp, p.hp + 30); emit({ e: 'heal', p: p.id, v: 30, s: 'tea' }); }
      else if (it.t === 'ult') p.ult = Math.min(100, p.ult + 35);
      else if (it.t === 'shield') { p.st.shield = { t: 8, absorb: 30, reduce: 0, reflect: false, selfSlow: 1, style: 'pickup' }; }
      emit({ e: 'pick', p: p.id, t: it.t, x: Math.round(it.x), y: Math.round(it.y) });
      room.pickups.splice(i, 1);
      break;
    }
  }
}

// ---------------------------------------------------------------- עדכון שחקן
function updatePlayer(p) {
  const def = BY_ID[p.char];
  const st = p.st;
  // טיימרים
  for (const k in p.cd) if (p.cd[k] > 0) p.cd[k] = Math.max(0, p.cd[k] - DT);
  st.stun = Math.max(0, st.stun - DT); st.root = Math.max(0, st.root - DT); st.chiblock = Math.max(0, st.chiblock - DT);
  st.invuln = Math.max(0, st.invuln - DT); st.stealth = Math.max(0, st.stealth - DT);
  if (st.slow && (st.slow.t -= DT) <= 0) st.slow = null;
  if (st.shield && (st.shield.t -= DT) <= 0) st.shield = null;
  if (st.buff && (st.buff.t -= DT) <= 0) st.buff = null;
  if (p.lastAttackerT > 0) p.lastAttackerT -= DT;
  if (st.burn) {
    st.burn.t -= DT; st.burn.acc = (st.burn.acc || 0) + DT;
    if (st.burn.acc >= 0.5) { st.burn.acc = 0; damage(p, st.burn.dps * 0.5, room.players.get(st.burn.src) || null, { style: 'burn' }); }
    if (st.burn && st.burn.t <= 0) st.burn = null;
    if (!p.alive) return;
  }
  if (room.phase !== 'countdown') p.ult = Math.min(100, p.ult + DT * 1.0);

  // כוונה
  if (!(st.stun > 0)) p.aim = p.input.a;

  // הטענת ברק
  if (p.casting) {
    p.casting.t -= DT;
    if (st.stun > 0 || st.chiblock > 0) p.casting = null;
    else if (p.casting.t <= 0) { const a = p.casting.a; p.casting = null; fireBeam(p, a); }
  }

  // יכולות
  if (room.phase !== 'countdown' && p.alive) {
    const b = p.input.b;
    if (b & 16 && canCast(p, 'ult')) cast(p, 'ult');
    if (b & 8 && canCast(p, 'def')) cast(p, 'def');
    if (b & 2 && canCast(p, 'q')) cast(p, 'q');
    if (b & 4 && canCast(p, 'e')) cast(p, 'e');
    if (b & 32 && canCast(p, 'wall')) cast(p, 'wall');
    if (b & 1 && canCast(p, 'primary')) cast(p, 'primary');
  }

  // תנועה
  let speed = def.speed;
  const flying = (st.buff && st.buff.fly) || (p.dash && p.dash.fly);
  if (st.buff && st.buff.speedMult) speed *= st.buff.speedMult;
  if (st.slow) speed *= st.slow.mult;
  if (st.shield && st.shield.selfSlow) speed *= st.shield.selfSlow;
  if (!flying && inWater(p.x, p.y)) speed *= def.element === 'water' ? 1.2 : 0.7;
  if (p.casting) speed *= 0.35;
  let vx = 0, vy = 0;
  if (p.dash) {
    vx = p.dash.vx; vy = p.dash.vy;
    p.dash.t -= DT;
    if (p.dash.dmg) {
      const mult = dmgMultOf(p);
      for (const t of room.players.values()) {
        if (t === p || !t.alive || p.dash.hit.has(t.id)) continue;
        if (d2(p.x, p.y, t.x, t.y) < (PR * 2.4) ** 2) {
          p.dash.hit.add(t.id);
          damage(t, p.dash.dmg * mult, p, { style: p.dash.style });
          applyFx(t, p.dash.fx, p, p.dash.vx, p.dash.vy);
        }
      }
    }
    if (p.dash.t <= 0) {
      const L = p.dash.landing;
      p.dash = null;
      if (L) room.pending.push({ t: 0, x: p.x, y: p.y, follow: 0, radius: L.radius, dmg: L.dmg, fx: L.fx, owner: p.id, style: 'quake' });
    }
  } else if (!(st.stun > 0) && !(st.root > 0)) {
    vx = p.input.mx * speed; vy = p.input.my * speed;
  }
  const ox = p.x, oy = p.y;
  p.x += (vx + p.kvx) * DT; p.y += (vy + p.kvy) * DT;
  const decay = Math.exp(-7 * DT);
  p.kvx *= decay; p.kvy *= decay;
  if (Math.abs(p.kvx) < 5) p.kvx = 0; if (Math.abs(p.kvy) < 5) p.kvy = 0;
  if (!flying) {
    for (let it = 0; it < 2; it++) {
      for (const o of MAP.obstacles) pushOut(p, o);
      for (const w of room.walls) pushOut(p, w);
    }
  }
  p.x = clamp(p.x, PR, WORLD - PR); p.y = clamp(p.y, PR, WORLD - PR);
  p.vx = (p.x - ox) / DT; p.vy = (p.y - oy) / DT;
}

function pushOut(p, o) {
  const dx = p.x - o.x, dy = p.y - o.y, rr = PR + o.r, dd = dx * dx + dy * dy;
  if (dd >= rr * rr) return;
  const l = Math.sqrt(dd) || 0.01;
  p.x = o.x + (dx / l) * rr; p.y = o.y + (dy / l) * rr;
  // ספיגת הדיפה בפגיעה בקיר
  p.kvx *= 0.5; p.kvy *= 0.5;
}

// ---------------------------------------------------------------- טילים
function updateProjectiles() {
  const list = room.projectiles;
  for (let i = list.length - 1; i >= 0; i--) {
    const pr = list[i];
    let remove = false;
    if (pr.returning && pr.back) {
      const o = room.players.get(pr.owner);
      if (!o || !o.alive) remove = true;
      else {
        const dx = o.x - pr.x, dy = o.y - pr.y, l = Math.hypot(dx, dy) || 1;
        pr.vx = (dx / l) * pr.speed; pr.vy = (dy / l) * pr.speed;
        if (l < PR + 10) remove = true;
      }
    }
    pr.x += pr.vx * DT; pr.y += pr.vy * DT;
    pr.traveled += pr.speed * DT;
    if (pr.traveled >= pr.range) {
      if (pr.returning && !pr.back) { pr.back = true; pr.hit.clear(); }
      else if (!pr.returning) remove = true;
    }
    if (pr.traveled > pr.range * 3.5) remove = true;
    if (pr.x < -50 || pr.y < -50 || pr.x > WORLD + 50 || pr.y > WORLD + 50) remove = true;
    if (!remove && !(pr.returning && pr.back)) {
      for (const o of MAP.obstacles) if (d2(pr.x, pr.y, o.x, o.y) < (pr.r + o.r) ** 2) {
        if (pr.returning) { pr.back = true; pr.hit.clear(); } else remove = true;
        emit({ e: 'phit', x: Math.round(pr.x), y: Math.round(pr.y), s: pr.style });
        break;
      }
    }
    if (!remove) {
      for (const w of room.walls) if (w.owner !== pr.owner && d2(pr.x, pr.y, w.x, w.y) < (pr.r + w.r) ** 2) {
        w.hp -= pr.dmg; emit({ e: 'phit', x: Math.round(pr.x), y: Math.round(pr.y), s: pr.style });
        if (pr.returning && !pr.back) { pr.back = true; pr.hit.clear(); } else if (!pr.returning) remove = true;
        break;
      }
    }
    if (!remove) {
      const owner = room.players.get(pr.owner);
      for (const t of room.players.values()) {
        if (!t.alive || t.id === pr.owner || pr.hit.has(t.id)) continue;
        if (d2(pr.x, pr.y, t.x, t.y) > (pr.r + PR) ** 2) continue;
        if (t.st.shield && t.st.shield.reflect) {
          pr.owner = t.id; pr.vx = -pr.vx; pr.vy = -pr.vy; pr.traveled = 0; pr.hit.clear(); pr.back = false;
          pr.x += pr.vx * DT * 2; pr.y += pr.vy * DT * 2;
          emit({ e: 'reflect', x: Math.round(pr.x), y: Math.round(pr.y) });
          break;
        }
        if (t.st.invuln > 0) continue;
        damage(t, pr.dmg * dmgMultOf(owner), owner, { style: pr.style });
        applyFx(t, pr.fx, owner, pr.vx, pr.vy);
        if (pr.pierce) pr.hit.add(t.id); else { remove = true; break; }
      }
    }
    if (remove) list.splice(i, 1);
  }
}

// ---------------------------------------------------------------- שלבי המשחק
function humans() { return [...room.players.values()].filter(p => !p.isBot); }

function toLobby() {
  room.phase = 'lobby'; room.storm = null; room.winner = null;
  room.projectiles = []; room.walls = []; room.pending = []; room.pickups = [];
  removeBots();
  for (let i = 0; i < LOBBY_BOTS; i++) addBot();
  for (const p of room.players.values()) { p.kills = 0; p.place = 0; p.ult = 0; spawnPlayer(p); }
  for (let i = 0; i < 10; i++) spawnPickup();
}

function startCountdown(botCount) {
  if (room.phase !== 'lobby') return;
  removeBots();
  const hs = humans();
  let n = clamp(botCount | 0, 0, MAX_BOTS);
  if (hs.length + n < 2) n = 2 - hs.length;
  for (let i = 0; i < n; i++) addBot();
  room.projectiles = []; room.walls = []; room.pending = []; room.pickups = [];
  room.phase = 'countdown'; room.timer = 5;
  // מציבים את כולם בפיזור על המפה
  for (const p of room.players.values()) { p.kills = 0; p.place = 0; p.ult = 0; p.dmgDone = 0; p.alive = false; }
  for (const p of room.players.values()) spawnPlayer(p, findSpawn(false));
  for (let i = 0; i < 28; i++) spawnPickup();
  emit({ e: 'countdown' });
}

function startMatch() {
  room.phase = 'match'; room.matchTime = 0;
  startStorm();
  emit({ e: 'go' });
}

function endMatch() {
  room.phase = 'ended'; room.timer = 9;
  const alive = [...room.players.values()].filter(p => p.alive);
  const w = alive[0] || null;
  if (w) w.place = 1;
  const board = [...room.players.values()].sort((a, b) => (a.place || 99) - (b.place || 99) || b.kills - a.kills)
    .slice(0, 12).map(p => ({ n: p.name, c: p.char, k: p.kills, pl: p.place, b: p.isBot, d: Math.round(p.dmgDone) }));
  room.winner = w ? { n: w.name, c: w.char, id: w.id } : null;
  room.board = board;
  emit({ e: 'win', n: w ? w.name : '', c: w ? w.char : '' });
}

// ---------------------------------------------------------------- לולאת המשחק
function tick() {
  if (room.players.size === 0 || humans().length === 0) return;
  room.events = [];
  if (room.phase === 'countdown') { room.timer -= DT; if (room.timer <= 0) startMatch(); }
  if (room.phase === 'ended') { room.timer -= DT; if (room.timer <= 0) toLobby(); }
  if (room.phase === 'match') room.matchTime += DT;

  for (const p of room.players.values()) if (p.isBot) botThink(p);
  for (const p of room.players.values()) if (p.alive) updatePlayer(p);

  // התקפות מושהות
  for (let i = room.pending.length - 1; i >= 0; i--) {
    const z = room.pending[i];
    z.t -= DT;
    if (z.t <= 0) { room.pending.splice(i, 1); resolveAoe(z); }
  }
  updateProjectiles();
  // חומות
  for (let i = room.walls.length - 1; i >= 0; i--) {
    const w = room.walls[i];
    w.life -= DT;
    if (w.hp <= 0 || w.life <= 0) { room.walls.splice(i, 1); emit({ e: 'wallbreak', x: Math.round(w.x), y: Math.round(w.y), el: w.el }); }
  }
  updatePickups();
  if (room.phase === 'match') {
    updateStorm();
    if (aliveCount() <= 1) endMatch();
  }
  // לובי – החייאה
  if (room.phase === 'lobby') {
    for (const p of room.players.values()) {
      if (!p.alive && !p.spectator) { p.deadT += DT; if (p.deadT > 3) spawnPlayer(p); }
    }
  } else {
    for (const p of room.players.values()) if (!p.alive) p.deadT += DT;
  }
  broadcast();
}

function flags(p) {
  const s = p.st;
  let f = 0;
  if (s.stun > 0) f |= 1;
  if (s.shield) f |= 2;
  if (s.shield && s.shield.reflect) f |= 4;
  if (s.invuln > 0) f |= 8;
  if (s.buff) f |= 16;
  if (s.stealth > 0) f |= 32;
  if (s.burn) f |= 64;
  if (s.slow) f |= 128;
  if (s.root > 0) f |= 256;
  if (s.chiblock > 0) f |= 512;
  if ((s.buff && s.buff.fly) || (p.dash && p.dash.fly)) f |= 1024;
  if (p.dash) f |= 2048;
  if (p.casting) f |= 4096;
  if (s.shield && s.shield.reduce >= 0.5) f |= 8192;
  if (p.isBot) f |= 16384;
  return f;
}

function broadcast() {
  const players = [];
  for (const p of room.players.values()) {
    if (!p.alive && room.phase !== 'lobby' && p.deadT > 1) continue;
    if (!p.alive && room.phase === 'lobby' && p.deadT > 1) continue;
    players.push({
      i: p.id, n: p.name, c: p.char, x: Math.round(p.x), y: Math.round(p.y), h: Math.ceil(p.hp), m: p.maxHp,
      a: +p.aim.toFixed(2), al: p.alive ? 1 : 0, f: flags(p), k: p.kills,
      bs: p.st.buff ? p.st.buff.style : undefined, ss: p.st.shield ? p.st.shield.style : undefined,
    });
  }
  const s = room.storm;
  const common = JSON.stringify({
    ph: room.phase, df: room.difficulty, tm: +room.timer.toFixed(1), mt: Math.round(room.matchTime), al: aliveCount(), tot: room.players.size,
    P: players,
    J: room.projectiles.map(p => [p.id, Math.round(p.x), Math.round(p.y), Math.round(p.vx), Math.round(p.vy), p.r, p.style]),
    W: room.walls.map(w => [w.id, Math.round(w.x), Math.round(w.y), Math.round((w.hp / w.maxHp) * 100), w.el]),
    K: room.pickups.map(k => [k.id, k.t, Math.round(k.x), Math.round(k.y)]),
    S: s ? { x: Math.round(s.x), y: Math.round(s.y), r: Math.round(s.r), tx: Math.round(s.tx), ty: Math.round(s.ty), tr: Math.round(s.tr), st: s.state, t: Math.ceil(s.t), d: s.dps } : null,
    E: room.events,
    win: room.phase === 'ended' ? room.winner : undefined,
    B: room.phase === 'ended' ? room.board : undefined,
  }).slice(1);
  for (const p of room.players.values()) {
    if (!p.ws || p.ws.readyState !== 1) continue;
    const cdOut = {}, cdMaxOut = {};
    for (const k in p.cd) { cdOut[k] = +p.cd[k].toFixed(2); cdMaxOut[k] = +p.cdMax[k].toFixed(2); }
    const me = JSON.stringify({ id: p.id, al: p.alive, cd: cdOut, cm: cdMaxOut, u: Math.floor(p.ult), sp: p.spectator, dt: +p.deadT.toFixed(1),
      cb: p.st.chiblock > 0, pl: p.place, cast: p.casting ? +p.casting.t.toFixed(2) : 0 });
    p.ws.send('{"t":"s","me":' + me + ',' + common);
  }
}

// ---------------------------------------------------------------- רשת
const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  let player = null;
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.t === 'join' && !player) {
      const id = newId();
      const name = String(msg.name || 'שחקן').replace(/[<>]/g, '').slice(0, 16) || 'שחקן';
      const char = BY_ID[msg.char] ? msg.char : 'aang';
      player = makePlayer(id, name, char, false);
      player.ws = ws;
      if (humans().length === 0) { room.players.set(id, player); toLobby(); }
      else {
        room.players.set(id, player);
        if (room.phase === 'lobby') spawnPlayer(player);
        else { player.spectator = true; player.alive = false; }
      }
      ws.send(JSON.stringify({ t: 'welcome', id, map: MAP, pr: PR }));
      emit({ e: 'join', n: name });
    } else if (!player) return;
    else if (msg.t === 'in') {
      const i = player.input;
      i.mx = clamp(+msg.mx || 0, -1, 1); i.my = clamp(+msg.my || 0, -1, 1);
      const l = Math.hypot(i.mx, i.my); if (l > 1) { i.mx /= l; i.my /= l; }
      i.a = +msg.a || 0; i.ax = +msg.ax || 0; i.ay = +msg.ay || 0; i.b = msg.b | 0;
    } else if (msg.t === 'start') {
      if (room.phase === 'lobby' && ['easy', 'medium', 'hard'].includes(msg.diff)) room.difficulty = msg.diff;
      startCountdown(msg.bots);
    } else if (msg.t === 'char' && BY_ID[msg.char]) {
      if (room.phase === 'lobby' || player.spectator || !player.alive) {
        player.char = msg.char;
        if (room.phase === 'lobby') spawnPlayer(player);
      }
    } else if (msg.t === 'ping') {
      ws.send(JSON.stringify({ t: 'pong', c: msg.c }));
    }
  });
  ws.on('close', () => {
    if (player) {
      room.players.delete(player.id);
      if (humans().length === 0) { room.phase = 'lobby'; removeBots(); room.storm = null; }
    }
  });
});

setInterval(tick, 1000 / TICK_RATE);

server.listen(PORT, () => {
  const ips = [];
  for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
  console.log('\n  ⚔  זירת האווטאר רצה!');
  console.log(`  במחשב הזה:   http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  ברשת המקומית: http://${ip}:${PORT}`));
  console.log('');
});
