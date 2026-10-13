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

/**
 * 北斎風の大波。(x, y) は波の根元の左下、s は「波の幅 1 あたりのピクセル」（波の幅はおよそ 8）。
 * flip で左右反転（波が左へ巻く）。
 */
export function greatWave(g: G, x: number, y: number, s: number, o: { deep?: string; mid?: string; foam?: string; line?: string; lw?: number; flip?: boolean; seed?: number } = {}): void {
  const deep = o.deep ?? '#1d3a75';
  const mid = o.mid ?? '#4a82bd';
  const foam = o.foam ?? '#f7f3e4';
  const line = o.line ?? INK;
  const lw = o.lw ?? Math.max(2, s * 0.09);
  const r = rng(o.seed ?? 5);
  const sx = o.flip ? -1 : 1;
  const P = (lx: number, ly: number): [number, number] => [x + sx * lx * s, y - ly * s];
  const mv = (lx: number, ly: number) => g.moveTo(...P(lx, ly));
  const bz = (a: number, b: number, c: number, d: number, e: number, f: number) => g.bezierCurveTo(...P(a, b), ...P(c, d), ...P(e, f));
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // 波の本体（暗い藍）
  g.beginPath();
  mv(-0.5, 0);
  bz(0.3, 0.5, 1.3, 2.3, 2.7, 4.0);
  bz(3.5, 5.3, 5.3, 5.6, 6.3, 3.9);
  bz(6.0, 3.2, 5.2, 2.6, 4.3, 3.0);
  bz(3.3, 3.5, 3.4, 1.4, 4.4, 0);
  g.closePath();
  g.fillStyle = deep;
  g.fill();
  // 巻き込みの内側（明るい藍）
  g.beginPath();
  mv(6.0, 3.3);
  bz(5.3, 2.7, 4.5, 2.9, 4.0, 3.2);
  bz(3.6, 3.0, 3.7, 1.6, 4.3, 0.0);
  bz(4.8, 0.9, 5.4, 2.0, 6.0, 3.3);
  g.closePath();
  g.fillStyle = mid;
  g.fill();
  // 背の筋（波の流れ）
  g.strokeStyle = 'rgba(190,220,245,0.55)';
  g.lineWidth = lw * 0.55;
  for (let k = 0; k < 5; k++) {
    g.beginPath();
    mv(0.3 + k * 0.12, 0.2 + k * 0.45);
    bz(0.9 + k * 0.2, 0.9 + k * 0.55, 1.7 + k * 0.2, 2.4 + k * 0.4, 2.5 + k * 0.1, 3.5 + k * 0.28);
    g.stroke();
  }
  // 白い泡のふち（頂から先端まで）
  g.beginPath();
  mv(2.4, 3.8);
  bz(3.3, 5.3, 5.4, 5.8, 6.4, 3.9);
  bz(6.5, 3.5, 6.3, 3.3, 6.0, 3.3);
  bz(5.7, 3.9, 5.0, 4.6, 3.9, 4.4);
  bz(3.4, 4.3, 2.9, 4.1, 2.4, 3.8);
  g.closePath();
  g.fillStyle = foam;
  g.fill();
  // 泡の爪（しぶきの指）
  const claws = 9;
  for (let i = 0; i < claws; i++) {
    const t = i / (claws - 1);
    // 頂から先端への曲線上の点
    const bx = 2.7 + t * 3.6, by = 4.1 + Math.sin(t * Math.PI) * 1.35 - t * 0.55;
    const len = 0.55 + r() * 0.45;
    const ang = -0.9 - t * 0.9 + (r() - 0.5) * 0.4;
    g.beginPath();
    mv(bx - 0.18, by);
    g.quadraticCurveTo(...P(bx + Math.cos(ang) * len * 0.5 + 0.1, by - Math.sin(ang) * len * 0.5), ...P(bx + Math.cos(ang) * len, by - Math.sin(ang) * len));
    g.quadraticCurveTo(...P(bx + 0.1, by + 0.1), ...P(bx + 0.18, by));
    g.closePath();
    g.fillStyle = foam;
    g.fill();
    g.lineWidth = lw * 0.6;
    g.strokeStyle = line;
    g.stroke();
  }
  // しぶきの粒
  g.fillStyle = foam;
  for (let i = 0; i < 16; i++) {
    const bx = 3.0 + r() * 4.4, by = 4.6 + r() * 1.8;
    g.beginPath();
    g.arc(...P(bx, by), s * (0.04 + r() * 0.09), 0, Math.PI * 2);
    g.fill();
    g.lineWidth = lw * 0.35;
    g.stroke();
  }
  // 輪郭（墨）
  g.strokeStyle = line;
  g.lineWidth = lw;
  g.beginPath();
  mv(-0.5, 0);
  bz(0.3, 0.5, 1.3, 2.3, 2.7, 4.0);
  bz(3.5, 5.3, 5.3, 5.6, 6.3, 3.9);
  bz(6.0, 3.2, 5.2, 2.6, 4.3, 3.0);
  bz(3.3, 3.5, 3.4, 1.4, 4.4, 0);
  g.stroke();
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
