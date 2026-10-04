// ---------------------------------------------------------------------------
// audio.js — the whole soundtrack is synthesised at runtime. No audio files,
// so the game works offline and the repo stays small.
//
// The palette is deliberately not orchestral-generic: a hirajoshi scale, a
// koto-ish pluck, taiko drums with flams, and a brass swell that only shows up
// when a champion is awake. Everything runs through a generated convolution
// reverb, which is what makes it sound like it is happening underground.
// ---------------------------------------------------------------------------

const SCALES = {
  // Japanese pentatonics — the half-steps are what give them their colour
  hirajoshi: [0, 2, 3, 7, 8],
  insen:     [0, 1, 5, 7, 10],
  iwato:     [0, 1, 5, 6, 10],
  yo:        [0, 2, 5, 7, 9],
};

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  constructor() {
    this.ready = false;
    this.muted = false;
    this.ctx = null;
    this.intensity = 0;        // 0 exploring .. 1 hunted
    this.targetIntensity = 0;
    this.boss = 0;             // 0 .. 1, a champion is awake
    this.targetBoss = 0;
    this.bpm = 78;
    this.step = 0;
    this.nextNoteTime = 0;
    this.timer = null;
    this.root = 45;
    this.scale = SCALES.hirajoshi;
    this.motif = [0, 2, 1, 4, 3, 1, 2, 0];
    this.bassLine = [0, 0, 3, 0, 4, 3, 1, 0];
  }

  start() {
    if (this.ready) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -11;
    this.limiter.knee.value = 18;
    this.limiter.ratio.value = 10;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.25;

    this.master.connect(this.limiter);
    this.limiter.connect(ctx.destination);

    this.verb = ctx.createConvolver();
    this.verb.buffer = this.#impulse(3.4, 2.4);
    this.verbGain = ctx.createGain();
    this.verbGain.gain.value = 0.46;
    this.verb.connect(this.verbGain);
    this.verbGain.connect(this.master);

    this.bus = {};
    const sends = { pad: 0.7, bass: 0.3, perc: 0.26, koto: 0.55, brass: 0.6, sfx: 0.3 };
    for (const name of Object.keys(sends)) {
      const g = ctx.createGain();
      g.gain.value = name === 'sfx' ? 0.9 : 0;
      const send = ctx.createGain();
      send.gain.value = sends[name];
      g.connect(this.master);
      g.connect(send);
      send.connect(this.verb);
      this.bus[name] = g;
    }

    this.#buildDrone();

    this.ready = true;
    this.nextNoteTime = ctx.currentTime + 0.12;
    this.timer = setInterval(() => this.#schedule(), 25);
    this.master.gain.setTargetAtTime(0.85, ctx.currentTime, 1.4);
  }

  #impulse(seconds, decay) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        let sample = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
        if (i < rate * 0.04) sample *= 0.35;         // soften the very front
        d[i] = sample;
      }
    }
    return buf;
  }

  /** The colony hum: three detuned saws under a slow filter sweep. */
  #buildDrone() {
    const ctx = this.ctx;
    this.droneOsc = [];
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 300;
    this.droneFilter.Q.value = 4;
    this.droneFilter.connect(this.bus.pad);

    for (const det of [-9, 0, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(this.root - 12);
      o.detune.value = det;
      const g = ctx.createGain();
      g.gain.value = 0.15;
      o.connect(g); g.connect(this.droneFilter);
      o.start();
      this.droneOsc.push({ o, g });
    }

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.04;
    const amt = ctx.createGain();
    amt.gain.value = 210;
    lfo.connect(amt);
    amt.connect(this.droneFilter.frequency);
    lfo.start();
  }

  setLevel(i) {
    if (!this.ready) return;
    const roots = [45, 43, 41, 44, 40];
    const modes = ['hirajoshi', 'insen', 'hirajoshi', 'yo', 'iwato'];
    this.root = roots[i % roots.length];
    this.scale = SCALES[modes[i % modes.length]];
    const f = mtof(this.root - 12);
    for (const d of this.droneOsc) d.o.frequency.setTargetAtTime(f, this.ctx.currentTime, 1.0);
  }

  setIntensity(v) { this.targetIntensity = Math.max(0, Math.min(1, v)); }
  setBoss(v) { this.targetBoss = Math.max(0, Math.min(1, v)); }

  setMuted(m) {
    this.muted = m;
    if (!this.ready) return;
    this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.08);
  }

  // ------------------------------------------------------------ sequencer --
  #schedule() {
    if (!this.ready || this.ctx.state !== 'running') return;
    const ctx = this.ctx;

    this.intensity += (this.targetIntensity - this.intensity) * 0.045;
    this.boss += (this.targetBoss - this.boss) * 0.03;
    const I = this.intensity;
    const B = this.boss;

    const t = ctx.currentTime;
    this.bus.pad.gain.setTargetAtTime(0.2 + I * 0.08 + B * 0.1, t, 0.7);
    this.bus.bass.gain.setTargetAtTime(0.09 + I * 0.28 + B * 0.16, t, 0.5);
    this.bus.perc.gain.setTargetAtTime(Math.max(0, I - 0.14) * 0.5 + B * 0.4, t, 0.5);
    this.bus.koto.gain.setTargetAtTime(0.17 + I * 0.1, t, 0.6);
    this.bus.brass.gain.setTargetAtTime(B * 0.34, t, 0.9);
    this.droneFilter.frequency.setTargetAtTime(280 + I * 520 + B * 500, t, 0.8);

    const spb = 60 / (this.bpm + I * 14 + B * 12);
    const stepDur = spb / 2;

    while (this.nextNoteTime < ctx.currentTime + 0.16) {
      this.#playStep(this.step, this.nextNoteTime, I, B);
      this.nextNoteTime += stepDur;
      this.step = (this.step + 1) % 32;
    }
  }

  #playStep(s, when, I, B) {
    const beat = s % 8;
    const bar = Math.floor(s / 8);

    // ---- bass: a slow modal walk, doubling up under pressure -------------
    if (beat === 0 || beat === 6 || ((I > 0.5 || B > 0.3) && beat === 3)) {
      const deg = this.bassLine[(bar * 2 + (beat === 0 ? 0 : 1)) % this.bassLine.length];
      this.#bass(mtof(this.root + this.scale[deg] - 12), when, 0.42 + I * 0.18);
    }

    // ---- taiko -----------------------------------------------------------
    if (I > 0.14 || B > 0.1) {
      if (beat === 0) this.#taiko(when, 68, 0.62 + B * 0.3, true);
      if (beat === 4) this.#taiko(when, 74, 0.5 + B * 0.28, B > 0.4);
      if (beat === 2 || beat === 7) this.#taiko(when, 132, 0.24 + I * 0.22);
      if ((I > 0.6 || B > 0.5) && (beat === 3 || beat === 5)) this.#taiko(when, 118, 0.2);
      if (B > 0.6 && beat === 6) this.#taiko(when, 60, 0.5, true);
    }

    // ---- koto ostinato ---------------------------------------------------
    const gate = (I > 0.45 || B > 0.35) ? 2 : 4;
    if (s % gate === 0) {
      const idx = (s / gate) % this.motif.length;
      const deg = this.motif[idx];
      const oct = ((I > 0.6 || B > 0.5) && idx % 3 === 0) ? 12 : 0;
      this.#koto(mtof(this.root + 12 + this.scale[deg] + oct), when, 0.3 + I * 0.2);
      // a grace note above, the way a koto is actually played
      if (idx % 4 === 2) {
        this.#koto(mtof(this.root + 12 + this.scale[(deg + 1) % 5] + oct), when + 0.055, 0.14);
      }
    }

    // ---- brass: only while a champion is on its feet ---------------------
    if (B > 0.25 && s % 16 === 0) {
      this.#brass(mtof(this.root + this.scale[0]), when, 1.7, 0.16 + B * 0.1);
    }
    if (B > 0.55 && s % 16 === 8) {
      this.#brass(mtof(this.root + this.scale[3] - 12), when, 1.4, 0.14 + B * 0.1);
    }

    // ---- a high shimmer under real pressure ------------------------------
    if (I > 0.74 && B < 0.3 && s % 16 === 8) {
      this.#shimmer(mtof(this.root + 24 + this.scale[4]), when);
    }
  }

  // ------------------------------------------------------------- voices ----
  #bass(freq, when, gain) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq * 1.9, when);
    o.frequency.exponentialRampToValueAtTime(freq, when + 0.08);
    f.type = 'lowpass';
    f.frequency.value = 380;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.52);
    o.connect(f); f.connect(g); g.connect(this.bus.bass);
    o.start(when); o.stop(when + 0.56);
  }

  /** Taiko: a deep pitched thump with a wooden skin on top. `flam` doubles it. */
  #taiko(when, freq, gain, flam = false) {
    const hit = (at, amp) => {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * 2.8, at);
      o.frequency.exponentialRampToValueAtTime(freq, at + 0.06);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(amp, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
      o.connect(g); g.connect(this.bus.perc);
      o.start(at); o.stop(at + 0.46);

      const n = this.#noise(0.1);
      const nf = ctx.createBiquadFilter();
      nf.type = 'bandpass';
      nf.frequency.value = freq * 7;
      nf.Q.value = 0.9;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(amp * 0.5, at);
      ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
      n.connect(nf); nf.connect(ng); ng.connect(this.bus.perc);
      n.start(at);
    };
    if (flam) hit(when - 0.045, gain * 0.45);
    hit(when, gain);
  }

  /** Koto: hard pluck, bright transient, long ringing tail. */
  #koto(freq, when, gain) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    o.type = 'triangle';
    o.frequency.value = freq;
    o2.type = 'square';
    o2.frequency.value = freq * 2.003;
    const g2 = ctx.createGain();
    g2.gain.value = 0.12;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(4200, when);
    f.frequency.exponentialRampToValueAtTime(620, when + 0.38);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain * 0.32, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 1.15);
    o.connect(f); o2.connect(g2); g2.connect(f);
    f.connect(g); g.connect(this.bus.koto);
    o.start(when); o.stop(when + 1.2);
    o2.start(when); o2.stop(when + 1.2);
  }

  /** Brass swell: a stack of saws opening through a filter. */
  #brass(freq, when, dur, gain) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(240, when);
    f.frequency.linearRampToValueAtTime(2100, when + dur * 0.42);
    f.frequency.linearRampToValueAtTime(400, when + dur);
    f.Q.value = 2.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, when + dur);
    f.connect(g); g.connect(this.bus.brass);
    for (const [mult, det] of [[1, -7], [1, 8], [2, 3], [3, -4]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq * mult;
      o.detune.value = det;
      const og = ctx.createGain();
      og.gain.value = mult === 1 ? 0.5 : 0.16;
      o.connect(og); og.connect(f);
      o.start(when); o.stop(when + dur + 0.05);
    }
  }

  #shimmer(freq, when) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, when);
    o.frequency.linearRampToValueAtTime(freq * 1.02, when + 1.4);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.06, when + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 1.6);
    o.connect(g); g.connect(this.bus.koto);
    o.start(when); o.stop(when + 1.7);
  }

  #noise(seconds) {
    const ctx = this.ctx;
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  // -------------------------------------------------------------- effects --
  #blip(freq, dur, type, gain, slide = 0) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(28, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.bus.sfx);
    o.start(t); o.stop(t + dur + 0.02);
  }

  #burst(dur, type, freq, gain, sweep = 0, q = 1.1) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = this.#noise(dur);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(50, freq + sweep), t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(this.bus.sfx);
    n.start(t);
  }

  // the acid now sounds like what it looks like: a pressurised hiss
  spit()   { this.#burst(0.22, 'bandpass', 3400, 0.2, -2600, 0.7); this.#blip(620, 0.1, 'sawtooth', 0.035, -380); }
  hiss()   { this.#burst(0.55, 'lowpass', 2200, 0.13, -1700, 0.5); }
  bite()   { this.#blip(205, 0.1, 'square', 0.07, -115); this.#burst(0.08, 'lowpass', 1100, 0.2); }
  hit()    { this.#blip(1250, 0.05, 'square', 0.07); }
  crit()   { this.#blip(1750, 0.08, 'square', 0.085, 420); }
  kill()   { this.#blip(400, 0.22, 'square', 0.07, -270); this.#burst(0.18, 'lowpass', 900, 0.18, -600); }
  hurt()   { this.#blip(165, 0.2, 'sawtooth', 0.09, -80); }
  pickup() { this.#blip(880, 0.07, 'triangle', 0.06, 340); }
  drink()  { this.#blip(300, 0.5, 'sine', 0.06, 260); this.#burst(0.4, 'lowpass', 700, 0.1, 400); }
  gate()   { this.#blip(420, 0.36, 'triangle', 0.08, 300); }
  thud()   { this.#blip(66, 0.42, 'sine', 0.12, -26); this.#burst(0.35, 'lowpass', 380, 0.24, -250); }
  dry()    { this.#blip(150, 0.05, 'square', 0.035); }
  splash() { this.#burst(0.45, 'bandpass', 1500, 0.2, -1100); }
  call()   { this.#blip(520, 0.45, 'triangle', 0.1, 220); this.#blip(780, 0.4, 'sine', 0.06, 160); }
  greet()  { this.#blip(1050, 0.05, 'triangle', 0.035, 180); }
  rumble() { this.#blip(54, 0.8, 'sine', 0.13, -18); this.#burst(0.8, 'lowpass', 300, 0.26, -200); }
  power()  { this.#blip(330, 0.7, 'triangle', 0.1, 700); this.#blip(660, 0.6, 'sine', 0.07, 500); }
  descend() { this.#blip(300, 0.9, 'sine', 0.1, -195); }
  dash()   { this.#burst(0.26, 'bandpass', 900, 0.12, 2400, 1.6); this.#blip(420, 0.16, 'triangle', 0.045, 520); }
  order()  { this.#blip(760, 0.09, 'square', 0.05, 300); this.#blip(1140, 0.07, 'triangle', 0.03, 200); }
  tell()   { this.#blip(210, 0.3, 'sawtooth', 0.07, 140); }
  tacticalIn()  { this.#blip(300, 0.3, 'sine', 0.05, 420); }
  tacticalOut() { this.#blip(620, 0.22, 'sine', 0.04, -330); }

  /** A champion notices you. Low brass hit plus a struck bell. */
  bossHorn() {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime;
    this.#brass(mtof(this.root - 12), t + 0.01, 2.2, 0.3);
    this.#blip(92, 1.1, 'sine', 0.13, -34);
    this.#burst(1.0, 'lowpass', 900, 0.18, -700, 0.6);
  }

  /** A champion falls. Everything drops away, then one clean bell. */
  bossDown() {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime;
    this.#blip(70, 1.4, 'sine', 0.14, -26);
    this.#burst(1.2, 'lowpass', 700, 0.2, -560, 0.6);
    for (let i = 0; i < 3; i++) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = mtof(this.root + 24 + this.scale[i * 2 % 5]);
      g.gain.setValueAtTime(0.0001, t + 0.35 + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.38 + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4 + i * 0.16);
      o.connect(g); g.connect(this.bus.koto);
      o.start(t + 0.35 + i * 0.16); o.stop(t + 2.6 + i * 0.16);
    }
  }
}
