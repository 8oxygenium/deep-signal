// ⑥ IMPOSSIBLE ―「無理な感じのステージ」
// 理不尽だけど笑える、ほぼクリア不能な台。でも数十秒は粘れる。
// 台が回る・傾く／フリッパーが縮む・巨大化する／左右が入れ替わる／重力が逆向き／停電／
// 死に穴（アウトレーン）が動く／バンパーが歩き回る／タイヤが降ってくる／地震 … を、必ず予告してから発動する。
// スコアの他に「生存時間」を記録する。
import { impossibleKit, impossibleSfx } from './impossible/audio';
import { impossibleLayout } from './impossible/layout';
import { decorate, paint, paintBackboard } from './impossible/paint';
import { createRules } from './impossible/rules';
import type { StageDef } from './types';

export const impossibleStage: StageDef = {
  id: 'impossible',
  name: 'IMPOSSIBLE',
  subtitle: '無理な感じのステージ',
  tagline: '生きて帰れると思うな',
  description: '台が回り、床が傾き、フリッパーは縮み、左右まで入れ替わる。ボールセーブはたったの5秒。問われるのは点数より、生き延びた秒数。',
  difficulty: 5,
  ballSave: 5,
  skillShot: 50_000,
  ranks: ['迷子', '見学者', '作業員', '現場監督', '生還者', '不死身', '伝説のヒマ人'],
  survival: true,
  ominous: true,
  scores: { bumper: 1_000, sling: 100, drop: 500, standup: 1_000, spinner: 200, rollover: 500, ramp: 10_000, scoop: 5_000, 'ramp-enter': 500 },
  layout: impossibleLayout,
  rules: createRules,
  theme: {
    style: 'impossible',
    wallMaterial: 'hazard',
    paint,
    paintBackboard,
    decorate,
    bloom: 0.6,
    bloomThreshold: 1.05,
    light: 0.95,
    colors: {
      bg: '#0b0709',
      floor: '#4b4a52',
      floor2: '#5d5b63',
      wall: '#f5c400',
      guide: '#e8c21a',
      rubber: '#1c1c1c',
      flipper: '#ffd400',
      flipperRubber: '#d71920',
      bumper: '#2a2a2e',
      bumperCap: '#ff2a2a',
      sling: '#ffd400',
      target: '#fff2a0',
      ramp: '#e8d060',
      accent: '#ffd400',
      accent2: '#ff2a2a',
      dmd: '#ff3030',
      text: '#ffffff',
    },
  },
  music: { songs: [{ name: 'PANIC ALARM', bpm: 148, root: 52, scale: [0, 1, 3, 5, 6, 8, 10], chords: [0, 1, 5, 6], kit: impossibleKit, seed: 13, steps: 14 }] },
  sfx: { wave: 'square', pitch: 0.8, bright: 0.7, custom: impossibleSfx },
};
