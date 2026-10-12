// ROUTE 50s ―「昔のアメリカン」（仮。担当エージェントがこのファイルを完成させる）
import { baseLayout, chassis } from '../table/chassis';
import type { StageDef } from './types';

export const route50sStage: StageDef = {
  id: 'route50s',
  name: 'ROUTE 50s',
  subtitle: '昔のアメリカン',
  tagline: '準備中',
  description: 'このステージは準備中です。',
  difficulty: 3,
  ballSave: 10,
  skillShot: 25_000,
  ranks: ['ROOKIE', 'PRO'],
  scores: { bumper: 1_000, sling: 100 },
  layout: () =>
    baseLayout([
      ...chassis({}),
      { kind: 'bumper', id: 'b1', at: [-1.0, 27.5] },
      { kind: 'bumper', id: 'b2', at: [2.5, 27.5] },
      { kind: 'bumper', id: 'b3', at: [0.75, 24.5] },
    ]),
  rules: () => ({}),
  theme: {
    style: 'route50s',
    wallMaterial: 'wood',
    scoreDisplay: 'reels',
    colors: {
      bg: '#111118',
      floor: '#55555f',
      floor2: '#66666f',
      wall: '#888899',
      guide: '#ccccd6',
      rubber: '#f2f2f2',
      flipper: '#eeeeee',
      flipperRubber: '#ff3355',
      bumper: '#ddddee',
      bumperCap: '#4fe3ff',
      sling: '#ccccdd',
      target: '#ffffff',
      ramp: '#aaccff',
      accent: '#ff3355',
      accent2: '#4fe3ff',
      dmd: '#ffb347',
      text: '#ffffff',
    },
  },
  music: { songs: [{ name: 'ROUTE 50s', bpm: 172, root: 55, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 5, 3, 4], kit: 'rockabilly', seed: 1, swing: 0.3 }] },
  sfx: { wave: 'triangle', pitch: 1.0, bright: 0.6, chime: true },
};
