// ROUTE 50s の絵：床（ミントグリーンのフォーマイカ柄・原子の星・チェッカー・ハイウェイ）と、奥の看板。
// すべてキャンバスにコードで描く。
import type { PaintApi } from '../types';

/** 毎回同じ絵になる乱数 */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 三日月形（昔のフォーマイカの「ブーメラン柄」）。原点中心、半径 s */
function boomerang(g: CanvasRenderingContext2D, s: number, a = 0.8, k = 0.9): void {
  const x1 = Math.cos(Math.PI + a), y1 = Math.sin(Math.PI + a);
  const x2 = Math.cos(2 * Math.PI - a), y2 = Math.sin(2 * Math.PI - a);
  const r2 = Math.hypot(x1, y1 - k);
  g.beginPath();
  g.arc(0, 0, s, Math.PI + a, 2 * Math.PI - a, false);
  g.arc(0, k * s, r2 * s, Math.atan2(y2 - k, x2), Math.atan2(y1 - k, x1), true);
  g.closePath();
  g.fill();
}

/** 4つ角の「原子の星」 */
function sparkle(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.24;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

/** ルート標識（アメリカの国道の盾） */
function shield(g: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string, ink: string, top: string, num: string): void {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.beginPath();
  g.moveTo(-1.15, -1.2);
  g.quadraticCurveTo(0, -1.6, 1.15, -1.2);
  g.lineTo(1.15, 0.15);
  g.quadraticCurveTo(1.15, 1.0, 0, 1.45);
  g.quadraticCurveTo(-1.15, 1.0, -1.15, 0.15);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 0.1;
  g.strokeStyle = ink;
  g.stroke();
  g.lineWidth = 0.05;
  g.beginPath();
  g.moveTo(-0.95, -0.98);
  g.quadraticCurveTo(0, -1.32, 0.95, -0.98);
  g.lineTo(0.95, 0.1);
  g.quadraticCurveTo(0.95, 0.8, 0, 1.2);
  g.quadraticCurveTo(-0.95, 0.8, -0.95, 0.1);
  g.closePath();
  g.stroke();
  g.fillStyle = ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 0.42px "Arial Black", "Segoe UI", sans-serif';
  g.fillText(top, 0, -0.62);
  g.font = '900 1.05px "Arial Black", "Segoe UI", sans-serif';
  g.fillText(num, 0, 0.2);
  g.restore();
}

export function paint({ g, map, scale, width: W, height: H }: PaintApi): void {
  const rnd = lcg(5050);
  const line = (pts: [number, number][], color: string, w: number, dash: number[] = []) => {
    g.save();
    g.strokeStyle = color;
    g.lineWidth = w * scale;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.setLineDash(dash.map((d) => d * scale));
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const [px, py] = map(x, y);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.stroke();
    g.restore();
  };

  // ── 下地：ミントグリーン（ボールの銀が映える中間の明るさ）──
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#46bdb3');
  base.addColorStop(0.5, '#38aca4');
  base.addColorStop(1, '#2b9590');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);

  // ── フォーマイカ柄：ブーメランと原子の星、細かい粒 ──
  g.save();
  for (let i = 0; i < 90; i++) {
    const [px, py] = map(-9.2 + rnd() * 20, rnd() * 41);
    g.save();
    g.translate(px, py);
    g.rotate(rnd() * Math.PI * 2);
    g.fillStyle = rnd() < 0.55 ? 'rgba(255, 244, 214, 0.30)' : rnd() < 0.5 ? 'rgba(255, 150, 130, 0.26)' : 'rgba(255, 214, 90, 0.24)';
    boomerang(g, scale * (0.55 + rnd() * 0.6), 0.7 + rnd() * 0.35);
    g.restore();
  }
  for (let i = 0; i < 46; i++) {
    const [px, py] = map(-9 + rnd() * 19.6, rnd() * 41);
    g.fillStyle = rnd() < 0.7 ? 'rgba(255, 255, 255, 0.38)' : 'rgba(255, 224, 120, 0.4)';
    sparkle(g, px, py, scale * (0.16 + rnd() * 0.22));
  }
  for (let i = 0; i < 420; i++) {
    const [px, py] = map(-9 + rnd() * 19.6, rnd() * 41);
    g.fillStyle = `rgba(255, 255, 255, ${0.08 + rnd() * 0.16})`;
    g.fillRect(px, py, scale * 0.05, scale * 0.05);
  }
  g.restore();

  // ── バンパーの後ろの「サンバースト」（放射状の光）と同心円 ──
  const [cx, cy] = map(0.75, 27.4);
  g.save();
  const rays = 32;
  for (let i = 0; i < rays; i += 2) {
    const a0 = (i / rays) * Math.PI * 2, a1 = ((i + 1) / rays) * Math.PI * 2;
    g.fillStyle = 'rgba(255, 244, 214, 0.15)';
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, scale * 15, a0, a1);
    g.closePath();
    g.fill();
  }
  for (const [r, c, w] of [
    [5.0, 'rgba(255, 244, 214, 0.65)', 0.11],
    [5.4, 'rgba(226, 48, 58, 0.7)', 0.07],
    [1.15, 'rgba(255, 244, 214, 0.5)', 0.08],
  ] as const) {
    g.strokeStyle = c;
    g.lineWidth = w * scale;
    g.beginPath();
    g.arc(cx, cy, scale * r, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = 'rgba(255, 244, 214, 0.55)';
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    g.beginPath();
    g.arc(cx + Math.cos(a) * scale * 5.75, cy + Math.sin(a) * scale * 5.75, scale * 0.065, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  // ── 下のほう：ダイナーのチェッカー床（ハイウェイの両脇）──
  g.save();
  const tile = 1.2;
  for (let iy = 0; iy < 11; iy++) {
    for (let ix = 0; ix < 16; ix++) {
      if ((ix + iy) % 2) continue;
      const x = -8.9 + ix * tile, y = 0.2 + iy * tile;
      const [px, py] = map(x, y + tile);
      g.fillStyle = 'rgba(8, 40, 44, 0.30)';
      g.fillRect(px, py, tile * scale, tile * scale);
    }
  }
  g.restore();

  // ── ハイウェイ（まん中を奥のドライブインへ向かう一本道）──
  const road = (y: number): [number, number] => {
    const t = (y - 0.4) / 17;
    const half = 2.9 - 1.7 * t;
    return [-half, half];
  };
  g.save();
  const [rbx0, rby0] = map(road(0.4)[0], 0.4);
  const [rbx1] = map(road(0.4)[1], 0.4);
  const [rtx0, rty0] = map(road(17.4)[0], 17.4);
  const [rtx1] = map(road(17.4)[1], 17.4);
  const rg = g.createLinearGradient(0, rby0, 0, rty0);
  rg.addColorStop(0, 'rgba(36, 36, 46, 0.92)');
  rg.addColorStop(1, 'rgba(52, 52, 64, 0.8)');
  g.fillStyle = rg;
  g.beginPath();
  g.moveTo(rbx0, rby0);
  g.lineTo(rbx1, rby0);
  g.lineTo(rtx1, rty0);
  g.lineTo(rtx0, rty0);
  g.closePath();
  g.fill();
  g.restore();
  // 縁の白線と中央の黄色い破線
  line([[road(0.4)[0] + 0.28, 0.4], [road(17.4)[0] + 0.2, 17.4]], 'rgba(255, 252, 240, 0.85)', 0.1);
  line([[road(0.4)[1] - 0.28, 0.4], [road(17.4)[1] - 0.2, 17.4]], 'rgba(255, 252, 240, 0.85)', 0.1);
  for (let y = 1.0; y < 17.2; y += 1.7) {
    const t = (y - 0.4) / 17;
    const len = 1.0 - 0.45 * t;
    line([[0, y], [0, y + len]], 'rgba(255, 206, 60, 0.95)', 0.14 * (1 - 0.4 * t));
  }
  // ルート標識
  const [sx, sy] = map(0, 8.4);
  g.save();
  g.globalAlpha = 0.95;
  shield(g, sx, sy, scale * 1.15, '#fff6dc', '#1d1d24', 'ROUTE', '50');
  g.restore();

  // ── ドライブインの穴のまわり：赤と白の的 ──
  const [mx, my] = map(0.75, 19.4);
  g.save();
  g.fillStyle = 'rgba(255, 244, 214, 0.55)';
  g.beginPath();
  g.arc(mx, my, scale * 1.9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(214, 38, 50, 0.7)';
  g.beginPath();
  g.arc(mx, my, scale * 1.45, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255, 244, 214, 0.75)';
  g.beginPath();
  g.arc(mx, my, scale * 1.08, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // ── ジュークボックスの足もとの影 ──
  const [jx, jy] = map(-5.9, 33.1);
  g.save();
  const jg = g.createRadialGradient(jx, jy, 0, jx, jy, scale * 2.6);
  jg.addColorStop(0, 'rgba(0, 20, 24, 0.6)');
  jg.addColorStop(1, 'rgba(0, 20, 24, 0)');
  g.fillStyle = jg;
  g.beginPath();
  g.arc(jx, jy, scale * 2.6, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // ── ピンストライプ（壁ぎわのクリームと赤の細い線）──
  const arcPts = (r: number, a0: number, a1: number): [number, number][] => {
    const out: [number, number][] = [];
    for (let i = 0; i <= 48; i++) {
      const a = ((a0 + ((a1 - a0) * i) / 48) * Math.PI) / 180;
      out.push([0.75 + Math.cos(a) * r, 30.5 + Math.sin(a) * r]);
    }
    return out;
  };
  const stripe = (pts: [number, number][], off = 0) => {
    line(pts, 'rgba(255, 244, 214, 0.9)', 0.1);
    void off;
  };
  stripe([[-7.75, 1.4], [-7.75, 30.5], ...arcPts(8.5, 180, 25).reverse().reverse()]);
  line([[-7.5, 1.4], [-7.5, 30.5], ...arcPts(8.25, 180, 25)], 'rgba(226, 48, 58, 0.8)', 0.07);
  line([[8.0, 1.4], [8.0, 26.5]], 'rgba(255, 244, 214, 0.9)', 0.1);
  line([[7.75, 1.4], [7.75, 26.5]], 'rgba(226, 48, 58, 0.8)', 0.07);

  // ── 文字：DRIVE-IN / ROAD ──
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `900 ${Math.round(scale * 0.52)}px "Arial Black", "Segoe UI", sans-serif`;
  g.fillStyle = 'rgba(255, 244, 214, 0.75)';
  g.fillText('R O A D', ...map(0.75, 36.4));
  g.restore();
}

/** 奥の看板：夜のハイウェイとネオンのダイナー（電球の縁つき） */
export function paintBackboard(g: CanvasRenderingContext2D, w: number, h: number): void {
  const rnd = lcg(77);
  // 夜空
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#12123a');
  sky.addColorStop(0.45, '#6a1f6e');
  sky.addColorStop(0.72, '#e2463e');
  sky.addColorStop(1, '#ffb03a');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255, 255, 255, 0.8)';
  for (let i = 0; i < 70; i++) g.fillRect(rnd() * w, rnd() * h * 0.5, 2, 2);
  // 夕陽
  g.fillStyle = '#ffd36a';
  g.beginPath();
  g.arc(w * 0.5, h * 0.78, 78, Math.PI, 0);
  g.fill();
  // 遠くの岩山
  g.fillStyle = '#2a1238';
  g.beginPath();
  g.moveTo(0, h);
  g.lineTo(0, h * 0.82);
  for (let x = 0; x <= w; x += 64) g.lineTo(x, h * 0.78 + Math.sin(x * 0.021) * 10 - (x % 192 === 0 ? 22 : 0));
  g.lineTo(w, h);
  g.closePath();
  g.fill();
  // ハイウェイ（中央へ収束）
  g.fillStyle = '#1b1b24';
  g.beginPath();
  g.moveTo(w * 0.44, h * 0.8);
  g.lineTo(w * 0.56, h * 0.8);
  g.lineTo(w * 0.86, h);
  g.lineTo(w * 0.14, h);
  g.closePath();
  g.fill();
  g.strokeStyle = '#ffce3c';
  g.lineWidth = 4;
  g.setLineDash([22, 18]);
  g.beginPath();
  g.moveTo(w * 0.5, h * 0.8);
  g.lineTo(w * 0.5, h);
  g.stroke();
  g.setLineDash([]);
  // サボテン
  const cactus = (x: number, s: number) => {
    g.fillStyle = '#10241f';
    g.fillRect(x - 6 * s, h - 66 * s, 12 * s, 66 * s);
    g.fillRect(x - 24 * s, h - 46 * s, 8 * s, 26 * s);
    g.fillRect(x - 24 * s, h - 46 * s, 20 * s, 8 * s);
    g.fillRect(x + 16 * s, h - 54 * s, 8 * s, 28 * s);
    g.fillRect(x + 4 * s, h - 54 * s, 20 * s, 8 * s);
  };
  cactus(w * 0.1, 1.1);
  cactus(w * 0.9, 1.0);
  cactus(w * 0.2, 0.7);
  // ネオンのタイトル
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const neon = (text: string, x: number, y: number, size: number, color: string, glow: string) => {
    g.font = `italic 900 ${size}px "Arial Black", "Segoe UI", sans-serif`;
    g.shadowColor = glow;
    g.shadowBlur = 28;
    g.lineWidth = 7;
    g.strokeStyle = color;
    g.strokeText(text, x, y);
    g.shadowBlur = 8;
    g.fillStyle = '#fff6e8';
    g.fillText(text, x, y);
    g.shadowBlur = 0;
  };
  neon('ROUTE 50s', w * 0.5, h * 0.36, 108, '#ff3b5c', '#ff2a4a');
  g.font = '700 30px "Segoe UI", sans-serif';
  g.fillStyle = '#ffeec8';
  g.shadowColor = '#ffb03a';
  g.shadowBlur = 10;
  g.fillText('D I N E R   ·   D R I V E - I N   ·   J U K E B O X', w * 0.5, h * 0.62);
  g.shadowBlur = 0;
  // 縁：クロームの枠と電球
  g.lineWidth = 12;
  g.strokeStyle = '#d9dde4';
  g.strokeRect(6, 6, w - 12, h - 12);
  for (let i = 0; i < 44; i++) {
    const t = i / 44;
    const pts: [number, number][] = [
      [24 + t * (w - 48), 14],
      [24 + t * (w - 48), h - 14],
    ];
    for (const [x, y] of pts) {
      g.fillStyle = '#fff2b0';
      g.shadowColor = '#ffcf5a';
      g.shadowBlur = 12;
      g.beginPath();
      g.arc(x, y, 5, 0, Math.PI * 2);
      g.fill();
    }
  }
  for (let i = 1; i < 11; i++) {
    for (const x of [14, w - 14]) {
      g.fillStyle = '#fff2b0';
      g.beginPath();
      g.arc(x, 14 + (i / 11) * (h - 28), 5, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.shadowBlur = 0;
}
