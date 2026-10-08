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
  // and a minor pentatonic for the cinematic score, which wants to be plain
  // and strong rather than coloured
  minor:     [0, 3, 5, 7, 10],
};

/*
 * Two scores, chosen from the title screen.
 *
 *  burrow — the original: koto, taiko, Japanese modes. Close, strange, small.
 *  epic   — orchestral: a staccato string ostinato under horns and choir,
 *           which is the language big action games are scored in.
 *
 * Both are synthesised from oscillators at runtime. Nothing is sampled and no
 * existing piece is quoted; the second is written in that idiom, not copied
 * from anything.
 */
export const STYLES = {
  burrow: { label: 'Burrow', mode: 'japanese' },
  epic:   { label: 'Cinematic', mode: 'orchestral' },
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

    // which score is playing, remembered between visits
    this.style = 'epic';
    try {
      const saved = localStorage.getItem('formica.music');
      if (saved && STYLES[saved]) this.style = saved;
    } catch { /* private window, or storage refused. The default stands. */ }

    this.introOn = false;
    this.introUntil = 0;
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
    // `cine` is the intro's own bus, kept apart from the looping score so the
    // two can be crossfaded against each other without fighting.
    const sends = { pad: 0.7, bass: 0.3, perc: 0.26, koto: 0.55, brass: 0.6, sfx: 0.3, cine: 0.5 };
    for (const name of Object.keys(sends)) {
      const g = ctx.createGain();
      g.gain.value = (name === 'sfx' || name === 'cine') ? 0.9 : 0;
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
    this.levelIndex = i;
    const roots = [45, 43, 41, 44, 40];
    const modes = ['hirajoshi', 'insen', 'hirajoshi', 'yo', 'iwato'];
    this.root = roots[i % roots.length];
    // The cinematic score stays in one plain minor the whole way down; its
    // colour comes from how thick it is, not from changing mode each floor.
    this.scale = this.style === 'epic' ? SCALES.minor : SCALES[modes[i % modes.length]];
    const f = mtof(this.root - 12);
    for (const d of this.droneOsc) d.o.frequency.setTargetAtTime(f, this.ctx.currentTime, 1.0);
  }

  setIntensity(v) { this.targetIntensity = Math.max(0, Math.min(1, v)); }
  setBoss(v) { this.targetBoss = Math.max(0, Math.min(1, v)); }

  /** Swap scores. Takes effect on the next bar; the choice is remembered. */
  setStyle(name) {
    if (!STYLES[name]) return;
    this.style = name;
    try { localStorage.setItem('formica.music', name); } catch { /* fine */ }
    if (this.ready) this.setLevel(this.levelIndex ?? 0);
  }

  // =========================================================== the intro ====
  /**
   * The title cue. About half a minute, built in five sections that each hand
   * over to the next: a lone horn over a drone, then a string ostinato starts
   * running underneath, then the theme arrives on horns, then everything at
   * once, then one impact and a long tail.
   *
   * Written out as absolute times rather than driven by the step sequencer,
   * because it is a fixed piece of music rather than a loop that reacts.
   */
  playIntro() {
    if (!this.ready || this.introOn) return;
    const ctx = this.ctx;
    const B = 60 / 84;                 // one beat at 84bpm
    const bar = B * 4;
    const t0 = ctx.currentTime + 0.3;
    const R = 38;                      // D — low, and it stays there

    const deg = [0, 3, 5, 7, 10, 12];  // D F G A C D, a minor pentatonic
    const n = (d, o = 0) => mtof(R + deg[d] + o);

    this.introOn = true;
    this.introUntil = t0 + bar * 15;
    this.bus.cine.gain.cancelScheduledValues(ctx.currentTime);
    // 0.62 rather than 0.9: at full the stacked horns, choir and ostinato
    // were pushing past full scale and clipping on the loudest bars.
    this.bus.cine.gain.setValueAtTime(0.62, ctx.currentTime);

    // ---- A: one horn in the dark (bars 0-1) ------------------------------
    this.#swell(n(0, -12), t0, bar * 2.6, 0.13);              // barely there
    this.#horn(n(0), t0 + B * 1.2, bar * 0.9, 0.17);
    this.#timp(t0 + bar * 1.0, 58, 0.26);
    this.#horn(n(3), t0 + bar * 1.2, bar * 0.7, 0.15);

    // ---- B: the ostinato starts running (bars 2-5) -----------------------
    const ost = [0, 0, 2, 0, 3, 2, 0, 1];                     // the engine of the cue
    for (let b = 2; b < 6; b++) {
      for (let i = 0; i < 8; i++) {
        const when = t0 + bar * b + (B / 2) * i;
        const g = 0.10 + (b - 2) * 0.030;
        this.#stacc(n(ost[i], 12), when, g);
        if (i % 2 === 0) this.#stacc(n(ost[i]), when, g * 0.8);
      }
      this.#timp(t0 + bar * b, 58, 0.5 + (b - 2) * 0.08);
      if (b >= 4) this.#timp(t0 + bar * b + B * 2, 66, 0.38);
      this.#swell(n(0, -12), t0 + bar * b, bar, 0.26);
    }

    // ---- C: the theme, on horns (bars 6-9) -------------------------------
    const theme = [[3, 2], [5, 1], [4, 1], [3, 2], [2, 2], [3, 1], [4, 1], [5, 4]];
    let tt = t0 + bar * 6;
    for (const [d, beats] of theme) {
      this.#horn(n(d), tt, B * beats * 0.96, 0.23);
      this.#choir(n(d, 12), tt, B * beats, 0.07);
      tt += B * beats;
    }
    for (let b = 6; b < 10; b++) {
      for (let i = 0; i < 8; i++) {
        this.#stacc(n(ost[i], 12), t0 + bar * b + (B / 2) * i, 0.17);
      }
      this.#timp(t0 + bar * b, 58, 0.62);
      this.#timp(t0 + bar * b + B * 2.5, 70, 0.4);
      this.#swell(n(0, -12), t0 + bar * b, bar, 0.30);
    }

    // ---- D: everything at once (bars 10-13) ------------------------------
    for (let b = 10; b < 14; b++) {
      for (let i = 0; i < 8; i++) {
        const when = t0 + bar * b + (B / 2) * i;
        this.#stacc(n(ost[i], 12), when, 0.16);
        this.#stacc(n(ost[i], 24), when, 0.06);
        this.#stacc(n(ost[i]), when, 0.11);
      }
      this.#timp(t0 + bar * b, 56, 0.8, true);
      this.#timp(t0 + bar * b + B * 2, 56, 0.6);
      this.#choir(n(0, 12), t0 + bar * b, bar, 0.09);
      this.#choir(n(4, 12), t0 + bar * b, bar, 0.06);
    }
    // the theme again, an octave up and harmonised
    tt = t0 + bar * 10;
    for (const [d, beats] of theme) {
      this.#horn(n(d, 12), tt, B * beats * 0.96, 0.19);
      this.#horn(n(d), tt, B * beats * 0.96, 0.14);
      tt += B * beats;
    }
    this.#riser(t0 + bar * 13, bar);

    // ---- E: the hit, and the room it leaves behind (bar 14) --------------
    const hit = t0 + bar * 14;
    this.#impact(hit, 0.62);
    this.#timp(hit, 50, 0.7, true);
    this.#horn(n(0), hit, bar * 1.6, 0.22);
    this.#horn(n(0, 12), hit, bar * 1.6, 0.13);
    this.#choir(n(0, 12), hit, bar * 1.9, 0.11);
    this.#choir(n(2, 12), hit, bar * 1.9, 0.07);
    this.#swell(n(0, -12), hit, bar * 1.9, 0.22);
  }

  /** Let the intro go early, because the player pressed play. */
  stopIntro(fade = 1.1) {
    if (!this.ready || !this.introOn) return;
    this.bus.cine.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
    this.introUntil = this.ctx.currentTime + fade;
  }

  get introPlaying() { return this.introOn && this.ctx && this.ctx.currentTime < this.introUntil; }

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

    // While the title cue is playing, the looping score stands aside entirely
    // rather than playing underneath it.
    const introing = this.introOn && t < this.introUntil;
    if (this.introOn && !introing) {
      this.introOn = false;
      this.bus.cine.gain.setTargetAtTime(0.62, t, 0.3);  // ready for next time
    }
    const duck = introing ? 0 : 1;

    const epic = this.style === 'epic';
    this.bus.pad.gain.setTargetAtTime(duck * (0.2 + I * 0.08 + B * 0.1), t, 0.7);
    this.bus.bass.gain.setTargetAtTime(duck * (0.09 + I * 0.28 + B * 0.16), t, 0.5);
    this.bus.perc.gain.setTargetAtTime(duck * (Math.max(0, I - 0.14) * 0.5 + B * 0.4), t, 0.5);
    this.bus.koto.gain.setTargetAtTime(duck * (epic ? 0 : 0.17 + I * 0.1), t, 0.6);
    this.bus.brass.gain.setTargetAtTime(duck * (epic ? 0.1 + B * 0.3 : B * 0.34), t, 0.9);
    this.bus.cine.gain.setTargetAtTime(
      introing ? 0.62 : (epic ? 0.4 + I * 0.2 + B * 0.16 : 0), t, 0.8);
    this.droneFilter.frequency.setTargetAtTime(280 + I * 520 + B * 500, t, 0.8);

    const spb = 60 / (this.bpm + I * 14 + B * 12);
    const stepDur = spb / 2;

    if (introing) {
      // keep the step clock alongside real time so the loop does not stampede
      // through a minute of backlog the moment the cue ends
      this.nextNoteTime = Math.max(this.nextNoteTime, ctx.currentTime);
      return;
    }

    while (this.nextNoteTime < ctx.currentTime + 0.16) {
      if (epic) this.#epicStep(this.step, this.nextNoteTime, I, B);
      else this.#playStep(this.step, this.nextNoteTime, I, B);
      this.nextNoteTime += stepDur;
      this.step = (this.step + 1) % 32;
    }
  }

  /**
   * The cinematic score, in game.
   *
   * Same adaptive idea as the burrow score — it thickens as the floor gets
   * dangerous and a champion brings the horns in — but the material is an
   * ostinato rather than a melody, so it can sit under everything for a long
   * time without demanding to be listened to.
   */
  #epicStep(s, when, I, B) {
    const beat = s % 8;
    const bar = Math.floor(s / 8);
    const sc = SCALES.minor;
    const n = (d, o = 0) => mtof(this.root + sc[d % sc.length] + o);
    const push = Math.max(I, B);

    // the ostinato: always there, quietly, and opens up under pressure
    const ost = [0, 0, 2, 0, 3, 2, 0, 1];
    const run = push > 0.3 ? 1 : 2;              // eighths, then sixteenths
    if (s % run === 0) {
      const d = ost[(s / run) % 8];
      this.#stacc(n(d, 12), when, 0.045 + push * 0.10);
      if (push > 0.55) this.#stacc(n(d, 24), when, 0.03 + push * 0.04);
    }

    // a low pulse on the bar, the heartbeat of the thing
    if (beat === 0) this.#timp(when, 58, 0.26 + push * 0.4, B > 0.5);
    if (beat === 4 && push > 0.25) this.#timp(when, 66, 0.2 + push * 0.26);
    if (push > 0.65 && (beat === 6 || beat === 7)) this.#timp(when, 74, 0.14);

    // the bass follows the ostinato's root, an octave and a half down
    if (beat === 0 || (push > 0.45 && beat === 4)) {
      this.#bass(n(bar % 2 ? 2 : 0, -12), when, 0.4 + push * 0.2);
    }

    // horns: a long tone over the top, more of them as it gets worse
    if (s % 16 === 0) this.#horn(n(0), when, 2.2, 0.10 + push * 0.14);
    if (B > 0.3 && s % 16 === 8) this.#horn(n(3), when, 1.8, 0.12 + B * 0.12);
    if (B > 0.6 && s % 32 === 16) this.#horn(n(4, 12), when, 1.6, 0.10);

    // voices, only when it is really going badly
    if (push > 0.7 && s % 32 === 0) this.#choir(n(0, 12), when, 3.4, 0.07);
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

  // ------------------------------------------------- the orchestral voices --
  /**
   * A staccato string stab — the short, hard note that drives a cue like this.
   * Two saws a few cents apart give the section its width, and the very fast
   * decay is what makes a run of them read as bowing rather than as a pad.
   */
  #stacc(freq, when, gain) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq * 7 + 900, when);
    f.frequency.exponentialRampToValueAtTime(Math.max(220, freq * 2.2), when + 0.17);
    f.Q.value = 1.6;
    for (const det of [-7, 8]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(f);
      o.start(when);
      o.stop(when + 0.3);
    }
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.21);
    f.connect(g);
    g.connect(this.bus.cine);
  }

  /** A horn: a saw rounded right off, with the slow swell brass actually has. */
  #horn(freq, when, dur, gain) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq * 2.0, when);
    f.frequency.linearRampToValueAtTime(freq * 4.4, when + dur * 0.35);
    f.frequency.linearRampToValueAtTime(freq * 2.2, when + dur);
    f.Q.value = 2.2;
    for (const [type, det, lvl] of [['sawtooth', -5, 1], ['sawtooth', 6, 0.8], ['triangle', 0, 0.5]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = det;
      const og = ctx.createGain();
      og.gain.value = lvl;
      o.connect(og); og.connect(f);
      o.start(when);
      o.stop(when + dur + 0.25);
    }
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + Math.min(0.26, dur * 0.3));
    g.gain.setValueAtTime(gain, when + dur * 0.78);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.2);
    f.connect(g);
    g.connect(this.bus.cine);
  }

  /** Voices: soft triangles, detuned enough to sound like more than one. */
  #choir(freq, when, dur, gain) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1500;
    f.Q.value = 0.9;
    for (const det of [-14, -4, 5, 13]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      o.detune.value = det;
      // a little drift, which is what stops four oscillators sounding like one
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4.2 + Math.random() * 1.6;
      const amt = ctx.createGain();
      amt.gain.value = 3.5;
      lfo.connect(amt); amt.connect(o.detune);
      lfo.start(when); lfo.stop(when + dur + 0.4);
      o.connect(f);
      o.start(when);
      o.stop(when + dur + 0.4);
    }
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.35);
    f.connect(g);
    g.connect(this.bus.cine);
  }

  /** A sustained low swell, the floor the whole cue stands on. */
  #swell(freq, when, dur, gain) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    for (const det of [-6, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(g);
      o.start(when);
      o.stop(when + dur + 0.3);
    }
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = freq / 2;
    sub.connect(g);
    sub.start(when); sub.stop(when + dur + 0.3);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.28);
    g.connect(this.bus.cine);
  }

  /** Timpani — a taiko with the skin loosened and a longer tail. */
  #timp(when, freq, gain, roll = false) {
    const ctx = this.ctx;
    const hit = (at, lvl) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      const g = ctx.createGain();
      o.frequency.setValueAtTime(freq * 1.9, at);
      o.frequency.exponentialRampToValueAtTime(freq, at + 0.09);
      g.gain.setValueAtTime(lvl, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.85);
      o.connect(g); g.connect(this.bus.cine);
      o.start(at); o.stop(at + 0.9);

      const n = this.#noise(0.1);          // returns a source, already loaded
      const nf = ctx.createBiquadFilter();
      nf.type = 'lowpass'; nf.frequency.value = 420;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(lvl * 0.5, at);
      ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
      n.connect(nf); nf.connect(ng); ng.connect(this.bus.cine);
      n.start(at);
    };
    if (roll) for (let i = 0; i < 5; i++) hit(when - 0.19 + i * 0.045, gain * (0.3 + i * 0.16));
    hit(when, gain);
  }

  /** The rising hiss that tells you something is about to land. */
  #riser(when, dur) {
    const ctx = this.ctx;
    const n = this.#noise(dur + 0.2);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.3;
    f.frequency.setValueAtTime(260, when);
    f.frequency.exponentialRampToValueAtTime(6200, when + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.14, when + dur * 0.92);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.12);
    n.connect(f); f.connect(g); g.connect(this.bus.cine);
    n.start(when);
  }

  /** The hit at the end: a sub drop with a wash of noise over it. */
  #impact(when, gain) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, when);
    o.frequency.exponentialRampToValueAtTime(32, when + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 1.7);
    o.connect(g); g.connect(this.bus.cine);
    o.start(when); o.stop(when + 1.8);

    const n = this.#noise(1.4);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(5200, when);
    f.frequency.exponentialRampToValueAtTime(300, when + 1.3);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(gain * 0.35, when);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + 1.4);
    n.connect(f); f.connect(ng); ng.connect(this.bus.cine);
    n.start(when);
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
