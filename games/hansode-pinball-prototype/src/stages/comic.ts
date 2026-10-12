// ③ COMIC ―「アメコミ風」
// 網点・太い黒線・原色。台全体がコマ割りの誌面。奥の中央に悪役ボス（HP付き）、手下を倒すと盾が外れる。
// ボスを倒すとヒーローマルチボール（ボスを殴るたびにジャックポット）、次のボスはHPが増えて復活。
import { COMIC_COLORS, comicLayout } from './comic/layout';
import { paintComic } from './comic/paint';
import { comicRules } from './comic/rules';
import type { StageDef } from './types';

export const comicStage: StageDef = {
  id: 'comic',
  name: 'COMIC',
  subtitle: 'アメコミ風',
  tagline: '悪役ボスをぶん殴れ！ コマ割りの誌面の台',
  description: '奥に陣取る悪役ボスにはHPがあり、手下を倒したりHQに入ると盾が外れてダメージ倍増。倒すとヒーローマルチボール！ボスは強くなって何度でも復活する。',
  difficulty: 3,
  ballSave: 9,
  skillShot: 25_000,
  ranks: ['ROOKIE', 'SIDEKICK', 'HERO', 'CHAMPION', 'SUPERHERO', 'GUARDIAN', 'LEGEND'],
  scores: { bumper: 1_000, sling: 100, drop: 1_000, standup: 1_000, spinner: 200, rollover: 500, ramp: 10_000, scoop: 5_000, 'ramp-enter': 500 },
  layout: comicLayout,
  rules: comicRules,
  theme: {
    style: 'comic',
    wallMaterial: 'toon',
    colors: COMIC_COLORS,
    paint: paintComic,
    bloom: 0.25,
    bloomThreshold: 1.6,
    light: 0.85,
  },
  music: { songs: [{ name: 'HERO THEME', bpm: 124, root: 55, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 3, 4, 0], kit: 'brass', seed: 1 }] },
  sfx: { wave: 'sawtooth', pitch: 1.0, bright: 0.7, punchy: true },
};
