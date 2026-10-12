// ANIME ―「アニメ風」（仮。担当エージェントがこのファイルを完成させる）
import { baseLayout, chassis } from '../table/chassis';
import type { StageDef } from './types';

export const animeStage: StageDef = {
  id: 'anime',
  name: 'ANIME',
  subtitle: 'アニメ風',
  tagline: '準備中',
  description: 'このステージは準備中です。',
  difficulty: 2,
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
    style: 'anime',
    wallMaterial: 'toon',
    colors: {
      bg: '#111118',
      floor: '#55555f',
      floor2: '#66666f',
      wall: '#888899',
      guide: '#ccccd6',
      rubber: '#f2f2f2',
      flipper: '#eeeeee',
      flipperRubber: '#ff4fa3',
      bumper: '#ddddee',
      bumperCap: '#ffe14f',
      sling: '#ccccdd',
      target: '#ffffff',
      ramp: '#aaccff',
      accent: '#ff4fa3',
      accent2: '#ffe14f',
      dmd: '#ff6fb5',
      text: '#ffffff',
    },
  },
  music: { songs: [{ name: 'ANIME', bpm: 158, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 5, 3, 4], kit: 'anime', seed: 1 }] },
  sfx: { wave: 'square', pitch: 1.2, bright: 0.8 },
};
