// לקוח המשחק – תפריט, רשת, ציור הזירה, אפקטים ו-HUD
(function () {
  const { CHARACTERS, BY_ID, ELEMENTS, WALL, SLOT_KEYS } = AvatarData;
  const TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  // ================================================================ מצב
  let ws = null, myId = 0, MAP = null, PR = 22;
  let selected = localStorage.getItem('avatar.char') || 'aang';
  if (!BY_ID[selected]) selected = 'aang';
  let joined = false, changingChar = false;
  const snaps = []; // {t, data}
  let latest = null, me = null;
  const particles = [], effects = [], floaters = [];
  const dashTrails = new Map(); // id -> {t, style}
  const charges = new Map(); // id -> {t, d, style}
  let shake = 0, flash = 0, flashColor = '#fff';
  let ping = 0;
  const cam = { x: 1500, y: 1500, zoom: 1 };
  let groundCanvas = null, minimapBase = null;
  let lastPhase = '', lastCountdown = -1;
  let centerMsgT = 0;
  let spectateId = 0;

  // ================================================================ תפריט
  const FILTERS = [
    { k: 'all', n: 'כולם' }, { k: 'צוות אווטאר', n: 'צוות אווטאר' }, { k: 'אומת האש', n: 'אומת האש' },
    { k: 'el:air', n: 'אוויר' }, { k: 'el:water', n: 'מים' }, { k: 'el:earth', n: 'אדמה' }, { k: 'el:fire', n: 'אש' }, { k: 'el:none', n: 'לוחמים' },
  ];
  let filter = 'all';

  function buildMenu() {
    const fEl = $('filters'); fEl.innerHTML = '';
    for (const f of FILTERS) {
      const b = document.createElement('button'); b.textContent = f.n; if (f.k === filter) b.className = 'on';
      b.onclick = () => { filter = f.k; buildMenu(); };
      fEl.appendChild(b);
    }
    const grid = $('charGrid'); grid.innerHTML = '';
    for (const c of CHARACTERS) {
      if (filter !== 'all') {
        if (filter.startsWith('el:')) { if (c.element !== filter.slice(3)) continue; }
        else if (c.faction !== filter) continue;
      }
      const card = document.createElement('div'); card.className = 'card' + (c.id === selected ? ' sel' : '');
      const cv = document.createElement('canvas'); cv.width = 240; cv.height = 240;
      Art.drawPortrait(cv, c.id);
      card.appendChild(cv);
      // אפשרות לתמונה מותאמת אישית: public/portraits/<id>.png
      const file = customPortraits.find(f => f.replace(/\.\w+$/, '') === c.id);
      if (file) {
        const img = new Image();
        img.onload = () => { if (cv.parentNode === card) card.replaceChild(img, cv); };
        img.src = 'portraits/' + file;
      }
      const el = ELEMENTS[c.element];
      card.insertAdjacentHTML('beforeend', `<span class="elb" style="background:${el.color}">${el.name}</span><div class="nm">${c.name}<small>${c.title}</small></div>`);
      card.onclick = () => { selected = c.id; localStorage.setItem('avatar.char', selected); buildMenu(); showDetails(); Sfx.init(); Sfx.play('pick'); };
      grid.appendChild(card);
    }
    showDetails();
  }

  let portraitT = 0;
  function showDetails() {
    const c = BY_ID[selected], el = ELEMENTS[c.element];
    $('dName').textContent = c.name; $('dTitle').textContent = c.title;
    const de = $('dElement'); de.textContent = el.name; de.style.background = el.color;
    $('dFaction').textContent = c.faction;
    $('dDesc').textContent = c.desc + (c.passive ? ' · ' + c.passive : '');
    $('sHp').style.width = Math.round(((c.hp - 80) / 70) * 100) + '%';
    $('sSpd').style.width = Math.round(((c.speed - 190) / 110) * 100) + '%';
    const ul = $('dAbilities'); ul.innerHTML = '';
    const slots = ['primary', 'q', 'e', 'def', 'ult'];
    for (const s of slots) {
      const a = c.abilities[s];
      const li = document.createElement('li'); if (s === 'ult') li.className = 'ult';
      li.innerHTML = `<kbd>${SLOT_KEYS[s]}</kbd><div><b>${a.name}</b><span>${describe(a)}</span></div>`;
      ul.appendChild(li);
    }
    const li = document.createElement('li');
    li.innerHTML = `<kbd>F</kbd><div><b>${WALL.name} (${el.name})</b><span>בונה חומת מגן מול הדמות</span></div>`;
    ul.appendChild(li);
    $('playBtn').textContent = changingChar ? 'בחר דמות ✓' : 'היכנס לזירה ⚔';
  }

  function describe(a) {
    const parts = [];
    const kinds = { projectile: 'קליע', melee: 'תקיפה קרובה', dash: 'זינוק', aoe: 'פגיעה אזורית', shield: 'הגנה', heal: 'ריפוי', beam: 'קרן', buff: 'חיזוק', multi: 'משולב' };
    parts.push(kinds[a.kind] || '');
    if (a.dmg) parts.push(`${a.dmg} נזק${a.count > 1 ? ' ×' + a.count : ''}${a.pulses ? ' ×' + a.pulses : ''}`);
    const fx = a.fx || {};
    if (fx.stun) parts.push('הלם'); if (fx.burn) parts.push('שריפה'); if (fx.slow) parts.push('האטה'); if (fx.root) parts.push('קיבוע');
    if (fx.chiblock) parts.push('חוסם צ׳י'); if (fx.knock) parts.push('הדיפה'); if (fx.pull) parts.push('משיכה');
    if (a.reflect) parts.push('מחזיר התקפות'); if (a.absorb) parts.push(`סופג ${a.absorb}`); if (a.reduce) parts.push(`-${Math.round(a.reduce * 100)}% נזק`);
    if (a.amount) parts.push(`+${a.amount} חיים`); if (a.stealth) parts.push('היעלמות'); if (a.fly) parts.push('מעוף');
    if (a.dmgMult) parts.push(`×${a.dmgMult} נזק`); if (a.cdMult) parts.push('טעינה מהירה'); if (a.invuln) parts.push('חסינות');
    if (a.returning) parts.push('חוזר'); if (a.landing) parts.push(`נחיתה ${a.landing.dmg} נזק`);
    if (a.parts) parts.push('גל הלם + חומות');
    if (a.cd) parts.push(`${a.cd} שנ׳`);
    return parts.filter(Boolean).join(' · ');
  }

  // אנימציה קטנה בפורטרט הגדול
  function animatePortrait() {
    if (!$('menu').classList.contains('hidden')) { portraitT += 0.016; Art.drawPortrait($('bigPortrait'), selected, { t: portraitT, zoom: 1.25 }); }
    requestAnimationFrame(animatePortrait);
  }

  $('nameInput').value = localStorage.getItem('avatar.name') || '';
  $('playBtn').onclick = () => {
    Sfx.init();
    if (changingChar) {
      changingChar = false; send({ t: 'char', char: selected }); $('menu').classList.add('hidden'); showDetails(); return;
    }
    const name = $('nameInput').value.trim() || 'שחקן' + Math.floor(Math.random() * 1000);
    localStorage.setItem('avatar.name', name);
    connect(name);
  };
  $('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('playBtn').click(); });

  // ================================================================ רשת
  function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

  function connect(name) {
    $('connStatus').textContent = 'מתחבר...';
    $('playBtn').disabled = true;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.onopen = () => { send({ t: 'join', name, char: selected }); };
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.t === 's') onSnapshot(m);
      else if (m.t === 'welcome') {
        myId = m.id; MAP = m.map; PR = m.pr; joined = true;
        buildGround(); buildMinimapBase(); buildAbilityBar();
        $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
        $('playBtn').disabled = false; $('connStatus').textContent = '';
      } else if (m.t === 'pong') ping = Math.round(performance.now() - m.c);
    };
    ws.onclose = () => {
      $('playBtn').disabled = false;
      if (joined) { showCenter('החיבור לשרת נותק', 'רענן את הדף כדי להתחבר מחדש', 999); }
      else $('connStatus').textContent = 'לא הצלחתי להתחבר לשרת. ודא שהשרת רץ (npm start).';
    };
    ws.onerror = () => {};
  }
  setInterval(() => send({ t: 'ping', c: performance.now() }), 2000);

  function onSnapshot(m) {
    const now = performance.now();
    snaps.push({ t: now, d: m });
    while (snaps.length > 30) snaps.shift();
    latest = m; me = m.me;
    if (m.E) for (const e of m.E) handleEvent(e, m);
    // מעבר שלבים
    if (m.ph !== lastPhase) {
      if (m.ph === 'lobby') { $('endScreen').classList.add('hidden'); showCenter('אזור אימון', 'התאמן מול בוטים או לחץ "התחל" לקרב אמיתי', 3); }
      if (m.ph === 'match') { showCenter('קרב!', 'רק אחד ישרוד', 2); }
      if (m.ph === 'ended') showEnd(m);
      lastPhase = m.ph;
    }
    if (m.ph === 'countdown') {
      const c = Math.ceil(m.tm);
      if (c !== lastCountdown) { lastCountdown = c; showCenter(String(c), 'מתכוננים לקרב...', 1.1); Sfx.play('countdown'); }
    } else lastCountdown = -1;
    if (m.ph === 'ended') updateEndTimer(m);
  }

  // ================================================================ קלט
  const keys = new Set();
  let mouseX = 0, mouseY = 0, mouseL = false, mouseR = false;
  window.addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    keys.add(e.code);
    if (e.code === 'Tab') { e.preventDefault(); $('scoreboard').classList.remove('hidden'); renderScoreboard(); }
    if (e.code === 'KeyM') { const mu = Sfx.toggle(); showCenter(mu ? 'סאונד כבוי' : 'סאונד פועל', '', 0.8); }
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'Tab') $('scoreboard').classList.add('hidden'); });
  window.addEventListener('blur', () => { keys.clear(); mouseL = mouseR = false; });
  canvas.addEventListener('mousemove', (e) => { mouseX = e.clientX * DPR; mouseY = e.clientY * DPR; });
  canvas.addEventListener('mousedown', (e) => { Sfx.init(); if (e.button === 0) mouseL = true; if (e.button === 2) mouseR = true; });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function myRenderPos() {
    const p = interpPlayer(myId, performance.now() - 40);
    return p || { x: cam.x, y: cam.y };
  }

  setInterval(() => {
    if (!joined || !$('menu').classList.contains('hidden')) { if (joined) send({ t: 'in', mx: 0, my: 0, a: 0, ax: 0, ay: 0, b: 0 }); return; }
    let mx = 0, my = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    const l = Math.hypot(mx, my); if (l) { mx /= l; my /= l; }
    const p = myRenderPos();
    const wx = cam.x + (mouseX - W / 2) / cam.zoom, wy = cam.y + (mouseY - H / 2) / cam.zoom;
    const a = Math.atan2(wy - p.y, wx - p.x);
    let b = 0;
    if (mouseL) b |= 1;
    if (keys.has('KeyQ')) b |= 2;
    if (keys.has('KeyE')) b |= 4;
    if (keys.has('Space') || mouseR) b |= 8;
    if (keys.has('KeyR')) b |= 16;
    if (keys.has('KeyF')) b |= 32;
    send({ t: 'in', mx, my, a: +a.toFixed(3), ax: Math.round(wx), ay: Math.round(wy), b });
  }, 33);

  // ================================================================ אינטרפולציה
  function interpPlayer(id, rt) {
    if (!snaps.length) return null;
    let a = null, b = null;
    for (let i = snaps.length - 1; i >= 0; i--) { if (snaps[i].t <= rt) { a = snaps[i]; b = snaps[i + 1] || null; break; } }
    if (!a) a = snaps[0];
    const pa = a.d.P.find(p => p.i === id);
    if (!pa) { const L = snaps[snaps.length - 1].d.P.find(p => p.i === id); return L ? { ...L } : null; }
    if (!b) return { ...pa };
    const pb = b.d.P.find(p => p.i === id);
    if (!pb) return { ...pa };
    const k = Math.min(1, Math.max(0, (rt - a.t) / (b.t - a.t || 1)));
    if (Math.hypot(pb.x - pa.x, pb.y - pa.y) > 300) return { ...pb }; // קפיצה (הופעה מחדש)
    let da = pb.a - pa.a; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
    return { ...pb, x: pa.x + (pb.x - pa.x) * k, y: pa.y + (pb.y - pa.y) * k, a: pa.a + da * k };
  }

  // ================================================================ אירועים
  const SND_BY_STYLE = { air: 'air', tornado: 'air', avatar: 'ult', water: 'water', ice: 'ice', blood: 'boom', rock: 'rock', quake: 'rock', pillar: 'rock',
    mountain: 'boom', leap: 'rock', fire: 'fire', flamecone: 'fire', firejet: 'fire', firering: 'fire', dragonbreath: 'fire', comet: 'fire',
    bluefire: 'fire', bluejet: 'fire', bluering: 'fire', lightning: 'lightning', sword: 'melee', fan: 'melee', chi: 'melee', knife: 'knife', pin: 'knife',
    boomerang: 'air', smoke: 'air', roll: 'dash', flip: 'dash', kyoshi: 'melee', swords: 'shield', earth: 'rock', tea: 'heal', heal: 'heal' };

  function nearMe(x, y, r = 900) { const p = myRenderPos(); return Math.hypot(x - p.x, y - p.y) < r; }
  function playerPos(id) { if (!latest) return null; const p = latest.P.find(q => q.i === id); return p; }

  function handleEvent(e, m) {
    switch (e.e) {
      case 'hit': {
        const big = e.v >= 20;
        floaters.push({ x: e.x + (Math.random() - 0.5) * 20, y: e.y - 40, v: e.v, t: 0, me: e.p === myId, color: e.s === 'storm' ? '#d58aff' : e.s === 'burn' ? '#ffa040' : (e.p === myId ? '#ff6060' : '#fff6c0'), big });
        burst(e.x, e.y, 6 + Math.min(10, e.v / 3), Art.styleColor(e.s, 'none'), 160, 0.35, 3);
        if (e.p === myId) { shake = Math.min(18, shake + 4 + e.v / 4); Sfx.play('hurt'); }
        else if (nearMe(e.x, e.y, 700)) Sfx.play('hit');
        break;
      }
      case 'aoe': spawnAoe(e); if (nearMe(e.x, e.y)) { Sfx.play(SND_BY_STYLE[e.s] || 'boom'); if (e.r > 200) shake = Math.min(20, shake + 8); } break;
      case 'warn': effects.push({ type: 'warn', x: e.x, y: e.y, r: e.r, t: 0, dur: e.d, s: e.s, follow: e.f }); break;
      case 'beam': effects.push({ type: 'beam', x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, w: e.w, t: 0, dur: 0.35, s: e.s }); flash = 0.35; flashColor = '#cfe8ff'; if (nearMe(e.x1, e.y1, 1100)) { Sfx.play('lightning'); shake = Math.min(16, shake + 6); }
        for (let i = 0; i < 20; i++) { const k = Math.random(); burst(e.x1 + (e.x2 - e.x1) * k, e.y1 + (e.y2 - e.y1) * k, 1, '#bfe4ff', 120, 0.4, 2.5); }
        break;
      case 'charge': { charges.set(e.p, { t: 0, d: e.d, s: e.s }); const p = playerPos(e.p); if (p && nearMe(p.x, p.y)) Sfx.play('charge'); break; }
      case 'melee': spawnMelee(e); if (nearMe(e.x, e.y)) Sfx.play(SND_BY_STYLE[e.s] || 'melee'); break;
      case 'dash': dashTrails.set(e.p, { t: 0.4, s: e.s }); { const p = playerPos(e.p); if (p && nearMe(p.x, p.y)) Sfx.play(SND_BY_STYLE[e.s] === 'fire' ? 'fire' : 'dash'); } break;
      case 'shield': { const p = playerPos(e.p); if (p && nearMe(p.x, p.y)) Sfx.play('shield'); } break;
      case 'shieldbreak': { const p = playerPos(e.p); if (p) burst(p.x, p.y, 18, '#bfe8ff', 220, 0.5, 3); } break;
      case 'block': floaters.push({ x: e.x, y: e.y, text: 'נחסם!', t: 0, color: '#9fd3ff' }); break;
      case 'heal': { const p = playerPos(e.p); if (p) { floaters.push({ x: p.x, y: p.y - 50, v: '+' + e.v, t: 0, color: '#6dffb0' }); for (let i = 0; i < 16; i++) particles.push({ x: p.x + (Math.random() - 0.5) * 40, y: p.y + 20, vx: 0, vy: -60 - Math.random() * 60, life: 0, max: 0.9, size: 4, color: '#6dffb0', glow: true, plus: true }); if (nearMe(p.x, p.y)) Sfx.play('heal'); } break; }
      case 'buff': { const p = playerPos(e.p); if (p) { spawnAoe({ x: p.x, y: p.y, r: 120, s: e.s }); if (e.s === 'smoke') for (let i = 0; i < 40; i++) particles.push({ x: p.x + (Math.random() - 0.5) * 60, y: p.y + (Math.random() - 0.5) * 60, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, life: 0, max: 1.6, size: 18 + Math.random() * 18, color: 'rgba(150,150,165,0.5)', smoke: true, grow: 20 }); } } break;
      case 'ult': {
        const c = BY_ID[e.c];
        const p = playerPos(e.p);
        const who = e.p === myId ? 'אתה' : (p ? p.n : c.name);
        if (e.p === myId || (p && nearMe(p.x, p.y, 750))) {
          showCenter(e.n + '!', who + ' · ' + c.name, 1.4);
          flash = 0.5; flashColor = ELEMENTS[c.element].glow;
          Sfx.play('ult');
        } else addFeedText(`${who} הפעיל/ה ${e.n}`);
        break;
      }
      case 'kill': addKillFeed(e); if (e.ki === myId) { Sfx.play('kill'); showCenter('חיסלת את ' + e.v + '!', '', 1.4); }
        if (e.vi === myId) { spectateId = e.ki || 0; }
        burst(e.x, e.y, 40, '#fff', 300, 0.8, 4);
        break;
      case 'reflect': burst(e.x, e.y, 14, '#ffffff', 260, 0.4, 3); if (nearMe(e.x, e.y)) Sfx.play('shield'); break;
      case 'wallbreak': burst(e.x, e.y, 14, wallColor(e.el), 200, 0.6, 5); break;
      case 'build': if (nearMe(e.x, e.y)) Sfx.play('build'); burst(e.x, e.y, 12, wallColor(e.el), 120, 0.5, 4); break;
      case 'pick': if (e.p === myId) { Sfx.play('pick'); floaters.push({ x: e.x, y: e.y - 20, text: { hp: '+30 חיים', ult: '+35 אולטימייט', shield: '+מגן' }[e.t], t: 0, color: '#ffe680' }); } break;
      case 'phit': burst(e.x, e.y, 6, Art.styleColor(e.s, 'none'), 100, 0.3, 3); break;
      case 'go': Sfx.play('go'); break;
      case 'storm': showCenter('הסערה מתכווצת!', 'היכנס לאזור הבטוח', 2.2); break;
      case 'join': addFeedText(`${e.n} הצטרף/ה לזירה`); break;
    }
  }

  function wallColor(el) { return { earth: '#9a7a52', water: '#a8e4ff', fire: '#a03a2a', air: '#f0e6c8', none: '#9a6a3a' }[el] || '#999'; }

  function burst(x, y, n, color, speed, life, size) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = speed * (0.3 + Math.random() * 0.7);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8), color, glow: true, drag: 3 });
    }
  }

  function spawnAoe(e) {
    const col = Art.styleColor(e.s, 'none');
    effects.push({ type: 'ring', x: e.x, y: e.y, r: e.r, t: 0, dur: 0.55, color: col, s: e.s });
    const n = Math.min(90, 20 + e.r / 4);
    if (e.s === 'tornado') {
      effects.push({ type: 'tornado', x: e.x, y: e.y, r: e.r, t: 0, dur: 0.9 });
    } else if (e.s === 'quake' || e.s === 'pillar' || e.s === 'mountain' || e.s === 'leap') {
      for (let i = 0; i < n; i++) { const a = Math.random() * TAU, d = Math.random() * e.r; particles.push({ x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, vx: Math.cos(a) * 60, vy: -120 - Math.random() * 200, g: 600, life: 0, max: 0.8, size: 4 + Math.random() * 6, color: Math.random() < 0.5 ? '#8a6a3a' : '#6a5030', rock: true }); }
      effects.push({ type: 'cracks', x: e.x, y: e.y, r: e.r, t: 0, dur: 1.4, seed: Math.random() * 1000 });
      if (e.s === 'pillar' || e.s === 'mountain') effects.push({ type: 'pillar', x: e.x, y: e.y, r: e.s === 'mountain' ? e.r * 0.55 : e.r * 0.6, t: 0, dur: e.s === 'mountain' ? 1.2 : 0.8 });
    } else if (e.s === 'blood') {
      for (let i = 0; i < 60; i++) { const a = Math.random() * TAU; particles.push({ x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, vx: -Math.cos(a) * 300, vy: -Math.sin(a) * 300, life: 0, max: 0.7, size: 3, color: '#ff2040', glow: true }); }
    } else {
      for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = e.r * (1.2 + Math.random() * 1.6); particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.45 + Math.random() * 0.3, size: 4 + Math.random() * 5, color: col, glow: true, drag: 4, flame: /fire|comet|dragon|blue/.test(e.s) }); }
    }
  }

  function spawnMelee(e) {
    const col = Art.styleColor(e.s, 'none');
    const cone = e.s === 'flamecone' || e.s === 'dragonbreath';
    effects.push({ type: cone ? 'cone' : 'slash', x: e.x, y: e.y, a: e.a, arc: e.arc, r: e.r, t: 0, dur: cone ? 0.5 : 0.22, color: col, s: e.s, p: e.p });
    if (cone) {
      const n = e.s === 'dragonbreath' ? 140 : 60;
      for (let i = 0; i < n; i++) {
        const a = e.a + (Math.random() - 0.5) * e.arc, s = e.r * (1.5 + Math.random() * 1.2);
        particles.push({ x: e.x + Math.cos(e.a) * 20, y: e.y + Math.sin(e.a) * 20, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.35 + Math.random() * 0.25, size: 6 + Math.random() * 10, color: Math.random() < 0.3 ? '#ffe070' : col, glow: true, drag: 2.5, flame: true, grow: 30 });
      }
    }
  }

  // ================================================================ HUD
  function showCenter(big, small, dur) {
    $('centerMsg').innerHTML = `${big}${small ? `<small>${small}</small>` : ''}`;
    $('centerMsg').style.opacity = 1;
    clearTimeout(centerMsgT);
    centerMsgT = setTimeout(() => { $('centerMsg').style.opacity = 0; }, dur * 1000);
  }

  function addKillFeed(e) {
    const div = document.createElement('div');
    div.className = 'kf' + (e.ki === myId || e.vi === myId ? ' me' : '');
    const kName = e.k || '???';
    div.innerHTML = `<span class="k">${esc(kName)}</span> ${e.k === 'הסערה' ? '🌀' : '⚔'} <span class="v">${esc(e.v)}</span>`;
    $('killFeed').prepend(div);
    setTimeout(() => div.remove(), 6000);
    while ($('killFeed').children.length > 6) $('killFeed').lastChild.remove();
  }
  function addFeedText(t) {
    const div = document.createElement('div'); div.className = 'kf'; div.textContent = t;
    $('killFeed').prepend(div); setTimeout(() => div.remove(), 4000);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  const SLOTS = ['primary', 'q', 'e', 'def', 'ult', 'wall'];
  let abilityEls = {}, abilityChar = '';
  function buildAbilityBar() {
    const meP = latest && latest.P.find(p => p.i === myId);
    const charId = meP ? meP.c : selected;
    if (abilityChar === charId) return;
    abilityChar = charId;
    const c = BY_ID[charId];
    const bar = $('abilityBar'); bar.innerHTML = ''; abilityEls = {};
    for (const s of SLOTS) {
      const a = s === 'wall' ? { name: WALL.name, kind: 'wall', style: c.element } : c.abilities[s];
      const d = document.createElement('div'); d.className = 'ab' + (s === 'ult' ? ' ult' : '');
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
      Art.drawAbilityIcon(cv, a, c.element, s);
      d.appendChild(cv);
      d.insertAdjacentHTML('beforeend', `<span class="key">${SLOT_KEYS[s]}</span><span class="nm">${a.name}</span><div class="cdv"></div>`);
      bar.appendChild(d);
      abilityEls[s] = { root: d, cd: d.querySelector('.cdv') };
    }
    $('charName').textContent = c.name + ' · ' + c.title;
  }

  let hudT = 0;
  function updateHud(dt) {
    if (!latest || !me) return;
    hudT -= dt;
    if (hudT > 0) return;
    hudT = 0.08;
    buildAbilityBar();
    const meP = latest.P.find(p => p.i === myId);
    const ph = latest.ph;
    $('aliveCount').textContent = ph === 'match' || ph === 'ended' ? latest.al : latest.tot;
    $('aliveBox').lastChild.textContent = ph === 'match' || ph === 'ended' ? ' בחיים' : ' בזירה';
    $('killCount').textContent = meP ? meP.k : 0;
    let phTxt = '';
    if (ph === 'lobby') phTxt = 'אימון חופשי';
    else if (ph === 'countdown') phTxt = 'הקרב מתחיל בעוד ' + Math.ceil(latest.tm);
    else if (ph === 'match' && latest.S) {
      const S = latest.S;
      phTxt = S.st === 'wait' ? `🌀 הסערה זזה בעוד ${S.t} שנ׳` : S.st === 'shrink' ? `🌀 הסערה מתכווצת! (${S.t})` : '🌀 סערה סופית';
    } else if (ph === 'ended') phTxt = 'הקרב נגמר';
    if (ph === 'match' || ph === 'countdown') phTxt += ` · בוטים: ${DIFF_NAMES[latest.df] || ''}`;
    $('phaseBox').textContent = phTxt + (ping ? `  ·  ${ping}ms` : '');
    $('lobbyPanel').classList.toggle('hidden', ph !== 'lobby');
    $('botVal').textContent = $('botRange').value;
    // חיים
    if (meP) {
      const pct = Math.max(0, meP.h / meP.m) * 100;
      const f = $('hpFill'); f.style.width = pct + '%'; f.classList.toggle('low', pct < 35);
      $('hpText').textContent = `${Math.max(0, meP.h)} / ${meP.m}`;
      const icons = [];
      const F = meP.f;
      if (F & 1) icons.push(['הלם', '#ffd84a']); if (F & 64) icons.push(['נשרף', '#ff8a3a']); if (F & 128) icons.push(['מואט', '#8ad0ff']);
      if (F & 256) icons.push(['מקובע', '#ff8aa0']); if (F & 512) icons.push(['צ׳י חסום', '#ff8ac0']); if (F & 2) icons.push(['מגן', '#9fe0ff']);
      if (F & 32) icons.push(['בלתי נראה', '#c0c0d0']); if (F & 16) icons.push(['מחוזק', '#ffe070']);
      $('statusIcons').innerHTML = icons.map(([t, c]) => `<span class="sti" style="color:${c}">${t}</span>`).join('');
    }
    // יכולות
    for (const s of SLOTS) {
      const el = abilityEls[s]; if (!el) continue;
      let txt = '';
      if (s === 'ult') {
        const ready = me.u >= 100;
        el.root.classList.toggle('ready', ready);
        txt = ready ? '' : me.u + '%';
        el.cd.style.background = ready ? 'transparent' : `linear-gradient(to top, transparent ${me.u}%, rgba(0,0,0,.6) ${me.u}%)`;
      } else {
        const cd = me.cd[s] || 0;
        txt = cd > 0.05 ? (cd >= 1 ? Math.ceil(cd) : cd.toFixed(1)) : '';
        el.cd.style.background = cd > 0.05 ? 'rgba(0,0,0,.6)' : 'transparent';
      }
      el.cd.textContent = txt;
      const c = BY_ID[abilityChar];
      const locked = me.cb && s !== 'wall' && !(s === 'primary' && c.element === 'none');
      el.root.classList.toggle('locked', !!locked);
    }
    if (!$('scoreboard').classList.contains('hidden')) renderScoreboard();
  }

  function renderScoreboard() {
    if (!latest) return;
    const rows = [...latest.P].sort((a, b) => b.k - a.k).map(p =>
      `<tr${p.i === myId ? ' style="color:#f4c95d"' : ''}><td>${esc(p.n)}${p.f & 16384 ? ' 🤖' : ''}</td><td>${BY_ID[p.c].name}</td><td>${p.k}</td><td>${p.al ? '❤' : '☠'}</td></tr>`).join('');
    $('scoreboard').innerHTML = `<table><tr><th>שחקן</th><th>דמות</th><th>חיסולים</th><th></th></tr>${rows}</table>`;
  }

  function showEnd(m) {
    const w = m.win;
    const box = document.createElement('div'); box.className = 'box';
    const iWon = w && w.id === myId;
    box.innerHTML = `<h2>${iWon ? '🏆 ניצחון!' : w ? 'המנצח: ' + esc(w.n) : 'אין מנצח'}</h2>`;
    if (w) { const cv = document.createElement('canvas'); cv.width = 280; cv.height = 280; Art.drawPortrait(cv, w.c); box.appendChild(cv); }
    const rows = (m.B || []).map(r => `<tr${r.n === (latest.P.find(p => p.i === myId) || {}).n ? ' style="color:#f4c95d"' : ''}><td>#${r.pl || '-'}</td><td>${esc(r.n)}${r.b ? ' 🤖' : ''}</td><td>${BY_ID[r.c].name}</td><td>${r.k}</td><td>${r.d}</td></tr>`).join('');
    box.insertAdjacentHTML('beforeend', `<table><tr><th>מקום</th><th>שחקן</th><th>דמות</th><th>חיסולים</th><th>נזק</th></tr>${rows}</table><div class="note" id="endNote"></div>`);
    const es = $('endScreen'); es.innerHTML = ''; es.appendChild(box); es.classList.remove('hidden');
    if (iWon) Sfx.play('ult');
  }
  function updateEndTimer(m) { const n = $('endNote'); if (n) n.textContent = `חוזרים לאזור האימון בעוד ${Math.ceil(m.tm)} שניות`; }

  $('botRange').value = localStorage.getItem('avatar.bots') || 9;
  $('botRange').oninput = () => { $('botVal').textContent = $('botRange').value; localStorage.setItem('avatar.bots', $('botRange').value); };
  let difficulty = localStorage.getItem('avatar.diff') || 'easy';
  const DIFF_NAMES = { easy: 'קל', medium: 'בינוני', hard: 'קשה' };
  function renderDiff() { for (const b of $('diffSeg').children) b.classList.toggle('on', b.dataset.d === difficulty); }
  for (const b of $('diffSeg').children) b.onclick = () => { difficulty = b.dataset.d; localStorage.setItem('avatar.diff', difficulty); renderDiff(); };
  renderDiff();
  $('startBtn').onclick = () => { send({ t: 'start', bots: +$('botRange').value, diff: difficulty }); };
  $('changeCharBtn').onclick = () => { changingChar = true; $('menu').classList.remove('hidden'); showDetails(); };

  // ================================================================ קרקע
  function srand(s) {
    s = Math.floor(Math.abs(Math.sin(s * 12.9898 + 78.233) * 43758.5453) * 2147483646) % 2147483646 + 1;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  function buildGround() {
    const S = MAP.size;
    groundCanvas = document.createElement('canvas'); groundCanvas.width = S; groundCanvas.height = S;
    const g = groundCanvas.getContext('2d');
    const R = srand(12345);
    g.fillStyle = '#5d9443'; g.fillRect(0, 0, S, S);
    // כתמי דשא
    for (let i = 0; i < 900; i++) {
      const x = R() * S, y = R() * S, r = 30 + R() * 140;
      g.fillStyle = R() < 0.5 ? 'rgba(80,140,55,0.25)' : 'rgba(110,165,70,0.22)';
      g.beginPath(); g.ellipse(x, y, r, r * (0.6 + R() * 0.4), R() * 3, 0, TAU); g.fill();
    }
    // שבילים מהמרכז
    g.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3;
      const ex = S / 2 + Math.cos(a) * S * 0.7, ey = S / 2 + Math.sin(a) * S * 0.7;
      const mx = S / 2 + Math.cos(a + 0.4) * S * 0.3, my = S / 2 + Math.sin(a + 0.4) * S * 0.3;
      for (const [w, c] of [[70, '#9c8150'], [56, '#c2a46a'], [30, '#cfb37a']]) {
        g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(S / 2, S / 2); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
      }
    }
    // רחבת המקדש
    const cx = S / 2, cy = S / 2;
    const pg = g.createRadialGradient(cx, cy, 20, cx, cy, 300);
    pg.addColorStop(0, '#d8cdb6'); pg.addColorStop(1, '#a89c84');
    g.fillStyle = pg; g.beginPath(); g.arc(cx, cy, 300, 0, TAU); g.fill();
    g.strokeStyle = '#8c8068'; g.lineWidth = 6; g.stroke();
    g.lineWidth = 2; g.strokeStyle = 'rgba(90,80,60,.4)';
    for (let r = 60; r < 300; r += 48) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); }
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; g.beginPath(); g.moveTo(cx + Math.cos(a) * 60, cy + Math.sin(a) * 60); g.lineTo(cx + Math.cos(a) * 300, cy + Math.sin(a) * 300); g.stroke(); }
    // סמלי ארבעת היסודות
    const els = ['air', 'water', 'earth', 'fire'];
    els.forEach((el, i) => {
      const a = i / 4 * TAU - Math.PI / 4;
      g.globalAlpha = 0.55; Art.drawEmblem(g, el, cx + Math.cos(a) * 140, cy + Math.sin(a) * 140, 0.7, ELEMENTS[el].color); g.globalAlpha = 1;
    });
    g.fillStyle = '#efe6cf'; g.beginPath(); g.arc(cx, cy, 50, 0, TAU); g.fill(); g.strokeStyle = '#8c8068'; g.lineWidth = 4; g.stroke();
    Art.drawEmblem(g, 'air', cx, cy, 0.5, '#c0a050');
    // אגמים
    for (const p of MAP.ponds) {
      g.fillStyle = '#d9c48c'; g.beginPath(); g.arc(p.x, p.y, p.r + 18, 0, TAU); g.fill();
      const wg = g.createRadialGradient(p.x, p.y, p.r * 0.1, p.x, p.y, p.r);
      wg.addColorStop(0, '#1d5f9a'); wg.addColorStop(0.8, '#2f84c4'); wg.addColorStop(1, '#5fb4e0');
      g.fillStyle = wg; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
      for (let i = 0; i < 5; i++) {
        const a = R() * TAU, d = R() * p.r * 0.7, lx = p.x + Math.cos(a) * d, ly = p.y + Math.sin(a) * d, lr = 10 + R() * 8;
        g.fillStyle = '#4e9a48'; g.beginPath(); g.moveTo(lx, ly); g.arc(lx, ly, lr, 0.3, TAU - 0.3); g.closePath(); g.fill();
        if (R() < 0.5) { g.fillStyle = '#ffb0d0'; g.beginPath(); g.arc(lx + 2, ly - 2, 4, 0, TAU); g.fill(); }
      }
    }
    // פרחים ועשב
    for (let i = 0; i < 2500; i++) {
      const x = R() * S, y = R() * S;
      if (R() < 0.12) { g.fillStyle = ['#ffd84a', '#ff8ac0', '#ffffff', '#b08aff'][Math.floor(R() * 4)]; g.beginPath(); g.arc(x, y, 2.5, 0, TAU); g.fill(); }
      else { g.strokeStyle = R() < 0.5 ? 'rgba(40,90,30,.5)' : 'rgba(150,200,100,.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - 7); g.moveTo(x + 2, y); g.lineTo(x + 3, y - 6); g.stroke(); }
    }
    // צללי מכשולים על הקרקע
    for (const o of MAP.obstacles) {
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(o.x + 6, o.y + o.r * 0.5, o.r * (o.t === 'tree' ? 1.9 : 1.1), o.r * (o.t === 'tree' ? 1.1 : 0.6), 0, 0, TAU); g.fill();
    }
    // גבולות העולם
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 30; g.strokeRect(0, 0, S, S);
  }

  function buildMinimapBase() {
    const c = document.createElement('canvas'); c.width = 200; c.height = 200;
    const g = c.getContext('2d'); const k = 200 / MAP.size;
    g.drawImage(groundCanvas, 0, 0, 200, 200);
    for (const o of MAP.obstacles) { g.fillStyle = o.t === 'tree' ? '#2f6a2a' : '#888'; g.beginPath(); g.arc(o.x * k, o.y * k, Math.max(1.2, o.r * k * (o.t === 'tree' ? 1.8 : 1)), 0, TAU); g.fill(); }
    minimapBase = c;
  }

  // ================================================================ ציור אובייקטים
  function drawRock(o) {
    ctx.save(); ctx.translate(o.x, o.y);
    const r = o.r;
    const R = srand(o.x * 7 + o.y);
    ctx.beginPath();
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, rr = r * (0.85 + R() * 0.25); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.9 - r * 0.1); }
    ctx.closePath();
    const g = ctx.createLinearGradient(-r, -r, r, r); g.addColorStop(0, '#b8b4ac'); g.addColorStop(1, '#6a665e');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#4a463e'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.4, r * 0.35, r * 0.18, -0.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(60,55,45,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r * 0.1, -r * 0.2); ctx.lineTo(r * 0.35, r * 0.2); ctx.lineTo(r * 0.2, r * 0.5); ctx.stroke();
    ctx.restore();
  }
  function drawPillar(o) {
    ctx.save(); ctx.translate(o.x, o.y);
    ctx.fillStyle = '#8c8068'; ctx.beginPath(); ctx.ellipse(0, 8, o.r + 4, (o.r + 4) * 0.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d8cdb6'; ctx.fillRect(-o.r * 0.8, -o.r * 2.2, o.r * 1.6, o.r * 2.3);
    ctx.fillStyle = '#b8ab90'; ctx.fillRect(o.r * 0.2, -o.r * 2.2, o.r * 0.6, o.r * 2.3);
    ctx.fillStyle = '#c0402a'; ctx.fillRect(-o.r * 0.8, -o.r * 1.4, o.r * 1.6, 6);
    ctx.fillStyle = '#efe6cf'; ctx.beginPath(); ctx.ellipse(0, -o.r * 2.2, o.r, o.r * 0.55, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#8c8068'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  function drawTree(o, under) {
    ctx.save(); ctx.translate(o.x, o.y);
    ctx.fillStyle = '#6a4424'; ctx.fillRect(-o.r * 0.3, -o.r * 0.6, o.r * 0.6, o.r * 1.1);
    if (under) ctx.globalAlpha = 0.4;
    const R = srand(o.x * 13 + o.y * 3);
    const blossom = R() < 0.12;
    const c1 = blossom ? '#c86a98' : '#2f6a2a', c2 = blossom ? '#e48ab8' : '#3f8a35', c3 = blossom ? '#ffc0dc' : '#5aaa48';
    const cr = o.r * 2.1;
    for (const [dx, dy, rr, c] of [[0, -cr * 0.7, cr, c1], [-cr * 0.35, -cr * 0.85, cr * 0.65, c2], [cr * 0.3, -cr * 0.95, cr * 0.6, c2], [-cr * 0.1, -cr * 1.15, cr * 0.45, c3]]) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(dx, dy, rr, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(20,50,20,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -cr * 0.7, cr, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  function drawWall(w, t) {
    const [id, x, y, hp, el] = w;
    ctx.save(); ctx.translate(x, y);
    const r = 22;
    if (el === 'water') {
      ctx.fillStyle = 'rgba(170,225,255,.75)'; ctx.beginPath(); ctx.moveTo(0, -r * 2); ctx.lineTo(r, -r * 0.6); ctx.lineTo(r * 0.8, r * 0.6); ctx.lineTo(-r * 0.8, r * 0.6); ctx.lineTo(-r, -r * 0.6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(-r * 0.4, -r * 1.2, 4, r * 1.2);
    } else if (el === 'fire') {
      ctx.fillStyle = '#3a2a2a'; ctx.beginPath(); ctx.roundRect(-r, -r * 1.6, r * 2, r * 2.2, 6); ctx.fill();
      ctx.strokeStyle = `rgba(255,${120 + Math.sin(t * 6) * 40},40,.9)`; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,120,40,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * 0.5, -r); ctx.lineTo(0, -r * 0.3); ctx.lineTo(r * 0.4, -r * 0.9); ctx.stroke();
    } else if (el === 'air') {
      ctx.fillStyle = '#f0e6c8'; ctx.beginPath(); ctx.roundRect(-r, -r * 1.6, r * 2, r * 2.2, 10); ctx.fill();
      ctx.strokeStyle = '#c8b88a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#e8a030'; ctx.beginPath(); ctx.arc(0, -r * 0.5, r * 0.45, 0, 4.5); ctx.stroke();
    } else if (el === 'earth') {
      ctx.fillStyle = '#8a6a42'; ctx.beginPath(); ctx.moveTo(-r, r * 0.6); ctx.lineTo(-r * 0.9, -r * 1.5); ctx.lineTo(r * 0.9, -r * 1.7); ctx.lineTo(r, r * 0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a8865a'; ctx.beginPath(); ctx.moveTo(-r * 0.9, -r * 1.5); ctx.lineTo(r * 0.9, -r * 1.7); ctx.lineTo(r * 0.7, -r * 1.2); ctx.lineTo(-r * 0.7, -r * 1.05); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#4a3a22'; ctx.lineWidth = 2.5; ctx.strokeRect(-r, -r * 1.6, r * 2, r * 2.2);
    } else {
      ctx.fillStyle = '#9a6a3a';
      for (let i = -1; i <= 1; i++) { ctx.fillRect(i * 13 - 5, -r * 1.6, 10, r * 2.2); ctx.beginPath(); ctx.moveTo(i * 13 - 5, -r * 1.6); ctx.lineTo(i * 13, -r * 2.1); ctx.lineTo(i * 13 + 5, -r * 1.6); ctx.fill(); }
      ctx.fillStyle = '#6a4424'; ctx.fillRect(-r, -r * 0.8, r * 2, 5);
    }
    if (hp < 60) { ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, -r); ctx.lineTo(0, -r * 0.3); ctx.lineTo(-4, r * 0.3); ctx.moveTo(6, -r * 1.2); ctx.lineTo(10, -r * 0.4); ctx.stroke(); }
    ctx.restore();
  }

  function drawPickup(k, t) {
    const [id, type, x, y] = k;
    const bob = Math.sin(t * 3 + id) * 4;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 12, 14, 5, 0, 0, TAU); ctx.fill();
    ctx.translate(0, bob - 6);
    const col = { hp: '#6dffb0', ult: '#ffd84a', shield: '#7fd8ff' }[type];
    const gl = ctx.createRadialGradient(0, 0, 2, 0, 0, 28); gl.addColorStop(0, col + 'aa'); gl.addColorStop(1, col + '00');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.fill();
    if (type === 'hp') {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(10, -6); ctx.lineTo(7, 8); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2a6a3a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#3ab060'; ctx.fillRect(-2, -3, 4, 9); ctx.fillRect(-5, 0, 10, 3);
    } else if (type === 'ult') {
      ctx.rotate(t * 2);
      ctx.fillStyle = col; ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 5 : 12, a = i * TAU / 8; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#a07010'; ctx.lineWidth = 1.5; ctx.stroke();
    } else {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(9, -4); ctx.lineTo(0, 12); ctx.lineTo(-9, -4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.restore();
  }

  function drawProjectile(j, dtSince, t) {
    const [id, x0, y0, vx, vy, r, style] = j;
    const x = x0 + vx * dtSince, y = y0 + vy * dtSince;
    const ang = Math.atan2(vy, vx);
    const col = Art.styleColor(style, 'none');
    ctx.save(); ctx.translate(x, y);
    switch (style) {
      case 'air': {
        ctx.rotate(t * 14);
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, r * (0.5 + i * 0.3), i * 2, i * 2 + 3.5); ctx.stroke(); }
        if (Math.random() < 0.6) particles.push({ x, y, vx: -vx * 0.1 + (Math.random() - 0.5) * 40, vy: -vy * 0.1 + (Math.random() - 0.5) * 40, life: 0, max: 0.35, size: 5, color: 'rgba(255,255,255,.6)', grow: 20 });
        break;
      }
      case 'water': {
        const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, r * 1.2); g.addColorStop(0, '#d8f2ff'); g.addColorStop(0.5, '#3fa7f5'); g.addColorStop(1, '#1a5f9a');
        ctx.rotate(ang); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.5, r, 0, 0, TAU); ctx.fill();
        if (Math.random() < 0.8) particles.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, life: 0, max: 0.4, size: 3, color: '#7fc8ff', glow: false });
        break;
      }
      case 'ice': case 'pin': case 'knife': {
        ctx.rotate(ang);
        if (style === 'ice') {
          ctx.fillStyle = '#d8f4ff'; ctx.beginPath(); ctx.moveTo(r * 2, 0); ctx.lineTo(-r, -r * 0.6); ctx.lineTo(-r * 1.4, 0); ctx.lineTo(-r, r * 0.6); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#6ac0f0'; ctx.lineWidth = 1.5; ctx.stroke();
        } else {
          ctx.fillStyle = '#e8ecf4'; ctx.beginPath(); ctx.moveTo(r * 2.2, 0); ctx.lineTo(-r * 0.4, -r * 0.45); ctx.lineTo(-r * 0.4, r * 0.45); ctx.closePath(); ctx.fill();
          ctx.fillStyle = style === 'pin' ? '#c02040' : '#333'; ctx.fillRect(-r * 1.4, -r * 0.25, r, r * 0.5);
          ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * 2, 0); ctx.lineTo(-r * 6, 0); ctx.stroke();
        }
        break;
      }
      case 'fire': case 'bluefire': {
        const blue = style === 'bluefire';
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 1.8);
        g.addColorStop(0, '#fff8d0'); g.addColorStop(0.35, blue ? '#7ac8ff' : '#ffb030'); g.addColorStop(1, blue ? 'rgba(30,100,255,0)' : 'rgba(255,60,0,0)');
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, TAU); ctx.fill();
        for (let i = 0; i < 2; i++) particles.push({ x: x + (Math.random() - 0.5) * r, y: y + (Math.random() - 0.5) * r, vx: -vx * 0.15 + (Math.random() - 0.5) * 50, vy: -vy * 0.15 + (Math.random() - 0.5) * 50, life: 0, max: 0.3 + Math.random() * 0.2, size: r * 0.9, color: blue ? '#3aa0ff' : (Math.random() < 0.5 ? '#ff6a1a' : '#ffc040'), glow: true, flame: true, grow: -10 });
        break;
      }
      case 'rock': case 'quake': {
        if (style === 'quake') {
          ctx.rotate(ang);
          ctx.fillStyle = '#7a5a32'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.6, r * 1.2, 0, 0, TAU); ctx.fill();
          for (let i = -2; i <= 2; i++) { ctx.fillStyle = i % 2 ? '#9a7a4a' : '#6a4a28'; ctx.beginPath(); ctx.moveTo(-6, i * r * 0.4 - 8); ctx.lineTo(8, i * r * 0.4); ctx.lineTo(-6, i * r * 0.4 + 8); ctx.fill(); }
          if (Math.random() < 0.9) particles.push({ x, y: y + (Math.random() - 0.5) * r, vx: (Math.random() - 0.5) * 60, vy: -80 - Math.random() * 80, g: 500, life: 0, max: 0.5, size: 4 + Math.random() * 4, color: '#8a6a3a', rock: true });
        } else {
          ctx.rotate(t * 6);
          ctx.fillStyle = '#9a7a52'; ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; ctx.lineTo(Math.cos(a) * r * (0.85 + (i % 2) * 0.2), Math.sin(a) * r * (0.85 + (i % 2) * 0.2)); } ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#5a4428'; ctx.lineWidth = 2.5; ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.3, 0, TAU); ctx.fill();
          if (Math.random() < 0.3) particles.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.4, size: 6, color: 'rgba(160,130,90,.5)', grow: 25 });
        }
        break;
      }
      case 'boomerang': {
        ctx.rotate(t * 20);
        ctx.strokeStyle = '#d8b080'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-r, -r * 0.6); ctx.quadraticCurveTo(0, r * 0.4, r, -r * 0.6); ctx.stroke();
        ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2; ctx.stroke();
        break;
      }
      case 'fan': {
        ctx.rotate(t * 16);
        ctx.fillStyle = '#e2b84a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r * 1.4, 0, Math.PI * 0.9); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#8a6010'; ctx.lineWidth = 1.5; ctx.stroke();
        break;
      }
      default:
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- שחקנים
  const SPR_UNIT = 0.82; // יחידת ציור -> יחידות עולם
  const walkPhase = new Map(), lastPos = new Map();
  function drawPlayer(p, t, dt, viewerSeismic) {
    const isMe = p.i === myId;
    const F = p.f;
    const stealth = F & 32;
    if (stealth && !isMe && !viewerSeismic) return;
    const prev = lastPos.get(p.i) || { x: p.x, y: p.y };
    const sp = Math.hypot(p.x - prev.x, p.y - prev.y) / Math.max(dt, 0.001);
    lastPos.set(p.i, { x: p.x, y: p.y });
    let ph = walkPhase.get(p.i) || 0;
    const moving = sp > 30;
    if (moving) ph += dt * Math.min(14, sp / 22);
    walkPhase.set(p.i, ph);
    const frame = moving ? 1 + (Math.floor(ph) % 4) : 0;
    const facing = Math.cos(p.a) >= 0 ? 1 : -1;
    const fly = F & 1024;
    const lift = fly ? 18 + Math.sin(t * 4) * 4 : 0;
    const elc = ELEMENTS[BY_ID[p.c].element];

    ctx.save(); ctx.translate(p.x, p.y);
    if (!p.al) ctx.globalAlpha = 0.4;
    if (stealth) ctx.globalAlpha = 0.35;
    if (F & 8 && Math.floor(t * 12) % 2) ctx.globalAlpha *= 0.55;
    // צל
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, 26, 20 - lift * 0.3, 7 - lift * 0.1, 0, 0, TAU); ctx.fill();
    // טבעת שלי
    if (isMe) { ctx.strokeStyle = 'rgba(244,201,93,.85)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, 26, 26, 9, 0, 0, TAU); ctx.stroke(); }
    // חץ כיוון
    ctx.save(); ctx.translate(0, 26); ctx.scale(1, 0.4); ctx.rotate(p.a);
    ctx.fillStyle = isMe ? 'rgba(244,201,93,.9)' : 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.moveTo(38, 0); ctx.lineTo(28, -8); ctx.lineTo(28, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
    // הילת חיזוק
    if (F & 16 && !stealth) {
      const col = Art.styleColor(p.bs, 'none');
      const g = ctx.createRadialGradient(0, -10, 5, 0, -10, 60);
      g.addColorStop(0, col + '00'); g.addColorStop(0.6, col + '55'); g.addColorStop(1, col + '00');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -10 - lift, 60 + Math.sin(t * 8) * 4, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      if (Math.random() < 0.5) particles.push({ x: p.x + (Math.random() - 0.5) * 40, y: p.y + 10 - lift, vx: 0, vy: -80, life: 0, max: 0.6, size: 4, color: col, glow: true, flame: p.bs === 'comet' });
    }
    // טעינת ברק
    const ch = charges.get(p.i);
    if (F & 4096 && ch) {
      ctx.strokeStyle = 'rgba(180,220,255,.9)'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { const a = Math.random() * TAU, r1 = 40 * (1 - ch.t / ch.d) + 10; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r1, -10 + Math.sin(a) * r1); ctx.lineTo(Math.cos(a + 0.3) * r1 * 0.5, -10 + Math.sin(a + 0.3) * r1 * 0.5); ctx.stroke(); }
      ctx.save(); ctx.rotate(p.a); ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(180,220,255,.4)'; ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(700, 0); ctx.stroke(); ctx.restore();
    }
    // הדמות
    const spr = Art.getSprite(p.c, facing, frame);
    const k = SPR_UNIT / Art.SPR_S;
    const dw = Art.SPR_W * k, dh = Art.SPR_H * k;
    ctx.drawImage(spr, -dw / 2, -6 - lift - Art.SPR_H * 0.6 * k, dw, dh);
    // שריון סלע
    if (F & 8192) {
      ctx.strokeStyle = 'rgba(140,110,70,.9)'; ctx.lineWidth = 5; ctx.setLineDash([12, 6]);
      ctx.beginPath(); ctx.ellipse(0, -8 - lift, 30, 42, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    } else if (F & 2) {
      // מגן
      const refl = F & 4;
      const col = refl ? '255,255,255' : (p.ss === 'fire' ? '255,120,40' : p.ss === 'ice' ? '170,230,255' : '150,210,255');
      ctx.fillStyle = `rgba(${col},.18)`; ctx.strokeStyle = `rgba(${col},.85)`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, -10 - lift, 42 + Math.sin(t * 10) * 2, 0, TAU); ctx.fill(); ctx.stroke();
      if (refl) { ctx.save(); ctx.translate(0, -10 - lift); ctx.rotate(t * 8); ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 34, i * 2.1, i * 2.1 + 1); ctx.stroke(); } ctx.restore(); }
    }
    // סטטוסים
    const topY = -60 - lift;
    if (F & 1) { for (let i = 0; i < 3; i++) { const a = t * 5 + i * TAU / 3; drawStar(Math.cos(a) * 18, topY + 10 + Math.sin(a) * 5, 5, '#ffd84a'); } }
    if (F & 512) { ctx.strokeStyle = '#ff6ab0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, topY + 2); ctx.lineTo(8, topY + 16); ctx.moveTo(8, topY + 2); ctx.lineTo(-8, topY + 16); ctx.stroke(); }
    if (F & 256) { ctx.strokeStyle = '#c0c8d8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 22, 24, 8, 0, 0, TAU); ctx.stroke(); }
    if (F & 128) { ctx.fillStyle = 'rgba(120,200,255,.25)'; ctx.beginPath(); ctx.ellipse(0, 22, 24, 9, 0, 0, TAU); ctx.fill(); }
    if (F & 64 && Math.random() < 0.5) particles.push({ x: p.x + (Math.random() - 0.5) * 30, y: p.y - Math.random() * 40, vx: 0, vy: -60, life: 0, max: 0.4, size: 5, color: '#ff7a2a', glow: true, flame: true });
    // שם וחיים
    if (p.al) {
      ctx.globalAlpha = stealth ? 0.4 : 1;
      const bw = 56, by = topY - 10;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(-bw / 2 - 1, by - 1, bw + 2, 8);
      const pct = Math.max(0, p.h / p.m);
      ctx.fillStyle = isMe ? '#6dff9a' : pct > 0.35 ? '#ff6a5a' : '#ff3030';
      ctx.fillRect(-bw / 2, by, bw * pct, 6);
      ctx.font = '700 13px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.direction = 'rtl';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)';
      const label = p.n;
      ctx.strokeText(label, 0, by - 5); ctx.fillStyle = isMe ? '#ffe08a' : '#fff'; ctx.fillText(label, 0, by - 5);
      ctx.fillStyle = elc.color; ctx.beginPath(); ctx.arc(-bw / 2 - 8, by + 3, 4, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // שובל זינוק
    const tr = dashTrails.get(p.i);
    if (tr && tr.t > 0) {
      tr.t -= dt;
      const col = Art.styleColor(tr.s, 'none');
      for (let i = 0; i < 3; i++) particles.push({ x: p.x + (Math.random() - 0.5) * 20, y: p.y + (Math.random() - 0.5) * 30, vx: 0, vy: 0, life: 0, max: 0.4, size: 8 + Math.random() * 6, color: col, glow: true, grow: -15, flame: /fire|blue/.test(tr.s) });
    }
  }

  function drawStar(x, y, r, c) {
    ctx.fillStyle = c; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, a = i * TAU / 10 - Math.PI / 2; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }

  // ---------------------------------------------------------------- אפקטים
  function drawEffects(dt, t) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.t += dt;
      if (e.t >= e.dur) { effects.splice(i, 1); continue; }
      const k = e.t / e.dur;
      ctx.save();
      switch (e.type) {
        case 'ring': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = e.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 10 * (1 - k) + 2;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.3 + k * 0.8), 0, TAU); ctx.stroke();
          ctx.globalAlpha = (1 - k) * 0.25; ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.3 + k * 0.8), 0, TAU); ctx.fill();
          break;
        }
        case 'warn': {
          let x = e.x, y = e.y;
          if (e.follow) { const p = latest && latest.P.find(q => q.i === e.follow); if (p) { x = p.x; y = p.y; } }
          const col = Art.styleColor(e.s, 'none');
          ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.lineDashOffset = -t * 40;
          ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(x, y, e.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
          ctx.globalAlpha = 0.25; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, e.r * k, 0, TAU); ctx.fill();
          if (e.s === 'mountain') {
            // סלע ענק נופל
            const h = (1 - k) * 600;
            ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y, e.r * 0.5 * k + 20, e.r * 0.25 * k + 10, 0, 0, TAU); ctx.fill();
            ctx.translate(x, y - h); ctx.rotate(t * 2);
            ctx.fillStyle = '#8a6a42'; ctx.beginPath(); for (let j = 0; j < 8; j++) { const a = j / 8 * TAU, rr = e.r * 0.45 * (0.85 + (j % 2) * 0.2); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#4a3a22'; ctx.lineWidth = 6; ctx.stroke();
          }
          break;
        }
        case 'beam': {
          const dx = e.x2 - e.x1, dy = e.y2 - e.y1, len = Math.hypot(dx, dy);
          const nx = -dy / (len || 1), ny = dx / (len || 1);
          ctx.globalCompositeOperation = 'lighter';
          for (const [w, c, a] of [[e.w * 1.6, '#3a7aff', 0.35], [e.w * 0.6, '#b4dcff', 0.9], [e.w * 0.2, '#ffffff', 1]]) {
            ctx.strokeStyle = c; ctx.lineWidth = w * (1 - k * 0.7); ctx.globalAlpha = a * (1 - k);
            ctx.beginPath(); ctx.moveTo(e.x1, e.y1);
            const segs = Math.max(4, Math.floor(len / 40));
            for (let s = 1; s < segs; s++) { const f = s / segs, j = (Math.random() - 0.5) * 30; ctx.lineTo(e.x1 + dx * f + nx * j, e.y1 + dy * f + ny * j); }
            ctx.lineTo(e.x2, e.y2); ctx.stroke();
          }
          break;
        }
        case 'slash': {
          ctx.globalCompositeOperation = 'lighter';
          let x = e.x, y = e.y; const p = latest && latest.P.find(q => q.i === e.p); if (p) { x = p.x; y = p.y; }
          ctx.translate(x, y - 6);
          const sweep = e.arc * (0.3 + k * 0.7);
          ctx.strokeStyle = e.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 14 * (1 - k) + 3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(0, 0, e.r * 0.85, e.a - e.arc / 2, e.a - e.arc / 2 + sweep); ctx.stroke();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.85, e.a - e.arc / 2 + sweep * 0.5, e.a - e.arc / 2 + sweep); ctx.stroke();
          break;
        }
        case 'cone': {
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(e.x, e.y, 10, e.x, e.y, e.r);
          g.addColorStop(0, 'rgba(255,240,180,.7)'); g.addColorStop(0.5, 'rgba(255,120,30,.4)'); g.addColorStop(1, 'rgba(255,40,0,0)');
          ctx.globalAlpha = 1 - k; ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, e.r * (0.5 + k * 0.6), e.a - e.arc / 2, e.a + e.arc / 2); ctx.closePath(); ctx.fill();
          break;
        }
        case 'tornado': {
          ctx.translate(e.x, e.y);
          ctx.globalAlpha = 1 - k * k;
          for (let j = 0; j < 6; j++) {
            ctx.strokeStyle = j % 2 ? 'rgba(255,255,255,.8)' : 'rgba(246,231,181,.7)'; ctx.lineWidth = 4;
            const rr = e.r * (0.25 + j * 0.13);
            ctx.beginPath(); ctx.ellipse(0, -j * 14, rr, rr * 0.4, 0, t * 12 + j, t * 12 + j + 4); ctx.stroke();
          }
          break;
        }
        case 'cracks': {
          const R = srand(Math.floor(e.seed));
          ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = '#3a2a16'; ctx.lineWidth = 4;
          for (let j = 0; j < 9; j++) {
            const a = R() * TAU; let x = e.x, y = e.y; ctx.beginPath(); ctx.moveTo(x, y);
            for (let s = 0; s < 4; s++) { const aa = a + (R() - 0.5) * 0.8; const l = e.r / 4; x += Math.cos(aa) * l; y += Math.sin(aa) * l; ctx.lineTo(x, y); }
            ctx.stroke();
          }
          break;
        }
        case 'pillar': {
          const h = Math.sin(Math.min(1, k * 3) * Math.PI / 2) * e.r * 1.6 * (k > 0.7 ? (1 - k) / 0.3 : 1);
          ctx.translate(e.x, e.y);
          ctx.fillStyle = '#6a4a28'; ctx.beginPath(); ctx.ellipse(0, 0, e.r, e.r * 0.5, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#8a6a42'; ctx.fillRect(-e.r * 0.8, -h, e.r * 1.6, h);
          ctx.fillStyle = '#a8865a'; ctx.beginPath(); ctx.ellipse(0, -h, e.r * 0.8, e.r * 0.4, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#4a3a22'; ctx.lineWidth = 3; ctx.stroke();
          break;
        }
      }
      ctx.restore();
    }
  }

  function drawParticles(dt) {
    if (particles.length > 2200) particles.splice(0, particles.length - 2200);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.max) { particles.splice(i, 1); continue; }
      if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; }
      if (p.g) p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grow) p.size = Math.max(0.5, p.size + p.grow * dt);
      const k = 1 - p.life / p.max;
      ctx.globalAlpha = k;
      ctx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
      ctx.fillStyle = p.color;
      if (p.plus) { ctx.fillRect(p.x - p.size, p.y - 1.5, p.size * 2, 3); ctx.fillRect(p.x - 1.5, p.y - p.size, 3, p.size * 2); }
      else if (p.rock) { ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.flame ? k : 1), 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function drawFloaters(dt) {
    ctx.textAlign = 'center'; ctx.direction = 'rtl';
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.t += dt;
      if (f.t > 1) { floaters.splice(i, 1); continue; }
      const y = f.y - f.t * 50;
      const s = f.big ? 26 : f.text ? 16 : 19;
      ctx.globalAlpha = 1 - f.t * f.t;
      ctx.font = `900 ${s * (f.t < 0.1 ? 1 + (0.1 - f.t) * 4 : 1)}px Rubik, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.8)';
      const txt = f.text || String(f.v);
      ctx.strokeText(txt, f.x, y); ctx.fillStyle = f.color; ctx.fillText(txt, f.x, y);
    }
    ctx.globalAlpha = 1;
  }

  function drawStorm(S, viewL, viewT, viewR, viewB) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(viewL - 100, viewT - 100, viewR - viewL + 200, viewB - viewT + 200);
    ctx.arc(S.x, S.y, Math.max(1, S.r), 0, TAU, true);
    ctx.fillStyle = 'rgba(110,40,190,0.33)'; ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(200,120,255,.9)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(S.x, S.y, Math.max(1, S.r), 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 24; ctx.stroke();
    if (S.st !== 'final' && S.tr > 0) {
      ctx.setLineDash([20, 14]); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(S.tx, S.ty, S.tr, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawPonds(t, L, T, R, B) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
    for (const p of MAP.ponds) {
      if (p.x + p.r < L || p.x - p.r > R || p.y + p.r < T || p.y - p.r > B) continue;
      for (let i = 0; i < 4; i++) {
        const rr = p.r * (0.3 + ((t * 0.15 + i * 0.25) % 1) * 0.65);
        ctx.globalAlpha = 0.35 * (1 - rr / p.r);
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawMinimap(S, viewerSeismic, myP) {
    const mm = $('minimap'), g = mm.getContext('2d');
    const k = 200 / MAP.size;
    g.clearRect(0, 0, 200, 200);
    if (minimapBase) g.drawImage(minimapBase, 0, 0);
    if (S) {
      g.save(); g.beginPath(); g.rect(0, 0, 200, 200); g.arc(S.x * k, S.y * k, S.r * k, 0, TAU, true); g.fillStyle = 'rgba(110,40,190,.45)'; g.fill('evenodd');
      g.strokeStyle = '#e0a0ff'; g.lineWidth = 1.5; g.beginPath(); g.arc(S.x * k, S.y * k, S.r * k, 0, TAU); g.stroke();
      g.setLineDash([3, 3]); g.strokeStyle = '#fff'; g.beginPath(); g.arc(S.tx * k, S.ty * k, S.tr * k, 0, TAU); g.stroke(); g.restore();
    }
    for (const p of latest.P) {
      if (!p.al) continue;
      const isMe = p.i === myId;
      if (!isMe) {
        if (p.f & 32 && !viewerSeismic) continue;
        if (latest.ph === 'match' && !viewerSeismic && myP && Math.hypot(p.x - myP.x, p.y - myP.y) > 1000) continue;
      }
      g.fillStyle = isMe ? '#ffe08a' : ELEMENTS[BY_ID[p.c].element].color;
      g.beginPath(); g.arc(p.x * k, p.y * k, isMe ? 4.5 : 3, 0, TAU); g.fill();
      if (isMe) { g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke(); }
    }
  }

  // ================================================================ לולאת ציור
  let lastT = performance.now(), gameT = 0;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.width = Math.floor(innerWidth * DPR); H = canvas.height = Math.floor(innerHeight * DPR);
  }
  window.addEventListener('resize', resize); resize();

  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; gameT += dt;
    if (!joined || !latest || !groundCanvas) { if (!joined) drawMenuBackdrop(dt); return; }
    for (const [id, c] of charges) { c.t += dt; if (c.t > c.d + 0.1) charges.delete(id); }

    const renderT = now - 100;
    const players = [];
    for (const p of latest.P) { const ip = interpPlayer(p.i, p.i === myId ? now - 40 : renderT); if (ip) players.push(ip); }
    const myP = players.find(p => p.i === myId);
    const myChar = myP ? myP.c : selected;
    const viewerSeismic = !!BY_ID[myChar].seismic;

    // מצלמה
    let focus = myP && myP.al ? myP : null;
    if (!focus) {
      let target = players.find(p => p.i === spectateId && p.al);
      if (!target) { target = players.find(p => p.al && p.i !== myId); if (target) spectateId = target.i; }
      focus = target || myP;
    }
    if (focus) { cam.x += (focus.x - cam.x) * Math.min(1, dt * 10); cam.y += (focus.y - cam.y) * Math.min(1, dt * 10); }
    const targetZoom = Math.max(W / 1350, H / 820);
    cam.zoom = targetZoom;
    shake *= Math.exp(-dt * 8);
    const sx = (Math.random() - 0.5) * shake * DPR, sy = (Math.random() - 0.5) * shake * DPR;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2a3a1e'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(cam.zoom, 0, 0, cam.zoom, W / 2 - cam.x * cam.zoom + sx, H / 2 - cam.y * cam.zoom + sy);
    const vw = W / cam.zoom, vh = H / cam.zoom;
    const L = cam.x - vw / 2, T = cam.y - vh / 2, R = L + vw, B = T + vh;

    // קרקע
    const sxg = Math.max(0, L), syg = Math.max(0, T), ex = Math.min(MAP.size, R), ey = Math.min(MAP.size, B);
    if (ex > sxg && ey > syg) ctx.drawImage(groundCanvas, sxg, syg, ex - sxg, ey - syg, sxg, syg, ex - sxg, ey - syg);
    drawPonds(gameT, L, T, R, B);

    // פריטים וחומות
    for (const k of latest.K) if (k[2] > L - 40 && k[2] < R + 40 && k[3] > T - 40 && k[3] < B + 40) drawPickup(k, gameT);

    // מיון לפי עומק
    const drawables = [];
    for (const o of MAP.obstacles) if (o.x > L - 120 && o.x < R + 120 && o.y > T - 60 && o.y < B + 200) drawables.push({ y: o.y + (o.t === 'tree' ? 0 : o.r * 0.3), o });
    for (const w of latest.W) if (w[1] > L - 60 && w[1] < R + 60 && w[2] > T - 60 && w[2] < B + 60) drawables.push({ y: w[2], w });
    for (const p of players) if (p.x > L - 80 && p.x < R + 80 && p.y > T - 120 && p.y < B + 80) drawables.push({ y: p.y + 20, p });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) {
      if (d.p) drawPlayer(d.p, gameT, dt, viewerSeismic);
      else if (d.w) drawWall(d.w, gameT);
      else if (d.o.t === 'rock') drawRock(d.o);
      else if (d.o.t === 'pillar') drawPillar(d.o);
      else {
        const under = myP && Math.hypot(myP.x - d.o.x, myP.y - 20 - (d.o.y - d.o.r * 1.5)) < d.o.r * 2.1 + 28;
        drawTree(d.o, under);
      }
    }

    // קליעים
    const snapAge = (now - snaps[snaps.length - 1].t) / 1000;
    for (const j of latest.J) if (j[1] > L - 50 && j[1] < R + 50 && j[2] > T - 50 && j[2] < B + 50) drawProjectile(j, Math.min(snapAge, 0.1), gameT);

    drawEffects(dt, gameT);
    drawParticles(dt);
    if (latest.S) drawStorm(latest.S, L, T, R, B);
    drawFloaters(dt);

    // מסך
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (flash > 0) { flash -= dt * 1.5; ctx.globalAlpha = Math.max(0, flash) * 0.5; ctx.fillStyle = flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (myP && myP.al && latest.S && Math.hypot(myP.x - latest.S.x, myP.y - latest.S.y) > latest.S.r) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
      g.addColorStop(0, 'rgba(120,40,200,0)'); g.addColorStop(1, `rgba(120,40,200,${0.35 + Math.sin(gameT * 6) * 0.1})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (myP && myP.al && myP.h / myP.m < 0.3) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
      g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,0,0,${0.25 + Math.sin(gameT * 5) * 0.1})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // צופה
    if (me && !me.al && latest.ph !== 'lobby' && focus && focus.i !== myId) {
      ctx.font = `700 ${16 * DPR}px Rubik, sans-serif`; ctx.textAlign = 'center'; ctx.direction = 'rtl'; ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillText((me.sp ? 'צופה (תצטרף לקרב הבא) · ' : `נפלת · מקום #${me.pl || '?'} · `) + 'צופה ב-' + focus.n, W / 2, H - 150 * DPR);
    } else if (me && !me.al && latest.ph === 'lobby') {
      ctx.font = `800 ${22 * DPR}px Rubik, sans-serif`; ctx.textAlign = 'center'; ctx.direction = 'rtl'; ctx.fillStyle = '#fff';
      ctx.fillText('חוזר לחיים בעוד ' + Math.max(0, Math.ceil(3 - me.dt)) + '...', W / 2, H / 2);
    }
    drawMinimap(latest.S, viewerSeismic, myP);
    updateHud(dt);
  }

  // רקע מונפש לתפריט – כמה דמויות מסתובבות
  function drawMenuBackdrop() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
  }

  let customPortraits = [];
  buildMenu();
  fetch('/portraits.json').then(r => r.json()).then(list => { customPortraits = list; if (list.length) buildMenu(); }).catch(() => {});
  animatePortrait();
  requestAnimationFrame(frame);
})();
