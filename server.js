// שרת המשחק – זירת האווטאר
// מגיש את הקבצים ומחבר שחקנים ב-WebSocket. כל לוגיקת המשחק נמצאת ב-public/shared/engine.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const Engine = require('./public/shared/engine.js');

const PORT = process.env.PORT || 3000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.json': 'application/json' };
const PUBLIC = path.join(__dirname, 'public');

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  if (url === '/server.json') {
    // סימן ללקוח שיש כאן שרת משחק (בניגוד לאירוח סטטי כמו Netlify)
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ server: true }));
  }
  if (url === '/portraits.json') {
    let files = [];
    try { files = fs.readdirSync(path.join(PUBLIC, 'portraits')).filter(f => /\.(png|jpe?g|webp)$/i.test(f)); } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(files));
  }
  const file = path.normalize(path.join(PUBLIC, url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  let player = null;
  const send = (s) => { if (ws.readyState === 1) ws.send(s); };
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.t === 'join' && !player) player = Engine.join(msg, send);
    else Engine.message(player, msg);
  });
  ws.on('close', () => Engine.leave(player));
});

Engine.start();

server.listen(PORT, () => {
  const ips = [];
  for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
  console.log('\n  ⚔  זירת האווטאר רצה!');
  console.log(`  במחשב הזה:   http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  ברשת המקומית: http://${ip}:${PORT}`));
  console.log('');
});
