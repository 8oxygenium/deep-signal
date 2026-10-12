// 台の部品の振る舞い。配置データ（TableLayout）から物理の形とセンサーを作り、
// 当たり・通過をイベントとしてゲームへ知らせる。
import { Ball } from '../physics/ball';
import { BALL_RADIUS, FLOOR, GRAVITY } from '../physics/constants';
import { Flipper } from '../physics/flipper';
import { arc, circle, seg, segCross, type ContactHandler, type ContactInfo, type Shape } from '../physics/shapes';
import { World } from '../physics/world';
import { deg, offsetPolyline, polylineLengths, slicePolyline } from './geom';
import type {
  BumperDef,
  DropDef,
  KickbackDef,
  LightDef,
  MagnetDef,
  P,
  PartDef,
  PlungerDef,
  RampDef,
  ScoopDef,
  SlingDef,
  SpinnerDef,
  StandupDef,
  TableLayout,
  WarpDef,
  WallStyle,
} from './types';

export type TableEventType =
  | 'bumper'
  | 'sling'
  | 'drop'
  | 'bank'
  | 'standup'
  | 'spinner'
  | 'rollover'
  | 'gate'
  | 'scoop'
  | 'scoop-eject'
  | 'kickback'
  | 'magnet'
  | 'ramp'
  | 'ramp-enter'
  | 'ramp-fail'
  | 'warp'
  | 'trigger'
  | 'launch'
  | 'drain'
  | 'lost'
  | 'flipper'
  | 'wall'
  | 'rubber'
  | 'ballball';

export interface TableEvent {
  type: TableEventType;
  id: string;
  ball: Ball | null;
  x: number;
  y: number;
  speed: number;
  value?: number;
}

const WALL_E: Record<WallStyle, number> = { wall: 0.42, guide: 0.35, rubber: 0.72, metal: 0.38, invisible: 0.4, glass: 0.4 };

export type LightState = 'off' | 'on' | 'blink' | 'fast' | 'slow';

export class LightRT {
  state: LightState = 'off';
  color: string;
  constructor(public readonly def: LightDef) {
    this.color = def.color ?? '#ffcc33';
  }
  /** 描画用：今光っているか（0..1） */
  level(t: number): number {
    switch (this.state) {
      case 'off':
        return 0;
      case 'on':
        return 1;
      case 'blink':
        return Math.sin(t * Math.PI * 4) > 0 ? 1 : 0.08;
      case 'fast':
        return Math.sin(t * Math.PI * 10) > 0 ? 1 : 0.08;
      case 'slow':
        return 0.45 + 0.55 * Math.sin(t * Math.PI * 1.6);
    }
  }
}

abstract class PartRT {
  /** 描画用：直近に当たってからの時間 */
  hitAge = 99;
  /** センサーとして判定するレイヤー */
  layer = FLOOR;
  constructor(public readonly id: string, protected readonly table: Table) {}
  step(_dt: number): void {
    this.hitAge += _dt;
  }
}

export class BumperRT extends PartRT implements ContactHandler {
  shape: Shape & { kind: 'circle' };
  cool = 0;
  readonly kick: number;
  constructor(public readonly def: BumperDef, table: Table) {
    super(def.id, table);
    this.kick = def.kick ?? 50;
    this.shape = table.addShape(
      circle(def.at[0], def.at[1], def.r ?? 0.95, { restitution: 0.5, owner: this, layer: table.layerOf(def.layer), dynamic: def.dynamic, tag: 'bumper' }),
    );
  }
  get x() {
    return this.shape.cx;
  }
  get y() {
    return this.shape.cy;
  }
  /** IMPOSSIBLE の歩くバンパー用 */
  moveTo(x: number, y: number, dt: number): void {
    this.shape.vx = dt > 0 ? (x - this.shape.cx) / dt : 0;
    this.shape.vy = dt > 0 ? (y - this.shape.cy) / dt : 0;
    this.shape.cx = x;
    this.shape.cy = y;
  }
  onContact(c: ContactInfo): void {
    if (this.table.tilted || this.cool > 0) return;
    const b = c.ball;
    const out = b.vx * c.nx + b.vy * c.ny;
    if (out < this.kick) {
      b.vx += c.nx * (this.kick - out);
      b.vy += c.ny * (this.kick - out);
    }
    this.cool = 0.05;
    this.hitAge = 0;
    this.table.emit({ type: 'bumper', id: this.id, ball: b, x: this.x, y: this.y, speed: c.speed });
  }
  step(dt: number): void {
    super.step(dt);
    if (this.cool > 0) this.cool -= dt;
  }
}

export class SlingRT extends PartRT implements ContactHandler {
  cool = 0;
  readonly kick: number;
  kickShape: Shape;
  constructor(public readonly def: SlingDef, table: Table) {
    super(def.id, table);
    this.kick = def.kick ?? 30;
    const layer = table.layerOf(def.layer);
    const pts = def.pts;
    this.kickShape = null as unknown as Shape;
    for (let i = 0; i < 3; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 3];
      const isKick = i === def.kickEdge;
      const s = table.addShape(seg(a[0], a[1], b[0], b[1], { r: 0.16, restitution: isKick ? 0.6 : 0.45, owner: isKick ? this : null, layer, tag: isKick ? 'sling' : 'wall' }));
      if (isKick) this.kickShape = s;
    }
  }
  onContact(c: ContactInfo): void {
    if (this.table.tilted || this.cool > 0 || c.speed < 3.5) return;
    c.ball.vx += c.nx * this.kick;
    c.ball.vy += c.ny * this.kick;
    this.cool = 0.1;
    this.hitAge = 0;
    this.table.emit({ type: 'sling', id: this.id, ball: c.ball, x: c.px, y: c.py, speed: c.speed });
  }
  step(dt: number): void {
    super.step(dt);
    if (this.cool > 0) this.cool -= dt;
  }
}

/** ドロップターゲットとスタンドアップターゲット（正面から当たったときだけ反応） */
export class TargetRT extends PartRT implements ContactHandler {
  shape: Shape & { kind: 'seg' };
  readonly nx: number;
  readonly ny: number;
  down = false;
  /** 描画用：0=立っている、1=沈んだ */
  sink = 0;
  readonly drop: boolean;
  readonly bank: string;
  constructor(public readonly def: DropDef | StandupDef, table: Table) {
    super(def.id, table);
    this.drop = def.kind === 'drop';
    this.bank = def.kind === 'drop' ? def.bank : '';
    const a = deg(def.angle);
    this.nx = Math.cos(a);
    this.ny = Math.sin(a);
    const big = def.kind === 'standup' && def.big;
    const w = def.w ?? (this.drop ? 1.0 : big ? 2.2 : 0.9);
    const tx = -this.ny * (w / 2), ty = this.nx * (w / 2);
    this.shape = table.addShape(
      seg(def.at[0] - tx, def.at[1] - ty, def.at[0] + tx, def.at[1] + ty, {
        r: big ? 0.35 : 0.16,
        restitution: this.drop ? 0.25 : 0.45,
        owner: this,
        layer: table.layerOf(def.layer),
        tag: this.drop ? 'drop' : 'standup',
      }),
    );
  }
  onContact(c: ContactInfo): void {
    if (c.speed < 2.5) return;
    // 裏や真横から当たったときは反応しない
    if (c.nx * this.nx + c.ny * this.ny < 0.25) return;
    if (this.table.tilted) return;
    this.hitAge = 0;
    if (this.drop) {
      if (this.down) return;
      this.down = true;
      this.shape.enabled = false;
      this.table.emit({ type: 'drop', id: this.id, ball: c.ball, x: this.def.at[0], y: this.def.at[1], speed: c.speed });
      this.table.checkBank(this.bank);
    } else {
      this.table.emit({ type: 'standup', id: this.id, ball: c.ball, x: this.def.at[0], y: this.def.at[1], speed: c.speed });
    }
  }
  raise(): void {
    // ボールが上に乗っていたら、どくまで待つ
    for (const b of this.table.world.balls) {
      if (!b.active || b.captured) continue;
      const dx = b.x - this.def.at[0], dy = b.y - this.def.at[1];
      if (dx * dx + dy * dy < 1.2 * 1.2) {
        this.table.later(0.3, () => this.raise());
        return;
      }
    }
    this.down = false;
    this.shape.enabled = true;
  }
  step(dt: number): void {
    super.step(dt);
    const target = this.down ? 1 : 0;
    this.sink += (target - this.sink) * Math.min(1, dt * 30);
  }
}

/** ボールが通ると回るスピナー */
export class SpinnerRT extends PartRT {
  a: P;
  b: P;
  angle = 0;
  omega = 0;
  private acc = 0;
  constructor(public readonly def: SpinnerDef, table: Table) {
    super(def.id, table);
    const w = def.w ?? 1.5;
    const d = deg(def.angle);
    const tx = -Math.sin(d) * (w / 2), ty = Math.cos(d) * (w / 2);
    this.a = [def.at[0] - tx, def.at[1] - ty];
    this.b = [def.at[0] + tx, def.at[1] + ty];
  }
  sense(ball: Ball): void {
    if (segCross(ball.px, ball.py, ball.x, ball.y, this.a[0], this.a[1], this.b[0], this.b[1]) < 0) return;
    const d = deg(this.def.angle);
    const along = ball.vx * Math.cos(d) + ball.vy * Math.sin(d);
    this.omega += along * 0.9;
    // 回転方向を通過方向に合わせる
    if (Math.abs(this.omega) > 90) this.omega = Math.sign(this.omega) * 90;
    this.hitAge = 0;
    // 少しだけ減速
    ball.vx *= 0.97;
    ball.vy *= 0.97;
  }
  step(dt: number): void {
    super.step(dt);
    if (this.omega === 0) return;
    const before = this.omega;
    const dec = 16 * dt + Math.abs(this.omega) * 0.6 * dt;
    if (Math.abs(this.omega) <= dec) this.omega = 0;
    else this.omega -= Math.sign(this.omega) * dec;
    const da = ((before + this.omega) / 2) * dt;
    this.angle += da;
    this.acc += Math.abs(da);
    while (this.acc >= Math.PI) {
      this.acc -= Math.PI;
      this.table.emit({ type: 'spinner', id: this.id, ball: null, x: this.def.at[0], y: this.def.at[1], speed: Math.abs(this.omega) });
    }
    if (this.omega === 0) this.acc = 0;
  }
}

/** 円のセンサー（ロールオーバー） */
export class RolloverRT extends PartRT {
  private inside = new Set<number>();
  constructor(public readonly def: { id: string; at: P; r?: number; layer?: string }, table: Table, private readonly type: TableEventType = 'rollover') {
    super(def.id, table);
  }
  sense(ball: Ball): void {
    const r = this.def.r ?? 0.5;
    const dx = ball.x - this.def.at[0], dy = ball.y - this.def.at[1];
    const inside = dx * dx + dy * dy < r * r;
    if (inside && !this.inside.has(ball.id)) {
      this.inside.add(ball.id);
      this.hitAge = 0;
      this.table.emit({ type: this.type, id: this.id, ball, x: this.def.at[0], y: this.def.at[1], speed: ball.speed });
    } else if (!inside && this.inside.has(ball.id)) {
      // 少し離れてから外す（境界でのチャタリング防止）
      if (dx * dx + dy * dy > (r + 0.3) * (r + 0.3)) this.inside.delete(ball.id);
    }
  }
}

/** 線のセンサー（通過判定） */
export class TriggerRT extends PartRT {
  constructor(
    public readonly def: { id: string; a: P; b: P; dir?: P; layer?: string },
    table: Table,
    private readonly type: TableEventType = 'trigger',
  ) {
    super(def.id, table);
  }
  sense(ball: Ball): void {
    const u = segCross(ball.px, ball.py, ball.x, ball.y, this.def.a[0], this.def.a[1], this.def.b[0], this.def.b[1]);
    if (u < 0) return;
    const d = this.def.dir;
    if (d && (ball.x - ball.px) * d[0] + (ball.y - ball.py) * d[1] <= 0) return;
    this.hitAge = 0;
    this.table.emit({ type: this.type, id: this.id, ball, x: ball.x, y: ball.y, speed: ball.speed });
  }
}

export class GateRT extends PartRT {
  /** 描画用：フラップの開き具合 */
  open = 0;
  constructor(public readonly def: { id: string; a: P; b: P; pass: P; layer?: string }, table: Table) {
    super(def.id, table);
    const l = Math.hypot(def.pass[0], def.pass[1]) || 1;
    table.addShape(
      seg(def.a[0], def.a[1], def.b[0], def.b[1], { r: 0.06, passDir: { x: def.pass[0] / l, y: def.pass[1] / l }, layer: table.layerOf(def.layer), tag: 'gate' }),
    );
  }
  sense(ball: Ball): void {
    const u = segCross(ball.px, ball.py, ball.x, ball.y, this.def.a[0], this.def.a[1], this.def.b[0], this.def.b[1]);
    if (u < 0) return;
    this.open = 1;
    this.hitAge = 0;
    this.table.emit({ type: 'gate', id: this.id, ball, x: ball.x, y: ball.y, speed: ball.speed });
  }
  step(dt: number): void {
    super.step(dt);
    this.open = Math.max(0, this.open - dt * 2.5);
  }
}

/** ボールを捕まえて、しばらくしてから吐き出す部品の共通部分 */
abstract class HolderRT extends PartRT {
  held: Ball[] = [];
  holdTime: number;
  locked = false;
  private ignore = new Map<number, number>();
  /** 描画用 */
  ejectAge = 99;
  constructor(id: string, table: Table, hold: number) {
    super(id, table);
    this.holdTime = hold;
  }
  canCatch(ball: Ball): boolean {
    return !ball.captured && !(this.ignore.get(ball.id)! > 0);
  }
  catchBall(ball: Ball, x: number, y: number): void {
    ball.captured = { by: this.id, t: 0 };
    ball.place(x, y);
    this.held.push(ball);
    this.hitAge = 0;
  }
  /** ルールから：今捕まえているボールをもう少し持っておく */
  holdFor(seconds: number): void {
    for (const b of this.held) if (b.captured) b.captured.t = Math.min(b.captured.t, this.holdTime - seconds);
  }
  lock(): void {
    this.locked = true;
  }
  release(): void {
    this.locked = false;
    for (const b of this.held) if (b.captured) b.captured.t = this.holdTime;
  }
  protected abstract eject(ball: Ball): void;
  step(dt: number): void {
    super.step(dt);
    this.ejectAge += dt;
    for (const [id, t] of this.ignore) {
      if (t - dt <= 0) this.ignore.delete(id);
      else this.ignore.set(id, t - dt);
    }
    for (let i = this.held.length - 1; i >= 0; i--) {
      const b = this.held[i];
      if (!b.active || !b.captured || b.captured.by !== this.id) {
        this.held.splice(i, 1);
        continue;
      }
      b.captured.t += dt;
      if (!this.locked && b.captured.t >= this.holdTime) {
        this.held.splice(i, 1);
        b.captured = null;
        b.hidden = false;
        this.ignore.set(b.id, 0.5);
        this.ejectAge = 0;
        this.eject(b);
      }
    }
  }
}

export class ScoopRT extends HolderRT {
  constructor(public readonly def: ScoopDef, table: Table) {
    super(def.id, table, def.hold ?? 1.2);
  }
  sense(ball: Ball): void {
    const r = (this.def.r ?? 0.55) - 0.12;
    const dx = ball.x - this.def.at[0], dy = ball.y - this.def.at[1];
    if (dx * dx + dy * dy < r * r && this.canCatch(ball)) {
      this.catchBall(ball, this.def.at[0], this.def.at[1]);
      this.table.emit({ type: 'scoop', id: this.id, ball, x: ball.x, y: ball.y, speed: ball.speed });
    }
  }
  protected eject(b: Ball): void {
    const a = deg(this.def.eject + (this.table.rand() - 0.5) * 6);
    const sp = this.def.speed * (0.95 + this.table.rand() * 0.1);
    b.place(this.def.at[0] + Math.cos(a) * 0.15, this.def.at[1] + Math.sin(a) * 0.15, Math.cos(a) * sp, Math.sin(a) * sp);
    this.table.emit({ type: 'scoop-eject', id: this.id, ball: b, x: b.x, y: b.y, speed: sp });
  }
}

export class KickbackRT extends HolderRT {
  lit = false;
  constructor(public readonly def: KickbackDef, table: Table) {
    super(def.id, table, 0.25);
  }
  sense(ball: Ball): void {
    if (!this.lit || this.table.tilted) return;
    const dx = ball.x - this.def.at[0], dy = ball.y - this.def.at[1];
    if (dx * dx + dy * dy < 0.6 * 0.6 && this.canCatch(ball)) {
      this.lit = false;
      this.catchBall(ball, this.def.at[0], this.def.at[1]);
      this.table.emit({ type: 'kickback', id: this.id, ball, x: ball.x, y: ball.y, speed: ball.speed });
    }
  }
  protected eject(b: Ball): void {
    const a = deg(this.def.eject);
    b.place(this.def.at[0], this.def.at[1], Math.cos(a) * this.def.speed, Math.sin(a) * this.def.speed);
  }
}

export class WarpRT extends HolderRT {
  constructor(public readonly def: WarpDef, table: Table) {
    super(def.id, table, def.travel ?? 0.9);
  }
  sense(ball: Ball): void {
    const dx = ball.x - this.def.at[0], dy = ball.y - this.def.at[1];
    if (dx * dx + dy * dy < 0.45 * 0.45 && this.canCatch(ball)) {
      this.catchBall(ball, this.def.at[0], this.def.at[1]);
      ball.hidden = true;
      this.table.emit({ type: 'warp', id: this.id, ball, x: ball.x, y: ball.y, speed: ball.speed });
    }
  }
  protected eject(b: Ball): void {
    const a = deg(this.def.eject + (this.table.rand() - 0.5) * 8);
    b.place(this.def.to[0], this.def.to[1], Math.cos(a) * this.def.speed, Math.sin(a) * this.def.speed);
    b.layer = FLOOR;
  }
}

export class MagnetRT extends HolderRT {
  active = false;
  /** 'pull' は引き寄せるだけ、'grab' は中心で捕まえて投げる */
  mode: 'pull' | 'grab' = 'pull';
  throwAngle = 90;
  throwSpeed = 40;
  constructor(public readonly def: MagnetDef, table: Table) {
    super(def.id, table, 1.0);
  }
  accel(ball: Ball): void {
    if (!this.active) return;
    const dx = this.def.at[0] - ball.x, dy = this.def.at[1] - ball.y;
    const d = Math.hypot(dx, dy);
    if (d > this.def.r || d < 1e-6) return;
    const k = this.def.strength * (1 - d / this.def.r) + this.def.strength * 0.3;
    ball.ax += (dx / d) * k;
    ball.ay += (dy / d) * k;
    if (this.mode === 'grab' && d < 0.35 && ball.speed < 30 && this.canCatch(ball)) {
      this.catchBall(ball, this.def.at[0], this.def.at[1]);
      this.table.emit({ type: 'magnet', id: this.id, ball, x: ball.x, y: ball.y, speed: ball.speed });
    }
  }
  protected eject(b: Ball): void {
    const a = deg(this.throwAngle);
    b.place(this.def.at[0], this.def.at[1], Math.cos(a) * this.throwSpeed, Math.sin(a) * this.throwSpeed);
  }
}

/** ランプ：入口でボールをランプのレイヤーへ移し、出口で床へ戻す。坂の重力も加える */
export class RampRT extends PartRT {
  readonly path: P[];
  readonly h: number[];
  readonly acc: number[];
  readonly w: number;
  readonly entryA: P;
  readonly entryB: P;
  readonly exitA: P;
  readonly exitB: P;
  readonly dir0: P;
  readonly dirN: P;
  constructor(public readonly def: RampDef, table: Table, layer: number) {
    super(def.id, table);
    this.layer = layer;
    this.path = def.path;
    this.h = def.h;
    this.acc = polylineLengths(def.path);
    this.w = def.w ?? 1.5;
    const p = def.path;
    const n = p.length;
    const d0x = p[1][0] - p[0][0], d0y = p[1][1] - p[0][1];
    const l0 = Math.hypot(d0x, d0y);
    this.dir0 = [d0x / l0, d0y / l0];
    const dnx = p[n - 1][0] - p[n - 2][0], dny = p[n - 1][1] - p[n - 2][1];
    const ln = Math.hypot(dnx, dny);
    this.dirN = [dnx / ln, dny / ln];
    const hw = this.w / 2 + 0.05;
    this.entryA = [p[0][0] - this.dir0[1] * hw, p[0][1] + this.dir0[0] * hw];
    this.entryB = [p[0][0] + this.dir0[1] * hw, p[0][1] - this.dir0[0] * hw];
    this.exitA = [p[n - 1][0] - this.dirN[1] * hw, p[n - 1][1] + this.dirN[0] * hw];
    this.exitB = [p[n - 1][0] + this.dirN[1] * hw, p[n - 1][1] - this.dirN[0] * hw];

    // ランプの左右の手すり（ランプのレイヤー）
    const rail = this.w / 2 + 0.12;
    for (const side of [-1, 1]) {
      const pts = offsetPolyline(p, rail * side);
      for (let i = 1; i < pts.length; i++) {
        table.addShape(seg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], { r: 0.1, restitution: 0.3, layer, tag: 'ramp-rail' }));
      }
    }
    // 入口付近の床の壁（ランプの下に潜り込まないように）
    const mouth = def.mouth ?? 2.2;
    if (mouth > 0) {
      const part = slicePolyline(p, 0, Math.min(mouth, this.acc[n - 1]));
      for (const side of [-1, 1]) {
        const pts = offsetPolyline(part, rail * side);
        for (let i = 1; i < pts.length; i++) {
          table.addShape(seg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], { r: 0.1, restitution: 0.4, layer: FLOOR, tag: 'ramp-mouth' }));
        }
      }
    }
  }

  /** 中心線上での位置（距離s, 高さ, 勾配, 方向） */
  locate(ball: Ball): { s: number; h: number; slope: number; dx: number; dy: number; dist: number } {
    const p = this.path;
    let best = Infinity, bi = 0, bt = 0;
    for (let i = 1; i < p.length; i++) {
      const ax = p[i - 1][0], ay = p[i - 1][1];
      const vx = p[i][0] - ax, vy = p[i][1] - ay;
      const L2 = vx * vx + vy * vy;
      let t = ((ball.x - ax) * vx + (ball.y - ay) * vy) / L2;
      t = Math.max(0, Math.min(1, t));
      const qx = ax + vx * t, qy = ay + vy * t;
      const d2 = (ball.x - qx) ** 2 + (ball.y - qy) ** 2;
      if (d2 < best) {
        best = d2;
        bi = i;
        bt = t;
      }
    }
    const L = this.acc[bi] - this.acc[bi - 1];
    const vx = (p[bi][0] - p[bi - 1][0]) / L, vy = (p[bi][1] - p[bi - 1][1]) / L;
    return {
      s: this.acc[bi - 1] + L * bt,
      h: this.h[bi - 1] + (this.h[bi] - this.h[bi - 1]) * bt,
      slope: (this.h[bi] - this.h[bi - 1]) / L,
      dx: vx,
      dy: vy,
      dist: Math.sqrt(best),
    };
  }

  accel(ball: Ball): void {
    const loc = this.locate(ball);
    // 坂を登るほど減速、下りで加速
    const k = 300;
    ball.ax -= loc.dx * loc.slope * k;
    ball.ay -= loc.dy * loc.slope * k;
  }

  sense(ball: Ball): void {
    const crossEntry = segCross(ball.px, ball.py, ball.x, ball.y, this.entryA[0], this.entryA[1], this.entryB[0], this.entryB[1]) >= 0;
    const mvx = ball.x - ball.px, mvy = ball.y - ball.py;
    if (ball.layer === FLOOR) {
      if (crossEntry && mvx * this.dir0[0] + mvy * this.dir0[1] > 0) {
        ball.layer = this.layer;
        this.hitAge = 0;
        this.table.emit({ type: 'ramp-enter', id: this.id, ball, x: ball.x, y: ball.y, speed: ball.speed });
      }
      return;
    }
    if (ball.layer !== this.layer) return;
    if (crossEntry && mvx * this.dir0[0] + mvy * this.dir0[1] < 0) {
      ball.layer = FLOOR;
      ball.z = 0;
      this.table.emit({ type: 'ramp-fail', id: this.id, ball, x: ball.x, y: ball.y, speed: ball.speed });
      return;
    }
    const crossExit = segCross(ball.px, ball.py, ball.x, ball.y, this.exitA[0], this.exitA[1], this.exitB[0], this.exitB[1]) >= 0;
    if (crossExit && mvx * this.dirN[0] + mvy * this.dirN[1] > 0) {
      ball.layer = FLOOR;
      this.hitAge = 0;
      this.table.emit({ type: 'ramp', id: this.id, ball, x: ball.x, y: ball.y, speed: ball.speed });
      return;
    }
    const loc = this.locate(ball);
    ball.z = Math.max(0, loc.h);
    // 念のため：ランプの外へ出てしまったら床へ戻す
    if (loc.dist > this.w) {
      ball.layer = FLOOR;
      ball.z = 0;
    }
  }
}

export class FlipperRT extends PartRT {
  constructor(public readonly flipper: Flipper, table: Table) {
    super(flipper.id, table);
  }
}

export class PlungerRT extends PartRT {
  pull = 0;
  pulling = false;
  readonly tip: Shape & { kind: 'seg' };
  readonly restY: number;
  readonly minSpeed: number;
  readonly maxSpeed: number;
  /** 描画用：離した直後の戻り */
  snap = 0;
  constructor(public readonly def: PlungerDef, table: Table) {
    super('plunger', table);
    this.minSpeed = def.minSpeed ?? 34;
    this.maxSpeed = def.maxSpeed ?? 92;
    this.restY = def.at[1] - BALL_RADIUS - 0.1;
    this.tip = table.addShape(seg(def.at[0] - 0.62, this.restY, def.at[0] + 0.62, this.restY, { r: 0.1, restitution: 0.1, dynamic: true, tag: 'plunger' }));
  }
  /** プランジャーの上に乗っているボール */
  ballOn(): Ball | null {
    for (const b of this.table.world.balls) {
      if (!b.active || b.captured || b.layer !== FLOOR) continue;
      if (Math.abs(b.x - this.def.at[0]) < 0.75 && b.y < this.def.at[1] + 1.4 && b.y > this.restY - 2) return b;
    }
    return null;
  }
  speedFor(pull: number): number {
    return this.minSpeed + (this.maxSpeed - this.minSpeed) * pull;
  }
  release(): number {
    const p = this.pull;
    this.pulling = false;
    this.pull = 0;
    this.snap = p;
    if (p < 0.04) return 0;
    const b = this.ballOn();
    if (b) {
      b.vx = 0;
      b.vy = this.speedFor(p);
      b.y = Math.max(b.y, this.restY + 0.1 + BALL_RADIUS);
      this.table.emit({ type: 'launch', id: 'plunger', ball: b, x: b.x, y: b.y, speed: b.vy, value: p });
    }
    return p;
  }
  step(dt: number): void {
    super.step(dt);
    if (this.pulling) this.pull = Math.min(1, this.pull + dt / 0.9);
    this.snap = Math.max(0, this.snap - dt * 6);
    const y = this.restY - this.pull * 1.1;
    this.tip.vy = (y - this.tip.ay) / Math.max(dt, 1e-6);
    this.tip.ay = y;
    this.tip.by = y;
    this.tip.vy = Math.min(0, this.tip.vy);
  }
}

interface Sensor {
  layer: number;
  sense(ball: Ball): void;
}

export class Table {
  readonly world = new World();
  readonly layout: TableLayout;
  readonly parts = new Map<string, PartRT>();
  readonly lights = new Map<string, LightRT>();
  readonly flippers: Flipper[] = [];
  readonly ramps: RampRT[] = [];
  readonly magnets: MagnetRT[] = [];
  readonly banks = new Map<string, TargetRT[]>();
  readonly sensors: Sensor[] = [];
  readonly holders: HolderRT[] = [];
  plunger: PlungerRT | null = null;
  drain = { y: -1, x0: -20, x1: 20 };
  tilted = false;
  time = 0;
  emitFn: (e: TableEvent) => void = () => {};
  rand: () => number = Math.random;
  private layerIds = new Map<string, number>();
  private timers: { t: number; fn: () => void }[] = [];
  private wallCool = 0;

  constructor(layout: TableLayout) {
    this.layout = layout;
    this.world.gy = -(layout.gravity ?? GRAVITY);
    // ランプのレイヤー番号を先に決める
    let nextLayer = 1;
    for (const p of layout.parts) if (p.kind === 'ramp') this.layerIds.set(p.id, nextLayer++);
    for (const p of layout.parts) this.build(p);

    this.world.hooks.beforeBall = (b) => {
      for (const m of this.magnets) if (m.def.layer === undefined || this.layerOf(m.def.layer) === b.layer) m.accel(b);
      if (b.layer !== FLOOR) {
        for (const r of this.ramps) if (r.layer === b.layer) r.accel(b);
      }
    };
    this.world.hooks.afterBall = (b) => {
      if (b.layer === FLOOR) b.z = 0;
      for (const s of this.sensors) {
        if (b.captured) break;
        if (s.layer === b.layer || s instanceof RampRT) s.sense(b);
      }
      if (b.captured) return;
      if (b.layer === FLOOR && b.y < this.drain.y && b.x > this.drain.x0 && b.x < this.drain.x1) {
        this.emit({ type: 'drain', id: 'drain', ball: b, x: b.x, y: b.y, speed: b.speed });
        return;
      }
      const bd = this.layout.bounds;
      if (b.x < bd.x0 || b.x > bd.x1 || b.y < bd.y0 || b.y > bd.y1) {
        this.emit({ type: 'lost', id: 'bounds', ball: b, x: b.x, y: b.y, speed: b.speed });
      }
    };
    this.world.hooks.onFlipperHit = (f, b, speed) => {
      if (speed > 6) this.emit({ type: 'flipper', id: f.id, ball: b, x: b.x, y: b.y, speed });
    };
    this.world.hooks.onContact = (c) => {
      if (c.speed < 8 || this.wallCool > 0) return;
      const tag = c.shape.tag;
      if (tag === 'bumper' || tag === 'sling' || tag === 'drop' || tag === 'standup') return;
      this.wallCool = 0.03;
      this.emit({ type: c.shape.restitution > 0.6 ? 'rubber' : 'wall', id: tag, ball: c.ball, x: c.px, y: c.py, speed: c.speed });
    };
    this.world.hooks.onBallBall = (a, b, speed) => {
      if (speed > 5) this.emit({ type: 'ballball', id: 'ball', ball: a, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, speed });
    };
  }

  layerOf(rampId: string | undefined): number {
    if (!rampId) return FLOOR;
    const l = this.layerIds.get(rampId);
    if (l === undefined) throw new Error(`unknown ramp layer ${rampId}`);
    return l;
  }

  addShape<T extends Shape>(s: T): T {
    return this.world.addShape(s);
  }

  emit(e: TableEvent): void {
    this.emitFn(e);
  }

  later(t: number, fn: () => void): void {
    this.timers.push({ t, fn });
  }

  get<T extends PartRT = PartRT>(id: string): T {
    const p = this.parts.get(id);
    if (!p) throw new Error(`part not found: ${id}`);
    return p as T;
  }

  light(id: string): LightRT | undefined {
    return this.lights.get(id);
  }

  private add<T extends PartRT>(p: T): T {
    this.parts.set(p.id, p);
    return p;
  }

  private sensor(p: Sensor & PartRT, layer: number): void {
    p.layer = layer;
    this.sensors.push(p);
  }

  private build(p: PartDef): void {
    switch (p.kind) {
      case 'wall': {
        const style = p.style ?? 'wall';
        const pts = p.closed ? [...p.pts, p.pts[0]] : p.pts;
        const e = p.e ?? WALL_E[style];
        for (let i = 1; i < pts.length; i++) {
          this.addShape(
            seg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], {
              r: p.r ?? (style === 'rubber' ? 0.14 : 0.1),
              restitution: e,
              friction: style === 'rubber' ? 0.12 : 0.05,
              layer: this.layerOf(p.layer),
              dynamic: p.dynamic,
              tag: p.id ?? style,
            }),
          );
        }
        return;
      }
      case 'arc':
        this.addShape(
          arc(p.c[0], p.c[1], p.R, deg(p.from), deg(p.to), {
            r: p.r ?? 0.1,
            restitution: p.e ?? WALL_E[p.style ?? 'wall'],
            layer: this.layerOf(p.layer),
            tag: p.id ?? 'arc',
          }),
        );
        return;
      case 'post':
        this.addShape(
          circle(p.at[0], p.at[1], p.r ?? 0.3, {
            restitution: p.e ?? (p.style === 'metal' ? 0.4 : p.style === 'peg' ? 0.5 : 0.65),
            layer: this.layerOf(p.layer),
            dynamic: p.dynamic,
            tag: p.id ?? 'post',
          }),
        );
        return;
      case 'bumper':
        this.add(new BumperRT(p, this));
        return;
      case 'sling':
        this.add(new SlingRT(p, this));
        return;
      case 'drop':
      case 'standup': {
        const t = this.add(new TargetRT(p, this));
        if (t.drop) {
          const list = this.banks.get(t.bank) ?? [];
          list.push(t);
          this.banks.set(t.bank, list);
        }
        return;
      }
      case 'spinner': {
        const s = this.add(new SpinnerRT(p, this));
        this.sensor(s, this.layerOf(p.layer));
        return;
      }
      case 'rollover': {
        const s = this.add(new RolloverRT(p, this));
        this.sensor(s, this.layerOf(p.layer));
        return;
      }
      case 'trigger': {
        const s = this.add(new TriggerRT(p, this));
        this.sensor(s, this.layerOf(p.layer));
        return;
      }
      case 'gate': {
        const s = this.add(new GateRT({ id: p.id ?? `gate${this.parts.size}`, a: p.a, b: p.b, pass: p.pass, layer: p.layer }, this));
        this.sensor(s, this.layerOf(p.layer));
        return;
      }
      case 'scoop': {
        const s = this.add(new ScoopRT(p, this));
        this.sensor(s, this.layerOf(p.layer));
        this.holders.push(s);
        return;
      }
      case 'kickback': {
        const s = this.add(new KickbackRT(p, this));
        this.sensor(s, this.layerOf(p.layer));
        this.holders.push(s);
        return;
      }
      case 'warp': {
        const s = this.add(new WarpRT(p, this));
        this.sensor(s, this.layerOf(p.layer));
        this.holders.push(s);
        return;
      }
      case 'magnet': {
        const m = this.add(new MagnetRT(p, this));
        this.magnets.push(m);
        this.holders.push(m);
        return;
      }
      case 'ramp': {
        const r = this.add(new RampRT(p, this, this.layerOf(p.id)));
        this.ramps.push(r);
        this.sensors.push(r);
        return;
      }
      case 'flipper': {
        const pw = p.power ?? 1;
        const f = new Flipper({
          id: p.id,
          side: p.side,
          pivotX: p.pivot[0],
          pivotY: p.pivot[1],
          length: p.length,
          r0: p.r0 ?? 0.55,
          r1: p.r1 ?? 0.27,
          restDeg: p.rest,
          upDeg: p.up,
          omegaUp: 30 * pw,
          accelUp: 2600 * pw,
          layer: this.layerOf(p.layer),
        });
        this.world.addFlipper(f);
        this.flippers.push(f);
        this.add(new FlipperRT(f, this));
        return;
      }
      case 'plunger':
        this.plunger = this.add(new PlungerRT(p, this));
        return;
      case 'drain':
        this.drain = { y: p.y, x0: p.x0, x1: p.x1 };
        return;
      case 'light':
        this.lights.set(p.id, new LightRT(p));
        return;
      case 'deco':
        return;
    }
  }

  checkBank(bank: string): void {
    const list = this.banks.get(bank);
    if (!list || !list.every((t) => t.down)) return;
    const t0 = list[0];
    this.emit({ type: 'bank', id: bank, ball: null, x: t0.def.at[0], y: t0.def.at[1], speed: 0, value: list.length });
  }

  resetBank(bank: string, delay = 0.6): void {
    const list = this.banks.get(bank);
    if (!list) return;
    this.later(delay, () => list.forEach((t) => t.raise()));
  }

  /** 毎ステップ（物理の前） */
  step(dt: number): void {
    this.time += dt;
    if (this.wallCool > 0) this.wallCool -= dt;
    for (const p of this.parts.values()) p.step(dt);
    if (this.timers.length) {
      for (const t of this.timers) t.t -= dt;
      const due = this.timers.filter((t) => t.t <= 0);
      this.timers = this.timers.filter((t) => t.t > 0);
      for (const t of due) t.fn();
    }
  }
}

export type { PartRT };
