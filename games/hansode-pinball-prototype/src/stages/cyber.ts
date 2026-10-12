// CYBER ―「サイバー系」（仮。担当エージェントがこのファイルを完成させる）
import { baseLayout, chassis } from '../table/chassis';
import type { StageDef } from './types';

export const cyberStage: StageDef = {
  id: 'cyber',
  name: 'CYBER',
  subtitle: 'サイバー系',
  tagline: '準備中',
  description: 'このステージは準備中です。',
  difficulty: 4,
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
    style: 'cyber',
    wallMaterial: 'neon',
    colors: {
      bg: '#111118',
      floor: '#55555f',
      floor2: '#66666f',
      wall: '#888899',
      guide: '#ccccd6',
      rubber: '#f2f2f2',
      flipper: '#eeeeee',
      flipperRubber: '#05d9e8',
      bumper: '#ddddee',
      bumperCap: '#ff2a6d',
      sling: '#ccccdd',
      target: '#ffffff',
      ramp: '#aaccff',
      accent: '#05d9e8',
      accent2: '#ff2a6d',
      dmd: '#05d9e8',
      text: '#ffffff',
    },
  },
  music: { songs: [{ name: 'CYBER', bpm: 104, root: 57, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 2, 6], kit: 'synthwave', seed: 1 }] },
  sfx: { wave: 'sawtooth', pitch: 0.9, bright: 0.9, glitch: true },
};
