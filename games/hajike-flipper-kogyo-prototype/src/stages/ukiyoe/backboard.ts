// 奥の看板：金箔の屏風に、富士山・北斎風の大波・松・朝日・金雲
import { BRUSH_FONT, drawBrushText } from '../../render/effects';
import { blossom, fibres, fuji, goldCloud, goldLeaf, greatWave, pine, rng, seal } from './art';
import { INK } from './palette';

export function paintBackboard(g: CanvasRenderingContext2D, w: number, h: number): void {
  // 金箔の地
  goldLeaf(g, 0, 0, w, h, 31, 34);

  // 朝日
  g.save();
  g.fillStyle = '#d8421e';
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.beginPath();
  g.arc(w * 0.17, h * 0.3, h * 0.13, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.restore();

  // 富士（藍の山肌に白い雪）
  fuji(g, w * 0.56, h * 0.9, w * 0.3, h * 0.66, { body: '#35609c', shade: '#1c3a72', snow: '#f8f3e2', line: INK, lw: 5, seed: 8 });

  // 金雲
  goldCloud(g, w * 0.3, h * 0.55, w * 0.32, h * 0.2, 41, '#d7a935');
  goldCloud(g, w * 0.62, h * 0.7, w * 0.3, h * 0.2, 42, '#d7a935');
  goldCloud(g, w * 0.02, h * 0.56, w * 0.24, h * 0.17, 43, '#d7a935');

  // 松（右）
  pine(g, w * 0.93, h * 0.94, h * 0.2, 4);

  // 大波（左下から）
  greatWave(g, w * 0.02, h * 0.98, h * 0.14, { seed: 3, lw: 4 });

  // 題字と落款（右の縦書き）
  g.save();
  g.textAlign = 'center';
  drawBrushText(g, '浮', w * 0.835, h * 0.2, 54, INK, '#f7e7b0', 3);
  drawBrushText(g, '世', w * 0.835, h * 0.43, 54, INK, '#f7e7b0', 4);
  drawBrushText(g, '絵', w * 0.835, h * 0.66, 54, INK, '#f7e7b0', 5);
  g.restore();
  seal(g, w * 0.835, h * 0.88, 34, '興', BRUSH_FONT);

  // 屏風の折り目（6面）
  for (let i = 1; i < 6; i++) {
    const x = (w / 6) * i;
    const lg = g.createLinearGradient(x - 14, 0, x + 14, 0);
    lg.addColorStop(0, 'rgba(0,0,0,0)');
    lg.addColorStop(0.5, 'rgba(60,30,0,0.38)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = lg;
    g.fillRect(x - 14, 0, 28, h);
    g.fillStyle = 'rgba(255,240,180,0.22)';
    g.fillRect(x + 2, 0, 3, h);
  }
  // 縁（黒漆に金の線）
  g.strokeStyle = '#17110c';
  g.lineWidth = 22;
  g.strokeRect(0, 0, w, h);
  g.strokeStyle = '#d9a93a';
  g.lineWidth = 3;
  g.strokeRect(12, 12, w - 24, h - 24);
  fibres(g, w, h, 900, 9, 0.08);
}

/** 袖の屏風（台の左右に立てる 2 面）の絵。side: -1 = 左（朝日と松）、1 = 右（桜の枝） */
export function paintWing(g: CanvasRenderingContext2D, w: number, h: number, side: -1 | 1): void {
  goldLeaf(g, 0, 0, w, h, side < 0 ? 51 : 52, 30);
  if (side < 0) {
    // 朝日と金雲、松、大きな「福」
    g.save();
    g.fillStyle = '#d8421e';
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.beginPath();
    g.arc(w * 0.62, h * 0.25, h * 0.14, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
    goldCloud(g, w * 0.04, h * 0.42, w * 0.8, h * 0.2, 53, '#d7a935');
    pine(g, w * 0.3, h * 0.97, h * 0.3, 6);
    drawBrushText(g, '福', w * 0.8, h * 0.62, h * 0.24, INK, '#f7e7b0', 7);
  } else {
    // 桜の枝：太い幹が右下から伸び、花がたくさん咲く
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = INK;
    g.lineWidth = h * 0.05;
    g.beginPath();
    g.moveTo(w * 1.02, h * 0.86);
    g.bezierCurveTo(w * 0.7, h * 0.74, w * 0.55, h * 0.5, w * 0.12, h * 0.34);
    g.stroke();
    g.strokeStyle = '#5a3a22';
    g.lineWidth = h * 0.034;
    g.stroke();
    for (const [x0, y0, x1, y1] of [[0.62, 0.62, 0.4, 0.78], [0.45, 0.46, 0.5, 0.2], [0.3, 0.4, 0.2, 0.12]] as [number, number, number, number][]) {
      g.strokeStyle = INK;
      g.lineWidth = h * 0.03;
      g.beginPath();
      g.moveTo(w * x0, h * y0);
      g.quadraticCurveTo((w * (x0 + x1)) / 2 + 12, (h * (y0 + y1)) / 2, w * x1, h * y1);
      g.stroke();
      g.strokeStyle = '#5a3a22';
      g.lineWidth = h * 0.018;
      g.stroke();
    }
    g.restore();
    const r = rng(9);
    for (let i = 0; i < 46; i++) {
      const t = r();
      const bx = w * (0.05 + 0.85 * t) + (r() - 0.5) * w * 0.2;
      const by = h * (0.3 + 0.5 * (1 - t)) + (r() - 0.5) * h * 0.4;
      blossom(g, bx, by, h * (0.045 + r() * 0.04), r() * 6.28, '#f6c3cf', '#8d3b4c');
    }
    goldCloud(g, w * 0.3, h * 0.82, w * 0.7, h * 0.18, 54, '#d7a935');
    drawBrushText(g, '寿', w * 0.2, h * 0.65, h * 0.22, INK, '#f7e7b0', 8);
  }
  // 面の折り目（2 面）
  const lg = g.createLinearGradient(w / 2 - 14, 0, w / 2 + 14, 0);
  lg.addColorStop(0, 'rgba(0,0,0,0)');
  lg.addColorStop(0.5, 'rgba(60,30,0,0.38)');
  lg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = lg;
  g.fillRect(w / 2 - 14, 0, 28, h);
  g.strokeStyle = '#17110c';
  g.lineWidth = 22;
  g.strokeRect(0, 0, w, h);
  g.strokeStyle = '#d9a93a';
  g.lineWidth = 3;
  g.strokeRect(12, 12, w - 24, h - 24);
  fibres(g, w, h, 500, 12, 0.08);
}
