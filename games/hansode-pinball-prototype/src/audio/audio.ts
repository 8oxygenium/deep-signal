// 音はすべて Web Audio API で合成する（音源ファイルなし）。
import type { GameEvent } from '../core/game';
import type { SfxPalette, StageDef } from '../stages/types';
import { MusicPlayer } from './music';

const DEFAULT_PAL: SfxPalette = { wave: 'triangle', pitch: 1, bright: 0.6 };

export class AudioEngine {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly sfxBus: GainNode;
  readonly musicBus: GainNode;
  readonly reverbSend: GainNode;
  private noise: AudioBuffer;
  private pal: SfxPalette = DEFAULT_PAL;
  readonly music: MusicPlayer;
  private lastPlay = new Map<string, number>();
  private pullOsc: { osc: OscillatorNode; gain: GainNode } | null = null;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    const ctx = this.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    // 残響（ノイズで作ったインパルス応答）
    const conv = ctx.createConvolver();
    conv.buffer = this.impulse(1.8, 2.6);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.25;
    this.reverbSend.connect(conv).connect(this.master);
    this.noise = this.makeNoise();
    this.music = new MusicPlayer(this);
  }

  private makeNoise(): AudioBuffer {
    const len = this.ctx.sampleRate * 2;
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const b = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  get noiseBuffer(): AudioBuffer {
    return this.noise;
  }

  resume(): void {
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  setVolumes(bgm: number, sfx: number): void {
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(bgm * bgm * 0.9, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(sfx * sfx, t, 0.05);
  }

  setStage(stage: StageDef | null): void {
    this.pal = stage?.sfx ?? DEFAULT_PAL;
  }

  // ───────── 部品（音のパーツ） ─────────

  tone(o: {
    freq: number;
    to?: number;
    type?: OscillatorType;
    dur: number;
    gain?: number;
    attack?: number;
    at?: number;
    pan?: number;
    filter?: number;
    q?: number;
    reverb?: number;
    detune?: number;
    dest?: AudioNode;
    curve?: 'exp' | 'lin';
  }): void {
    const ctx = this.ctx;
    const t = ctx.currentTime + (o.at ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(1, o.freq), t);
    if (o.to) {
      if (o.curve === 'lin') osc.frequency.linearRampToValueAtTime(Math.max(1, o.to), t + o.dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + o.dur);
    }
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const peak = o.gain ?? 0.3;
    const a = o.attack ?? 0.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node: AudioNode = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.filter;
      f.Q.value = o.q ?? 0.7;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    const out = this.panned(g, o.pan ?? 0, o.dest ?? this.sfxBus);
    if (o.reverb) {
      const s = ctx.createGain();
      s.gain.value = o.reverb;
      out.connect(s).connect(this.reverbSend);
    }
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  noiseHit(o: { dur: number; gain?: number; type?: BiquadFilterType; freq?: number; to?: number; q?: number; at?: number; pan?: number; reverb?: number; dest?: AudioNode; attack?: number }): void {
    const ctx = this.ctx;
    const t = ctx.currentTime + (o.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(o.freq ?? 1200, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.3, t + (o.attack ?? 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f).connect(g);
    const out = this.panned(g, o.pan ?? 0, o.dest ?? this.sfxBus);
    if (o.reverb) {
      const s = ctx.createGain();
      s.gain.value = o.reverb;
      out.connect(s).connect(this.reverbSend);
    }
    src.start(t, Math.random() * 1.5);
    src.stop(t + o.dur + 0.05);
  }

  /** FM のベル（チャイム） */
  bell(freq: number, dur: number, gain: number, at = 0, pan = 0): void {
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modG = ctx.createGain();
    car.frequency.value = freq;
    mod.frequency.value = freq * 3.5;
    modG.gain.setValueAtTime(freq * 2.2, t);
    modG.gain.exponentialRampToValueAtTime(freq * 0.05, t + dur);
    mod.connect(modG).connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g);
    const out = this.panned(g, pan, this.sfxBus);
    const s = ctx.createGain();
    s.gain.value = 0.4;
    out.connect(s).connect(this.reverbSend);
    car.start(t);
    mod.start(t);
    car.stop(t + dur + 0.05);
    mod.stop(t + dur + 0.05);
  }

  private panned(node: AudioNode, pan: number, dest: AudioNode): AudioNode {
    if (!pan) {
      node.connect(dest);
      return node;
    }
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p).connect(dest);
    return p;
  }

  // ───────── 効果音 ─────────

  /** 同じ音が短時間に重なりすぎないように */
  private gate(name: string, ms: number): boolean {
    const now = performance.now();
    const last = this.lastPlay.get(name) ?? 0;
    if (now - last < ms) return false;
    this.lastPlay.set(name, now);
    return true;
  }

  play(name: string, o: { pan?: number; speed?: number; value?: number } = {}): void {
    if (this.ctx.state !== 'running') return;
    const p = this.pal;
    const k = p.pitch;
    const pan = o.pan ?? 0;
    const sp = Math.min(1, (o.speed ?? 40) / 80);
    switch (name) {
      case 'flipUp':
        this.noiseHit({ dur: 0.05, gain: 0.32, type: 'lowpass', freq: 1400 * p.bright + 400, pan });
        this.tone({ freq: 150 * k, to: 55, type: 'sine', dur: 0.09, gain: 0.45, pan });
        break;
      case 'flipDown':
        this.noiseHit({ dur: 0.04, gain: 0.12, type: 'lowpass', freq: 900, pan });
        this.tone({ freq: 90, to: 50, type: 'sine', dur: 0.05, gain: 0.18, pan });
        break;
      case 'bumper':
        if (!this.gate('bumper', 30)) return;
        if (p.chime) {
          this.bell(1046 * (Math.random() < 0.5 ? 1 : 1.5), 0.9, 0.22, 0, pan);
        } else if (p.punchy) {
          this.noiseHit({ dur: 0.12, gain: 0.45, type: 'lowpass', freq: 2600, to: 300, pan });
          this.tone({ freq: 420 * k, to: 70, type: 'square', dur: 0.16, gain: 0.25, pan, filter: 2200 });
        } else if (p.glitch) {
          for (let i = 0; i < 3; i++) this.tone({ freq: 200 + Math.random() * 1200, type: 'square', dur: 0.035, gain: 0.12, at: i * 0.025, pan, filter: 4000 });
          this.tone({ freq: 160 * k, to: 60, type: 'sawtooth', dur: 0.14, gain: 0.25, pan, filter: 1800 });
        } else {
          this.tone({ freq: 380 * k, to: 120 * k, type: p.wave, dur: 0.13, gain: 0.32, pan, filter: 3000 * p.bright + 800 });
          this.noiseHit({ dur: 0.04, gain: 0.25, freq: 3500, q: 0.8, pan });
        }
        break;
      case 'sling':
        if (!this.gate('sling', 40)) return;
        this.noiseHit({ dur: 0.06, gain: 0.32, type: 'highpass', freq: 1800, pan });
        this.tone({ freq: 560 * k, to: 190 * k, type: p.wave, dur: 0.09, gain: 0.22, pan, filter: 2600 });
        if (p.chime) this.bell(1568, 0.5, 0.12, 0, pan);
        break;
      case 'target':
        this.tone({ freq: 880 * k, type: 'sine', dur: 0.08, gain: 0.22, pan });
        this.tone({ freq: 1320 * k, type: p.wave, dur: 0.1, gain: 0.14, at: 0.04, pan, reverb: 0.3 });
        if (p.chime) this.bell(659, 0.8, 0.18, 0, pan);
        break;
      case 'drop':
        this.noiseHit({ dur: 0.07, gain: 0.3, type: 'lowpass', freq: 900, pan });
        this.tone({ freq: 240 * k, to: 90, type: 'triangle', dur: 0.12, gain: 0.3, pan });
        if (p.chime) this.bell(1046, 0.7, 0.16, 0, pan);
        break;
      case 'bank':
        [0, 4, 7, 12].forEach((n, i) => this.tone({ freq: 523 * k * Math.pow(2, n / 12), type: p.wave, dur: 0.18, gain: 0.2, at: i * 0.06, reverb: 0.4, filter: 4000 }));
        break;
      case 'spinner':
        if (!this.gate('spinner', 25)) return;
        this.tone({ freq: 2200 * k, type: 'square', dur: 0.018, gain: 0.07, pan, filter: 5000 });
        break;
      case 'rollover':
        this.tone({ freq: 720 * k, to: 960 * k, type: 'sine', dur: 0.09, gain: 0.18, pan });
        break;
      case 'rampEnter':
        this.noiseHit({ dur: 0.45, gain: 0.16, type: 'bandpass', freq: 300, to: 1800, q: 2, pan });
        break;
      case 'ramp':
        [0, 7, 12].forEach((n, i) => this.tone({ freq: 659 * k * Math.pow(2, n / 12), type: p.wave, dur: 0.16, gain: 0.2, at: i * 0.07, reverb: 0.35, filter: 5000 }));
        break;
      case 'scoop':
        this.noiseHit({ dur: 0.3, gain: 0.25, type: 'lowpass', freq: 1500, to: 120, pan });
        this.tone({ freq: 120, to: 50, type: 'sine', dur: 0.2, gain: 0.35, pan });
        break;
      case 'eject':
        this.tone({ freq: 90, to: 160, type: 'sine', dur: 0.08, gain: 0.35, pan });
        this.noiseHit({ dur: 0.06, gain: 0.2, type: 'lowpass', freq: 1200, pan });
        break;
      case 'launch':
        this.noiseHit({ dur: 0.18, gain: 0.3, type: 'bandpass', freq: 500, to: 2500, q: 1.2, pan: 0.8 });
        this.tone({ freq: 70, to: 160, type: 'sine', dur: 0.12, gain: 0.4, pan: 0.8 });
        break;
      case 'pullStart':
        this.tone({ freq: 140, type: 'sine', dur: 0.05, gain: 0.1, pan: 0.8 });
        break;
      case 'drain':
        this.tone({ freq: 440 * k, to: 70, type: p.wave, dur: 0.9, gain: 0.28, filter: 1800, reverb: 0.3 });
        this.tone({ freq: 330 * k, to: 55, type: 'sine', dur: 1.0, gain: 0.2, at: 0.1 });
        break;
      case 'ballsave':
        [0, 7, 12, 19].forEach((n, i) => this.tone({ freq: 523 * Math.pow(2, n / 12), type: 'triangle', dur: 0.14, gain: 0.2, at: i * 0.07, reverb: 0.3 }));
        break;
      case 'tiltWarn':
        for (let i = 0; i < 2; i++) this.tone({ freq: 110, type: 'square', dur: 0.18, gain: 0.25, at: i * 0.24, filter: 1200 });
        break;
      case 'tilt':
        this.tone({ freq: 90, type: 'sawtooth', dur: 1.4, gain: 0.32, filter: 900 });
        this.tone({ freq: 93, type: 'square', dur: 1.4, gain: 0.18, filter: 700 });
        break;
      case 'mission':
        [0, 4, 7, 12, 16].forEach((n, i) => this.tone({ freq: 523 * k * Math.pow(2, n / 12), type: p.wave, dur: 0.22, gain: 0.2, at: i * 0.08, reverb: 0.4, filter: 5000 }));
        if (p.chime) [0, 1, 2].forEach((i) => this.bell([659, 1046, 1568][i], 1.2, 0.18, i * 0.12));
        break;
      case 'rank':
        [0, 4, 7, 12].forEach((n, i) => {
          this.tone({ freq: 392 * k * Math.pow(2, n / 12), type: 'sawtooth', dur: 0.5, gain: 0.12, at: i * 0.1, filter: 2400, reverb: 0.5 });
          this.tone({ freq: 784 * k * Math.pow(2, n / 12), type: 'triangle', dur: 0.5, gain: 0.12, at: i * 0.1, reverb: 0.5 });
        });
        break;
      case 'extraball':
        [0, 4, 7, 12, 7, 12, 16, 19].forEach((n, i) => this.tone({ freq: 523 * Math.pow(2, n / 12), type: 'square', dur: 0.12, gain: 0.14, at: i * 0.07, filter: 4000, reverb: 0.3 }));
        break;
      case 'jackpot':
        this.noiseHit({ dur: 1.2, gain: 0.25, type: 'bandpass', freq: 200, to: 6000, q: 0.8, reverb: 0.5 });
        [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.tone({ freq: 262 * k * Math.pow(2, n / 12), type: p.wave === 'sine' ? 'triangle' : p.wave, dur: 0.6, gain: 0.14, at: i * 0.06, filter: 5000, reverb: 0.5 }));
        if (p.chime) [0, 1, 2, 3, 4, 5].forEach((i) => this.bell([659, 1046, 1568][i % 3], 1.2, 0.18, i * 0.1));
        break;
      case 'multiball':
        for (let r = 0; r < 3; r++) [0, 3, 7, 10, 12].forEach((n, i) => this.tone({ freq: 330 * k * Math.pow(2, (n + r * 2) / 12), type: 'sawtooth', dur: 0.12, gain: 0.1, at: r * 0.4 + i * 0.06, filter: 3500 }));
        break;
      case 'skillshot':
        for (let i = 0; i < 8; i++) this.tone({ freq: 1200 + i * 220, type: 'sine', dur: 0.12, gain: 0.12, at: i * 0.035, reverb: 0.5 });
        break;
      case 'wall':
        if (!this.gate('wall', 35)) return;
        this.noiseHit({ dur: 0.04, gain: 0.05 + sp * 0.18, type: 'lowpass', freq: 700 + sp * 1500, pan });
        break;
      case 'rubber':
        if (!this.gate('rubber', 35)) return;
        this.tone({ freq: 200, to: 120, type: 'sine', dur: 0.07, gain: 0.08 + sp * 0.15, pan });
        break;
      case 'ballball':
        if (!this.gate('ballball', 40)) return;
        this.tone({ freq: 2800, type: 'sine', dur: 0.03, gain: 0.08 + sp * 0.1, pan });
        break;
      case 'chime10':
        this.bell(1568, 0.7, 0.16, 0, pan);
        break;
      case 'chime100':
        this.bell(1046, 0.9, 0.18, 0, pan);
        break;
      case 'chime1000':
        this.bell(659, 1.2, 0.2, 0, pan);
        break;
      case 'glitch':
        for (let i = 0; i < 6; i++) this.tone({ freq: 100 + Math.random() * 2400, type: 'square', dur: 0.03, gain: 0.08, at: i * 0.03, filter: 6000 });
        break;
      case 'cutin':
        this.noiseHit({ dur: 0.5, gain: 0.3, type: 'bandpass', freq: 400, to: 5000, q: 1.5 });
        [0, 4, 7, 11, 14].forEach((n) => this.tone({ freq: 392 * Math.pow(2, n / 12), type: 'sawtooth', dur: 1.0, gain: 0.07, at: 0.25, filter: 3000, reverb: 0.6 }));
        break;
      case 'boss':
        this.noiseHit({ dur: 0.18, gain: 0.45, type: 'lowpass', freq: 3000, to: 200 });
        this.tone({ freq: 180, to: 40, type: 'square', dur: 0.25, gain: 0.3, filter: 1500 });
        break;
      case 'bossDown':
        this.noiseHit({ dur: 1.4, gain: 0.45, type: 'lowpass', freq: 4000, to: 60, reverb: 0.4 });
        this.tone({ freq: 220, to: 30, type: 'sawtooth', dur: 1.2, gain: 0.3, filter: 1200 });
        break;
      case 'alarm':
        for (let i = 0; i < 3; i++) {
          this.tone({ freq: 660, to: 880, type: 'square', dur: 0.22, gain: 0.12, at: i * 0.46, filter: 2500, curve: 'lin' });
          this.tone({ freq: 880, to: 660, type: 'square', dur: 0.22, gain: 0.12, at: i * 0.46 + 0.23, filter: 2500, curve: 'lin' });
        }
        break;
      case 'warp':
        this.tone({ freq: 200, to: 2400, type: 'sawtooth', dur: 0.5, gain: 0.12, filter: 4000, reverb: 0.4 });
        break;
      case 'kickback':
        this.tone({ freq: 60, to: 200, type: 'square', dur: 0.15, gain: 0.3, filter: 1500 });
        this.noiseHit({ dur: 0.1, gain: 0.3, type: 'lowpass', freq: 2000 });
        break;
      case 'juke':
        this.noiseHit({ dur: 0.25, gain: 0.15, type: 'bandpass', freq: 3000, q: 4 });
        this.bell(784, 0.6, 0.15, 0.05);
        break;
      case 'uiMove':
        this.tone({ freq: 1200, type: 'sine', dur: 0.04, gain: 0.08 });
        break;
      case 'uiOk':
        this.tone({ freq: 880, to: 1320, type: 'triangle', dur: 0.09, gain: 0.14 });
        break;
      case 'uiBack':
        this.tone({ freq: 660, to: 440, type: 'triangle', dur: 0.09, gain: 0.12 });
        break;
      case 'ominous':
        this.tone({ freq: 55, type: 'sawtooth', dur: 1.6, gain: 0.25, filter: 300, attack: 0.2 });
        this.tone({ freq: 58, type: 'sawtooth', dur: 1.6, gain: 0.2, filter: 300, attack: 0.2 });
        this.noiseHit({ dur: 1.2, gain: 0.1, type: 'lowpass', freq: 200, attack: 0.3 });
        break;
      case 'gameover':
        [12, 7, 3, 0].forEach((n, i) => this.tone({ freq: 262 * Math.pow(2, n / 12), type: 'triangle', dur: 0.5, gain: 0.18, at: i * 0.22, reverb: 0.5 }));
        break;
      case 'bonusTick':
        this.tone({ freq: 1400 + (o.value ?? 0) * 60, type: 'square', dur: 0.05, gain: 0.07, filter: 5000 });
        if (p.chime) this.bell(1568, 0.4, 0.08);
        break;
    }
  }

  /** 引いている間の低いうなり */
  pull(on: boolean, amount = 0): void {
    if (on) {
      if (!this.pullOsc) {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        const gain = this.ctx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain).connect(this.sfxBus);
        osc.start();
        this.pullOsc = { osc, gain };
      }
      const t = this.ctx.currentTime;
      this.pullOsc.osc.frequency.setTargetAtTime(60 + amount * 120, t, 0.03);
      this.pullOsc.gain.gain.setTargetAtTime(0.03 + amount * 0.05, t, 0.03);
    } else if (this.pullOsc) {
      const { osc, gain } = this.pullOsc;
      gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.02);
      osc.stop(this.ctx.currentTime + 0.1);
      this.pullOsc = null;
    }
  }

  /** ゲームのイベントに音を付ける */
  onGameEvent(e: GameEvent): void {
    const pan = (x: number) => Math.max(-0.8, Math.min(0.8, x / 10));
    switch (e.t) {
      case 'flip':
        this.play(e.up ? 'flipUp' : 'flipDown', { pan: e.side === 'left' ? -0.5 : 0.5 });
        break;
      case 'table': {
        const te = e.e;
        const o = { pan: pan(te.x), speed: te.speed };
        switch (te.type) {
          case 'bumper':
          case 'sling':
          case 'drop':
          case 'spinner':
          case 'rollover':
          case 'wall':
          case 'rubber':
          case 'ballball':
          case 'scoop':
          case 'launch':
          case 'kickback':
          case 'warp':
          case 'bank':
          case 'ramp':
            this.play(te.type, o);
            break;
          case 'standup':
            this.play('target', o);
            break;
          case 'ramp-enter':
            this.play('rampEnter', o);
            break;
          case 'scoop-eject':
            this.play('eject', o);
            break;
        }
        break;
      }
      case 'drain':
        this.play('drain');
        break;
      case 'ballsave':
        this.play('ballsave');
        break;
      case 'tilt-warning':
        this.play('tiltWarn');
        break;
      case 'tilt':
        this.play('tilt');
        break;
      case 'mission':
        this.play('mission');
        break;
      case 'rank':
        this.play('rank');
        break;
      case 'extraball':
        this.play('extraball');
        break;
      case 'jackpot':
        this.play('jackpot');
        break;
      case 'multiball':
        this.play('multiball');
        break;
      case 'skillshot':
        this.play('skillshot');
        break;
      case 'sfx':
        this.play(e.name);
        break;
      case 'music':
        this.music.setIntensity(e.intensity);
        break;
      case 'song':
        this.music.setSong(e.index);
        break;
      case 'gameover':
        this.play('gameover');
        break;
      case 'bonus-line':
        this.play('bonusTick', { value: e.index });
        break;
      case 'gimmick':
        if (e.phase === 'warn') this.play('alarm');
        break;
    }
  }
}
