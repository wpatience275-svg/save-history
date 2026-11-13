// Small synth sound effects (no audio files needed).
const Sfx = (() => {
  let ctx = null;
  let master = null;
  let muted = false;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = SETTINGS.sound.master * SETTINGS.sound.effects;
    // glue + loudness: compressor then make-up gain so effects cut through on phone speakers
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    const makeup = ctx.createGain(); makeup.gain.value = 2.3;
    master.connect(comp).connect(makeup).connect(ctx.destination);
  }

  function resume() {
    init();
    if (muted) return;
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, delay = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise(dur, vol = 0.3, cutoff = 1200, delay = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter).connect(g).connect(master);
    src.start(t);
  }

  return {
    resume,
    setMuted(m) { muted = m; if (ctx) (m ? ctx.suspend() : ctx.resume()); },
    tap() { tone(660, 0.08, 'triangle', 0.2); },
    draw() { tone(300 + Math.random() * 80, 0.04, 'triangle', 0.05); },
    place() { tone(220, 0.15, 'square', 0.12, 440); },
    bump() { tone(140 + Math.random() * 60, 0.09, 'sine', 0.18); noise(0.05, 0.08, 900); },
    tick() { tone(1000, 0.05, 'square', 0.08); },
    heartbeat() { tone(70, 0.12, 'sine', 0.5); tone(60, 0.12, 'sine', 0.4, null, 0.16); },
    close() { tone(880, 0.12, 'sawtooth', 0.08, 1320); },
    crash() { noise(0.7, 0.5, 700); tone(110, 0.6, 'sawtooth', 0.25, 40); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.22, null, i * 0.09)); },
    star(i) { tone(880 + i * 220, 0.3, 'triangle', 0.25); tone(1760 + i * 440, 0.2, 'sine', 0.08, null, 0.05); },
    bell(times = 1) { for (let k = 0; k < times; k++) [1, 2.76, 5.4, 8.9].forEach((m, i) => tone(660 * m, 1.4 - i * 0.25, 'sine', 0.22 / (i + 1), null, k * 0.42)); },
    horn() { [98, 123, 147].forEach(f => tone(f, 1.8, 'sawtooth', 0.12)); },
    coin(n = 0) { tone(880 + n * 90, 0.09, 'square', 0.1); tone(1320 + n * 120, 0.12, 'triangle', 0.12, null, 0.06); },
    whooshNear() { noise(0.35, 0.18, 2400); tone(500, 0.25, 'sine', 0.08, 1400); },
    groan() { tone(55, 1.6, 'sawtooth', 0.25, 32); noise(1.2, 0.25, 300); },
    fail() { [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.18, null, i * 0.16)); }
  };
})();

// Simple generated soundtrack: a dark ocean drone, slow piano-like notes,
// and a heartbeat layer that the game turns up when danger is close.
const Music = (() => {
  let ctx, out, timer = null, step = 0, tension = 0, mode = 'calm';
  const scale = [220, 246.9, 261.6, 293.7, 329.6, 349.2, 392, 440];   // A minor
  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC(); out = ctx.createGain(); out.gain.value = SETTINGS.sound.master * SETTINGS.sound.music;
    const rev = ctx.createConvolver(); const len = ctx.sampleRate * 2.5, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    rev.buffer = b; const wet = ctx.createGain(); wet.gain.value = 0.45; const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 4; const mk = ctx.createGain(); mk.gain.value = 2.2; comp.connect(mk).connect(ctx.destination); out.connect(comp); out.connect(rev).connect(wet).connect(comp);
    // drone
    [55, 82.4, 110].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(); o.type = i ? 'triangle' : 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 380; g.gain.value = 0.05; o.connect(lp).connect(g).connect(out); o.start(); });
    return true;
  }
  function note(f, dur, vol, type = 'triangle', when = 0) {
    const t = ctx.currentTime + when, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 2.001;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o2.connect(g); g.connect(out); o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
  function beat() { const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18); g.gain.setValueAtTime(0.5 * tension, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); o.connect(g).connect(out); o.start(t); o.stop(t + 0.3); }
  function tick() {
    step++;
    if (mode === 'win') return;
    const fast = mode === 'danger' || mode === 'finale';
    if (step % (fast ? 1 : 2) === 0) note(scale[(step * 3 + (step >> 3)) % scale.length] / (fast ? 1 : 2), fast ? 0.5 : 1.8, fast ? 0.07 : 0.09);
    if (step % 8 === 0) note(scale[0] / 4, 3, 0.08, 'sine');
    if (mode === 'finale') { beat(); if (step % 2) note(scale[(step * 5) % scale.length], 0.25, 0.06, 'sawtooth'); }
    else if (fast && step % 2 === 0) beat();
  }
  return {
    start() { if (!init()) return; if (ctx.state === 'suspended' && window.Platform && Platform.audioOn) ctx.resume(); if (!timer) timer = setInterval(tick, 260); },
    setMode(m) { mode = m; tension = m === 'danger' ? 1 : m === 'finale' ? 1.3 : 0; },
    win() { if (!ctx) return; mode = 'win'; [523, 659, 784, 1047, 1319].forEach((f, i) => note(f, 1.4, 0.12, 'triangle', i * 0.11)); setTimeout(() => mode = 'calm', 2500); },
    lose() { if (!ctx) return; mode = 'calm'; [330, 311, 294, 262].forEach((f, i) => note(f, 1.2, 0.1, 'sawtooth', i * 0.28)); },
    mute(m) { if (ctx) out.gain.value = m ? 0 : SETTINGS.sound.master * SETTINGS.sound.music; }
  };
})();
