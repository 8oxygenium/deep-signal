// ④ ROUTE 50s ―「昔のアメリカン」
// 1950年代のダイナー／ドライブイン。木目、クローム、電球、ネオン管。得点は回転ドラム式のスコアリール、
// 当たると「チン」と鳴る電気機械式のチャイム。
// ギミック：ジュークボックス（当てると曲が変わる）、壁ぎわの追加フリッパー、ポップバンパー5つ、
//           ドライブインシアター（スクープ）、4つのミッション → DRAG RACE マルチボール → ジャックポット
//
// 配置は ./route50s/layout.ts、ルールは ./route50s/rules.ts、絵は ./route50s/art.ts、
// 3D の飾りは ./route50s/decor.ts、音は ./route50s/music.ts。
import { baseLayout } from '../table/chassis';
import { layoutParts } from './route50s/layout';
import { rules } from './route50s/rules';
import { paint, paintBackboard } from './route50s/art';
import { decorate } from './route50s/decor';
import { SFX, SONGS } from './route50s/music';
import type { StageDef } from './types';

export const route50sStage: StageDef = {
  id: 'route50s',
  name: 'ROUTE 50s',
  subtitle: '昔のアメリカン',
  tagline: '木目とクローム、ネオンとジュークボックスの台',
  description:
    '50年代のダイナーとドライブイン。壁ぎわの追加フリッパーと5つのバンパーで暴れるボールを操ろう。ジュークボックスを叩くと曲が変わる。ORDER UP・CRUISE・DRIVE-IN MOVIE・JUKEBOX の4ミッションで DRAG RACE マルチボール。',
  difficulty: 3,
  ballSave: 9,
  skillShot: 25_000,
  ranks: ['BUS BOY', 'SODA JERK', 'CAR HOP', 'SHORT ORDER COOK', 'HOT RODDER', 'ROCK & ROLLER', 'KING OF THE ROAD'],
  // 得点は電気機械式らしく小さめ（10 / 100 / 1000 点でチャイムが変わる）。ほかの得点はルールで加える
  scores: { bumper: 100, sling: 10, rollover: 100 },
  layout: () => baseLayout(layoutParts(), { safeSpot: [0.75, 36.6] }),
  rules,
  theme: {
    style: 'route50s',
    wallMaterial: 'wood',
    scoreDisplay: 'reels',
    colors: {
      bg: '#150c08',
      floor: '#2b9590',
      floor2: '#46bdb3',
      wall: '#d9dde4',
      guide: '#e6e9ee',
      rubber: '#fff0d2',
      flipper: '#f6ecd6',
      flipperRubber: '#d3202a',
      bumper: '#dfe3ea',
      bumperCap: '#fff0c8',
      sling: '#e0343a',
      target: '#ffe9a8',
      ramp: '#aaccff',
      accent: '#ff3b4a',
      accent2: '#33e6d6',
      dmd: '#ffa43a',
      text: '#24120a',
    },
    paint,
    paintBackboard,
    decorate,
    bloom: 0.5,
    bloomThreshold: 1.15,
    light: 0.9,
  },
  music: { songs: SONGS },
  sfx: SFX,
};
