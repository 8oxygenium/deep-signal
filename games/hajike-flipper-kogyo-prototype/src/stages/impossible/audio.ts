// IMPOSSIBLE の音。混沌とした警報っぽい曲（7/8拍子）と、笑える専用の効果音。
import type { KitApi, SfxPalette, SynthApi } from '../types';

type Sfx = NonNullable<SfxPalette['custom']>;

/** 曲：14ステップ（7/8拍子）。キックが躓き、サイレンが鳴り、ところどころ音が外れる */
export function impossibleKit(k: KitApi): void {
  const { step, bar, t, stepDur, hot } = k;
  const r = Math.random;
  // ドラム：つまずくキックと、ずれたスネア、カランと鳴るガラクタ
  if (k.pat('x..x..x.x..x..')) k.kick(t, 0.42, 1.25);
  if (k.pat('....x......x.x')) k.snare(t, 0.2);
  if (r() < (hot ? 0.6 : 0.3)) k.hat(t, 0.04, r() < 0.1);
  if (k.pat('..x...x...x..x')) k.noise(t, 0.05, { gain: 0.05, type: 'bandpass', freq: 3200 + r() * 800, q: 6, reverb: 0.2 });
  // ベース：ルートを小刻みに。4小節ごとに半音でずるずる落ちる
  if (step % 2 === 0) {
    const slide = bar % 4 === 3 ? (step < 7 ? 1 : 6) : 0;
    k.voice(k.mtof(k.root + slide), t, stepDur * 1.3, { type: 'square', gain: 0.09, filter: 900, filterEnv: 3 });
  }
  // 警報サイレン（2小節に1回、2音を交互に）
  if (bar % 2 === 1 && (step === 0 || step === 3 || step === 7 || step === 10)) {
    const hi = step === 0 || step === 7;
    k.voice(k.mtof(k.chord[0] + (hi ? 36 : 31)), t, stepDur * 2.6, { type: 'square', gain: 0.028, filter: 2800, glideFrom: k.mtof(k.chord[0] + (hi ? 33 : 36)), reverb: 0.3 });
  }
  // 壊れかけのオルゴールのメロディ（ときどき半音ずれる）
  if (k.mel >= 0 && (hot || bar % 2 === 0)) {
    k.voice(k.mtof(k.mel + 12 + (r() < 0.12 ? 1 : 0)), t, stepDur * Math.max(1, k.melLen), { type: 'triangle', gain: 0.065, vibrato: 0.025, reverb: 0.45, release: 0.12 });
  }
  if (hot && k.counter >= 0) k.voice(k.mtof(k.counter + 12), t, stepDur, { type: 'square', gain: 0.03, filter: 3200, reverb: 0.3 });
  // 不穏なコード
  if (k.pat('x.....x...x...')) for (const n of [k.chord[0], k.chord[0] + 1, k.chord[0] + 6]) k.voice(k.mtof(n), t, stepDur * 0.9, { type: 'sawtooth', gain: 0.028, filter: 2000 });
  // 4小節ごとに、すべり落ちる悲鳴
  if (step === 0 && bar % 4 === 3) k.voice(k.mtof(k.chord[0] + 12), t, stepDur * 8, { type: 'sawtooth', gain: 0.04, glideFrom: k.mtof(k.chord[0] + 31), filter: 3000, vibrato: 0.05, reverb: 0.4 });
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export const impossibleSfx: Sfx = {
  // 予告の警報（ブザー）
  alarm: (s: SynthApi) => {
    for (let i = 0; i < 3; i++) {
      s.tone({ freq: 540, type: 'sawtooth', dur: 0.2, gain: 0.15, at: i * 0.44, filter: 2400 });
      s.tone({ freq: 360, type: 'sawtooth', dur: 0.2, gain: 0.15, at: i * 0.44 + 0.22, filter: 2400 });
      s.noiseHit({ dur: 0.38, gain: 0.05, type: 'bandpass', freq: 1800, at: i * 0.44 });
    }
  },
  // 発動の「ガッシャーン」
  crash: (s) => {
    s.noiseHit({ dur: 0.7, gain: 0.4, type: 'lowpass', freq: 5000, to: 200, reverb: 0.4 });
    s.tone({ freq: 160, to: 40, type: 'sawtooth', dur: 0.5, gain: 0.3, filter: 900 });
    s.bell(330, 0.5, 0.12, 0.02);
  },
  // 金属の軋み
  creak: (s) => {
    for (let i = 0; i < 7; i++) s.tone({ freq: rnd(120, 200), to: rnd(80, 160), type: 'sawtooth', dur: 0.11, gain: 0.07, at: i * 0.075, filter: 650, q: 6 });
    s.noiseHit({ dur: 0.6, gain: 0.07, type: 'bandpass', freq: 900, to: 1500, q: 9 });
    s.tone({ freq: 55, to: 40, type: 'sine', dur: 0.7, gain: 0.25 });
  },
  // ボヨ〜ン
  boing: (s) => {
    s.tone({ freq: 140, to: 620, type: 'sine', dur: 0.14, gain: 0.35 });
    s.tone({ freq: 620, to: 170, type: 'sine', dur: 0.32, gain: 0.35, at: 0.14 });
    s.tone({ freq: 280, to: 1240, type: 'triangle', dur: 0.14, gain: 0.1 });
  },
  // ヒューッと縮む／のびる（スライドホイッスル）
  shrink: (s) => {
    s.tone({ freq: 1500, to: 260, type: 'sine', dur: 0.45, gain: 0.25, reverb: 0.3 });
    s.tone({ freq: 3000, to: 520, type: 'triangle', dur: 0.45, gain: 0.05 });
  },
  grow: (s) => {
    s.tone({ freq: 220, to: 1500, type: 'sine', dur: 0.5, gain: 0.25, reverb: 0.3 });
    s.tone({ freq: 440, to: 3000, type: 'triangle', dur: 0.5, gain: 0.05 });
    s.noiseHit({ dur: 0.1, gain: 0.2, type: 'lowpass', freq: 800, at: 0.5 });
  },
  // 重力が逆さまになるヒュー
  whoosh: (s) => {
    s.noiseHit({ dur: 0.9, gain: 0.3, type: 'bandpass', freq: 200, to: 3500, q: 1.2, reverb: 0.4 });
    s.tone({ freq: 140, to: 700, type: 'sine', dur: 0.8, gain: 0.25 });
  },
  // 電源が落ちる
  powerdown: (s) => {
    s.tone({ freq: 700, to: 28, type: 'sawtooth', dur: 1.1, gain: 0.25, filter: 1600 });
    s.noiseHit({ dur: 0.08, gain: 0.35, type: 'highpass', freq: 3000 });
    s.noiseHit({ dur: 0.08, gain: 0.3, type: 'highpass', freq: 2500, at: 1.1 });
  },
  clank: (s) => {
    s.bell(310, 0.5, 0.16);
    s.bell(467, 0.4, 0.1, 0.06);
    s.noiseHit({ dur: 0.12, gain: 0.25, type: 'highpass', freq: 2500 });
  },
  rumble: (s) => {
    s.noiseHit({ dur: 1.4, gain: 0.5, type: 'lowpass', freq: 160, q: 0.8 });
    s.tone({ freq: 48, to: 30, type: 'sine', dur: 1.4, gain: 0.45 });
  },
  thud: (s) => {
    s.tone({ freq: 130, to: 34, type: 'sine', dur: 0.28, gain: 0.55 });
    s.noiseHit({ dur: 0.14, gain: 0.3, type: 'lowpass', freq: 700 });
  },

  // 落球：ずっこけ（悲しいトロンボーン）
  drain: (s) => {
    const notes = [233, 220, 208, 196];
    notes.forEach((f, i) => {
      const last = i === notes.length - 1;
      const at = i * 0.28;
      const dur = last ? 1.1 : 0.26;
      s.tone({ freq: f, to: last ? f * 0.72 : undefined, type: 'sawtooth', dur, gain: 0.2, at, filter: 800, detune: 8, curve: 'lin' });
      s.tone({ freq: f * 2, to: last ? f * 1.44 : undefined, type: 'square', dur, gain: 0.04, at, filter: 1200, curve: 'lin' });
    });
  },
  ballsave: (s) => {
    [0, 12, 7, 19].forEach((n, i) => s.tone({ freq: 660 * Math.pow(2, n / 12), type: 'triangle', dur: 0.1, gain: 0.2, at: i * 0.06, reverb: 0.3 }));
    s.tone({ freq: 200, to: 900, type: 'sine', dur: 0.3, gain: 0.15, at: 0.3 });
  },

  // 部品の音（ガラクタっぽく）
  bumper: (s, o) => {
    s.tone({ freq: 190, to: 520, type: 'sine', dur: 0.06, gain: 0.35, pan: o.pan });
    s.tone({ freq: 520, to: 170, type: 'sine', dur: 0.14, gain: 0.35, at: 0.06, pan: o.pan });
    s.noiseHit({ dur: 0.04, gain: 0.2, type: 'highpass', freq: 3000, pan: o.pan });
  },
  sling: (s, o) => {
    s.noiseHit({ dur: 0.09, gain: 0.35, type: 'highpass', freq: 1500, pan: o.pan });
    s.tone({ freq: 430, to: 150, type: 'sawtooth', dur: 0.09, gain: 0.22, filter: 2200, pan: o.pan });
    s.bell(520, 0.25, 0.06, 0, o.pan);
  },
  flipUp: (s, o) => {
    s.noiseHit({ dur: 0.07, gain: 0.3, type: 'lowpass', freq: 900, pan: o.pan });
    s.tone({ freq: 120, to: 50, type: 'square', dur: 0.1, gain: 0.35, filter: 700, pan: o.pan });
    s.tone({ freq: 1500, to: 900, type: 'square', dur: 0.025, gain: 0.05, at: 0.05, pan: o.pan });
  },
  drop: (s, o) => {
    for (let i = 0; i < 4; i++) s.noiseHit({ dur: 0.05, gain: 0.2, type: 'bandpass', freq: rnd(700, 2200), at: i * 0.035, pan: o.pan });
    s.tone({ freq: 200, to: 70, type: 'triangle', dur: 0.14, gain: 0.3, pan: o.pan });
  },
  wall: (s, o) => {
    const sp = Math.min(1, o.speed / 80);
    s.tone({ freq: 300, to: 190, type: 'triangle', dur: 0.05, gain: 0.04 + sp * 0.12, pan: o.pan });
    s.noiseHit({ dur: 0.03, gain: 0.03 + sp * 0.07, type: 'bandpass', freq: 1800, pan: o.pan });
  },

  // ファンファーレ（わざと音程が外れている）
  jackpot: (s) => {
    [0, 0, 0, 4, 7, 12].forEach((n, i) => {
      const at = i * 0.12;
      s.tone({ freq: 523 * Math.pow(2, n / 12), type: 'square', dur: i === 5 ? 0.9 : 0.1, gain: 0.14, at, filter: 3500, detune: 38, reverb: 0.4 });
      s.tone({ freq: 523 * Math.pow(2, (n - 12) / 12), type: 'sawtooth', dur: i === 5 ? 0.9 : 0.1, gain: 0.08, at, filter: 1500, detune: -22 });
    });
    s.noiseHit({ dur: 1.2, gain: 0.2, type: 'highpass', freq: 5000, at: 0.72, reverb: 0.5 });
  },
  mission: (s) => {
    [0, 4, 7, 12].forEach((n, i) => s.tone({ freq: 440 * Math.pow(2, n / 12), type: 'square', dur: 0.12, gain: 0.13, at: i * 0.09, filter: 3000, detune: 26, reverb: 0.3 }));
  },
  rank: (s) => {
    [0, 5, 9].forEach((n, i) => s.tone({ freq: 392 * Math.pow(2, n / 12), type: 'sawtooth', dur: 0.22, gain: 0.12, at: i * 0.14, filter: 1800, detune: 30, reverb: 0.4 }));
    s.tone({ freq: 784, to: 600, type: 'square', dur: 0.4, gain: 0.07, at: 0.42 });
  },
  extraball: (s) => {
    [0, 4, 7, 12, 7, 12, 16, 19].forEach((n, i) => s.tone({ freq: 523 * Math.pow(2, n / 12), type: 'square', dur: 0.1, gain: 0.13, at: i * 0.07, filter: 3500, detune: 20, reverb: 0.3 }));
  },
  multiball: (s) => {
    for (let i = 0; i < 4; i++) {
      s.tone({ freq: 500, to: 1100, type: 'square', dur: 0.2, gain: 0.12, at: i * 0.42, filter: 2600, curve: 'lin' });
      s.tone({ freq: 1100, to: 500, type: 'square', dur: 0.2, gain: 0.12, at: i * 0.42 + 0.21, filter: 2600, curve: 'lin' });
    }
    s.noiseHit({ dur: 1.6, gain: 0.15, type: 'bandpass', freq: 300, to: 4000, q: 1 });
  },
};
