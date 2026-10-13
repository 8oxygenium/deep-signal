// CYBER の見た目：床の絵（ネオンのグリッド・回路・データの流れ）、バックボード、ステージ専用の3D（ワイヤーフレーム・ホログラム）
import type { DecorateApi, PaintApi } from '../types';
import { FIREWALL_TAGS, ROOT, TOP_LANES, WARPS } from './layout';

const CYAN = '#05d9e8';
const PINK = '#ff2a6d';
const VIOLET = '#b967ff';
const YELLOW = '#ffe14a';

/** 決まった乱数（毎回同じ絵になるように） */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ───────────────────────── 床の絵 ─────────────────────────

export function paint({ g, map, scale, width: W, height: H }: PaintApi): void {
  const rnd = lcg(5150);
  const px = (x: number, y: number) => map(x, y);

  // 下地：奥ほど紫がかった黒
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#220a52');
  bg.addColorStop(0.35, '#101a44');
  bg.addColorStop(1, '#0a1230');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  const line = (pts: [number, number][], color: string, w: number, blur = 10, alpha = 1, dash?: number[]) => {
    g.save();
    g.globalAlpha = alpha;
    g.strokeStyle = color;
    g.lineWidth = w * scale;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.shadowColor = color;
    g.shadowBlur = blur;
    if (dash) g.setLineDash(dash.map((d) => d * scale));
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const [a, b] = px(x, y);
      if (i === 0) g.moveTo(a, b);
      else g.lineTo(a, b);
    });
    g.stroke();
    g.restore();
  };
  const text = (t: string, x: number, y: number, size: number, color: string, o: { rot?: number; alpha?: number; blur?: number; align?: CanvasTextAlign; weight?: string } = {}) => {
    const [a, b] = px(x, y);
    g.save();
    g.translate(a, b);
    g.rotate(o.rot ?? 0);
    g.globalAlpha = o.alpha ?? 1;
    g.font = `${o.weight ?? '700'} ${Math.round(size * scale)}px "Consolas", "Courier New", monospace`;
    g.textAlign = o.align ?? 'center';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.shadowColor = color;
    g.shadowBlur = o.blur ?? 8;
    g.fillText(t, 0, 0);
    g.restore();
  };
  const ring = (x: number, y: number, r: number, color: string, w: number, alpha = 1, blur = 10) => {
    const [a, b] = px(x, y);
    g.save();
    g.globalAlpha = alpha;
    g.strokeStyle = color;
    g.lineWidth = w * scale;
    g.shadowColor = color;
    g.shadowBlur = blur;
    g.beginPath();
    g.arc(a, b, r * scale, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  };

  // シンセウェイブの太陽（奥）
  {
    const [sx, sy] = px(0.75, 37.2);
    const r = scale * 5.6;
    const sun = g.createLinearGradient(0, sy - r, 0, sy + r);
    sun.addColorStop(0, 'rgba(255, 225, 74, 0.55)');
    sun.addColorStop(0.5, 'rgba(255, 42, 109, 0.5)');
    sun.addColorStop(1, 'rgba(185, 103, 255, 0.35)');
    g.save();
    g.fillStyle = sun;
    g.beginPath();
    g.arc(sx, sy, r, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // 下半分に走査線の切れ目
    g.save();
    g.fillStyle = '#080a1c';
    for (let i = 0; i < 8; i++) {
      const yy = sy + r * (0.05 + i * 0.12);
      g.fillRect(sx - r, yy, r * 2, scale * (0.1 + i * 0.045));
    }
    g.restore();
  }

  // ネオンのグリッド
  g.save();
  for (let x = -9; x <= 11; x++) {
    const major = x % 4 === 0;
    g.strokeStyle = major ? 'rgba(5, 217, 232, 0.30)' : 'rgba(5, 217, 232, 0.11)';
    g.lineWidth = major ? scale * 0.06 : scale * 0.03;
    const [a] = px(x, 0);
    g.beginPath();
    g.moveTo(a, 0);
    g.lineTo(a, H);
    g.stroke();
  }
  for (let y = 0; y <= 41; y++) {
    const major = y % 4 === 0;
    g.strokeStyle = major ? 'rgba(255, 42, 109, 0.26)' : 'rgba(5, 217, 232, 0.10)';
    g.lineWidth = major ? scale * 0.06 : scale * 0.03;
    const [, b] = px(0, y);
    g.beginPath();
    g.moveTo(0, b);
    g.lineTo(W, b);
    g.stroke();
  }
  g.restore();

  // 16進数の雨（すみっこ）
  g.save();
  g.font = `${Math.round(scale * 0.34)}px "Consolas", monospace`;
  g.textAlign = 'center';
  for (let i = 0; i < 150; i++) {
    const x = -8.5 + rnd() * 18.5;
    const y = 1.5 + rnd() * 38;
    const [a, b] = px(x, y);
    g.fillStyle = rnd() < 0.5 ? 'rgba(5,217,232,0.16)' : 'rgba(185,103,255,0.14)';
    g.fillText(rnd() < 0.5 ? '0' : rnd() < 0.5 ? '1' : '0123456789ABCDEF'[Math.floor(rnd() * 16)], a, b);
  }
  g.restore();

  // 回路のパターン（斜め45度で曲がる配線）
  const trace = (x: number, y: number, moves: [number, number][], color: string, alpha: number) => {
    const pts: [number, number][] = [[x, y]];
    let cx = x, cy = y;
    for (const [dx, dy] of moves) {
      cx += dx;
      cy += dy;
      pts.push([cx, cy]);
    }
    line(pts, color, 0.07, 6, alpha);
    const [a, b] = px(cx, cy);
    g.save();
    g.globalAlpha = alpha + 0.15;
    g.fillStyle = color;
    g.beginPath();
    g.arc(a, b, scale * 0.17, 0, Math.PI * 2);
    g.fill();
    g.restore();
    const [a0, b0] = px(x, y);
    g.save();
    g.globalAlpha = alpha;
    g.strokeStyle = color;
    g.lineWidth = scale * 0.05;
    g.beginPath();
    g.arc(a0, b0, scale * 0.16, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  };
  trace(-6.2, 13.2, [[0, 1.4], [1, 1], [0, 1.2]], CYAN, 0.32);
  trace(-5.4, 12.6, [[0, 2.0], [-0.7, 0.7]], CYAN, 0.26);
  trace(7.0, 13.4, [[-0.2, 1.4], [-1, 1], [0, 1.4]], CYAN, 0.32);
  trace(6.0, 12.6, [[0, 1.8], [0.6, 0.6]], CYAN, 0.26);
  trace(-3.2, 14.4, [[-0.8, -0.8], [-1.2, 0], [0, -1.0]], VIOLET, 0.3);
  trace(1.2, 14.6, [[0.9, -0.9], [1.4, 0], [0, -1.1]], VIOLET, 0.3);
  trace(-6.6, 29.8, [[0, 1.4], [0.8, 0.8], [1.8, 0]], PINK, 0.3);
  trace(8.2, 30.4, [[0, 1.6], [-0.8, 0.8], [-1.4, 0]], PINK, 0.3);
  trace(-4.6, 36.2, [[1.2, 0], [0.8, 0.8], [0, 1.0]], CYAN, 0.28);
  trace(6.4, 36.4, [[-1.2, 0], [-0.8, 0.8], [0, 1.0]], CYAN, 0.28);

  // CPU のパッケージ（3つのバンパーを囲む）
  {
    const cx = 0.6, cy = 26.4, hw = 6.5, hh = 4.5;
    const [x0, y0] = px(cx - hw, cy + hh);
    g.save();
    g.fillStyle = 'rgba(20, 10, 50, 0.45)';
    g.fillRect(x0, y0, hw * 2 * scale, hh * 2 * scale);
    g.restore();
    line(
      [
        [cx - hw + 1.0, cy + hh],
        [cx + hw, cy + hh],
        [cx + hw, cy - hh],
        [cx - hw, cy - hh],
        [cx - hw, cy + hh - 1.0],
        [cx - hw + 1.0, cy + hh],
      ],
      CYAN,
      0.09,
      16,
      0.85,
    );
    // ピン
    g.save();
    g.strokeStyle = CYAN;
    g.globalAlpha = 0.55;
    g.lineWidth = scale * 0.07;
    g.shadowColor = CYAN;
    g.shadowBlur = 6;
    for (let i = 0; i < 11; i++) {
      const x = cx - hw + 1.5 + i * 1.0;
      for (const [yy, d] of [[cy + hh, 0.5], [cy - hh, -0.5]] as [number, number][]) {
        const [a, b] = px(x, yy);
        g.beginPath();
        g.moveTo(a, b);
        g.lineTo(a, b - d * scale);
        g.stroke();
      }
    }
    g.restore();
    text('C P U', cx + hw - 1.4, cy - hh + 0.6, 0.5, CYAN, { alpha: 0.7 });
    // バンパー周りのリング
    for (const [bx, by, c] of [[-3.3, 25.6, PINK], [0.6, 27.9, CYAN], [4.2, 25.4, PINK]] as [number, number, string][]) {
      ring(bx, by, 1.55, c, 0.06, 0.55, 12);
      ring(bx, by, 2.1, c, 0.035, 0.25, 6);
    }
  }

  // ハッキングのバス（左・右・上）
  {
    const bus = (pts: [number, number][], chevrons: [number, number, number][]) => {
      line(pts, CYAN, 0.55, 18, 0.18);
      line(pts, CYAN, 0.08, 10, 0.9, [0.5, 0.35]);
      for (const [x, y, r] of chevrons) {
        const [a, b] = px(x, y);
        g.save();
        g.translate(a, b);
        g.rotate(r);
        g.strokeStyle = CYAN;
        g.shadowColor = CYAN;
        g.shadowBlur = 8;
        g.globalAlpha = 0.8;
        g.lineWidth = scale * 0.09;
        g.beginPath();
        g.moveTo(-0.35 * scale, 0.18 * scale);
        g.lineTo(0, -0.18 * scale);
        g.lineTo(0.35 * scale, 0.18 * scale);
        g.stroke();
        g.restore();
      }
    };
    bus([[-7.9, 17.6], [-7.9, 28.5]], [[-7.9, 19.2, 0], [-7.9, 26.2, 0]]);
    bus([[7.95, 17.8], [7.95, 27.0]], [[7.95, 19.2, 0], [7.95, 25.4, 0]]);
    bus([[TOP_LANES[0] - 1.0, 33.5], [TOP_LANES[3] + 1.0, 33.5]], []);
    text('L-BUS', -7.1, 19.4, 0.42, CYAN, { rot: -Math.PI / 2, alpha: 0.75 });
    text('R-BUS', 7.1 + 0.9, 18.7, 0.42, CYAN, { rot: -Math.PI / 2, alpha: 0.75 });
    text('TOP BUS', 0.75, 36.0, 0.5, CYAN, { alpha: 0.8 });
    text('// HACK THE LANES', 0.75, 37.0, 0.34, PINK, { alpha: 0.75 });
  }

  // ROOT チャンバー（赤いハッチの床＋照準）
  {
    const { x, y0, y1, w } = ROOT;
    const [a0, b0] = px(x - w, y1);
    g.save();
    g.beginPath();
    g.rect(a0, b0, w * 2 * scale, (y1 - y0) * scale);
    g.clip();
    g.fillStyle = 'rgba(70, 0, 30, 0.7)';
    g.fillRect(a0, b0, w * 2 * scale, (y1 - y0) * scale);
    g.strokeStyle = 'rgba(255, 42, 109, 0.35)';
    g.lineWidth = scale * 0.12;
    for (let i = -10; i < 20; i++) {
      g.beginPath();
      g.moveTo(a0 + i * scale * 0.5, b0 + (y1 - y0) * scale);
      g.lineTo(a0 + i * scale * 0.5 + (y1 - y0) * scale, b0);
      g.stroke();
    }
    g.restore();
    const my = (y0 + y1) / 2 + 0.2;
    ring(x, my, 0.55, PINK, 0.07, 0.9, 16);
    ring(x, my, 0.95, PINK, 0.04, 0.5, 8);
    line([[x - 1.1, my], [x - 0.65, my]], PINK, 0.05, 6, 0.8);
    line([[x + 0.65, my], [x + 1.1, my]], PINK, 0.05, 6, 0.8);
    line([[x, my - 1.1], [x, my - 0.65]], PINK, 0.05, 6, 0.8);
    line([[x, my + 0.65], [x, my + 1.0]], PINK, 0.05, 6, 0.8);
    text('ROOT', x, y1 - 0.45, 0.42, PINK, { alpha: 0.85 });
    text('FIREWALL', x, y0 - 0.55, 0.34, PINK, { alpha: 0.8 });
    // 入口へ向かう矢印の道
    line([[x, 14.0], [x, 16.2]], PINK, 0.06, 8, 0.45, [0.3, 0.3]);
  }

  // ワープの入口
  for (const [id, w, c] of [['w1', WARPS.w1, CYAN], ['w2', WARPS.w2, PINK]] as ['w1' | 'w2', typeof WARPS.w1, string][]) {
    const [x, y] = w.at;
    ring(x, y, 1.15, c, 0.06, 0.7, 16);
    ring(x, y, 1.6, c, 0.03, 0.35, 8);
    g.save();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      line([[x + Math.cos(a) * 1.1, y + Math.sin(a) * 1.1], [x + Math.cos(a + 0.5) * 1.55, y + Math.sin(a + 0.5) * 1.55]], c, 0.05, 6, 0.6);
    }
    g.restore();
    text(id.toUpperCase(), x, y - 1.9, 0.4, c, { alpha: 0.85 });
    text('>> UP', x, y - 2.45, 0.28, c, { alpha: 0.6 });
  }

  // CORE スクープ・PORT ドロップ
  ring(2.55, 18.75, 1.15, VIOLET, 0.07, 0.85, 16);
  ring(2.55, 18.75, 1.55, VIOLET, 0.03, 0.4, 8);
  text('PORT SCAN', 4.6, 16.8, 0.3, VIOLET, { alpha: 0.75 });
  text('ANTI-VIRUS', 5.7, 26.0, 0.32, CYAN, { rot: -Math.PI / 2, alpha: 0.7 });
  text('DATA', -7.1, 21.4, 0.32, CYAN, { rot: -Math.PI / 2, alpha: 0.6 });

  // ロゴ：色ずれ（グリッチ）
  {
    const lx = 0.75, ly = 8.2;
    text('CYBER', lx + 0.12, ly - 0.06, 1.15, PINK, { alpha: 0.55, blur: 14, weight: '900' });
    text('CYBER', lx - 0.12, ly + 0.06, 1.15, CYAN, { alpha: 0.55, blur: 14, weight: '900' });
    text('CYBER', lx, ly, 1.15, '#ffffff', { alpha: 0.35, blur: 4, weight: '900' });
    text('// HANSODE NET', lx, ly - 1.15, 0.3, CYAN, { alpha: 0.55 });
  }

  // 外周の発光ライン
  line([[-8.45, 1.5], [-8.45, 13]], CYAN, 0.07, 14, 0.8);
  line([[8.45, 1.5], [8.45, 13]], CYAN, 0.07, 14, 0.8);
}

// ───────────────────────── バックボード ─────────────────────────

export function paintBackboard(g: CanvasRenderingContext2D, w: number, h: number): void {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#05010f');
  sky.addColorStop(0.55, '#2a0a45');
  sky.addColorStop(1, '#ff2a6d');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // 太陽
  const sx = w / 2, sy = h * 0.72, r = h * 0.5;
  const sun = g.createLinearGradient(0, sy - r, 0, sy + r);
  sun.addColorStop(0, '#ffe14a');
  sun.addColorStop(1, '#ff2a6d');
  g.fillStyle = sun;
  g.beginPath();
  g.arc(sx, sy, r, Math.PI, 0);
  g.fill();
  g.fillStyle = '#2a0a45';
  for (let i = 0; i < 7; i++) g.fillRect(sx - r, sy - r * (0.55 - i * 0.075) , r * 2, 2 + i * 1.6);
  // 地平線のグリッド
  g.fillStyle = '#05010f';
  g.fillRect(0, h * 0.72, w, h * 0.28);
  g.strokeStyle = '#05d9e8';
  g.shadowColor = '#05d9e8';
  g.shadowBlur = 8;
  g.lineWidth = 2;
  for (let i = -12; i <= 12; i++) {
    g.beginPath();
    g.moveTo(w / 2 + i * 14, h * 0.72);
    g.lineTo(w / 2 + i * 90, h);
    g.stroke();
  }
  for (let k = 1; k <= 6; k++) {
    const y = h * 0.72 + (h * 0.28) * Math.pow(k / 6, 2);
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  // ワイヤーフレームの山
  g.shadowBlur = 0;
  g.strokeStyle = '#b967ff';
  g.lineWidth = 3;
  const peaks = [0.05, 0.14, 0.2, 0.27, 0.33, 0.67, 0.74, 0.8, 0.88, 0.95];
  g.beginPath();
  g.moveTo(0, h * 0.72);
  peaks.forEach((p, i) => g.lineTo(w * p, h * (i % 2 ? 0.5 : 0.38)));
  g.lineTo(w, h * 0.72);
  g.stroke();
  // 枠と文字
  g.strokeStyle = '#05d9e8';
  g.shadowColor = '#05d9e8';
  g.shadowBlur = 16;
  g.lineWidth = 5;
  g.strokeRect(12, 12, w - 24, h - 24);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 120px "Consolas", "Courier New", monospace';
  g.shadowBlur = 0;
  g.fillStyle = '#ff2a6d';
  g.fillText('CYBER', w / 2 + 6, h * 0.42 + 2);
  g.fillStyle = '#05d9e8';
  g.fillText('CYBER', w / 2 - 6, h * 0.42 - 2);
  g.fillStyle = '#ffffff';
  g.fillText('CYBER', w / 2, h * 0.42);
  g.font = '700 26px "Consolas", monospace';
  g.fillStyle = '#ffe14a';
  g.fillText('H A C K   T H E   L A N E S', w / 2, h * 0.64);
}

// ───────────────────────── ステージ専用の3D ─────────────────────────

export function decorate(api: DecorateApi): void {
  const { THREE, group, game } = api;
  const add = (o: import('three').Object3D) => group.add(o);

  const lineMat = (color: string, opacity = 0.9) =>
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const wire = (geo: import('three').BufferGeometry, mat: import('three').LineBasicMaterial) => new THREE.LineSegments(new THREE.EdgesGeometry(geo), mat);

  // ── 背景：ワイヤーフレームの電脳都市とグリッドの床 ──
  {
    const grid = new THREE.GridHelper(180, 90, PINK, CYAN);
    (grid.material as import('three').LineBasicMaterial).transparent = true;
    (grid.material as import('three').LineBasicMaterial).opacity = 0.22;
    grid.position.copy(api.at(0.75, 18, -3.2));
    add(grid);

    const rnd = lcg(808);
    const cityMat = lineMat(CYAN, 0.5);
    const cityMat2 = lineMat(PINK, 0.45);
    for (let i = 0; i < 30; i++) {
      const side = i % 3;
      let x: number, y: number;
      if (side === 0) {
        x = -30 + rnd() * 62;
        y = 48 + rnd() * 26;
      } else if (side === 1) {
        x = -14 - rnd() * 18;
        y = -6 + rnd() * 50;
      } else {
        x = 17 + rnd() * 18;
        y = -6 + rnd() * 50;
      }
      const w = 1.6 + rnd() * 3.2, d = 1.6 + rnd() * 3.2, hgt = 3 + rnd() * (side === 0 ? 14 : 8);
      const box = wire(new THREE.BoxGeometry(w, hgt, d), rnd() < 0.7 ? cityMat : cityMat2);
      const p = api.at(x, y, hgt / 2 - 3.2);
      box.position.copy(p);
      add(box);
    }
  }

  // ── MAINFRAME ホログラム（ROOT チャンバーの上）──
  const holoMat = lineMat(PINK, 0.95);
  const holoInnerMat = lineMat(CYAN, 0.9);
  const holo = new THREE.Group();
  const outer = wire(new THREE.BoxGeometry(2.1, 2.1, 2.1), holoMat);
  const inner = wire(new THREE.OctahedronGeometry(0.85, 0), holoInnerMat);
  holo.add(outer, inner);
  holo.position.copy(api.at(ROOT.x, (ROOT.y0 + ROOT.y1) / 2 + 0.2, 3.6));
  add(holo);
  const beamMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1.15, 3.5, 28, 1, true), beamMat);
  beam.position.copy(api.at(ROOT.x, (ROOT.y0 + ROOT.y1) / 2 + 0.2, 1.8));
  beam.rotation.x = Math.PI; // 頂点が下（チャンバー側）
  beam.scale.set(1, 1, 1);
  add(beam);

  // ── ファイアウォールの赤いネオンの壁 ──
  const fwShapes = game.world.shapes.filter((s) => FIREWALL_TAGS.includes(s.tag) && s.kind === 'seg');
  const fwTex = api.canvasTexture(256, 64, (g) => {
    g.fillStyle = 'rgba(255,42,109,0.30)';
    g.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? 'rgba(255,42,109,0.55)' : 'rgba(255,225,230,0.85)';
      g.fillRect(0, i * 8, 256, 3);
    }
    g.fillStyle = '#ffffff';
    g.fillRect(0, 60, 256, 4);
  });
  fwTex.wrapT = THREE.RepeatWrapping;
  const fwMat = new THREE.MeshBasicMaterial({ map: fwTex, color: '#ff2a6d', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const fwMeshes = fwShapes.map(() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.05), fwMat);
    add(m);
    return m;
  });
  const fwEdgeMat = new THREE.MeshBasicMaterial({ color: '#ffd0e0', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const fwEdges = fwShapes.map(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.07, 0.1), fwEdgeMat);
    add(m);
    return m;
  });
  const fwSign = (() => {
    const tex = api.canvasTexture(512, 128, (g) => {
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '900 78px "Consolas", monospace';
      g.shadowColor = PINK;
      g.shadowBlur = 20;
      g.fillStyle = '#ff2a6d';
      g.fillText('FIREWALL', 262, 66);
      g.fillStyle = '#ffffff';
      g.fillText('FIREWALL', 256, 64);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.75), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.copy(api.at(ROOT.x, ROOT.y0 - 0.35, 1.9));
    m.rotation.x = -0.55;
    add(m);
    return m;
  })();
  let fwLevel = 1;

  // ── バンパーの上に浮かぶワイヤーフレーム ──
  const bumperHolos = [
    { id: 'b1', x: -3.3, y: 25.6, c: PINK },
    { id: 'b2', x: 0.6, y: 27.9, c: CYAN },
    { id: 'b3', x: 4.2, y: 25.4, c: PINK },
  ].map((b) => {
    const mat = lineMat(b.c, 0.85);
    const m = wire(new THREE.OctahedronGeometry(0.62, 0), mat);
    m.position.copy(api.at(b.x, b.y, 2.0));
    add(m);
    return { ...b, mesh: m, mat, pulse: 0 };
  });

  // ── ワープチューブ：ワイヤーフレームの管と、通るときに走る光の玉 ──
  type Warp = { id: string; curve: import('three').CatmullRomCurve3; mat: import('three').LineBasicMaterial; orb: import('three').Mesh; trail: import('three').Mesh[]; t: number; rings: import('three').Mesh[]; flash: number };
  const mkWarp = (id: string, pts: [number, number, number][], color: string): Warp => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, h]) => api.at(x, y, h)), false, 'catmullrom', 0.4);
    const segs = 56, ringN = 10, r = 0.5;
    const frames = curve.computeFrenetFrames(segs, false);
    const ringPts: import('three').Vector3[][] = [];
    for (let i = 0; i <= segs; i++) {
      const c = curve.getPointAt(i / segs);
      const n = frames.normals[i], b = frames.binormals[i];
      ringPts.push(
        Array.from({ length: ringN }, (_, k) => {
          const a = (k / ringN) * Math.PI * 2;
          return new THREE.Vector3(c.x + r * (Math.cos(a) * n.x + Math.sin(a) * b.x), c.y + r * (Math.cos(a) * n.y + Math.sin(a) * b.y), c.z + r * (Math.cos(a) * n.z + Math.sin(a) * b.z));
        }),
      );
    }
    const verts: number[] = [];
    const seg = (a: import('three').Vector3, b: import('three').Vector3) => verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    for (let i = 0; i <= segs; i++) {
      if (i % 2 === 0) for (let k = 0; k < ringN; k++) seg(ringPts[i][k], ringPts[i][(k + 1) % ringN]);
      if (i < segs) for (let k = 0; k < ringN; k += 2) seg(ringPts[i][k], ringPts[i + 1][k]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const mat = lineMat(color, 0.45);
    add(new THREE.LineSegments(geo, mat));
    const orbMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), orbMat);
    orb.visible = false;
    add(orb);
    const trail = [0, 1, 2, 3].map((i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.22 - i * 0.04, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 - i * 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false;
      add(m);
      return m;
    });
    // 入口と出口に浮かぶリング
    const rings = [pts[0], pts[pts.length - 1]].map((p) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.045, 6, 36), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.copy(api.at(p[0], p[1], 0.55));
      m.rotation.x = Math.PI / 2;
      add(m);
      return m;
    });
    return { id, curve, mat, orb, trail, t: 9, rings, flash: 0 };
  };
  const warpFx = [
    mkWarp('w1', [[-5.7, 21.4, 0.5], [-5.5, 24.5, 2.2], [-3.5, 29.0, 3.2], [1.0, 31.0, 3.4], [4.5, 30.8, 2.8], [5.9, 30.2, 0.6]], CYAN),
    mkWarp('w2', [[5.7, 21.8, 0.5], [5.6, 24.8, 2.0], [3.6, 28.8, 2.6], [-1.0, 29.6, 2.5], [-3.6, 30.0, 2.3], [-4.8, 30.2, 0.6]], PINK),
  ];

  // ── ハッキングバスを流れるパケット ──
  type Bus = { pts: [number, number][]; node: number; items: import('three').Mesh[]; len: number };
  const packetGeo = new THREE.BoxGeometry(0.3, 0.12, 0.3);
  const mkBus = (pts: [number, number][], node: number): Bus => {
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const items = [0, 1, 2, 3].map(() => {
      const m = new THREE.Mesh(packetGeo, new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      add(m);
      return m;
    });
    return { pts, node, items, len };
  };
  const buses: Bus[] = [
    mkBus([[-7.9, 17.8], [-7.9, 28.0]], 0), // L
    mkBus([[TOP_LANES[0] - 1.2, 33.5], [TOP_LANES[3] + 1.2, 33.5]], 1), // T
    mkBus([[7.95, 17.8], [7.95, 26.6]], 2), // R
  ];
  const along = (b: Bus, s: number): [number, number] => {
    let rest = s;
    for (let i = 1; i < b.pts.length; i++) {
      const l = Math.hypot(b.pts[i][0] - b.pts[i - 1][0], b.pts[i][1] - b.pts[i - 1][1]);
      if (rest <= l) {
        const k = rest / l;
        return [b.pts[i - 1][0] + (b.pts[i][0] - b.pts[i - 1][0]) * k, b.pts[i - 1][1] + (b.pts[i][1] - b.pts[i - 1][1]) * k];
      }
      rest -= l;
    }
    return b.pts[b.pts.length - 1];
  };

  // ── LOW-G の浮遊粒子 ──
  const N = 160;
  const pPos = new Float32Array(N * 3);
  const pSeed = new Float32Array(N);
  const rr = lcg(99);
  for (let i = 0; i < N; i++) {
    pSeed[i] = rr();
    const p = api.at(-8 + rr() * 17.5, 2 + rr() * 36, rr() * 3);
    pPos.set([p.x, p.y, p.z], i * 3);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: VIOLET, size: 0.22, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  add(points);
  let lowLevel = 0;

  // ── 反応 ──
  let flash = 0;
  game.on((e) => {
    if (e.t === 'table' && e.e.type === 'bumper') {
      const b = bumperHolos.find((h) => h.id === e.e.id);
      if (b) b.pulse = 1;
    }
    if (e.t === 'table' && e.e.type === 'warp') {
      const w = warpFx.find((x) => x.id === e.e.id);
      if (w) {
        w.t = 0;
        w.flash = 1;
      }
    }
    if (e.t === 'jackpot' || e.t === 'multiball' || e.t === 'mission') flash = 1.5;
  });

  api.onFrame((t, dt) => {
    const v = game.vars;
    const fwUp = (v.fw ?? 1) > 0.5;
    const oc = (v.oc ?? 0) > 0.5;
    const low = (v.low ?? 0) > 0.5;
    const mb = (v.mb ?? 0) > 0.5;
    flash = Math.max(0, flash - dt * 2);

    // MAINFRAME
    outer.rotation.y = t * (fwUp ? 0.4 : 1.1);
    outer.rotation.x = Math.sin(t * 0.7) * 0.25;
    inner.rotation.y = -t * (fwUp ? 0.9 : 2.2);
    inner.rotation.z = t * 0.6;
    holo.position.y = 3.6 + Math.sin(t * 1.6) * 0.18;
    holoMat.color.set(fwUp ? PINK : CYAN);
    holoMat.opacity = fwUp ? 0.55 + Math.sin(t * 3) * 0.2 : 1;
    holoInnerMat.color.set(fwUp ? CYAN : YELLOW);
    const s = 1 + flash * 0.25 + (fwUp ? 0 : 0.12);
    holo.scale.setScalar(s);
    const beamTarget = fwUp ? 0 : 0.2 + Math.sin(t * 6) * 0.05;
    beamMat.opacity += (beamTarget - beamMat.opacity) * Math.min(1, dt * 6);
    beamMat.color.set(fwUp ? CYAN : YELLOW);

    // ファイアウォール
    const enabled = fwShapes.length ? fwShapes[0].enabled : true;
    fwLevel += ((enabled ? 1 : 0) - fwLevel) * Math.min(1, dt * (enabled ? 6 : 14));
    fwShapes.forEach((sh, i) => {
      if (sh.kind !== 'seg') return;
      const m = fwMeshes[i];
      const len = Math.hypot(sh.bx - sh.ax, sh.by - sh.ay);
      m.scale.set(len + 0.1, 1, 1);
      m.position.set((sh.ax + sh.bx) / 2, 0.55, -(sh.ay + sh.by) / 2);
      m.rotation.y = Math.atan2(sh.by - sh.ay, sh.bx - sh.ax);
      m.visible = fwLevel > 0.02;
      const e2 = fwEdges[i];
      e2.scale.set(len + 0.1, 1, 1);
      e2.position.set((sh.ax + sh.bx) / 2, 1.1, -(sh.ay + sh.by) / 2);
      e2.rotation.y = Math.atan2(sh.by - sh.ay, sh.bx - sh.ax);
      e2.visible = fwLevel > 0.02;
    });
    fwEdgeMat.opacity = fwLevel;
    fwMat.opacity = fwLevel * (0.75 + Math.sin(t * 9) * 0.12 + (Math.random() < 0.04 ? 0.25 : 0));
    fwTex.offset.y = (t * 0.6) % 1;
    fwSign.visible = fwLevel > 0.3;

    // ワープチューブ
    for (const w of warpFx) {
      w.flash = Math.max(0, w.flash - dt * 1.4);
      w.mat.opacity = 0.4 + w.flash * 0.5 + Math.sin(t * 4 + (w.id === 'w1' ? 0 : 2)) * 0.08;
      const travelling = w.t <= 1;
      if (travelling) w.t += dt / 0.9;
      w.orb.visible = travelling;
      if (travelling) {
        const u = Math.min(1, w.t);
        w.orb.position.copy(w.curve.getPointAt(u));
        w.trail.forEach((m, i) => {
          m.visible = true;
          m.position.copy(w.curve.getPointAt(Math.max(0, u - (i + 1) * 0.035)));
        });
      } else w.trail.forEach((m) => (m.visible = false));
      w.rings.forEach((m, i) => {
        m.rotation.z = t * (i ? -1.2 : 1.2);
        m.scale.setScalar(1 + w.flash * 0.35 + Math.sin(t * 3 + i) * 0.04);
      });
    }

    // バンパー
    for (const b of bumperHolos) {
      b.pulse = Math.max(0, b.pulse - dt * 3);
      b.mesh.rotation.y = t * (oc ? 4 : 1.2) + b.x;
      b.mesh.rotation.x = t * (oc ? 3 : 0.8);
      b.mesh.scale.setScalar(1 + b.pulse * 0.6 + (oc ? 0.2 : 0));
      b.mesh.position.y = 2.0 + Math.sin(t * 2 + b.x) * 0.12 + b.pulse * 0.3;
      b.mat.color.set(oc ? YELLOW : b.c);
      b.mat.opacity = 0.7 + b.pulse * 0.3;
    }

    // パケット
    const next = v.hackNext ?? -1;
    for (const bus of buses) {
      const hot = bus.node === next;
      bus.items.forEach((m, i) => {
        const speed = hot ? 6 : 2.6;
        const s2 = (((t * speed) / bus.len + i / bus.items.length) % 1) * bus.len;
        const [x, y] = along(bus, s2);
        m.position.set(x, 0.12, -y);
        const mat = m.material as import('three').MeshBasicMaterial;
        mat.color.set(hot ? YELLOW : mb ? VIOLET : CYAN);
        mat.opacity = hot ? 1 : 0.55;
        m.scale.setScalar(hot ? 1.35 : 1);
      });
    }

    // LOW-G の粒
    lowLevel += ((low ? 1 : 0) - lowLevel) * Math.min(1, dt * 3);
    pMat.opacity = lowLevel * 0.8;
    if (lowLevel > 0.01) {
      const arr = pGeo.getAttribute('position') as import('three').BufferAttribute;
      for (let i = 0; i < N; i++) {
        let h = arr.getY(i) + dt * (0.35 + pSeed[i] * 0.5);
        if (h > 5) h = 0.2;
        arr.setY(i, h);
        arr.setX(i, arr.getX(i) + Math.sin(t * 0.8 + i) * dt * 0.2);
      }
      arr.needsUpdate = true;
    }
  });
}
