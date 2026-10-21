import type { P } from './types';

export const deg = (d: number) => (d * Math.PI) / 180;
export const dirOf = (d: number): P => [Math.cos(deg(d)), Math.sin(deg(d))];

/** 折れ線を左右にずらす（角はマイター、尖りすぎは制限） */
export function offsetPolyline(path: P[], d: number): P[] {
  const out: P[] = [];
  const n = path.length;
  for (let i = 0; i < n; i++) {
    const p = path[i];
    const prev = path[Math.max(0, i - 1)];
    const next = path[Math.min(n - 1, i + 1)];
    let n1x = 0, n1y = 0, n2x = 0, n2y = 0;
    if (i > 0) {
      const dx = p[0] - prev[0], dy = p[1] - prev[1];
      const l = Math.hypot(dx, dy) || 1;
      n1x = -dy / l;
      n1y = dx / l;
    }
    if (i < n - 1) {
      const dx = next[0] - p[0], dy = next[1] - p[1];
      const l = Math.hypot(dx, dy) || 1;
      n2x = -dy / l;
      n2y = dx / l;
    }
    if (i === 0) {
      n1x = n2x;
      n1y = n2y;
    }
    if (i === n - 1) {
      n2x = n1x;
      n2y = n1y;
    }
    let mx = n1x + n2x, my = n1y + n2y;
    const ml = Math.hypot(mx, my) || 1;
    mx /= ml;
    my /= ml;
    const cos = mx * n1x + my * n1y;
    const k = d / Math.max(0.45, cos);
    out.push([p[0] + mx * k, p[1] + my * k]);
  }
  return out;
}

export function polylineLengths(path: P[]): number[] {
  const acc = [0];
  for (let i = 1; i < path.length; i++) acc.push(acc[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  return acc;
}

/** 折れ線上で距離 s の位置までを切り出す */
export function slicePolyline(path: P[], s0: number, s1: number): P[] {
  const acc = polylineLengths(path);
  const at = (s: number): P => {
    for (let i = 1; i < path.length; i++) {
      if (s <= acc[i] || i === path.length - 1) {
        const t = Math.min(1, Math.max(0, (s - acc[i - 1]) / Math.max(1e-9, acc[i] - acc[i - 1])));
        return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t];
      }
    }
    return path[path.length - 1];
  };
  const out: P[] = [at(s0)];
  for (let i = 1; i < path.length - 1; i++) if (acc[i] > s0 && acc[i] < s1) out.push(path[i]);
  out.push(at(s1));
  return out;
}

/** 円弧を折れ線に（描画用） */
export function arcPoints(c: P, R: number, fromDeg: number, toDeg: number, step = 6): P[] {
  let to = toDeg;
  while (to <= fromDeg) to += 360;
  const n = Math.max(2, Math.ceil((to - fromDeg) / step));
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const a = deg(fromDeg + ((to - fromDeg) * i) / n);
    pts.push([c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R]);
  }
  return pts;
}

export function mirrorX(p: P, cx = 0): P {
  return [2 * cx - p[0], p[1]];
}
