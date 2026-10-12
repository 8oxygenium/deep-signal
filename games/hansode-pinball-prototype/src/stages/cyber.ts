// ⑤ CYBER ―「サイバー系」
// 黒地にネオンのグリッド、ワイヤーフレーム、グリッチ。難しさ★4。
// ギミック：ハッキングレーン（光る順に通すとファイアウォールが消えて台が書き換わる）、
//          ワープチューブ2本、LOW-G（重力ダウン）、OVERCLOCK（得点2倍）、ROOT チャンバー（磁石で掴んで投げる）、
//          4つのミッション → CORE でマルチボール（ZERO DAY）→ ワープでジャックポット
import { cyberLayout } from './cyber/layout';
import { decorate, paint, paintBackboard } from './cyber/look';
import { createRules } from './cyber/rules';
import { MUSIC, SFX } from './cyber/sound';
import type { StageDef } from './types';

export const cyberStage: StageDef = {
  id: 'cyber',
  name: 'CYBER',
  subtitle: 'サイバー系',
  tagline: '光る順に通せ。ファイアウォールを書き換えろ',
  description:
    '黒地にネオンのグリッドが走る電脳の台。左バス・上のレーン・右バスを「光っている順」に通すとハッキング成功、中央のファイアウォールが消えて隠しチャンバー ROOT が開く。重力が弱まる LOW-G と、ワープチューブにも注目。ボールセーブは短め。',
  difficulty: 4,
  ballSave: 7,
  skillShot: 30_000,
  ranks: ['NOOB', 'SCRIPT KIDDIE', 'PHREAKER', 'HACKER', 'NETRUNNER', 'ROOT', 'GHOST'],
  scores: { bumper: 1_000, sling: 100, drop: 500, standup: 1_500, spinner: 200, rollover: 500, warp: 5_000, scoop: 5_000 },
  layout: cyberLayout,
  rules: createRules,
  theme: {
    style: 'cyber',
    wallMaterial: 'neon',
    colors: {
      bg: '#04050c',
      floor: '#07090f',
      floor2: '#0b0d18',
      wall: '#0a1020',
      guide: '#3d6f8c',
      rubber: '#ff2a6d',
      flipper: '#e8f6ff',
      flipperRubber: '#05d9e8',
      bumper: '#101828',
      bumperCap: '#ff2a6d',
      sling: '#13203a',
      target: '#ffe14a',
      ramp: '#7ee8ff',
      accent: '#05d9e8',
      accent2: '#ff2a6d',
      dmd: '#05d9e8',
      text: '#bff6ff',
    },
    paint,
    paintBackboard,
    decorate,
    bloom: 0.42,
    bloomThreshold: 1.2,
    light: 0.9,
  },
  music: MUSIC,
  sfx: SFX,
};
