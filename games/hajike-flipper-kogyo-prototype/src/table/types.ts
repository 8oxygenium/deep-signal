// 台の部品の配置データ。ステージファイルはこの型の配列で台を作る。
// 座標は台の平面（ボール直径=1）。角度は度（x軸+方向が0、反時計回りが+）。

export type P = [number, number];

export type WallStyle = 'wall' | 'guide' | 'rubber' | 'metal' | 'invisible' | 'glass';

interface Base {
  id?: string;
  /** ランプの id を指定するとそのランプ上の部品になる（省略時は床） */
  layer?: string;
}

export interface WallDef extends Base {
  kind: 'wall';
  pts: P[];
  closed?: boolean;
  style?: WallStyle;
  /** 太さ（半径） */
  r?: number;
  /** 反発係数 */
  e?: number;
  /** 描画の高さ */
  h?: number;
  /** 動く壁（IMPOSSIBLE 等）。ルールから位置を書き換える */
  dynamic?: boolean;
}

export interface ArcDef extends Base {
  kind: 'arc';
  c: P;
  R: number;
  /** 反時計回りに from → to（度） */
  from: number;
  to: number;
  style?: WallStyle;
  r?: number;
  e?: number;
  h?: number;
}

export interface PostDef extends Base {
  kind: 'post';
  at: P;
  r?: number;
  style?: 'rubber' | 'metal' | 'peg';
  e?: number;
  dynamic?: boolean;
}

export interface BumperDef extends Base {
  kind: 'bumper';
  id: string;
  at: P;
  r?: number;
  kick?: number;
  dynamic?: boolean;
}

export interface SlingDef extends Base {
  kind: 'sling';
  id: string;
  pts: [P, P, P];
  /** 蹴る辺：pts[i] → pts[(i+1)%3] */
  kickEdge: number;
  kick?: number;
}

export interface DropDef extends Base {
  kind: 'drop';
  id: string;
  bank: string;
  at: P;
  /** 的の正面が向く方向（度） */
  angle: number;
  w?: number;
}

export interface StandupDef extends Base {
  kind: 'standup';
  id: string;
  at: P;
  angle: number;
  w?: number;
  /** 大きい的（COMIC のボス等） */
  big?: boolean;
}

export interface SpinnerDef extends Base {
  kind: 'spinner';
  id: string;
  at: P;
  /** ボールが通る向き（度） */
  angle: number;
  w?: number;
}

export interface RolloverDef extends Base {
  kind: 'rollover';
  id: string;
  at: P;
  r?: number;
  style?: 'lane' | 'button' | 'star';
}

export interface GateDef extends Base {
  kind: 'gate';
  id?: string;
  a: P;
  b: P;
  /** 通してよい向き */
  pass: P;
}

export interface ScoopDef extends Base {
  kind: 'scoop';
  id: string;
  at: P;
  /** 吐き出す向き（度） */
  eject: number;
  speed: number;
  hold?: number;
  r?: number;
}

export interface KickbackDef extends Base {
  kind: 'kickback';
  id: string;
  at: P;
  eject: number;
  speed: number;
}

export interface MagnetDef extends Base {
  kind: 'magnet';
  id: string;
  at: P;
  r: number;
  strength: number;
}

export interface RampDef extends Base {
  kind: 'ramp';
  id: string;
  /** 中心線 */
  path: P[];
  /** 各点の高さ */
  h: number[];
  /** 内側の幅 */
  w?: number;
  style?: 'plastic' | 'wire' | 'metal' | 'neon';
  /** 入口から床の壁を延ばす長さ（ランプの下にボールが潜り込まないように） */
  mouth?: number;
}

export interface FlipperDef extends Base {
  kind: 'flipper';
  id: string;
  side: 'left' | 'right';
  pivot: P;
  length: number;
  r0?: number;
  r1?: number;
  rest: number;
  up: number;
  /** 角速度の倍率 */
  power?: number;
}

export interface PlungerDef extends Base {
  kind: 'plunger';
  /** ボールが置かれる中心 */
  at: P;
  /** 最弱〜最強の発射速度 */
  minSpeed?: number;
  maxSpeed?: number;
}

export interface DrainDef extends Base {
  kind: 'drain';
  y: number;
  x0: number;
  x1: number;
}

export interface WarpDef extends Base {
  kind: 'warp';
  id: string;
  at: P;
  to: P;
  eject: number;
  speed: number;
  travel?: number;
  /** 描画用のチューブ経路 */
  tube?: P[];
  tubeH?: number[];
}

export interface TriggerDef extends Base {
  kind: 'trigger';
  id: string;
  a: P;
  b: P;
  /** この向きに通ったときだけ */
  dir?: P;
}

export type LightShape = 'circle' | 'arrow' | 'tri' | 'star' | 'rect' | 'diamond';

export interface LightDef extends Base {
  kind: 'light';
  id: string;
  at: P;
  shape?: LightShape;
  size?: number;
  rot?: number;
  color?: string;
  label?: string;
}

/** 当たり判定なしの飾り（描画側が type ごとに作る） */
export interface DecoDef extends Base {
  kind: 'deco';
  type: string;
  at: P;
  rot?: number;
  scale?: number;
  color?: string;
  text?: string;
  z?: number;
  w?: number;
  d?: number;
  h?: number;
}

export type PartDef =
  | WallDef
  | ArcDef
  | PostDef
  | BumperDef
  | SlingDef
  | DropDef
  | StandupDef
  | SpinnerDef
  | RolloverDef
  | GateDef
  | ScoopDef
  | KickbackDef
  | MagnetDef
  | RampDef
  | FlipperDef
  | PlungerDef
  | DrainDef
  | WarpDef
  | TriggerDef
  | LightDef
  | DecoDef;

export interface TableLayout {
  /** 台の外枠（これより外へ出たボールは安全な位置へ戻す） */
  bounds: { x0: number; x1: number; y0: number; y1: number };
  parts: PartDef[];
  /** 詰まったボールを戻す安全な位置 */
  safeSpot: P;
  /** 台の重力（省略時は標準） */
  gravity?: number;
}
