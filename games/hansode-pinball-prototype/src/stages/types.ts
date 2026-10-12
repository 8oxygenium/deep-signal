// 1ステージ = 配置データ + ルール + 見た目テーマ + 音楽。
// stages/ にこの型のファイルを1つ追加し、stages/index.ts に並べるだけで増やせる。
import type { Game } from '../core/game';
import type { TableEvent, TableEventType } from '../table/table';
import type { TableLayout } from '../table/types';

export interface BonusLine {
  label: string;
  count: number;
  each: number;
}

export interface StageRules {
  /** ゲーム開始時 */
  init?(g: Game): void;
  /** 各ボールの開始時 */
  onBallStart?(g: Game): void;
  onEvent?(g: Game, e: TableEvent): void;
  /** フリッパーを押した（レーンチェンジ等） */
  onFlip?(g: Game, side: 'left' | 'right'): void;
  /** 約60Hzで呼ばれる */
  update?(g: Game, dt: number): void;
  /** ボールが全部落ちた（ボーナス集計の前） */
  onBallEnd?(g: Game): void;
  onMultiballEnd?(g: Game): void;
  /** ボーナスの内訳 */
  bonus?(g: Game): BonusLine[];
}

export type ThemeStyle = 'modern' | 'anime' | 'comic' | 'route50s' | 'cyber' | 'impossible' | 'test';

export interface ThemeColors {
  /** 背景（空間） */
  bg: string;
  /** 床の基本色 */
  floor: string;
  floor2: string;
  /** 壁 */
  wall: string;
  /** 低いガイドレール */
  guide: string;
  /** ゴム */
  rubber: string;
  /** フリッパー本体 */
  flipper: string;
  flipperRubber: string;
  /** バンパー */
  bumper: string;
  bumperCap: string;
  /** スリングショットのカバー */
  sling: string;
  /** ターゲット */
  target: string;
  /** ランプ */
  ramp: string;
  /** 光るアクセント */
  accent: string;
  accent2: string;
  /** ドットマトリクス表示 */
  dmd: string;
  /** 文字 */
  text: string;
}

/** 床（プレイフィールド）の絵を描く関数。renderer がキャンバスと座標変換を渡す */
export interface PaintApi {
  g: CanvasRenderingContext2D;
  /** 台の座標 → キャンバスの座標 */
  map(x: number, y: number): [number, number];
  /** 台の長さ → キャンバスのピクセル */
  scale: number;
  width: number;
  height: number;
  layout: TableLayout;
}

export interface ThemeDef {
  style: ThemeStyle;
  colors: ThemeColors;
  /** 床のアート（ステージごとの絵柄） */
  paint?(api: PaintApi): void;
  /** バックボード（台の奥の看板）の絵 */
  paintBackboard?(g: CanvasRenderingContext2D, w: number, h: number): void;
  /** ブルームの強さ */
  bloom?: number;
  /** 照明の強さ（0..2） */
  light?: number;
  /** 得点表示の形式 */
  scoreDisplay?: 'dmd' | 'reels';
  /** 壁の素材 */
  wallMaterial?: 'glass' | 'metal' | 'toon' | 'wood' | 'neon' | 'hazard' | 'plain';
}

export interface MusicDef {
  /** 曲の候補（ジュークボックスで切り替え） */
  songs: SongDef[];
}

export interface SongDef {
  name: string;
  bpm: number;
  /** 16分の何拍ずらすか（スウィング 0..0.5） */
  swing?: number;
  /** ルート音（MIDI） */
  root: number;
  scale: number[];
  /** コード進行（スケール内の度数、0 起点）1小節ずつ */
  chords: number[];
  /** 音色の組み合わせ */
  kit: 'electro' | 'anime' | 'brass' | 'rockabilly' | 'synthwave' | 'chaos';
  /** メロディ生成の種 */
  seed: number;
  /** 拍子（1小節の16分音符の数） */
  steps?: number;
}

export interface SfxPalette {
  /** 基本音色 */
  wave: OscillatorType;
  /** 音の高さの倍率 */
  pitch: number;
  /** 明るさ（フィルター） */
  bright: number;
  /** チャイム音を鳴らす（ROUTE 50s） */
  chime?: boolean;
  /** グリッチ音 */
  glitch?: boolean;
  /** マンガの擬音っぽい派手な音 */
  punchy?: boolean;
}

export interface StageDef {
  id: string;
  /** 英語名（大きく表示） */
  name: string;
  /** 日本語サブタイトル */
  subtitle: string;
  /** ステージ選択のひとこと */
  tagline: string;
  /** ステージ選択の説明（2〜3行） */
  description: string;
  /** 難しさ 1..5 */
  difficulty: number;
  /** ボールセーブの秒数 */
  ballSave: number;
  /** スキルショットの得点 */
  skillShot: number;
  /** ランクの名前（低い順） */
  ranks: string[];
  /** 生存時間を記録する（IMPOSSIBLE） */
  survival?: boolean;
  /** ステージ選択で特別な演出 */
  ominous?: boolean;
  /** 自動で入る基本点 */
  scores?: Partial<Record<TableEventType, number>>;
  layout(): TableLayout;
  rules(): StageRules;
  theme: ThemeDef;
  music: MusicDef;
  sfx: SfxPalette;
}
