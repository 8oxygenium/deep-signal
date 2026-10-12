// 全ステージ共通の「台の骨組み」：外枠、発射レーン、上部アーチ、フリッパー、
// スリングショット、インレーン/アウトレーン、オービットの出入口。
// ステージはこれに上半分の部品を足して台を作る（オプションで骨組みも変えられる）。
//
//   x: -8.6〜8.6 が遊ぶ範囲、8.8〜10.1 が発射レーン。y: 0（手前）〜40（奥）
import type { P, PartDef, TableLayout } from './types';

export const CH = {
  left: -8.7,
  right: 8.7,
  laneOuter: 10.2,
  laneX: 9.45,
  archC: [0.75, 30.5] as P,
  archR: 9.45,
  plunger: [9.45, 1.6] as P,
  flipperY: 4.6,
  flipperX: 4.0,
};

export interface ChassisOptions {
  flipperLength?: number;
  flipperPower?: number;
  /** フリッパーの支点の x（±） */
  flipperX?: number;
  restDeg?: number;
  upDeg?: number;
  /** キックバック（アウトレーンから打ち返す） */
  kickbackLeft?: boolean;
  kickbackRight?: boolean;
  slingKick?: number;
  /** オービット（左右の外周レーン）の入口を作る */
  orbits?: boolean;
  /** オービットのガイドの上端 */
  orbitTop?: number;
  /** アウトレーンの入口を狭くするポスト（やさしい台） */
  outlanePosts?: boolean;
  plungerMax?: number;
  plungerMin?: number;
  /** 下側の部品を省く（IMPOSSIBLE が自前で作る） */
  noLower?: boolean;
  /** インレーン/アウトレーンの仕切りの x（既定 7.25） */
  separatorX?: number;
}

const mx = (p: P): P => [-p[0], p[1]];

export function chassis(o: ChassisOptions = {}): PartDef[] {
  const parts: PartDef[] = [];
  const L = CH.left, R = CH.right;
  const sepX = o.separatorX ?? 7.25;

  // ── 外枠 ──
  parts.push({ kind: 'wall', id: 'outerL', pts: o.orbits === false ? [[L, -0.6], [L, 30.5]] : [[L, -0.6], [L, 13.2]], h: 1.6 });
  if (o.orbits !== false) parts.push({ kind: 'wall', id: 'outerL2', pts: [[L, 19.5], [L, 30.5]], h: 1.6 });
  parts.push({ kind: 'wall', id: 'outerR', pts: [[CH.laneOuter, -0.6], [CH.laneOuter, 30.5]], h: 1.6 });
  parts.push({ kind: 'wall', id: 'bottom', pts: [[L, -0.6], [CH.laneOuter, -0.6]], style: 'invisible' });
  parts.push({ kind: 'arc', id: 'arch', c: CH.archC, R: CH.archR, from: 0, to: 180, h: 1.6 });

  // ── 発射レーン ──
  parts.push({ kind: 'wall', id: 'laneWall', pts: [[R, -0.6], [R, 27]], r: 0.12, style: 'metal', h: 1.2 });
  parts.push({ kind: 'post', at: [R, 27], r: 0.14, style: 'metal' });
  parts.push({ kind: 'wall', id: 'laneBottom', pts: [[R, -0.4], [CH.laneOuter, -0.4]], style: 'invisible' });
  parts.push({ kind: 'plunger', at: CH.plunger, minSpeed: o.plungerMin ?? 34, maxSpeed: o.plungerMax ?? 92 });
  // 発射レーン出口の一方通行ゲート（斜めなので、上から落ちてきたボールは左へ転がる）
  parts.push({ kind: 'gate', id: 'laneGate', a: [R + 0.05, 27.1], b: [CH.laneOuter - 0.05, 28.3], pass: [0, 1] });

  if (o.orbits !== false) {
    // 左右のオービット出入口（斜めのシュート）と外壁の出っ張り
    for (const s of [1, -1]) {
      const m = (p: P): P => (s === 1 ? p : mx(p));
      parts.push({ kind: 'wall', id: s === 1 ? 'wedgeL' : 'wedgeR', pts: [m([L, 19.5]), m([-7.6, 16.6]), m([L, 13.2])], h: 1.4 });
      parts.push({ kind: 'post', at: m([-7.6, 16.6]), r: 0.28, style: 'rubber' });
      const top = o.orbitTop ?? 26.5;
      parts.push({ kind: 'wall', id: s === 1 ? 'orbitGuideL' : 'orbitGuideR', pts: [m([-6.3, 17.6]), m([-7.1, 19.5]), m([-7.1, top])], style: 'guide', h: 1.0 });
      parts.push({ kind: 'post', at: m([-7.1, top]), r: 0.2, style: 'metal' });
      parts.push({ kind: 'post', at: m([-6.3, 17.6]), r: 0.22, style: 'rubber' });
    }
  }

  if (!o.noLower) parts.push(...lower(o, sepX));

  parts.push({ kind: 'drain', y: 0.4, x0: L, x1: R });
  return parts;
}

/** 下側：フリッパー、スリング、インレーン/アウトレーン */
export function lower(o: ChassisOptions, sepX: number): PartDef[] {
  const parts: PartDef[] = [];
  const fx = o.flipperX ?? CH.flipperX;
  const fy = CH.flipperY;
  const len = o.flipperLength ?? 3.3;
  const rest = o.restDeg ?? -30;
  const up = o.upDeg ?? 28;

  for (const s of [1, -1]) {
    const m = (p: P): P => (s === 1 ? p : mx(p));
    const side = s === 1 ? 'L' : 'R';
    // インレーン/アウトレーンの仕切りとフリッパーへのガイド
    const guideEnd: P = [-fx - 0.45, fy + 0.7];
    parts.push({ kind: 'wall', id: `inlaneGuide${side}`, pts: [m([-sepX, 10.8]), m([-sepX, 7.0]), m(guideEnd)], style: 'guide', h: 1.0 });
    parts.push({ kind: 'post', at: m([-sepX, 10.8]), r: 0.3, style: 'rubber' });
    if (o.outlanePosts) parts.push({ kind: 'post', at: m([-8.15, 11.6]), r: 0.32, style: 'rubber' });

    // スリングショット（三角形。内側の斜めの辺が蹴る）
    const C: P = m([-5.7, 7.9]);
    const T: P = m([-5.7, 11.0]);
    const B: P = m([-3.35, 6.7]);
    parts.push({ kind: 'sling', id: `sling${side}`, pts: s === 1 ? [C, T, B] : [C, B, T], kickEdge: s === 1 ? 1 : 1, kick: o.slingKick ?? 30 });

    // ロールオーバー（インレーン/アウトレーン）
    parts.push({ kind: 'rollover', id: `inlane${side}`, at: m([-(sepX - 0.85), 9.3]), r: 0.55 });
    parts.push({ kind: 'rollover', id: `outlane${side}`, at: m([-(sepX + 0.72), 8.4]), r: 0.55 });
    parts.push({ kind: 'light', id: `inlane${side}`, at: m([-(sepX - 0.85), 9.3]), shape: 'arrow', rot: -90, size: 0.5 });
    parts.push({ kind: 'light', id: `outlane${side}`, at: m([-(sepX + 0.72), 8.4]), shape: 'arrow', rot: -90, size: 0.5 });

    const kb = s === 1 ? o.kickbackLeft : o.kickbackRight;
    if (kb) {
      parts.push({ kind: 'kickback', id: `kickback${side}`, at: m([-(sepX + 0.72), 4.0]), eject: 90, speed: 74 });
      parts.push({ kind: 'light', id: `kickback${side}`, at: m([-(sepX + 0.72), 5.8]), shape: 'tri', rot: 90, size: 0.55, color: '#ff4040' });
    }

    parts.push({
      kind: 'flipper',
      id: `flipper${side}`,
      side: s === 1 ? 'left' : 'right',
      pivot: m([-fx, fy]),
      length: len,
      rest: s === 1 ? rest : 180 - rest,
      up: s === 1 ? up : 180 - up,
      power: o.flipperPower,
    });
  }
  parts.push({ kind: 'light', id: 'shootAgain', at: [0, 2.9], shape: 'circle', size: 0.5, color: '#ff3b3b', label: 'SHOOT AGAIN' });
  return parts;
}

export function baseLayout(parts: PartDef[], extra: Partial<TableLayout> = {}): TableLayout {
  return {
    bounds: { x0: -9.6, x1: 11, y0: -3, y1: 41.5 },
    parts,
    safeSpot: [0.75, 36.5],
    ...extra,
  };
}
