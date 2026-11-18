// ציור הדמויות – איורים מקוריים בסגנון צ'יבי, מצוירים בקוד (Canvas)
(function () {
  const TAU = Math.PI * 2;

  const LOOKS = {
    aang:   { skin: '#f2c9a0', eye: '#7d8590', brow: '#00000000', mouth: 'grin',  main: '#f6b42a', dark: '#d98e10', trim: '#e8641c', pants: '#f0a81f', boots: '#7a4a28', prop: 'staff', cape: true },
    katara: { skin: '#c98e62', eye: '#2f6fd0', brow: '#3b2314', mouth: 'smile', main: '#2d6fb5', dark: '#1f4e85', trim: '#cfe8fa', pants: '#2a4e7a', boots: '#6b4a34', prop: 'water', necklace: true },
    sokka:  { skin: '#c98e62', eye: '#2f6fd0', brow: '#3b2314', mouth: 'smirk', main: '#3d6aa6', dark: '#284c7c', trim: '#e9eef5', pants: '#2c3d5a', boots: '#5a3d2a', prop: 'sword', belt: '#6b4a34', boomerang: true },
    toph:   { skin: '#f3d2b3', eye: '#cfd6c8', brow: '#1a1a22', mouth: 'smirk', main: '#5f8f3e', dark: '#3f6a28', trim: '#e6c35a', pants: '#6c9a4a', boots: null, blind: true, belt: '#e6c35a', browAngle: 0.2 },
    zuko:   { skin: '#f3d2b3', eye: '#e0a020', brow: '#111', mouth: 'frown', main: '#8f1d1d', dark: '#5c1010', trim: '#d8a63a', pants: '#3a1414', boots: '#2a1a14', prop: 'fire', scar: true, browAngle: 0.35, pads: true },
    suki:   { skin: '#f7f1ea', eye: '#4a7a5a', brow: '#111', mouth: 'smile', main: '#2f6b45', dark: '#1d4a2e', trim: '#d9b14a', pants: '#2b4a34', boots: '#2a2a2a', prop: 'fan', kyoshi: true, armor: true },
    iroh:   { skin: '#f0c89a', eye: '#d8a030', brow: '#cfcfcf', mouth: 'smile', main: '#7d2a1c', dark: '#55180f', trim: '#d0a24a', pants: '#4a1a12', boots: '#2a1a14', prop: 'tea', wide: true, beard: '#d9d9d9' },
    azula:  { skin: '#f3d2b3', eye: '#e0a020', brow: '#111', mouth: 'smirk', main: '#7a1212', dark: '#2b0e0e', trim: '#e0b040', pants: '#1f0a0a', boots: '#1a1010', prop: 'bluefire', browAngle: 0.4, pads: true, armor: true },
    mai:    { skin: '#f6dcc7', eye: '#8a7a70', brow: '#111', mouth: 'flat',  main: '#4b1525', dark: '#24080f', trim: '#a83250', pants: '#1a0a10', boots: '#111', prop: 'knives', sleeves: true, lids: true },
    tylee:  { skin: '#f3d2b3', eye: '#8a6a5a', brow: '#5b3220', mouth: 'grin',  main: '#f07fa8', dark: '#c85a83', trim: '#ffd0e0', pants: '#e46c98', boots: '#7a3a50', midriff: true, browAngle: -0.15 },
    ozai:   { skin: '#ecc8a0', eye: '#e0a020', brow: '#111', mouth: 'frown', main: '#5a0e0e', dark: '#1c0808', trim: '#e0b040', pants: '#2a0a0a', boots: '#111', prop: 'fire', browAngle: 0.5, spikes: true, beard: '#151515', goatee: true },
    bumi:   { skin: '#f0d0b0', eye: '#5a8a3a', brow: '#f2f2f2', mouth: 'tooth', main: '#55823e', dark: '#36582a', trim: '#e6c35a', pants: '#46663a', boots: null, wide: true, crazy: true },
  };

  function ell(ctx, x, y, rx, ry, fill, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); if (fill) { ctx.fillStyle = fill; ctx.fill(); } }
  function circ(ctx, x, y, r, fill) { ell(ctx, x, y, r, r, fill); }
  function shade(hex, amt) {
    let c = hex.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c.slice(0, 6), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  const OUT = 'rgba(30,18,12,0.85)';
  function stroke(ctx, w = 2, c = OUT) { ctx.lineWidth = w; ctx.strokeStyle = c; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }

  // ----------------------------------------------------------- שיער מאחור
  function backHair(ctx, id) {
    ctx.save();
    switch (id) {
      case 'katara': {
        ctx.beginPath();
        ctx.moveTo(-24, -30); ctx.bezierCurveTo(-30, -5, -26, 14, -18, 22); ctx.lineTo(18, 22); ctx.bezierCurveTo(26, 14, 30, -5, 24, -30); ctx.closePath();
        ctx.fillStyle = '#3b2314'; ctx.fill(); stroke(ctx);
        break;
      }
      case 'toph': {
        ctx.beginPath(); ctx.moveTo(-25, -30); ctx.quadraticCurveTo(-28, -8, -20, -2); ctx.lineTo(20, -2); ctx.quadraticCurveTo(28, -8, 25, -30); ctx.closePath();
        ctx.fillStyle = '#1a1a22'; ctx.fill(); stroke(ctx);
        break;
      }
      case 'azula': case 'mai': case 'ozai': {
        const len = id === 'ozai' ? 26 : 18;
        ctx.beginPath(); ctx.moveTo(-24, -30); ctx.bezierCurveTo(-28, -5, -24, len, -16, len + 4); ctx.lineTo(16, len + 4); ctx.bezierCurveTo(24, len, 28, -5, 24, -30); ctx.closePath();
        ctx.fillStyle = '#121218'; ctx.fill(); stroke(ctx);
        break;
      }
      case 'tylee': {
        // צמה ארוכה
        ctx.fillStyle = '#5b3220';
        for (let i = 0; i < 6; i++) { ell(ctx, 20 + Math.sin(i) * 2, -14 + i * 9, 6, 6, '#5b3220'); stroke(ctx, 1.5); }
        circ(ctx, 21, 41, 4, '#f07fa8'); stroke(ctx, 1.5);
        ctx.beginPath(); ctx.arc(0, -28, 25, Math.PI * 0.95, Math.PI * 2.05); ctx.fillStyle = '#5b3220'; ctx.fill();
        break;
      }
      case 'suki': {
        ctx.beginPath(); ctx.moveTo(-23, -30); ctx.quadraticCurveTo(-27, -12, -20, -6); ctx.lineTo(20, -6); ctx.quadraticCurveTo(27, -12, 23, -30); ctx.closePath();
        ctx.fillStyle = '#7a3e22'; ctx.fill(); stroke(ctx);
        break;
      }
    }
    ctx.restore();
  }

  // ----------------------------------------------------------- שיער מקדימה ותוספות ראש
  function frontHair(ctx, id, L) {
    ctx.save();
    switch (id) {
      case 'aang': {
        // חץ כחול
        ctx.fillStyle = '#3a8fd6';
        ctx.beginPath(); ctx.moveTo(-4.5, -47); ctx.lineTo(4.5, -47); ctx.lineTo(4, -38); ctx.lineTo(9, -38); ctx.lineTo(0, -29); ctx.lineTo(-9, -38); ctx.lineTo(-4, -38); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#2a6aa6'; ctx.lineWidth = 1; ctx.stroke();
        // ברק על הקרחת
        ell(ctx, -9, -39, 6, 3, 'rgba(255,255,255,.35)', -0.5);
        break;
      }
      case 'katara': {
        ctx.beginPath(); ctx.moveTo(-24, -26); ctx.bezierCurveTo(-26, -50, 26, -50, 24, -26); ctx.quadraticCurveTo(12, -40, 1, -38); ctx.quadraticCurveTo(-10, -40, -24, -26);
        ctx.fillStyle = '#3b2314'; ctx.fill(); stroke(ctx);
        // לולאות שיער
        ctx.lineWidth = 4.5; ctx.strokeStyle = '#3b2314';
        ctx.beginPath(); ctx.moveTo(-17, -33); ctx.bezierCurveTo(-28, -28, -26, -12, -20, -10); ctx.bezierCurveTo(-15, -12, -16, -22, -20, -24); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(17, -33); ctx.bezierCurveTo(28, -28, 26, -12, 20, -10); ctx.bezierCurveTo(15, -12, 16, -22, 20, -24); ctx.stroke();
        circ(ctx, -20, -9, 2.5, '#7fc3f0'); circ(ctx, 20, -9, 2.5, '#7fc3f0');
        break;
      }
      case 'sokka': {
        ctx.beginPath(); ctx.moveTo(-14, -40); ctx.quadraticCurveTo(0, -50, 14, -40); ctx.quadraticCurveTo(0, -43, -14, -40); ctx.fillStyle = '#3b2314'; ctx.fill();
        // זנב זאב
        ctx.beginPath(); ctx.moveTo(-5, -45); ctx.quadraticCurveTo(2, -60, 14, -58); ctx.quadraticCurveTo(8, -54, 6, -45); ctx.closePath(); ctx.fillStyle = '#3b2314'; ctx.fill(); stroke(ctx, 1.5);
        ell(ctx, 0, -45, 6, 3.5, '#3b2314'); stroke(ctx, 1.5);
        // צדדים מגולחים
        ell(ctx, -19, -33, 5, 7, 'rgba(60,35,20,.25)'); ell(ctx, 19, -33, 5, 7, 'rgba(60,35,20,.25)');
        break;
      }
      case 'toph': {
        ctx.fillStyle = '#1a1a22';
        circ(ctx, 0, -50, 10, '#1a1a22'); stroke(ctx);
        ctx.beginPath(); ctx.moveTo(-25, -24); ctx.bezierCurveTo(-27, -52, 27, -52, 25, -24);
        ctx.lineTo(18, -30); ctx.lineTo(12, -24); ctx.lineTo(6, -31); ctx.lineTo(0, -24); ctx.lineTo(-6, -31); ctx.lineTo(-12, -24); ctx.lineTo(-18, -30); ctx.closePath();
        ctx.fillStyle = '#1a1a22'; ctx.fill(); stroke(ctx);
        // סרט ירוק ופונפונים
        ctx.beginPath(); ctx.moveTo(-23, -38); ctx.quadraticCurveTo(0, -45, 23, -38); ctx.lineWidth = 4; ctx.strokeStyle = '#6fae5a'; ctx.stroke();
        circ(ctx, -24, -36, 5, '#f2d24a'); stroke(ctx, 1.5); circ(ctx, 24, -36, 5, '#f2d24a'); stroke(ctx, 1.5);
        break;
      }
      case 'zuko': {
        ctx.beginPath(); ctx.moveTo(-25, -22); ctx.bezierCurveTo(-28, -54, 28, -54, 25, -22);
        ctx.lineTo(21, -29); ctx.lineTo(16, -24); ctx.lineTo(12, -32); ctx.lineTo(6, -27); ctx.lineTo(1, -33); ctx.lineTo(-5, -27); ctx.lineTo(-10, -33); ctx.lineTo(-15, -26); ctx.lineTo(-20, -31); ctx.closePath();
        ctx.fillStyle = '#121216'; ctx.fill(); stroke(ctx);
        ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-6, -40, 10, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
        break;
      }
      case 'suki': {
        ctx.beginPath(); ctx.moveTo(-23, -28); ctx.bezierCurveTo(-24, -48, 24, -48, 23, -28); ctx.quadraticCurveTo(0, -36, -23, -28); ctx.fillStyle = '#7a3e22'; ctx.fill(); stroke(ctx);
        // כתר קיושי
        ctx.beginPath(); ctx.moveTo(-20, -38); ctx.quadraticCurveTo(0, -46, 20, -38); ctx.lineTo(18, -45); ctx.quadraticCurveTo(0, -52, -18, -45); ctx.closePath();
        ctx.fillStyle = '#e2b84a'; ctx.fill(); stroke(ctx, 1.5);
        ctx.beginPath(); ctx.moveTo(-10, -48); ctx.quadraticCurveTo(-14, -64, 0, -70); ctx.quadraticCurveTo(14, -64, 10, -48); ctx.closePath(); ctx.fillStyle = '#e2b84a'; ctx.fill(); stroke(ctx, 1.5);
        circ(ctx, 0, -57, 4, '#2f6b45'); stroke(ctx, 1);
        break;
      }
      case 'iroh': {
        ell(ctx, -21, -30, 6, 9, '#d4d4d4'); stroke(ctx, 1.5); ell(ctx, 21, -30, 6, 9, '#d4d4d4'); stroke(ctx, 1.5);
        ell(ctx, 0, -47, 7, 5, '#d4d4d4'); stroke(ctx, 1.5);
        ctx.fillStyle = '#d0a24a'; ctx.fillRect(-2, -52, 4, 7);
        break;
      }
      case 'azula': {
        ctx.beginPath(); ctx.moveTo(-24, -24); ctx.bezierCurveTo(-27, -54, 27, -54, 24, -24); ctx.quadraticCurveTo(14, -40, 2, -42); ctx.quadraticCurveTo(-12, -40, -24, -24);
        ctx.fillStyle = '#121218'; ctx.fill(); stroke(ctx);
        // פסים צדדיים ארוכים
        ctx.fillStyle = '#121218';
        ctx.beginPath(); ctx.moveTo(-22, -30); ctx.quadraticCurveTo(-27, -12, -22, 2); ctx.lineTo(-18, 2); ctx.quadraticCurveTo(-20, -14, -16, -30); ctx.closePath(); ctx.fill(); stroke(ctx, 1.5);
        ctx.beginPath(); ctx.moveTo(22, -30); ctx.quadraticCurveTo(27, -12, 22, 2); ctx.lineTo(18, 2); ctx.quadraticCurveTo(20, -14, 16, -30); ctx.closePath(); ctx.fill(); stroke(ctx, 1.5);
        // קשר עליון + כתר להבה
        ell(ctx, 0, -48, 9, 6, '#121218'); stroke(ctx, 1.5);
        flameCrown(ctx, 0, -52, 1);
        break;
      }
      case 'mai': {
        circ(ctx, -14, -46, 9, '#121218'); stroke(ctx, 1.5); circ(ctx, 14, -46, 9, '#121218'); stroke(ctx, 1.5);
        ctx.beginPath(); ctx.moveTo(-24, -22); ctx.bezierCurveTo(-27, -52, 27, -52, 24, -22); ctx.lineTo(19, -22); ctx.lineTo(19, -31); ctx.lineTo(-19, -31); ctx.lineTo(-19, -22); ctx.closePath();
        ctx.fillStyle = '#121218'; ctx.fill(); stroke(ctx);
        ctx.fillRect(-25, -26, 6, 26); ctx.fillRect(19, -26, 6, 26);
        break;
      }
      case 'tylee': {
        ctx.beginPath(); ctx.moveTo(-24, -24); ctx.bezierCurveTo(-27, -52, 27, -52, 24, -24); ctx.quadraticCurveTo(18, -34, 10, -31); ctx.quadraticCurveTo(0, -36, -10, -31); ctx.quadraticCurveTo(-18, -34, -24, -24);
        ctx.fillStyle = '#5b3220'; ctx.fill(); stroke(ctx);
        ctx.beginPath(); ctx.moveTo(14, -44); ctx.lineTo(22, -50); ctx.lineTo(24, -42); ctx.closePath(); ctx.fillStyle = '#f07fa8'; ctx.fill(); stroke(ctx, 1);
        break;
      }
      case 'ozai': {
        ctx.beginPath(); ctx.moveTo(-24, -20); ctx.bezierCurveTo(-27, -54, 27, -54, 24, -20); ctx.lineTo(20, -20); ctx.quadraticCurveTo(14, -38, 0, -40); ctx.quadraticCurveTo(-14, -38, -20, -20); ctx.closePath();
        ctx.fillStyle = '#121218'; ctx.fill(); stroke(ctx);
        ell(ctx, 0, -48, 9, 6, '#121218'); stroke(ctx, 1.5);
        flameCrown(ctx, 0, -53, 1.5);
        break;
      }
      case 'bumi': {
        ctx.fillStyle = '#f4f4f4';
        const spikes = [[-24, -34, -42, -46], [-24, -26, -44, -28], [-22, -18, -38, -10], [24, -34, 42, -46], [24, -26, 44, -28], [22, -18, 38, -10], [-10, -44, -18, -60], [10, -44, 18, -60]];
        for (const [x1, y1, x2, y2] of spikes) {
          ctx.beginPath(); ctx.moveTo(x1, y1 - 6); ctx.lineTo(x2, y2); ctx.lineTo(x1 + (x1 > 0 ? -2 : 2), y1 + 6); ctx.closePath(); ctx.fill(); stroke(ctx, 1.5);
        }
        break;
      }
    }
    ctx.restore();
  }

  function flameCrown(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(-5, 2); ctx.quadraticCurveTo(-6, -6, 0, -12); ctx.quadraticCurveTo(6, -6, 5, 2); ctx.closePath();
    ctx.fillStyle = '#f2c240'; ctx.fill(); stroke(ctx, 1.2, '#6a4a10');
    ctx.restore();
  }

  // ----------------------------------------------------------- פנים
  function face(ctx, id, L) {
    // Kyoshi face paint
    if (L.kyoshi) {
      ctx.fillStyle = '#c4233a';
      ell(ctx, -9, -27, 8, 4.5, '#c4233a', -0.2); ell(ctx, 9, -27, 8, 4.5, '#c4233a', 0.2);
    }
    if (L.scar) { ell(ctx, 10, -24, 9.5, 9, 'rgba(190,80,60,.75)', 0.2); }
    // עיניים
    const ey = -22;
    for (const sx of [-1, 1]) {
      const ex = sx * 9.5;
      let ry = 6.5;
      if (L.scar && sx === 1) ry = 4;
      if (L.crazy) ry = sx === 1 ? 8.5 : 4.5;
      ell(ctx, ex, ey, 5.5, ry, '#fff'); stroke(ctx, 1.6);
      if (!L.blind) {
        ell(ctx, ex + 0.5, ey + 0.5, 3.8, Math.min(ry - 1, 4.8), L.eye);
        circ(ctx, ex + 0.5, ey + 1, 1.9, '#111');
        circ(ctx, ex - 1.2, ey - 1.8, 1.3, '#fff');
      } else {
        ell(ctx, ex, ey + 0.5, 4, 4.5, L.eye);
        circ(ctx, ex - 1.2, ey - 1.5, 1.2, 'rgba(255,255,255,.9)');
      }
      if (L.lids) { ctx.beginPath(); ctx.ellipse(ex, ey, 6, ry + 0.5, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(ex, ey - 2); ctx.fillStyle = L.skin; ctx.fill(); stroke(ctx, 1.6); }
    }
    // גבות
    if (L.brow && L.brow !== '#00000000') {
      const ba = L.browAngle || 0;
      ctx.lineWidth = L.crazy || id === 'iroh' ? 5 : 2.6; ctx.strokeStyle = L.brow; ctx.lineCap = 'round';
      for (const sx of [-1, 1]) {
        let a = ba;
        if (id === 'azula' && sx === 1) a = -0.15;
        ctx.beginPath(); ctx.moveTo(sx * 4.5, -31 + a * 6); ctx.lineTo(sx * 14, -32 - a * 6); ctx.stroke();
      }
    } else if (id === 'aang') {
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(90,60,40,.4)';
      ctx.beginPath(); ctx.moveTo(-13, -31); ctx.lineTo(-6, -32); ctx.moveTo(13, -31); ctx.lineTo(6, -32); ctx.stroke();
    }
    // לחיים
    if (!L.kyoshi) { ell(ctx, -15, -14, 4, 2.5, 'rgba(255,120,120,.25)'); ell(ctx, 15, -14, 4, 2.5, 'rgba(255,120,120,.25)'); }
    // אף
    ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(-1.5, -14); ctx.lineTo(1, -14); stroke(ctx, 1.2, 'rgba(90,50,30,.5)');
    // פה
    ctx.save();
    const mc = L.kyoshi ? '#c4233a' : 'rgba(80,30,20,.9)';
    switch (L.mouth) {
      case 'grin':
        ctx.beginPath(); ctx.moveTo(-7, -10); ctx.quadraticCurveTo(0, -1, 7, -10); ctx.closePath(); ctx.fillStyle = '#7a2a22'; ctx.fill(); stroke(ctx, 1.4);
        ctx.beginPath(); ctx.moveTo(-5.5, -9.5); ctx.lineTo(5.5, -9.5); ctx.lineTo(4, -7.5); ctx.lineTo(-4, -7.5); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
        break;
      case 'smile': ctx.beginPath(); ctx.moveTo(-5, -10); ctx.quadraticCurveTo(0, -6, 5, -10); stroke(ctx, 2, mc); break;
      case 'smirk': ctx.beginPath(); ctx.moveTo(-5, -9); ctx.quadraticCurveTo(2, -8, 6, -12); stroke(ctx, 2, mc); break;
      case 'flat': ctx.beginPath(); ctx.moveTo(-4, -9); ctx.lineTo(4, -9.5); stroke(ctx, 2, mc); break;
      case 'frown': ctx.beginPath(); ctx.moveTo(-5, -8); ctx.quadraticCurveTo(0, -11, 5, -8); stroke(ctx, 2, mc); break;
      case 'tooth':
        ctx.beginPath(); ctx.moveTo(-9, -11); ctx.quadraticCurveTo(0, 0, 9, -11); ctx.closePath(); ctx.fillStyle = '#5a1a14'; ctx.fill(); stroke(ctx, 1.4);
        ctx.fillStyle = '#fff'; ctx.fillRect(1, -10.5, 4, 4);
        break;
    }
    ctx.restore();
    // זקן
    if (L.beard && !L.goatee) {
      ctx.beginPath(); ctx.moveTo(-20, -18); ctx.quadraticCurveTo(-22, 4, 0, 10); ctx.quadraticCurveTo(22, 4, 20, -18); ctx.quadraticCurveTo(12, -6, 6, -12); ctx.quadraticCurveTo(0, -14, -6, -12); ctx.quadraticCurveTo(-12, -6, -20, -18);
      ctx.fillStyle = L.beard; ctx.fill(); stroke(ctx, 1.5);
      ctx.beginPath(); ctx.moveTo(-6, -8); ctx.quadraticCurveTo(0, -5, 6, -8); stroke(ctx, 1.5, 'rgba(80,30,20,.7)');
    }
    if (L.goatee) {
      ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(0, 6); ctx.lineTo(5, -6); ctx.closePath(); ctx.fillStyle = L.beard; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8, -11); ctx.quadraticCurveTo(0, -14, 8, -11); stroke(ctx, 2, L.beard);
    }
  }

  // ----------------------------------------------------------- גוף
  function body(ctx, id, L, walk) {
    const w = L.wide ? 1.2 : 1;
    const sw = Math.sin(walk * TAU);
    // רגליים
    const fl = sw * 4, fr = -sw * 4;
    for (const [sx, off] of [[-1, fl], [1, fr]]) {
      ctx.fillStyle = L.pants; ctx.fillRect(sx * 9 - 4.5, 24 + Math.min(0, off) * 0.3, 9, 14);
      ell(ctx, sx * 9, 39 + off * 0.4, 7.5, 4.5, L.boots || L.skin); stroke(ctx, 1.4);
    }
    // גלימה
    ctx.beginPath();
    ctx.moveTo(-15 * w, -2); ctx.quadraticCurveTo(-20 * w, 14, -21 * w, 30); ctx.quadraticCurveTo(0, 34, 21 * w, 30); ctx.quadraticCurveTo(20 * w, 14, 15 * w, -2); ctx.quadraticCurveTo(0, -6, -15 * w, -2);
    const g = ctx.createLinearGradient(-20, 0, 20, 0); g.addColorStop(0, L.dark); g.addColorStop(0.45, L.main); g.addColorStop(1, shade(L.main, -15));
    ctx.fillStyle = g; ctx.fill(); stroke(ctx);
    // שוליים
    ctx.beginPath(); ctx.moveTo(-21 * w, 28); ctx.quadraticCurveTo(0, 33, 21 * w, 28); ctx.lineWidth = 4; ctx.strokeStyle = L.trim; ctx.stroke();
    // צווארון V
    ctx.beginPath(); ctx.moveTo(-7, -3); ctx.lineTo(0, 7); ctx.lineTo(7, -3); ctx.lineWidth = 3; ctx.strokeStyle = L.trim; ctx.stroke();
    if (L.midriff) { ctx.fillStyle = L.skin; ctx.fillRect(-14, 10, 28, 6); }
    if (L.belt) { ctx.fillStyle = L.belt; ctx.fillRect(-18 * w, 14, 36 * w, 4.5); }
    if (L.armor) { ctx.strokeStyle = shade(L.main, -40); ctx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-16 * w, 18 + i * 4); ctx.lineTo(16 * w, 18 + i * 4); ctx.stroke(); } }
    if (L.cape) {
      ctx.beginPath(); ctx.moveTo(-17, -2); ctx.quadraticCurveTo(0, 12, 17, -2); ctx.quadraticCurveTo(0, -6, -17, -2); ctx.fillStyle = L.trim; ctx.fill(); stroke(ctx, 1.5);
    }
    if (L.necklace) { ctx.beginPath(); ctx.arc(0, -6, 7, 0.2, Math.PI - 0.2); stroke(ctx, 1.4, '#244a7a'); circ(ctx, 0, 1.5, 3, '#6cc0f5'); stroke(ctx, 1); }
    if (L.pads || L.spikes) {
      for (const sx of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(sx * 10, -3); ctx.quadraticCurveTo(sx * 24, -8, sx * 25, 6); ctx.lineTo(sx * 14, 4); ctx.closePath();
        ctx.fillStyle = L.dark; ctx.fill(); stroke(ctx, 1.5);
        ctx.beginPath(); ctx.moveTo(sx * 13, -3); ctx.quadraticCurveTo(sx * 23, -6, sx * 24, 4); ctx.lineWidth = 2; ctx.strokeStyle = L.trim; ctx.stroke();
        if (L.spikes) { ctx.beginPath(); ctx.moveTo(sx * 18, -5); ctx.lineTo(sx * 30, -20); ctx.lineTo(sx * 24, -2); ctx.closePath(); ctx.fillStyle = L.trim; ctx.fill(); stroke(ctx, 1.2); }
      }
    }
    if (L.boomerang) {
      ctx.save(); ctx.translate(-14, 2); ctx.rotate(-0.6);
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(6, 0, 0, 16); ctx.quadraticCurveTo(3, 0, 0, -16); ctx.lineWidth = 5; ctx.strokeStyle = '#c8a070'; ctx.stroke();
      ctx.restore();
    }
  }

  function arms(ctx, id, L, walk, t) {
    const w = L.wide ? 1.2 : 1;
    const sw = Math.sin(walk * TAU) * 3;
    const sleeve = L.sleeves ? L.dark : L.main;
    // יד שמאל
    ctx.beginPath(); ctx.moveTo(-14 * w, 1); ctx.quadraticCurveTo(-23 * w, 8, -21 * w, 20 + sw); ctx.lineWidth = L.sleeves ? 11 : 8; ctx.strokeStyle = sleeve; ctx.lineCap = 'round'; ctx.stroke();
    circ(ctx, -21 * w, 21 + sw, 4.5, L.skin); stroke(ctx, 1.3);
    // יד ימין (מחזיקה אביזר)
    const hx = 22 * w, hy = 16 - sw;
    ctx.beginPath(); ctx.moveTo(14 * w, 1); ctx.quadraticCurveTo(24 * w, 6, hx, hy); ctx.lineWidth = L.sleeves ? 11 : 8; ctx.strokeStyle = sleeve; ctx.stroke();
    prop(ctx, id, L, hx, hy, t);
    circ(ctx, hx, hy, 4.5, L.skin); stroke(ctx, 1.3);
  }

  function prop(ctx, id, L, x, y, t) {
    ctx.save();
    switch (L.prop) {
      case 'staff':
        ctx.beginPath(); ctx.moveTo(x + 2, y - 52); ctx.lineTo(x - 2, y + 28); ctx.lineWidth = 4; ctx.strokeStyle = '#8a5a2c'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 2, y - 52); ctx.lineTo(x + 2, y - 44); ctx.lineWidth = 5; ctx.strokeStyle = '#e8641c'; ctx.stroke();
        break;
      case 'sword':
        ctx.translate(x, y); ctx.rotate(-0.5);
        ctx.fillStyle = '#2a2a34'; ctx.beginPath(); ctx.moveTo(-2.5, -4); ctx.lineTo(-2, -40); ctx.lineTo(0, -45); ctx.lineTo(3, -40); ctx.lineTo(2.5, -4); ctx.closePath(); ctx.fill(); stroke(ctx, 1.2, '#000');
        ctx.strokeStyle = 'rgba(180,180,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0.5, -6); ctx.lineTo(0.5, -40); ctx.stroke();
        ctx.fillStyle = '#6b4a34'; ctx.fillRect(-6, -5, 12, 3); ctx.fillRect(-2, -2, 4, 8);
        break;
      case 'water': {
        const k = Math.sin(t * 4) * 2;
        ell(ctx, x + 4, y - 10 + k, 7, 6, 'rgba(90,180,250,.8)'); ell(ctx, x + 2, y - 12 + k, 2.5, 2, 'rgba(255,255,255,.8)');
        ctx.beginPath(); ctx.arc(x + 4, y - 4, 11, -2.4, -0.3); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(90,180,250,.7)'; ctx.stroke();
        break;
      }
      case 'fire': case 'bluefire': {
        const blue = L.prop === 'bluefire';
        const k = Math.sin(t * 9) * 1.5;
        ctx.beginPath(); ctx.moveTo(x - 6, y - 4); ctx.quadraticCurveTo(x - 8, y - 16, x + 1, y - 24 - k); ctx.quadraticCurveTo(x + 9, y - 14, x + 6, y - 4); ctx.closePath();
        ctx.fillStyle = blue ? '#3aa0ff' : '#ff6a1a'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 3, y - 4); ctx.quadraticCurveTo(x - 4, y - 12, x + 1, y - 17 - k); ctx.quadraticCurveTo(x + 5, y - 11, x + 3, y - 4); ctx.closePath();
        ctx.fillStyle = blue ? '#c8ecff' : '#ffd84a'; ctx.fill();
        break;
      }
      case 'fan':
        ctx.translate(x, y - 4); ctx.rotate(-0.4);
        ctx.beginPath(); ctx.moveTo(0, 4); ctx.arc(0, 4, 20, -Math.PI * 0.85, -Math.PI * 0.15); ctx.closePath();
        ctx.fillStyle = '#e2b84a'; ctx.fill(); stroke(ctx, 1.4);
        ctx.strokeStyle = '#a8801a'; ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) { const a = -Math.PI * 0.85 + (i + 0.5) * (Math.PI * 0.7 / 5); ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(Math.cos(a) * 19, 4 + Math.sin(a) * 19); ctx.stroke(); }
        break;
      case 'tea':
        ctx.fillStyle = '#f2efe6'; ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y - 6); ctx.lineTo(x + 4, y + 2); ctx.lineTo(x - 4, y + 2); ctx.closePath(); ctx.fill(); stroke(ctx, 1.2);
        ctx.strokeStyle = '#4a9a5a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 5, y - 3); ctx.lineTo(x + 5, y - 3); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.quadraticCurveTo(x + 4, y - 14, x, y - 19); ctx.stroke();
        break;
      case 'knives':
        ctx.fillStyle = '#d8dce6';
        for (let i = -1; i <= 1; i++) { ctx.save(); ctx.translate(x + i * 3, y - 3); ctx.rotate(-0.3 + i * 0.3); ctx.beginPath(); ctx.moveTo(-1.5, 0); ctx.lineTo(0, -16); ctx.lineTo(1.5, 0); ctx.closePath(); ctx.fill(); stroke(ctx, 0.8, '#444'); ctx.restore(); }
        break;
    }
    ctx.restore();
  }

  // ----------------------------------------------------------- דמות מלאה
  // מצויר סביב (0,0); כפות רגליים ב-y≈42, ראש ב-y≈-24
  function drawCharacter(ctx, id, opts = {}) {
    const L = LOOKS[id] || LOOKS.aang;
    const walk = opts.walk || 0, t = opts.t || 0;
    ctx.save();
    if (opts.facing < 0) ctx.scale(-1, 1);
    const bob = opts.moving ? Math.abs(Math.sin(walk * TAU)) * -3 : Math.sin(t * 2) * 0.8;
    ctx.translate(0, bob);
    backHair(ctx, id);
    body(ctx, id, L, opts.moving ? walk : 0);
    arms(ctx, id, L, opts.moving ? walk : 0, t);
    // ראש
    ctx.save();
    ctx.beginPath(); ctx.ellipse(-24, -22, 4, 6, 0, 0, TAU); ctx.ellipse(24, -22, 4, 6, 0, 0, TAU); ctx.fillStyle = shade(L.skin, -12); ctx.fill();
    ell(ctx, 0, -24, 24, 23, L.skin); stroke(ctx, 2.2);
    ell(ctx, -8, -36, 9, 5, 'rgba(255,255,255,.18)', -0.4);
    face(ctx, id, L);
    frontHair(ctx, id, L);
    ctx.restore();
    ctx.restore();
  }

  // ----------------------------------------------------------- סמלי יסודות
  function drawEmblem(ctx, el, x, y, s, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 6; ctx.lineCap = 'round';
    if (el === 'air') {
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 14 + i * 14, i * 2.1, i * 2.1 + 3.6); ctx.stroke(); }
    } else if (el === 'water') {
      ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.stroke();
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-34, -16 + i * 16); ctx.bezierCurveTo(-14, -30 + i * 16, 14, -2 + i * 16, 34, -16 + i * 16); ctx.stroke(); }
    } else if (el === 'earth') {
      ctx.strokeRect(-36, -36, 72, 72); ctx.strokeRect(-18, -18, 36, 36);
      ctx.beginPath(); ctx.moveTo(-36, -36); ctx.lineTo(-18, -18); ctx.moveTo(36, -36); ctx.lineTo(18, -18); ctx.moveTo(-36, 36); ctx.lineTo(-18, 18); ctx.moveTo(36, 36); ctx.lineTo(18, 18); ctx.stroke();
    } else if (el === 'fire') {
      ctx.beginPath(); ctx.moveTo(0, 44); ctx.bezierCurveTo(-46, 30, -30, -10, -10, -20); ctx.bezierCurveTo(-14, -2, -4, 4, 0, -44); ctx.bezierCurveTo(10, -20, 40, 0, 24, 30); ctx.bezierCurveTo(20, 40, 8, 44, 0, 44); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-34, 34); ctx.lineTo(34, -34); ctx.moveTo(34, 34); ctx.lineTo(-34, -34); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  function drawPortrait(canvas, id, opts = {}) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const def = AvatarData.BY_ID[id];
    const elc = AvatarData.ELEMENTS[def.element];
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * 0.45, W * 0.05, W / 2, H / 2, W * 0.75);
    g.addColorStop(0, shade(elc.color, 40)); g.addColorStop(0.5, shade(elc.color, -40)); g.addColorStop(1, '#0d0f1a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.22; drawEmblem(ctx, def.element, W / 2, H * 0.42, W / 220, '#fff'); ctx.globalAlpha = 1;
    // קרני אור
    ctx.save(); ctx.translate(W / 2, H * 0.42); ctx.globalAlpha = 0.08; ctx.fillStyle = '#fff';
    for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, -W * 0.08); ctx.lineTo(W, W * 0.08); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.save();
    const s = (W / 120) * (opts.zoom || 1.15);
    ctx.translate(W / 2, H * 0.6); ctx.scale(s, s);
    drawCharacter(ctx, id, { t: opts.t || 0 });
    ctx.restore();
  }

  // ----------------------------------------------------------- ספרייטים לזירה (מטמון)
  const spriteCache = new Map();
  const SPR_W = 200, SPR_H = 220, SPR_S = 1.7;
  function getSprite(id, facing, frame) {
    const key = id + facing + frame;
    let c = spriteCache.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = SPR_W; c.height = SPR_H;
    const ctx = c.getContext('2d');
    ctx.translate(SPR_W / 2, SPR_H * 0.6); ctx.scale(SPR_S, SPR_S);
    drawCharacter(ctx, id, { facing, walk: frame / 4, moving: frame > 0, t: 0 });
    spriteCache.set(key, c);
    return c;
  }

  // ----------------------------------------------------------- אייקוני יכולות
  function drawAbilityIcon(canvas, ab, element, slot) {
    const ctx = canvas.getContext('2d');
    const S = canvas.width;
    const col = styleColor(ab.style, element);
    ctx.clearRect(0, 0, S, S);
    const g = ctx.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S * 0.7);
    g.addColorStop(0, shade(col, -10)); g.addColorStop(1, shade(col, -110));
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    ctx.save(); ctx.translate(S / 2, S / 2); ctx.scale(S / 64, S / 64);
    ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = col; ctx.shadowBlur = 8;
    const kind = slot === 'wall' ? 'wall' : ab.kind;
    switch (kind) {
      case 'projectile':
        if (ab.ring) { for (let i = 0; i < 8; i++) { const a = i * TAU / 8; circ(ctx, Math.cos(a) * 16, Math.sin(a) * 16, 4, '#fff'); } }
        else if (ab.count > 1) { for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(14, i * 12); ctx.stroke(); circ(ctx, 16, i * 13, 4.5, '#fff'); } }
        else if (ab.returning) { ctx.beginPath(); ctx.moveTo(-14, 10); ctx.quadraticCurveTo(0, -24, 14, 10); ctx.lineWidth = 7; ctx.stroke(); }
        else if (ab.style === 'knife' || ab.style === 'pin') { ctx.beginPath(); ctx.moveTo(-16, 16); ctx.lineTo(16, -16); ctx.lineWidth = 5; ctx.stroke(); ctx.beginPath(); ctx.moveTo(10, -18); ctx.lineTo(18, -18); ctx.lineTo(18, -10); ctx.stroke(); }
        else { circ(ctx, 8, 0, 10, '#fff'); ctx.beginPath(); ctx.moveTo(-20, -6); ctx.lineTo(-4, -4); ctx.moveTo(-22, 4); ctx.lineTo(-4, 4); ctx.stroke(); }
        break;
      case 'melee': ctx.beginPath(); ctx.arc(-8, 6, 22, -1.4, 0.4); ctx.lineWidth = 6; ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-8, 6, 14, -1.2, 0.2); ctx.stroke(); break;
      case 'dash': for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(-14 + i * 14, -14); ctx.lineTo(0 + i * 14, 0); ctx.lineTo(-14 + i * 14, 14); ctx.lineWidth = 5; ctx.stroke(); } break;
      case 'aoe': for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 6 + i * 8, 0, TAU); ctx.lineWidth = 3; ctx.stroke(); } break;
      case 'shield': ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(16, -12); ctx.quadraticCurveTo(16, 10, 0, 20); ctx.quadraticCurveTo(-16, 10, -16, -12); ctx.closePath(); ctx.lineWidth = 4; ctx.stroke(); if (ab.reflect) { ctx.beginPath(); ctx.moveTo(-6, 2); ctx.lineTo(0, -6); ctx.lineTo(6, 2); ctx.stroke(); } break;
      case 'heal': ctx.fillRect(-5, -16, 10, 32); ctx.fillRect(-16, -5, 32, 10); break;
      case 'beam': ctx.beginPath(); ctx.moveTo(-8, -20); ctx.lineTo(4, -4); ctx.lineTo(-4, 0); ctx.lineTo(8, 20); ctx.lineWidth = 4; ctx.stroke(); break;
      case 'buff': ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 8 : 20, a = i * TAU / 10 - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); break;
      case 'multi': for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 6 + i * 8, 0, TAU); ctx.lineWidth = 3; ctx.stroke(); } ctx.fillRect(-4, -22, 8, 10); break;
      case 'wall': for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { ctx.strokeRect(-18 + c * 12 + (r % 2) * 6 - 3, -14 + r * 10, 12, 10); } break;
    }
    ctx.restore();
  }

  const STYLE_COLORS = {
    air: '#f6e7b5', tornado: '#f6e7b5', avatar: '#7fe8ff', water: '#3fa7f5', ice: '#a8e4ff', heal: '#5ef0b0', blood: '#c0102a',
    rock: '#9a7a52', quake: '#8a6a3a', pillar: '#8a6a3a', earth: '#7fae5a', mountain: '#8a6a3a', leap: '#8a6a3a',
    fire: '#ff6a1a', flamecone: '#ff7a1a', firejet: '#ff8a2a', firering: '#ff5a1a', dragonbreath: '#ffb02a', comet: '#ff3a2a',
    bluefire: '#3aa0ff', bluejet: '#3aa0ff', bluering: '#3aa0ff', lightning: '#b4dcff', swords: '#9ab0ff', tea: '#8be08a',
    sword: '#c8d0ff', boomerang: '#d8b080', smoke: '#9a9aa8', roll: '#ddd', fan: '#e2b84a', kyoshi: '#5fd08a',
    knife: '#d8dce6', pin: '#ff8aa0', chi: '#ff8ac0', flip: '#ffb0d0', storm: '#b060ff', burn: '#ff6a1a', pickup: '#7fe8ff',
  };
  function styleColor(style, element) { return STYLE_COLORS[style] || (AvatarData.ELEMENTS[element] || AvatarData.ELEMENTS.none).color; }

  window.Art = { drawCharacter, drawPortrait, drawEmblem, getSprite, drawAbilityIcon, styleColor, shade, LOOKS, SPR_W, SPR_H, SPR_S };
})();
