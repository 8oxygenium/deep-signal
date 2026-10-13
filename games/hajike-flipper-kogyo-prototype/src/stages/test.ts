// フェーズ2用の灰色の仮の台（手触りの確認とテスト用。ステージ選択には出さない）
import { baseLayout, chassis } from '../table/chassis';
import type { StageDef } from './types';

export const testStage: StageDef = {
  id: 'test',
  name: 'TEST',
  subtitle: '仮の台',
  tagline: '手触り確認用',
  description: '物理と操作の確認用の灰色の台。',
  difficulty: 1,
  ballSave: 10,
  skillShot: 10000,
  ranks: ['ROOKIE', 'PRO'],
  scores: { bumper: 1000, sling: 100, drop: 500, spinner: 100, rollover: 300, ramp: 5000, scoop: 2000 },
  layout: () =>
    baseLayout([
      ...chassis({ kickbackLeft: true }),
      { kind: 'bumper', id: 'b1', at: [-1.6, 28.5] },
      { kind: 'bumper', id: 'b2', at: [1.8, 28.8] },
      { kind: 'bumper', id: 'b3', at: [0.1, 25.8] },
      { kind: 'drop', id: 'd1', bank: 'A', at: [-1.1, 19.5], angle: -90 },
      { kind: 'drop', id: 'd2', bank: 'A', at: [0, 19.5], angle: -90 },
      { kind: 'drop', id: 'd3', bank: 'A', at: [1.1, 19.5], angle: -90 },
      { kind: 'wall', pts: [[-1.75, 19.3], [-1.75, 22.5]], style: 'guide' },
      { kind: 'wall', pts: [[1.75, 19.3], [1.75, 22.5]], style: 'guide' },
      { kind: 'spinner', id: 'spin', at: [-7.9, 22], angle: 90 },
      { kind: 'scoop', id: 'scoop', at: [5.2, 21.5], eject: 215, speed: 26 },
      {
        kind: 'ramp',
        id: 'rampL',
        path: [[-4.6, 17.5], [-5.0, 23], [-5.3, 28.5], [-6.3, 31.5], [-7.9, 30.5], [-7.95, 24], [-7.9, 17], [-6.5, 12.6]],
        h: [0, 1.6, 2.8, 3.4, 3.4, 2.8, 2.0, 1.0],
      },
      { kind: 'rollover', id: 'top1', at: [-1.8, 33.2] },
      { kind: 'rollover', id: 'top2', at: [0.75, 33.6] },
      { kind: 'rollover', id: 'top3', at: [3.3, 33.2] },
      { kind: 'wall', pts: [[-0.55, 32.2], [-0.55, 34.6]], style: 'guide' },
      { kind: 'wall', pts: [[2.05, 32.2], [2.05, 34.6]], style: 'guide' },
    ]),
  rules: () => ({
    onEvent(g, e) {
      if (e.type === 'bank') g.table.resetBank(e.id, 1.5);
    },
    bonus: () => [{ label: 'TEST', count: 1, each: 1000 }],
  }),
  theme: {
    style: 'test',
    colors: {
      bg: '#202428',
      floor: '#6b7076',
      floor2: '#5d6268',
      wall: '#8c939b',
      guide: '#b8c0c8',
      rubber: '#f2f2f2',
      flipper: '#e8e8e8',
      flipperRubber: '#d22',
      bumper: '#9aa',
      bumperCap: '#ddd',
      sling: '#aab',
      target: '#ddd',
      ramp: '#b0c8e0',
      accent: '#ffd040',
      accent2: '#40d0ff',
      dmd: '#ff8a1e',
      text: '#fff',
    },
  },
  music: { songs: [{ name: 'test', bpm: 110, root: 57, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 3, 4], kit: 'electro', seed: 1 }] },
  sfx: { wave: 'triangle', pitch: 1, bright: 0.6 },
};
