// 台の上の立体の飾り：提灯のバンパー、太鼓のスリング、鳥居、社殿の屋根としめ縄、七福神の立て札
import type * as T from 'three';
import type { Game } from '../../core/game';
import { BRUSH_FONT } from '../../render/effects';
import type { BumperRT, GateRT, SlingRT, TargetRT } from '../../table/table';
import { tomoe } from './art';
import { CARD_H, CARD_W, drawGodCard } from './gods';
import type { Kit } from './kit';
import { GODS, LANTERNS, SHRINE, TORII } from './layout';
import { INK } from './palette';

const mine = (o: T.Object3D): void => {
  o.userData.ukiyoe = true;
};

// ───────── 標準の見た目を隠す（提灯・立て札・太鼓に置き換えるため）─────────

function hideDefaults(kit: Kit, game: Game): void {
  const group = kit.api.group;
  const bumpers = LANTERNS.map((l) => game.table.get<BumperRT>(l.id));
  for (const c of group.children) {
    if (c.userData.ukiyoe || c.type !== 'Group') continue;
    for (const b of bumpers) {
      if (Math.abs(c.position.x - b.x) < 0.02 && Math.abs(c.position.z + b.y) < 0.02 && c.children.length === 4) c.visible = false;
    }
    // 鳥居の戸（標準の金属の戸は暖簾に置き換える）
    if (Math.abs(c.position.x - NOREN.mid[0]) < 0.02 && Math.abs(c.position.z + NOREN.mid[1]) < 0.02 && c.children.length === 2) c.visible = false;
    for (const god of GODS) {
      const first = c.children[0] as T.Mesh | undefined;
      if (Math.abs(c.position.x - god.at[0]) < 0.02 && Math.abs(c.position.z + god.at[1]) < 0.02 && first?.geometry?.type === 'BoxGeometry') c.visible = false;
    }
  }
}

// ───────── 提灯 ─────────

function lanternTexture(kit: Kit, kanji: string): T.CanvasTexture {
  return kit.api.canvasTexture(512, 256, (g) => {
    const W = 512, H = 256;
    g.fillStyle = '#d23d24';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#7d1a10';
    g.lineWidth = 3;
    for (let i = 1; i < 10; i++) {
      g.beginPath();
      g.moveTo(0, (i * H) / 10);
      g.lineTo(W, (i * H) / 10);
      g.stroke();
    }
    g.fillStyle = '#e0b238';
    g.fillRect(0, 0, W, 14);
    g.fillRect(0, H - 14, W, 14);
    for (const cx of [0, W / 2, W]) {
      g.fillStyle = '#fff3d4';
      g.strokeStyle = INK;
      g.lineWidth = 6;
      g.beginPath();
      g.ellipse(cx, H / 2, 58, 82, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = INK;
      g.font = `900 110px ${BRUSH_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(kanji, cx, H / 2 + 6);
    }
  });
}

interface Lantern {
  group: T.Group;
  mat: T.MeshToonMaterial;
  rt: BumperRT;
  phase: number;
}

function buildLanterns(kit: Kit, game: Game): Lantern[] {
  const THREE = kit.THREE;
  const out: Lantern[] = [];
  const blk = kit.toon(INK);
  const gold = kit.toon('#e0b238');
  const prof = [[0.5, 0.22], [0.78, 0.32], [0.92, 0.55], [0.98, 0.9], [0.92, 1.25], [0.78, 1.48], [0.52, 1.58]].map(([r, y]) => new THREE.Vector2(r, y));
  LANTERNS.forEach((l, i) => {
    const rt = game.table.get<BumperRT>(l.id);
    const group = new THREE.Group();
    mine(group);
    const mat = kit.toon('#ffffff', { map: lanternTexture(kit, l.kanji), emissive: '#ff6a2a', ei: 0.3 });
    kit.mesh(new THREE.LatheGeometry(prof, 28), mat, group);
    kit.mesh(new THREE.CylinderGeometry(0.58, 0.55, 0.16, 20), blk, group, 0, 0.15, 0);
    kit.mesh(new THREE.CylinderGeometry(0.62, 0.58, 0.18, 20), blk, group, 0, 1.66, 0);
    kit.mesh(new THREE.TorusGeometry(0.2, 0.045, 8, 16), gold, group, 0, 1.86, 0).rotation.x = Math.PI / 2;
    // 房（下のふさ）
    kit.mesh(new THREE.ConeGeometry(0.16, 0.34, 8), kit.toon('#e0b238'), group, 0, 0.0, 0).rotation.x = Math.PI;
    kit.api.group.add(group);
    out.push({ group, mat, rt, phase: i * 1.7 });
  });
  return out;
}

// ───────── 太鼓 ─────────

interface Drum {
  group: T.Group;
  skin: T.MeshBasicMaterial;
  rt: SlingRT;
}

function buildDrums(kit: Kit, game: Game): Drum[] {
  const THREE = kit.THREE;
  const tex = kit.api.canvasTexture(256, 256, (g) => {
    g.fillStyle = '#7b3f1d';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#c8321f';
    g.beginPath();
    g.arc(128, 128, 118, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f3e6c4';
    g.beginPath();
    g.arc(128, 128, 98, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(128, 128, 98, 0, Math.PI * 2);
    g.stroke();
    // 皮の鋲
    g.fillStyle = '#e0b238';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      g.beginPath();
      g.arc(128 + Math.cos(a) * 108, 128 + Math.sin(a) * 108, 5, 0, Math.PI * 2);
      g.fill();
    }
    tomoe(g, 128, 128, 66, '#1b120a', true);
  });
  const wood = kit.toon('#7b3f1d');
  const red = kit.toon('#c8321f');
  const out: Drum[] = [];
  for (const id of ['slingL', 'slingR']) {
    const rt = game.table.get<SlingRT>(id);
    const [a, b, c] = rt.def.pts;
    // 内心（三角形に内接する円の中心）と内接円の半径
    const la = Math.hypot(b[0] - c[0], b[1] - c[1]);
    const lb = Math.hypot(a[0] - c[0], a[1] - c[1]);
    const lc = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const p = la + lb + lc;
    const cx = (la * a[0] + lb * b[0] + lc * c[0]) / p;
    const cy = (la * a[1] + lb * b[1] + lc * c[1]) / p;
    const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
    const r = Math.min(0.82, (2 * area) / p - 0.02);
    const group = new THREE.Group();
    mine(group);
    group.position.set(cx, 0, -cy);
    kit.mesh(new THREE.CylinderGeometry(r, r * 1.02, 0.34, 28), wood, group, 0, 0.98, 0);
    kit.mesh(new THREE.TorusGeometry(r, 0.05, 6, 28), red, group, 0, 1.16, 0).rotation.x = Math.PI / 2;
    kit.mesh(new THREE.TorusGeometry(r * 1.01, 0.04, 6, 28), red, group, 0, 0.82, 0).rotation.x = Math.PI / 2;
    const skin = kit.basic('#ffffff', { map: tex });
    skin.transparent = false;
    const face = kit.mesh(new THREE.CircleGeometry(r * 0.98, 32), skin, group, 0, 1.17, 0);
    face.rotation.x = -Math.PI / 2;
    face.rotation.z = id === 'slingL' ? 0.4 : -0.4;
    face.castShadow = false;
    kit.api.group.add(group);
    out.push({ group, skin, rt });
  }
  return out;
}

// ───────── 鳥居 ─────────

function buildTorii(kit: Kit): { group: T.Group; plaque: T.MeshToonMaterial } {
  const THREE = kit.THREE;
  const group = new THREE.Group();
  mine(group);
  const red = kit.toon('#d23d24');
  const blk = kit.toon(INK);
  const span = TORII.right[0] - TORII.left[0];
  const H = 2.5;
  group.position.set(TORII.center[0], 0, -TORII.center[1]);
  for (const s of [-1, 1]) {
    kit.mesh(new THREE.CylinderGeometry(0.21, 0.26, H, 16), red, group, (s * span) / 2, H / 2, 0);
    kit.mesh(new THREE.CylinderGeometry(0.33, 0.37, 0.34, 16), blk, group, (s * span) / 2, 0.17, 0);
  }
  // 貫（ぬき）
  kit.mesh(new THREE.BoxGeometry(span + 1.0, 0.2, 0.22), red, group, 0, H * 0.7, 0);
  // 島木（しまぎ）
  kit.mesh(new THREE.BoxGeometry(span + 1.5, 0.22, 0.34), red, group, 0, H - 0.1, 0);
  // 笠木（かさぎ）：両端がそり上がる
  const half = (span + 1.5) / 2;
  const sh = new THREE.Shape();
  const bot = (x: number) => 0.34 * Math.pow(Math.abs(x) / half, 2.6);
  const top = (x: number) => 0.2 + 0.36 * Math.pow(Math.abs(x) / half, 2.6);
  const n = 14;
  sh.moveTo(-half, bot(-half));
  for (let i = 1; i <= n; i++) {
    const x = -half + (2 * half * i) / n;
    sh.lineTo(x, bot(x));
  }
  sh.lineTo(half, top(half));
  for (let i = n - 1; i >= 0; i--) {
    const x = -half + (2 * half * i) / n;
    sh.lineTo(x, top(x));
  }
  sh.closePath();
  const kasagi = new THREE.ExtrudeGeometry(sh, { depth: 0.42, bevelEnabled: false });
  kasagi.translate(0, 0, -0.21);
  kit.mesh(kasagi, blk, group, 0, H + 0.04, 0);
  // 額（がく）
  const tex = kit.api.canvasTexture(128, 128, (g) => {
    g.fillStyle = '#17110c';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#e0b238';
    g.lineWidth = 8;
    g.strokeRect(6, 6, 116, 116);
    g.fillStyle = '#e8c14a';
    g.font = `900 78px ${BRUSH_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('福', 64, 70);
  });
  const plaque = kit.toon('#ffffff', { map: tex, emissive: '#ffcf4a', ei: 0.0 });
  kit.mesh(new THREE.BoxGeometry(0.75, 0.85, 0.12), plaque, group, 0, H * 0.7 + 0.62, 0.0);
  kit.bake(group);
  kit.api.group.add(group);
  return { group, plaque };
}

// ───────── 社殿の屋根としめ縄 ─────────

function buildShrine(kit: Kit): { bell: T.Group; shide: T.Mesh[] } {
  const THREE = kit.THREE;
  const group = new THREE.Group();
  mine(group);
  group.position.set(SHRINE[0], 0, -SHRINE[1] - 0.3);
  // 瓦（かわら）：軒から棟へ走る筋と、隅棟の濃い線
  const tileTex = kit.api.canvasTexture(256, 64, (g) => {
    g.fillStyle = '#62759a';
    g.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 256; i += 8) {
      g.fillStyle = (i / 8) % 2 ? '#7d90b4' : '#566a90';
      g.fillRect(i, 0, 4, 64);
    }
    for (let i = 0; i < 4; i++) {
      g.fillStyle = '#26324f';
      g.fillRect(i * 64 - 3, 0, 7, 64);
    }
    g.fillStyle = '#26324f';
    g.fillRect(0, 56, 256, 8);
  });
  const tile = kit.toon('#ffffff', { map: tileTex });
  const red = kit.toon('#d23d24');
  const gold = kit.toon('#e0b238');
  const paper = kit.toon('#fffaf0');
  const rope = kit.toon('#e6d6a0');
  // 屋根（四方の屋根）
  const roof = kit.mesh(new THREE.ConeGeometry(1.5, 0.68, 4), tile, group, 0, 2.5, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.78);
  kit.mesh(new THREE.BoxGeometry(2.3, 0.1, 1.2), red, group, 0, 2.14, 0);
  kit.mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.36, 8), gold, group, 0, 3.05, 0);
  // しめ縄（ゆるく垂れた縄）
  const curvePts = [-1.15, -0.6, 0, 0.6, 1.15].map((x, i) => new THREE.Vector3(x, 1.92 - Math.sin((i / 4) * Math.PI) * 0.34, 0.74));
  const curve = new THREE.CatmullRomCurve3(curvePts);
  kit.mesh(new THREE.TubeGeometry(curve, 24, 0.075, 8), rope, group);
  // 紙垂（しで）
  const shide: T.Mesh[] = [];
  for (const x of [-0.85, -0.3, 0.3, 0.85]) {
    const pt = curve.getPointAt((x + 1.15) / 2.3);
    const m = kit.mesh(new THREE.BoxGeometry(0.18, 0.44, 0.02), paper, group, pt.x, pt.y - 0.3, pt.z);
    m.userData.keep = true;
    shide.push(m);
  }
  // 鈴
  const bell = new THREE.Group();
  bell.position.set(0, 1.9, 0.6);
  kit.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 6), gold, bell, 0, 0.2, 0);
  kit.mesh(new THREE.SphereGeometry(0.22, 14, 10), gold, bell, 0, -0.1, 0);
  bell.children.forEach((c) => (c.userData.keep = true));
  group.add(bell);
  kit.bake(group);
  kit.api.group.add(group);
  return { bell, shide };
}

// ───────── 七福神の立て札 ─────────

interface Standee {
  id: string;
  group: T.Group;
  card: T.Mesh;
  mat: T.MeshBasicMaterial;
  halo: T.Mesh;
  haloMat: T.MeshBasicMaterial;
  rt: TargetRT;
  w: number;
  tint: number;
}

function buildStandees(kit: Kit, game: Game): Standee[] {
  const THREE = kit.THREE;
  const out: Standee[] = [];
  const wood = kit.toon('#7b3f1d');
  GODS.forEach((god, i) => {
    const rt = game.table.get<TargetRT>(god.id);
    const tex = kit.api.canvasTexture(CARD_W, CARD_H, (g) => drawGodCard(g, god, i + 1));
    const w = god.big ? 1.95 : 1.3;
    const h = (w * CARD_H) / CARD_W;
    const group = new THREE.Group();
    mine(group);
    group.position.set(god.at[0], 0, -god.at[1]);
    // 台座（的の面に沿う）
    const base = kit.mesh(new THREE.BoxGeometry(god.big ? 2.0 : 0.95, 0.22, 0.36), wood, group, 0, 0.11, 0);
    base.rotation.y = ((god.angle + 90) * Math.PI) / 180;
    const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide });
    mat.userData.outlineParameters = { visible: false };
    const card = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    card.position.set(0, h / 2 + 0.2, 0);
    card.rotation.x = -0.3;
    group.add(card);
    // 後光（集めたとき）
    const haloMat = new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.0, depthWrite: false });
    haloMat.userData.outlineParameters = { visible: false };
    const halo = new THREE.Mesh(new THREE.CircleGeometry(w * 0.78, 28), haloMat);
    halo.position.set(0, h * 0.55 + 0.2, -0.06);
    halo.rotation.x = -0.3;
    group.add(halo);
    kit.api.group.add(group);
    out.push({ id: god.id, group, card, mat, halo, haloMat, rt, w, tint: 0.6 });
  });
  return out;
}

// ───────── 暖簾（鳥居の一方通行の戸）─────────

const NOREN = { a: [2.05, 18.65] as [number, number], b: [0.55, 17.95] as [number, number], mid: [1.3, 18.3] as [number, number] };

function buildNoren(kit: Kit, game: Game): { flap: T.Mesh; rt: GateRT } {
  const THREE = kit.THREE;
  const rt = game.table.get<GateRT>('toriiGate');
  const len = Math.hypot(NOREN.b[0] - NOREN.a[0], NOREN.b[1] - NOREN.a[1]);
  const group = new THREE.Group();
  mine(group);
  group.position.set(NOREN.mid[0], 0, -NOREN.mid[1]);
  group.rotation.y = Math.atan2(NOREN.b[1] - NOREN.a[1], NOREN.b[0] - NOREN.a[0]);
  kit.mesh(new THREE.CylinderGeometry(0.05, 0.05, len + 0.1, 8), kit.toon('#c9a15a'), group, 0, 0.98, 0).rotation.z = Math.PI / 2;
  const tex = kit.api.canvasTexture(256, 128, (g) => {
    g.fillStyle = '#1f3f7a';
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#f7ead0';
    g.beginPath();
    g.arc(128, 62, 40, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1f3f7a';
    g.font = `900 58px ${BRUSH_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('福', 128, 66);
    // 切れ込み（暖簾の割れ目）と裾
    g.fillStyle = '#0d234f';
    for (const x of [85, 171]) g.fillRect(x - 2, 0, 4, 128);
    g.fillStyle = '#f7ead0';
    g.fillRect(0, 118, 256, 10);
  });
  const geo = new THREE.PlaneGeometry(len * 0.96, 0.82);
  geo.translate(0, -0.41, 0);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  mat.userData.outlineParameters = { visible: false };
  const flap = new THREE.Mesh(geo, mat);
  flap.position.set(0, 0.98, 0);
  group.add(flap);
  kit.api.group.add(group);
  return { flap, rt };
}

/** 台の上の飾りをまとめて作り、毎フレームの動きを登録する */
export function buildProps(kit: Kit, game: Game): { toriiPulse(): void; shrineShake(): void } {
  const lanterns = buildLanterns(kit, game);
  const drums = buildDrums(kit, game);
  const torii = buildTorii(kit);
  const shrine = buildShrine(kit);
  const standees = buildStandees(kit, game);
  const noren = buildNoren(kit, game);
  let hidden = false;
  let toriiK = 0;
  let shrineK = 0;

  kit.api.onFrame((t, dt) => {
    if (!hidden) {
      hidden = true;
      hideDefaults(kit, game);
    }
    // 提灯
    for (const l of lanterns) {
      const k = Math.max(0, 1 - l.rt.hitAge / 0.2);
      l.group.position.set(l.rt.x, 0, -l.rt.y);
      l.group.rotation.z = Math.sin(t * 1.3 + l.phase) * 0.035 + Math.sin(t * 40) * 0.05 * k;
      l.group.scale.set(1 + k * 0.12, 1 - k * 0.2, 1 + k * 0.12);
      l.mat.emissiveIntensity = 0.3 + Math.sin(t * 3 + l.phase) * 0.08 + k * 1.4;
    }
    // 太鼓：打たれると皮がへこむ
    for (const d of drums) {
      const k = Math.max(0, 1 - d.rt.hitAge / 0.16);
      d.group.scale.set(1 + k * 0.09, 1 - k * 0.14, 1 + k * 0.09);
      d.skin.color.setScalar(1 + k * 0.5);
    }
    // 暖簾：ボールが通るとめくれる
    noren.flap.rotation.x = -noren.rt.open * 1.2 + Math.sin(t * 1.8) * 0.03;
    // 鳥居の額
    toriiK = Math.max(0, toriiK - dt * 1.6);
    torii.plaque.emissiveIntensity = toriiK * 1.6;
    // 社殿の鈴と紙垂
    shrineK = Math.max(0, shrineK - dt * 0.9);
    shrine.bell.rotation.z = Math.sin(t * 14) * 0.5 * shrineK;
    shrine.shide.forEach((m, i) => {
      m.rotation.z = Math.sin(t * 1.6 + i) * 0.1 + Math.sin(t * 12 + i) * 0.25 * shrineK;
    });
    // 七福神：集めたら色づき、後光がさす。当たるとぐらっと揺れる
    for (const s of standees) {
      const st = game.table.light(s.id)?.state ?? 'off';
      const got = st !== 'off';
      const want = got ? 1 : 0.58;
      s.tint += (want - s.tint) * Math.min(1, dt * 6);
      s.mat.color.setRGB(s.tint, s.tint, s.tint * (got ? 1 : 1.12));
      const k = Math.max(0, 1 - s.rt.hitAge / 0.35);
      s.card.rotation.z = Math.sin(s.rt.hitAge * 38) * 0.16 * k;
      s.card.scale.setScalar(1 + k * 0.14);
      const target = got ? (st === 'fast' ? 0.55 + 0.35 * Math.sin(t * 12) : 0.55) : 0;
      s.haloMat.opacity += (target - s.haloMat.opacity) * Math.min(1, dt * 8);
      s.halo.visible = s.haloMat.opacity > 0.01;
      s.halo.scale.setScalar(1 + Math.sin(t * 3 + s.w) * 0.04);
    }
  });

  return {
    toriiPulse: () => (toriiK = 1),
    shrineShake: () => (shrineK = 1),
  };
}
