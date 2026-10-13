// ② ANIME ―「アニメ風」
// トゥーン塗り＋輪郭線、鮮やかな色、舞い散る桜と星。
// ギミック：変身ゲージ（満タンでスクープから必殺技カットイン → マルチボール）、コンボで得点倍率アップ、
//          中央を駆け上がる MAGIC ROAD、広く狙いやすい左右のオービット、右上のミニフリッパー。
import { C, decorate, paint, paintBackboard } from './anime/art';
import { animeLayout } from './anime/layout';
import { animeRules } from './anime/rules';
import { ANIME_SFX, ANIME_SONGS } from './anime/sound';
import type { StageDef } from './types';

export const animeStage: StageDef = {
  id: 'anime',
  name: 'ANIME',
  subtitle: 'アニメ風',
  tagline: '変身ゲージを溜めて、必殺技でマルチボール！',
  description: 'ランプやオービットを続けて決めるとコンボで得点倍率アップ。変身ゲージを満タンにして左のスクープへ入れると、必殺技カットインからマルチボール。右上のミニフリッパーも使いこなそう。',
  difficulty: 2,
  ballSave: 11,
  skillShot: 30_000,
  ranks: ['ROOKIE', 'APPRENTICE', 'HERO', 'CHAMPION', 'STAR', 'LEGEND', 'MYTHIC'],
  scores: { bumper: 1_000, sling: 100, standup: 1_500, spinner: 100, rollover: 500, ramp: 10_000, scoop: 5_000, 'ramp-enter': 500 },
  layout: animeLayout,
  rules: animeRules,
  theme: {
    style: 'anime',
    colors: C,
    paint,
    paintBackboard,
    decorate,
    bloom: 0.45,
    bloomThreshold: 1.15,
    light: 0.8,
    wallMaterial: 'toon',
  },
  music: { songs: ANIME_SONGS },
  sfx: ANIME_SFX,
};
