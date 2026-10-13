// 当たり判定の形。すべて「芯（点・線分・円弧）＋太さ r」で表す。
// 円 = 点＋r、線分/カプセル = 線分＋r、円弧 = 円弧＋r。多角形は線分の集まり。
import { FLOOR } from './constants';
import type { Ball } from './ball';

export interface ContactInfo {
  ball: Ball;
  shape: Shape;
  /** 形からボールへ向かう法線 */
  nx: number;
  ny: number;
  /** 接触点（形の表面） */
  px: number;
  py: number;
  /** 当たった速さ（法線方向の接近速度、正の値） */
  speed: number;
}

export interface ContactHandler {
  /** 標準の反発処理のあとに呼ばれる。ボールの速度を書き換えてよい */
  onContact(c: ContactInfo): void;
}

export interface ShapeBase {
  id: number;
  layer: number;
  restitution: number;
  friction: number;
  enabled: boolean;
  /** 動く形（グリッドに入れず毎回判定する） */
  dynamic: boolean;
  /** 形そのものの移動速度（動くバンパー等） */
  vx: number;
  vy: number;
  /** 一方通行ゲート：この向きへ進むボールは通す */
  passDir: { x: number; y: number } | null;
  owner: ContactHandler | null;
  tag: string;
}

export interface Seg extends ShapeBase {
  kind: 'seg';
  ax: number;
  ay: number;
  bx: number;
  by: number;
  r: number;
}

export interface Circle extends ShapeBase {
  kind: 'circle';
  cx: number;
  cy: number;
  r: number;
}

export interface Arc extends ShapeBase {
  kind: 'arc';
  cx: number;
  cy: number;
  R: number;
  /** ラジアン。a0 から反時計回りに a1 まで（a1 > a0） */
  a0: number;
  a1: number;
  r: number;
}

export type Shape = Seg | Circle | Arc;

let nextId = 1;

export interface ShapeOpts {
  layer?: number;
  restitution?: number;
  friction?: number;
  r?: number;
  dynamic?: boolean;
  owner?: ContactHandler | null;
  tag?: string;
  passDir?: { x: number; y: number } | null;
}

function base(o: ShapeOpts): ShapeBase {
  return {
    id: nextId++,
    layer: o.layer ?? FLOOR,
    restitution: o.restitution ?? 0.45,
    friction: o.friction ?? 0.06,
    enabled: true,
    dynamic: o.dynamic ?? false,
    vx: 0,
    vy: 0,
    passDir: o.passDir ?? null,
    owner: o.owner ?? null,
    tag: o.tag ?? '',
  };
}

export function seg(ax: number, ay: number, bx: number, by: number, o: ShapeOpts = {}): Seg {
  return { ...base(o), kind: 'seg', ax, ay, bx, by, r: o.r ?? 0.08 };
}

export function circle(cx: number, cy: number, r: number, o: ShapeOpts = {}): Circle {
  return { ...base(o), kind: 'circle', cx, cy, r };
}

export function arc(cx: number, cy: number, R: number, a0: number, a1: number, o: ShapeOpts = {}): Arc {
  let b = a1;
  while (b <= a0) b += Math.PI * 2;
  return { ...base(o), kind: 'arc', cx, cy, R, a0, a1: b, r: o.r ?? 0.08 };
}

/** 結果の受け皿（毎回確保しないため使い回す） */
export interface Closest {
  /** 芯の上の最近点 */
  qx: number;
  qy: number;
  /** 最近点での太さ */
  r: number;
}

export function closestOnSeg(s: { ax: number; ay: number; bx: number; by: number }, x: number, y: number, out: Closest): number {
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const L2 = dx * dx + dy * dy;
  let t = L2 > 1e-12 ? ((x - s.ax) * dx + (y - s.ay) * dy) / L2 : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  out.qx = s.ax + dx * t;
  out.qy = s.ay + dy * t;
  return t;
}

export function normAngle(a: number, from: number): number {
  const TAU = Math.PI * 2;
  let v = a;
  while (v < from) v += TAU;
  while (v >= from + TAU) v -= TAU;
  return v;
}

export function closest(shape: Shape, x: number, y: number, out: Closest): void {
  switch (shape.kind) {
    case 'seg':
      closestOnSeg(shape, x, y, out);
      out.r = shape.r;
      return;
    case 'circle':
      out.qx = shape.cx;
      out.qy = shape.cy;
      out.r = shape.r;
      return;
    case 'arc': {
      const a = normAngle(Math.atan2(y - shape.cy, x - shape.cx), shape.a0);
      if (a <= shape.a1) {
        out.qx = shape.cx + Math.cos(a) * shape.R;
        out.qy = shape.cy + Math.sin(a) * shape.R;
      } else {
        // 範囲外：近い方の端点
        const e0x = shape.cx + Math.cos(shape.a0) * shape.R;
        const e0y = shape.cy + Math.sin(shape.a0) * shape.R;
        const e1x = shape.cx + Math.cos(shape.a1) * shape.R;
        const e1y = shape.cy + Math.sin(shape.a1) * shape.R;
        const d0 = (x - e0x) ** 2 + (y - e0y) ** 2;
        const d1 = (x - e1x) ** 2 + (y - e1y) ** 2;
        if (d0 < d1) {
          out.qx = e0x;
          out.qy = e0y;
        } else {
          out.qx = e1x;
          out.qy = e1y;
        }
      }
      out.r = shape.r;
      return;
    }
  }
}

export interface AABB {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function shapeAABB(s: Shape): AABB {
  switch (s.kind) {
    case 'seg':
      return {
        x0: Math.min(s.ax, s.bx) - s.r,
        y0: Math.min(s.ay, s.by) - s.r,
        x1: Math.max(s.ax, s.bx) + s.r,
        y1: Math.max(s.ay, s.by) + s.r,
      };
    case 'circle':
      return { x0: s.cx - s.r, y0: s.cy - s.r, x1: s.cx + s.r, y1: s.cy + s.r };
    case 'arc': {
      // 円弧上の点を細かく見て囲む（構築時だけなので十分）
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const n = 48;
      for (let i = 0; i <= n; i++) {
        const a = s.a0 + ((s.a1 - s.a0) * i) / n;
        const x = s.cx + Math.cos(a) * s.R;
        const y = s.cy + Math.sin(a) * s.R;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
      return { x0: x0 - s.r, y0: y0 - s.r, x1: x1 + s.r, y1: y1 + s.r };
    }
  }
}

/** 線分 p0→p1 と線分 a→b が交差するか。交差するなら a→b 上のパラメータ、しないなら -1 */
export function segCross(p0x: number, p0y: number, p1x: number, p1y: number, ax: number, ay: number, bx: number, by: number): number {
  const rx = p1x - p0x, ry = p1y - p0y;
  const sx = bx - ax, sy = by - ay;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return -1;
  const qpx = ax - p0x, qpy = ay - p0y;
  const t = (qpx * sy - qpy * sx) / den; // p 上
  const u = (qpx * ry - qpy * rx) / den; // a→b 上
  if (t < 0 || t > 1 || u < 0 || u > 1) return -1;
  return u;
}
