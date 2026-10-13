// 台のまわりの景色：奥の屏風、台を横切る大波
import type * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { paintBackboard } from './backboard';
import { rng } from './art';
import type { Kit } from './kit';

// ───────── 奥の屏風（6面の折りたたみ）─────────

export function buildScreen(kit: Kit): void {
  const THREE = kit.THREE;
  const PANELS = 6;
  const W = 21.4;
  const H = 7.6;
  const tex = kit.api.canvasTexture(1536, 480, (g) => {
    paintBackboard(g, 1536, 480);
  });
  const pw = W / PANELS;
  const group = new THREE.Group();
  const lacquer = kit.toon('#17110c', { noOutline: true });
  for (let i = 0; i < PANELS; i++) {
    const geo = new THREE.PlaneGeometry(pw, H);
    // 1面ぶんの絵の範囲（隙間なくつながる）
    const uv = geo.getAttribute('uv') as T.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / PANELS);
    const mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
    mat.userData.outlineParameters = { visible: false };
    const m = new THREE.Mesh(geo, mat);
    // ジグザグに折る
    const dir = i % 2 === 0 ? 1 : -1;
    m.rotation.y = dir * 0.32;
    m.position.set(-W / 2 + pw * (i + 0.5) * 0.96, H / 2, 0);
    group.add(m);
    // 縁（黒漆の柱）
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, H + 0.2, 0.1), lacquer);
    post.position.set(-W / 2 + pw * i * 0.96 + (i === 0 ? 0 : 0.0), H / 2, 0);
    group.add(post);
  }
  group.position.copy(kit.api.at(0.75, 42.6, 0.4));
  group.rotation.x = -0.22;
  kit.api.group.add(group);
}

// ───────── 大波（台を左から右へ横切る）─────────

export function buildWave(kit: Kit): { start(): void; update(t: number, dt: number): void } {
  const THREE = kit.THREE;
  const group = new THREE.Group();
  // 波の断面（x が進む向き、y が高さ）。奥から手前（プレイヤーのほう）へ巻き込みながら進む
  const inner = new THREE.Group();
  inner.rotation.y = -Math.PI / 2;
  group.add(inner);
  const sh = new THREE.Shape();
  sh.moveTo(-0.5, 0);
  sh.bezierCurveTo(0.3, 0.5, 1.3, 2.3, 2.7, 4.0);
  sh.bezierCurveTo(3.5, 5.3, 5.3, 5.6, 6.3, 3.9);
  sh.bezierCurveTo(6.0, 3.2, 5.2, 2.6, 4.3, 3.0);
  sh.bezierCurveTo(3.3, 3.5, 3.4, 1.4, 4.4, 0);
  sh.closePath();
  const WIDTH = 27;
  const geo = new THREE.ExtrudeGeometry(sh, { depth: WIDTH, bevelEnabled: false, curveSegments: 14 });
  geo.translate(0, 0, -WIDTH / 2);
  // 頂点の色：背は藍、頂は白い泡、巻き込みの内側（手前を向く面）は明るい青（ぼかし摺り）
  {
    const posA = geo.getAttribute('position');
    const norA = geo.getAttribute('normal');
    const cols = new Float32Array(posA.count * 3);
    const deepC = new THREE.Color('#0d2a66'), midC = new THREE.Color('#1f4f9c'), faceC = new THREE.Color('#3a78c4'), foamC = new THREE.Color('#f6f1e0');
    const c = new THREE.Color();
    for (let i = 0; i < posA.count; i++) {
      const x = posA.getX(i), y = posA.getY(i), nx = norA.getX(i), ny = norA.getY(i);
      c.copy(deepC).lerp(midC, Math.min(1, Math.max(0, y / 4.2)) * 0.8);
      if (ny < -0.05 || (nx > 0.35 && y < 4.2)) c.copy(faceC).lerp(midC, Math.max(0, y - 2) / 4);
      else if (ny > 0.2 && y > 3.3 && x > 4.9) c.copy(foamC);
      else if (ny > 0.3 && y > 3.3 && x > 2.3) c.copy(midC).lerp(foamC, Math.min(1, (x - 2.3) / 3) * 0.3);
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  }
  const waveMat = kit.toon('#ffffff');
  waveMat.vertexColors = true;
  kit.mesh(geo, waveMat, inner);
  // 泡の爪としぶき（頂から先端まで、横方向に並べる）
  const r = rng(11);
  const crest = (tt: number): [number, number] => {
    const u = 1 - tt;
    const x = u * u * u * 2.7 + 3 * u * u * tt * 3.5 + 3 * u * tt * tt * 5.3 + tt * tt * tt * 6.3;
    const y = u * u * u * 4.0 + 3 * u * u * tt * 5.3 + 3 * u * tt * tt * 5.6 + tt * tt * tt * 3.9;
    return [x, y];
  };
  const bits: T.BufferGeometry[] = [];
  for (let z = -WIDTH / 2 + 0.5; z < WIDTH / 2 - 0.2; z += 1.5) {
    for (let k = 0; k < 5; k++) {
      const [cx, cy] = crest(k / 4);
      const s = 0.2 + r() * 0.2;
      const c = new THREE.ConeGeometry(s, 0.6 + r() * 0.45, 5);
      c.rotateZ(-0.9 - (k / 4) * 1.3);
      c.translate(cx + 0.1, cy - 0.12, z + (r() - 0.5) * 0.5);
      bits.push(c.index ? c.toNonIndexed() : c);
      if (r() < 0.3) {
        const b = new THREE.SphereGeometry(0.1 + r() * 0.14, 6, 5);
        b.translate(cx + 0.3 + r() * 0.6, cy + 0.3 + r() * 0.6, z + (r() - 0.5) * 0.8);
        bits.push(b.toNonIndexed());
      }
    }
  }
  for (const g of bits) for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
  inner.add(new THREE.Mesh(mergeGeometries(bits, false)!, kit.toon('#f7f3e4')));
  // 波の根もと（白い泡の帯）
  kit.mesh(new THREE.BoxGeometry(5.4, 0.3, WIDTH), kit.toon('#f1efe4'), inner, 2.0, 0.14, 0);
  group.visible = false;
  group.scale.setScalar(1.15);
  kit.api.group.add(group);

  let age = -1;
  const DURATION = 3.0;
  // y=50（奥）から y=-9（手前の外）へ
  const Z0 = -50, Z1 = 9;
  return {
    start() {
      age = 0;
    },
    update(t, dt) {
      if (age < 0) return;
      age += dt;
      const u = age / DURATION;
      if (u >= 1) {
        age = -1;
        group.visible = false;
        return;
      }
      group.visible = true;
      const e = u * u * (3 - 2 * u);
      group.position.set(0.75, -0.3 + Math.sin(t * 5) * 0.1, Z0 + (Z1 - Z0) * e);
    },
  };
}
