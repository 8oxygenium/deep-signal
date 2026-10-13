// 2本のランプの飾り：鯉の滝（水の流れ＋のぼる鯉）と、龍が巻きつくランプ（胴体のらせん・頭・ひげ・たてがみ）
import type * as T from 'three';
import type { Game } from '../../core/game';
import { rng } from './art';
import type { Kit } from './kit';
import { KOI, RYU } from './layout';
import { INK } from './palette';

type P = [number, number];

export interface RampSample {
  x: number;
  y: number;
  h: number;
  s: number;
  tx: number;
  ty: number;
}

/** ランプの中心線を細かく刻む（高さは TableView と同じく区間ごとに直線補間） */
export function sampleRamp(path: P[], h: number[], ds = 0.25): RampSample[] {
  const out: RampSample[] = [];
  let s = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / ds));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, h: h[i - 1] + (h[i] - h[i - 1]) * t, s: s + len * t, tx: 0, ty: 0 });
    }
    s += len;
  }
  const last = path[path.length - 1];
  out.push({ x: last[0], y: last[1], h: h[h.length - 1], s, tx: 0, ty: 0 });
  for (let i = 0; i < out.length; i++) {
    const p = out[Math.max(0, i - 2)], q = out[Math.min(out.length - 1, i + 2)];
    const dx = q.x - p.x, dy = q.y - p.y;
    const l = Math.hypot(dx, dy) || 1;
    out[i].tx = dx / l;
    out[i].ty = dy / l;
  }
  return out;
}

/** 距離 s の位置（線形補間） */
export function locate(samples: RampSample[], s: number): RampSample {
  const n = samples.length;
  if (s <= 0) return samples[0];
  if (s >= samples[n - 1].s) return samples[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].s <= s) lo = mid;
    else hi = mid;
  }
  const a = samples[lo], b = samples[hi];
  const t = (s - a.s) / Math.max(1e-6, b.s - a.s);
  const tx = a.tx + (b.tx - a.tx) * t, ty = a.ty + (b.ty - a.ty) * t;
  const l = Math.hypot(tx, ty) || 1;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, h: a.h + (b.h - a.h) * t, s, tx: tx / l, ty: ty / l };
}

// ───────── 水の流れ ─────────

function waterRibbon(kit: Kit, samples: RampSample[], halfW: number, colors: { c1: string; c2: string; white: string }): { mesh: T.Mesh; mat: T.ShaderMaterial } {
  const THREE = kit.THREE;
  const pos: number[] = [];
  const uv: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  samples.forEach((p, i) => {
    const nx = -p.ty, ny = p.tx;
    const hh = p.h + 0.05;
    pos.push(p.x + nx * halfW, hh, -(p.y + ny * halfW), p.x - nx * halfW, hh, -(p.y - ny * halfW));
    uv.push(0, p.s / 2, 1, p.s / 2);
    nor.push(0, 1, 0, 0, 1, 0);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      c1: { value: new THREE.Color(colors.c1) },
      c2: { value: new THREE.Color(colors.c2) },
      white: { value: new THREE.Color(colors.white) },
      glow: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float time; uniform vec3 c1; uniform vec3 c2; uniform vec3 white; uniform float glow; varying vec2 vUv;
      void main(){
        float x = vUv.x; float v = vUv.y;
        float flow = v * 1.1 + time * 1.5;
        float wob = sin(x * 15.0 + sin(v * 2.6 + time) * 1.8) * 0.5 + 0.5;
        float streak = smoothstep(0.66, 0.84, fract(flow + wob * 0.4 + sin(x * 5.0) * 0.1));
        float streak2 = smoothstep(0.8, 0.92, fract(flow * 0.6 + x * 0.35 + wob * 0.2));
        vec3 col = mix(c1, c2, wob * 0.85);
        col = mix(col, white, max(streak * 0.85, streak2 * 0.65));
        float edge = smoothstep(0.74, 1.0, abs(x * 2.0 - 1.0));
        col = mix(col, white, edge * 0.9);
        col += glow * vec3(0.5, 0.4, 0.1);
        gl_FragColor = vec4(col, 0.95);
      }`,
    transparent: true,
    depthWrite: true,
  });
  mat.userData.outlineParameters = { visible: false };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, mat };
}

// ───────── 鯉 ─────────

function koiTexture(kit: Kit, kind: 'kohaku' | 'ogon', seed: number): T.CanvasTexture {
  return kit.api.canvasTexture(256, 128, (g) => {
    const r = rng(seed);
    if (kind === 'ogon') {
      g.fillStyle = '#e9b83c';
      g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#f3d36a';
      for (let i = 0; i < 9; i++) {
        g.beginPath();
        g.ellipse(r() * 256, r() * 128, 14 + r() * 22, 8 + r() * 12, r() * 3, 0, Math.PI * 2);
        g.fill();
      }
      return;
    }
    g.fillStyle = '#f6f0e0';
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#e24a28';
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.ellipse(r() * 256, 12 + r() * 62, 22 + r() * 30, 10 + r() * 14, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#1b120a';
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.ellipse(r() * 256, 10 + r() * 50, 4 + r() * 8, 3 + r() * 5, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
}

interface Koi {
  group: T.Group;
  tail: T.Group;
  finL: T.Mesh;
  finR: T.Mesh;
  s: number;
  speed: number;
  phase: number;
  wait: number;
  offset: number;
}

function makeKoi(kit: Kit, kind: 'kohaku' | 'ogon', seed: number): Koi {
  const THREE = kit.THREE;
  const group = new THREE.Group();
  group.rotation.order = 'YZX';
  const bodyMat = kit.toon('#ffffff', { map: koiTexture(kit, kind, seed) });
  const finMat = kit.toon(kind === 'kohaku' ? '#f2a08a' : '#f0c862', { side: THREE.DoubleSide });
  const dark = kit.toon(INK);
  const body = kit.mesh(new THREE.SphereGeometry(0.5, 18, 12), bodyMat, group, 0, 0.3, 0);
  body.scale.set(1.2, 0.46, 0.5);
  const head = kit.mesh(new THREE.SphereGeometry(0.5, 14, 10), bodyMat, group, 0.58, 0.3, 0);
  head.scale.set(0.5, 0.4, 0.42);
  for (const s of [-1, 1]) kit.mesh(new THREE.SphereGeometry(0.06, 8, 6), dark, group, 0.74, 0.42, s * 0.17);
  // 尾びれ（水平に広がる扇）
  const tail = new THREE.Group();
  tail.position.set(-0.55, 0.3, 0);
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.quadraticCurveTo(-0.3, 0.12, -0.78, 0.55);
  sh.quadraticCurveTo(-0.62, 0.18, -0.52, 0);
  sh.quadraticCurveTo(-0.62, -0.18, -0.78, -0.55);
  sh.quadraticCurveTo(-0.3, -0.12, 0, 0);
  const tf = new THREE.Mesh(new THREE.ShapeGeometry(sh), finMat);
  tf.rotation.x = -Math.PI / 2;
  tail.add(tf);
  group.add(tail);
  // 胸びれ
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.quadraticCurveTo(-0.15, 0.1, -0.42, 0.34);
  finShape.quadraticCurveTo(-0.12, 0.0, 0, -0.08);
  const mkFin = (s: number) => {
    const f = new THREE.Mesh(new THREE.ShapeGeometry(finShape), finMat);
    f.rotation.x = -Math.PI / 2;
    f.scale.set(1, s, 1);
    f.position.set(0.28, 0.24, s * 0.2);
    group.add(f);
    return f;
  };
  const finL = mkFin(1);
  const finR = mkFin(-1);
  // 背びれ
  const dorsal = kit.mesh(new THREE.ConeGeometry(0.16, 0.34, 6), finMat, group, -0.05, 0.62, 0);
  dorsal.rotation.z = Math.PI / 2 + 0.3;
  tail.children.forEach((c) => (c.userData.keep = true));
  kit.bake(group);
  return { group, tail, finL, finR, s: 0, speed: 1.4, phase: seed, wait: 0, offset: 0 };
}

export function buildKoiRamp(kit: Kit): { update(t: number, dt: number): void; rush(): void } {
  const samples = sampleRamp(KOI.path, KOI.h);
  const total = samples[samples.length - 1].s;
  const water = waterRibbon(kit, samples, KOI.w / 2 + 0.05, { c1: '#4f9bd0', c2: '#86c4ec', white: '#f4fbff' });
  kit.api.group.add(water.mesh);
  const kois = [makeKoi(kit, 'kohaku', 3), makeKoi(kit, 'ogon', 8)];
  kois[0].s = 1.0;
  kois[0].speed = 1.5;
  kois[1].s = total * 0.55;
  kois[1].speed = 1.2;
  kois[1].group.scale.setScalar(0.88);
  for (const k of kois) kit.api.group.add(k.group);
  let rushT = 0;

  return {
    rush: () => {
      rushT = 1.7;
    },
    update(t, dt) {
      water.mat.uniforms.time.value = t;
      rushT = Math.max(0, rushT - dt);
      water.mat.uniforms.glow.value = rushT > 0 ? Math.min(1, rushT) * 0.35 : 0;
      kois.forEach((k, i) => {
        if (k.wait > 0) {
          k.wait -= dt;
          k.group.visible = false;
          if (k.wait <= 0) {
            k.s = 0;
            k.group.visible = true;
          }
          return;
        }
        const boost = rushT > 0 ? (i === 0 ? 9.5 : 7.5) : k.speed;
        k.s += boost * dt;
        if (k.s >= total) {
          k.wait = rushT > 0 ? 0.4 : 2.0 + i * 1.8;
          k.group.visible = false;
          return;
        }
        const p = locate(samples, k.s);
        const sway = Math.sin(t * 2.2 + k.phase) * 0.28;
        const nx = -p.ty, ny = p.tx;
        k.group.position.set(p.x + nx * sway, p.h + 0.04, -(p.y + ny * sway));
        const wig = Math.sin(t * (rushT > 0 ? 16 : 7) + k.phase);
        k.group.rotation.y = Math.atan2(p.ty + ny * Math.cos(t * 2.2 + k.phase) * 0.12, p.tx + nx * Math.cos(t * 2.2 + k.phase) * 0.12) + wig * 0.1;
        const q = locate(samples, Math.min(total, k.s + 0.5));
        k.group.rotation.z = Math.atan2(q.h - p.h, 0.5);
        k.tail.rotation.y = wig * 0.55;
        k.finL.rotation.z = Math.sin(t * 6 + k.phase) * 0.35;
        k.finR.rotation.z = -Math.sin(t * 6 + k.phase) * 0.35;
      });
    },
  };
}

// ───────── 龍 ─────────

export function buildDragon(kit: Kit, game: Game): { update(t: number, dt: number): void; rush(): void } {
  const THREE = kit.THREE;
  const samples = sampleRamp(RYU.path, RYU.h, 0.2);
  const total = samples[samples.length - 1].s;
  const water = waterRibbon(kit, samples, RYU.w / 2 + 0.05, { c1: '#3f9a86', c2: '#7fd0b8', white: '#f1fff8' });
  kit.api.group.add(water.mesh);

  // ── 胴（らせんの管）──
  const N = Math.ceil(total / 0.1);
  const SEG = 10;
  const verts = (N + 1) * (SEG + 1);
  const pos = new Float32Array(verts * 3);
  const nor = new Float32Array(verts * 3);
  const uv = new Float32Array(verts * 2);
  const idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= SEG; j++) {
      const v = i * (SEG + 1) + j;
      uv[v * 2] = (i * total) / N / 1.6;
      uv[v * 2 + 1] = j / SEG;
      if (i < N && j < SEG) {
        const a = v, b = v + 1, c = v + SEG + 1, d = v + SEG + 2;
        idx.push(a, b, c, b, d, c);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const scales = kit.api.canvasTexture(128, 64, (g) => {
    // 縦（v）は胴の一周：真ん中（v=0.5）が腹（巻きの内側）、その両側がうろこの背
    g.fillStyle = '#2f9a63';
    g.fillRect(0, 0, 128, 64);
    g.strokeStyle = '#17583a';
    g.lineWidth = 3;
    for (let row = 0; row < 5; row++) {
      for (let c = -1; c < 5; c++) {
        const cx = c * 32 + (row % 2) * 16;
        g.beginPath();
        g.arc(cx, row * 14 - 6, 16, 0.1, Math.PI - 0.1);
        g.stroke();
      }
    }
    g.fillStyle = '#f0cf6a';
    g.fillRect(0, 21, 128, 22);
    g.strokeStyle = '#b8892f';
    g.lineWidth = 2;
    for (let c = 0; c < 8; c++) {
      g.beginPath();
      g.moveTo(c * 16, 21);
      g.lineTo(c * 16, 43);
      g.stroke();
    }
  });
  scales.wrapS = THREE.RepeatWrapping;
  scales.wrapT = THREE.RepeatWrapping;
  const bodyMat = kit.toon('#ffffff', { map: scales, side: THREE.DoubleSide });
  const body = new THREE.Mesh(geo, bodyMat);
  body.frustumCulled = false;
  body.castShadow = !kit.low;
  kit.api.group.add(body);

  // ── 背のとげ ──
  const SPIKES = 38;
  const spikeMat = kit.toon('#e8a23a');
  const spikes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.1, 0.34, 6), spikeMat, SPIKES);
  spikes.frustumCulled = false;
  kit.api.group.add(spikes);

  // ── 頭 ──
  const head = new THREE.Group();
  head.rotation.order = 'YZX';
  const green = kit.toon('#2f9a63');
  const dgreen = kit.toon('#1d6b44');
  const gold = kit.toon('#e8b83c');
  const red = kit.toon('#d23d24');
  const white = kit.toon('#fffaf0');
  const dark = kit.toon(INK);
  const eyeMat = kit.toon('#ffefd0', { emissive: '#ff3a18', ei: 0.6 });
  const skull = kit.mesh(new THREE.SphereGeometry(0.5, 16, 12), green, head);
  skull.scale.set(1.0, 0.82, 0.85);
  const snout = kit.mesh(new THREE.BoxGeometry(0.78, 0.26, 0.46), green, head, 0.62, -0.06, 0);
  kit.mesh(new THREE.BoxGeometry(0.6, 0.12, 0.38), dgreen, head, 0.56, -0.28, 0).rotation.z = -0.22;
  kit.mesh(new THREE.SphereGeometry(0.1, 8, 6), gold, head, 1.0, 0.02, 0.12);
  kit.mesh(new THREE.SphereGeometry(0.1, 8, 6), gold, head, 1.0, 0.02, -0.12);
  for (const s of [-1, 1]) {
    // 目
    kit.mesh(new THREE.SphereGeometry(0.15, 10, 8), eyeMat, head, 0.28, 0.18, s * 0.34);
    kit.mesh(new THREE.SphereGeometry(0.06, 8, 6), dark, head, 0.37, 0.19, s * 0.4);
    // まゆ
    const brow = kit.mesh(new THREE.BoxGeometry(0.42, 0.08, 0.1), dgreen, head, 0.34, 0.38, s * 0.32);
    brow.rotation.y = s * -0.3;
    brow.rotation.z = -0.25;
    // 角
    const horn = kit.mesh(new THREE.ConeGeometry(0.1, 0.62, 8), kit.toon('#e9d3a0'), head, -0.18, 0.58, s * 0.24);
    horn.rotation.z = 1.9;
    horn.rotation.x = s * 0.25;
    // 牙
    const fang = kit.mesh(new THREE.ConeGeometry(0.05, 0.2, 6), white, head, 0.86, -0.18, s * 0.17);
    fang.rotation.z = Math.PI;
  }
  kit.mesh(new THREE.BoxGeometry(0.5, 0.04, 0.22), red, head, 0.58, -0.22, 0);
  // たてがみ
  for (let i = 0; i < 7; i++) {
    const a = -0.4 + i * 0.3;
    const m = kit.mesh(new THREE.ConeGeometry(0.1, 0.5, 6), kit.toon(i % 2 ? '#e8742a' : '#e8a23a'), head, -0.38 - Math.cos(a) * 0.1, 0.25 + Math.sin(a) * 0.55, 0);
    m.rotation.z = 1.4 + a * 0.6;
  }
  // ひげ（金色の長い筋）
  const whiskers: { geo: T.TubeGeometry; mesh: T.Mesh }[] = [];
  for (const s of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0.9, -0.08, s * 0.14), new THREE.Vector3(0.6, -0.2, s * 0.7), new THREE.Vector3(0.0, -0.3, s * 1.1), new THREE.Vector3(-0.8, -0.1, s * 1.0)]);
    const geo2 = new THREE.TubeGeometry(c, 16, 0.025, 5);
    const mesh = kit.mesh(geo2, gold, head);
    whiskers.push({ geo: geo2, mesh });
  }
  void snout;
  head.userData.keep = true;
  kit.api.group.add(head);

  // 宝珠（ほうじゅ）：龍が追う光る玉
  const pearl = kit.mesh(new THREE.SphereGeometry(0.26, 14, 10), kit.toon('#fff3b0', { emissive: '#ffcf4a', ei: 0.9 }), kit.api.group);
  const pearlRing = kit.mesh(new THREE.TorusGeometry(0.4, 0.035, 6, 20), kit.toon('#e8b83c', { emissive: '#e8b83c', ei: 0.6 }), kit.api.group);

  // ── 毎フレームの形 ──
  const R_X = 1.2, R_Y = 0.92, LIFT = 0.74, PITCH = 3.3;
  const cen: T.Vector3[] = Array.from({ length: N + 1 }, () => new THREE.Vector3());
  const radial = new THREE.Vector3();
  const pts: T.Vector3[] = Array.from({ length: N + 1 }, () => new THREE.Vector3());
  const dummy = new THREE.Object3D();
  const tmp = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const bin = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const out = new THREE.Vector3();
  let spin = 0;
  let rushT = 0;
  const up = new THREE.Vector3(0, 1, 0);

  const radius = (s: number) => 0.06 + 0.22 * Math.min(1, Math.pow(s / 5.5, 0.75)) + (s > total - 1.6 ? 0.02 : 0);

  function shape(t: number): void {
    for (let i = 0; i <= N; i++) {
      const s = (i * total) / N;
      const p = locate(samples, s);
      const th = (s / PITCH) * Math.PI * 2 - spin;
      const nx = -p.ty, ny = p.tx;
      const cx = Math.cos(th) * R_X, cy = Math.sin(th) * R_Y;
      // 先に行くほど（頭に近いほど）胴が浮き上がる
      const rise = Math.pow(s / total, 3) * 0.55;
      pts[i].set(p.x + nx * cx, p.h + LIFT + cy + rise + Math.sin(t * 2 + s * 0.8) * 0.04, -(p.y + ny * cx));
      cen[i].set(p.x, p.h + LIFT + rise, -p.y);
    }
    let spike = 0;
    for (let i = 0; i <= N; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)];
      tan.subVectors(b, a).normalize();
      // 巻きの外側を背に、内側（ランプ側）を腹にする
      radial.subVectors(pts[i], cen[i]);
      nrm.copy(radial).addScaledVector(tan, -radial.dot(tan));
      if (nrm.lengthSq() < 1e-6) nrm.set(0, 1, 0).addScaledVector(tan, -tan.y);
      nrm.normalize();
      bin.crossVectors(tan, nrm).normalize();
      const r = radius((i * total) / N);
      for (let j = 0; j <= SEG; j++) {
        const ang = (j / SEG) * Math.PI * 2;
        out.set(0, 0, 0).addScaledVector(nrm, Math.cos(ang)).addScaledVector(bin, Math.sin(ang));
        const v = (i * (SEG + 1) + j) * 3;
        pos[v] = pts[i].x + out.x * r;
        pos[v + 1] = pts[i].y + out.y * r;
        pos[v + 2] = pts[i].z + out.z * r;
        nor[v] = out.x;
        nor[v + 1] = out.y;
        nor[v + 2] = out.z;
      }
      // 背のとげ：外側（巻きの外）に向ける
      if (i % 4 === 2 && spike < SPIKES && i > 12 && i < N - 6) {
        const s = (i * total) / N;
        const p = locate(samples, s);
        const th = (s / PITCH) * Math.PI * 2 - spin;
        const nx = -p.ty, ny = p.tx;
        tmp.set(nx * Math.cos(th) * R_X, Math.sin(th) * R_Y, -ny * Math.cos(th) * R_X).normalize();
        dummy.position.copy(pts[i]).addScaledVector(tmp, r * 0.9);
        dummy.quaternion.setFromUnitVectors(up, tmp);
        dummy.scale.setScalar(0.6 + r * 1.6);
        dummy.updateMatrix();
        spikes.setMatrixAt(spike++, dummy.matrix);
      }
    }
    spikes.count = spike;
    spikes.instanceMatrix.needsUpdate = true;
    geo.getAttribute('position').needsUpdate = true;
    geo.getAttribute('normal').needsUpdate = true;
  }

  return {
    rush: () => {
      rushT = 1.8;
    },
    update(t, dt) {
      water.mat.uniforms.time.value = t;
      rushT = Math.max(0, rushT - dt);
      const hot = game.multiballActive || rushT > 0;
      spin += dt * (hot ? 3.2 : 0.9);
      water.mat.uniforms.glow.value = rushT > 0 ? Math.min(1, rushT) * 0.35 : 0;
      shape(t);
      // 頭：胴の先に付ける
      const end = pts[N];
      const prev = pts[N - 3];
      tan.subVectors(end, prev).normalize();
      head.position.copy(end).addScaledVector(tan, 0.3);
      head.position.y += 0.15;
      head.rotation.y = Math.atan2(-tan.z, tan.x) + Math.sin(t * 1.4) * 0.12;
      head.rotation.z = Math.asin(Math.max(-1, Math.min(1, tan.y))) - 0.12;
      eyeMat.emissiveIntensity = hot ? 1.4 + Math.sin(t * 14) * 0.5 : 0.6 + Math.sin(t * 2) * 0.12;
      whiskers.forEach((w, i) => {
        w.mesh.rotation.y = Math.sin(t * 2.2 + i * 2) * 0.12;
        w.mesh.rotation.z = Math.sin(t * 1.7 + i) * 0.1;
      });
      // 宝珠は頭の前（ランプの出口のほう）でゆらぐ
      pearl.position.copy(head.position).addScaledVector(tan, 1.7);
      pearl.position.y += 0.1 + Math.sin(t * 2.4) * 0.12;
      pearlRing.position.copy(pearl.position);
      pearlRing.rotation.set(Math.PI / 2 + Math.sin(t) * 0.4, t * 1.5, 0);
    },
  };
}
