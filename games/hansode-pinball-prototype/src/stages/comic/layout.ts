// COMIC の配置（コマ割りの誌面のような台）
// 奥の中央に悪役ボス、左右に手下のドロップバンク、左に斜めのスカイウェイ（ランプ1本）、右に本部スクープ「HQ」。
import { baseLayout, chassis } from '../../table/chassis';
import type { PartDef, TableLayout } from '../../table/types';

/** ボスの位置（標準の大きな的 + 透明の屋根） */
export const BOSS_AT: [number, number] = [0.75, 33.0];

export const COMIC_COLORS = {
  bg: '#14122b',
  floor: '#fff1c9',
  floor2: '#ffe8a3',
  wall: '#ffd21f',
  guide: '#fbfbff',
  rubber: '#ff3b30',
  flipper: '#2f6bff',
  flipperRubber: '#ff2d2d',
  bumper: '#ffffff',
  bumperCap: '#2f6bff',
  sling: '#ff3b30',
  target: '#ffd21f',
  ramp: '#7cc4ff',
  accent: '#ff2d2d',
  accent2: '#2f6bff',
  dmd: '#ffd500',
  text: '#15131f',
};

export function layoutParts(): PartDef[] {
  return [
    ...chassis({ kickbackLeft: true, flipperLength: 3.2, slingKick: 32 }),

    // ───── ボス（中央奥）─────
    // 大きな的。顔は下（手前）向き。上に乗ったボールが転がり落ちるよう、透明の屋根（とんがり）をかぶせる
    { kind: 'standup', id: 'boss', at: BOSS_AT, angle: -90, w: 3.0, big: true },
    { kind: 'wall', id: 'bossRoof', pts: [[-1.1, 33.1], [0.75, 34.55], [2.6, 33.1]], style: 'invisible', r: 0.1 },

    // ───── 手下（左右のドロップバンク）─────
    // 左：縦に3枚、中央（コミックのコマの手前）を向く
    { kind: 'drop', id: 'hl1', bank: 'hl', at: [-5.85, 28.4], angle: 12, w: 1.0 },
    { kind: 'drop', id: 'hl2', bank: 'hl', at: [-5.6, 29.9], angle: 0, w: 1.0 },
    { kind: 'drop', id: 'hl3', bank: 'hl', at: [-5.85, 31.4], angle: -12, w: 1.0 },
    // 右
    { kind: 'drop', id: 'hr1', bank: 'hr', at: [7.35, 28.4], angle: 168, w: 1.0 },
    { kind: 'drop', id: 'hr2', bank: 'hr', at: [7.1, 29.9], angle: 180, w: 1.0 },
    { kind: 'drop', id: 'hr3', bank: 'hr', at: [7.35, 31.4], angle: 192, w: 1.0 },

    // ───── ポップバンパー（右寄りの三角）─────
    { kind: 'bumper', id: 'b1', at: [2.4, 22.8] },
    { kind: 'bumper', id: 'b2', at: [5.0, 24.6] },
    { kind: 'bumper', id: 'b3', at: [2.6, 26.6] },

    // ───── 左：スカイウェイ（ランプ1本。ボスへ向けて斜めに駆け上がる）─────
    {
      kind: 'ramp',
      id: 'sky',
      path: [[-3.6, 16.4], [-3.35, 19.2], [-2.75, 22.0], [-1.95, 24.6], [-1.05, 26.9]],
      h: [0, 0.9, 1.8, 2.4, 2.5],
    },

    // 左の外周：スピナーとループ判定、パワー的2枚（ガイドの壁に埋め込み）
    { kind: 'spinner', id: 'spin', at: [-7.9, 21.6], angle: 90, w: 1.3 },
    { kind: 'trigger', id: 'loopL', a: [-8.6, 24.2], b: [-7.2, 24.2], dir: [0, 1] },
    { kind: 'standup', id: 'powA', at: [-6.8, 22.4], angle: 0 },
    { kind: 'standup', id: 'powB', at: [-6.8, 24.1], angle: 0 },

    // 右の外周：ループ判定
    { kind: 'trigger', id: 'loopR', a: [7.2, 23.8], b: [8.6, 23.8], dir: [0, 1] },

    // ───── 右：本部スクープ「HQ」─────
    { kind: 'scoop', id: 'hq', at: [4.9, 18.6], eject: 106, speed: 38, hold: 1.0, r: 0.72 },

    // ───── ライト ─────
    { kind: 'light', id: 'sky', at: [-3.9, 14.6], shape: 'arrow', rot: 84, size: 0.6, color: '#2f6bff', label: 'SKY' },
    { kind: 'light', id: 'hq', at: [4.9, 16.5], shape: 'arrow', rot: 90, size: 0.55, color: '#ff2d2d', label: 'HQ' },
    { kind: 'light', id: 'orbitL', at: [-6.75, 15.4], shape: 'arrow', rot: 118, size: 0.45, color: '#ff8a1e' },
    { kind: 'light', id: 'orbitR', at: [6.75, 15.4], shape: 'arrow', rot: 62, size: 0.45, color: '#ff8a1e' },
    { kind: 'light', id: 'hl', at: [-4.4, 30.0], shape: 'tri', rot: 180, size: 0.4, color: '#ff2d2d' },
    { kind: 'light', id: 'hr', at: [5.9, 30.0], shape: 'tri', rot: 0, size: 0.4, color: '#ff2d2d' },
    { kind: 'light', id: 'shL', at: [-2.3, 30.9], shape: 'circle', size: 0.34, color: '#35e0ff' },
    { kind: 'light', id: 'shR', at: [3.8, 30.9], shape: 'circle', size: 0.34, color: '#35e0ff' },
    { kind: 'light', id: 'boss', at: [0.75, 30.3], shape: 'star', size: 0.55, color: '#ffd21f', label: 'BOSS' },
    { kind: 'light', id: 'powA', at: [-6.05, 22.4], shape: 'tri', rot: 0, size: 0.3, color: '#2f6bff' },
    { kind: 'light', id: 'powB', at: [-6.05, 24.1], shape: 'tri', rot: 0, size: 0.3, color: '#2f6bff' },
    { kind: 'light', id: 'extraBall', at: [0.75, 17.2], shape: 'circle', size: 0.42, color: '#ff4040', label: 'EXTRA' },
    { kind: 'light', id: 'jackpot', at: [-0.9, 19.8], shape: 'star', size: 0.55, color: '#ffd21f' },
    { kind: 'light', id: 'm1', at: [-0.55, 13.7], shape: 'diamond', size: 0.4, color: '#2f6bff', label: 'HUNT' },
    { kind: 'light', id: 'm2', at: [0.75, 14.1], shape: 'diamond', size: 0.4, color: '#2f6bff', label: 'BAM' },
    { kind: 'light', id: 'm3', at: [2.05, 13.7], shape: 'diamond', size: 0.4, color: '#2f6bff', label: 'SKY' },
    { kind: 'light', id: 'x2', at: [-1.65, 10.9], shape: 'circle', size: 0.32, color: '#ffb02e', label: '2x' },
    { kind: 'light', id: 'x3', at: [-0.55, 11.3], shape: 'circle', size: 0.32, color: '#ffb02e', label: '3x' },
    { kind: 'light', id: 'x4', at: [0.55, 11.3], shape: 'circle', size: 0.32, color: '#ffb02e', label: '4x' },
    { kind: 'light', id: 'x5', at: [1.65, 10.9], shape: 'circle', size: 0.32, color: '#ffb02e', label: '5x' },
  ];
}

export function comicLayout(): TableLayout {
  return baseLayout(layoutParts(), { safeSpot: [0.75, 36.8] });
}
