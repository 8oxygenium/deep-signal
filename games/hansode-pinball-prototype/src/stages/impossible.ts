// IMPOSSIBLE ―「無理な感じのステージ」（仮。担当エージェントがこのファイルを完成させる）
import { baseLayout, chassis } from '../table/chassis';
import type { StageDef } from './types';

export const impossibleStage: StageDef = {
  id: 'impossible',
  name: 'IMPOSSIBLE',
  subtitle: '無理な感じのステージ',
  tagline: '準備中',
  description: 'このステージは準備中です。',
  difficulty: 5,
  ballSave: 10,
  skillShot: 25_000,
  ranks: ['ROOKIE', 'PRO'],
  survival: true,
  ominous: true,
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
    style: 'impossible',
    wallMaterial: 'hazard',
    colors: {
      bg: '#111118',
      floor: '#55555f',
      floor2: '#66666f',
      wall: '#888899',
      guide: '#ccccd6',
      rubber: '#f2f2f2',
      flipper: '#eeeeee',
      flipperRubber: '#ffd400',
      bumper: '#ddddee',
      bumperCap: '#ff2a2a',
      sling: '#ccccdd',
      target: '#ffffff',
      ramp: '#aaccff',
      accent: '#ffd400',
      accent2: '#ff2a2a',
      dmd: '#ff3030',
      text: '#ffffff',
    },
  },
  music: { songs: [{ name: 'IMPOSSIBLE', bpm: 146, root: 52, scale: [0, 1, 3, 5, 6, 8, 10], chords: [0, 1, 5, 6], kit: 'chaos', seed: 1, steps: 14 }] },
  sfx: { wave: 'square', pitch: 0.8, bright: 0.7 },
};
