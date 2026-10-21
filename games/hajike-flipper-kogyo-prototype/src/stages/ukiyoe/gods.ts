// 七福神の絵（木版画風の立て札）。キャンバス 256x384 に描く。
import { drawBrushText } from '../../render/effects';
import type { G } from './art';
import { rng } from './art';
import type { God } from './layout';
import { INK } from './palette';

export const CARD_W = 256;
export const CARD_H = 384;
const SKIN = '#f5d3ab';

function ink(g: G, w = 5): void {
  g.strokeStyle = INK;
  g.lineWidth = w;
  g.lineJoin = 'round';
  g.lineCap = 'round';
}

function face(g: G, x: number, y: number, r: number, o: { smile?: number; brow?: boolean; cheeks?: boolean; skin?: string; eyes?: 'happy' | 'round' | 'calm' } = {}): void {
  g.fillStyle = o.skin ?? SKIN;
  ink(g, 5);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  if (o.cheeks !== false) {
    g.fillStyle = 'rgba(232,110,110,0.55)';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(x + s * r * 0.55, y + r * 0.28, r * 0.17, 0, Math.PI * 2);
      g.fill();
    }
  }
  ink(g, 4.5);
  const eyes = o.eyes ?? 'happy';
  for (const s of [-1, 1]) {
    g.beginPath();
    if (eyes === 'happy') g.arc(x + s * r * 0.36, y - r * 0.05, r * 0.15, Math.PI * 1.08, Math.PI * 1.92);
    else if (eyes === 'calm') {
      g.moveTo(x + s * r * 0.2, y - r * 0.05);
      g.lineTo(x + s * r * 0.5, y - r * 0.05);
    } else g.arc(x + s * r * 0.36, y - r * 0.05, r * 0.07, 0, Math.PI * 2);
    g.stroke();
    if (eyes === 'round') {
      g.fillStyle = INK;
      g.fill();
    }
  }
  if (o.brow) {
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(x + s * r * 0.15, y - r * 0.32);
      g.lineTo(x + s * r * 0.58, y - r * 0.26 - (s > 0 ? 0 : 0));
      g.stroke();
    }
  }
  // 口
  const sm = o.smile ?? 0.6;
  g.beginPath();
  g.moveTo(x - r * 0.3, y + r * 0.38);
  g.quadraticCurveTo(x, y + r * (0.38 + sm * 0.5), x + r * 0.3, y + r * 0.38);
  g.stroke();
  // 鼻
  g.beginPath();
  g.moveTo(x, y + r * 0.04);
  g.lineTo(x - r * 0.05, y + r * 0.22);
  g.stroke();
}

function robe(g: G, x: number, top: number, bottom: number, wTop: number, wBot: number, color: string, trim = '#f7ead0'): void {
  g.fillStyle = color;
  ink(g, 5);
  g.beginPath();
  g.moveTo(x - wTop, top);
  g.lineTo(x + wTop, top);
  g.lineTo(x + wBot, bottom);
  g.lineTo(x - wBot, bottom);
  g.closePath();
  g.fill();
  g.stroke();
  // 襟
  g.fillStyle = trim;
  g.beginPath();
  g.moveTo(x - wTop * 0.55, top);
  g.lineTo(x, top + (bottom - top) * 0.4);
  g.lineTo(x + wTop * 0.55, top);
  g.lineTo(x + wTop * 0.28, top);
  g.lineTo(x, top + (bottom - top) * 0.22);
  g.lineTo(x - wTop * 0.28, top);
  g.closePath();
  g.fill();
  ink(g, 3.5);
  g.stroke();
}

function hand(g: G, x: number, y: number, r = 13): void {
  g.fillStyle = SKIN;
  ink(g, 4);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.stroke();
}

function tai(g: G, x: number, y: number, s: number): void {
  // 鯛（赤い魚）
  g.save();
  g.translate(x, y);
  g.rotate(-0.5);
  g.fillStyle = '#e4503a';
  ink(g, 4);
  g.beginPath();
  g.ellipse(0, 0, s, s * 0.52, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(-s * 0.9, 0);
  g.lineTo(-s * 1.55, -s * 0.45);
  g.lineTo(-s * 1.4, 0);
  g.lineTo(-s * 1.55, s * 0.45);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(s * 0.55, -s * 0.12, s * 0.12, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  g.arc(s * 0.57, -s * 0.12, s * 0.05, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

const DRAW: Record<God['item'], (g: G, god: God) => void> = {
  // 恵比寿：烏帽子・鯛と釣り竿
  tai(g, god) {
    robe(g, 128, 205, 322, 52, 84, god.color);
    // 釣り竿
    ink(g, 5);
    g.beginPath();
    g.moveTo(206, 330);
    g.quadraticCurveTo(212, 150, 180, 66);
    g.stroke();
    ink(g, 2);
    g.beginPath();
    g.moveTo(180, 66);
    g.quadraticCurveTo(160, 120, 166, 190);
    g.stroke();
    tai(g, 76, 270, 34);
    hand(g, 168, 250);
    face(g, 128, 150, 50, { smile: 0.9 });
    // 烏帽子
    g.fillStyle = INK;
    g.beginPath();
    g.moveTo(84, 128);
    g.quadraticCurveTo(92, 52, 118, 36);
    g.quadraticCurveTo(138, 30, 160, 48);
    g.quadraticCurveTo(174, 84, 172, 128);
    g.quadraticCurveTo(128, 108, 84, 128);
    g.closePath();
    g.fill();
    g.fillStyle = '#4a4036';
    g.beginPath();
    g.moveTo(118, 36);
    g.quadraticCurveTo(150, 60, 136, 118);
    g.lineTo(122, 112);
    g.quadraticCurveTo(134, 62, 118, 36);
    g.fill();
  },
  // 大黒天：大黒頭巾・打ち出の小槌・大きな袋
  mallet(g, god) {
    // 袋
    g.fillStyle = '#d9c590';
    ink(g, 5);
    g.beginPath();
    g.ellipse(70, 292, 52, 46, 0.2, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(52, 252);
    g.quadraticCurveTo(66, 232, 84, 248);
    g.stroke();
    robe(g, 138, 205, 322, 50, 78, god.color);
    // 小槌
    g.save();
    g.translate(200, 262);
    g.rotate(0.3);
    g.fillStyle = '#7a4a22';
    g.fillRect(-5, -10, 10, 74);
    g.strokeRect(-5, -10, 10, 74);
    g.fillStyle = '#e0b238';
    g.fillRect(-26, -50, 52, 46);
    g.strokeRect(-26, -50, 52, 46);
    g.fillStyle = INK;
    g.fillRect(-26, -34, 52, 6);
    g.restore();
    hand(g, 190, 262);
    face(g, 138, 152, 50, { smile: 1.1 });
    // 頭巾（平たい黒い帽子）
    g.fillStyle = INK;
    g.beginPath();
    g.ellipse(138, 112, 60, 22, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(88, 118);
    g.quadraticCurveTo(138, 62, 188, 118);
    g.lineTo(188, 124);
    g.quadraticCurveTo(138, 100, 88, 124);
    g.closePath();
    g.fill();
  },
  // 毘沙門天：兜・鎧・槍と宝塔
  spear(g, god) {
    // 槍
    ink(g, 6);
    g.beginPath();
    g.moveTo(200, 350);
    g.lineTo(200, 70);
    g.stroke();
    g.fillStyle = '#d9dde3';
    g.beginPath();
    g.moveTo(200, 28);
    g.lineTo(212, 74);
    g.lineTo(188, 74);
    g.closePath();
    g.fill();
    ink(g, 4);
    g.stroke();
    // 鎧
    g.fillStyle = '#e0b238';
    robe(g, 120, 205, 320, 54, 80, god.color, '#e0b238');
    g.fillStyle = '#e0b238';
    ink(g, 4);
    g.beginPath();
    g.moveTo(84, 212);
    g.lineTo(156, 212);
    g.lineTo(150, 262);
    g.lineTo(90, 262);
    g.closePath();
    g.fill();
    g.stroke();
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(90, 228 + i * 12);
      g.lineTo(150, 228 + i * 12);
      g.stroke();
    }
    // 宝塔
    g.fillStyle = '#c8321f';
    g.fillRect(40, 270, 36, 34);
    g.strokeRect(40, 270, 36, 34);
    g.fillStyle = '#e0b238';
    g.beginPath();
    g.moveTo(32, 270);
    g.lineTo(58, 246);
    g.lineTo(84, 270);
    g.closePath();
    g.fill();
    g.stroke();
    hand(g, 56, 306);
    hand(g, 200, 250);
    face(g, 120, 150, 50, { smile: 0.1, brow: true, eyes: 'round', cheeks: false });
    // 兜
    g.fillStyle = '#4b5666';
    g.beginPath();
    g.moveTo(68, 138);
    g.quadraticCurveTo(70, 70, 120, 62);
    g.quadraticCurveTo(170, 70, 172, 138);
    g.quadraticCurveTo(120, 112, 68, 138);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#e0b238';
    g.beginPath();
    g.moveTo(104, 66);
    g.lineTo(120, 24);
    g.lineTo(136, 66);
    g.closePath();
    g.fill();
    g.stroke();
  },
  // 弁財天：黒髪と冠・琵琶
  biwa(g, god) {
    // 髪（長い）
    g.fillStyle = INK;
    g.beginPath();
    g.moveTo(70, 130);
    g.quadraticCurveTo(66, 60, 128, 54);
    g.quadraticCurveTo(190, 60, 186, 130);
    g.lineTo(196, 240);
    g.lineTo(60, 240);
    g.closePath();
    g.fill();
    robe(g, 128, 205, 330, 48, 84, god.color);
    // 琵琶
    g.save();
    g.translate(150, 280);
    g.rotate(-0.6);
    g.fillStyle = '#9a5a2a';
    ink(g, 4.5);
    g.beginPath();
    g.ellipse(0, 20, 38, 50, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillRect(-6, -110, 12, 80);
    g.strokeRect(-6, -110, 12, 80);
    g.fillStyle = INK;
    g.fillRect(-14, -124, 28, 20);
    g.strokeStyle = '#f7ead0';
    g.lineWidth = 1.5;
    for (const dx of [-3, 0, 3]) {
      g.beginPath();
      g.moveTo(dx, -104);
      g.lineTo(dx, 52);
      g.stroke();
    }
    g.restore();
    hand(g, 108, 262);
    face(g, 128, 150, 46, { smile: 0.5, eyes: 'calm' });
    // 前髪と冠
    g.fillStyle = INK;
    g.beginPath();
    g.moveTo(80, 140);
    g.quadraticCurveTo(100, 96, 128, 104);
    g.quadraticCurveTo(156, 96, 176, 140);
    g.quadraticCurveTo(160, 118, 128, 120);
    g.quadraticCurveTo(96, 118, 80, 140);
    g.fill();
    g.fillStyle = '#e0b238';
    ink(g, 3.5);
    g.beginPath();
    g.moveTo(96, 96);
    g.lineTo(106, 60);
    g.lineTo(120, 86);
    g.lineTo(128, 52);
    g.lineTo(136, 86);
    g.lineTo(150, 60);
    g.lineTo(160, 96);
    g.closePath();
    g.fill();
    g.stroke();
  },
  // 福禄寿：細長い頭・長い白ひげ・杖
  tall(g, god) {
    ink(g, 6);
    g.beginPath();
    g.moveTo(206, 340);
    g.lineTo(200, 100);
    g.stroke();
    g.fillStyle = '#e0b238';
    g.beginPath();
    g.arc(200, 96, 14, 0, Math.PI * 2);
    g.fill();
    ink(g, 4);
    g.stroke();
    robe(g, 120, 214, 330, 46, 78, god.color);
    // 長い頭
    g.fillStyle = SKIN;
    ink(g, 5);
    g.beginPath();
    g.ellipse(120, 112, 40, 80, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // 顔（下の方に）
    g.fillStyle = 'rgba(232,110,110,0.5)';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(120 + s * 22, 150, 7, 0, Math.PI * 2);
      g.fill();
    }
    ink(g, 4);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(120 + s * 17, 138, 7, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(108, 160);
    g.quadraticCurveTo(120, 170, 132, 160);
    g.stroke();
    // しわ（額）
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(94, 62 + i * 12);
      g.quadraticCurveTo(120, 56 + i * 12, 146, 62 + i * 12);
      g.stroke();
    }
    // 白ひげ
    g.fillStyle = '#f8f4ea';
    g.beginPath();
    g.moveTo(88, 168);
    g.quadraticCurveTo(120, 196, 152, 168);
    g.quadraticCurveTo(160, 240, 120, 290);
    g.quadraticCurveTo(80, 240, 88, 168);
    g.closePath();
    g.fill();
    ink(g, 4);
    g.stroke();
    hand(g, 200, 250);
  },
  // 寿老人：頭巾・長い白ひげ・杖と巻物
  staff(g, god) {
    ink(g, 6);
    g.beginPath();
    g.moveTo(204, 346);
    g.quadraticCurveTo(194, 200, 206, 80);
    g.stroke();
    // 巻物
    g.fillStyle = '#f7ead0';
    ink(g, 4);
    g.fillRect(188, 74, 34, 56);
    g.strokeRect(188, 74, 34, 56);
    g.fillStyle = '#c8321f';
    g.fillRect(186, 70, 38, 8);
    g.fillRect(186, 126, 38, 8);
    robe(g, 120, 210, 330, 48, 80, god.color);
    face(g, 120, 150, 48, { smile: 0.4, eyes: 'calm' });
    // 頭巾
    g.fillStyle = INK;
    g.beginPath();
    g.moveTo(70, 150);
    g.quadraticCurveTo(66, 70, 120, 60);
    g.quadraticCurveTo(176, 70, 170, 150);
    g.quadraticCurveTo(160, 112, 120, 110);
    g.quadraticCurveTo(80, 112, 70, 150);
    g.closePath();
    g.fill();
    g.fillStyle = '#4a4036';
    g.beginPath();
    g.ellipse(120, 70, 28, 14, 0, 0, Math.PI * 2);
    g.fill();
    // ひげ
    g.fillStyle = '#f8f4ea';
    g.beginPath();
    g.moveTo(84, 176);
    g.quadraticCurveTo(120, 206, 156, 176);
    g.quadraticCurveTo(168, 250, 120, 300);
    g.quadraticCurveTo(72, 250, 84, 176);
    g.closePath();
    g.fill();
    ink(g, 4);
    g.stroke();
    hand(g, 200, 246);
    // 鹿の角のかざり（足もと）
    g.strokeStyle = '#7a4a22';
    g.lineWidth = 5;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(60 + s * 6, 360);
      g.quadraticCurveTo(48 + s * 10, 330, 60 + s * 20, 310);
      g.stroke();
    }
  },
  // 布袋：まるいお腹・大きな袋・団扇
  sack(g, god) {
    // 袋
    g.fillStyle = '#d9c590';
    ink(g, 5);
    g.beginPath();
    g.ellipse(206, 170, 44, 60, 0.3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // 体（おなかを出す）
    g.fillStyle = god.color;
    g.beginPath();
    g.ellipse(120, 280, 90, 80, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = SKIN;
    g.beginPath();
    g.ellipse(120, 288, 62, 56, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(120, 290, 5, 0, Math.PI * 2);
    g.stroke();
    // 団扇
    g.save();
    g.translate(48, 262);
    g.rotate(-0.4);
    g.fillStyle = '#f7ead0';
    g.beginPath();
    g.ellipse(0, -30, 26, 34, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#c8321f';
    g.beginPath();
    g.arc(0, -30, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#7a4a22';
    g.fillRect(-4, -2, 8, 40);
    g.restore();
    hand(g, 58, 296);
    // 大きな顔
    face(g, 120, 140, 62, { smile: 1.6, eyes: 'happy' });
    // 福耳
    g.fillStyle = SKIN;
    ink(g, 4);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(120 + s * 66, 150, 11, 22, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  },
};

/** 立て札の絵：紙の色・縁・絵・名前 */
export function drawGodCard(g: G, god: God, seed = 1): void {
  const r = rng(seed);
  g.clearRect(0, 0, CARD_W, CARD_H);
  // 札の形（上が山形）
  const card = () => {
    g.beginPath();
    g.moveTo(14, 56);
    g.lineTo(128, 6);
    g.lineTo(242, 56);
    g.lineTo(242, 372);
    g.lineTo(14, 372);
    g.closePath();
  };
  card();
  g.fillStyle = '#f6ecd0';
  g.fill();
  // 後ろの色（その神様の色の円）
  g.save();
  card();
  g.clip();
  g.fillStyle = god.color;
  g.globalAlpha = 0.28;
  g.beginPath();
  g.arc(128, 168, 118, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  // 絵
  DRAW[god.item](g, god);
  // 紙のむら
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(150,110,60,${0.04 + r() * 0.06})`;
    g.fillRect(r() * CARD_W, r() * CARD_H, 2 + r() * 8, 1 + r() * 2);
  }
  // 名前の帯
  g.fillStyle = god.color;
  g.fillRect(14, 322, 228, 50);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(14, 322, 228, 6);
  g.restore();
  drawBrushText(g, god.name, 128, 349, god.name.length > 3 ? 36 : 42, '#fff6dc', INK, seed + 3);
  // 縁
  card();
  g.lineWidth = 10;
  g.strokeStyle = INK;
  g.lineJoin = 'round';
  g.stroke();
  card();
  g.lineWidth = 3;
  g.strokeStyle = god.color;
  g.save();
  g.translate(0, 0);
  g.stroke();
  g.restore();
}
