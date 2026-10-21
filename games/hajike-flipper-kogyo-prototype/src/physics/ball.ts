import { BALL_RADIUS, FLOOR } from './constants';

export interface Capture {
  /** 捕まえている部品のID（スクープ、ワープ、マグネット、プランジャー等） */
  by: string;
  /** 経過時間 */
  t: number;
}

let nextBallId = 1;

export class Ball {
  readonly id = nextBallId++;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  /** ステップ開始時の位置（すり抜け判定に使う） */
  px: number;
  py: number;
  readonly r = BALL_RADIUS;
  layer = FLOOR;
  /** 描画用の高さ（ランプ上で上がる） */
  z = 0;
  active = true;
  captured: Capture | null = null;
  /** 描画しない（ワープ中など） */
  hidden = false;
  /** 外部から加える加速度（ランプの坂、マグネット等。毎ステップ table 側が設定） */
  ax = 0;
  ay = 0;
  /** 詰まり検出：ほぼ動いていない時間 */
  stillTime = 0;
  stillX: number;
  stillY: number;
  /** このステップで何かに接触したか（フリッパー上で抱えているか判定用） */
  touchingFlipper: string | null = null;
  /** 前回の自動揺らしの場所と時刻（同じ穴で繰り返し詰まるのを見分ける） */
  lastAutoNudgeX = 0;
  lastAutoNudgeY = 0;
  lastAutoNudgeT = -1e9;
  /** 何かの壁に触れているか */
  touching = false;
  /** ボール同士の衝突で押し出された */
  pushed = false;
  /** 描画用の回転（転がり） */
  rollX = 0;
  rollY = 0;
  /** ランプの経路キャッシュ */
  rampSeg = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.px = x;
    this.py = y;
    this.stillX = x;
    this.stillY = y;
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vy);
  }

  place(x: number, y: number, vx = 0, vy = 0): void {
    this.x = x;
    this.y = y;
    this.px = x;
    this.py = y;
    this.vx = vx;
    this.vy = vy;
    this.stillTime = 0;
    this.stillX = x;
    this.stillY = y;
  }
}
