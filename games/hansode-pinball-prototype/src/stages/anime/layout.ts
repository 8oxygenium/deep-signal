// ANIME の台の配置。
// 中央を駆け上がる「MAGIC ROAD」ランプ、左の変身スクープ、右上のミニフリッパー、
// 入口を広げた左右のオービット（スピナー付き）、星のスタンドアップ、上の STAR レーン。
import { baseLayout, chassis } from '../../table/chassis';
import type { P, PartDef, TableLayout } from '../../table/types';

export const LANE_IDS = ['laneS', 'laneT', 'laneA', 'laneR'];
export const LANE_LABELS = ['S', 'T', 'A', 'R'];

/** スクープ（変身）の位置 */
export const SCOOP_AT: [number, number] = [-4.1, 21.9];

/**
 * 左右のオービット（外周レーン）。標準の入口は狭く（すき間1.2）狙いにくいので、
 * 入口を広く（すき間1.7）とった自前の形にする。s = 1 が左、-1 が右。
 */
function orbit(s: 1 | -1): PartDef[] {
  const m = (x: number, y: number): P => [s === 1 ? x : -x, y];
  const side = s === 1 ? 'L' : 'R';
  // 誘導壁の下側（入口側）の斜めの区間：始点 (-7.1,19.8) → 終点 (-4.4,15.4)
  const A = { x: -7.1, y: 19.8 }, B = { x: -4.4, y: 15.4 };
  const parts: PartDef[] = [
    // 外壁のふくらみ（レーンから落ちてきたボールを盤面側へ逃がす）と先端のゴム
    { kind: 'wall', id: `wedge${side}`, pts: [m(-8.7, 19.5), m(-7.6, 16.6), m(-8.7, 13.2)], h: 1.4 },
    { kind: 'post', at: m(-7.6, 16.6), r: 0.28, style: 'rubber' },
    // 内側の誘導壁：上端から真下へ、途中から斜めに入口へ広がる
    { kind: 'wall', id: `orbitGuide${side}`, pts: [m(-7.1, 26.5), m(A.x, A.y), m(B.x, B.y)], style: 'guide', h: 1.0 },
    { kind: 'post', at: m(-7.1, 26.5), r: 0.2, style: 'metal' },
    { kind: 'post', at: m(B.x, B.y), r: 0.22, style: 'rubber' },
  ];
  // 外壁のふくらみの下側の斜面（盤面側）に星のスタンドアップ（左3枚・右2枚）
  const W0 = { x: -7.6, y: 16.6 }, W1 = { x: -8.7, y: 13.2 };
  const wl = Math.hypot(W1.x - W0.x, W1.y - W0.y);
  // 盤面側（左の台なら右下）を向く法線。右の台では左右を反転する
  const wnx = -(W1.y - W0.y) / wl, wny = (W1.x - W0.x) / wl;
  const wAng = (Math.atan2(wny, wnx) * 180) / Math.PI;
  const standAng = s === 1 ? wAng : 180 - wAng;
  const ts = s === 1 ? [0.3, 0.56, 0.82] : [0.3, 0.7];
  const color = s === 1 ? '#ff4fa3' : '#4fc3ff';
  ts.forEach((t, i) => {
    const id = `star${side}${i + 1}`;
    const bx = W0.x + (W1.x - W0.x) * t, by = W0.y + (W1.y - W0.y) * t;
    parts.push({ kind: 'standup', id, at: m(Number((bx + wnx * 0.12).toFixed(2)), Number((by + wny * 0.12).toFixed(2))), angle: Number(standAng.toFixed(1)), w: 0.62 });
    parts.push({ kind: 'light', id, at: m(Number((bx + wnx * 1.0).toFixed(2)), Number((by + wny * 1.0).toFixed(2))), shape: 'tri', rot: Number(standAng.toFixed(1)), size: 0.28, color });
  });
  return parts;
}

export function animeParts(): PartDef[] {
  return [
    ...chassis({ kickbackLeft: true, kickbackRight: true, slingKick: 32, orbits: false }),
    ...orbit(1),
    ...orbit(-1),

    // ── 上の STAR レーン（4本）──
    ...[-3.65, -1.45, 0.75, 2.95, 5.15].map(
      (x, i): PartDef => ({ kind: 'wall', pts: [[x, i === 0 || i === 4 ? 32.0 : 32.3], [x, i === 0 || i === 4 ? 34.6 : 35.0]], style: 'guide' }),
    ),
    ...[-2.55, -0.35, 1.85, 4.05].map((x, i): PartDef => ({ kind: 'rollover', id: LANE_IDS[i], at: [x, i === 0 || i === 3 ? 33.3 : 33.7] })),
    ...[-2.55, -0.35, 1.85, 4.05].map(
      (x, i): PartDef => ({ kind: 'light', id: LANE_IDS[i], at: [x, i === 0 || i === 3 ? 31.3 : 31.6], shape: 'star', size: 0.5, color: '#ffe14f', label: LANE_LABELS[i] }),
    ),

    // ── ポップバンパー（左右の羽）──
    { kind: 'bumper', id: 'b1', at: [-3.9, 27.2] },
    { kind: 'bumper', id: 'b2', at: [-2.0, 30.0] },
    { kind: 'bumper', id: 'b3', at: [5.4, 27.2] },
    { kind: 'bumper', id: 'b4', at: [3.5, 30.0] },

    // ── 左：変身スクープ ──
    { kind: 'scoop', id: 'henshin', at: SCOOP_AT, eject: 72, speed: 28, hold: 1.0, r: 0.72 },

    // ── 右上のミニフリッパー（右のフリッパーボタンで一緒に動く。上のバンパーへ打ち上げる）──
    { kind: 'flipper', id: 'flipperM', side: 'right', pivot: [5.1, 20.5], length: 2.3, r0: 0.5, r1: 0.25, rest: 205, up: 140, power: 1.1 },

    // ── オービット：スピナーとループ判定（レーンの下から上へ通ったとき）──
    { kind: 'spinner', id: 'spinL', at: [-7.9, 22.4], angle: 90, w: 1.3 },
    { kind: 'spinner', id: 'spinR', at: [7.9, 22.4], angle: 90, w: 1.3 },
    { kind: 'trigger', id: 'loopL', a: [-8.5, 20.4], b: [-7.2, 20.4] },
    { kind: 'trigger', id: 'loopR', a: [7.2, 20.4], b: [8.5, 20.4], dir: [0, 1] },

    // ── 中央を駆け上がるランプ（MAGIC ROAD）──
    // 入口の左右に「ハの字」の誘導壁（逆V字。下から来たボールをランプ入口へ寄せる）
    { kind: 'wall', pts: [[-2.7, 12.4], [-1.05, 14.6]], style: 'guide' },
    { kind: 'wall', pts: [[2.7, 12.4], [1.05, 14.6]], style: 'guide' },
    {
      kind: 'ramp',
      id: 'rampC',
      path: [[0, 14.6], [0, 17.2], [0.2, 20.4], [0.5, 23.6], [0.75, 26.0], [0.85, 27.6]],
      h: [0, 0.9, 1.5, 1.7, 1.6, 1.2],
      w: 1.8,
      mouth: 3.0,
    },

    // ── ライト ──
    { kind: 'light', id: 'rampC', at: [0, 12.3], shape: 'arrow', rot: 90, size: 0.65, color: '#a46bff' },
    { kind: 'light', id: 'orbitL', at: [-6.9, 14.6], shape: 'star', size: 0.5, color: '#ff4fa3' },
    { kind: 'light', id: 'orbitR', at: [6.9, 14.6], shape: 'star', size: 0.5, color: '#4fc3ff' },
    { kind: 'light', id: 'henshin', at: [SCOOP_AT[0], SCOOP_AT[1] - 2.0], shape: 'star', size: 0.62, color: '#ff4fa3', label: 'HENSHIN' },
    { kind: 'light', id: 'extraBall', at: [-2.9, 17.0], shape: 'circle', size: 0.42, color: '#ff4040', label: 'EXTRA' },
    { kind: 'light', id: 'jackpot', at: [3.6, 16.4], shape: 'star', size: 0.55, color: '#ffe14f', label: 'JACKPOT' },
    { kind: 'light', id: 'm1', at: [-1.5, 10.9], shape: 'diamond', size: 0.4, color: '#a46bff', label: 'ROAD' },
    { kind: 'light', id: 'm2', at: [0, 11.3], shape: 'diamond', size: 0.4, color: '#a46bff', label: 'STAR' },
    { kind: 'light', id: 'm3', at: [1.5, 10.9], shape: 'diamond', size: 0.4, color: '#a46bff', label: 'LOOP' },
    { kind: 'light', id: 'c2', at: [-2.25, 8.9], shape: 'circle', size: 0.3, color: '#6ff0c8', label: 'x2' },
    { kind: 'light', id: 'c3', at: [-0.75, 9.3], shape: 'circle', size: 0.3, color: '#6ff0c8', label: 'x3' },
    { kind: 'light', id: 'c4', at: [0.75, 9.3], shape: 'circle', size: 0.3, color: '#6ff0c8', label: 'x4' },
    { kind: 'light', id: 'c5', at: [2.25, 8.9], shape: 'circle', size: 0.3, color: '#6ff0c8', label: 'x5' },
  ];
}

export function animeLayout(): TableLayout {
  return baseLayout(animeParts(), { safeSpot: [0.75, 36.6] });
}
