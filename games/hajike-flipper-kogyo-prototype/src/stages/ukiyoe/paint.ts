// UKIYO-E の床の絵：下は藍の海と大波、中ほどは神社の庭（参道・苔・枯山水）、上は朝日と赤富士と金雲。
import { BRUSH_FONT, drawBrushText } from '../../render/effects';
import type { PaintApi } from '../types';
import { blossom, fibres, fuji, goldCloud, greatWave, pine, rng, seal, seigaiha, swirlCloud } from './art';
import { INK, MOSS } from './palette';

export function paintUkiyoe({ g, map, scale }: PaintApi): void {
  const px = (v: number) => v * scale;
  const [xL] = map(-9.0, 0);
  const [xR] = map(10.6, 0);
  const [, yTop] = map(0, 40.4);
  const [, yBot] = map(0, -0.9);
  const at = (x: number, y: number) => map(x, y);

  // ───── 空（上）─────
  {
    const [, y0] = at(0, 40.4);
    const [, y1] = at(0, 27.6);
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, '#7ea6c8');
    gr.addColorStop(0.45, '#bcd3d2');
    gr.addColorStop(0.8, '#f3dba6');
    gr.addColorStop(1, '#f7e3b4');
    g.fillStyle = gr;
    g.fillRect(xL, y0, xR - xL, y1 - y0);
  }

  // 朝日
  {
    const [sx, sy] = at(-4.6, 36.2);
    g.save();
    g.fillStyle = '#e4502c';
    g.strokeStyle = INK;
    g.lineWidth = px(0.1);
    g.beginPath();
    g.arc(sx, sy, px(1.15), 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.strokeStyle = 'rgba(224,178,56,0.8)';
    g.lineWidth = px(0.12);
    g.beginPath();
    g.arc(sx, sy, px(1.55), 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  // 赤富士
  {
    const [cx, by] = at(0.75, 28.4);
    fuji(g, cx, by, px(10.2), px(8.9), { body: '#c9674a', shade: '#8f3b33', snow: '#f8f2de', line: INK, lw: px(0.13), seed: 4 });
  }

  // 松（左右の端）
  {
    const [lx, ly] = at(-7.7, 29.1);
    pine(g, lx, ly, px(1.05), 2);
    const [rx, ry] = at(8.2, 29.3);
    pine(g, rx, ry, px(0.95), 7);
  }

  // 金雲（金箔の雲）：山のすそと、空の左右
  {
    const clouds: [number, number, number, number, number][] = [
      [-9.2, 28.7, 7.0, 1.7, 11],
      [3.2, 28.4, 7.6, 1.8, 12],
      [-9.4, 32.6, 4.6, 1.5, 13],
      [4.6, 34.4, 5.2, 1.5, 14],
      [-8.6, 37.4, 5.6, 1.7, 15],
    ];
    for (const [x, y, w, h, seed] of clouds) {
      const [cx, cy] = at(x, y + h);
      goldCloud(g, cx, cy, px(w), px(h), seed);
    }
  }

  // ───── 庭（中）─────
  {
    // 苔の島と石
    const r = rng(21);
    const mossAt: [number, number, number, number][] = [
      [-6.0, 17.0, 1.7, 1.0],
      [6.6, 16.6, 1.5, 0.9],
      [-5.8, 26.6, 1.3, 0.8],
      [6.8, 25.4, 1.3, 0.8],
    ];
    for (const [x, y, w, h] of mossAt) {
      const [cx, cy] = at(x, y);
      g.save();
      g.fillStyle = '#86a74e';
      g.strokeStyle = INK;
      g.lineWidth = px(0.07);
      g.beginPath();
      g.ellipse(cx, cy, px(w), px(h), 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = MOSS;
      for (let i = 0; i < 7; i++) {
        g.beginPath();
        g.arc(cx + (r() - 0.5) * px(w * 1.5), cy + (r() - 0.5) * px(h * 1.4), px(0.16 + r() * 0.12), 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
    // 枯山水：提灯のまわりの同心円の砂紋
    const [rx, ry] = at(0.75, 28.6);
    g.save();
    g.strokeStyle = 'rgba(120,98,60,0.38)';
    g.lineWidth = px(0.05);
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      g.ellipse(rx, ry, px(3.2 + k * 0.55), px(2.7 + k * 0.5), 0, Math.PI * 0.05, Math.PI * 1.95);
      g.stroke();
    }
    g.restore();
    // 参道の敷石
    const slabs = (x0: number, x1: number, y0: number, y1: number) => {
      const w = 1.15, h = 0.72;
      g.save();
      g.lineWidth = px(0.045);
      let row = 0;
      for (let y = y0; y < y1; y += h + 0.06, row++) {
        for (let x = x0 + (row % 2) * w * 0.5; x < x1; x += w + 0.06) {
          const [sx, sy] = at(x, y + h);
          g.fillStyle = row % 3 === 0 ? '#d9cdb1' : '#cdbf9e';
          g.strokeStyle = 'rgba(95,82,58,0.75)';
          g.fillRect(sx, sy, px(Math.min(w, x1 - x)), px(h));
          g.strokeRect(sx, sy, px(Math.min(w, x1 - x)), px(h));
        }
      }
      g.restore();
    };
    slabs(-1.6, 3.0, 17.6, 24.4);
    // オービットの板張り
    for (const [x0, x1] of [[-8.55, -7.2], [7.2, 8.55]] as [number, number][]) {
      const [ax, ay] = at(x0, 26.6);
      const [bx, by] = at(x1, 19.6);
      g.save();
      g.fillStyle = '#c99a5a';
      g.fillRect(ax, ay, bx - ax, by - ay);
      g.strokeStyle = 'rgba(70,40,15,0.7)';
      g.lineWidth = px(0.04);
      for (let y = 19.8; y < 26.6; y += 0.5) {
        const [lx, ly] = at(x0, y);
        g.beginPath();
        g.moveTo(lx, ly);
        g.lineTo(lx + (bx - ax), ly);
        g.stroke();
      }
      g.restore();
    }
    // 鯉の池（左のランプの入口）
    {
      const [cx, cy] = at(-4.6, 14.6);
      g.save();
      const gr = g.createRadialGradient(cx, cy, px(0.2), cx, cy, px(2.6));
      gr.addColorStop(0, '#9cd0ea');
      gr.addColorStop(1, '#4f8fc4');
      g.fillStyle = gr;
      g.strokeStyle = INK;
      g.lineWidth = px(0.08);
      g.beginPath();
      g.ellipse(cx, cy, px(2.5), px(1.9), 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = px(0.05);
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.ellipse(cx, cy, px(0.9 + k * 0.5), px(0.6 + k * 0.38), 0, 0.2, Math.PI * 1.6);
        g.stroke();
      }
      // 蓮の葉
      for (const [lx, ly] of [[-1.5, 0.6], [1.5, -0.7]] as [number, number][]) {
        g.fillStyle = '#6fa04a';
        g.strokeStyle = INK;
        g.lineWidth = px(0.05);
        g.beginPath();
        g.moveTo(cx + px(lx), cy + px(ly));
        g.arc(cx + px(lx), cy + px(ly), px(0.5), 0.5, Math.PI * 2 - 0.2);
        g.closePath();
        g.fill();
        g.stroke();
      }
      g.restore();
    }
    // 龍の雲（右のランプの入口）
    {
      const [cx, cy] = at(4.9, 14.7);
      swirlCloud(g, cx, cy, px(1.7), '#e8eef0', INK, 1);
      const [dx, dy] = at(6.5, 16.6);
      swirlCloud(g, dx, dy, px(0.9), '#d6e2e8', INK, -1);
    }
  }

  // ───── 海（下）─────
  {
    const [, y0] = at(0, 14.2);
    const [, y1] = at(0, -0.9);
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, 'rgba(31,63,122,0)');
    gr.addColorStop(0.28, 'rgba(31,63,122,0.7)');
    gr.addColorStop(1, 'rgba(18,38,86,0.97)');
    g.fillStyle = gr;
    g.fillRect(xL, y0, xR - xL, y1 - y0);
    seigaiha(g, xL, at(0, 12.2)[1], xR, y1, px(1.0), { line: 'rgba(170,205,235,0.55)', fill: 'rgba(40,80,150,0.18)', lw: px(0.04), rings: 4, alpha: 0.9 });
    // 大波
    const [wx, wy] = at(-8.7, 3.6);
    greatWave(g, wx, wy, px(0.92), { seed: 2 });
    const [vx, vy] = at(8.5, 3.4);
    greatWave(g, vx, vy, px(0.62), { flip: true, seed: 9 });
  }

  // ───── 字（筆）─────
  {
    // 松竹梅（レーンの上）
    const kan: [string, number, number, number, string][] = [
      ['松', -1.65, 36.7, 1.2, '#2f5a2a'],
      ['竹', 0.65, 36.9, 1.2, '#2f5a2a'],
      ['梅', 2.95, 36.7, 1.2, '#a3263a'],
    ];
    for (const [t, x, y, s, c] of kan) {
      const [cx, cy] = at(x, y);
      drawBrushText(g, t, cx, cy, px(s), c, '#fff8e6', t.charCodeAt(0) % 97);
    }
    // 入口の字
    const lab: [string, number, number, number][] = [
      ['滝', -4.55, 12.6, 0.95],
      ['龍', 4.9, 12.6, 0.95],
    ];
    for (const [t, x, y, s] of lab) {
      const [cx, cy] = at(x, y);
      drawBrushText(g, t, cx, cy, px(s), '#f3e7c6', '#14275a', t.charCodeAt(0) % 89);
    }
    // 題字
    const [tx, ty] = at(0.0, 8.2);
    g.save();
    g.globalAlpha = 0.85;
    drawBrushText(g, '浮世絵', tx, ty, px(1.7), '#f3e7c6', '#14275a', 17);
    g.restore();
    // 落款
    const [sx, sy] = at(7.6, 11.4);
    seal(g, sx, sy, px(0.95), '興', BRUSH_FONT);
  }

  // ───── 桜の花びら ─────
  {
    const r = rng(77);
    const spots: [number, number][] = [];
    for (let i = 0; i < 26; i++) spots.push([-8.3 + r() * 16.6, 13 + r() * 26]);
    for (const [x, y] of spots) {
      const [cx, cy] = at(x, y);
      blossom(g, cx, cy, px(0.2 + r() * 0.2), r() * 6.28, '#f6c3cf', '#9b4659');
    }
  }

  // 全体に和紙の繊維
  fibres(g, xR + 10, yBot + 10, Math.round(((xR - xL) * (yBot - yTop)) / 1100), 5, 0.1);
}
