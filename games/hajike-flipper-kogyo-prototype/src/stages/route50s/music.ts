// ROUTE 50s の音：ジュークボックスで切り替わる4曲（ロカビリー／ドゥーワップ／ブギウギ／シャッフル）と、
// 昔の電気機械式らしい効果音（ソレノイドの「カチッ」、ベル、ノッカー）。
import type { KitApi, SfxPalette, SongDef } from '../types';

/** 休み */
const R = 99;

const lead = (k: KitApi, riff: number[], base: number, o: { type?: OscillatorType; gain: number; filter: number; len?: number; vibrato?: number; reverb?: number }): void => {
  const n = riff[k.step % riff.length];
  if (n >= R) return;
  // 次の音までの長さ
  let len = 1;
  while (len < riff.length && riff[(k.step + len) % riff.length] >= R && k.step + len < riff.length) len++;
  k.voice(k.mtof(base + n), k.t, k.stepDur * Math.min(len, o.len ?? 4) * 0.92, {
    type: o.type ?? 'sawtooth',
    gain: o.gain,
    filter: o.filter,
    filterEnv: 1.8,
    attack: 0.006,
    release: 0.1,
    vibrato: o.vibrato ?? 0.006,
    reverb: o.reverb ?? 0.3,
  });
};

// ── 曲1：ロカビリー（Eのブルース進行・スウィング。ウォーキングベースとツイ〜ンとしたギター）──
const ROCKA_LICKS: number[][] = [
  [12, R, R, 9, R, 7, R, 4, 7, R, 4, R, 3, 4, R, R],
  [7, R, 9, R, 12, R, R, 9, 7, R, R, 4, R, R, R, R],
  [4, 4, R, 7, R, 9, R, 7, 4, R, 3, R, 0, R, R, R],
];
function rockabillyKit(k: KitApi): void {
  const root = k.root;
  if (k.pat('x.......x.......')) k.kick(k.t, 0.24);
  if (k.pat('....x.......x...')) k.snare(k.t, 0.13);
  if (k.step % 2 === 0) k.hat(k.t, 0.03);
  // ウォーキングベース（4分音符）
  if (k.step % 4 === 0) {
    const walk = [0, 4, 7, 9][k.step / 4];
    k.voice(k.mtof(root + walk), k.t, k.stepDur * 3.4, { type: 'triangle', gain: 0.27, filter: 700, filterEnv: 2, release: 0.08 });
    k.noise(k.t, 0.03, { gain: 0.06, type: 'bandpass', freq: 900 });
  }
  // 裏拍のカッティング
  if (k.pat('..x...x...x...x.')) for (const n of k.chord) k.voice(k.mtof(n + 12), k.t, k.stepDur * 0.8, { type: 'square', gain: 0.017, filter: 2300, release: 0.04 });
  // リードのリック（マルチボール中は毎小節、普段は小節の終わりだけ）
  const bar12 = k.bar % 12;
  if (k.hot || bar12 === 3 || bar12 === 7 || bar12 === 11) lead(k, ROCKA_LICKS[k.bar % 3], k.chord[0] + 12, { gain: 0.06, filter: 2600, vibrato: 0.004 });
}

// ── 曲2：ドゥーワップ（Gの I-vi-IV-V・12/8の三連のピアノ、ベースの「ボンボン」、コーラスのウー）──
const DOOWOP_LEAD: number[][] = [
  [4, -1, -1, 3, -1, -1, 2, -1, 3, 4, -1, -1],
  [3, -1, -1, 2, -1, -1, 1, -1, 2, 3, -1, -1],
  [3, -1, 2, 3, -1, 4, 5, -1, -1, 4, -1, 3],
  [2, -1, -1, 3, -1, -1, 4, -1, 3, 2, -1, -1],
];
function doowopKit(k: KitApi): void {
  const s = k.step % 12;
  const c = k.chord;
  const tones = [c[0], c[1], c[2], c[0] + 12, c[1] + 12, c[2] + 12];
  // 三連のピアノ（根音・3度・5度をくり返す）
  k.voice(k.mtof(c[s % 3] + 12), k.t, k.stepDur * 0.95, { type: 'triangle', gain: s % 3 === 0 ? 0.058 : 0.04, filter: 3200, release: 0.12, reverb: 0.3 });
  // ベース（ボン・ボン）
  if (s === 0 || s === 3 || s === 6 || s === 9) {
    const n = s === 6 ? k.root + 7 : k.root;
    k.voice(k.mtof(n), k.t, k.stepDur * 2.6, { type: 'sine', gain: 0.3, filter: 500, release: 0.07 });
  }
  if (s === 0) k.kick(k.t, 0.18);
  if (s === 3 || s === 9) k.brush(k.t, 0.15);
  // コーラスの「ウー」
  if (s === 0) for (const n of c) k.voice(k.mtof(n), k.t, k.stepDur * 11, { type: 'sine', gain: 0.03, attack: 0.3, release: 0.6, vibrato: 0.011, reverb: 0.7 });
  // メロディ（小節の4回に1回ずつ変わる）
  if (k.bar % 8 >= 2 || k.hot) {
    const pat = DOOWOP_LEAD[k.bar % 4];
    const idx = pat[s];
    if (idx >= 0) {
      let len = 1;
      while (s + len < 12 && pat[s + len] < 0) len++;
      k.voice(k.mtof(tones[idx] + 12), k.t, k.stepDur * len * 0.95, { type: 'triangle', gain: 0.07, attack: 0.02, release: 0.15, vibrato: 0.012, filter: 2800, reverb: 0.5 });
    }
  }
  if (k.hot && s % 3 === 1) k.hat(k.t, 0.03);
}

// ── 曲3：ソックホップ・ブギ（Aのブルース進行・速い。ブギウギのピアノのベース、ハンドクラップ、サックス）──
const BOOGIE_SAX: number[][] = [
  [7, R, 7, R, 10, R, 12, R, 10, R, 7, R, 5, R, 7, R],
  [7, R, 7, R, 10, R, 12, R, 15, R, 12, R, 10, R, R, R],
  [12, R, 10, R, 7, R, 5, R, 7, R, R, R, R, R, R, R],
  [5, R, 7, 6, 5, R, 3, R, 0, R, R, R, R, R, R, R],
];
function boogieKit(k: KitApi): void {
  const s = k.step;
  if (s % 2 === 0) {
    const w = [0, 4, 7, 9, 10, 9, 7, 4][s / 2];
    k.voice(k.mtof(k.root + 12 + w), k.t, k.stepDur * 1.7, { type: 'square', gain: 0.05, filter: 1500, release: 0.04 });
    k.voice(k.mtof(k.root + w), k.t, k.stepDur * 1.7, { type: 'triangle', gain: 0.14, filter: 700, release: 0.04 });
  }
  if (k.pat('x.......x.......')) k.kick(k.t, 0.28);
  if (k.pat('....x.......x...')) {
    k.snare(k.t, 0.18);
    k.noise(k.t, 0.07, { gain: 0.1, type: 'bandpass', freq: 1500, q: 1.2 });
  }
  if (k.step % 2 === 0) k.hat(k.t, 0.028, k.step === 14);
  // ピアノの右手（コード）
  if (k.pat('x.....x...x.....')) for (const n of k.chord) k.voice(k.mtof(n + 12), k.t, k.stepDur * 1.4, { type: 'sawtooth', gain: 0.02, filter: 2200, release: 0.06 });
  if (k.hot || k.bar % 4 >= 2) lead(k, BOOGIE_SAX[k.bar % 4], k.chord[0] + 12, { gain: 0.055, filter: 2400, vibrato: 0.01, reverb: 0.35 });
}

/** 12小節ブルースの進行（度数） */
const BLUES = [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4];

export const SONGS: SongDef[] = [
  { name: 'ROUTE 50 ROCKABILLY', bpm: 168, root: 52, scale: [0, 2, 4, 5, 7, 9, 11], chords: BLUES, kit: rockabillyKit, seed: 11, swing: 0.32 },
  { name: 'MOONLIGHT DOO-WOP', bpm: 62, root: 55, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 5, 3, 4], kit: doowopKit, seed: 22, steps: 12 },
  { name: 'SOCK HOP BOOGIE', bpm: 186, root: 57, scale: [0, 2, 4, 5, 7, 9, 11], chords: BLUES, kit: boogieKit, seed: 33, swing: 0.34 },
  { name: 'CHERRY SODA SHUFFLE', bpm: 150, root: 53, scale: [0, 2, 4, 5, 7, 9, 10], chords: [0, 0, 3, 0, 4, 3, 0, 4], kit: 'rockabilly', seed: 44, swing: 0.3 },
];

// ── 効果音（電気機械式）──
export const SFX: SfxPalette = {
  wave: 'triangle',
  pitch: 1.0,
  bright: 0.6,
  chime: true,
  custom: {
    // フリッパー：ソレノイドの「カチッ」
    flipUp: (s, o) => {
      s.noiseHit({ dur: 0.045, gain: 0.3, type: 'lowpass', freq: 1900, pan: o.pan });
      s.tone({ freq: 190, to: 62, type: 'square', dur: 0.07, gain: 0.2, filter: 900, pan: o.pan });
    },
    // ポップバンパー：機械の「ポン」とベル
    bumper: (s, o) => {
      s.tone({ freq: 300, to: 90, type: 'triangle', dur: 0.1, gain: 0.28, pan: o.pan, filter: 1800 });
      s.noiseHit({ dur: 0.03, gain: 0.2, type: 'highpass', freq: 2600, pan: o.pan });
      s.bell([1046, 1318, 1568][Math.floor(Math.random() * 3)], 0.8, 0.2, 0.005, o.pan);
    },
    // スクープ：映画館の穴に「ゴトン」
    scoop: (s, o) => {
      s.tone({ freq: 140, to: 52, type: 'triangle', dur: 0.26, gain: 0.36, pan: o.pan });
      s.noiseHit({ dur: 0.25, gain: 0.22, type: 'lowpass', freq: 1100, to: 150, pan: o.pan });
    },
    // ジュークボックス：レコード針と選曲のコイン音
    juke: (s) => {
      s.noiseHit({ dur: 0.28, gain: 0.14, type: 'bandpass', freq: 3600, to: 900, q: 3 });
      s.tone({ freq: 92, type: 'sine', dur: 0.09, gain: 0.3 });
      s.bell(1319, 0.6, 0.14, 0.06);
      s.bell(1760, 0.6, 0.12, 0.15);
    },
    // エクストラボール：昔の機械の「ノッカー」（ドン！）とベル
    extraball: (s) => {
      s.noiseHit({ dur: 0.1, gain: 0.7, type: 'lowpass', freq: 500, to: 120 });
      s.tone({ freq: 95, to: 45, type: 'sine', dur: 0.16, gain: 0.7 });
      [659, 1046, 1568].forEach((f, i) => s.bell(f, 1.0, 0.18, 0.12 + i * 0.12));
    },
  },
};
