// UKIYO-E の配置：神社の参道を中心にした、和風コテコテの台。
//   中央：鳥居 → 参道（左右に七福神の的）→ 社殿のスクープ → 提灯のバンパー3つ → 上の松竹梅レーン
//   左  ：鯉の滝登りランプ（水の流れ＋鯉）／ 左オービット（水車スピナー）／ 七福神2人 ／ 布袋（上の大きな的）
//   右  ：龍が巻きつくランプ（S字）／ 右オービット
//   下  ：太鼓のスリングショット、キックバック左右
import { baseLayout, chassis } from '../../table/chassis';
import type { P, PartDef, TableLayout } from '../../table/types';

/** 七福神 */
export interface God {
  id: string;
  /** 漢字の名前 */
  name: string;
  /** ローマ字（DMD 用） */
  en: string;
  /** 的の位置と向き */
  at: P;
  angle: number;
  /** 大きな的（布袋） */
  big?: boolean;
  /** 床のライトの位置 */
  light: P;
  /** その神様の色 */
  color: string;
  /** 持ち物（絵の描き分け用） */
  item: 'tai' | 'mallet' | 'spear' | 'biwa' | 'tall' | 'staff' | 'sack';
}

export const GODS: God[] = [
  { id: 'ebisu', name: '恵比寿', en: 'EBISU', at: [-1.78, 20.6], angle: 0, light: [-0.85, 20.6], color: '#e0583c', item: 'tai' },
  { id: 'daikoku', name: '大黒天', en: 'DAIKOKU', at: [-1.78, 22.5], angle: 0, light: [-0.85, 22.5], color: '#3d5a8c', item: 'mallet' },
  { id: 'bishamon', name: '毘沙門天', en: 'BISHAMON', at: [3.18, 20.6], angle: 180, light: [2.25, 20.6], color: '#2f7a4a', item: 'spear' },
  { id: 'benzai', name: '弁財天', en: 'BENZAI', at: [3.18, 22.5], angle: 180, light: [2.25, 22.5], color: '#d9709a', item: 'biwa' },
  { id: 'fukurokuju', name: '福禄寿', en: 'FUKUROKUJU', at: [-6.8, 21.7], angle: 0, light: [-5.95, 21.7], color: '#8a5ab0', item: 'tall' },
  { id: 'jurojin', name: '寿老人', en: 'JUROJIN', at: [-6.8, 23.6], angle: 0, light: [-5.95, 23.6], color: '#c98a2b', item: 'staff' },
  { id: 'hotei', name: '布袋', en: 'HOTEI', at: [-5.6, 31.6], angle: 0, big: true, light: [-4.5, 31.6], color: '#e0b238', item: 'sack' },
];

/** 鳥居（床の物理＝2本の柱と片側だけの一方通行の戸、ルールが数える通過線） */
export const TORII = {
  /** 左右の柱の位置 */
  left: [-0.95, 18.2] as P,
  right: [2.35, 18.2] as P,
  /** 通過を数える線 */
  line: { a: [-0.6, 18.55] as P, b: [2.0, 18.55] as P },
  /** 見た目の中心 */
  center: [0.7, 18.2] as P,
};

/** 社殿（スクープ）の位置 */
export const SHRINE: P = [0.7, 24.7];

/** 提灯のバンパー */
export const LANTERNS: { id: string; at: P; kanji: string }[] = [
  { id: 'b1', at: [-1.0, 27.4], kanji: '祭' },
  { id: 'b2', at: [2.4, 27.7], kanji: '福' },
  { id: 'b3', at: [0.7, 30.2], kanji: '寿' },
];

/** 上の松竹梅レーン */
export const LANES = [
  { id: 'laneMatsu', ch: '松', x: -1.65 },
  { id: 'laneTake', ch: '竹', x: 0.65 },
  { id: 'laneUme', ch: '梅', x: 2.95 },
];

/** 鯉の滝登りランプ（左。まっすぐ駆け上がって上のレーンへ） */
export const KOI = {
  id: 'koi',
  path: [[-4.5, 16.4], [-4.4, 19.6], [-4.1, 22.6], [-3.5, 25.6], [-2.7, 28.0], [-2.1, 29.8], [-1.5, 31.2]] as P[],
  h: [0, 0.9, 1.6, 2.2, 2.4, 1.9, 1.1],
  w: 1.7,
};

/** 龍が巻きつくランプ（右。S字に上って上のレーンへ） */
export const RYU = {
  id: 'ryu',
  path: [[4.9, 16.4], [5.0, 19.6], [5.5, 22.6], [5.9, 25.4], [5.4, 28.0], [4.6, 29.9], [3.6, 31.2]] as P[],
  h: [0, 0.9, 1.6, 2.2, 2.4, 1.9, 1.1],
  w: 1.6,
};

export function layoutParts(): PartDef[] {
  const parts: PartDef[] = [];
  const add = (...p: PartDef[]) => parts.push(...p);

  // 骨組み：左右のキックバック（ルールで点灯）、太鼓のスリングは強め
  add(...chassis({ kickbackLeft: true, kickbackRight: true, slingKick: 32 }));

  // ───── 鳥居と参道 ─────
  add(
    { kind: 'post', id: 'toriiL', at: TORII.left, r: 0.28, style: 'metal' },
    { kind: 'post', id: 'toriiR', at: TORII.right, r: 0.28, style: 'metal' },
    // 片側だけの一方通行の戸（上から落ちたボールは左の隙間へ転がり落ちる）
    { kind: 'gate', id: 'toriiGate', a: [2.05, 18.65], b: [0.55, 17.95], pass: [0, 1] },
    { kind: 'trigger', id: 'torii', a: TORII.line.a, b: TORII.line.b, dir: [0, 1] },
    // 参道の両側の竹垣（入口は鳥居で狭く、奥へ広がる）
    { kind: 'wall', id: 'sandoL', pts: [[-0.95, 18.75], [-2.0, 19.8], [-2.0, 24.0]], style: 'guide' },
    { kind: 'wall', id: 'sandoR', pts: [[2.35, 18.75], [3.4, 19.8], [3.4, 24.0]], style: 'guide' },
  );

  // ───── 七福神の的 ─────
  for (const g of GODS) {
    add({ kind: 'standup', id: g.id, at: g.at, angle: g.angle, w: g.big ? 2.0 : 0.95, big: g.big });
    add({ kind: 'light', id: g.id, at: g.light, shape: 'circle', size: 0.26, color: g.color });
  }

  // ───── 社殿（スクープ）─────
  add({ kind: 'scoop', id: 'shrine', at: SHRINE, eject: 96, speed: 30, hold: 1.1, r: 0.72 });

  // ───── 提灯のバンパー ─────
  for (const l of LANTERNS) add({ kind: 'bumper', id: l.id, at: l.at });

  // ───── 上の松竹梅レーン ─────
  for (const x of [-2.8, -0.5, 1.8, 4.1]) add({ kind: 'wall', pts: [[x, 32.3], [x, 35.0]], style: 'guide' });
  for (const l of LANES) {
    add({ kind: 'rollover', id: l.id, at: [l.x, 33.4] });
    add({ kind: 'light', id: l.id, at: [l.x, 34.3], shape: 'circle', size: 0.3, color: '#7ea24a' });
  }

  // ───── 左オービット：水車のスピナーとループ判定 ─────
  add(
    { kind: 'spinner', id: 'wheel', at: [-7.9, 21.8], angle: 90, w: 1.3 },
    { kind: 'trigger', id: 'loopL', a: [-8.6, 24.6], b: [-7.2, 24.6], dir: [0, 1] },
    { kind: 'trigger', id: 'loopR', a: [7.2, 24.2], b: [8.6, 24.2], dir: [0, 1] },
  );

  // ───── 2本のランプ ─────
  add(
    { kind: 'ramp', id: KOI.id, path: KOI.path, h: KOI.h, w: KOI.w, mouth: 3.0 },
    { kind: 'ramp', id: RYU.id, path: RYU.path, h: RYU.h, w: RYU.w, mouth: 3.0 },
  );

  // ランプの入口とオービットの間をふさぐ（ボールが挟まらないように）
  add(
    { kind: 'wall', pts: [[-7.1, 21.0], [-5.4, 19.4]], style: 'guide' },
    { kind: 'wall', pts: [[7.1, 21.0], [5.95, 19.4]], style: 'guide' },
    // 参道の右の垣と龍ランプの入口の垣の間のすき間をふさぐ
    { kind: 'wall', pts: [[3.4, 20.3], [4.05, 19.4]], style: 'guide' },
  );

  // ───── ライト ─────
  add(
    { kind: 'light', id: 'koi', at: [-4.55, 14.6], shape: 'arrow', rot: 90, size: 0.6, color: '#4f9bd0' },
    { kind: 'light', id: 'ryu', at: [4.9, 14.6], shape: 'arrow', rot: 90, size: 0.6, color: '#2f9a6a' },
    { kind: 'light', id: 'torii', at: [0.7, 16.5], shape: 'arrow', rot: 90, size: 0.55, color: '#d8421e', label: '鳥居' },
    { kind: 'light', id: 'shrine', at: [0.7, 22.6], shape: 'star', size: 0.5, color: '#ffd23f', label: '社殿' },
    { kind: 'light', id: 'orbitL', at: [-5.9, 15.0], shape: 'arrow', rot: 122, size: 0.45, color: '#e0b238' },
    { kind: 'light', id: 'orbitR', at: [6.0, 15.2], shape: 'arrow', rot: 58, size: 0.45, color: '#e0b238' },
    { kind: 'light', id: 'extraBall', at: [-3.2, 15.4], shape: 'circle', size: 0.4, color: '#ff4040', label: 'EXTRA' },
    { kind: 'light', id: 'jackpot', at: [2.7, 15.5], shape: 'star', size: 0.5, color: '#ffd23f', label: '大当たり' },
    { kind: 'light', id: 'm1', at: [-1.9, 13.1], shape: 'diamond', size: 0.38, color: '#d8421e', label: '参' },
    { kind: 'light', id: 'm2', at: [-0.65, 13.5], shape: 'diamond', size: 0.38, color: '#d8421e', label: '滝' },
    { kind: 'light', id: 'm3', at: [0.65, 13.5], shape: 'diamond', size: 0.38, color: '#d8421e', label: '龍' },
    { kind: 'light', id: 'm4', at: [1.9, 13.1], shape: 'diamond', size: 0.38, color: '#d8421e', label: '福' },
    { kind: 'light', id: 'x2', at: [-1.65, 10.7], shape: 'circle', size: 0.3, color: '#e0b238', label: '2x' },
    { kind: 'light', id: 'x3', at: [-0.55, 11.1], shape: 'circle', size: 0.3, color: '#e0b238', label: '3x' },
    { kind: 'light', id: 'x4', at: [0.55, 11.1], shape: 'circle', size: 0.3, color: '#e0b238', label: '4x' },
    { kind: 'light', id: 'x5', at: [1.65, 10.7], shape: 'circle', size: 0.3, color: '#e0b238', label: '5x' },
  );

  return parts;
}

export function ukiyoeLayout(): TableLayout {
  return baseLayout(layoutParts(), { safeSpot: [0.75, 36.6] });
}
