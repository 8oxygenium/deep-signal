// COMIC ―「アメコミ風」（仮。担当エージェントがこのファイルを完成させる）
import { baseLayout, chassis } from '../table/chassis';
import type { StageDef } from './types';

export const comicStage: StageDef = {
  id: 'comic',
  name: 'COMIC',
  subtitle: 'アメコミ風',
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
    style: 'comic',
    wallMaterial: 'toon',
    colors: {
      bg: '#111118',
      floor: '#55555f',
      floor2: '#66666f',
      wall: '#888899',
      guide: '#ccccd6',
      rubber: '#f2f2f2',
      flipper: '#eeeeee',
      flipperRubber: '#ff2d2d',
      bumper: '#ddddee',
      bumperCap: '#2f6bff',
      sling: '#ccccdd',
      target: '#ffffff',
      ramp: '#aaccff',
      accent: '#ff2d2d',
      accent2: '#2f6bff',
      dmd: '#ffd500',
      text: '#ffffff',
    },
  },
  music: { songs: [{ name: 'COMIC', bpm: 124, root: 55, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 3, 4, 0], kit: 'brass', seed: 1 }] },
  sfx: { wave: 'sawtooth', pitch: 1.0, bright: 0.7, punchy: true },
};
