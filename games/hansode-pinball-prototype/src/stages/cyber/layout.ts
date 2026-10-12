// CYBER の配置。
//   上：4本のレーン（ハッキング用）／ 中：CPUバンパー3つ ／ 左：ワープ入口・スピナー付きの左バス
//   中央左：ファイアウォールで守られた ROOT チャンバー（ハッキング成功で壁が消え、磁石が使える）
//   右：ドロップ3枚＋CORE スクープ、スタンドアップ2枚、ワープ入口
import { baseLayout, chassis } from '../../table/chassis';
import type { P, PartDef } from '../../table/types';

/** 上の4レーンの中心 x */
export const TOP_LANES = [-2.1, -0.2, 1.7, 3.6];

/** ROOT チャンバーの位置（ファイアウォールの壁が入口をふさぐ） */
export const ROOT = { x: -1.8, y0: 17.0, y1: 21.2, w: 1.1 };

/** ワープ（入口 → 出口） */
export const WARPS = {
  w1: { at: [-5.7, 21.4] as P, to: [5.9, 30.2] as P },
  w2: { at: [5.7, 21.8] as P, to: [-4.8, 30.2] as P },
};

export function layoutParts(): PartDef[] {
  const parts: PartDef[] = [];
  const add = (...p: PartDef[]) => parts.push(...p);

  add(...chassis({ flipperLength: 3.25, slingKick: 34, kickbackRight: true }));

  // ── 上のハッキングレーン（4本）──
  const dividers = [-3.05, -1.15, 0.75, 2.65, 4.55];
  for (const x of dividers) add({ kind: 'wall', pts: [[x, 32.2], [x, 34.9]], style: 'guide' });
  TOP_LANES.forEach((x, i) => {
    add({ kind: 'rollover', id: `ln${i + 1}`, at: [x, 33.5] });
    add({ kind: 'light', id: `ln${i + 1}`, at: [x, 31.4], shape: 'circle', size: 0.36, color: '#05d9e8', label: 'ABCD'[i] });
  });

  // ── CPU バンパー ──
  add(
    { kind: 'bumper', id: 'b1', at: [-3.3, 25.6] },
    { kind: 'bumper', id: 'b2', at: [0.6, 27.9] },
    { kind: 'bumper', id: 'b3', at: [4.2, 25.4] },
  );

  // ── 左バス（左オービット）：スピナー＋ループ判定 ──
  add(
    { kind: 'spinner', id: 'spin', at: [-7.9, 21.4], angle: 90, w: 1.3 },
    { kind: 'trigger', id: 'loopL', a: [-8.6, 24.2], b: [-7.2, 24.2] },
    // 右バス
    { kind: 'trigger', id: 'loopR', a: [7.2, 23.9], b: [8.6, 23.9] },
  );

  // ── ROOT チャンバー（ファイアウォールが入口をふさぐ）──
  const { x: rx, y0, y1, w } = ROOT;
  add(
    { kind: 'wall', id: 'chamberL', pts: [[rx - w, y0 + 0.2], [rx - w, y1]], style: 'guide', h: 0.9 },
    { kind: 'wall', id: 'chamberR', pts: [[rx + w, y0 + 0.2], [rx + w, y1]], style: 'guide', h: 0.9 },
    { kind: 'wall', id: 'chamberRoof', pts: [[rx - w, y1], [rx, y1 + 0.75], [rx + w, y1]], style: 'guide', h: 0.9 },
    { kind: 'post', at: [rx - w, y0 + 0.1], r: 0.22, style: 'rubber' },
    { kind: 'post', at: [rx + w, y0 + 0.1], r: 0.22, style: 'rubber' },
    // ファイアウォール（ハッキングで消える）
    { kind: 'wall', id: 'firewall', pts: [[rx - w, y0], [rx, y0 + 0.55], [rx + w, y0]], style: 'wall', dynamic: true },
    // チャンバーの中を埋める格子（壁が消えると中が空っぽになり、ボールが入れる）
    ...[18.75, 19.95, 21.15].map((yy): PartDef => ({ kind: 'wall', id: 'firewall', pts: [[rx - w, yy], [rx + w, yy]], style: 'wall', dynamic: true })),
    { kind: 'magnet', id: 'root', at: [rx, (y0 + y1) / 2 + 0.2], r: 2.9, strength: 55 },
  );

  // ── ワープ入口（ガイド付き）──
  add(
    { kind: 'warp', id: 'w1', at: WARPS.w1.at, to: WARPS.w1.to, eject: 250, speed: 13, travel: 0.9 },
    { kind: 'warp', id: 'w2', at: WARPS.w2.at, to: WARPS.w2.to, eject: 290, speed: 13, travel: 0.9 },
  );

  // ── 右：ドロップ3枚（斜めの一本線。上に乗ったボールは左へ転がり落ち、下端の CORE スクープに入る）──
  add(
    { kind: 'drop', id: 'd1', bank: 'port', at: [2.3, 17.8], angle: -75, w: 0.95 },
    { kind: 'drop', id: 'd2', bank: 'port', at: [3.2, 18.04], angle: -75, w: 0.95 },
    { kind: 'drop', id: 'd3', bank: 'port', at: [4.1, 18.28], angle: -75, w: 0.95 },
    { kind: 'scoop', id: 'core', at: [2.55, 18.75], eject: 100, speed: 30, hold: 1.0, r: 0.72 },
  );

  // ── スタンドアップ 2枚（右バスの壁に埋め込み）──
  add(
    { kind: 'standup', id: 'ant1', at: [6.8, 25.2], angle: 180 },
    { kind: 'standup', id: 'ant2', at: [6.8, 26.9], angle: 180 },
  );

  // ── ライト ──
  add(
    { kind: 'light', id: 'nodeL', at: [-7.9, 23.0], shape: 'arrow', rot: 90, size: 0.5, color: '#05d9e8' },
    { kind: 'light', id: 'nodeR', at: [7.95, 21.6], shape: 'arrow', rot: 90, size: 0.5, color: '#05d9e8' },
    { kind: 'light', id: 'nodeT', at: [0.75, 30.2], shape: 'arrow', rot: 90, size: 0.55, color: '#05d9e8' },
    { kind: 'light', id: 'w1', at: [-5.7, 19.6], shape: 'arrow', rot: 90, size: 0.45, color: '#ff2a6d' },
    { kind: 'light', id: 'w2', at: [5.7, 20.0], shape: 'arrow', rot: 90, size: 0.45, color: '#ff2a6d' },
    { kind: 'light', id: 'root', at: [ROOT.x, 15.6], shape: 'arrow', rot: 90, size: 0.55, color: '#ff2a6d', label: 'ROOT' },
    { kind: 'light', id: 'core', at: [2.6, 16.2], shape: 'arrow', rot: 90, size: 0.5, color: '#b967ff', label: 'CORE' },
    { kind: 'light', id: 'extraBall', at: [6.1, 14.3], shape: 'circle', size: 0.4, color: '#ff4040', label: 'EXTRA' },
    { kind: 'light', id: 'jackpot', at: [-5.2, 15.0], shape: 'star', size: 0.55, color: '#ffe14a' },
    { kind: 'light', id: 'm1', at: [-1.9, 12.9], shape: 'diamond', size: 0.38, color: '#05d9e8', label: '1' },
    { kind: 'light', id: 'm2', at: [-0.65, 13.3], shape: 'diamond', size: 0.38, color: '#05d9e8', label: '2' },
    { kind: 'light', id: 'm3', at: [0.65, 13.3], shape: 'diamond', size: 0.38, color: '#05d9e8', label: '3' },
    { kind: 'light', id: 'm4', at: [1.9, 12.9], shape: 'diamond', size: 0.38, color: '#05d9e8', label: '4' },
    { kind: 'light', id: 'x2', at: [-1.65, 10.7], shape: 'circle', size: 0.3, color: '#ffb02e', label: '2x' },
    { kind: 'light', id: 'x3', at: [-0.55, 11.1], shape: 'circle', size: 0.3, color: '#ffb02e', label: '3x' },
    { kind: 'light', id: 'x4', at: [0.55, 11.1], shape: 'circle', size: 0.3, color: '#ffb02e', label: '4x' },
    { kind: 'light', id: 'x5', at: [1.65, 10.7], shape: 'circle', size: 0.3, color: '#ffb02e', label: '5x' },
    { kind: 'light', id: 'ant1', at: [6.0, 25.2], shape: 'tri', rot: 0, size: 0.3, color: '#05d9e8' },
    { kind: 'light', id: 'ant2', at: [6.0, 26.9], shape: 'tri', rot: 0, size: 0.3, color: '#05d9e8' },
  );

  return parts;
}

export const cyberLayout = () => baseLayout(layoutParts(), { safeSpot: [0.75, 36.6] });
