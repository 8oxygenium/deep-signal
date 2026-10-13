// ROUTE 50s の台の配置。ランプもオービットも使わず、昔のアメリカンらしく
// 「ポップバンパー多め＋壁ぎわの追加フリッパー＋ボタン＋キックアウトホール」で組む。
import { chassis } from '../../table/chassis';
import type { PartDef } from '../../table/types';

/** 上のレーン（R・O・A・D） */
export const ROAD_IDS = ['laneR', 'laneO', 'laneA', 'laneD'] as const;
/** メニューの的 */
export const MENU_IDS = ['burger', 'shake', 'fries'] as const;

/** ジュークボックス（大きな的）の位置と向き。3D の筐体はこの後ろに立てる */
export const JUKE = { at: [-5.5, 32.4] as [number, number], angle: -60 };
/** ドライブインシアター（スクープ）の位置 */
export const MOVIE_AT: [number, number] = [0.75, 19.4];

export function layoutParts(): PartDef[] {
  const parts: PartDef[] = [];
  // 下側：外枠・フリッパー・スリング・インレーン/アウトレーン（キックバックは左だけ）。オービットは作らない
  parts.push(...chassis({ kickbackLeft: true, orbits: false, slingKick: 32 }));

  // ── 追加フリッパー（同じ側のキーで動く）。壁ぎわの支点から中央へ向けて ──
  parts.push(
    { kind: 'flipper', id: 'flipperML', side: 'left', pivot: [-7.4, 14.3], length: 2.6, r0: 0.5, r1: 0.26, rest: -28, up: 28 },
    { kind: 'flipper', id: 'flipperMR', side: 'right', pivot: [7.4, 14.3], length: 2.6, r0: 0.5, r1: 0.26, rest: 180 + 28, up: 180 - 28 },
    // 壁と支点のすき間にボールがはまらないよう、壁から支点へ斜めの肩（ボールは必ずフリッパーの上へ転がる）
    { kind: 'wall', pts: [[-8.6, 17.4], [-7.3, 14.95]], style: 'guide' },
    { kind: 'wall', pts: [[8.58, 17.4], [7.3, 14.95]], style: 'guide' },
  );

  // ── 上のレーン R・O・A・D ──
  // 左端の仕切りは立てない（ジュークボックスの的とのすき間にボールがはまるため）
  const guideX = [-1.5, 0.75, 3.0, 5.25];
  guideX.forEach((x, i) => {
    const top = i === 3 ? 34.2 : 34.9;
    parts.push({ kind: 'wall', pts: [[x, 32.5], [x, top]], style: 'guide' });
  });
  const laneX = [-2.625, -0.375, 1.875, 4.125];
  ROAD_IDS.forEach((id, i) => {
    parts.push({ kind: 'rollover', id, at: [laneX[i], 33.7] });
    parts.push({ kind: 'light', id, at: [laneX[i], 31.4], shape: 'circle', size: 0.42, color: '#ff3b3b', label: 'ROAD'[i] });
  });

  // ── ポップバンパー 5つ ──
  parts.push(
    { kind: 'bumper', id: 'b1', at: [-2.9, 27.4] },
    { kind: 'bumper', id: 'b2', at: [4.4, 27.4] },
    { kind: 'bumper', id: 'b3', at: [0.75, 29.6] },
    { kind: 'bumper', id: 'b4', at: [-1.0, 24.6] },
    { kind: 'bumper', id: 'b5', at: [2.5, 24.6] },
  );

  // ── ジュークボックス（大きな的）──
  parts.push({ kind: 'standup', id: 'juke', at: JUKE.at, angle: JUKE.angle, w: 2.2, big: true });
  parts.push({ kind: 'light', id: 'juke', at: [-4.7, 30.3], shape: 'star', size: 0.42, color: '#ffd23f', label: 'JUKE' });

  // ── メニューの的（壁に埋め込み）：BURGER / SHAKE は左、FRIES は右 ──
  parts.push(
    { kind: 'standup', id: 'burger', at: [-8.35, 19.0], angle: 0 },
    { kind: 'standup', id: 'shake', at: [-8.35, 21.0], angle: 0 },
    { kind: 'standup', id: 'fries', at: [8.35, 20.0], angle: 180 },
    { kind: 'light', id: 'burger', at: [-7.5, 19.0], shape: 'tri', rot: 180, size: 0.3, color: '#ff3b3b', label: 'BURGER' },
    { kind: 'light', id: 'shake', at: [-7.5, 21.0], shape: 'tri', rot: 180, size: 0.3, color: '#2fd8c8', label: 'SHAKE' },
    { kind: 'light', id: 'fries', at: [7.5, 20.0], shape: 'tri', rot: 0, size: 0.3, color: '#ffc83a', label: 'FRIES' },
  );

  // ── ドライブインシアター（スクープ）──
  parts.push({ kind: 'scoop', id: 'movie', at: MOVIE_AT, eject: 92, speed: 30, hold: 1.2, r: 0.72 });
  parts.push({ kind: 'light', id: 'movie', at: [MOVIE_AT[0], 17.7], shape: 'arrow', rot: 90, size: 0.5, color: '#ff3b3b' });

  // ── ボタン（ロールオーバー）：両方踏むとキックバック復活 ──
  parts.push(
    { kind: 'rollover', id: 'btnL', at: [-2.6, 16.0], r: 0.5, style: 'button' },
    { kind: 'rollover', id: 'btnR', at: [4.1, 16.0], r: 0.5, style: 'button' },
    { kind: 'light', id: 'btnL', at: [-2.6, 16.0], shape: 'circle', size: 0.5, color: '#ffc83a' },
    { kind: 'light', id: 'btnR', at: [4.1, 16.0], shape: 'circle', size: 0.5, color: '#ffc83a' },
  );

  // ── ミッション・エクストラボール・ジャックポットのライト ──
  parts.push(
    { kind: 'light', id: 'm1', at: [-2.25, 11.8], shape: 'diamond', size: 0.4, color: '#ffc83a' },
    { kind: 'light', id: 'm2', at: [-0.75, 12.4], shape: 'diamond', size: 0.4, color: '#ffc83a' },
    { kind: 'light', id: 'm3', at: [0.75, 12.4], shape: 'diamond', size: 0.4, color: '#ffc83a' },
    { kind: 'light', id: 'm4', at: [2.25, 11.8], shape: 'diamond', size: 0.4, color: '#ffc83a' },
    { kind: 'light', id: 'extraBall', at: [2.9, 18.2], shape: 'circle', size: 0.42, color: '#ff4040', label: 'EXTRA' },
    { kind: 'light', id: 'jackpot', at: [-1.4, 18.2], shape: 'star', size: 0.5, color: '#ffd23f' },
  );

  // ── 立っている飾り：ネオンの看板と電球の列（見た目だけ）──
  parts.push(
    { kind: 'deco', type: 'sign', id: 'signDiner', at: [6.7, 35.4], w: 3.0, h: 1.1, color: '#ff4f7a', text: 'DINER', z: 0.4 },
    { kind: 'deco', type: 'bulbs', id: 'bulbsTop', at: [0.75, 35.9], w: 11, z: 1.5, color: '#ffcf5a' },
  );
  return parts;
}
