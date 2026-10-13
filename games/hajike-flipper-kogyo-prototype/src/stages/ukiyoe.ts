// ステージ⑦ UKIYO-E（浮世絵）― 仮の登録。担当エージェントがこのファイルと src/stages/ukiyoe/ を作り直す。
// 今は MODERN の台を借りて、浮世絵用の共通部分（木版画風の画面効果・木札の漢数字・筆文字・見得）が動くことだけを確かめる。
import type { StageDef } from './types';
import { modernStage } from './modern';

export const ukiyoeStage: StageDef = {
  ...modernStage,
  id: 'ukiyoe',
  name: 'UKIYO-E',
  subtitle: '浮世絵',
  tagline: '（制作中）コテコテの和風、木版画の台',
  description: '（制作中）',
  difficulty: 4,
  theme: {
    ...modernStage.theme,
    style: 'ukiyoe',
    scoreDisplay: 'fuda',
    wallMaterial: 'wood',
    bloom: 0.25,
    bloomThreshold: 1.2,
    decorate: undefined,
  },
};
