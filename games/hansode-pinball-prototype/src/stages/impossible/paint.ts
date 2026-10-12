// IMPOSSIBLE の見た目：床の絵（ひび割れ・黄色×黒の帯・危険マーク・落書き）、看板、傾いた部品や垂れ下がったケーブルなどの3D装飾
import type { Mesh } from 'three';
import { Rng } from '../../core/rng';
import type { Circle } from '../../physics/shapes';
import type { DecorateApi, PaintApi } from '../types';

const JP = '"Yu Gothic", "Meiryo", "Hiragino Sans", "Segoe UI", sans-serif';

/** 黄色×黒の斜め帯で矩形を塗る */
function hazardRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, size: number, a = 1, c1 = '#f5c400', c2 = '#141414') {
  g.save();
  g.globalAlpha = a;
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = c1;
  g.fillRect(x, y, w, h);
  g.fillStyle = c2;
  for (let i = -h; i < w + h; i += size * 2) {
    g.beginPath();
    g.moveTo(x + i, y + h);
    g.lineTo(x + i + size, y + h);
    g.lineTo(x + i + size + h, y);
    g.lineTo(x + i + h, y);
    g.closePath();
    g.fill();
  }
  g.restore();
}

/** ドクロ（床の絵・床マーカー共通） */
export function drawSkull(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color = '#f2f2f2', dark = '#150808') {
  g.save();
  g.fillStyle = color;
  g.beginPath();
  g.arc(cx, cy - r * 0.15, r * 0.82, 0, Math.PI * 2);
  g.fill();
  g.fillRect(cx - r * 0.5, cy + r * 0.3, r * 1.0, r * 0.7);
  g.fillStyle = dark;
  g.beginPath();
  g.ellipse(cx - r * 0.33, cy - r * 0.2, r * 0.22, r * 0.27, 0, 0, Math.PI * 2);
  g.ellipse(cx + r * 0.33, cy - r * 0.2, r * 0.22, r * 0.27, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(cx, cy + r * 0.08);
  g.lineTo(cx - r * 0.1, cy + r * 0.3);
  g.lineTo(cx + r * 0.1, cy + r * 0.3);
  g.closePath();
  g.fill();
  g.lineWidth = Math.max(1, r * 0.07);
  g.strokeStyle = dark;
  for (let i = -1; i <= 1; i++) {
    g.beginPath();
    g.moveTo(cx + i * r * 0.22, cy + r * 0.55);
    g.lineTo(cx + i * r * 0.22, cy + r * 0.98);
    g.stroke();
  }
  g.restore();
}

export function paint({ g, map, scale }: PaintApi): void {
  const rng = new Rng(6606);
  const u = scale;

  // ── コンクリートの汚れ・染み ──
  for (let i = 0; i < 170; i++) {
    const [x, y] = map(rng.range(-9, 10.5), rng.range(-0.6, 40));
    const r = rng.range(0.3, 1.7) * u;
    const dark = rng.chance(0.75);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, dark ? `rgba(0,0,0,${rng.range(0.08, 0.2)})` : `rgba(255,255,255,${rng.range(0.03, 0.07)})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ── 鉄板のつなぎ目とリベット ──
  g.save();
  g.strokeStyle = 'rgba(0,0,0,0.3)';
  g.lineWidth = u * 0.04;
  for (let x = -8.6 + 4.3; x < 9; x += 4.3) {
    const [px, py0] = map(x, -0.6);
    const [, py1] = map(x, 40);
    g.beginPath();
    g.moveTo(px, py0);
    g.lineTo(px, py1);
    g.stroke();
  }
  for (let y = 4.4; y < 40; y += 5.1) {
    const [px0, py] = map(-9, y);
    const [px1] = map(10.5, y);
    g.beginPath();
    g.moveTo(px0, py);
    g.lineTo(px1, py);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.13)';
  for (let x = -8.6 + 4.3; x < 9; x += 4.3) {
    for (let y = 4.4; y < 40; y += 5.1) {
      for (const [dx, dy] of [[-0.25, 0.25], [0.25, 0.25], [-0.25, -0.25], [0.25, -0.25]]) {
        const [px, py] = map(x + dx, y + dy);
        g.beginPath();
        g.arc(px, py, u * 0.06, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  g.restore();

  // ── 死に穴（アウトレーン）：赤黒の危険ゾーン ──
  for (const s of [-1, 1]) {
    const [x0, y0] = map(s === -1 ? -8.65 : 5.8, 11.6);
    const [x1, y1] = map(s === -1 ? -5.8 : 8.62, 0.4);
    g.save();
    g.beginPath();
    g.rect(x0, y0, x1 - x0, y1 - y0);
    g.clip();
    g.fillStyle = 'rgba(70,0,0,0.5)';
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    hazardRect(g, x0, y0, x1 - x0, y1 - y0, u * 0.5, 0.28, '#c01818', '#120000');
    g.restore();
    // 文字「DEATH」
    const [tx, ty] = map(s === -1 ? -7.9 : 7.9, 6.0);
    g.save();
    g.translate(tx, ty);
    g.rotate(s === -1 ? -Math.PI / 2 : Math.PI / 2);
    g.font = `900 ${Math.round(u * 0.95)}px "Arial Black", "Impact", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = u * 0.1;
    g.strokeStyle = 'rgba(0,0,0,0.7)';
    g.strokeText('DEATH', 0, 0);
    g.fillStyle = 'rgba(255,60,50,0.85)';
    g.fillText('DEATH', 0, 0);
    g.restore();
  }

  // ── いちばん下の黄色×黒の帯 ──
  {
    const [bx0, by0] = map(-8.7, 1.45);
    const [bx1, by1] = map(8.62, 0.5);
    hazardRect(g, bx0, by0, bx1 - bx0, by1 - by0, u * 0.45, 0.9);
  }

  // ── PIT（スクープ）の周りの警戒リング ──
  {
    const [sx, sy] = map(-0.05, 20.55);
    g.save();
    g.beginPath();
    g.arc(sx, sy, u * 1.45, 0, Math.PI * 2);
    g.arc(sx, sy, u * 1.0, 0, Math.PI * 2, true);
    g.clip();
    hazardRect(g, sx - u * 1.5, sy - u * 1.5, u * 3, u * 3, u * 0.28, 0.95);
    g.restore();
  }

  // ── ひび割れ ──
  const crack = (x: number, y: number, ang: number, len: number, w: number, depth = 0) => {
    const pts: [number, number][] = [[x, y]];
    const branches: [number, number, number][] = [];
    const n = Math.max(3, Math.round(len / 0.6));
    let a = ang, cx = x, cy = y;
    for (let i = 0; i < n; i++) {
      a += rng.range(-0.6, 0.6);
      cx += (Math.cos(a) * len) / n;
      cy += (Math.sin(a) * len) / n;
      pts.push([cx, cy]);
      if (depth < 2 && rng.chance(0.3)) branches.push([cx, cy, a + rng.range(-1.3, 1.3)]);
    }
    for (const [col, off, lw] of [['rgba(255,255,255,0.22)', 0.05, w * 0.7], ['rgba(5,5,8,0.85)', 0, w]] as const) {
      g.beginPath();
      pts.forEach(([px, py], i) => {
        const [mx, my] = map(px + off, py - off);
        if (i === 0) g.moveTo(mx, my);
        else g.lineTo(mx, my);
      });
      g.strokeStyle = col;
      g.lineWidth = lw * u;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.stroke();
    }
    for (const [bx, by, ba] of branches) crack(bx, by, ba, len * 0.5, w * 0.7, depth + 1);
  };
  for (const [x, y] of [[-3.2, 15.6], [3.6, 8.8], [5.8, 32.8], [-5.8, 28.6], [1.4, 25.6], [-6.5, 8.0], [7.0, 14.0]] as const) {
    const k = rng.int(3, 5);
    for (let i = 0; i < k; i++) crack(x, y, rng.range(0, Math.PI * 2), rng.range(2.2, 4.8), 0.07);
  }

  // ── 危険マーク（三角に「!」）とドクロ ──
  const warnTri = (x: number, y: number, size: number, rot: number) => {
    const [px, py] = map(x, y);
    g.save();
    g.translate(px, py);
    g.rotate(rot);
    const r = size * u;
    g.beginPath();
    g.moveTo(0, -r);
    g.lineTo(r * 0.92, r * 0.62);
    g.lineTo(-r * 0.92, r * 0.62);
    g.closePath();
    g.fillStyle = 'rgba(245,196,0,0.9)';
    g.fill();
    g.lineWidth = r * 0.14;
    g.strokeStyle = 'rgba(15,15,15,0.9)';
    g.lineJoin = 'round';
    g.stroke();
    g.fillStyle = '#111';
    g.font = `900 ${Math.round(r * 1.15)}px "Arial Black", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('!', 0, r * 0.12);
    g.restore();
  };
  warnTri(-3.5, 22.3, 0.8, -0.18);
  warnTri(5.7, 11.4, 0.7, 0.22);
  warnTri(-6.0, 31.0, 0.7, 0.15);
  for (const [x, y, s] of [[-5.5, 12.6, 0.62], [5.4, 13.2, 0.55]] as const) {
    const [px, py] = map(x, y);
    drawSkull(g, px, py, s * u, 'rgba(240,240,240,0.55)', 'rgba(20,8,8,0.6)');
  }

  // ── 油のしみ・タイヤ跡 ──
  g.save();
  g.strokeStyle = 'rgba(0,0,0,0.3)';
  g.lineWidth = u * 0.32;
  g.lineCap = 'round';
  for (const off of [0, 0.62]) {
    g.beginPath();
    for (let i = 0; i <= 14; i++) {
      const [px, py] = map(-2.6 + i * 0.5 + off, 8.2 + 0.22 * Math.sin(i * 0.55) + off * 0.5 + i * 0.42);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
  }
  g.restore();

  // ── 落書き ──
  const scrawl = (text: string, x: number, y: number, size: number, rot: number, color: string) => {
    const [px, py] = map(x, y);
    g.save();
    g.translate(px, py);
    g.rotate(rot);
    g.font = `900 ${Math.round(size * u)}px ${JP}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.fillText(text, 0, 0);
    g.restore();
  };
  scrawl('GIVE UP', 3.0, 24.4, 0.85, -0.12, 'rgba(255,255,255,0.4)');
  scrawl('あきらめろ', -4.9, 17.0, 0.8, 0.26, 'rgba(255,120,200,0.55)');
  scrawl('無理', 0.75, 37.3, 2.4, -0.05, 'rgba(255,212,0,0.3)');
  scrawl('HELP', 5.2, 36.4, 0.9, 0.2, 'rgba(120,230,255,0.5)');
  scrawl('ここ キケン', -4.6, 33.8, 0.7, -0.18, 'rgba(255,255,255,0.45)');
  scrawl('NO WAY', -6.3, 24.4, 0.75, 1.45, 'rgba(255,120,80,0.5)');
  scrawl('(´；ω；`)', 2.5, 5.6, 0.9, 0.1, 'rgba(255,255,255,0.35)');
}

export function paintBackboard(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = '#100808';
  g.fillRect(0, 0, w, h);
  // 上下の黄色×黒の帯
  hazardRect(g, 0, 0, w, 30, 18);
  hazardRect(g, 0, h - 30, w, 30, 18);
  // 赤い警告ランプの光
  const grad = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.6);
  grad.addColorStop(0, 'rgba(255,40,30,0.35)');
  grad.addColorStop(1, 'rgba(255,40,30,0)');
  g.fillStyle = grad;
  g.fillRect(0, 30, w, h - 60);
  // 左右の警告マーク
  for (const cx of [95, w - 95]) {
    g.beginPath();
    g.moveTo(cx, 62);
    g.lineTo(cx + 72, 214);
    g.lineTo(cx - 72, 214);
    g.closePath();
    g.fillStyle = '#f5c400';
    g.fill();
    g.lineWidth = 9;
    g.strokeStyle = '#111';
    g.lineJoin = 'round';
    g.stroke();
    g.fillStyle = '#111';
    g.font = '900 108px "Arial Black", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('!', cx, 160);
  }
  // 大きな文字（ちょっと傾いている）
  g.save();
  g.translate(w / 2, h * 0.47);
  g.rotate(-0.025);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 136px "Arial Black", "Impact", sans-serif';
  g.fillStyle = 'rgba(255,40,30,0.85)';
  g.fillText('IMPOSSIBLE', 6, 6);
  g.fillStyle = '#ffd400';
  g.fillText('IMPOSSIBLE', 0, 0);
  g.restore();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `900 34px ${JP}`;
  g.fillStyle = '#ffffff';
  g.fillText('無理です。  立入禁止。  ご自由にどうぞ。', w / 2, h * 0.76);
  g.font = '700 22px "Segoe UI", sans-serif';
  g.fillStyle = '#ff5a4a';
  g.fillText('0 DAYS WITHOUT AN ACCIDENT', w / 2, h * 0.87);
  // ひび
  g.strokeStyle = 'rgba(0,0,0,0.85)';
  g.lineWidth = 4;
  for (const pts of [[[640, 40], [676, 96], [660, 130], [700, 190], [690, 290]], [[250, 290], [290, 230], [270, 190], [320, 120], [310, 40]]]) {
    g.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
    g.stroke();
  }
}

/** 3D装飾：傾いて折れた柵、垂れ下がるケーブルと火花、非常灯、そして死に穴のドクロ（仕切りに追従） */
export function decorate(api: DecorateApi): void {
  const { THREE, group, game } = api;
  const hazardTex = api.canvasTexture(128, 32, (g) => hazardRect(g, 0, 0, 128, 32, 16));
  hazardTex.wrapS = THREE.RepeatWrapping;
  hazardTex.repeat.set(2, 1);
  const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.7, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.8, metalness: 0.4 });

  // 傾いて折れた柵（台の外側、手前のすみ）
  const rail = (x: number, y: number, rotY: number, tilt: number, len: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.55, 0.14), hazardMat);
    m.position.copy(api.at(x, y, 0.5));
    m.rotation.set(0, rotY, tilt);
    group.add(m);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 8), dark);
      leg.position.copy(api.at(x + Math.cos(rotY) * s * len * 0.45, y - Math.sin(rotY) * s * len * 0.45, 0.35));
      leg.rotation.z = tilt * 1.6 * s;
      group.add(leg);
    }
  };
  rail(-9.9, 7.5, 1.35, 0.35, 3.2);
  rail(11.4, 6.0, -1.2, -0.28, 2.8);
  rail(-9.8, 30.5, 1.7, -0.3, 3.0);

  // パイロン（三角コーン）
  const cone = (x: number, y: number, tilt: number) => {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 14), new THREE.MeshStandardMaterial({ color: '#ff6a1a', roughness: 0.6 }));
    c.position.y = 0.5;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.16, 14), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }));
    band.position.y = 0.52;
    g.add(c, band);
    g.position.copy(api.at(x, y, 0));
    g.rotation.z = tilt;
    group.add(g);
  };
  cone(-10.0, 3.2, 1.2);
  cone(11.6, 2.2, -0.2);
  cone(-9.9, 33.5, 0.15);

  // 垂れ下がったケーブル（ゆらゆら）と火花
  const cableMat = new THREE.MeshStandardMaterial({ color: '#111114', roughness: 0.5 });
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.25, -1.2, 0.2),
    new THREE.Vector3(-0.2, -2.3, 0.3),
    new THREE.Vector3(0.4, -3.3, 0.1),
  ]);
  const cableGroup = new THREE.Group();
  cableGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.07, 6), cableMat));
  const sparkMat = api.glow('#ffb030');
  const sparks: Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), sparkMat);
    sp.position.set(0.4, -3.3, 0.1);
    cableGroup.add(sp);
    sparks.push(sp);
  }
  cableGroup.position.copy(api.at(-6.2, 39.5, 6.2));
  group.add(cableGroup);
  const cable2 = cableGroup.clone();
  cable2.position.copy(api.at(7.0, 39.8, 5.6));
  cable2.scale.set(-0.9, 0.9, 0.9);
  group.add(cable2);

  // 非常灯（回転灯の本体）：警報が強いほど明るい
  const lampMat = api.glow('#ff2a2a');
  const lamps: Mesh[] = [];
  for (const x of [-9.4, 11.0]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.35, 12), dark);
    base.position.copy(api.at(x, 38.5, 0.18));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), lampMat);
    dome.position.copy(api.at(x, 38.5, 0.35));
    group.add(base, dome);
    lamps.push(dome);
  }

  // 死に穴のドクロ（仕切りの動きに合わせてスライドする）
  const skullTex = api.canvasTexture(128, 128, (g) => {
    g.fillStyle = 'rgba(120,0,0,0.9)';
    g.beginPath();
    g.arc(64, 64, 62, 0, Math.PI * 2);
    g.fill();
    drawSkull(g, 64, 66, 44);
  });
  const markers: { mesh: Mesh; post: Circle | null; dir: number }[] = [];
  for (const side of ['L', 'R'] as const) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: skullTex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    group.add(m);
    markers.push({ mesh: m, post: (game.table.shapesByTag(`divTop${side}`)[0] as Circle | undefined) ?? null, dir: side === 'L' ? -1 : 1 });
  }

  api.onFrame((t) => {
    const alarm = game.vars.alarm ?? 0.25;
    // ケーブルのゆれ
    cableGroup.rotation.z = Math.sin(t * 1.3) * 0.12;
    cable2.rotation.z = Math.sin(t * 1.1 + 2) * 0.12;
    // 火花（ランダムにパチッ）
    for (const s of sparks) {
      const on = Math.random() < 0.12;
      s.visible = on;
      if (on) s.position.set(0.4 + (Math.random() - 0.5) * 0.8, -3.3 - Math.random() * 0.9, 0.1 + (Math.random() - 0.5) * 0.4);
    }
    sparkMat.emissiveIntensity = 2.5 + Math.random() * 2;
    lampMat.emissiveIntensity = 0.4 + alarm * 3 * (0.5 + 0.5 * Math.sin(t * 7));
    for (const l of lamps) l.rotation.y = t * 3;
    for (const mk of markers) {
      if (!mk.post) continue;
      mk.mesh.position.set(mk.post.cx + mk.dir * 0.62, 0.025, -9.1);
    }
  });
}
