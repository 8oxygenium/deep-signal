// IMPOSSIBLE の配置。下側（フリッパー・スリング・アウトレーン）は自前で作る。
//  - アウトレーンの仕切り（divL / divR）と上端のポスト（divTopL / divTopR）は dynamic。ルールが左右に動かす
//  - バンパー（b1〜b3）は dynamic。ルールが台の上を歩かせる
//  - タイヤ（tire1〜tire6）は dynamic のポスト。ふだんは無効（enabled=false）で、ギミック中だけ降ってくる
import { baseLayout, chassis } from '../../table/chassis';
import type { P, PartDef, TableLayout } from '../../table/types';

/** 重力の大きさ（physics/constants.ts の GRAVITY と同じ） */
export const GRAV = 42;
export const SEP = 7.25;
export const FX = 4.0;
export const FY = 4.6;
export const FLIP_LEN = 3.3;
/** 仕切りが内側へ動ける最大量（これ以上だとスリングとの間でボールが挟まる） */
export const DIV_TRAVEL = 1.4;

const mx = (p: P): P => [-p[0], p[1]];

// ───────── 歩くバンパー ─────────

export interface Walker {
  id: string;
  hx: number;
  hy: number;
  ax: number;
  ay: number;
  wx: number;
  wy: number;
  px: number;
  py: number;
}

export const WALKERS: Walker[] = [
  { id: 'b1', hx: -2.4, hy: 28.0, ax: 1.3, ay: 0.9, wx: 0.55, wy: 0.83, px: 0, py: 1.0 },
  { id: 'b2', hx: 3.5, hy: 28.6, ax: 1.2, ay: 1.0, wx: 0.47, wy: 0.71, px: 2.0, py: 0.4 },
  { id: 'b3', hx: 0.75, hy: 24.3, ax: 1.8, ay: 1.0, wx: 0.62, wy: 0.9, px: 1.0, py: 2.2 },
];

export function walkerPos(w: Walker, phase: number, amp = 1): P {
  return [w.hx + w.ax * amp * Math.sin(w.wx * phase + w.px), w.hy + w.ay * amp * Math.sin(w.wy * phase + w.py)];
}

// ───────── タイヤ（落ちてくる障害物）の置き場所 ─────────

export const TIRE_SPOTS: P[] = [
  [-4.8, 15.6],
  [-1.9, 13.4],
  [2.6, 14.6],
  [5.0, 12.2],
  [-3.4, 18.4],
  [0.8, 16.2],
  [-6.0, 12.4],
  [5.6, 15.0],
];
export const TIRE_COUNT = 4;
export const TIRE_R = 0.62;

// ───────── 部品 ─────────

/** 下側：フリッパー、スリング、動くアウトレーン仕切り */
function lowerParts(): PartDef[] {
  const parts: PartDef[] = [];
  for (const s of [1, -1]) {
    const m = (p: P): P => (s === 1 ? p : mx(p));
    const side = s === 1 ? 'L' : 'R';

    // アウトレーンの仕切り（縦の壁＋フリッパーへ向かう斜めのガイド）。1本の折れ線＝同じタグの線分が2本
    parts.push({
      kind: 'wall',
      id: `div${side}`,
      pts: [m([-SEP, 10.4]), m([-SEP, 7.0]), m([-(FX + 0.45), FY + 0.7])],
      style: 'guide',
      h: 1.0,
      dynamic: true,
    });
    parts.push({ kind: 'post', id: `divTop${side}`, at: m([-SEP, 10.9]), r: 0.25, style: 'rubber', dynamic: true });
    // アウトレーン入口を少しせばめるゴムのポスト
    parts.push({ kind: 'post', at: m([-8.1, 12.5]), r: 0.26, style: 'rubber' });

    // 小さめのスリングショット（内側の斜めの辺が蹴る）
    const C: P = m([-4.3, 8.2]);
    const T: P = m([-4.3, 10.2]);
    const B: P = m([-2.6, 7.0]);
    parts.push({ kind: 'sling', id: `sling${side}`, pts: s === 1 ? [C, T, B] : [C, B, T], kickEdge: 1, kick: 30 });

    parts.push({
      kind: 'flipper',
      id: `flipper${side}`,
      side: s === 1 ? 'left' : 'right',
      pivot: m([-FX, FY]),
      length: FLIP_LEN,
      rest: s === 1 ? -30 : 210,
      up: s === 1 ? 28 : 152,
    });
  }
  parts.push({ kind: 'light', id: 'shootAgain', at: [0, 2.9], shape: 'circle', size: 0.5, color: '#ff3b3b', label: 'SHOOT AGAIN' });
  return parts;
}

function ramp(): PartDef {
  const flat = (n: number, h: number) => Array.from({ length: n }, () => h);
  const uturn = (cx: number, cy: number, r: number, from: number, to: number, n = 9): P[] => {
    const out: P[] = [];
    for (let i = 0; i < n; i++) {
      const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return out;
  };
  return {
    kind: 'ramp',
    id: 'bridge',
    path: [[3.95, 17.0], [4.0, 22.0], ...uturn(5.97, 27.2, 1.92, 180, 0), [7.95, 22.0], [7.9, 18.5], [7.35, 15.2], [6.45, 12.4]],
    h: [0, 1.2, ...flat(9, 2.5), 2.3, 1.85, 1.35, 0.8],
  };
}

export function layoutParts(): PartDef[] {
  const parts: PartDef[] = [
    ...chassis({ noLower: true }),
    ...lowerParts(),

    // 上のレーン（N・O・!）。左端のガイドは折れて短い
    { kind: 'wall', pts: [[-2.62, 32.4], [-2.62, 34.6]], style: 'guide' },
    { kind: 'wall', pts: [[-0.38, 32.3], [-0.38, 35.0]], style: 'guide' },
    { kind: 'wall', pts: [[1.88, 32.3], [1.88, 35.0]], style: 'guide' },
    { kind: 'wall', pts: [[4.12, 32.0], [4.12, 34.6]], style: 'guide' },
    { kind: 'rollover', id: 'laneN', at: [-1.5, 33.3] },
    { kind: 'rollover', id: 'laneO', at: [0.75, 33.6] },
    { kind: 'rollover', id: 'laneX', at: [3.0, 33.3] },
    { kind: 'light', id: 'laneN', at: [-1.5, 31.3], shape: 'circle', size: 0.42, color: '#ffd400', label: 'N' },
    { kind: 'light', id: 'laneO', at: [0.75, 31.5], shape: 'circle', size: 0.42, color: '#ffd400', label: 'O' },
    { kind: 'light', id: 'laneX', at: [3.0, 31.3], shape: 'circle', size: 0.42, color: '#ffd400', label: '!' },
  ];

  // 歩くバンパー
  for (const w of WALKERS) parts.push({ kind: 'bumper', id: w.id, at: walkerPos(w, 0), dynamic: true });

  parts.push(
    // 中央：ドロップターゲット3枚と、その奥のスクープ（THE PIT）
    // （ゆるいアーチ状。上に乗ったボールは左右へ転がり落ちる）
    { kind: 'drop', id: 'd1', bank: 'core', at: [-1.25, 19.2], angle: -84, w: 0.95 },
    { kind: 'drop', id: 'd2', bank: 'core', at: [-0.05, 19.4], angle: -88, w: 0.95 },
    { kind: 'drop', id: 'd3', bank: 'core', at: [1.15, 19.2], angle: -96, w: 0.95 },
    { kind: 'scoop', id: 'pit', at: [-0.05, 20.55], eject: 100, speed: 30, hold: 1.0, r: 0.72 },

    // 右：スタンドアップ2枚（右オービットの壁に埋め込み）
    { kind: 'standup', id: 'standA', at: [6.8, 20.25], angle: 180 },
    { kind: 'standup', id: 'standB', at: [6.8, 21.95], angle: 180 },

    // 左オービットのスピナーと、ループ判定
    { kind: 'spinner', id: 'spin', at: [-7.9, 21.6], angle: 90, w: 1.3 },
    // 外周（オービット）の出入口のすき間に張る（上りでも下りでも、通ったらカウント。連続はルール側で間引く）
    { kind: 'trigger', id: 'loopL', a: [-6.3, 17.6], b: [-7.6, 16.6] },
    { kind: 'trigger', id: 'loopR', a: [6.3, 17.6], b: [7.6, 16.6] },

    // 右の「崩れかけの橋」（ランプ）
    ramp(),

    // 光（ライト）
    { kind: 'light', id: 'bridge', at: [3.9, 15.1], shape: 'arrow', rot: 88, size: 0.6, color: '#ffd400' },
    { kind: 'light', id: 'orbitL', at: [-5.6, 14.3], shape: 'arrow', rot: 122, size: 0.45, color: '#ff6a2a' },
    { kind: 'light', id: 'orbitR', at: [5.5, 14.5], shape: 'arrow', rot: 58, size: 0.45, color: '#ff6a2a' },
    { kind: 'light', id: 'pit', at: [-0.05, 17.9], shape: 'arrow', rot: 90, size: 0.55, color: '#ff2a2a', label: 'PIT' },
    { kind: 'light', id: 'bank', at: [-2.7, 19.3], shape: 'tri', rot: 0, size: 0.32, color: '#ffd400' },
    { kind: 'light', id: 'extraBall', at: [-0.05, 16.2], shape: 'circle', size: 0.42, color: '#ff4040', label: 'EXTRA' },
    { kind: 'light', id: 'jackpot', at: [-1.6, 15.4], shape: 'star', size: 0.55, color: '#ffd23f' },
    { kind: 'light', id: 'm1', at: [-1.2, 12.9], shape: 'diamond', size: 0.4, color: '#ffd400', label: 'KEEP' },
    { kind: 'light', id: 'm2', at: [0.0, 13.3], shape: 'diamond', size: 0.4, color: '#ffd400', label: 'HAMMER' },
    { kind: 'light', id: 'm3', at: [1.2, 12.9], shape: 'diamond', size: 0.4, color: '#ffd400', label: 'RUN' },
    { kind: 'light', id: 'standA', at: [6.05, 20.25], shape: 'tri', rot: 0, size: 0.3, color: '#ffd400' },
    { kind: 'light', id: 'standB', at: [6.05, 21.95], shape: 'tri', rot: 0, size: 0.3, color: '#ffd400' },
  );

  // タイヤ（ふだんは無効）
  for (let i = 0; i < TIRE_COUNT; i++) {
    parts.push({ kind: 'post', id: `tire${i}`, at: TIRE_SPOTS[i], r: TIRE_R, style: 'rubber', e: 0.7, dynamic: true });
  }

  // 傾いた看板（飾り）
  parts.push(
    { kind: 'deco', type: 'sign', at: [-7.6, 37.2], rot: 18, w: 3.2, h: 1.3, z: 0.4, color: '#ffd400', text: 'KEEP OUT' },
    { kind: 'deco', type: 'sign', at: [8.1, 37.6], rot: -14, w: 3.4, h: 1.3, z: 0.4, color: '#ff2a2a', text: 'NO WAY' },
  );
  return parts;
}

export function impossibleLayout(): TableLayout {
  return baseLayout(layoutParts(), { safeSpot: [0.75, 36.6] });
}
