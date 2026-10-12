// ANIME の見た目：集中線・桜・星・魔法陣の床、バックボード、3Dの飾り（星のオブジェ、変身リング、桜の木）。
import type { BumperRT } from '../../table/table';
import type { DecorateApi, PaintApi } from '../types';
import { SCOOP_AT } from './layout';

export const C = {
  bg: '#2a1457',
  floor: '#4fb6ff',
  floor2: '#ff9fd0',
  wall: '#ff5fa8',
  guide: '#ffffff',
  rubber: '#ffe14f',
  flipper: '#ffffff',
  flipperRubber: '#ff4fa3',
  bumper: '#ffffff',
  bumperCap: '#ffe14f',
  sling: '#6ff0c8',
  target: '#ffffff',
  ramp: '#a46bff',
  accent: '#ff4fa3',
  accent2: '#ffe14f',
  dmd: '#ff7ac8',
  text: '#4a1d7a',
};

/** 再現できる乱数（床の絵を毎回同じにする） */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 五弁の桜 */
function flower(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, fill: string, alpha: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.globalAlpha = alpha;
  for (let i = 0; i < 5; i++) {
    g.rotate((Math.PI * 2) / 5);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-r * 0.55, -r * 0.35, -r * 0.5, -r * 0.95, -r * 0.12, -r);
    g.lineTo(0, -r * 0.86);
    g.lineTo(r * 0.12, -r);
    g.bezierCurveTo(r * 0.5, -r * 0.95, r * 0.55, -r * 0.35, 0, 0);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = Math.max(1, r * 0.06);
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.stroke();
  }
  g.beginPath();
  g.arc(0, 0, r * 0.14, 0, Math.PI * 2);
  g.fillStyle = '#ffd24a';
  g.fill();
  g.restore();
}

/** 四つ角のきらめき */
function sparkle(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number): void {
  g.save();
  g.translate(x, y);
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = r * 0.8;
  g.beginPath();
  g.moveTo(0, -r);
  g.quadraticCurveTo(r * 0.14, -r * 0.14, r, 0);
  g.quadraticCurveTo(r * 0.14, r * 0.14, 0, r);
  g.quadraticCurveTo(-r * 0.14, r * 0.14, -r, 0);
  g.quadraticCurveTo(-r * 0.14, -r * 0.14, 0, -r);
  g.fill();
  g.restore();
}

/** 星形（n角） */
function starPath(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, r: number, n: number, rot: number): void {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const rr = i % 2 === 0 ? R : r;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

export function paint({ g, map, scale, width: W, height: H }: PaintApi): void {
  const R = rng(5);
  // ── 集中線（盤の中心から放射状に）──
  const [fx, fy] = map(0.75, 23);
  g.save();
  const n = 110;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.03;
    const w = 0.012 + R() * 0.03;
    const r0 = scale * (6.5 + R() * 3);
    const r1 = scale * 70;
    g.beginPath();
    g.moveTo(fx + Math.cos(a - w) * r0, fy + Math.sin(a - w) * r0);
    g.lineTo(fx + Math.cos(a) * r1, fy + Math.sin(a) * r1);
    g.lineTo(fx + Math.cos(a + w) * r0, fy + Math.sin(a + w) * r0);
    g.closePath();
    g.fillStyle = ['rgba(255,255,255,0.26)', 'rgba(255,60,150,0.30)', 'rgba(255,225,79,0.30)', 'rgba(60,120,255,0.26)'][i % 4];
    g.fill();
  }
  g.restore();

  // ── ぼかした光の玉 ──
  for (let i = 0; i < 26; i++) {
    const x = R() * W, y = R() * H, r = scale * (0.5 + R() * 1.6);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const col = ['255,255,255', '255,224,120', '255,150,210', '150,220,255'][i % 4];
    gr.addColorStop(0, `rgba(${col},0.35)`);
    gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ── 手前（フリッパー側）の斜めストライプ ──
  g.save();
  const [, yBand] = map(0, 9.5);
  g.beginPath();
  g.rect(0, yBand, W, H - yBand);
  g.clip();
  for (let i = -6; i < 24; i++) {
    g.beginPath();
    const x0 = i * scale * 1.4;
    g.moveTo(x0, H);
    g.lineTo(x0 + scale * 0.7, H);
    g.lineTo(x0 + scale * 0.7 + scale * 6, yBand);
    g.lineTo(x0 + scale * 6, yBand);
    g.closePath();
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.20)' : 'rgba(255,79,163,0.10)';
    g.fill();
  }
  g.restore();

  // ── 大きな星の紋章（中央）──
  g.save();
  g.lineJoin = 'round';
  starPath(g, fx, fy, scale * 7.4, scale * 3.4, 5, -Math.PI / 2);
  g.fillStyle = 'rgba(255,225,79,0.16)';
  g.fill();
  g.lineWidth = scale * 0.16;
  g.strokeStyle = 'rgba(255,200,40,0.55)';
  g.stroke();
  g.lineWidth = scale * 0.05;
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.stroke();
  g.restore();

  // ── 桜（大小ちらばせる）と花びら ──
  for (let i = 0; i < 34; i++) {
    const x = R() * W, y = R() * H;
    const big = R() < 0.35;
    flower(g, x, y, scale * (big ? 0.95 : 0.5), R() * 6.28, R() < 0.5 ? '#ffb6d3' : '#ffd6e8', big ? 0.7 : 0.55);
  }
  for (let i = 0; i < 60; i++) {
    const x = R() * W, y = R() * H, r = scale * (0.12 + R() * 0.16);
    g.save();
    g.translate(x, y);
    g.rotate(R() * 6.28);
    g.globalAlpha = 0.6;
    g.fillStyle = '#ffc4dc';
    g.beginPath();
    g.ellipse(0, 0, r * 1.7, r, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // ── きらめき ──
  for (let i = 0; i < 40; i++) sparkle(g, R() * W, R() * H, scale * (0.25 + R() * 0.55), R() < 0.5 ? '#ffffff' : '#ffe14f', 0.7);

  // ── 変身スクープの魔法陣 ──
  const [sx, sy] = map(SCOOP_AT[0], SCOOP_AT[1]);
  g.save();
  g.translate(sx, sy);
  const ring = (rad: number, w: number, col: string) => {
    g.beginPath();
    g.arc(0, 0, scale * rad, 0, Math.PI * 2);
    g.lineWidth = scale * w;
    g.strokeStyle = col;
    g.stroke();
  };
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.arc(0, 0, scale * 2.9, 0, Math.PI * 2);
  g.fill();
  ring(2.9, 0.12, 'rgba(255,79,163,0.85)');
  ring(2.45, 0.05, 'rgba(255,255,255,0.95)');
  ring(1.75, 0.1, 'rgba(164,107,255,0.8)');
  // 星形の魔法陣
  starPath(g, 0, 0, scale * 2.45, scale * 2.45 * 0.382, 5, -Math.PI / 2);
  g.lineWidth = scale * 0.06;
  g.strokeStyle = 'rgba(255,79,163,0.8)';
  g.stroke();
  // 目盛り
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const r0 = scale * 2.9, r1 = scale * (i % 3 === 0 ? 3.3 : 3.1);
    g.beginPath();
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    g.lineWidth = scale * 0.06;
    g.strokeStyle = 'rgba(255,79,163,0.8)';
    g.stroke();
  }
  g.restore();

  // ── ラベル ──
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const label = (txt: string, x: number, y: number, size: number, col: string, rot = 0, stroke = 'rgba(255,255,255,0.9)') => {
    const [px, py] = map(x, y);
    g.save();
    g.translate(px, py);
    g.rotate(rot);
    g.font = `900 ${Math.round(scale * size)}px "Segoe UI", "Yu Gothic UI", "Meiryo", sans-serif`;
    g.lineJoin = 'round';
    g.lineWidth = scale * size * 0.22;
    g.strokeStyle = stroke;
    g.strokeText(txt, 0, 0);
    g.fillStyle = col;
    g.fillText(txt, 0, 0);
    g.restore();
  };
  label('ANIME', 0, 6.4, 1.15, '#ff2f94');
  label('MAGIC ROAD', 0, 13.35, 0.46, '#7b3fe0');
  label('SAKURA', -6.6, 12.9, 0.4, '#ff2f94', -0.55);
  label('LOOP', -6.2, 12.2, 0.4, '#ff2f94', -0.55);
  label('SAKURA', 6.6, 12.9, 0.4, '#1d8fd8', 0.55);
  label('LOOP', 6.2, 12.2, 0.4, '#1d8fd8', 0.55);
  label('STAR', -8.0, 23.4, 0.42, '#d4256f', -Math.PI / 2);
  label('STAR', 8.0, 23.4, 0.42, '#1d8fd8', -Math.PI / 2);
  g.restore();

  // ── 周辺をほんの少し暗く（中央が引き立つ）──
  const vg = g.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.25, W / 2, H * 0.5, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(60,20,110,0)');
  vg.addColorStop(1, 'rgba(60,20,110,0.34)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
}

export function paintBackboard(g: CanvasRenderingContext2D, w: number, h: number): void {
  const R = rng(9);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#4fb8ff');
  sky.addColorStop(0.55, '#c9a4ff');
  sky.addColorStop(1, '#ffc0e0');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // 放射状の光
  g.save();
  g.translate(w / 2, h * 0.62);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, w, a, a + Math.PI / 28);
    g.closePath();
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0)';
    g.fill();
  }
  g.restore();
  for (let i = 0; i < 26; i++) flower(g, R() * w, R() * h, 10 + R() * 26, R() * 6.28, '#ffd3e6', 0.85);
  for (let i = 0; i < 30; i++) sparkle(g, R() * w, R() * h, 6 + R() * 16, R() < 0.5 ? '#ffffff' : '#fff27a', 0.9);
  // タイトル
  g.save();
  g.translate(w / 2, h * 0.47);
  g.transform(1, 0, -0.18, 1, 0, 0);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 150px "Segoe UI Black", "Arial Black", sans-serif';
  g.lineJoin = 'round';
  g.fillStyle = '#3a1470';
  g.fillText('ANIME', 9, 11);
  g.lineWidth = 26;
  g.strokeStyle = '#ff2f94';
  g.strokeText('ANIME', 0, 0);
  g.lineWidth = 9;
  g.strokeStyle = '#ffffff';
  g.strokeText('ANIME', 0, 0);
  const tg = g.createLinearGradient(0, -70, 0, 70);
  tg.addColorStop(0, '#fff7a8');
  tg.addColorStop(1, '#ffb300');
  g.fillStyle = tg;
  g.fillText('ANIME', 0, 0);
  g.restore();
  g.save();
  g.textAlign = 'center';
  g.font = '900 36px "Yu Gothic UI", "Meiryo", "Segoe UI", sans-serif';
  g.lineWidth = 8;
  g.strokeStyle = '#3a1470';
  g.strokeText('変身！ 必殺！ ピンボール', w / 2, h * 0.86);
  g.fillStyle = '#ffffff';
  g.fillText('変身！ 必殺！ ピンボール', w / 2, h * 0.86);
  g.restore();
  g.lineWidth = 12;
  g.strokeStyle = '#ffffff';
  g.strokeRect(10, 10, w - 20, h - 20);
  g.lineWidth = 5;
  g.strokeStyle = '#ff2f94';
  g.strokeRect(16, 16, w - 32, h - 32);
}

/** ANIME 専用の飾り：バンパーの上の星、変身リング、角の桜の木 */
export function decorate(api: DecorateApi): void {
  const { THREE, group, game } = api;
  // アニメ塗り用の3段階グラデーション
  const gradient = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 200, 200, 200, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  const toon = (color: string, emissive = '#000000', ei = 0) => new THREE.MeshToonMaterial({ color, gradientMap: gradient, emissive, emissiveIntensity: ei });

  // 星形の立体
  const starShape = (R: number, r: number) => {
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? R : r;
      if (i === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    sh.closePath();
    return sh;
  };
  const starGeo = (R: number) => {
    const geo = new THREE.ExtrudeGeometry(starShape(R, R * 0.5), { depth: R * 0.3, bevelEnabled: true, bevelSize: R * 0.06, bevelThickness: R * 0.06, bevelSegments: 1 });
    geo.translate(0, 0, -R * 0.15);
    return geo;
  };

  // ── バンパーの上に浮かぶ星 ──
  const toppers: { mesh: InstanceType<typeof THREE.Mesh>; mat: InstanceType<typeof THREE.MeshToonMaterial>; id: string; x: number; y: number; pulse: number }[] = [];
  for (const id of ['b1', 'b2', 'b3', 'b4']) {
    const rt = game.table.get<BumperRT>(id);
    const mat = toon('#ffe14f', '#ffb000', 0.55);
    const mesh = new THREE.Mesh(starGeo(0.55), mat);
    mesh.position.copy(api.at(rt.x, rt.y, 2.0));
    mesh.rotation.x = -0.45;
    group.add(mesh);
    toppers.push({ mesh, mat, id, x: rt.x, y: rt.y, pulse: 0 });
  }

  // ── 変身スクープの上の魔法リング ──
  const ringMat = api.glow('#ff4fa3');
  ringMat.transparent = true;
  ringMat.opacity = 0.9;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.06, 8, 48), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(api.at(SCOOP_AT[0], SCOOP_AT[1], 1.3));
  group.add(ring);
  const orbiters: InstanceType<typeof THREE.Mesh>[] = [];
  const orbitMat = toon('#ffffff', '#ffd1ee', 0.8);
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(starGeo(0.26), orbitMat);
    m.rotation.x = -Math.PI / 2;
    group.add(m);
    orbiters.push(m);
  }

  // ── 角の桜の木 ──
  const trunkMat = toon('#8a5a3a');
  const blossom = [toon('#ffb6d3'), toon('#ffd0e4'), toon('#ff9fc6')];
  for (const [tx, ty, s] of [[-7.7, 38.2, 1], [9.1, 38.4, 0.9]] as [number, number, number][]) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.28 * s, 1.6 * s, 8), trunkMat);
    trunk.position.y = 0.8 * s;
    tree.add(trunk);
    [[0, 2.1, 0, 1.0], [-0.8, 1.7, 0.2, 0.75], [0.8, 1.8, -0.1, 0.8], [0.1, 2.7, 0.1, 0.7]].forEach(([x, y, z, r], i) => {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 1), blossom[i % 3]);
      b.position.set(x * s, y * s, z * s);
      tree.add(b);
    });
    tree.position.copy(api.at(tx, ty, 1.7));
    group.add(tree);
  }

  // ── イベントに反応 ──
  let flash = 0;
  game.on((e) => {
    if (e.t === 'table' && e.e.type === 'bumper') {
      const tp = toppers.find((p) => p.id === e.e.id);
      if (tp) tp.pulse = 1;
    }
    if (e.t === 'multiball' || e.t === 'jackpot' || (e.t === 'fx' && e.name === 'cutin')) flash = 1;
  });

  api.onFrame((t, dt) => {
    flash = Math.max(0, flash - dt * 1.2);
    for (const p of toppers) {
      p.pulse = Math.max(0, p.pulse - dt * 4);
      p.mesh.rotation.y = t * 1.4 + p.x;
      p.mesh.position.y = 2.0 + Math.sin(t * 2.2 + p.x) * 0.12 + p.pulse * 0.35;
      const sc = 1 + p.pulse * 0.45;
      p.mesh.scale.set(sc, sc, sc);
      p.mat.emissiveIntensity = 0.45 + p.pulse * 1.6;
    }
    const gauge = (game.vars.gauge ?? 0) / 100;
    const ready = (game.vars.ready ?? 0) > 0;
    const speed = 0.6 + gauge * 1.6 + (ready ? 3.5 : 0);
    ring.rotation.z += dt * speed;
    ringMat.emissiveIntensity = 0.5 + gauge * 1.2 + (ready ? 1.6 + Math.sin(t * 14) * 0.8 : 0) + flash * 2;
    ring.scale.setScalar(0.85 + gauge * 0.25 + (ready ? 0.12 * Math.sin(t * 9) : 0));
    ring.position.y = 1.3 + (ready ? 0.15 * Math.sin(t * 6) : 0);
    orbiters.forEach((m, i) => {
      const a = t * speed * 1.4 + (i / orbiters.length) * Math.PI * 2;
      const rr = 1.7 * ring.scale.x;
      m.position.set(SCOOP_AT[0] + Math.cos(a) * rr, 1.3 + Math.sin(t * 3 + i) * 0.1 + (ready ? 0.1 : 0), -(SCOOP_AT[1] + Math.sin(a) * rr));
      m.rotation.z = t * 3 + i;
      const k = 0.5 + gauge * 0.8 + (ready ? 0.5 : 0);
      m.scale.setScalar(k);
    });
    orbitMat.emissiveIntensity = 0.5 + gauge + (ready ? 1.2 : 0);
  });
}
