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
function shade(x, y) {
  let col = [0, 0, 0];
  let alpha = 0;
  const over = (c, a) => {
    col = mixc(col, c, a);
    alpha = alpha + a * (1 - alpha);
  };

  // 背景：角丸の台
  const bg = roundRectSdf(x, y, 128, 128, 124, 124, 46);
  if (bg < 0) {
    const t = y / 256;
    let c = mixc([0.05, 0.07, 0.2], [0.13, 0.04, 0.24], t);
    // 斜めのグリッド
    const g = (Math.abs(((x + y) % 32) - 16) < 0.8 || Math.abs(((x - y + 512) % 32) - 16) < 0.8) ? 0.06 : 0;
    c = mixc(c, [0.3, 0.6, 1], g);
    over(c, 1);
    // ネオンの縁
    const edge = Math.abs(bg + 7);
    if (edge < 3.2) over([0.35, 0.95, 1], clamp(1 - edge / 3.2) * 0.95);
  }

  // フリッパー
  const fl = capsuleSdf(x, y, 54, 206, 158, 172, 22, 11);
  if (fl < 0) {
    const inner = capsuleSdf(x, y, 54, 206, 158, 172, 15, 6);
    over(inner < 0 ? [0.96, 0.32, 0.22] : [1, 0.97, 0.9], 1);
    if (inner < 0 && inner > -3) over([1, 0.6, 0.45], 0.6);
  }
  const pivot = Math.hypot(x - 54, y - 206) - 7;
  if (pivot < 0) over([0.95, 0.85, 0.3], 1);

  // クロームのボール
  const bx = 150, by = 104, br = 68;
  const d = Math.hypot(x - bx, y - by);
  if (d < br) {
    const nx = (x - bx) / br, ny = (y - by) / br;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    // 反射ベクトルの y で空・地平線・床を塗り分ける
    const ry = ny * 2 * nz;
    let c;
    if (ry < -0.12) c = mixc([0.85, 0.93, 1], [0.35, 0.55, 0.95], clamp((-ry - 0.12) / 0.9));
    else if (ry < 0.05) c = [0.08, 0.1, 0.18];
    else c = mixc([0.55, 0.4, 0.7], [0.18, 0.1, 0.25], clamp(ry));
    const rim = Math.pow(1 - nz, 3);
    c = mixc(c, [0.3, 0.9, 1], rim * 0.6);
    const hl = Math.hypot(nx + 0.38, ny + 0.42);
    if (hl < 0.2) c = mixc(c, [1, 1, 1], clamp(1 - hl / 0.2) * 0.95);
    over(c, clamp(br - d));
  }

  // きらめき
  for (const [sx, sy, s, c] of [
    [52, 58, 16, [1, 0.9, 0.4]],
    [214, 196, 12, [0.4, 1, 1]],
    [86, 132, 8, [1, 0.6, 0.9]],
  ]) {
    const ax = Math.abs(x - sx), ay = Math.abs(y - sy);
    const v = Math.max(clamp(1 - (ax * ay) / (s * 1.4)) * clamp(1 - Math.max(ax, ay) / s), 0);
    if (v > 0) over(c, v);
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
