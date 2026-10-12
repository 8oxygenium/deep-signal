// 2D物理ワールド。固定ステップで回し、ボールと形・フリッパー・ボール同士の衝突を解く。
// すり抜け対策：
//  1) 最高速度を制限し、1ステップの移動量がボール半径を超えないようにする（118/480 ≈ 0.25 < 0.5）
//  2) 薄い壁（線分・円弧）とフリッパーは「前ステップの位置から見て反対側へ抜けたか」を判定し、
//     抜けていたら元の側へ押し戻す
import { Ball } from './ball';
import { BALL_RADIUS, GRAVITY, LINEAR_DAMPING, MAX_SPEED, RESTING_SPEED, SOLVER_ITERATIONS } from './constants';
import { Flipper } from './flipper';
import { closest, normAngle, segCross, shapeAABB, type Closest, type ContactInfo, type Shape } from './shapes';

export interface WorldHooks {
  /** 積分の前：ボールに加える加速度（ball.ax/ay）を設定する */
  beforeBall?(ball: Ball, dt: number): void;
  /** 衝突解決の後：センサー判定など */
  afterBall?(ball: Ball, dt: number): void;
  onFlipperHit?(f: Flipper, ball: Ball, speed: number): void;
  onContact?(c: ContactInfo): void;
  onBallBall?(a: Ball, b: Ball, speed: number): void;
  /** NaN・無限大が出たとき（本来起きてはいけない） */
  onInvalid?(ball: Ball): void;
}

class Grid {
  readonly x0 = -16;
  readonly y0 = -10;
  readonly cs = 2;
  readonly nx: number;
  readonly ny: number;
  cells: Shape[][];

  constructor() {
    this.nx = Math.ceil(36 / this.cs);
    this.ny = Math.ceil(64 / this.cs);
    this.cells = Array.from({ length: this.nx * this.ny }, () => []);
  }

  clear(): void {
    for (const c of this.cells) c.length = 0;
  }

  insert(s: Shape): void {
    const bb = shapeAABB(s);
    const m = BALL_RADIUS + 0.35;
    const i0 = Math.max(0, Math.floor((bb.x0 - m - this.x0) / this.cs));
    const i1 = Math.min(this.nx - 1, Math.floor((bb.x1 + m - this.x0) / this.cs));
    const j0 = Math.max(0, Math.floor((bb.y0 - m - this.y0) / this.cs));
    const j1 = Math.min(this.ny - 1, Math.floor((bb.y1 + m - this.y0) / this.cs));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.cells[j * this.nx + i].push(s);
  }

  query(x: number, y: number): Shape[] | null {
    const i = Math.floor((x - this.x0) / this.cs);
    const j = Math.floor((y - this.y0) / this.cs);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) return null;
    return this.cells[j * this.nx + i];
  }
}

const C: Closest = { qx: 0, qy: 0, r: 0 };

export class World {
  gx = 0;
  gy = -GRAVITY;
  gravityScale = 1;
  maxSpeed = MAX_SPEED;
  balls: Ball[] = [];
  shapes: Shape[] = [];
  dynamicShapes: Shape[] = [];
  flippers: Flipper[] = [];
  hooks: WorldHooks = {};
  time = 0;
  private grid = new Grid();
  private gridDirty = true;
  private contact: ContactInfo = { ball: null as unknown as Ball, shape: null as unknown as Shape, nx: 0, ny: 0, px: 0, py: 0, speed: 0 };

  addShape<T extends Shape>(s: T): T {
    this.shapes.push(s);
    if (s.dynamic) this.dynamicShapes.push(s);
    else this.gridDirty = true;
    return s;
  }

  addFlipper(f: Flipper): Flipper {
    this.flippers.push(f);
    return f;
  }

  addBall(x: number, y: number): Ball {
    const b = new Ball(x, y);
    this.balls.push(b);
    return b;
  }

  removeBall(b: Ball): void {
    b.active = false;
    const i = this.balls.indexOf(b);
    if (i >= 0) this.balls.splice(i, 1);
  }

  private rebuildGrid(): void {
    this.grid.clear();
    for (const s of this.shapes) if (!s.dynamic) this.grid.insert(s);
    this.gridDirty = false;
  }

  step(dt: number): void {
    if (this.gridDirty) this.rebuildGrid();
    this.time += dt;
    for (const f of this.flippers) f.update(dt);

    const gx = this.gx * this.gravityScale;
    const gy = this.gy * this.gravityScale;
    const damp = Math.exp(-LINEAR_DAMPING * dt);
    const vmax = this.maxSpeed;

    for (let bi = 0; bi < this.balls.length; bi++) {
      const b = this.balls[bi];
      if (!b.active || b.captured) continue;
      b.ax = 0;
      b.ay = 0;
      this.hooks.beforeBall?.(b, dt);
      b.px = b.x;
      b.py = b.y;
      b.vx = (b.vx + (gx + b.ax) * dt) * damp;
      b.vy = (b.vy + (gy + b.ay) * dt) * damp;
      this.clampSpeed(b, vmax);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.touchingFlipper = null;
      b.touching = false;

      this.solve(b, SOLVER_ITERATIONS);
      this.clampSpeed(b, vmax);
      this.hooks.afterBall?.(b, dt);

      if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.vx) || !Number.isFinite(b.vy)) {
        this.hooks.onInvalid?.(b);
      }
    }

    // ボール同士で押し出されたボールは、壁を抜けていないか解き直す
    if (this.ballBall()) {
      for (const b of this.balls) if (b.active && !b.captured && b.pushed) this.solve(b, 2);
    }
  }

  private solve(b: Ball, iterations: number): void {
    for (let it = 0; it < iterations; it++) {
      let hit = false;
      const cell = this.grid.query(b.x, b.y);
      if (cell) {
        for (let k = 0; k < cell.length; k++) {
          const s = cell[k];
          if (s.enabled && s.layer === b.layer && this.resolveShape(b, s)) hit = true;
        }
      }
      for (let k = 0; k < this.dynamicShapes.length; k++) {
        const s = this.dynamicShapes[k];
        if (s.enabled && s.layer === b.layer && this.resolveShape(b, s)) hit = true;
      }
      for (let k = 0; k < this.flippers.length; k++) {
        const f = this.flippers[k];
        if (f.layer === b.layer && this.resolveFlipper(b, f)) hit = true;
      }
      if (!hit) break;
      b.touching = true;
    }
  }

  private clampSpeed(b: Ball, vmax: number): void {
    const s2 = b.vx * b.vx + b.vy * b.vy;
    if (s2 > vmax * vmax) {
      const k = vmax / Math.sqrt(s2);
      b.vx *= k;
      b.vy *= k;
    }
  }

  /** 線分・円弧の芯をこのステップで横切ったか。横切っていたら元の側の法線を返す */
  private crossedThin(b: Ball, s: Shape, out: { nx: number; ny: number }): boolean {
    if (s.kind === 'seg') {
      const u = segCross(b.px, b.py, b.x, b.y, s.ax, s.ay, s.bx, s.by);
      if (u < 0) return false;
      const dx = s.bx - s.ax, dy = s.by - s.ay;
      const L = Math.hypot(dx, dy) || 1;
      const side = dx * (b.py - s.ay) - dy * (b.px - s.ax);
      const sg = side >= 0 ? 1 : -1;
      out.nx = (-dy / L) * sg;
      out.ny = (dx / L) * sg;
      return true;
    }
    if (s.kind === 'arc') {
      const d0 = Math.hypot(b.px - s.cx, b.py - s.cy) - s.R;
      const d1 = Math.hypot(b.x - s.cx, b.y - s.cy) - s.R;
      if (d0 === 0 || Math.sign(d0) === Math.sign(d1)) return false;
      const a = normAngle(Math.atan2(b.y - s.cy, b.x - s.cx), s.a0);
      if (a > s.a1) return false;
      const sg = d0 > 0 ? 1 : -1;
      out.nx = Math.cos(a) * sg;
      out.ny = Math.sin(a) * sg;
      return true;
    }
    return false;
  }

  private crossN = { nx: 0, ny: 0 };

  private resolveShape(b: Ball, s: Shape): boolean {
    closest(s, b.x, b.y, C);
    let dx = b.x - C.qx;
    let dy = b.y - C.qy;
    const minD = b.r + C.r;
    const d2 = dx * dx + dy * dy;

    const pd = s.passDir;
    if (pd) {
      // 一方通行ゲート：通過方向の手前側にいる間は素通り。向こう側から戻ってくるときだけ壁になる
      if (d2 >= minD * minD) return false;
      if (dx * pd.x + dy * pd.y <= 0) return false;
      if (b.vx * pd.x + b.vy * pd.y > 0) return false;
    }

    let nx: number, ny: number, pen: number;
    const thin = s.kind !== 'circle' && C.r < BALL_RADIUS;
    const crossed = thin && !pd && this.crossedThin(b, s, this.crossN);
    if (crossed) {
      nx = this.crossN.nx;
      ny = this.crossN.ny;
      // 芯の線上の点まで戻してから表面へ
      b.x = C.qx + nx * minD;
      b.y = C.qy + ny * minD;
      pen = 0;
    } else {
      if (d2 >= minD * minD) return false;
      const d = Math.sqrt(d2);
      if (d < 1e-9) {
        dx = b.px - C.qx;
        dy = b.py - C.qy;
        const l = Math.hypot(dx, dy) || 1;
        nx = dx / l;
        ny = dy / l;
        pen = minD;
      } else {
        nx = dx / d;
        ny = dy / d;
        pen = minD - d;
      }
      b.x += nx * pen;
      b.y += ny * pen;
    }

    const rvx = b.vx - s.vx;
    const rvy = b.vy - s.vy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const speed = -vn;
      const e = speed < RESTING_SPEED ? 0 : s.restitution;
      const jn = -(1 + e) * vn;
      let nvx = rvx + nx * jn;
      let nvy = rvy + ny * jn;
      const tx = rvx - nx * vn;
      const ty = rvy - ny * vn;
      const tl = Math.hypot(tx, ty);
      if (tl > 1e-9) {
        const dec = Math.min(tl, s.friction * jn);
        nvx -= (tx / tl) * dec;
        nvy -= (ty / tl) * dec;
      }
      b.vx = nvx + s.vx;
      b.vy = nvy + s.vy;
      const c = this.contact;
      c.ball = b;
      c.shape = s;
      c.nx = nx;
      c.ny = ny;
      c.px = C.qx + nx * C.r;
      c.py = C.qy + ny * C.r;
      c.speed = speed;
      s.owner?.onContact(c);
      this.hooks.onContact?.(c);
    }
    return true;
  }

  private resolveFlipper(b: Ball, f: Flipper): boolean {
    const L = f.length;
    const r0 = f.r0, r1 = f.r1;
    const ca = Math.cos(f.angle), sa = Math.sin(f.angle);
    const rx = b.x - f.pivotX, ry = b.y - f.pivotY;
    const u = rx * ca + ry * sa;
    const w = -rx * sa + ry * ca;
    const reach = Math.max(r0, r1) + b.r + 0.3;
    if (u < -reach || u > L + reach || Math.abs(w) > reach + 0.6) return false;

    let t = u / L;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const rr = r0 + (r1 - r0) * t;
    const minD = b.r + rr;
    const qx = f.pivotX + ca * L * t;
    const qy = f.pivotY + sa * L * t;

    // 前ステップ（フリッパーの前の角度・ボールの前の位置）で、どちら側にいたか
    const pca = Math.cos(f.prevAngle), psa = Math.sin(f.prevAngle);
    const prx = b.px - f.pivotX, pry = b.py - f.pivotY;
    const uPrev = prx * pca + pry * psa;
    const wPrev = -prx * psa + pry * pca;
    const crossed = t > 0 && t < 1 && wPrev !== 0 && (wPrev > 0) !== (w > 0) && uPrev > -0.3 && uPrev < L + 0.3;

    let nx: number, ny: number;
    if (crossed) {
      const sg = wPrev > 0 ? 1 : -1;
      nx = -sa * sg;
      ny = ca * sg;
      b.x = qx + nx * minD;
      b.y = qy + ny * minD;
    } else {
      const dx = b.x - qx, dy = b.y - qy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minD * minD) return false;
      const d = Math.sqrt(d2);
      if (d < 1e-9) {
        const sg = wPrev >= 0 ? 1 : -1;
        nx = -sa * sg;
        ny = ca * sg;
      } else {
        nx = dx / d;
        ny = dy / d;
      }
      const pen = minD - d;
      b.x += nx * pen;
      b.y += ny * pen;
    }

    // 接触点での回転による表面速度（先端ほど速い）
    const cpx = qx + nx * rr - f.pivotX;
    const cpy = qy + ny * rr - f.pivotY;
    const svx = -f.omega * cpy;
    const svy = f.omega * cpx;
    const rvx = b.vx - svx;
    const rvy = b.vy - svy;
    const vn = rvx * nx + rvy * ny;
    b.touchingFlipper = f.id;
    if (vn < 0) {
      const speed = -vn;
      // ゴムは速い衝突ほど反発が落ちる（デッドフリッパーで勢いを殺せるように）
      const e = speed < RESTING_SPEED ? 0 : f.restitution * (1 / (1 + speed / 140));
      const jn = -(1 + e) * vn;
      let nvx = rvx + nx * jn;
      let nvy = rvy + ny * jn;
      const tx = rvx - nx * vn;
      const ty = rvy - ny * vn;
      const tl = Math.hypot(tx, ty);
      if (tl > 1e-9) {
        const dec = Math.min(tl, f.friction * jn);
        nvx -= (tx / tl) * dec;
        nvy -= (ty / tl) * dec;
      }
      b.vx = nvx + svx;
      b.vy = nvy + svy;
      this.hooks.onFlipperHit?.(f, b, speed);
    }
    return true;
  }

  private ballBall(): boolean {
    const bs = this.balls;
    let any = false;
    for (const b of bs) b.pushed = false;
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i];
      if (!a.active || a.captured) continue;
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j];
        if (!b.active || b.captured || a.layer !== b.layer) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const minD = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD || d2 < 1e-12) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        const pen = (minD - d) / 2;
        a.x -= nx * pen;
        a.y -= ny * pen;
        b.x += nx * pen;
        b.y += ny * pen;
        a.pushed = true;
        b.pushed = true;
        any = true;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) {
          const e = -vn < RESTING_SPEED ? 0 : 0.88;
          const j = (-(1 + e) * vn) / 2;
          a.vx -= nx * j;
          a.vy -= ny * j;
          b.vx += nx * j;
          b.vy += ny * j;
          this.hooks.onBallBall?.(a, b, -vn);
        }
      }
    }
    return any;
  }
}
