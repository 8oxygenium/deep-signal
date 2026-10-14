// タイトル画面の曲：見世物小屋の呼び込みの祭囃子（大太鼓・締太鼓・鉦・篠笛）。音源ファイルは使わず合成。
import type { KitFn, SongDef } from '../stages/types';

const matsuri: KitFn = (k) => {
  const t = k.t;
  const sd = k.stepDur;
  const s = k.step % 16;
  // 大太鼓：ドン（音程が少し下がる胴鳴り＋皮の音）
  if (k.pat('x.......x.....x.')) {
    k.voice(k.mtof(38), t, 0.42, { type: 'sine', gain: 0.2, attack: 0.002, release: 0.35, glideFrom: k.mtof(45) });
    k.noise(t, 0.05, { gain: 0.07, type: 'lowpass', freq: 700 });
  }
  // 締太鼓：テン・テン・テケテン
  if (k.pat('..x.x.xx..x.x.xx')) {
    k.voice(760, t, 0.06, { type: 'triangle', gain: 0.045, attack: 0.001, release: 0.05, glideFrom: 900 });
    k.noise(t, 0.035, { gain: 0.05, type: 'bandpass', freq: 2400, q: 1.8 });
  }
  // 鉦（チャンチキ）：金属の短い響き
  if (k.pat('x.x.x.xx' + 'x.x.x.x.')) {
    const accent = s === 0 || s === 8;
    k.voice(2350, t, 0.09, { type: 'square', gain: accent ? 0.022 : 0.014, filter: 6200, release: 0.08, pan: 0.25 });
    k.voice(3510, t, 0.07, { type: 'sine', gain: accent ? 0.02 : 0.012, release: 0.06, pan: 0.25 });
    k.noise(t, 0.03, { gain: 0.035, type: 'highpass', freq: 6500 });
  }
  // 篠笛：高くて息の混ざった旋律（装飾で少し下から入る）
  if (k.mel >= 0) {
    const f = k.mtof(k.mel + 24);
    const dur = sd * Math.max(1, k.melLen) * 0.95;
    k.voice(f, t, dur, { type: 'triangle', gain: 0.05, attack: 0.025, release: 0.06, vibrato: 0.012, glideFrom: f * 0.94, reverb: 0.4, pan: -0.2 });
    k.voice(f * 2, t, dur, { type: 'sine', gain: 0.018, attack: 0.04, release: 0.05, reverb: 0.4, pan: -0.2 });
    k.noise(t, Math.min(dur, 0.18), { gain: 0.02, type: 'bandpass', freq: f * 2, q: 3, reverb: 0.3 });
  }
  // 掛け声の代わりの拍子木（4小節ごと）
  if (k.bar % 4 === 3 && (s === 12 || s === 14)) k.noise(t, 0.025, { gain: 0.12, type: 'bandpass', freq: 1800, q: 6, reverb: 0.35 });
};

export const TITLE_SONG: SongDef = {
  name: 'MISEMONO BAYASHI',
  bpm: 128,
  root: 62,
  // 陽音階（民謡音階）
  scale: [0, 2, 5, 7, 9],
  chords: [0, 2, 3, 0],
  kit: matsuri,
  seed: 23,
};
