// הגדרות הדמויות – משותף לשרת ולדפדפן
// כל יכולת מוגדרת לפי "סוג" (kind) והשרת יודע להריץ כל סוג באופן כללי.
(function (root) {
  const ELEMENTS = {
    air:   { name: 'אוויר', color: '#f4c95d', glow: '#fff3c4' },
    water: { name: 'מים',   color: '#3fa7f5', glow: '#bfe6ff' },
    earth: { name: 'אדמה',  color: '#5fa04e', glow: '#d2f0b4' },
    fire:  { name: 'אש',    color: '#ff5a2c', glow: '#ffd2a1' },
    none:  { name: 'לוחם',  color: '#b9b9c9', glow: '#f1f1ff' },
  };

  // fx: slow:[מכפיל,משך]  burn:[נזק לשנייה,משך]  stun  root  chiblock  knock  pull
  const CHARACTERS = [
    {
      id: 'aang', name: 'אנג', title: 'האווטאר האחרון', element: 'air', faction: 'צוות אווטאר',
      hp: 100, speed: 270,
      desc: 'זריז ובלתי צפוי. הודף אויבים, מתחמק ובמצב האווטאר הופך לסופה מהלכת.',
      abilities: {
        primary: { name: 'פרץ אוויר', kind: 'projectile', cd: 0.38, speed: 950, dmg: 8, r: 14, range: 620, style: 'air', fx: { knock: 420 } },
        q: { name: 'כדור אוויר', kind: 'dash', cd: 4.5, dist: 360, dur: 0.22, invuln: 0.25, style: 'air' },
        e: { name: 'טורנדו', kind: 'aoe', cd: 8, at: 'target', range: 520, radius: 130, dmg: 15, delay: 0.3, style: 'tornado', fx: { stun: 0.8, pull: 260 } },
        def: { name: 'מגן רוח', kind: 'shield', cd: 6.5, dur: 0.8, reflect: true, style: 'air' },
        ult: { name: 'מצב האווטאר', kind: 'buff', dur: 7, dmgMult: 1.6, speedMult: 1.35, fly: true, reduce: 0.3, style: 'avatar',
               burst: { radius: 260, dmg: 25, fx: { knock: 750 } } },
      },
    },
    {
      id: 'katara', name: 'קטרה', title: 'מאסטרית המים', element: 'water', faction: 'צוות אווטאר',
      hp: 105, speed: 235,
      desc: 'שליטה ומרפא. מקפיאה, מאטה ומרפאה את עצמה – ובכשפות דם משתקת את כולם.',
      abilities: {
        primary: { name: 'שוט מים', kind: 'projectile', cd: 0.45, speed: 820, dmg: 11, r: 13, range: 480, style: 'water', fx: { knock: 120 } },
        q: { name: 'קוצי קרח', kind: 'projectile', cd: 4, count: 3, spread: 0.35, speed: 1000, dmg: 9, r: 10, range: 620, style: 'ice', fx: { slow: [0.55, 1.6] } },
        e: { name: 'מים מרפאים', kind: 'heal', cd: 10, amount: 28, waterBonus: 2, style: 'heal' },
        def: { name: 'כיפת קרח', kind: 'shield', cd: 7, dur: 2.5, absorb: 40, style: 'ice' },
        ult: { name: 'כשפות דם', kind: 'aoe', at: 'self', radius: 330, dmg: 14, delay: 0.5, style: 'blood', fx: { stun: 2.2, pull: 150 } },
      },
    },
    {
      id: 'sokka', name: 'סוקה', title: 'האסטרטג', element: 'none', faction: 'צוות אווטאר',
      hp: 115, speed: 240,
      desc: 'חרב המטאור והבומרנג. נעלם בפצצת עשן ומפתיע מאחור.',
      abilities: {
        primary: { name: 'חרב המטאור', kind: 'melee', cd: 0.5, range: 95, arc: 1.7, dmg: 15, style: 'sword', fx: { knock: 160 } },
        q: { name: 'בומרנג', kind: 'projectile', cd: 4, speed: 760, dmg: 13, r: 14, range: 520, returning: true, pierce: true, style: 'boomerang', fx: { stun: 0.45 } },
        e: { name: 'פצצת עשן', kind: 'buff', cd: 11, dur: 3, stealth: true, speedMult: 1.3, style: 'smoke' },
        def: { name: 'גלגול התחמקות', kind: 'dash', cd: 4, dist: 200, dur: 0.18, invuln: 0.3, style: 'roll' },
        ult: { name: 'תוכנית מבריקה', kind: 'projectile', ring: true, count: 12, speed: 700, dmg: 12, r: 14, range: 480, returning: true, pierce: true, style: 'boomerang', fx: { stun: 0.6 } },
      },
    },
    {
      id: 'toph', name: 'טוף בייפונג', title: 'הכשפית העיוורת', element: 'earth', faction: 'צוות אווטאר',
      hp: 135, speed: 215,
      desc: 'טנק כבד. חשה את כולם דרך האדמה – גם מי שמתחבא – ומרסקת בגלי אדמה.',
      passive: 'חוש סייסמי: רואה אויבים בלתי נראים ואת כולם במפה',
      seismic: true,
      abilities: {
        primary: { name: 'זריקת סלע', kind: 'projectile', cd: 0.6, speed: 780, dmg: 14, r: 18, range: 560, style: 'rock', fx: { knock: 260 } },
        q: { name: 'גל אדמה', kind: 'projectile', cd: 5, speed: 650, dmg: 16, r: 34, range: 560, pierce: true, style: 'quake', fx: { stun: 0.55 } },
        e: { name: 'עמוד אדמה', kind: 'aoe', cd: 7, at: 'target', range: 480, radius: 95, dmg: 20, delay: 0.35, style: 'pillar', fx: { stun: 0.9 } },
        def: { name: 'שריון סלע', kind: 'shield', cd: 9, dur: 3.5, reduce: 0.6, selfSlow: 0.7, style: 'earth' },
        ult: { name: 'רעידת אדמה', kind: 'multi', style: 'quake', parts: [
          { kind: 'aoe', at: 'self', radius: 380, dmg: 30, delay: 0.25, style: 'quake', fx: { stun: 1.3, knock: 300 } },
          { kind: 'wallring', count: 10, dist: 140, hp: 90, life: 9 },
        ] },
      },
    },
    {
      id: 'zuko', name: 'צוקו', title: 'הנסיך המוגלה', element: 'fire', faction: 'צוות אווטאר',
      hp: 108, speed: 245,
      desc: 'אגרופי אש מהירים, בעיטות להבה ומסע סילון אש. הדרקון שבתוכו משתחרר באולטימייט.',
      abilities: {
        primary: { name: 'אגרוף אש', kind: 'projectile', cd: 0.3, speed: 1000, dmg: 8, r: 11, range: 520, style: 'fire', fx: { burn: [3, 1.5] } },
        q: { name: 'בעיטת להבה', kind: 'melee', cd: 4, range: 170, arc: 1.6, dmg: 17, style: 'flamecone', fx: { burn: [4, 2.5], knock: 220 } },
        e: { name: 'סילון אש', kind: 'dash', cd: 6, dist: 330, dur: 0.25, dmg: 12, style: 'firejet', fx: { burn: [4, 2] } },
        def: { name: 'חרבות הרוח הכחולה', kind: 'shield', cd: 6, dur: 1.6, absorb: 32, style: 'swords' },
        ult: { name: 'ריקוד הדרקון', kind: 'aoe', at: 'self', radius: 260, dmg: 16, delay: 0.1, pulses: 4, interval: 0.4, style: 'firering', fx: { burn: [6, 3], knock: 200 } },
      },
    },
    {
      id: 'suki', name: 'סוקי', title: 'מנהיגת לוחמות קיושי', element: 'none', faction: 'צוות אווטאר',
      hp: 118, speed: 250,
      desc: 'לוחמת מניפות קטלנית. מסתערת, חוסמת ובאולטימייט הופכת לסערת להבים.',
      abilities: {
        primary: { name: 'מכת מניפה', kind: 'melee', cd: 0.4, range: 90, arc: 1.5, dmg: 12, style: 'fan', fx: { knock: 120 } },
        q: { name: 'מניפה מעופפת', kind: 'projectile', cd: 3.5, speed: 900, dmg: 11, r: 13, range: 520, style: 'fan', fx: { slow: [0.6, 1.5] } },
        e: { name: 'הסתערות קיושי', kind: 'dash', cd: 6, dist: 300, dur: 0.22, dmg: 18, style: 'kyoshi', fx: { stun: 0.6 } },
        def: { name: 'חסימת מניפות', kind: 'shield', cd: 6, dur: 2, reduce: 0.75, style: 'fan' },
        ult: { name: 'רוח קיושי', kind: 'buff', dur: 7, cdMult: 0.35, dmgMult: 1.4, reduce: 0.35, speedMult: 1.2, style: 'kyoshi' },
      },
    },
    {
      id: 'iroh', name: 'דוד אירו', title: 'הדרקון של המערב', element: 'fire', faction: 'אומת האש',
      hp: 140, speed: 210,
      desc: 'חכם, עמיד ושקט. נשיפת אש עוצמתית, תה יסמין מרגיע ומפנה ברקים בחזרה.',
      abilities: {
        primary: { name: 'כדור אש', kind: 'projectile', cd: 0.55, speed: 820, dmg: 12, r: 15, range: 560, style: 'fire', fx: { burn: [3, 2] } },
        q: { name: 'נשיפת אש', kind: 'melee', cd: 5, range: 230, arc: 0.9, dmg: 20, style: 'flamecone', fx: { burn: [5, 3] } },
        e: { name: 'תה יסמין', kind: 'heal', cd: 11, amount: 32, speedBuff: [1.3, 3], style: 'tea' },
        def: { name: 'הפניית ברק', kind: 'shield', cd: 7, dur: 0.9, reflect: true, style: 'lightning' },
        ult: { name: 'נשימת הדרקון', kind: 'melee', range: 430, arc: 0.8, dmg: 45, style: 'dragonbreath', fx: { burn: [8, 3], knock: 500 } },
      },
    },
    {
      id: 'azula', name: 'הנסיכה אזולה', title: 'אש כחולה וברקים', element: 'fire', faction: 'אומת האש',
      hp: 96, speed: 260,
      desc: 'הכי קטלנית במשחק. אש כחולה מהירה, ברק חודר וסערת ברקים משולשת.',
      abilities: {
        primary: { name: 'חץ אש כחולה', kind: 'projectile', cd: 0.33, speed: 1150, dmg: 9, r: 10, range: 600, style: 'bluefire', fx: { burn: [3, 1.5] } },
        q: { name: 'סילון אש כחולה', kind: 'dash', cd: 4.5, dist: 360, dur: 0.22, invuln: 0.15, style: 'bluejet' },
        e: { name: 'ברק', kind: 'beam', cd: 8, charge: 0.55, range: 760, width: 22, dmg: 32, style: 'lightning', fx: { stun: 0.4 } },
        def: { name: 'מערבולת כחולה', kind: 'aoe', cd: 6, at: 'self', radius: 140, dmg: 9, delay: 0, style: 'bluering', fx: { knock: 600 } },
        ult: { name: 'סערת ברקים', kind: 'beam', charge: 0.7, range: 850, width: 26, dmg: 34, count: 3, spread: 0.45, style: 'lightning', fx: { stun: 0.7 } },
      },
    },
    {
      id: 'mai', name: 'מיי', title: 'אמנית הסכינים', element: 'none', faction: 'אומת האש',
      hp: 92, speed: 255,
      desc: 'צלפית מרחוק. סכינים מהירות במיוחד, מצמידה אויבים למקום ומתחמקת אחורה.',
      abilities: {
        primary: { name: 'סטילטו', kind: 'projectile', cd: 0.32, speed: 1350, dmg: 9, r: 8, range: 780, style: 'knife' },
        q: { name: 'מניפת סכינים', kind: 'projectile', cd: 4, count: 5, spread: 0.55, speed: 1250, dmg: 7, r: 8, range: 600, style: 'knife' },
        e: { name: 'הצמדה לקיר', kind: 'projectile', cd: 7, speed: 1300, dmg: 10, r: 10, range: 760, style: 'pin', fx: { root: 1.6 } },
        def: { name: 'סלטה לאחור', kind: 'dash', cd: 4.5, dist: 260, dur: 0.2, back: true, invuln: 0.25, style: 'roll' },
        ult: { name: 'גשם להבים', kind: 'projectile', ring: true, count: 28, speed: 1100, dmg: 9, r: 8, range: 620, style: 'knife', fx: { slow: [0.6, 1.2] } },
      },
    },
    {
      id: 'tylee', name: 'טאי לי', title: 'חוסמת הצ׳י', element: 'none', faction: 'אומת האש',
      hp: 95, speed: 290,
      desc: 'הכי מהירה. מכות לנקודות לחץ חוסמות את הצ׳י של האויב – בלי כשפות בכלל!',
      abilities: {
        primary: { name: 'מכת צ׳י', kind: 'melee', cd: 0.33, range: 80, arc: 1.4, dmg: 8, style: 'chi', fx: { chiblock: 1.2 } },
        q: { name: 'סלטה אקרובטית', kind: 'dash', cd: 3.5, dist: 300, dur: 0.22, invuln: 0.3, style: 'flip' },
        e: { name: 'קומבו נקודות לחץ', kind: 'dash', cd: 7, dist: 240, dur: 0.18, dmg: 12, style: 'chi', fx: { stun: 1.0, chiblock: 3 } },
        def: { name: 'התחמקות', kind: 'buff', cd: 7, dur: 1.2, invuln: true, speedMult: 1.3, style: 'flip' },
        ult: { name: 'שיתוק מוחלט', kind: 'aoe', at: 'self', radius: 230, dmg: 15, delay: 0.15, style: 'chi', fx: { stun: 1.6, chiblock: 5 } },
      },
    },
    {
      id: 'ozai', name: 'שליט האש אוזאי', title: 'מלך הפניקס', element: 'fire', faction: 'אומת האש',
      hp: 132, speed: 228,
      desc: 'הנבל העליון. כדורי אש ענקיים, ברק אכזרי – ובכוח השביט של סוזין הוא כמעט בלתי ניתן לעצירה.',
      abilities: {
        primary: { name: 'כדור אש ענק', kind: 'projectile', cd: 0.65, speed: 800, dmg: 16, r: 20, range: 600, style: 'fire', fx: { burn: [4, 2], knock: 200 } },
        q: { name: 'מעוף סילוני', kind: 'dash', cd: 5, dist: 420, dur: 0.3, style: 'firejet' },
        e: { name: 'ברק השליט', kind: 'beam', cd: 8.5, charge: 0.6, range: 780, width: 24, dmg: 36, style: 'lightning', fx: { stun: 0.5 } },
        def: { name: 'מגן להבות', kind: 'shield', cd: 7.5, dur: 2.5, absorb: 42, style: 'fire' },
        ult: { name: 'כוח השביט', kind: 'buff', dur: 8, dmgMult: 1.8, speedMult: 1.25, fly: true, cdMult: 0.6, style: 'comet',
               burst: { radius: 300, dmg: 28, fx: { burn: [6, 3], knock: 500 } } },
      },
    },
    {
      id: 'bumi', name: 'המלך בומי', title: 'הגאון המטורף מאומאשו', element: 'earth', faction: 'בני ברית',
      hp: 145, speed: 205,
      desc: 'בן 112 וחזק כמו הר. זורק סלעי ענק, קופץ ומרסק – והאולטימייט שלו מפיל הר שלם.',
      abilities: {
        primary: { name: 'גוש סלע', kind: 'projectile', cd: 0.75, speed: 700, dmg: 17, r: 22, range: 540, style: 'rock', fx: { knock: 340 } },
        q: { name: 'מפולת', kind: 'projectile', cd: 5, count: 3, spread: 0.5, speed: 720, dmg: 12, r: 18, range: 520, style: 'rock', fx: { knock: 260 } },
        e: { name: 'קפיצת ענק', kind: 'dash', cd: 7, dist: 340, dur: 0.4, fly: true, style: 'leap',
             landing: { radius: 130, dmg: 20, fx: { stun: 0.7, knock: 200 } } },
        def: { name: 'שריון גבישים', kind: 'shield', cd: 8, dur: 3, reduce: 0.55, style: 'earth' },
        ult: { name: 'מוחץ ההרים', kind: 'aoe', at: 'target', range: 650, radius: 260, dmg: 50, delay: 1.0, style: 'mountain', fx: { stun: 1.6 } },
      },
    },
  ];

  // יכולת בניה משותפת (בסגנון באטל רויאל) – כל דמות בונה חומה לפי היסוד שלה
  const WALL = { name: 'חומה', cd: 5, count: 3, hp: 70, life: 12 };

  const BY_ID = {};
  CHARACTERS.forEach(c => { BY_ID[c.id] = c; });

  const SLOT_KEYS = { primary: 'קליק', q: 'Q', e: 'E', def: 'רווח', ult: 'R', wall: 'F' };

  const api = { ELEMENTS, CHARACTERS, BY_ID, WALL, SLOT_KEYS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AvatarData = api;
})(typeof window !== 'undefined' ? window : globalThis);
