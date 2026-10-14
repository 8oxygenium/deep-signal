// 「興業」の飾り（見世物小屋の提灯・幟）。画像は使わず SVG と CSS で作る。
import { esc } from './hud';

/** 提灯（縦の文字1〜2字）。body は胴の色、ink は文字の色 */
export function lantern(text: string, body = '#d8261c', ink = '#1a0d08', delay = 0): string {
  const chars = [...text].slice(0, 2);
  const fs = chars.length > 1 ? 22 : 30;
  const glyphs = chars
    .map((c, i) => `<text x="40" y="${chars.length > 1 ? 52 + i * 26 : 66}" text-anchor="middle" dominant-baseline="middle" font-size="${fs}" class="lt-ch" fill="${ink}">${esc(c)}</text>`)
    .join('');
  // 竹ひごの横線
  const ribs = Array.from({ length: 9 }, (_, i) => {
    const y = 26 + i * 9;
    const w = 30 * Math.sin(((i + 0.5) / 9) * Math.PI) + 6;
    return `<path d="M${40 - w} ${y} Q40 ${y + 3} ${40 + w} ${y}" stroke="rgba(60,10,0,0.35)" stroke-width="1.4" fill="none"/>`;
  }).join('');
  return `<div class="lantern" style="animation-delay:${delay.toFixed(2)}s"><svg viewBox="0 0 80 124" aria-hidden="true">
    <defs><radialGradient id="lg${body.slice(1)}" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#fff3c4"/><stop offset="0.35" stop-color="${body}"/><stop offset="1" stop-color="#3a0804"/></radialGradient></defs>
    <line x1="40" y1="0" x2="40" y2="12" stroke="#111" stroke-width="2"/>
    <rect x="22" y="10" width="36" height="10" rx="3" fill="#151010"/>
    <path d="M24 20 C2 34 2 92 24 106 L56 106 C78 92 78 34 56 20 Z" fill="url(#lg${body.slice(1)})" stroke="#2a0503" stroke-width="2"/>
    ${ribs}${glyphs}
    <rect x="22" y="104" width="36" height="10" rx="3" fill="#151010"/>
    <path d="M34 114 L32 124 M40 114 L40 124 M46 114 L48 124" stroke="#c9302c" stroke-width="2"/>
  </svg></div>`;
}

/** 幟（のぼり）。縦書きの文字、地の色、文字の色 */
export function nobori(text: string, cloth: string, ink: string, edge = '#ffffff', delay = 0): string {
  return `<div class="nobori" style="--cloth:${cloth};--ink:${ink};--edge:${edge};animation-delay:${delay.toFixed(2)}s">
    <div class="nb-bar"></div><div class="nb-cloth"><span>${esc(text)}</span></div><div class="nb-pole"></div>
  </div>`;
}
