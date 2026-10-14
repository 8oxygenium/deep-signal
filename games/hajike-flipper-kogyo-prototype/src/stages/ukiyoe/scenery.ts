// 台のまわりの景色：金箔の屏風。奥に 6 面、左右に「袖」の 2 面ずつ（コの字に台を囲む）。
// 奥の屏風はプレイ中の固定カメラでは上部の表示（木札・得点）に隠れるので、袖を前へ張り出して左右から見えるようにしてある。
import type * as T from 'three';
import { paintBackboard, paintWing } from './backboard';
import type { Kit } from './kit';

const H = 8.4;

/** 折りたたみの屏風。n 面、1 面の幅 pw。zig: 隣の面との折れ角（絵は左から右へ n 等分） */
function fold(kit: Kit, tex: T.Texture, n: number, pw: number, zig: number): T.Group {
  const THREE = kit.THREE;
  const group = new THREE.Group();
  const lacquer = kit.toon('#17110c', { noOutline: true });
  const half = Math.cos(zig);
  const total = n * pw * half;
  for (let i = 0; i < n; i++) {
    const geo = new THREE.PlaneGeometry(pw, H);
    const uv = geo.getAttribute('uv') as T.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / n);
    const mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
    mat.userData.outlineParameters = { visible: false };
    const m = new THREE.Mesh(geo, mat);
    const dir = i % 2 === 0 ? 1 : -1;
    m.rotation.y = dir * zig;
    m.position.set(-total / 2 + pw * half * (i + 0.5), H / 2, 0);
    group.add(m);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, H + 0.2, 0.1), lacquer);
    post.position.set(-total / 2 + pw * half * i, H / 2, 0);
    group.add(post);
  }
  const last = new THREE.Mesh(new THREE.BoxGeometry(0.1, H + 0.2, 0.1), lacquer);
  last.position.set(total / 2, H / 2, 0);
  group.add(last);
  return group;
}

export function buildScreen(kit: Kit): void {
  // 奥：6 面
  const backTex = kit.api.canvasTexture(1536, 480, (g) => paintBackboard(g, 1536, 480));
  const back = fold(kit, backTex, 6, 4.7, 0.3);
  back.position.copy(kit.api.at(0.75, 43.0, 0.4));
  back.rotation.x = -0.2;
  kit.api.group.add(back);

  // 左右の袖：台の両わきで、手前（カメラ）のほうへ向けて開く
  for (const side of [-1, 1] as const) {
    const tex = kit.api.canvasTexture(512, 480, (g) => paintWing(g, 512, 480, side));
    const wing = fold(kit, tex, 2, 4.9, 0.28);
    // 面の向きは台の中心とカメラの間を向く（左の袖は +x 側へ、右の袖は -x 側へ）
    wing.rotation.y = -side * 0.82;
    wing.position.set(0.75 + side * 17.2, 0, -33.5);
    kit.api.group.add(wing);
  }
}
