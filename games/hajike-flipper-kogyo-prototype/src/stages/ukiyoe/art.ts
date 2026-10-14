// 浮世絵の絵を描く道具（Canvas）。床・バックボード・地面・七福神の絵で共通して使う。
// 座標はキャンバスのピクセル。画像ファイルは使わず、すべてコードで描く。
import { INK } from './palette';

export type G = CanvasRenderingContext2D;

/** 再現できる乱数（絵が毎回同じになるように） */
export function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 和紙の繊維（細かい筋と点） */
export function fibres(g: G, w: number, h: number, n: number, seed: number, alpha = 0.12): void {
  const r = rng(seed);
  g.save();
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h;
    const len = 6 + r() * 26;
    const a = (r() - 0.5) * 1.4;
    const dark = r() < 0.55;
    g.strokeStyle = dark ? `rgba(110,80,40,${alpha * (0.4 + r())})` : `rgba(255,252,240,${alpha * 1.6 * (0.4 + r())})`;
    g.lineWidth = 0.6 + r() * 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (r() - 0.5) * 4, y + Math.sin(a) * len * 0.5 + (r() - 0.5) * 4, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  g.restore();
}

/** 青海波（せいがいは）：同心円の扇を重ねた波の模様。上の段から順に重ねて描く */
export function seigaiha(g: G, x0: number, y0: number, x1: number, y1: number, r: number, o: { line: string; fill: string; lw: number; rings?: number; alpha?: number }): void {
  const rings = o.rings ?? 4;
  g.save();
  g.globalAlpha = o.alpha ?? 1;
  g.beginPath();
  g.rect(x0, y0, x1 - x0, y1 - y0);
  g.clip();
  let row = 0;
  for (let y = y0 - r; y < y1 + r * 1.5; y += r * 0.5, row++) {
    const off = row % 2 === 0 ? 0 : r;
    for (let x = x0 - r * 2 + off; x < x1 + r * 2; x += r * 2) {
      g.fillStyle = o.fill;
      g.beginPath();
      g.arc(x, y + r, r, Math.PI, 0);
      g.closePath();
      g.fill();
      g.strokeStyle = o.line;
      g.lineWidth = o.lw;
      for (let k = 0; k < rings; k++) {
        g.beginPath();
        g.arc(x, y + r, r * (1 - k / rings), Math.PI, 0);
        g.stroke();
      }
    }
  }
  g.restore();
}

/** 金箔：四角い箔をずらして押した金色の地 */
export function goldLeaf(g: G, x: number, y: number, w: number, h: number, seed: number, cell = 38): void {
  const r = rng(seed);
  const grad = g.createLinearGradient(x, y, x + w * 0.6, y + h);
  grad.addColorStop(0, '#e6bf55');
  grad.addColorStop(0.5, '#d9a93a');
  grad.addColorStop(1, '#e2b648');
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const tones = ['#eacb6a', '#dcae3f', '#cf9d2e', '#f0d37c', '#d6a436'];
  for (let j = -1; j < h / cell + 1; j++) {
    for (let i = -1; i < w / cell + 1; i++) {
      const ox = (j % 2) * cell * 0.5 + (r() - 0.5) * 3;
      const px = x + i * cell + ox, py = y + j * cell + (r() - 0.5) * 3;
      g.fillStyle = tones[Math.floor(r() * tones.length)];
      g.globalAlpha = 0.55;
      g.fillRect(px, py, cell - 1.5, cell - 1.5);
      g.globalAlpha = 0.5;
      g.strokeStyle = 'rgba(120,80,10,0.5)';
      g.lineWidth = 1;
      g.strokeRect(px + 0.5, py + 0.5, cell - 2.5, cell - 2.5);
    }
  }
  g.globalAlpha = 1;
  // 箔の切れ端のきらめき
  for (let i = 0; i < w * h / 900; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(255,240,170,0.5)' : 'rgba(150,100,20,0.28)';
    g.fillRect(x + r() * w, y + r() * h, 1 + r() * 3, 1 + r() * 2);
  }
  g.restore();
}

/** 金雲（きんうん）：ふちが丸く波打つ横長の雲 */
export function goldCloud(g: G, x: number, y: number, w: number, h: number, seed: number, fill = '#e4b84a', line = INK): void {
  const r = rng(seed);
  const n = Math.max(3, Math.round(w / (h * 1.1)));
  g.save();
  g.beginPath();
  g.moveTo(x, y + h);
  g.lineTo(x, y + h * 0.55);
  let cx = x;
  for (let i = 0; i < n; i++) {
    const seg = w / n;
    const bump = h * (0.45 + r() * 0.5);
    g.bezierCurveTo(cx, y + h * 0.55 - bump * 0.4, cx + seg * 0.15, y + h * 0.55 - bump, cx + seg * 0.5, y + h * 0.55 - bump);
    g.bezierCurveTo(cx + seg * 0.85, y + h * 0.55 - bump, cx + seg, y + h * 0.55 - bump * 0.4, cx + seg, y + h * 0.55);
    cx += seg;
  }
  g.lineTo(x + w, y + h);
  g.closePath();
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, '#f0d27a');
  gr.addColorStop(0.5, fill);
  gr.addColorStop(1, '#c99a2f');
  g.fillStyle = gr;
  g.fill();
  g.lineWidth = Math.max(2, h * 0.07);
  g.strokeStyle = line;
  g.lineJoin = 'round';
  g.stroke();
  // 雲の中のうずまきの線
  g.strokeStyle = 'rgba(120,80,10,0.55)';
  g.lineWidth = Math.max(1, h * 0.03);
  for (let i = 0; i < n; i++) {
    const px = x + (w / n) * (i + 0.5);
    g.beginPath();
    g.arc(px, y + h * 0.62, h * 0.18, 0.4, 4.6);
    g.stroke();
  }
  g.restore();
}

/** 桜の花（5枚の花びら） */
export function blossom(g: G, x: number, y: number, r: number, rot = 0, fill = '#f5b6c4', line = '#8d3b4c'): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = fill;
  g.strokeStyle = line;
  g.lineWidth = Math.max(1, r * 0.1);
  g.lineJoin = 'round';
  for (let i = 0; i < 5; i++) {
    g.save();
    g.rotate((i / 5) * Math.PI * 2);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-r * 0.55, -r * 0.35, -r * 0.5, -r * 1.0, -r * 0.14, -r * 0.92);
    g.lineTo(0, -r * 0.78);
    g.lineTo(r * 0.14, -r * 0.92);
    g.bezierCurveTo(r * 0.5, -r * 1.0, r * 0.55, -r * 0.35, 0, 0);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
  g.fillStyle = '#d8421e';
  g.beginPath();
  g.arc(0, 0, r * 0.12, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** 三つ巴（太鼓の皮の紋） */
export function tomoe(g: G, x: number, y: number, r: number, color = INK, ring = true): void {
  g.save();
  g.translate(x, y);
  g.fillStyle = color;
  g.strokeStyle = color;
  if (ring) {
    g.lineWidth = r * 0.1;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
  }
  for (let i = 0; i < 3; i++) {
    g.save();
    g.rotate((i / 3) * Math.PI * 2);
    g.beginPath();
    g.arc(0, -r * 0.5, r * 0.3, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(r * 0.3, -r * 0.5);
    g.bezierCurveTo(r * 0.58, -r * 0.1, r * 0.28, r * 0.24, -r * 0.18, r * 0.22);
    g.bezierCurveTo(r * 0.12, r * 0.12, r * 0.18, -r * 0.2, -r * 0.08, -r * 0.48);
    g.closePath();
    g.fill();
    g.restore();
  }
  g.restore();
}

/** 富士山。cx：中心、base：裾の y、hw：裾の半分の幅、h：高さ、snow：雪の高さの割合 */
export function fuji(g: G, cx: number, base: number, hw: number, h: number, o: { body: string; shade: string; snow: string; line: string; lw: number; seed?: number }): void {
  const r = rng(o.seed ?? 3);
  const top = base - h;
  const sw = hw * 0.16;
  const path = () => {
    g.beginPath();
    g.moveTo(cx - hw, base);
    g.bezierCurveTo(cx - hw * 0.62, base - h * 0.12, cx - hw * 0.34, base - h * 0.62, cx - sw, top + h * 0.03);
    g.quadraticCurveTo(cx, top - h * 0.03, cx + sw, top + h * 0.03);
    g.bezierCurveTo(cx + hw * 0.34, base - h * 0.62, cx + hw * 0.62, base - h * 0.12, cx + hw, base);
    g.closePath();
  };
  // 山肌：上が明るく裾が濃い
  const gr = g.createLinearGradient(0, top, 0, base);
  gr.addColorStop(0, o.body);
  gr.addColorStop(1, o.shade);
  path();
  g.fillStyle = gr;
  g.fill();
  g.save();
  path();
  g.clip();
  // 縦の筋（谷）
  g.strokeStyle = 'rgba(80,30,25,0.35)';
  g.lineWidth = Math.max(1.5, o.lw * 0.5);
  for (let i = 0; i < 9; i++) {
    const t = (i - 4) / 4.5;
    g.beginPath();
    g.moveTo(cx + t * sw * 1.3, top + h * 0.08);
    g.quadraticCurveTo(cx + t * hw * 0.45, base - h * 0.4, cx + t * hw * 1.05 + (r() - 0.5) * 6, base);
    g.stroke();
  }
  // 雪：ぎざぎざの裾の線
  const snowY = top + h * 0.3;
  g.fillStyle = o.snow;
  g.beginPath();
  g.moveTo(cx - hw * 0.4, snowY + h * 0.06);
  const n = 11;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = cx - hw * 0.4 + t * hw * 0.8;
    const spread = 1 - Math.abs(t - 0.5) * 2;
    const yy = snowY - spread * h * 0.04 + (i % 2 === 0 ? h * 0.1 : h * 0.02) * (0.4 + r() * 0.8) + (1 - spread) * h * 0.06;
    g.lineTo(x, yy);
  }
  g.lineTo(cx + hw * 0.4, top - h * 0.1);
  g.lineTo(cx - hw * 0.4, top - h * 0.1);
  g.closePath();
  g.fill();
  g.restore();
  path();
  g.lineWidth = o.lw;
  g.strokeStyle = o.line;
  g.lineJoin = 'round';
  g.stroke();
}

/** 大波の波頭（背から先端までの稜線）をローカル座標で返す。u: 0（頂の手前）〜 1（先端） */
export function waveCrestPoint(u: number): [number, number] {
  // 稜線は 2 本のベジェ：頂（3.0,3.5）→ 頂点（5.0,5.6）→ 先端（7.1,3.5）
  const bz = (p: number[], t: number): [number, number] => {
    const v = 1 - t;
    return [
      v * v * v * p[0] + 3 * v * v * t * p[2] + 3 * v * t * t * p[4] + t * t * t * p[6],
      v * v * v * p[1] + 3 * v * v * t * p[3] + 3 * v * t * t * p[5] + t * t * t * p[7],
    ];
  };
  const a = [2.9, 3.5, 3.4, 4.2, 4.0, 5.45, 5.0, 5.6];
  const b = [5.0, 5.6, 6.0, 5.7, 7.0, 4.8, 7.1, 3.5];
  return u < 0.45 ? bz(a, u / 0.45) : bz(b, (u - 0.45) / 0.55);
}

/** 大波の絵の幅（ローカル単位）。絵はおよそ x: -0.6 〜 7.8、y: 0 〜 6.8 */
export const WAVE_WIDTH = 8.0;

/**
 * 北斎風の大波。(x, y) は波のふもとの左端、s は「波の単位 1 あたりのピクセル」。
 * 背（藍）・うずまく内側（明るい青）・白い泡の頂と、鳥の爪のような泡の指、しぶきの粒。flip で左右反転（波が左へ巻く）。
 */
export function greatWave(g: G, x: number, y: number, s: number, o: { deep?: string; mid?: string; foam?: string; line?: string; lw?: number; flip?: boolean; seed?: number } = {}): void {
  const deep = o.deep ?? '#17317a';
  const foam = o.foam ?? '#f7f3e4';
  const line = o.line ?? INK;
  const lw = o.lw ?? Math.max(2, s * 0.07);
  const r = rng(o.seed ?? 5);
  const sx = o.flip ? -1 : 1;
  const P = (lx: number, ly: number): [number, number] => [x + sx * lx * s, y - ly * s];
  const mv = (lx: number, ly: number) => g.moveTo(...P(lx, ly));
  const ln = (lx: number, ly: number) => g.lineTo(...P(lx, ly));
  const bz = (a: number, b: number, c: number, d: number, e: number, f: number) => g.bezierCurveTo(...P(a, b), ...P(c, d), ...P(e, f));
  const bodyPath = () => {
    g.beginPath();
    mv(-0.6, 0);
    bz(0.7, 0.25, 1.9, 1.4, 2.9, 3.5); // 背のゆるい斜面
    bz(3.4, 4.2, 4.0, 5.45, 5.0, 5.6); // 頂へ
    bz(6.0, 5.7, 7.0, 4.8, 7.1, 3.5); // 巻いて先端へ
    bz(6.9, 3.0, 6.1, 3.0, 5.5, 3.4); // 巻きの下側
    bz(5.0, 3.7, 4.3, 3.4, 4.2, 2.6); // 正面の壁
    bz(4.0, 1.6, 4.5, 0.7, 4.9, 0);
    g.closePath();
  };
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // 内側（巻きの下のうつろ）：明るい青から泡の白へ
  {
    g.beginPath();
    mv(7.1, 3.5);
    bz(6.9, 3.0, 6.1, 3.0, 5.5, 3.4);
    bz(5.0, 3.7, 4.3, 3.4, 4.2, 2.6);
    bz(4.0, 1.6, 4.5, 0.7, 4.9, 0);
    ln(6.7, 0);
    bz(7.3, 1.1, 7.4, 2.5, 7.1, 3.5);
    g.closePath();
    const [gx, gy] = P(5.8, 3.5);
    const [hx, hy] = P(5.8, 0);
    const gr = g.createLinearGradient(gx, gy, hx, hy);
    gr.addColorStop(0, '#2f63ad');
    gr.addColorStop(0.55, '#6ea5d6');
    gr.addColorStop(1, '#cfe5f2');
    g.fillStyle = gr;
    g.fill();
    // 内側の筋
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = lw * 0.4;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      mv(6.7 - k * 0.45, 3.15 - k * 0.1);
      bz(6.3 - k * 0.4, 2.2 - k * 0.2, 6.0 - k * 0.5, 1.2, 5.6 - k * 0.2, 0.2);
      g.stroke();
    }
  }

  // 体（背は藍、ふもとほど明るい：ぼかし摺り）
  bodyPath();
  {
    const [gx, gy] = P(2.5, 5.6);
    const [hx, hy] = P(3.0, 0);
    const gr = g.createLinearGradient(gx, gy, hx, hy);
    gr.addColorStop(0, deep);
    gr.addColorStop(0.6, '#1f4aa0');
    gr.addColorStop(1, '#3d7cc2');
    g.fillStyle = gr;
    g.fill();
  }
  // 背の筋（斜面に沿って流れる細い線）
  g.save();
  bodyPath();
  g.clip();
  g.strokeStyle = 'rgba(200,226,248,0.5)';
  for (let k = 0; k < 9; k++) {
    g.lineWidth = lw * (k % 3 === 0 ? 0.5 : 0.28);
    g.beginPath();
    const d = 0.28 * k + 0.1;
    mv(-0.6 + d * 1.2, 0 - 0.1);
    bz(0.7 + d * 1.1, 0.25 - d * 0.1, 1.9 + d * 0.95, 1.4 - d * 0.18, 2.9 + d * 0.62, 3.5 - d * 0.5);
    bz(3.4 + d * 0.5, 4.2 - d * 0.5, 4.0 + d * 0.3, 5.45 - d * 0.62, 5.0 + d * 0.15, 5.6 - d * 0.7);
    g.stroke();
  }
  // 渦の筋（巻きの手前の面に沿って）
  g.strokeStyle = 'rgba(160,200,235,0.45)';
  for (let k = 0; k < 4; k++) {
    g.lineWidth = lw * 0.3;
    g.beginPath();
    mv(4.3 + k * 0.28, 2.6 + k * 0.1);
    bz(4.4 + k * 0.3, 3.7 + k * 0.1, 5.4 + k * 0.2, 4.4 + k * 0.12, 6.4 - k * 0.2, 4.2 - k * 0.1);
    g.stroke();
  }
  g.restore();

  // 頂の泡：稜線に沿った白い帯（頂のあたりが厚く、両端で細くなる）
  {
    const n = 40;
    const up: [number, number][] = [];
    const lo: [number, number][] = [];
    const sm = (a: number, b: number, v: number) => {
      const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    for (let i = 0; i <= n; i++) {
      const u = 0.12 + (0.88 * i) / n;
      const [qx, qy] = waveCrestPoint(u);
      const [ax, ay] = waveCrestPoint(Math.max(0, u - 0.02));
      const [bx, by] = waveCrestPoint(Math.min(1, u + 0.02));
      let tx = bx - ax, ty = by - ay;
      const l = Math.hypot(tx, ty) || 1;
      tx /= l;
      ty /= l;
      // 稜線の内側（下側）へ
      const nx = ty, ny = -tx;
      const w = (0.6 * Math.pow(1 - u, 0.8) + 0.12 + 0.05 * Math.sin(i * 1.9)) * sm(0.12, 0.3, u) * (1 - sm(0.93, 1.0, u));
      up.push([qx, qy]);
      lo.push([qx + nx * w, qy + ny * w]);
    }
    g.beginPath();
    up.forEach(([a, b], i) => (i === 0 ? mv(a, b) : ln(a, b)));
    for (let i = lo.length - 1; i >= 0; i--) ln(lo[i][0], lo[i][1]);
    g.closePath();
    g.fillStyle = foam;
    g.fill();
  }

  // 泡の指（鳥の爪）：根もとから前へ伸び、先で下へ曲がって垂れる。(qx,qy)=根もと、(tx,ty)=稜線の向き、(nx,ny)=外向き
  const claw = (qx: number, qy: number, tx: number, ty: number, nx: number, ny: number, len: number, bw: number) => {
    // 外へ立ち上がってから、先で進行方向へ・下へ曲がる鉤爪
    const tipx = qx + nx * len * 0.6 + tx * len * 0.95;
    const tipy = qy + ny * len * 0.6 + ty * len * 0.95 - 0.22 * len;
    const b0: [number, number] = [qx - tx * bw, qy - ty * bw];
    const b1: [number, number] = [qx + tx * bw * 0.8, qy + ty * bw * 0.8];
    g.beginPath();
    mv(b0[0], b0[1]);
    g.quadraticCurveTo(...P(b0[0] + nx * len * 0.95 + tx * len * 0.1, b0[1] + ny * len * 0.95 + ty * len * 0.1), ...P(tipx, tipy));
    g.quadraticCurveTo(...P(b1[0] + nx * len * 0.22 + tx * len * 0.55, b1[1] + ny * len * 0.22 + ty * len * 0.55 - 0.05 * len), ...P(b1[0], b1[1]));
    g.closePath();
    g.fillStyle = foam;
    g.fill();
    g.lineWidth = lw * 0.55;
    g.strokeStyle = line;
    g.stroke();
    // 先のしずく
    const ex = tipx - qx, ey = tipy - qy;
    const el = Math.hypot(ex, ey) || 1;
    g.beginPath();
    g.arc(...P(tipx + (ex / el) * 0.16, tipy + (ey / el) * 0.16), s * (0.035 + r() * 0.035), 0, Math.PI * 2);
    g.fillStyle = foam;
    g.fill();
    g.lineWidth = lw * 0.3;
    g.stroke();
  };
  const claws = 11;
  for (let i = 0; i < claws; i++) {
    const u = 0.3 + (0.66 * i) / (claws - 1) + (r() - 0.5) * 0.025;
    const [qx, qy] = waveCrestPoint(u);
    const [ax, ay] = waveCrestPoint(Math.max(0, u - 0.02));
    const [bx, by] = waveCrestPoint(Math.min(1, u + 0.02));
    let tx = bx - ax, ty = by - ay;
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const len = (0.75 + 0.55 * Math.sin(Math.PI * Math.min(1, (u - 0.2) * 1.3))) * (0.85 + r() * 0.4);
    claw(qx, qy, tx, ty, -ty, tx, len, 0.17 + 0.1 * r());
  }
  // 巻きの先端から下へ垂れる泡（内側のうつろの縁）
  for (let i = 0; i < 5; i++) {
    const t = 0.1 + i * 0.19;
    // 先端 (7.1,3.5) から (6.9,0.4) へ下る縁
    const qx = 7.1 - 0.35 * t - 0.2 * Math.sin(t * Math.PI), qy = 3.5 - 3.1 * t;
    claw(qx, qy, 0.0, -1.0, 1.0, 0.0, 0.5 + 0.3 * r(), 0.2);
  }

  // 輪郭（墨）：背・稜線・巻きの先端と下側・正面の壁（ふもとは描かない）
  g.strokeStyle = line;
  g.lineWidth = lw;
  g.beginPath();
  mv(-0.6, 0);
  bz(0.7, 0.25, 1.9, 1.4, 2.9, 3.5);
  bz(3.4, 4.2, 4.0, 5.45, 5.0, 5.6);
  bz(6.0, 5.7, 7.0, 4.8, 7.1, 3.5);
  bz(6.9, 3.0, 6.1, 3.0, 5.5, 3.4);
  bz(5.0, 3.7, 4.3, 3.4, 4.2, 2.6);
  bz(4.0, 1.6, 4.5, 0.7, 4.9, 0);
  g.stroke();

  // しぶきの粒（空中の白い玉）
  g.fillStyle = foam;
  g.strokeStyle = line;
  g.lineWidth = lw * 0.3;
  for (let i = 0; i < 22; i++) {
    const [qx, qy] = waveCrestPoint(0.2 + r() * 0.8);
    const bx = qx + 0.15 + r() * 1.3, by = qy + 0.1 + r() * 1.1 - r() * 0.5;
    g.beginPath();
    g.arc(...P(bx, by), s * (0.03 + r() * 0.07), 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.restore();
}

/** 松（枝ぶりの平たい塊を重ねる） */
export function pine(g: G, x: number, y: number, s: number, seed = 1): void {
  const r = rng(seed);
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // 幹
  g.strokeStyle = '#4a2c18';
  g.lineWidth = s * 0.22;
  g.beginPath();
  g.moveTo(x, y);
  g.bezierCurveTo(x - s * 0.3, y - s * 0.6, x + s * 0.35, y - s * 1.1, x + s * 0.05, y - s * 1.7);
  g.stroke();
  const clumps: [number, number, number][] = [[-0.55, -1.0, 0.7], [0.62, -1.35, 0.78], [0.0, -1.85, 0.72], [-0.7, -1.62, 0.5]];
  for (const [cx, cy, cr] of clumps) {
    const px = x + cx * s, py = y + cy * s;
    g.beginPath();
    g.moveTo(px - cr * s, py + cr * s * 0.25);
    g.bezierCurveTo(px - cr * s * 0.9, py - cr * s * 0.55, px - cr * s * 0.2, py - cr * s * 0.7, px, py - cr * s * 0.5);
    g.bezierCurveTo(px + cr * s * 0.3, py - cr * s * 0.75, px + cr * s * 0.9, py - cr * s * 0.55, px + cr * s, py + cr * s * 0.25);
    for (let i = 0; i < 5; i++) {
      const t = 1 - i / 5;
      g.lineTo(px + (t * 2 - 1) * cr * s * 0.9, py + cr * s * (0.25 + (i % 2 ? 0.18 : 0.05)) + r() * s * 0.04);
    }
    g.closePath();
    g.fillStyle = '#3f6a35';
    g.fill();
    g.lineWidth = s * 0.05;
    g.strokeStyle = INK;
    g.stroke();
    g.strokeStyle = 'rgba(190,230,150,0.5)';
    g.lineWidth = s * 0.03;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.moveTo(px - cr * s * 0.6 + k * cr * s * 0.4, py - cr * s * 0.1);
      g.lineTo(px - cr * s * 0.5 + k * cr * s * 0.4, py + cr * s * 0.12);
      g.stroke();
    }
  }
  g.restore();
}

/** 朱の落款（四角い印） */
export function seal(g: G, x: number, y: number, size: number, ch: string, font: string): void {
  g.save();
  g.fillStyle = '#c8321f';
  g.fillRect(x - size / 2, y - size / 2, size, size);
  g.strokeStyle = '#8d1d12';
  g.lineWidth = size * 0.05;
  g.strokeRect(x - size / 2 + size * 0.06, y - size / 2 + size * 0.06, size * 0.88, size * 0.88);
  g.fillStyle = '#f7ead0';
  g.font = `900 ${Math.round(size * 0.66)}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(ch, x, y + size * 0.04);
  g.restore();
}

/** 渦巻く雲（龍の雲）：ぐるりと巻いた雲の頭を並べる */
export function swirlCloud(g: G, x: number, y: number, s: number, fill: string, line: string, flip = 1): void {
  g.save();
  g.translate(x, y);
  g.scale(flip, 1);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-s * 1.2, s * 0.35);
  g.bezierCurveTo(-s * 1.3, -s * 0.1, -s * 0.8, -s * 0.5, -s * 0.4, -s * 0.2);
  g.bezierCurveTo(-s * 0.35, -s * 0.8, s * 0.35, -s * 0.9, s * 0.45, -s * 0.35);
  g.bezierCurveTo(s * 0.6, -s * 0.75, s * 1.3, -s * 0.5, s * 1.1, 0);
  g.bezierCurveTo(s * 1.5, s * 0.05, s * 1.5, s * 0.5, s * 1.0, s * 0.5);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = s * 0.08;
  g.strokeStyle = line;
  g.stroke();
  // 巻き込みの渦
  g.lineWidth = s * 0.06;
  for (const [cx, cy, cr] of [[-0.45, 0.05, 0.28], [0.45, -0.2, 0.3], [-0.05, -0.45, 0.22]] as [number, number, number][]) {
    g.beginPath();
    g.arc(cx * s, cy * s, cr * s, 0.3, 4.9);
    g.stroke();
    g.beginPath();
    g.arc(cx * s, cy * s, cr * s * 0.45, 1.0, 5.5);
    g.stroke();
  }
  g.restore();
}
