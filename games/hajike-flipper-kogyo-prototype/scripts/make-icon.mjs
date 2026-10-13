// アプリアイコンをコードだけで生成する（外部画像なし）。
// build/icon.ico（インストーラー・exe用）、build/icon.png、public/icon.png（ウィンドウ用）を出力。
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const mixc = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

function roundRectSdf(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - hw + r;
  const qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function capsuleSdf(x, y, ax, ay, bx, by, ra, rb) {
  const pax = x - ax, pay = y - ay, bax = bx - ax, bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay));
  const dx = pax - bax * h, dy = pay - bay * h;
  return Math.hypot(dx, dy) - mix(ra, rb, h);
}

// 1サンプルの色（256x256 座標系）を返す。[r,g,b,a] 0..1
// 「弾け！フリッパー興業」：漆の地に金の縁、青海波、灯った提灯と銀の玉
function shade(x, y) {
  let col = [0, 0, 0];
  let alpha = 0;
  const over = (c, a) => {
    col = mixc(col, c, a);
    alpha = alpha + a * (1 - alpha);
  };

  // 背景：角丸の漆塗り
  const bg = roundRectSdf(x, y, 128, 128, 124, 124, 40);
  if (bg < 0) {
    const t = y / 256;
    let c = mixc([0.2, 0.04, 0.03], [0.07, 0.015, 0.01], t);
    // 青海波（下の方にうっすら金で）
    const R = 22;
    const row = Math.floor(y / (R * 0.5));
    const ox = row % 2 ? R : 0;
    const cx = Math.round((x - ox) / (R * 2)) * R * 2 + ox;
    const cy = (row + 1) * R * 0.5;
    const dd = Math.hypot(x - cx, y - cy);
    if (dd < R && y > 150) {
      const ring = Math.abs(((dd % 6) + 6) % 6 - 3);
      if (ring < 0.9) c = mixc(c, [0.85, 0.62, 0.22], 0.22 * clamp((y - 150) / 60));
    }
    over(c, 1);
    // 金の縁
    const edge = Math.abs(bg + 8);
    if (edge < 2.6) over([0.95, 0.74, 0.3], clamp(1 - edge / 2.6) * 0.95);
  }

  // 提灯のまわりの灯り
  const lx = 104, ly = 120;
  const glow = Math.hypot((x - lx) / 1.05, y - ly);
  if (bg < 0) over([1, 0.55, 0.15], clamp(1 - glow / 118) * 0.35);

  // 提灯：胴（楕円）と上下の黒い枠
  const ex = (x - lx) / 64, ey = (y - ly) / 74;
  const e = ex * ex + ey * ey;
  if (e < 1) {
    const k = Math.sqrt(e);
    let c = mixc([1, 0.86, 0.5], [0.86, 0.12, 0.08], clamp(k * 1.25));
    c = mixc(c, [0.32, 0.03, 0.02], clamp((k - 0.75) * 3));
    // 竹ひご（胴の丸みに合わせた横線）
    const yy = (y - ly) / 74;
    const rib = Math.abs(((yy * 7 + 7.5) % 1) - 0.5);
    if (rib < 0.07) c = mixc(c, [0.35, 0.04, 0.02], 0.55);
    // 紋：玉とフリッパーの影絵（墨で胴に描いたように）
    if (Math.hypot(x - (lx + 9), y - (ly - 14)) < 14) c = mixc(c, [0.1, 0.03, 0.02], 0.92);
    if (capsuleSdf(x, y, lx - 30, ly + 22, lx + 22, ly + 6, 10, 5.5) < 0) c = mixc(c, [0.1, 0.03, 0.02], 0.92);
    if (Math.hypot(x - (lx - 30), y - (ly + 22)) < 4) c = [0.95, 0.74, 0.3];
    over(c, clamp((1 - e) * 60));
  }
  for (const [y0, y1] of [[38, 54], [186, 202]]) {
    const cap = roundRectSdf(x, y, lx, (y0 + y1) / 2, 34, (y1 - y0) / 2, 4);
    if (cap < 0) over(mixc([0.12, 0.08, 0.07], [0.04, 0.02, 0.02], (y - y0) / (y1 - y0)), clamp(-cap * 2));
  }
  // 吊り紐と房
  if (Math.abs(x - lx) < 2.2 && y > 18 && y < 40) over([0.1, 0.07, 0.06], 1);
  for (const dx of [-8, 0, 8]) if (Math.abs(x - (lx + dx + (y - 202) * dx * 0.02)) < 2.2 && y > 202 && y < 226) over([0.9, 0.2, 0.15], 1);

  // 銀の玉（金と朱の映り込み）
  const bx = 180, by = 180, br = 50;
  const d = Math.hypot(x - bx, y - by);
  if (d < br) {
    const nx = (x - bx) / br, ny = (y - by) / br;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const ry = ny * 2 * nz;
    let c;
    if (ry < -0.12) c = mixc([1, 0.95, 0.78], [0.95, 0.66, 0.25], clamp((-ry - 0.12) / 0.9));
    else if (ry < 0.05) c = [0.12, 0.05, 0.04];
    else c = mixc([0.75, 0.2, 0.12], [0.2, 0.04, 0.03], clamp(ry));
    const rim = Math.pow(1 - nz, 3);
    c = mixc(c, [1, 0.8, 0.4], rim * 0.55);
    const hl = Math.hypot(nx + 0.38, ny + 0.42);
    if (hl < 0.2) c = mixc(c, [1, 1, 1], clamp(1 - hl / 0.2) * 0.95);
    over(c, clamp(br - d));
  }

  // 金のきらめき
  for (const [sx, sy, s] of [[214, 62, 15], [46, 214, 11], [196, 112, 8]]) {
    const ax = Math.abs(x - sx), ay = Math.abs(y - sy);
    const v = Math.max(clamp(1 - (ax * ay) / (s * 1.4)) * clamp(1 - Math.max(ax, ay) / s), 0);
    if (v > 0) over([1, 0.85, 0.4], v);
  }

  return [col[0], col[1], col[2], alpha];
}

function render(size) {
  const ss = 4;
  const out = Buffer.alloc(size * size * 4);
  const scale = 256 / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const [cr, cg, cb, ca] = shade((px + (sx + 0.5) / ss) * scale, (py + (sy + 0.5) / ss) * scale);
          r += cr * ca; g += cg * ca; b += cb * ca; a += ca;
        }
      }
      const n = ss * ss;
      const o = (py * size + px) * 4;
      const A = a / n;
      out[o] = Math.round(clamp(A > 0 ? r / a : 0) * 255);
      out[o + 1] = Math.round(clamp(A > 0 ? g / a : 0) * 255);
      out[o + 2] = Math.round(clamp(A > 0 ? b / a : 0) * 255);
      out[o + 3] = Math.round(A * 255);
    }
  }
  return out;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e[2] = 0; e[3] = 0;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = sizes.map((size) => ({ size, png: encodePng(size, render(size)) }));
const big = encodePng(512, render(512));

for (const [file, data] of [
  ['build/icon.ico', encodeIco(images)],
  ['build/icon.png', big],
  ['public/icon.png', images[images.length - 1].png],
]) {
  const p = join(root, file);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, data);
}
console.log('icon generated:', sizes.join(','), '+ 512px png');
