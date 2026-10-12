// CYBER の音：シンセウェイブのBGM（専用編成）＋電子音・グリッチ音の効果音。すべて Web Audio で合成。
import type { KitApi, KitFn, MusicDef, SfxPalette, SynthApi } from '../types';

/**
 * シンセウェイブ編成。variant 0 = 通常（NEON GRID）、1 = マルチボール用（ZERO DAY：速くて攻撃的）。
 * ・4つ打ちキック＋クラップ ・うねるベース ・デチューンしたパッド ・ゲートのかかったアルペジオ ・リード
 * ・4小節ごとの最後にグリッチのスタッター
 */
function synthKit(variant: 0 | 1): KitFn {
  const bassPat = variant === 0 ? 'x.xxx.xxx.xxx.xx' : 'xxx.xxx.xxx.xxx.';
  return (k: KitApi) => {
    const { t, stepDur: sd, step, bar, hot, chord, root } = k;
    const last = bar % 4 === 3;

    // ドラム
    if (k.pat('x...x...x...x...')) k.kick(t, 0.44, 1.0);
    if (variant === 1 && k.pat('..x...x...x...xx')) k.kick(t, 0.2, 0.8);
    if (k.pat('....x.......x...')) k.snare(t, 0.25, true);
    if (hot && last && step >= 8 && step % 2 === 0) k.snare(t, 0.1 + (step - 8) * 0.012, false);
    k.hat(t, step % 4 === 2 ? 0.05 : 0.016, step % 4 === 2);

    // ベース（16分で転がる）
    if (bassPat[step % 16] === 'x') {
      const up = step % 4 === 3 ? 12 : step % 8 === 6 ? 7 : 0;
      k.voice(k.mtof(root + up), t, sd * 0.85, { type: 'sawtooth', gain: 0.07, filter: 460 + (hot ? 520 : 0), filterEnv: 3, release: 0.03 });
    }

    // パッド（小節の頭）
    if (step === 0) {
      for (const n of chord) k.voice(k.mtof(n), t, sd * 16, { type: 'sawtooth', gain: 0.026, attack: 0.35, release: 0.55, filter: 1400, detune: 14, reverb: 0.7 });
    }

    // アルペジオ（ゲート）
    const arpOn = hot || bar % 2 === 1;
    if (arpOn && (variant === 1 || step % 2 === 0 || hot)) {
      const note = chord[step % 3] + 12 * (1 + (Math.floor(step / 3) % 2));
      k.voice(k.mtof(note), t, sd * 0.62, { type: 'square', gain: 0.02, filter: 3200, filterEnv: 2.2, release: 0.04, pan: step % 2 ? 0.4 : -0.4, reverb: 0.3 });
    }

    // リード
    if (k.mel >= 0 && (hot || bar % 4 >= 2)) {
      k.voice(k.mtof(k.mel + 12), t, sd * Math.max(1, k.melLen), { type: 'sawtooth', gain: 0.05, filter: 2800, filterEnv: 1.3, vibrato: 0.007, detune: 8, reverb: 0.55 });
    }
    if (hot && k.counter >= 0 && step % 4 === 0) {
      k.voice(k.mtof(k.counter + 24), t, sd * 1.5, { type: 'triangle', gain: 0.03, reverb: 0.5 });
    }

    // グリッチ（4小節の最後の拍：高い帯域のスタッター）
    if (last && step >= 12) {
      k.noise(t, 0.035, { gain: 0.05 + (step - 12) * 0.012, type: 'bandpass', freq: 1200 + ((step * 977) % 4200), q: 4, reverb: 0.1 });
      if (step % 2 === 1) k.voice(k.mtof(chord[0] + 36 + (step % 3) * 2), t, sd * 0.4, { type: 'square', gain: 0.018, filter: 5000 });
    }
  };
}

export const MUSIC: MusicDef = {
  songs: [
    { name: 'NEON GRID', bpm: 104, root: 57, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 2, 6], kit: synthKit(0), seed: 51 },
    { name: 'ZERO DAY', bpm: 126, root: 52, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 0, 5, 6, 0, 3, 5, 6], kit: synthKit(1), seed: 77 },
  ],
};

const tone = (s: SynthApi, o: Parameters<SynthApi['tone']>[0]) => s.tone(o);

/** 効果音：電子音とグリッチ音で、ステージ専用に作る */
export const SFX: SfxPalette = {
  wave: 'sawtooth',
  pitch: 0.9,
  bright: 0.9,
  glitch: true,
  custom: {
    // ポップバンパー：ビームが弾ける音
    bumper: (s, o) => {
      tone(s, { freq: 1100, to: 170, type: 'sawtooth', dur: 0.13, gain: 0.22, filter: 3600, pan: o.pan });
      tone(s, { freq: 2200, to: 700, type: 'square', dur: 0.05, gain: 0.07, pan: o.pan, at: 0.01 });
      s.noiseHit({ dur: 0.04, gain: 0.14, type: 'highpass', freq: 4500, pan: o.pan });
    },
    sling: (s, o) => {
      tone(s, { freq: 1500, to: 280, type: 'square', dur: 0.07, gain: 0.14, filter: 3500, pan: o.pan });
      s.noiseHit({ dur: 0.05, gain: 0.22, type: 'highpass', freq: 2400, pan: o.pan });
    },
    // スタンドアップ：二連のビープ
    target: (s, o) => {
      tone(s, { freq: 1320, type: 'square', dur: 0.05, gain: 0.1, pan: o.pan, filter: 4500 });
      tone(s, { freq: 1980, type: 'square', dur: 0.08, gain: 0.09, at: 0.05, pan: o.pan, filter: 4500, reverb: 0.3 });
    },
    // ドロップ：データが落ちる
    drop: (s, o) => {
      tone(s, { freq: 520, to: 90, type: 'sawtooth', dur: 0.14, gain: 0.2, filter: 1800, pan: o.pan });
      s.noiseHit({ dur: 0.06, gain: 0.18, type: 'bandpass', freq: 2200, q: 2, pan: o.pan });
    },
    bank: (s) => {
      [0, 3, 7, 10, 12, 15].forEach((n, i) => tone(s, { freq: 440 * Math.pow(2, n / 12), type: 'square', dur: 0.09, gain: 0.11, at: i * 0.045, filter: 4200, reverb: 0.4 }));
    },
    spinner: (s, o) => {
      tone(s, { freq: 3400, to: 2600, type: 'square', dur: 0.016, gain: 0.05, pan: o.pan, filter: 6000 });
    },
    rollover: (s, o) => {
      tone(s, { freq: 740, to: 1180, type: 'triangle', dur: 0.07, gain: 0.16, pan: o.pan });
      tone(s, { freq: 2960, type: 'square', dur: 0.02, gain: 0.04, at: 0.04, pan: o.pan });
    },
    // ワープ：吸い込まれて、遠くで出る
    warp: (s, o) => {
      tone(s, { freq: 140, to: 2800, type: 'sawtooth', dur: 0.55, gain: 0.13, filter: 4500, reverb: 0.45, pan: o.pan, curve: 'exp' });
      tone(s, { freq: 146, to: 2950, type: 'square', dur: 0.55, gain: 0.05, filter: 4000, pan: -o.pan });
      s.noiseHit({ dur: 0.55, gain: 0.12, type: 'bandpass', freq: 300, to: 5000, q: 2, pan: o.pan });
      [0.5, 0.56, 0.62].forEach((a, i) => tone(s, { freq: 1800 + i * 640, type: 'square', dur: 0.03, gain: 0.05, at: a }));
    },
    scoop: (s, o) => {
      tone(s, { freq: 220, to: 55, type: 'sine', dur: 0.26, gain: 0.34, pan: o.pan });
      s.noiseHit({ dur: 0.25, gain: 0.2, type: 'lowpass', freq: 2200, to: 150, pan: o.pan });
      tone(s, { freq: 880, to: 440, type: 'square', dur: 0.08, gain: 0.06, at: 0.02, pan: o.pan });
    },
    eject: (s, o) => {
      tone(s, { freq: 120, to: 420, type: 'square', dur: 0.09, gain: 0.2, filter: 2200, pan: o.pan });
      s.noiseHit({ dur: 0.06, gain: 0.18, type: 'bandpass', freq: 1800, pan: o.pan });
    },
    kickback: (s) => {
      tone(s, { freq: 70, to: 260, type: 'sawtooth', dur: 0.16, gain: 0.28, filter: 1800 });
      s.noiseHit({ dur: 0.1, gain: 0.26, type: 'lowpass', freq: 2600 });
    },
    // ハッキングのノード通過・成功・ファイアウォール復旧・ROOT
    node: (s) => {
      tone(s, { freq: 660, type: 'square', dur: 0.07, gain: 0.12, filter: 4000 });
      tone(s, { freq: 990, type: 'square', dur: 0.09, gain: 0.12, at: 0.07, filter: 4000, reverb: 0.3 });
      tone(s, { freq: 1320, type: 'square', dur: 0.12, gain: 0.1, at: 0.14, filter: 4000, reverb: 0.4 });
    },
    hackDone: (s) => {
      s.noiseHit({ dur: 0.9, gain: 0.22, type: 'bandpass', freq: 200, to: 7000, q: 1, reverb: 0.4 });
      [0, 7, 12, 15, 19, 24, 27, 31].forEach((n, i) => tone(s, { freq: 220 * Math.pow(2, n / 12), type: 'sawtooth', dur: 0.2, gain: 0.1, at: i * 0.06, filter: 4200, reverb: 0.5, detune: 9 }));
      for (let i = 0; i < 6; i++) tone(s, { freq: 300 + ((i * 937) % 2400), type: 'square', dur: 0.03, gain: 0.07, at: 0.5 + i * 0.035 });
      tone(s, { freq: 55, to: 28, type: 'sine', dur: 0.8, gain: 0.4, at: 0.45 });
    },
    fwUp: (s) => {
      tone(s, { freq: 1200, to: 120, type: 'sawtooth', dur: 0.45, gain: 0.14, filter: 3000 });
      s.noiseHit({ dur: 0.2, gain: 0.14, type: 'bandpass', freq: 3500, to: 400, q: 2 });
    },
    rootIn: (s) => {
      tone(s, { freq: 60, to: 520, type: 'sawtooth', dur: 0.45, gain: 0.18, filter: 2500, reverb: 0.4 });
      tone(s, { freq: 62, to: 540, type: 'square', dur: 0.45, gain: 0.07, filter: 2000 });
      [0, 4, 7, 12, 16].forEach((n, i) => tone(s, { freq: 523 * Math.pow(2, n / 12), type: 'square', dur: 0.1, gain: 0.09, at: 0.35 + i * 0.05, filter: 4500, reverb: 0.4 }));
    },
    lowg: (s) => {
      tone(s, { freq: 880, to: 110, type: 'sine', dur: 0.9, gain: 0.2, reverb: 0.6 });
      tone(s, { freq: 1320, to: 165, type: 'triangle', dur: 0.9, gain: 0.1, reverb: 0.6, at: 0.05 });
    },
    overclock: (s) => {
      for (let i = 0; i < 8; i++) tone(s, { freq: 330 * Math.pow(2, i / 12 * 2), type: 'square', dur: 0.05, gain: 0.08, at: i * 0.04, filter: 4500 });
    },
    mission: (s) => {
      [0, 3, 7, 12, 15, 19].forEach((n, i) => tone(s, { freq: 392 * Math.pow(2, n / 12), type: 'sawtooth', dur: 0.2, gain: 0.11, at: i * 0.07, filter: 4500, reverb: 0.45, detune: 8 }));
    },
    rank: (s) => {
      [0, 7, 12, 19].forEach((n, i) => {
        tone(s, { freq: 330 * Math.pow(2, n / 12), type: 'sawtooth', dur: 0.55, gain: 0.1, at: i * 0.1, filter: 2600, reverb: 0.6, detune: 10 });
        tone(s, { freq: 660 * Math.pow(2, n / 12), type: 'square', dur: 0.3, gain: 0.04, at: i * 0.1, reverb: 0.5 });
      });
    },
    jackpot: (s) => {
      s.noiseHit({ dur: 1.1, gain: 0.26, type: 'bandpass', freq: 160, to: 7000, q: 0.8, reverb: 0.5 });
      [0, 4, 7, 12, 16, 19, 24, 28].forEach((n, i) => tone(s, { freq: 262 * Math.pow(2, n / 12), type: 'sawtooth', dur: 0.5, gain: 0.1, at: 0.15 + i * 0.06, filter: 5000, reverb: 0.55, detune: 12 }));
      for (let i = 0; i < 8; i++) tone(s, { freq: 400 + ((i * 1237) % 3000), type: 'square', dur: 0.03, gain: 0.07, at: 0.7 + i * 0.03 });
    },
    multiball: (s) => {
      for (let r = 0; r < 3; r++) [0, 3, 7, 10, 12, 15].forEach((n, i) => tone(s, { freq: 220 * Math.pow(2, (n + r * 3) / 12), type: 'sawtooth', dur: 0.1, gain: 0.09, at: r * 0.36 + i * 0.05, filter: 3800, detune: 10 }));
      s.noiseHit({ dur: 0.9, gain: 0.15, type: 'bandpass', freq: 300, to: 6000, q: 1.5, at: 0.2 });
    },
    glitch: (s) => {
      for (let i = 0; i < 7; i++) tone(s, { freq: 90 + ((i * 1511) % 2600), type: i % 2 ? 'square' : 'sawtooth', dur: 0.03, gain: 0.08, at: i * 0.028, filter: 6000 });
    },
    extraball: (s) => {
      [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((n, i) => tone(s, { freq: 440 * Math.pow(2, n / 12), type: 'square', dur: 0.1, gain: 0.1, at: i * 0.065, filter: 4500, reverb: 0.4 }));
    },
    skillshot: (s) => {
      for (let i = 0; i < 9; i++) tone(s, { freq: 900 + i * 260, type: 'square', dur: 0.06, gain: 0.07, at: i * 0.03, filter: 5000, reverb: 0.4 });
    },
  },
};
