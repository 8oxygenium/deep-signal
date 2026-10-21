// UKIYO-E の音：三味線（撥の当たり＋速い減衰）、尺八（息のノイズ＋ゆれる正弦波）、太鼓（下がる胴鳴り＋皮のノイズ）、
// 拍子木（硬い木の打音）、鐘・鈴。BGM は和音階（都節 [0,1,5,7,8] と陽音階 [0,2,5,7,9]）の自作編成。
import type { KitApi, SfxPalette, SongDef, SynthApi } from '../types';

type Sfx = NonNullable<SfxPalette['custom']>[string];

const hz = (base: number, semis: number) => base * Math.pow(2, semis / 12);
/** 都節（みやこぶし）の音（半音の数） */
const MIYAKO = [0, 1, 5, 7, 8, 12, 13, 17, 19, 20];
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

// ───────── 楽器（効果音用）─────────

/** 太鼓：低い胴鳴り（音程が下がる）＋皮を打つ音 */
function taiko(s: SynthApi, pan = 0, power = 1, at = 0): void {
  s.tone({ freq: 168, to: 54, type: 'sine', dur: 0.34 * power + 0.08, gain: 0.55 * power, at, pan });
  s.tone({ freq: 250, to: 96, type: 'triangle', dur: 0.14, gain: 0.2 * power, at, pan, filter: 1400 });
  s.noiseHit({ dur: 0.06, gain: 0.34 * power, type: 'bandpass', freq: 1900, q: 0.9, at, pan });
  s.noiseHit({ dur: 0.22, gain: 0.16 * power, type: 'lowpass', freq: 520, to: 140, at, pan, reverb: 0.15 });
}

/** 三味線：撥が皮を打つ音 → 速く減衰する明るい弦（さわりの倍音つき） */
function shamisen(s: SynthApi, f: number, at = 0, pan = 0, gain = 0.2, len = 0.5): void {
  s.noiseHit({ dur: 0.04, gain: gain * 1.5, type: 'bandpass', freq: 3000, q: 0.9, at, pan });
  s.tone({ freq: f * 1.012, to: f, type: 'sawtooth', dur: len, gain, attack: 0.002, at, pan, filter: 3600, q: 2.2, reverb: 0.2 });
  s.tone({ freq: f * 2.01, type: 'triangle', dur: len * 0.4, gain: gain * 0.5, attack: 0.002, at, pan, filter: 5200 });
  s.tone({ freq: f * 1.004, type: 'square', dur: len * 0.55, gain: gain * 0.2, attack: 0.002, at, pan, filter: 2300 });
}

/** 尺八：息のノイズ＋ゆれる音（わずかに離した2本でうなりを作る） */
function shakuhachi(s: SynthApi, f: number, dur: number, gain = 0.14, at = 0, pan = 0): void {
  for (const d of [-9, 9]) s.tone({ freq: f, type: 'sine', dur, gain: gain * 0.7, attack: 0.07, at, pan, detune: d, filter: 2600, reverb: 0.45 });
  s.tone({ freq: f * 2, type: 'sine', dur: dur * 0.8, gain: gain * 0.1, attack: 0.1, at, pan, reverb: 0.4 });
  s.noiseHit({ dur, gain: gain * 0.55, type: 'bandpass', freq: f * 2.6, q: 3.2, at, pan, attack: 0.09, reverb: 0.35 });
}

/** 拍子木：硬い木の「カッ」 */
function clack(s: SynthApi, at = 0, gain = 0.4, pan = 0, pitch = 1): void {
  s.noiseHit({ dur: 0.035, gain: gain * 1.1, type: 'bandpass', freq: 1900 * pitch, q: 2.6, at, pan });
  s.tone({ freq: 1180 * pitch, to: 880 * pitch, type: 'sine', dur: 0.06, gain: gain * 0.8, at, pan });
  s.tone({ freq: 2350 * pitch, to: 1700 * pitch, type: 'triangle', dur: 0.035, gain: gain * 0.4, at, pan });
}

/** 鈴（高い小さな金属） */
function suzu(s: SynthApi, at = 0, gain = 0.12, pan = 0): void {
  for (const [f, k] of [[2093, 1], [2637, 0.7], [3136, 0.5]] as [number, number][]) s.bell(f, 0.5, gain * k, at, pan);
}

const custom: Record<string, Sfx> = {
  // フリッパー：撥で打つ「コッ」
  flipUp: (s, o) => {
    s.noiseHit({ dur: 0.05, gain: 0.3, type: 'lowpass', freq: 1700, pan: o.pan });
    s.tone({ freq: 170, to: 58, type: 'sine', dur: 0.1, gain: 0.5, pan: o.pan });
    s.tone({ freq: 940, to: 520, type: 'triangle', dur: 0.03, gain: 0.12, pan: o.pan });
  },
  flipDown: (s, o) => {
    s.noiseHit({ dur: 0.035, gain: 0.1, type: 'lowpass', freq: 800, pan: o.pan });
    s.tone({ freq: 100, to: 52, type: 'sine', dur: 0.05, gain: 0.16, pan: o.pan });
  },
  // 提灯のバンパー：「カーン！」都節の音でつぎつぎ鳴る鐘
  bumper: (s, o) => {
    const f = hz(523, pick(MIYAKO));
    s.bell(f, 0.9, 0.2, 0, o.pan);
    s.bell(f * 2.01, 0.3, 0.07, 0.01, o.pan);
    s.noiseHit({ dur: 0.025, gain: 0.16, type: 'highpass', freq: 4200, pan: o.pan });
    s.tone({ freq: 200, to: 110, type: 'sine', dur: 0.08, gain: 0.2, pan: o.pan });
  },
  // 太鼓のスリング：「ドン！」
  sling: (s, o) => taiko(s, o.pan, 0.9),
  // 七福神の的：木の打音＋三味線
  target: (s, o) => {
    clack(s, 0, 0.3, o.pan, 1.05);
    shamisen(s, hz(587, pick([7, 8, 12, 13, 17, 19])), 0.02, o.pan, 0.17, 0.45);
  },
  drop: (s, o) => clack(s, 0, 0.35, o.pan, 0.9),
  // 水車のスピナー：竹のカタカタ
  spinner: (s, o) => {
    s.tone({ freq: 1500, to: 1100, type: 'triangle', dur: 0.02, gain: 0.07, pan: o.pan, filter: 3500 });
  },
  rollover: (s, o) => suzu(s, 0, 0.08, o.pan),
  // ランプに入る：水の音
  rampEnter: (s, o) => {
    s.noiseHit({ dur: 0.55, gain: 0.2, type: 'bandpass', freq: 380, to: 2400, q: 1.6, pan: o.pan, reverb: 0.2 });
    s.tone({ freq: 220, to: 540, type: 'sine', dur: 0.4, gain: 0.07, pan: o.pan });
  },
  // ランプ成功：三味線の駆け上がり
  ramp: (s, o) => {
    [0, 1, 5, 7, 8, 12].forEach((n, i) => shamisen(s, hz(440, n), i * 0.055, o.pan, 0.16, 0.4));
    shakuhachi(s, hz(440, 12), 0.7, 0.07, 0.2, o.pan);
  },
  // 社殿のスクープ：鐘と太鼓
  scoop: (s, o) => {
    s.bell(196, 2.2, 0.26, 0, o.pan);
    s.bell(392.5, 1.2, 0.1, 0.01, o.pan);
    taiko(s, o.pan, 0.8);
  },
  eject: (s, o) => {
    taiko(s, o.pan, 0.45);
    s.tone({ freq: 120, to: 300, type: 'triangle', dur: 0.1, gain: 0.15, filter: 1500, pan: o.pan });
  },
  kickback: (s) => {
    taiko(s, 0, 1.1);
    clack(s, 0.02, 0.35, 0, 0.8);
  },
  // 落球：尺八が沈んでいく
  drain: (s) => {
    shakuhachi(s, 523, 0.9, 0.16);
    s.tone({ freq: 520, to: 230, type: 'sine', dur: 1.0, gain: 0.18, filter: 1600, reverb: 0.4 });
    s.tone({ freq: 392, to: 175, type: 'sine', dur: 1.05, gain: 0.12, at: 0.08, reverb: 0.4 });
  },
  ballsave: (s) => {
    [12, 8, 7, 5, 1, 0].forEach((n, i) => shamisen(s, hz(330, n + 12), i * 0.06, 0, 0.15, 0.35));
    clack(s, 0.4, 0.3);
  },
  tiltWarn: (s) => {
    clack(s, 0, 0.45, 0, 0.8);
    clack(s, 0.2, 0.45, 0, 0.8);
  },
  tilt: (s) => {
    taiko(s, 0, 1.2);
    s.tone({ freq: 98, type: 'sawtooth', dur: 1.2, gain: 0.2, filter: 500 });
    s.tone({ freq: 104, type: 'sawtooth', dur: 1.2, gain: 0.16, filter: 500 });
  },
  mission: (s) => {
    [0, 1, 5, 7, 8, 12, 13].forEach((n, i) => shamisen(s, hz(392, n), i * 0.07, 0, 0.16, 0.45));
    taiko(s, 0, 0.8);
    suzu(s, 0.5, 0.12);
  },
  rank: (s) => {
    [0, 5, 8, 12].forEach((n, i) => s.bell(hz(392, n), 1.0, 0.13, i * 0.12));
    shakuhachi(s, hz(392, 12), 0.9, 0.08, 0.1);
  },
  extraball: (s) => {
    [0, 5, 7, 8, 12, 13, 17, 19, 20, 24].forEach((n, i) => shamisen(s, hz(330, n), i * 0.06, 0, 0.14, 0.35));
    suzu(s, 0.62, 0.14);
  },
  jackpot: (s) => {
    for (let i = 0; i < 10; i++) taiko(s, 0, 0.55, i * 0.075 - i * i * 0.0022);
    [0, 5, 8, 12].forEach((n) => shamisen(s, hz(294, n), 0.78, 0, 0.18, 0.7));
    s.bell(392.5, 1.8, 0.16, 0.8);
    suzu(s, 0.9, 0.14);
  },
  multiball: (s) => {
    for (let i = 0; i < 14; i++) taiko(s, i % 2 ? 0.3 : -0.3, 0.5 + i * 0.03, i * 0.1 - i * i * 0.0024);
    [0, 1, 5, 7, 8].forEach((n, i) => shamisen(s, hz(330, n + 12), 0.9 + i * 0.06, 0, 0.17, 0.5));
  },
  skillshot: (s) => {
    clack(s, 0, 0.45, 0, 1.0);
    clack(s, 0.1, 0.45, 0, 1.12);
    shamisen(s, 880, 0.14, 0, 0.2, 0.6);
    suzu(s, 0.2, 0.14);
  },
  bonusTick: (s) => {
    clack(s, 0, 0.14, 0, 1.2);
  },
  gameover: (s) => {
    [12, 8, 5, 0].forEach((n, i) => shakuhachi(s, hz(262, n), 0.9, 0.12, i * 0.3));
    s.bell(131, 3, 0.22, 1.1);
  },
  launch: (s) => {
    s.noiseHit({ dur: 0.16, gain: 0.26, type: 'bandpass', freq: 500, to: 2600, q: 1.2, pan: 0.8 });
    s.tone({ freq: 80, to: 170, type: 'sine', dur: 0.12, gain: 0.35, pan: 0.8 });
    clack(s, 0.0, 0.2, 0.8, 0.9);
  },

  // ── 専用の音 ──
  // 見得のツケ：拍子木が「バタバタッ」と速くなり、「バッタリ」と決まる
  tsuke: (s) => {
    const times = [0, 0.26, 0.47, 0.64, 0.78, 0.9, 1.0, 1.09, 1.17, 1.24, 1.3];
    times.forEach((t, i) => clack(s, t, 0.34 + i * 0.025, 0, 1 + i * 0.012));
    // バッタリ：大きな2発（低く重い）
    clack(s, 1.62, 0.7, 0, 0.78);
    clack(s, 1.72, 0.78, 0, 0.7);
    taiko(s, 0, 1.2, 1.62);
    taiko(s, 0, 1.0, 1.72);
    [0, 5, 8, 12].forEach((n) => shamisen(s, hz(196, n), 1.74, 0, 0.2, 0.9));
    shakuhachi(s, hz(392, 5), 1.0, 0.1, 1.78);
  },
  // 大波：うなる波と、重なる太鼓
  wave: (s) => {
    s.noiseHit({ dur: 2.6, gain: 0.34, type: 'lowpass', freq: 280, to: 2600, q: 0.9, attack: 0.9, reverb: 0.4 });
    s.noiseHit({ dur: 1.4, gain: 0.3, type: 'bandpass', freq: 3200, to: 700, q: 0.6, at: 1.2, reverb: 0.35 });
    s.tone({ freq: 70, to: 38, type: 'sine', dur: 2.4, gain: 0.3, attack: 0.5 });
    for (let i = 0; i < 12; i++) taiko(s, 0, 0.45 + i * 0.03, 0.5 + i * 0.16);
    taiko(s, 0, 1.3, 2.4);
  },
};

export const ukiyoeSfx: SfxPalette = { wave: 'triangle', pitch: 1.0, bright: 0.8, custom };

// ───────── BGM ─────────

/** 三味線の撥弾き（BGM 用） */
function pluckKit(k: KitApi, freq: number, t: number, gain = 0.07, len = 0.34, pan = 0): void {
  k.voice(freq, t, 0.04, { type: 'sawtooth', gain, attack: 0.002, release: len, filter: 2500, filterEnv: 2.8, reverb: 0.22, pan });
  k.voice(freq * 2.01, t, 0.02, { type: 'triangle', gain: gain * 0.34, attack: 0.002, release: len * 0.45, filter: 5000, pan });
  k.noise(t, 0.035, { gain: gain * 1.1, type: 'bandpass', freq: 3100, q: 0.9 });
}

/** 1曲目「都」：都節の静かな曲。尺八の長い音と、三味線のつまびき、遠くの太鼓。マルチボール中は太鼓が増える */
function miyakoKit(k: KitApi): void {
  const { t, stepDur, step, bar, hot } = k;
  // 太鼓：小節の頭に「ドン」、2小節に1度「ドコ」
  if (step === 0) k.kick(t, hot ? 0.42 : 0.24, 0.85);
  if (step === 8 && (hot || bar % 2 === 1)) k.kick(t, hot ? 0.3 : 0.16, 0.7);
  if (hot && k.pat('....x.....x.....')) k.kick(t, 0.22, 0.75);
  if (hot && k.pat('..x...x...x...xx')) k.noise(t, 0.05, { gain: 0.06, type: 'bandpass', freq: 2600, q: 1.2 });
  // 拍子木（カッ）：4小節の終わり
  if (bar % 4 === 3 && (step === 12 || (hot && step === 14))) k.noise(t, 0.03, { gain: 0.14, type: 'bandpass', freq: 1900, q: 2.6 });
  // 低い三味線（ベース）
  if (step === 0 || (hot && step === 8)) pluckKit(k, k.mtof(k.root), t, 0.1, 0.5);
  // つまびき：コードの音を上へ
  if (step % 4 === 2) pluckKit(k, k.mtof(k.chord[Math.floor(step / 4) % 3] + 12), t, 0.035, 0.3, step % 8 === 2 ? -0.25 : 0.25);
  // 旋律（三味線）
  if (k.mel >= 0 && (hot || bar % 4 !== 3)) {
    pluckKit(k, k.mtof(k.mel), t, 0.075, 0.4);
    // 長い音は撥を細かく打つ（トレモロ）
    if (k.melLen >= 3) for (let i = 1; i < Math.min(k.melLen, 6); i++) pluckKit(k, k.mtof(k.mel), t + stepDur * i, 0.04, 0.2);
  }
  // 尺八：長い息の音
  if (step === 0 && (bar % 2 === 0 || hot)) {
    const f = k.mtof(k.chord[1] + 12);
    k.voice(f, t, stepDur * 13, { type: 'sine', gain: 0.055, attack: 0.28, release: 0.7, vibrato: 0.014, reverb: 0.7, filter: 2400 });
    k.noise(t, stepDur * 11, { gain: 0.012, type: 'bandpass', freq: f * 2.6, q: 3.2, reverb: 0.6 });
  }
  if (hot && k.counter >= 0 && step % 4 === 0) k.voice(k.mtof(k.counter + 12), t, stepDur * 2.5, { type: 'sine', gain: 0.03, attack: 0.05, release: 0.3, vibrato: 0.012, reverb: 0.5 });
}

/** 2曲目「荒波」：陽音階の祭り囃子。太鼓の連打と速い三味線、篠笛 */
function aranamiKit(k: KitApi): void {
  const { t, stepDur, step, bar } = k;
  // 大太鼓（ドン・ドン・ドコドコ）
  if (k.pat('x.x...x.x.x.x...')) k.kick(t, 0.44, 1.1);
  if (k.pat('....x.......x..x')) k.kick(t, 0.26, 0.8);
  // 締太鼓（カカカッ）
  if (k.pat('x.xxx.xxx.xxx.xx')) k.noise(t, 0.045, { gain: step % 4 === 0 ? 0.1 : 0.06, type: 'bandpass', freq: 2500, q: 1.2 });
  if (step % 8 === 4) k.snare(t, 0.12);
  // 拍子木
  if (step === 0 && bar % 2 === 0) k.noise(t, 0.03, { gain: 0.14, type: 'bandpass', freq: 1900, q: 2.6 });
  // 三味線のリフ（8分の刻み）
  if (step % 2 === 0) pluckKit(k, k.mtof(k.chord[(step / 2) % 3]), t, 0.06, 0.2, step % 4 === 0 ? -0.2 : 0.2);
  if (step === 0 || step === 8) pluckKit(k, k.mtof(k.root), t, 0.11, 0.35);
  // 旋律
  if (k.mel >= 0) {
    pluckKit(k, k.mtof(k.mel + 12), t, 0.075, 0.28);
    if (k.melLen >= 2) pluckKit(k, k.mtof(k.mel + 12), t + stepDur, 0.04, 0.16);
  }
  // 篠笛（高い笛）
  if (k.counter >= 0 && step % 2 === 0) k.voice(k.mtof(k.counter + 24), t, stepDur * 1.8, { type: 'sine', gain: 0.032, attack: 0.02, release: 0.14, vibrato: 0.01, reverb: 0.4 });
  if (step === 0 && bar % 4 === 0) k.noise(t, 1.0, { gain: 0.06, type: 'lowpass', freq: 900, reverb: 0.5 });
}

export const ukiyoeSongs: SongDef[] = [
  { name: 'MIYAKO', bpm: 88, swing: 0.06, root: 57, scale: [0, 1, 5, 7, 8], chords: [0, 2, 3, 1, 0, 3, 4, 1], kit: miyakoKit, seed: 5 },
  { name: 'ARANAMI', bpm: 138, swing: 0, root: 55, scale: [0, 2, 5, 7, 9], chords: [0, 3, 2, 4, 0, 3, 1, 4], kit: aranamiKit, seed: 9 },
];
