// ANIME の音。明るくテンポの速いアニメソング調のBGMと、キラキラした専用の効果音。
import type { KitApi, SfxPalette, SongDef, SynthApi } from '../types';

// ───────── BGM ─────────

/**
 * アニメソング調の編成：四つ打ちのキック、裏打ちのハット、跳ねるベース、
 * 刻みのコードスタブ、キラキラのアルペジオ、元気なリード。
 * intense = true なら最初から盛り上がった状態（マルチボール用の曲）。
 */
function makeKit(intense: boolean) {
  return (k: KitApi): void => {
    const hot = k.hot || intense;
    const { t, step, bar, stepDur } = k;
    // ── ドラム ──
    if (step % 4 === 0) k.kick(t, 0.36, 1.1);
    if (hot && (step === 14 || (bar % 4 === 3 && step === 10))) k.kick(t, 0.3);
    if (step === 4 || step === 12) k.snare(t, 0.2);
    if (bar % 4 === 3 && step >= 12) k.snare(t, 0.1 + (step - 12) * 0.04); // 4小節目の終わりはスネアのフィル
    if (step % 4 === 2) k.hat(t, 0.06, true);
    else if (hot || step % 2 === 0) k.hat(t, 0.03);
    // ── ベース（8分でポンポン跳ねる）──
    if (step % 2 === 0) {
      const oct = step % 8 === 6 ? 12 : 0;
      k.voice(k.mtof(k.root + oct), t, stepDur * 1.5, { type: 'sawtooth', gain: 0.1, filter: 800, filterEnv: 2.6, release: 0.05 });
    }
    // ── コードスタブ（シンコペーション）──
    if (k.pat('x..x..x...x..x..') || (hot && k.pat('..x...x.........'))) {
      const len = step === 0 ? 2 : 1.1;
      for (const n of k.chord) k.voice(k.mtof(n + 12), t, stepDur * len, { type: 'sawtooth', gain: 0.03, filter: 3400, filterEnv: 1.8, detune: 7, reverb: 0.25 });
    }
    // ── キラキラのアルペジオ ──
    if (hot ? true : step % 2 === 1) {
      const n = k.chord[(step >> (hot ? 0 : 1)) % 3] + 24 + (step % 8 >= 4 ? 12 : 0);
      k.voice(k.mtof(n), t, stepDur * 0.7, { type: 'triangle', gain: hot ? 0.035 : 0.028, release: 0.1, reverb: 0.55, pan: step % 4 < 2 ? -0.4 : 0.4 });
    }
    // ── リード ──
    if (k.mel >= 0) {
      const d = stepDur * k.melLen * 0.92;
      k.voice(k.mtof(k.mel + 12), t, d, { type: 'square', gain: 0.055, filter: 4600, vibrato: 0.007, reverb: 0.3 });
      if (hot) k.voice(k.mtof(k.mel + 19), t, d, { type: 'triangle', gain: 0.04, reverb: 0.4 });
    }
    // ── 4小節ごとのきらめき ──
    if (bar % 4 === 0 && step === 0) k.voice(k.mtof(k.chord[2] + 36), t, stepDur * 8, { type: 'sine', gain: 0.03, attack: 0.02, release: 0.6, reverb: 0.8 });
  };
}

export const ANIME_SONGS: SongDef[] = [
  { name: 'SAKURA SPRINT', bpm: 172, root: 62, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 5, 3, 4], kit: makeKit(false), seed: 21 },
  { name: 'STARLIGHT BREAKER', bpm: 184, root: 57, scale: [0, 2, 3, 5, 7, 8, 10], chords: [5, 3, 4, 0], kit: makeKit(true), seed: 77 },
];

// ───────── 効果音 ─────────

const MAJOR_PENT = [0, 2, 4, 7, 9];
const hz = (semi: number) => 523.25 * Math.pow(2, semi / 12);
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
type Sfx = (s: SynthApi, o: { pan: number; speed: number }) => void;

const arp = (notes: number[], base = 0, o: { gain?: number; step?: number; dur?: number; type?: OscillatorType; reverb?: number; filter?: number } = {}): Sfx => (s, p) => {
  notes.forEach((n, i) => s.tone({ freq: hz(n + base), type: o.type ?? 'triangle', dur: o.dur ?? 0.16, gain: o.gain ?? 0.18, at: i * (o.step ?? 0.055), pan: p.pan, reverb: o.reverb ?? 0.45, filter: o.filter ?? 6000 }));
};

export const ANIME_SFX: SfxPalette = {
  wave: 'square',
  pitch: 1.2,
  bright: 0.9,
  custom: {
    // バンパー：ポン！とキラッ
    bumper: (s, o) => {
      const n = pick(MAJOR_PENT) + (Math.random() < 0.3 ? 12 : 0);
      s.tone({ freq: hz(n) * 0.5, to: hz(n), type: 'square', dur: 0.11, gain: 0.2, pan: o.pan, filter: 5200 });
      s.tone({ freq: hz(n + 12), type: 'sine', dur: 0.22, gain: 0.13, at: 0.025, pan: o.pan, reverb: 0.5 });
      s.noiseHit({ dur: 0.03, gain: 0.13, type: 'highpass', freq: 6000, pan: o.pan });
    },
    // スリング：ピョン！
    sling: (s, o) => {
      s.tone({ freq: 420, to: 1250, type: 'triangle', dur: 0.1, gain: 0.22, pan: o.pan, filter: 5000 });
      s.noiseHit({ dur: 0.05, gain: 0.2, type: 'highpass', freq: 2400, pan: o.pan });
    },
    // 星の的：キラリン
    target: arp([4, 9, 16], 12, { gain: 0.16, step: 0.045, dur: 0.18, type: 'sine', reverb: 0.55 }),
    rollover: (s, o) => {
      s.tone({ freq: hz(16), to: hz(19), type: 'sine', dur: 0.1, gain: 0.16, pan: o.pan, reverb: 0.4 });
      s.tone({ freq: hz(28), type: 'sine', dur: 0.12, gain: 0.07, at: 0.04, pan: o.pan });
    },
    spinner: (s, o) => s.tone({ freq: 2600, type: 'triangle', dur: 0.02, gain: 0.06, pan: o.pan, filter: 6000 }),
    rampEnter: (s, o) => s.noiseHit({ dur: 0.5, gain: 0.15, type: 'bandpass', freq: 500, to: 3600, q: 2.5, pan: o.pan }),
    // ランプ成功：ハープのグリッサンド
    ramp: arp([0, 4, 7, 12, 16, 19, 24], 0, { gain: 0.15, step: 0.045, dur: 0.22, type: 'triangle', reverb: 0.6 }),
    scoop: (s, o) => {
      s.noiseHit({ dur: 0.3, gain: 0.22, type: 'lowpass', freq: 2200, to: 150, pan: o.pan });
      s.tone({ freq: 220, to: 70, type: 'sine', dur: 0.25, gain: 0.3, pan: o.pan });
      s.tone({ freq: hz(24), type: 'sine', dur: 0.3, gain: 0.08, at: 0.05, reverb: 0.6 });
    },
    eject: (s, o) => {
      s.tone({ freq: 160, to: 520, type: 'square', dur: 0.1, gain: 0.2, pan: o.pan, filter: 3000 });
      s.noiseHit({ dur: 0.08, gain: 0.18, type: 'highpass', freq: 3000, pan: o.pan });
    },
    kickback: (s) => {
      s.tone({ freq: 90, to: 360, type: 'square', dur: 0.16, gain: 0.25, filter: 2500 });
      s.noiseHit({ dur: 0.12, gain: 0.25, type: 'highpass', freq: 2000 });
      arp([12, 16, 19, 24], 0, { gain: 0.1, step: 0.04 })(s, { pan: 0, speed: 40 });
    },
    // ミッション達成：ファンファーレ
    mission: arp([0, 4, 7, 12, 7, 12, 16, 19, 24], 0, { gain: 0.16, step: 0.065, dur: 0.2, type: 'square', filter: 5500, reverb: 0.5 }),
    rank: (s, o) => {
      arp([7, 12, 16, 19, 24, 28], 0, { gain: 0.14, step: 0.07, dur: 0.4, type: 'sawtooth', filter: 3600, reverb: 0.7 })(s, o);
      s.noiseHit({ dur: 0.6, gain: 0.1, type: 'bandpass', freq: 800, to: 7000, q: 1.2, reverb: 0.5 });
    },
    ballsave: arp([0, 7, 12, 16, 19], 0, { gain: 0.16, step: 0.06, dur: 0.2, type: 'triangle' }),
    extraball: arp([0, 4, 7, 12, 16, 19, 24, 28, 31], 0, { gain: 0.14, step: 0.06, dur: 0.22, type: 'square', filter: 6000 }),
    skillshot: (s, o) => {
      arp([12, 16, 19, 24, 28, 31, 36], 0, { gain: 0.12, step: 0.04, dur: 0.25, type: 'sine', reverb: 0.7 })(s, o);
      s.noiseHit({ dur: 0.4, gain: 0.12, type: 'highpass', freq: 5000, reverb: 0.5 });
    },
    // ゲージ満タン：変身のきらめき（上昇するシャワー）
    henshin: (s) => {
      for (let i = 0; i < 12; i++) s.tone({ freq: hz(12 + i * 2.5), type: i % 2 ? 'sine' : 'triangle', dur: 0.2, gain: 0.1, at: i * 0.045, pan: (i % 3) - 1 > 0 ? 0.4 : -0.4, reverb: 0.6 });
      s.noiseHit({ dur: 0.7, gain: 0.13, type: 'bandpass', freq: 600, to: 8000, q: 1.5, reverb: 0.4 });
    },
    // 必殺技カットイン：ためて、どーん
    cutin: (s) => {
      s.noiseHit({ dur: 0.55, gain: 0.3, type: 'bandpass', freq: 300, to: 6000, q: 1.6 });
      s.tone({ freq: 70, to: 40, type: 'sine', dur: 0.7, gain: 0.4, at: 0.45 });
      [0, 4, 7, 12, 16].forEach((n) => s.tone({ freq: hz(n - 12), type: 'sawtooth', dur: 1.1, gain: 0.07, at: 0.45, filter: 3400, reverb: 0.6 }));
      [12, 16, 19, 24].forEach((n, i) => s.tone({ freq: hz(n), type: 'square', dur: 0.14, gain: 0.1, at: 0.45 + i * 0.07, filter: 5000 }));
      s.noiseHit({ dur: 0.35, gain: 0.3, type: 'lowpass', freq: 3000, to: 200, at: 0.45, reverb: 0.5 });
    },
    multiball: (s) => {
      for (let r = 0; r < 3; r++) [0, 4, 7, 12, 16].forEach((n, i) => s.tone({ freq: hz(n + r * 2), type: 'square', dur: 0.1, gain: 0.09, at: r * 0.32 + i * 0.05, filter: 5200, reverb: 0.3 }));
      s.noiseHit({ dur: 0.9, gain: 0.14, type: 'bandpass', freq: 400, to: 7000, q: 1.2, reverb: 0.4 });
    },
    jackpot: (s) => {
      s.noiseHit({ dur: 1.0, gain: 0.22, type: 'bandpass', freq: 300, to: 8000, q: 0.9, reverb: 0.5 });
      [0, 4, 7, 12, 16, 19, 24, 28].forEach((n, i) => s.tone({ freq: hz(n - 12), type: 'square', dur: 0.4, gain: 0.1, at: i * 0.055, filter: 5600, reverb: 0.5 }));
      [12, 19, 24, 31].forEach((n, i) => s.tone({ freq: hz(n), type: 'sine', dur: 0.6, gain: 0.1, at: 0.4 + i * 0.07, reverb: 0.7 }));
    },
    // コンボ：続けるほど高く
    combo2: arp([12, 16], 0, { gain: 0.14, step: 0.05, dur: 0.14, type: 'square', filter: 5200 }),
    combo3: arp([14, 18, 21], 0, { gain: 0.14, step: 0.05, dur: 0.14, type: 'square', filter: 5200 }),
    combo4: arp([16, 19, 23, 28], 0, { gain: 0.14, step: 0.05, dur: 0.15, type: 'square', filter: 5400 }),
    combo5: arp([19, 23, 26, 31, 35], 0, { gain: 0.15, step: 0.05, dur: 0.18, type: 'square', filter: 5600, reverb: 0.5 }),
  },
};
