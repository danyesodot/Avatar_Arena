// אפקטי סאונד מסונתזים (ללא קבצים)
(function () {
  let ac = null, master = null, noiseBuf = null, muted = false;
  function init() {
    if (ac) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.35; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  }
  function noise(dur, freq, q, vol, type = 'bandpass', sweep) {
    if (!ac || muted) return;
    const t = ac.currentTime;
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur);
  }
  function tone(dur, freq, vol, type = 'sine', to) {
    if (!ac || muted) return;
    const t = ac.currentTime;
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
  }
  const S = {
    air: () => noise(0.25, 1200, 0.8, 0.5, 'bandpass', 400),
    water: () => { noise(0.2, 700, 2, 0.4, 'bandpass', 1500); tone(0.15, 500, 0.1, 'sine', 900); },
    ice: () => { tone(0.12, 1800, 0.12, 'triangle', 2400); noise(0.1, 4000, 3, 0.2); },
    fire: () => noise(0.3, 500, 0.6, 0.5, 'lowpass', 2000),
    rock: () => { noise(0.3, 200, 1, 0.7, 'lowpass', 80); tone(0.2, 90, 0.3, 'sine', 50); },
    knife: () => noise(0.08, 5000, 4, 0.3, 'bandpass', 2000),
    melee: () => noise(0.12, 2500, 1.5, 0.35, 'bandpass', 800),
    lightning: () => { noise(0.4, 3000, 0.5, 0.6, 'highpass'); tone(0.3, 120, 0.25, 'sawtooth', 40); },
    charge: () => tone(0.5, 200, 0.12, 'sawtooth', 1200),
    boom: () => { noise(0.6, 300, 0.7, 0.8, 'lowpass', 60); tone(0.5, 70, 0.4, 'sine', 30); },
    hit: () => tone(0.08, 220, 0.2, 'square', 110),
    hurt: () => { tone(0.15, 160, 0.3, 'square', 70); },
    heal: () => { tone(0.3, 520, 0.15, 'sine', 1040); tone(0.3, 660, 0.1, 'sine', 1320); },
    shield: () => tone(0.3, 300, 0.15, 'triangle', 600),
    ult: () => { tone(0.8, 110, 0.3, 'sawtooth', 440); noise(0.8, 800, 0.5, 0.4, 'bandpass', 3000); },
    kill: () => { tone(0.15, 660, 0.2, 'square'); setTimeout(() => tone(0.25, 990, 0.2, 'square'), 90); },
    pick: () => tone(0.15, 880, 0.15, 'sine', 1760),
    build: () => { noise(0.2, 300, 1, 0.5, 'lowpass', 100); },
    dash: () => noise(0.2, 1500, 0.8, 0.4, 'bandpass', 600),
    countdown: () => tone(0.15, 440, 0.2, 'square'),
    go: () => { tone(0.4, 660, 0.25, 'square', 880); },
  };
  window.Sfx = {
    init, play(name) { try { if (S[name]) S[name](); } catch (e) {} },
    toggle() { muted = !muted; return muted; },
  };
})();
