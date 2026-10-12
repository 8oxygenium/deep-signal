// 奥の看板：アメコミの表紙（網点・放射・爆発の吹き出し・太い黒枠）
const INK = '#15131f';
const YEL = '#ffd21f';
const RED = '#f0392f';

export function paintComicBackboard(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = YEL;
  g.fillRect(0, 0, w, h);
  const cx = w * 0.5, cy = h * 0.55;
  // 放射
  for (let i = 0; i < 28; i += 2) {
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos((i / 28) * Math.PI * 2) * 900, cy + Math.sin((i / 28) * Math.PI * 2) * 900);
    g.lineTo(cx + Math.cos(((i + 1) / 28) * Math.PI * 2) * 900, cy + Math.sin(((i + 1) / 28) * Math.PI * 2) * 900);
    g.closePath();
    g.fillStyle = '#ff8a2a';
    g.fill();
  }
  // 赤い網点（下ほど大きい）
  g.fillStyle = 'rgba(240, 57, 47, 0.55)';
  for (let y = 0; y < h; y += 16) {
    for (let x = (y / 16) % 2 ? 8 : 0; x < w; x += 16) {
      g.beginPath();
      g.arc(x, y, 2 + 5 * (y / h), 0, Math.PI * 2);
      g.fill();
    }
  }
  // 爆発の吹き出し
  g.beginPath();
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const r = i % 2 === 0 ? 1 : 0.78;
    g.lineTo(cx + Math.cos(a) * 400 * r, cy + Math.sin(a) * 118 * r);
  }
  g.closePath();
  g.fillStyle = '#fff6a8';
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = INK;
  g.stroke();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  const title = (text: string, y: number, size: number, fill: string) => {
    g.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
    g.lineWidth = size * 0.2;
    g.strokeStyle = INK;
    g.strokeText(text, cx + 5, y + 6);
    g.fillStyle = INK;
    g.fillText(text, cx + 5, y + 6);
    g.strokeText(text, cx, y);
    g.fillStyle = fill;
    g.fillText(text, cx, y);
  };
  title('COMIC', cy - 18, 118, RED);
  title('THE VILLAIN STRIKES BACK!', cy + 62, 34, '#2f6bff');
  // 枠と角の文字
  g.lineWidth = 18;
  g.strokeStyle = INK;
  g.strokeRect(9, 9, w - 18, h - 18);
  g.font = '900 24px Impact, "Arial Black", sans-serif';
  g.fillStyle = INK;
  g.textAlign = 'left';
  g.fillText('ISSUE #3', 34, 36);
  g.textAlign = 'right';
  g.fillText('HANSODE COMICS', w - 34, 36);
}
