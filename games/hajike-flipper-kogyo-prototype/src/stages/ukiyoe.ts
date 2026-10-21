// ⑦ UKIYO-E ―「浮世絵」
// 木版画の台。神社の参道（鳥居 → 参道 → 社殿）、提灯のバンパー、太鼓のスリング、
// 鯉の滝登りランプと龍が巻きつくランプ、七福神の的、大波マルチボール。見得とツケ、筆文字の擬音。
import { decorateUkiyoe } from './ukiyoe/decorate';
import { ukiyoeLayout } from './ukiyoe/layout';
import { paintUkiyoe } from './ukiyoe/paint';
import { UKIYOE_COLORS } from './ukiyoe/palette';
import { ukiyoeRules, UKIYOE_RANKS } from './ukiyoe/rules';
import { ukiyoeSfx, ukiyoeSongs } from './ukiyoe/sound';
import type { StageDef } from './types';

export const ukiyoeStage: StageDef = {
  id: 'ukiyoe',
  name: 'UKIYO-E',
  subtitle: '浮世絵',
  tagline: '木版画の世界で七福神を集め、大波を呼べ',
  description:
    '鳥居をくぐって参道へ。七福神の的を7人そろえ、鯉の滝登りと龍のランプを通し、社殿のスクープから大波マルチボールを起こそう。見得とツケの音、筆文字の擬音が飛び出す。',
  difficulty: 4,
  ballSave: 10,
  skillShot: 25_000,
  ranks: UKIYOE_RANKS,
  scores: { bumper: 1_000, sling: 100, standup: 1_000, spinner: 200, rollover: 500, ramp: 10_000, scoop: 5_000, 'ramp-enter': 500, gate: 500 },
  layout: ukiyoeLayout,
  rules: ukiyoeRules,
  theme: {
    style: 'ukiyoe',
    colors: UKIYOE_COLORS,
    paint: paintUkiyoe,
    decorate: decorateUkiyoe,
    scoreDisplay: 'fuda',
    bokashi: '#2b4f8f',
    wallMaterial: 'toon',
    bloom: 0.2,
    bloomThreshold: 1.3,
    light: 1.0,
  },
  music: { songs: ukiyoeSongs },
  sfx: ukiyoeSfx,
};
