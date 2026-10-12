// 1ステージ = 配置データ + ルール + 見た目テーマ + 音楽。
// stages/ にこの型のファイルを1つ追加し、stages/index.ts に並べるだけで増やせる。
import type * as THREE_NS from 'three';
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

/** ステージ専用の3D装飾を作るときに渡される道具（three は直接 import しなくてよい） */
export interface DecorateApi {
  THREE: typeof THREE_NS;
  /** 台のグループ。座標は (x, 高さ, -y) */
  group: THREE_NS.Group;
  game: Game;
  quality: 'low' | 'mid' | 'high';
  /** 台の座標 (x, y, 高さ) → three の座標 */
  at(x: number, y: number, h?: number): THREE_NS.Vector3;
  /** 毎フレーム呼ばれる処理を登録 */
  onFrame(fn: (t: number, dt: number) => void): void;
  /** テーマ色の光る素材 */
  glow(color: string): THREE_NS.MeshStandardMaterial;
  /** 金属（クローム）の素材 */
  metal(): THREE_NS.Material;
  /** キャンバスに描いてテクスチャを作る */
  canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE_NS.CanvasTexture;
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
  /** ブルームのしきい値（明るい台は高くして、発光部品だけ光らせる） */
  bloomThreshold?: number;
  /** 照明の強さ（0..2） */
  light?: number;
  /** 得点表示の形式 */
  scoreDisplay?: 'dmd' | 'reels';
  /** 壁の素材 */
  wallMaterial?: 'glass' | 'metal' | 'toon' | 'wood' | 'neon' | 'hazard' | 'plain';
  /** ステージ専用の3D装飾（ボス、ジュークボックス等） */
  decorate?(api: DecorateApi): void;
}

export interface MusicDef {
  /** 曲の候補（ジュークボックスで切り替え） */
  songs: SongDef[];
}

/** BGMの1ステップ分を鳴らすときに渡される道具（ステージ専用の編成を書くとき用） */
export interface KitApi {
  /** 0 = 通常、1 = マルチボール中（盛り上げる） */
  hot: boolean;
  step: number;
  bar: number;
  /** 発音時刻（AudioContext の時間） */
  t: number;
  stepDur: number;
  stepsPerBar: number;
  /** 今の小節のコード（MIDI）とルート（1オクターブ下） */
  chord: number[];
  root: number;
  /** メロディ（MIDI。-1=休み） */
  mel: number;
  /** メロディの長さ（ステップ数） */
  melLen: number;
  counter: number;
  /** パターン文字列の x の位置で true（例 'x...x...'） */
  pat(p: string): boolean;
  mtof(m: number): number;
  kick(t: number, gain?: number, punch?: number): void;
  snare(t: number, gain?: number, big?: boolean): void;
  hat(t: number, gain?: number, open?: boolean): void;
  brush(t: number, gain?: number): void;
  noise(t: number, dur: number, o: { gain: number; type: BiquadFilterType; freq: number; q?: number; reverb?: number }): void;
  voice(
    freq: number,
    t: number,
    dur: number,
    o: { type?: OscillatorType; gain?: number; attack?: number; release?: number; filter?: number; filterEnv?: number; detune?: number; vibrato?: number; reverb?: number; pan?: number; glideFrom?: number },
  ): void;
}

export type KitFn = (k: KitApi) => void;

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
  /** 音色の組み合わせ（用意された編成の名前、またはステージ専用の関数） */
  kit: 'electro' | 'anime' | 'brass' | 'rockabilly' | 'synthwave' | 'chaos' | KitFn;
  /** メロディ生成の種 */
  seed: number;
  /** 拍子（1小節の16分音符の数） */
  steps?: number;
}

/** 効果音を自作するときに渡される道具 */
export interface SynthApi {
  tone(o: { freq: number; to?: number; type?: OscillatorType; dur: number; gain?: number; attack?: number; at?: number; pan?: number; filter?: number; q?: number; reverb?: number; detune?: number; curve?: 'exp' | 'lin' }): void;
  noiseHit(o: { dur: number; gain?: number; type?: BiquadFilterType; freq?: number; to?: number; q?: number; at?: number; pan?: number; reverb?: number; attack?: number }): void;
  bell(freq: number, dur: number, gain: number, at?: number, pan?: number): void;
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
  /** ステージ専用の効果音（名前 → 鳴らし方）。同じ名前なら標準の音より優先 */
  custom?: Record<string, (s: SynthApi, o: { pan: number; speed: number }) => void>;
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
  /** 到達テストで「届かなくてよい」部品のID */
  reachExempt?: string[];
  layout(): TableLayout;
  rules(): StageRules;
  theme: ThemeDef;
  music: MusicDef;
  sfx: SfxPalette;
}
