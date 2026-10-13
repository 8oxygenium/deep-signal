// プレイフィールド（床）の絵をキャンバスに描いてテクスチャにする。
import * as THREE from 'three';
import type { StageDef } from '../stages/types';
import { arcPoints } from '../table/geom';
import type { TableLayout } from '../table/types';
import type { Quality } from './materials';

export const PF = { x0: -8.9, x1: 10.5, y0: -0.8, y1: 40.3 };

export interface PlayfieldTex {
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export function paintPlayfield(stage: StageDef, layout: TableLayout, quality: Quality): PlayfieldTex {
  const W = quality === 'high' ? 1280 : quality === 'mid' ? 960 : 600;
  const scale = W / (PF.x1 - PF.x0);
  const H = Math.round((PF.y1 - PF.y0) * scale);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  const map = (x: number, y: number): [number, number] => [(x - PF.x0) * scale, (PF.y1 - y) * scale];
  const c = stage.theme.colors;

  // 下地
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, c.floor2);
  grad.addColorStop(1, c.floor);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // ステージ固有の絵
  stage.theme.paint?.({ g, map, scale, width: W, height: H, layout });

  // 部品の下の影・枠（どの台でも共通）
  g.save();
  for (const p of layout.parts) {
    if (p.layer) continue;
    if (p.kind === 'light') {
      const [x, y] = map(p.at[0], p.at[1]);
      const r = (p.size ?? 0.5) * scale;
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath();
      g.arc(x, y, r * 1.25, 0, Math.PI * 2);
      g.fill();
      if (p.label) {
        g.font = `bold ${Math.round(scale * 0.42)}px "Segoe UI", sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'top';
        g.fillStyle = c.text;
        g.globalAlpha = 0.85;
        g.fillText(p.label, x, y + r * 1.4);
        g.globalAlpha = 1;
      }
    } else if (p.kind === 'rollover') {
      const [x, y] = map(p.at[0], p.at[1]);
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = scale * 0.08;
      g.beginPath();
      g.moveTo(x, y - scale * 0.55);
      g.lineTo(x, y + scale * 0.55);
      g.stroke();
    } else if (p.kind === 'scoop' || p.kind === 'warp') {
      const [x, y] = map(p.at[0], p.at[1]);
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.beginPath();
      g.arc(x, y, scale * 0.85, 0, Math.PI * 2);
      g.fill();
    } else if (p.kind === 'wall' && (p.style === 'guide' || p.style === 'rubber' || !p.style)) {
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = scale * 0.45;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      p.pts.forEach((q, i) => {
        const [x, y] = map(q[0] + 0.08, q[1] - 0.12);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.stroke();
    } else if (p.kind === 'arc') {
      const pts = arcPoints(p.c, p.R, p.from, p.to);
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = scale * 0.45;
      g.beginPath();
      pts.forEach((q, i) => {
        const [x, y] = map(q[0] + 0.08, q[1] - 0.12);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.stroke();
    }
  }
  g.restore();

  // 発射レーン
  const [lx0, ly0] = map(8.82, 0);
  const [lx1, ly1] = map(10.08, 27);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(lx0, ly1, lx1 - lx0, ly0 - ly1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { texture, canvas, width: W, height: H };
}
