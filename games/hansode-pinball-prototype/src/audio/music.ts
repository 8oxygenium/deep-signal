// BGM：ステージごとの編成（kit）で、コード進行とメロディを手続き生成してループ再生する。
// マルチボール中（intensity=1）は楽器が増えて盛り上がる。
import { Rng } from '../core/rng';
import type { SongDef } from '../stages/types';
import type { AudioEngine } from './audio';

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface Melody {
  /** [小節][ステップ] = MIDIノート or -1（休み） or -2（伸ばす） */
  notes: number[][];
}

export class MusicPlayer {
  private songs: SongDef[] = [];
  private index = 0;
  private song: SongDef | null = null;
  private melody: Melody | null = null;
  private counter: Melody | null = null;
  private intensity = 0;
  private bus: GainNode | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private bar = 0;
  private playing = false;
  private paused = false;

  constructor(private readonly eng: AudioEngine) {}

  private get ctx() {
    return this.eng.ctx;
  }

  setSongs(songs: SongDef[]): void {
    this.stop();
    this.songs = songs;
    this.index = 0;
  }

  get songIndex(): number {
    return this.index;
  }

  get songName(): string {
    return this.song?.name ?? '';
  }

  start(): void {
    if (!this.songs.length) return;
    if (this.bus || this.playing) this.stop();
    this.load(this.index);
    this.playing = true;
    this.paused = false;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.step = 0;
    this.bar = 0;
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), 25);
  }

  stop(): void {
    this.playing = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.bus) {
      const b = this.bus;
      b.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
      window.setTimeout(() => b.disconnect(), 800);
      this.bus = null;
    }
  }

  setPaused(p: boolean): void {
    this.paused = p;
    if (this.bus) this.bus.gain.setTargetAtTime(p ? 0.25 : this.intensity < 0 ? 0.0001 : 1, this.ctx.currentTime, 0.1);
  }

  setIntensity(n: number): void {
    this.intensity = n;
    if (this.bus && !this.paused) this.bus.gain.setTargetAtTime(n < 0 ? 0.0001 : 1, this.ctx.currentTime, n < 0 ? 0.3 : 0.1);
  }

  setSong(i: number): void {
    if (!this.songs.length) return;
    this.index = ((i % this.songs.length) + this.songs.length) % this.songs.length;
    if (this.playing) {
      const wasIntensity = this.intensity;
      this.stop();
      this.intensity = wasIntensity;
      this.start();
    }
  }

  private load(i: number): void {
    const s = this.songs[i];
    this.song = s;
    this.bus = this.ctx.createGain();
    this.bus.gain.value = 0.0001;
    this.bus.gain.setTargetAtTime(this.intensity < 0 ? 0.0001 : 1, this.ctx.currentTime, 0.2);
    this.bus.connect(this.eng.musicBus);
    this.melody = this.makeMelody(s, s.seed, s.kit === 'anime' || s.kit === 'chaos' ? 0.75 : 0.55, 0);
    // 関数の編成はメロディ密度を中くらいにする
    this.counter = this.makeMelody(s, s.seed + 99, 0.4, 7);
  }

  private stepsPerBar(): number {
    return this.song?.steps ?? 16;
  }

  private deg(d: number): number {
    const s = this.song!;
    const n = s.scale.length;
    const oct = Math.floor(d / n);
    return s.root + s.scale[((d % n) + n) % n] + 12 * oct;
  }

  private chordDeg(bar: number): number {
    const c = this.song!.chords;
    return c[bar % c.length];
  }

  private makeMelody(s: SongDef, seed: number, density: number, offset: number): Melody {
    const rng = new Rng(seed);
    const bars = s.chords.length;
    const spb = s.steps ?? 16;
    const notes: number[][] = [];
    let cur = 7 + offset; // スケール度数（1オクターブ上あたり）
    // 2小節のモチーフを作って繰り返し、最後の小節は変える
    const motif: number[][] = [];
    for (let b = 0; b < 2; b++) {
      const row: number[] = [];
      for (let i = 0; i < spb; i++) {
        const strong = i % 4 === 0;
        const play = strong ? rng.chance(0.85) : i % 2 === 0 ? rng.chance(density) : rng.chance(density * 0.35);
        row.push(play ? 1 : 0);
      }
      motif.push(row);
    }
    for (let b = 0; b < bars; b++) {
      const rhythm = b === bars - 1 ? motif[1].map((v, i) => (i < spb / 2 ? v : i === spb / 2 ? 1 : 0)) : motif[b % 2];
      const chord = s.chords[b];
      const row: number[] = [];
      for (let i = 0; i < spb; i++) {
        if (!rhythm[i]) {
          row.push(i > 0 && row[i - 1] !== -1 && rng.chance(0.5) ? -2 : -1);
          continue;
        }
        if (i % 4 === 0) {
          // 強拍はコードの音に寄せる
          const tones = [chord, chord + 2, chord + 4, chord + 7].map((d) => d + offset);
          let best = tones[0] + 7;
          for (const t of tones) for (const o of [0, 7, 14]) if (Math.abs(t + o - cur) < Math.abs(best - cur)) best = t + o;
          cur = best;
        } else {
          cur += rng.pick([-2, -1, -1, 1, 1, 2, 0]);
        }
        cur = Math.max(4 + offset, Math.min(15 + offset, cur));
        row.push(this.degOf(s, cur));
      }
      // 最後はルートで終わる
      if (b === bars - 1) row[spb / 2] = this.degOf(s, 7 + offset);
      notes.push(row);
    }
    return { notes };
  }

  private degOf(s: SongDef, d: number): number {
    const n = s.scale.length;
    const oct = Math.floor(d / n);
    return s.root + s.scale[((d % n) + n) % n] + 12 * oct;
  }

  private tick(): void {
    if (!this.playing || !this.song) return;
    const s = this.song;
    const stepDur = 60 / s.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const swing = s.swing ?? 0;
      const t = this.nextTime + (this.step % 2 === 1 ? swing * stepDur : 0);
      if (this.intensity >= 0) this.scheduleStep(this.step, this.bar, Math.max(t, this.ctx.currentTime));
      this.nextTime += stepDur;
      this.step++;
      if (this.step >= this.stepsPerBar()) {
        this.step = 0;
        this.bar++;
      }
    }
  }

  // ───────── 楽器 ─────────

  private voice(freq: number, t: number, dur: number, o: { type?: OscillatorType; gain?: number; attack?: number; release?: number; filter?: number; filterEnv?: number; detune?: number; vibrato?: number; reverb?: number; pan?: number; glideFrom?: number }): void {
    const ctx = this.ctx;
    if (!this.bus) return;
    const g = ctx.createGain();
    const peak = o.gain ?? 0.1;
    const a = o.attack ?? 0.005;
    const r = o.release ?? 0.08;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a, dur - r));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + r);
    let input: AudioNode = g;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 2;
      f.frequency.setValueAtTime(o.filter * (o.filterEnv ?? 1), t);
      if (o.filterEnv) f.frequency.exponentialRampToValueAtTime(o.filter, t + Math.min(dur, 0.25));
      f.connect(g);
      input = f;
    }
    const oscs: OscillatorNode[] = [];
    const dets = o.detune ? [-o.detune, o.detune] : [0];
    for (const d of dets) {
      const osc = ctx.createOscillator();
      osc.type = o.type ?? 'sawtooth';
      if (o.glideFrom) {
        osc.frequency.setValueAtTime(o.glideFrom, t);
        osc.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
      } else osc.frequency.setValueAtTime(freq, t);
      osc.detune.value = d;
      if (o.vibrato) {
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 5.5;
        lg.gain.setValueAtTime(0, t);
        lg.gain.linearRampToValueAtTime(freq * o.vibrato, t + Math.min(0.3, dur));
        lfo.connect(lg).connect(osc.frequency);
        lfo.start(t);
        lfo.stop(t + dur + r + 0.05);
      }
      osc.connect(input);
      oscs.push(osc);
    }
    let out: AudioNode = g;
    if (o.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = o.pan;
      g.connect(p);
      out = p;
    }
    out.connect(this.bus);
    if (o.reverb) {
      const sg = ctx.createGain();
      sg.gain.value = o.reverb;
      out.connect(sg).connect(this.eng.reverbSend);
    }
    for (const osc of oscs) {
      osc.start(t);
      osc.stop(t + dur + r + 0.05);
    }
  }

  private noise(t: number, dur: number, o: { gain: number; type: BiquadFilterType; freq: number; q?: number; reverb?: number }): void {
    if (!this.bus) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.eng.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = o.type;
    f.frequency.value = o.freq;
    f.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.bus);
    if (o.reverb) {
      const sg = ctx.createGain();
      sg.gain.value = o.reverb;
      g.connect(sg).connect(this.eng.reverbSend);
    }
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

  private kick(t: number, gain = 0.5, punch = 1): void {
    if (!this.bus) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(150 * punch, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(g).connect(this.bus);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private snare(t: number, gain = 0.25, big = false): void {
    this.noise(t, big ? 0.35 : 0.14, { gain, type: 'bandpass', freq: big ? 1600 : 2200, q: 0.7, reverb: big ? 0.8 : 0.2 });
    this.voice(190, t, 0.06, { type: 'triangle', gain: gain * 0.6, release: 0.05 });
  }

  private hat(t: number, gain = 0.06, open = false): void {
    this.noise(t, open ? 0.18 : 0.04, { gain, type: 'highpass', freq: 7000 });
  }

  private brush(t: number, gain = 0.1): void {
    this.noise(t, 0.12, { gain, type: 'bandpass', freq: 4000, q: 0.5 });
  }

  // ───────── 1ステップ分を鳴らす ─────────

  private scheduleStep(step: number, bar: number, t: number): void {
    const s = this.song!;
    const hot = this.intensity >= 1;
    const spb = this.stepsPerBar();
    const stepDur = 60 / s.bpm / 4;
    const c = this.chordDeg(bar);
    const root = this.deg(c) - 12;
    const chord = [this.deg(c), this.deg(c + 2), this.deg(c + 4)];
    const mel = this.melody!.notes[bar % this.melody!.notes.length][step % spb];
    const cnt = this.counter!.notes[bar % this.counter!.notes.length][step % spb];
    const melLen = (row: number[], i: number) => {
      let n = 1;
      while (i + n < row.length && row[i + n] === -2) n++;
      return n;
    };
    const melRow = this.melody!.notes[bar % this.melody!.notes.length];
    const pat = (p: string) => p[step % p.length] === 'x';

    if (typeof s.kit === 'function') {
      s.kit({
        hot,
        step,
        bar,
        t,
        stepDur,
        stepsPerBar: spb,
        chord,
        root,
        mel,
        melLen: mel >= 0 ? melLen(melRow, step) : 0,
        counter: cnt,
        pat,
        mtof,
        kick: (tt, gain, punch) => this.kick(tt, gain, punch),
        snare: (tt, gain, big) => this.snare(tt, gain, big),
        hat: (tt, gain, open) => this.hat(tt, gain, open),
        brush: (tt, gain) => this.brush(tt, gain),
        noise: (tt, dur, o) => this.noise(tt, dur, o),
        voice: (f, tt, dur, o) => this.voice(f, tt, dur, o),
      });
      return;
    }

    switch (s.kit) {
      case 'electro': {
        if (pat('x...x...x...x...')) this.kick(t, 0.32);
        if (pat('..x...x...x...x.')) this.hat(t, 0.05, true);
        if (hot && pat('....x.......x...')) this.snare(t, 0.16, true);
        if (hot && step % 2 === 1) this.hat(t, 0.03);
        if (step === 0) for (const n of chord) this.voice(mtof(n), t, stepDur * 15, { type: 'sawtooth', gain: 0.035, attack: 0.25, release: 0.6, filter: 1200, detune: 9, reverb: 0.5 });
        if (pat('x.....x.x.....x.')) this.voice(mtof(root), t, stepDur * 1.5, { type: 'triangle', gain: 0.22, filter: 600, release: 0.05 });
        if (step % 2 === 0) {
          const arpN = chord[(step / 2) % 3] + 12 * (Math.floor(step / 6) % 2);
          this.voice(mtof(arpN), t, stepDur * 0.8, { type: 'square', gain: 0.045, filter: 2600, filterEnv: 2, release: 0.12, reverb: 0.5, pan: (step % 4) - 1.5 > 0 ? 0.3 : -0.3 });
        }
        if (hot && mel >= 0) this.voice(mtof(mel + 12), t, stepDur * melLen(melRow, step), { type: 'sawtooth', gain: 0.05, filter: 3200, vibrato: 0.006, reverb: 0.4 });
        break;
      }
      case 'anime': {
        if (pat('x.....x.x.....x.') || (hot && pat('x...x...x...x...'))) this.kick(t, 0.38);
        if (pat('....x.......x...')) this.snare(t, 0.2);
        if (step % 2 === 0) this.hat(t, 0.05);
        if (hot && step % 2 === 1) this.hat(t, 0.03);
        if (step % 2 === 0) this.voice(mtof(root + (step % 4 === 2 ? 12 : 0)), t, stepDur * 1.6, { type: 'sawtooth', gain: 0.1, filter: 900, filterEnv: 2.5 });
        if (pat('x..x..x...x..x..')) for (const n of chord) this.voice(mtof(n), t, stepDur * 1.2, { type: 'sawtooth', gain: 0.03, filter: 3000, filterEnv: 1.5, detune: 6, reverb: 0.25 });
        if (mel >= 0) this.voice(mtof(mel + 12), t, stepDur * melLen(melRow, step) * 0.9, { type: 'square', gain: 0.06, filter: 4200, vibrato: 0.008, reverb: 0.3 });
        if (hot && mel >= 0) this.voice(mtof(mel + 16), t, stepDur * melLen(melRow, step) * 0.9, { type: 'triangle', gain: 0.045, reverb: 0.3 });
        if (hot && step % 2 === 0) this.voice(mtof(chord[(step / 2) % 3] + 24), t, stepDur * 0.5, { type: 'square', gain: 0.025, filter: 5000 });
        break;
      }
      case 'brass': {
        if (pat('x.......x.......')) this.kick(t, 0.4);
        if (pat('x..x..x.x.x.x...') && (hot || bar % 2 === 1)) this.snare(t, 0.11);
        if (pat('....x.......x...')) this.snare(t, 0.18);
        if (pat('x.......x.......')) this.voice(mtof(root - (step === 8 ? 5 : 0)), t, stepDur * 3, { type: 'square', gain: 0.12, filter: 500 });
        if (pat('x.....x.x.......')) for (const n of chord) this.voice(mtof(n), t, stepDur * (step === 0 ? 3 : 1.5), { type: 'sawtooth', gain: 0.045, filter: 1100, filterEnv: 3, attack: 0.02, detune: 5, reverb: 0.3 });
        if ((hot || bar % 4 >= 2) && mel >= 0) this.voice(mtof(mel), t, stepDur * melLen(melRow, step), { type: 'sawtooth', gain: 0.07, filter: 1800, filterEnv: 1.6, attack: 0.025, vibrato: 0.01, reverb: 0.35 });
        if (hot && cnt >= 0) this.voice(mtof(cnt - 5), t, stepDur * 1.5, { type: 'sawtooth', gain: 0.04, filter: 1400, attack: 0.02, reverb: 0.3 });
        break;
      }
      case 'rockabilly': {
        if (pat('x.......x.......')) this.kick(t, 0.3);
        if (pat('....x.......x...')) this.brush(t, 0.16);
        if (step % 2 === 0) this.hat(t, 0.035);
        // ウォーキングベース
        if (step % 4 === 0) {
          const walk = [0, 4, 7, 9][step / 4];
          const next = this.deg(this.chordDeg(bar + 1)) - 12;
          const n = step === 12 ? next - 1 : root + walk;
          this.voice(mtof(n - 12), t, stepDur * 3.2, { type: 'triangle', gain: 0.28, filter: 700, filterEnv: 2, release: 0.1 });
        }
        if (pat('..x...x...x...x.')) for (const n of chord) this.voice(mtof(n), t, stepDur * 0.9, { type: 'square', gain: 0.022, filter: 2200, release: 0.05 });
        if (step === 0) for (const n of chord) this.voice(mtof(n), t, stepDur * 15, { type: 'sine', gain: 0.035, attack: 0.3, release: 0.5, vibrato: 0.012, reverb: 0.7 });
        if (hot && mel >= 0) this.voice(mtof(mel), t, stepDur * melLen(melRow, step), { type: 'sawtooth', gain: 0.07, filter: 1500, filterEnv: 1.5, attack: 0.03, vibrato: 0.012, reverb: 0.35 });
        if (!hot && bar % 4 === 3 && mel >= 0) this.voice(mtof(mel), t, stepDur * melLen(melRow, step), { type: 'triangle', gain: 0.05, reverb: 0.4 });
        break;
      }
      case 'synthwave': {
        if (pat('x...x...x...x...')) this.kick(t, 0.4);
        if (pat('....x.......x...')) this.snare(t, 0.22, true);
        this.hat(t, step % 4 === 2 ? 0.04 : 0.02);
        this.voice(mtof(root + (step % 2 === 1 ? 12 : 0)), t, stepDur * 0.9, { type: 'sawtooth', gain: 0.07, filter: 700 + (hot ? 600 : 0), filterEnv: 2.2, release: 0.04 });
        if (step === 0) for (const n of chord) this.voice(mtof(n), t, stepDur * 16, { type: 'sawtooth', gain: 0.03, attack: 0.4, release: 0.6, filter: 1500, detune: 12, reverb: 0.7 });
        if ((hot || bar % 2 === 1) && mel >= 0) this.voice(mtof(mel + 12), t, stepDur * melLen(melRow, step), { type: 'sawtooth', gain: 0.05, filter: 2800, vibrato: 0.007, reverb: 0.6, glideFrom: step > 0 ? undefined : undefined });
        if (hot && step % 2 === 0) this.voice(mtof(chord[(step / 2) % 3] + 24), t, stepDur * 0.6, { type: 'square', gain: 0.02, filter: 4000, reverb: 0.5 });
        break;
      }
      case 'chaos': {
        // 7/8拍子っぽい、落ち着かないリズム
        if (pat('x..x...x.x....')) this.kick(t, 0.42, 1.2);
        if (pat('....x......x..')) this.snare(t, 0.22);
        if (Math.random() < 0.3) this.hat(t, 0.04);
        if (step % 2 === 0) this.voice(mtof(root + (Math.random() < 0.15 ? 1 : 0)), t, stepDur * 1.2, { type: 'square', gain: 0.09, filter: 900, filterEnv: 3 });
        if (pat('x.....x...x...')) for (const n of [chord[0], chord[0] + 1, chord[0] + 6]) this.voice(mtof(n), t, stepDur * 0.8, { type: 'sawtooth', gain: 0.03, filter: 2000 });
        if (mel >= 0 && (hot || bar % 2 === 0)) this.voice(mtof(mel + 12), t, stepDur * melLen(melRow, step), { type: 'square', gain: 0.04, filter: 3000, vibrato: 0.03 });
        if (step === 0 && bar % 4 === 3) this.voice(mtof(chord[0] + 24), t, stepDur * 6, { type: 'sawtooth', gain: 0.04, glideFrom: mtof(chord[0] + 31), filter: 3000, vibrato: 0.04, reverb: 0.4 });
        break;
      }
    }
  }
}
