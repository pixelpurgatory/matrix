/* audio.js — fully synthesized, original music + SFX (Web Audio API).
   No external/sampled/copyrighted audio. A driving dark-techno loop is
   scheduled note-by-note so it can play indefinitely and react to game state. */
(function () {
  const M = (window.M = window.M || {});
  let ctx = null,
    master = null,
    musicGain = null,
    sfxGain = null,
    started = false,
    musicEnabled = true,
    sfxEnabled = true;

  // scheduler state
  let nextNoteTime = 0,
    step = 0,
    bpm = 138,
    timer = null,
    intensity = 0; // 0..1 ramps with combat danger

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.0;
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.9;
    // light master compression so the mix doesn't clip in the chaos
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    musicGain.connect(comp);
    sfxGain.connect(comp);
    comp.connect(master);
  }

  function resume() {
    init();
    if (ctx.state === "suspended") ctx.resume();
  }

  /* ---------- low-level synth voices ---------- */
  function env(g, t, a, d, s, r, peak, sus) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus), t + a + d);
    return t + a + d;
  }

  function osc(type, freq, t) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    return o;
  }

  // kick: pitch-dropping sine + click
  function kick(t, gain = 1) {
    if (gain <= 0.001) return; // silent kick = no voice (avoid ramp-to-zero)
    const o = osc("sine", 150, t);
    const g = ctx.createGain();
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.0 * gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(musicGain);
    o.start(t);
    o.stop(t + 0.25);
  }

  // hat: filtered noise burst
  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    const len = ctx.sampleRate * 0.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function hat(t, open = false, gain = 0.3) {
    const s = ctx.createBufferSource();
    s.buffer = noise();
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (open ? 0.18 : 0.04));
    s.connect(hp).connect(g).connect(musicGain);
    s.start(t);
    s.stop(t + 0.2);
  }

  // bass: saw through lowpass with a little drive
  function bass(t, freq, dur, gain = 0.5) {
    const o = osc("sawtooth", freq, t);
    const o2 = osc("square", freq * 0.5, t);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(180 + 700 * intensity, t);
    lp.Q.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp);
    o2.connect(lp);
    lp.connect(g).connect(musicGain);
    o.start(t); o2.start(t);
    o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  // lead pluck: detuned saws, plucky env, used for the arp
  function pluck(t, freq, dur, gain = 0.22) {
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900 + 3500 * intensity, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + dur);
    [0, 7].forEach((cents, i) => {
      const o = osc(i ? "square" : "sawtooth", freq, t);
      o.detune.value = cents;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g).connect(musicGain);
  }

  // pad for menus: soft detuned triangle stack
  function pad(t, freqs, dur, gain = 0.08) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    freqs.forEach((f, i) => {
      const o = osc("triangle", f, t);
      o.detune.value = (i - 1) * 6;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.1);
    });
    lp.connect(g).connect(musicGain);
  }

  /* ---------- sequencer ---------- *
   * Key: A minor. 16 steps/bar. Original riff. */
  const NOTE = (n) => 440 * Math.pow(2, (n - 9) / 12); // n=semitone from A4=9 mapping; we pass midi-ish
  const m = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  // bass pattern (midi notes), root walk A1..F1..C2..G1
  const BASS = [33, 33, 45, 33, 33, 33, 41, 33, 29, 29, 41, 29, 28, 28, 40, 31];
  // arp over Am pentatonic-ish (A C E G A) high register
  const ARP = [69, 72, 76, 79, 81, 79, 76, 72, 69, 72, 76, 79, 84, 79, 76, 72];

  function scheduleStep(s, t) {
    // drums — four-on-floor kick on each quarter note
    if (s % 4 === 0) kick(t, 1);
    if (s % 4 === 2 && intensity > 0.45) kick(t, 0.6); // offbeat thump when intense
    hat(t, s % 4 === 2, 0.18 + 0.12 * intensity);
    if (s % 8 === 4 && intensity > 0.3) hat(t, true, 0.25); // backbeat openness
    // bass: 16th driving
    if (s % 2 === 0 || intensity > 0.5) bass(t, m(BASS[s]) / 1, 0.14, 0.45 + 0.1 * intensity);
    // arp comes in with intensity
    if (intensity > 0.18 && s % 1 === 0) {
      if (s % 2 === 0 || intensity > 0.6) pluck(t, m(ARP[s]), 0.16, 0.12 + 0.12 * intensity);
    }
    // sparse high stab on the "one"
    if (s === 0) pluck(t, m(88), 0.4, 0.1 + 0.1 * intensity);
  }

  function scheduler() {
    const spb = 60 / bpm / 4; // seconds per 16th
    while (nextNoteTime < ctx.currentTime + 0.12) {
      scheduleStep(step % 16, nextNoteTime);
      nextNoteTime += spb;
      step++;
    }
  }

  function startMusic(mode) {
    resume();
    if (timer) return;
    musicEnabled = M.save.data.musicOn !== false;
    nextNoteTime = ctx.currentTime + 0.05;
    step = 0;
    timer = setInterval(scheduler, 25);
    fadeMusic(musicEnabled ? 0.55 : 0, 1.5);
  }
  function fadeMusic(to, secs = 1) {
    if (!musicGain) return;
    const t = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(musicGain.gain.value, t);
    musicGain.gain.linearRampToValueAtTime(to, t + secs);
  }
  function setIntensity(v) {
    intensity = M.util.clamp(v, 0, 1);
    bpm = 132 + 18 * intensity;
  }

  /* ---------- SFX (procedural) ---------- */
  function play(fn) {
    if (!sfxEnabled || !ctx) return;
    resume();
    fn(ctx.currentTime);
  }
  const sfx = {
    shoot() {
      play((t) => {
        const o = osc("square", 760, t);
        o.frequency.exponentialRampToValueAtTime(180, t + 0.08);
        const g = ctx.createGain();
        env(g, t, 0.002, 0.08, 0, 0, 0.18, 0.0001);
        const hp = ctx.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=300;
        o.connect(hp).connect(g).connect(sfxGain);
        o.start(t); o.stop(t + 0.12);
      });
    },
    hit() {
      play((t) => {
        const s = ctx.createBufferSource(); s.buffer = noise();
        const bp = ctx.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=1800; bp.Q.value=1.2;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
        s.connect(bp).connect(g).connect(sfxGain);
        s.start(t); s.stop(t + 0.08);
      });
    },
    explode() {
      play((t) => {
        const s = ctx.createBufferSource(); s.buffer = noise();
        const lp = ctx.createBiquadFilter(); lp.type="lowpass";
        lp.frequency.setValueAtTime(1200, t); lp.frequency.exponentialRampToValueAtTime(80, t+0.4);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        s.connect(lp).connect(g).connect(sfxGain);
        s.start(t); s.stop(t + 0.5);
        const o = osc("sine", 90, t); o.frequency.exponentialRampToValueAtTime(30, t+0.3);
        const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.5,t); g2.gain.exponentialRampToValueAtTime(0.0001,t+0.35);
        o.connect(g2).connect(sfxGain); o.start(t); o.stop(t+0.4);
      });
    },
    pickup() {
      play((t) => {
        const o = osc("triangle", 880, t);
        o.frequency.setValueAtTime(880, t); o.frequency.linearRampToValueAtTime(1320, t + 0.06);
        const g = ctx.createGain(); env(g, t, 0.002, 0.07, 0, 0, 0.12, 0.0001);
        o.connect(g).connect(sfxGain); o.start(t); o.stop(t + 0.1);
      });
    },
    levelup() {
      play((t) => {
        [0, 4, 7, 12].forEach((n, i) => {
          const o = osc("square", m(72 + n), t + i * 0.05);
          const g = ctx.createGain(); env(g, t + i*0.05, 0.003, 0.18, 0, 0, 0.16, 0.0001);
          const lp = ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=2500;
          o.connect(lp).connect(g).connect(sfxGain); o.start(t+i*0.05); o.stop(t+i*0.05+0.25);
        });
      });
    },
    hurt() {
      play((t) => {
        const o = osc("sawtooth", 200, t);
        o.frequency.exponentialRampToValueAtTime(60, t + 0.18);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.3,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.2);
        o.connect(g).connect(sfxGain); o.start(t); o.stop(t+0.22);
      });
    },
    ui() {
      play((t) => {
        const o = osc("square", 1200, t);
        const g = ctx.createGain(); env(g,t,0.001,0.04,0,0,0.08,0.0001);
        o.connect(g).connect(sfxGain); o.start(t); o.stop(t+0.05);
      });
    },
    coin() {
      play((t) => {
        [988, 1318].forEach((f, i) => {
          const o = osc("square", f, t + i*0.05);
          const g = ctx.createGain(); env(g,t+i*0.05,0.001,0.09,0,0,0.1,0.0001);
          o.connect(g).connect(sfxGain); o.start(t+i*0.05); o.stop(t+i*0.05+0.12);
        });
      });
    },
    // gacha drumroll riser
    riser(secs = 1.4) {
      play((t) => {
        const o = osc("sawtooth", 200, t);
        o.frequency.exponentialRampToValueAtTime(2000, t + secs);
        const lp = ctx.createBiquadFilter(); lp.type="lowpass";
        lp.frequency.setValueAtTime(400,t); lp.frequency.exponentialRampToValueAtTime(6000,t+secs);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.16,t+secs*0.9);
        g.gain.exponentialRampToValueAtTime(0.0001,t+secs+0.15);
        o.connect(lp).connect(g).connect(sfxGain); o.start(t); o.stop(t+secs+0.2);
        const s = ctx.createBufferSource(); s.buffer = noise();
        const hp = ctx.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=2000;
        const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.0001,t); g2.gain.linearRampToValueAtTime(0.12,t+secs);
        g2.gain.exponentialRampToValueAtTime(0.0001,t+secs+0.1);
        s.connect(hp).connect(g2).connect(sfxGain); s.start(t); s.stop(t+secs+0.1);
      });
    },
    reveal(rarity) {
      play((t) => {
        const base = rarity === "SSR" ? 65 : rarity === "SR" ? 60 : 57;
        const chord = rarity === "SSR" ? [0,4,7,11,14] : rarity==="SR"?[0,4,7,11]:[0,4,7];
        chord.forEach((n, i) => {
          const o = osc(i%2?"triangle":"sawtooth", m(base + n + 12), t);
          const g = ctx.createGain(); env(g, t, 0.005, 0.6, 0, 0, 0.13, 0.0001);
          const lp = ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=4000;
          o.connect(lp).connect(g).connect(sfxGain); o.start(t); o.stop(t + 0.8);
        });
        // shimmer
        const s = ctx.createBufferSource(); s.buffer = noise();
        const bp = ctx.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=9000; bp.Q.value=2;
        const g3 = ctx.createGain(); g3.gain.setValueAtTime(0.1,t); g3.gain.exponentialRampToValueAtTime(0.0001,t+0.5);
        s.connect(bp).connect(g3).connect(sfxGain); s.start(t); s.stop(t+0.5);
      });
    },
    boss() {
      play((t) => {
        const o = osc("sawtooth", 55, t);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.4,t); g.gain.exponentialRampToValueAtTime(0.0001,t+1.0);
        const lp = ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=300;
        o.connect(lp).connect(g).connect(sfxGain); o.start(t); o.stop(t+1.1);
      });
    },
  };

  M.audio = {
    init, resume,
    startMusic,
    stopMusic() { if (timer) { clearInterval(timer); timer = null; } fadeMusic(0, 0.6); },
    fadeMusic, setIntensity,
    menuMusic() {
      resume();
      // ambient menu mode = lower intensity loop
      if (!timer) startMusic("menu");
      setIntensity(0.15);
      fadeMusic((M.save.data.musicOn!==false)?0.4:0, 1.2);
    },
    combatMusic() { resume(); if(!timer) startMusic("combat"); setIntensity(0.5); fadeMusic((M.save.data.musicOn!==false)?0.55:0,1.0); },
    sfx,
    toggleMusic(on) {
      musicEnabled = on; M.save.data.musicOn = on; M.save.save();
      fadeMusic(on ? 0.5 : 0, 0.5);
    },
    toggleSfx(on) { sfxEnabled = on; M.save.data.sfxOn = on; M.save.save(); },
    get ctx() { return ctx; },
  };
})();
