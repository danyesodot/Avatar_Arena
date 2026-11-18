// מריץ את מנוע המשחק ב-Worker אצל מי שפתח את החדר,
// כך שהמשחק לא נעצר גם כשהלשונית שלו ברקע
importScripts('characters.js', 'engine.js');
const players = new Map();
AvatarEngine.start();
onmessage = (e) => {
  const { k, id, msg, opts } = e.data;
  if (k === 'join') {
    if (players.has(id)) return;
    players.set(id, AvatarEngine.join(msg, (s) => postMessage({ id, s }), opts));
  } else if (k === 'msg') {
    AvatarEngine.message(players.get(id), msg);
  } else if (k === 'leave') {
    AvatarEngine.leave(players.get(id));
    players.delete(id);
  }
};
