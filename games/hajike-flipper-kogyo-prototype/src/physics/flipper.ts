// フリッパー：支点まわりに回転する先細りのカプセル。
// 押した瞬間に素早く上がり（約0.035秒）、当たった位置の回転速度をボールに伝える。
import { FLOOR } from './constants';

export interface FlipperParams {
  id: string;
  side: 'left' | 'right';
  pivotX: number;
  pivotY: number;
  length: number;
  /** 付け根の太さ（半径） */
  r0: number;
  /** 先端の太さ（半径） */
  r1: number;
  /** 休み位置の角度（度、台の座標系で反時計回りが+） */
  restDeg: number;
  /** 上げた位置の角度（度） */
  upDeg: number;
  /** 上げるときの最大角速度（rad/s） */
  omegaUp?: number;
  /** 上げるときの角加速度（rad/s²） */
  accelUp?: number;
  omegaDown?: number;
  accelDown?: number;
  restitution?: number;
  friction?: number;
  layer?: number;
}

export class Flipper {
  readonly id: string;
  readonly side: 'left' | 'right';
  pivotX: number;
  pivotY: number;
  baseLength: number;
  baseR0: number;
  baseR1: number;
  /** 長さの倍率（IMPOSSIBLE の縮む/巨大化ギミック用） */
  scale = 1;
  rest: number;
  up: number;
  /** +1 なら反時計回りに上がる */
  readonly dir: number;
  angle: number;
  prevAngle: number;
  omega = 0;
  pressed = false;
  /** TILT 中などは false */
  enabled = true;
  omegaUp: number;
  accelUp: number;
  omegaDown: number;
  accelDown: number;
  restitution: number;
  friction: number;
  layer: number;
  /** 前ステップで上がり切っていたか（効果音用） */
  atUp = false;

  constructor(p: FlipperParams) {
    this.id = p.id;
    this.side = p.side;
    this.pivotX = p.pivotX;
    this.pivotY = p.pivotY;
    this.baseLength = p.length;
    this.baseR0 = p.r0;
    this.baseR1 = p.r1;
    this.rest = (p.restDeg * Math.PI) / 180;
    this.up = (p.upDeg * Math.PI) / 180;
    this.dir = this.up > this.rest ? 1 : -1;
    this.angle = this.rest;
    this.prevAngle = this.rest;
    this.omegaUp = p.omegaUp ?? 30;
    this.accelUp = p.accelUp ?? 2600;
    this.omegaDown = p.omegaDown ?? 16;
    this.accelDown = p.accelDown ?? 1300;
    this.restitution = p.restitution ?? 0.42;
    this.friction = p.friction ?? 0.08;
    this.layer = p.layer ?? FLOOR;
  }

  get length(): number {
    return this.baseLength * this.scale;
  }
  get r0(): number {
    return this.baseR0 * Math.sqrt(this.scale);
  }
  get r1(): number {
    return this.baseR1 * Math.sqrt(this.scale);
  }

  get tipX(): number {
    return this.pivotX + Math.cos(this.angle) * this.length;
  }
  get tipY(): number {
    return this.pivotY + Math.sin(this.angle) * this.length;
  }

  /** 0 = 休み、1 = 上がり切り */
  get raise(): number {
    return (this.angle - this.rest) / (this.up - this.rest);
  }

  update(dt: number): void {
    this.prevAngle = this.angle;
    const wantUp = this.pressed && this.enabled;
    const d = this.dir;
    if (wantUp) {
      if ((this.angle - this.up) * d >= 0) {
        this.angle = this.up;
        this.omega = 0;
      } else {
        this.omega += d * this.accelUp * dt;
        if (Math.abs(this.omega) > this.omegaUp) this.omega = d * this.omegaUp;
        this.angle += this.omega * dt;
        if ((this.angle - this.up) * d >= 0) {
          this.angle = this.up;
          this.omega = 0;
        }
      }
    } else {
      if ((this.angle - this.rest) * d <= 0) {
        this.angle = this.rest;
        this.omega = 0;
      } else {
        this.omega -= d * this.accelDown * dt;
        if (Math.abs(this.omega) > this.omegaDown) this.omega = -d * this.omegaDown;
        this.angle += this.omega * dt;
        if ((this.angle - this.rest) * d <= 0) {
          this.angle = this.rest;
          this.omega = 0;
        }
      }
    }
    this.atUp = this.angle === this.up;
  }
}
