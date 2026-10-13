// 奥の看板：金箔の屏風に、富士山・北斎風の大波・松・朝日・金雲
import { BRUSH_FONT, drawBrushText } from '../../render/effects';
import { fibres, fuji, goldCloud, goldLeaf, greatWave, pine, seal } from './art';
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
