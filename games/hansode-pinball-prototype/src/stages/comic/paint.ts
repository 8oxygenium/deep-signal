// COMIC の床の絵：コマ割りの誌面（太い黒の枠線・ベタ塗り・網点・集中線・擬音の文字）
import type { PaintApi } from '../types';
import { BOSS_AT } from './layout';

const INK = '#15131f';
const PAPER = '#fff3d2';
const YEL = '#ffd21f';
const RED = '#f0392f';
const BLUE = '#3f86ff';
const SKY = '#8fd2ff';
const PINK = '#ff9bc4';
const NAVY = '#3a56c8';

type P2 = [number, number];

export function paintComic({ g, map, scale, width, height }: PaintApi): void {
  const U = scale;
  const path = (pts: P2[]) => {
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const [px, py] = map(x, y);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.closePath();
  };
  const stroke = (w = 0.16, color = INK) => {
    g.lineWidth = w * U;
    g.strokeStyle = color;
    g.lineJoin = 'miter';
    g.miterLimit = 3;
    g.stroke();
  };

  /** 網点（ベンデイ・ドット）。clip 済みの領域に格子状の点を打つ。radiusFn で場所ごとに点の大きさを変える */
  const benday = (x0: number, x1: number, y0: number, y1: number, spacing: number, color: string, radius: (x: number, y: number) => number) => {
    g.fillStyle = color;
    let row = 0;
    for (let y = y0; y <= y1; y += spacing * 0.5) {
      const off = row % 2 === 0 ? 0 : spacing * 0.5;
      for (let x = x0 + off; x <= x1; x += spacing) {
        const r = radius(x, y);
        if (r < 0.03) continue;
        const [px, py] = map(x, y);
        g.beginPath();
        g.arc(px, py, r * U, 0, Math.PI * 2);
        g.fill();
      }
      row++;
    }
  };

  /** 集中線（中心から放射状に伸びる細い三角） */
  const speedLines = (cx: number, cy: number, r0: number, r1: number, n: number, color: string, wid = 0.5, seed = 1) => {
    g.fillStyle = color;
    let s = seed * 9301 + 49297;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.08;
      const w = (0.012 + rnd() * 0.03) * wid;
      const rr0 = r0 * (0.9 + rnd() * 0.3);
      const [ax, ay] = map(cx + Math.cos(a - w) * r1, cy + Math.sin(a - w) * r1);
      const [bx, by] = map(cx + Math.cos(a + w) * r1, cy + Math.sin(a + w) * r1);
      const [tx, ty] = map(cx + Math.cos(a) * rr0, cy + Math.sin(a) * rr0);
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(ax, ay);
      g.lineTo(bx, by);
      g.closePath();
      g.fill();
    }
  };

  /** ギザギザの爆発（スターバースト） */
  const burst = (cx: number, cy: number, rIn: number, rOut: number, n: number, seed = 3): P2[] => {
    const pts: P2[] = [];
    let s = seed * 7919;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? rOut * (0.88 + rnd() * 0.24) : rIn;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8]);
    }
    return pts;
  };

  /** 擬音の大きな文字（黒フチ＋ずらした影＋色塗り） */
  const word = (text: string, x: number, y: number, size: number, rot: number, fill: string, shadow = INK, alpha = 1) => {
    const [px, py] = map(x, y);
    g.save();
    g.globalAlpha = alpha;
    g.translate(px, py);
    g.rotate(rot);
    g.font = `900 ${Math.round(size * U)}px Impact, "Arial Black", "Segoe UI Black", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = size * U * 0.2;
    g.strokeStyle = shadow;
    g.strokeText(text, size * U * 0.06, size * U * 0.07);
    g.fillStyle = shadow;
    g.fillText(text, size * U * 0.06, size * U * 0.07);
    g.lineWidth = size * U * 0.16;
    g.strokeStyle = INK;
    g.strokeText(text, 0, 0);
    g.fillStyle = fill;
    g.fillText(text, 0, 0);
    g.restore();
  };

  // ───── 紙（コマの外のすき間）─────
  g.fillStyle = PAPER;
  g.fillRect(0, 0, width, height);
  // 紙の端の細かいドット
  g.save();
  benday(-9.3, 10.9, -1, 41, 0.5, 'rgba(240, 57, 47, 0.10)', () => 0.09);
  g.restore();

  const panel = (pts: P2[], fill: string, inner?: () => void) => {
    g.save();
    path(pts);
    g.fillStyle = fill;
    g.fill();
    g.save();
    path(pts);
    g.clip();
    inner?.();
    g.restore();
    path(pts);
    stroke(0.2);
    g.restore();
  };

  // ───── コマ① 奥：ボスの登場コマ（集中線と大爆発）─────
  const [bx, by] = BOSS_AT;
  panel(
    [
      [-9.3, 41.2],
      [10.9, 41.2],
      [10.9, 30.9],
      [-9.3, 29.4],
    ],
    RED,
    () => {
      // 赤地に濃い網点
      benday(-9.3, 10.9, 28, 42, 0.62, 'rgba(120, 10, 20, 0.45)', (x, y) => 0.1 + 0.2 * Math.max(0, Math.min(1, (y - 29) / 12)));
      // 放射状の黄色いコマ
      const rays = 22;
      for (let i = 0; i < rays; i++) {
        if (i % 2) continue;
        const a0 = (i / rays) * Math.PI * 2;
        const a1 = ((i + 1) / rays) * Math.PI * 2;
        g.beginPath();
        const [cx, cy] = map(bx, by + 0.6);
        g.moveTo(cx, cy);
        const R = 30;
        const [x1, y1] = map(bx + Math.cos(a0) * R, by + 0.6 + Math.sin(a0) * R);
        const [x2, y2] = map(bx + Math.cos(a1) * R, by + 0.6 + Math.sin(a1) * R);
        g.lineTo(x1, y1);
        g.lineTo(x2, y2);
        g.closePath();
        g.fillStyle = '#ff7a1f';
        g.fill();
      }
      // 大爆発
      const star = burst(bx, by + 0.4, 5.6, 9.2, 15, 5);
      path(star);
      g.fillStyle = YEL;
      g.fill();
      stroke(0.22);
      const star2 = burst(bx, by + 0.4, 3.9, 6.6, 15, 9);
      path(star2);
      g.fillStyle = '#fff1a8';
      g.fill();
      // 集中線
      speedLines(bx, by + 0.6, 9.6, 26, 70, 'rgba(21,19,31,0.55)', 1.0, 4);
    },
  );
  word('KRAK!', -4.5, 36.6, 1.25, -0.2, '#fff36a', '#c4281f');
  word('POW!', 6.1, 35.6, 1.1, 0.22, '#ffffff', BLUE, 0.95);

  // ───── コマ② 左：スカイウェイの空 ─────
  panel(
    [
      [-9.3, 29.0],
      [-0.3, 28.6],
      [1.5, 18.9],
      [-9.3, 18.7],
    ],
    SKY,
    () => {
      // 空の網点（下ほど濃い）
      benday(-9.3, 1.6, 18, 30, 0.6, 'rgba(47, 107, 255, 0.55)', (x, y) => 0.26 * Math.max(0, Math.min(1, (29 - y) / 9)));
      // ビル群のシルエット
      g.fillStyle = NAVY;
      const bld = [
        [-9.0, 19.0, 1.4, 4.6],
        [-7.6, 19.0, 1.2, 6.2],
        [-6.3, 19.0, 1.5, 3.9],
        [-4.7, 19.0, 1.1, 5.2],
        [-3.5, 19.0, 1.6, 3.2],
        [-1.8, 19.0, 1.0, 4.1],
      ];
      for (const [x, y, w, h] of bld) {
        const [px, py] = map(x, y + h);
        g.fillRect(px, py, w * U, h * U);
        g.strokeStyle = INK;
        g.lineWidth = 0.1 * U;
        g.strokeRect(px, py, w * U, h * U);
        // 窓
        g.fillStyle = '#ffe68a';
        for (let wy = y + 0.5; wy < y + h - 0.3; wy += 0.7) for (let wx = x + 0.25; wx < x + w - 0.3; wx += 0.45) g.fillRect(...map(wx, wy + 0.3), 0.18 * U, 0.26 * U);
        g.fillStyle = NAVY;
      }
      speedLines(-1.4, 29.8, 4, 12, 30, 'rgba(255,255,255,0.7)', 0.8, 8);
    },
  );
  word('SKYWAY', -4.6, 27.2, 1.0, 0.18, '#ffffff', BLUE);

  // ───── コマ③ 右：バンパーの爆発 ─────
  panel(
    [
      [0.7, 28.7],
      [10.9, 29.0],
      [10.9, 18.9],
      [2.9, 19.0],
    ],
    YEL,
    () => {
      benday(0, 11, 18, 30, 0.62, 'rgba(240, 57, 47, 0.7)', (x, y) => 0.06 + 0.24 * Math.max(0, Math.min(1, (y - 18.5) / 10)));
      const star = burst(4.4, 23.8, 3.6, 6.6, 12, 11);
      path(star);
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.fill();
      stroke(0.14);
    },
  );
  word('BAM!', 4.6, 23.8, 1.9, 0.12, '#ffffff', RED, 0.85);

  // ───── コマ④ 中段：ミッション・ランプ帯 ─────
  panel(
    [
      [-9.3, 18.3],
      [10.9, 18.5],
      [10.9, 11.6],
      [-9.3, 11.2],
    ],
    NAVY,
    () => {
      benday(-9.3, 10.9, 11, 19, 0.58, 'rgba(143, 210, 255, 0.35)', (x, y) => 0.05 + 0.2 * Math.max(0, Math.min(1, (y - 11) / 7.5)));
      // 星
      g.fillStyle = '#fff36a';
      const stars: P2[] = [[-7.5, 16.4], [-6.2, 12.8], [8.4, 16.2], [7.6, 12.4], [-2.4, 17.1], [3.3, 16.9]];
      for (const [x, y] of stars) {
        const [px, py] = map(x, y);
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const r = (i % 2 === 0 ? 0.32 : 0.14) * U;
          const f = i === 0 ? g.moveTo : g.lineTo;
          f.call(g, px + Math.cos(a) * r, py + Math.sin(a) * r);
        }
        g.closePath();
        g.fill();
      }
    },
  );
  word('MISSIONS', 0.75, 15.4, 0.62, 0, '#ffffff', INK, 0.9);

  // ───── コマ⑤ 手前：ヒーローの紋章 ─────
  panel(
    [
      [-9.3, 10.9],
      [10.9, 11.1],
      [10.9, -1.2],
      [-9.3, -1.2],
    ],
    '#fff7da',
    () => {
      // 放射の青
      speedLines(0.75, 6.6, 3.2, 24, 56, 'rgba(63,134,255,0.5)', 1.4, 2);
      benday(-9.3, 10.9, -1.2, 11, 0.62, 'rgba(63,134,255,0.35)', (x, y) => 0.22 * Math.max(0, Math.min(1, (11 - y) / 12)));
      // 紋章（星の入った円）
      const [cx, cy] = map(0.75, 6.9);
      g.beginPath();
      g.arc(cx, cy, 3.4 * U, 0, Math.PI * 2);
      g.fillStyle = RED;
      g.fill();
      stroke(0.18);
      g.beginPath();
      g.arc(cx, cy, 2.6 * U, 0, Math.PI * 2);
      g.fillStyle = BLUE;
      g.fill();
      stroke(0.14);
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = (i % 2 === 0 ? 2.1 : 0.9) * U;
        const f = i === 0 ? g.moveTo : g.lineTo;
        f.call(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.closePath();
      g.fillStyle = YEL;
      g.fill();
      stroke(0.12);
    },
  );
}
