// COMIC の音：ブラスバンド調のヒーローの曲と、殴る・割れる・どかーんの効果音
import type { KitApi, SfxPalette, SongDef, SynthApi } from '../types';

type Sfx = NonNullable<SfxPalette['custom']>[string];

const hz = (base: number, semis: number) => base * Math.pow(2, semis / 12);

/** ブラス1音（2本のノコギリ波を少しずらして重ねる） */
function brass(s: SynthApi, freq: number, dur: number, gain: number, at = 0, pan = 0): void {
  for (const d of [-7, 7]) s.tone({ freq, type: 'sawtooth', dur, gain: gain * 0.6, attack: 0.025, at, pan, filter: 2100, q: 1.2, reverb: 0.3, detune: d });
}

/** ずしんと響く打撃音 */
function thump(s: SynthApi, from: number, to: number, gain: number, dur = 0.16, pan = 0): void {
  s.tone({ freq: from, to, type: 'sine', dur, gain, pan });
  s.noiseHit({ dur: dur * 0.7, gain: gain * 0.7, type: 'lowpass', freq: 2600, to: 260, pan });
}

const custom: Record<string, Sfx> = {
  // 殴る音
  flipUp: (s, o) => {
    s.noiseHit({ dur: 0.05, gain: 0.34, type: 'lowpass', freq: 2000, pan: o.pan });
    s.tone({ freq: 180, to: 52, type: 'sine', dur: 0.1, gain: 0.5, pan: o.pan });
    s.tone({ freq: 620, to: 260, type: 'square', dur: 0.04, gain: 0.07, pan: o.pan, filter: 2400 });
  },
  // BAM!
  bumper: (s, o) => {
    const k = 0.9 + Math.random() * 0.25;
    thump(s, 160 * k, 55, 0.5, 0.17, o.pan);
    s.tone({ freq: 330 * k, to: 190 * k, type: 'sawtooth', dur: 0.12, gain: 0.16, pan: o.pan, filter: 1900, reverb: 0.15 });
    s.noiseHit({ dur: 0.05, gain: 0.25, type: 'highpass', freq: 3500, pan: o.pan });
  },
  // WHAP!
  sling: (s, o) => {
    s.noiseHit({ dur: 0.06, gain: 0.34, type: 'highpass', freq: 2200, pan: o.pan });
    s.tone({ freq: 760, to: 210, type: 'square', dur: 0.08, gain: 0.16, pan: o.pan, filter: 2600 });
  },
  // KRAK!（小さな的）
  target: (s, o) => {
    s.noiseHit({ dur: 0.06, gain: 0.32, type: 'bandpass', freq: 3200, q: 2.2, pan: o.pan });
    s.tone({ freq: 540, to: 170, type: 'triangle', dur: 0.12, gain: 0.3, pan: o.pan });
    s.bell(1320, 0.22, 0.07, 0.01, o.pan);
  },
  // 手下がやられる「ぐえっ」
  drop: (s, o) => {
    s.noiseHit({ dur: 0.14, gain: 0.34, type: 'lowpass', freq: 1500, to: 180, pan: o.pan });
    s.tone({ freq: 270, to: 80, type: 'square', dur: 0.15, gain: 0.22, pan: o.pan, filter: 1400 });
    s.tone({ freq: 210, to: 110, type: 'sawtooth', dur: 0.2, gain: 0.12, at: 0.03, pan: o.pan, filter: 800 });
  },
  // 手下を全部倒した：短いファンファーレ
  bank: (s) => {
    [0, 4, 7, 12].forEach((n, i) => brass(s, hz(392, n), 0.22, 0.17, i * 0.07));
    thump(s, 130, 45, 0.35, 0.2);
  },
  spinner: (s, o) => {
    s.tone({ freq: 1900, type: 'square', dur: 0.014, gain: 0.06, pan: o.pan, filter: 4200 });
  },
  rollover: (s, o) => {
    s.tone({ freq: 760, to: 1100, type: 'triangle', dur: 0.08, gain: 0.17, pan: o.pan });
  },
  rampEnter: (s, o) => {
    s.noiseHit({ dur: 0.5, gain: 0.17, type: 'bandpass', freq: 350, to: 2600, q: 2, pan: o.pan });
    s.tone({ freq: 160, to: 820, type: 'sawtooth', dur: 0.45, gain: 0.07, filter: 2200, pan: o.pan });
  },
  // スカイウェイ成功：ロケット発射＋ブラス
  ramp: (s, o) => {
    s.noiseHit({ dur: 0.35, gain: 0.2, type: 'highpass', freq: 2500, pan: o.pan });
    [0, 7, 12].forEach((n, i) => brass(s, hz(330, n), 0.2, 0.16, i * 0.07, o.pan));
  },
  scoop: (s, o) => {
    thump(s, 110, 38, 0.45, 0.25, o.pan);
    s.noiseHit({ dur: 0.18, gain: 0.2, type: 'bandpass', freq: 900, q: 1.5, pan: o.pan });
  },
  eject: (s, o) => {
    s.tone({ freq: 100, to: 340, type: 'square', dur: 0.09, gain: 0.3, pan: o.pan, filter: 1800 });
    s.noiseHit({ dur: 0.06, gain: 0.22, type: 'lowpass', freq: 1800, pan: o.pan });
  },
  kickback: (s) => {
    thump(s, 90, 40, 0.5, 0.18);
    s.tone({ freq: 140, to: 520, type: 'square', dur: 0.14, gain: 0.2, filter: 1800 });
  },
  // ボスに丸裸のダメージ：どごっ
  boss: (s, o) => {
    thump(s, 120, 34, 0.62, 0.22, o.pan);
    s.noiseHit({ dur: 0.14, gain: 0.35, type: 'bandpass', freq: 1700, q: 1.1, pan: o.pan });
    s.tone({ freq: 280, to: 110, type: 'sawtooth', dur: 0.26, gain: 0.2, at: 0.02, filter: 950, reverb: 0.2, pan: o.pan });
  },
  // 盾にはね返される：カァン！
  bossShield: (s, o) => {
    s.bell(520, 0.55, 0.28, 0, o.pan);
    s.bell(780, 0.35, 0.12, 0.01, o.pan);
    s.noiseHit({ dur: 0.05, gain: 0.3, type: 'highpass', freq: 4500, pan: o.pan });
    s.tone({ freq: 200, to: 90, type: 'sine', dur: 0.1, gain: 0.3, pan: o.pan });
  },
  // 盾が割れる：ガシャーン
  shield: (s) => {
    s.noiseHit({ dur: 0.35, gain: 0.3, type: 'highpass', freq: 5200, to: 2200, q: 0.8, reverb: 0.3 });
    s.tone({ freq: 2100, to: 380, type: 'sine', dur: 0.28, gain: 0.18 });
    s.bell(1568, 0.4, 0.1, 0.03);
  },
  // ボス撃破：どかーん＋しょんぼりブラス
  bossDown: (s) => {
    s.noiseHit({ dur: 1.5, gain: 0.5, type: 'lowpass', freq: 5000, to: 60, reverb: 0.5 });
    s.tone({ freq: 220, to: 28, type: 'sawtooth', dur: 1.3, gain: 0.34, filter: 1300 });
    thump(s, 150, 30, 0.7, 0.4);
    [7, 5, 3, 0].forEach((n, i) => brass(s, hz(294, n - 12), 0.42, 0.16, 0.55 + i * 0.3));
  },
  jackpot: (s) => {
    s.noiseHit({ dur: 1.0, gain: 0.22, type: 'highpass', freq: 5000, reverb: 0.5 });
    [0, 4, 7, 12, 16, 19].forEach((n, i) => brass(s, hz(262, n), 0.38, 0.17, i * 0.07));
    [0, 4, 7, 12].forEach((n) => brass(s, hz(523, n), 0.9, 0.12, 0.45));
  },
  multiball: (s) => {
    s.tone({ freq: 300, to: 1200, type: 'sawtooth', dur: 0.6, gain: 0.1, filter: 2800, reverb: 0.3 });
    [0, 0, 7, 12].forEach((n, i) => brass(s, hz(392, n), 0.24, 0.17, 0.35 + i * 0.16));
    thump(s, 140, 45, 0.5, 0.2, 0);
  },
  mission: (s) => {
    // たったった ターン！
    [0, 0, 0].forEach((n, i) => brass(s, hz(392, n), 0.1, 0.17, i * 0.11));
    brass(s, hz(392, 5), 0.55, 0.2, 0.36);
    brass(s, hz(392, 9), 0.55, 0.14, 0.36);
  },
  rank: (s) => {
    [0, 4, 7, 12].forEach((n, i) => {
      brass(s, hz(330, n), 0.3, 0.15, i * 0.1);
    });
    s.bell(1568, 0.8, 0.1, 0.4);
  },
  extraball: (s) => {
    [0, 4, 7, 12, 7, 12, 16, 19].forEach((n, i) => brass(s, hz(330, n), 0.14, 0.15, i * 0.075));
    brass(s, hz(330, 24), 0.6, 0.18, 0.62);
  },
  skillshot: (s) => {
    brass(s, hz(392, 0), 0.12, 0.17);
    brass(s, hz(392, 7), 0.5, 0.2, 0.12);
    s.noiseHit({ dur: 0.5, gain: 0.15, type: 'highpass', freq: 5500, at: 0.12, reverb: 0.4 });
  },
  // 落球：しょんぼりトロンボーン
  drain: (s) => {
    s.tone({ freq: 330, to: 150, type: 'sawtooth', dur: 0.95, gain: 0.26, filter: 1000, reverb: 0.3, detune: 8 });
    s.tone({ freq: 247, to: 110, type: 'sawtooth', dur: 1.0, gain: 0.16, at: 0.08, filter: 800, detune: -8 });
  },
};

export const comicSfx: SfxPalette = { wave: 'sawtooth', pitch: 1.0, bright: 0.75, punchy: true, custom };

// ───────── BGM ─────────

/** 1曲目：ヒーローのテーマ（行進曲風。ドラム＋チューバ＋ブラスの和音とメロディ） */
function heroKit(k: KitApi): void {
  const { t, stepDur, step, bar, hot } = k;
  // 大太鼓（1拍・3拍）とスネア
  if (k.pat('x.......x.......')) k.kick(t, 0.42, 1.1);
  if (k.pat('....x.......x...')) k.snare(t, 0.2);
  if ((hot || bar % 2 === 1) && k.pat('x.xxx.xxx.xxx.xx')) k.snare(t, 0.06);
  if (step % 2 === 0) k.hat(t, 0.028);
  // チューバのオン・パッ
  if (k.pat('x.......x.......')) k.voice(k.mtof(k.root - (step === 8 ? 5 : 0)), t, stepDur * 3, { type: 'square', gain: 0.15, filter: 620 });
  if (k.pat('..x...x...x...x.')) for (const n of k.chord) k.voice(k.mtof(n), t, stepDur * 1.4, { type: 'sawtooth', gain: 0.034, filter: 1300, filterEnv: 2.4, attack: 0.012, detune: 6 });
  // 小節の頭でブラスの和音をバーン
  if (step === 0) for (const n of k.chord) k.voice(k.mtof(n + 12), t, stepDur * (hot ? 7 : 5), { type: 'sawtooth', gain: 0.048, filter: 2100, filterEnv: 2.3, attack: 0.03, detune: 7, reverb: 0.35 });
  if (step === 0 && bar % 4 === 0) k.noise(t, 0.9, { gain: 0.07, type: 'highpass', freq: 6200, reverb: 0.4 });
  // ブラスのメロディ
  if (k.mel >= 0 && (hot || bar % 4 >= 1)) {
    k.voice(k.mtof(k.mel), t, stepDur * Math.max(1, k.melLen) * 0.95, { type: 'sawtooth', gain: 0.078, filter: 2300, filterEnv: 1.7, attack: 0.02, vibrato: 0.008, reverb: 0.32 });
    if (hot) k.voice(k.mtof(k.mel + 4), t, stepDur * Math.max(1, k.melLen) * 0.95, { type: 'sawtooth', gain: 0.04, filter: 2000, attack: 0.025, reverb: 0.3 });
  }
  if (hot && k.counter >= 0 && step % 4 === 2) k.voice(k.mtof(k.counter - 5), t, stepDur * 1.6, { type: 'square', gain: 0.03, filter: 1500, attack: 0.015, reverb: 0.25 });
}

/** 2曲目：ヒーロー・アッセンブル（ボス戦マルチボール用。速くて攻撃的） */
function assembleKit(k: KitApi): void {
  const { t, stepDur, step, bar } = k;
  if (k.pat('x...x...x...x...')) k.kick(t, 0.46, 1.2);
  if (k.pat('....x.......x...')) k.snare(t, 0.24, true);
  k.hat(t, step % 4 === 2 ? 0.05 : 0.025, step % 8 === 6);
  // 刻むベース
  if (step % 2 === 0) k.voice(k.mtof(k.root + (step % 8 === 6 ? 7 : 0)), t, stepDur * 1.7, { type: 'square', gain: 0.11, filter: 760, filterEnv: 2.2 });
  // ブラスのスタブ（ジャッ・ジャッ・ジャーン）
  if (k.pat('x..x..x...x..x..')) for (const n of k.chord) k.voice(k.mtof(n + 12), t, stepDur * 1.2, { type: 'sawtooth', gain: 0.042, filter: 2400, filterEnv: 2.2, attack: 0.012, detune: 8, reverb: 0.3 });
  if (step === 0 && bar % 2 === 0) k.noise(t, 0.7, { gain: 0.07, type: 'highpass', freq: 6000, reverb: 0.4 });
  if (k.mel >= 0) k.voice(k.mtof(k.mel + 12), t, stepDur * Math.max(1, k.melLen) * 0.9, { type: 'sawtooth', gain: 0.07, filter: 3000, filterEnv: 1.6, attack: 0.015, vibrato: 0.01, reverb: 0.3 });
  if (k.counter >= 0 && step % 2 === 0) k.voice(k.mtof(k.counter), t, stepDur * 0.9, { type: 'square', gain: 0.03, filter: 2600, reverb: 0.25 });
}

export const comicSongs: SongDef[] = [
  { name: 'HERO THEME', bpm: 120, swing: 0, root: 55, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 3, 0, 4, 5, 3, 4, 0], kit: heroKit, seed: 21 },
  { name: 'HERO ASSEMBLE', bpm: 148, swing: 0, root: 52, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 3, 4, 0, 5, 6, 4], kit: assembleKit, seed: 8 },
];
