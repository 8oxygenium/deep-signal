// COMIC 専用の3D装飾：立体の悪役ボス（揺れる・赤く光る・やられ顔）、盾、手下の顔、吹き出し、頭上のHPバー
import type * as T from 'three';
import type { TargetRT } from '../../table/table';
import type { DecorateApi } from '../types';
import { bossLook, SAYINGS } from './boss';
import { BOSS_AT } from './layout';

const DROPS = ['hl1', 'hl2', 'hl3', 'hr1', 'hr2', 'hr3'];

export function decorateComic(api: DecorateApi): void {
  const { THREE, group, game } = api;
  const low = api.quality === 'low';

  // トゥーン（段付きの陰影）素材
  const gradData = new Uint8Array([85, 85, 85, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  const gradient = new THREE.DataTexture(gradData, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  const toon = (color: string) => new THREE.MeshToonMaterial({ color, gradientMap: gradient });
  const noOutline = (o: T.Object3D) => {
    o.userData.outlineParameters = { visible: false };
  };
  const shadow = (m: T.Mesh) => {
    m.castShadow = !low;
    return m;
  };

  // ───────── ボスの体 ─────────
  const look0 = bossLook(0);
  const mSkin = toon(look0.skin);
  const mCoat = toon(look0.coat);
  const mCoat2 = toon(look0.coat);
  const mHat = toon(look0.hat);
  const mEyeWhite = toon('#ffffff');
  const mDark = toon('#15131f');
  const mTeeth = toon('#ffffff');
  const mEye = new THREE.MeshStandardMaterial({ color: '#111', emissive: look0.eye, emissiveIntensity: 1.6 });
  const bodyMats = [mSkin, mCoat, mCoat2, mHat];
  const baseColors = bodyMats.map((m) => m.color.clone());
  const gray = new THREE.Color('#9a9aa8');

  const rig = new THREE.Group();
  rig.position.copy(api.at(BOSS_AT[0], BOSS_AT[1], 0));
  group.add(rig);
  const body = new THREE.Group();
  rig.add(body);

  const box = (w: number, h: number, d: number, mat: T.Material, x: number, y: number, z: number) => {
    const m = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
    m.position.set(x, y, z);
    return m;
  };
  const sph = (r: number, mat: T.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const m = shadow(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  };

  // マント（背中）
  const capeShape = new THREE.Shape();
  capeShape.moveTo(-2.5, 0);
  capeShape.lineTo(2.5, 0);
  capeShape.lineTo(1.7, 3.4);
  capeShape.lineTo(-1.7, 3.4);
  capeShape.closePath();
  const cape = shadow(new THREE.Mesh(new THREE.ExtrudeGeometry(capeShape, { depth: 0.12, bevelEnabled: false }), mCoat2));
  cape.position.set(0, 0, -1.05);
  body.add(cape);
  // 胴・肩
  body.add(box(3.0, 2.1, 0.9, mCoat, 0, 1.05, -0.78));
  body.add(box(3.7, 0.8, 1.0, mCoat, 0, 2.35, -0.7));
  body.add(sph(0.66, mCoat2, -1.85, 2.4, -0.7));
  body.add(sph(0.66, mCoat2, 1.85, 2.4, -0.7));
  // 腕とこぶし
  for (const s of [-1, 1]) {
    const arm = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.3, 10), mCoat));
    arm.position.set(s * 1.95, 1.65, -0.45);
    body.add(arm);
    body.add(sph(0.4, mSkin, s * 1.95, 0.98, -0.3));
  }
  // 胸の紋章（ドクロ）：的の板の正面に貼る
  const skullTex = api.canvasTexture(128, 128, (c) => {
    c.clearRect(0, 0, 128, 128);
    c.fillStyle = '#c4281f';
    c.beginPath();
    c.arc(64, 64, 60, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#15131f';
    c.lineWidth = 8;
    c.stroke();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(64, 56, 34, 32, 0, 0, Math.PI * 2);
    c.fill();
    c.fillRect(44, 70, 40, 28);
    c.fillStyle = '#15131f';
    c.beginPath();
    c.ellipse(50, 56, 9, 12, 0, 0, Math.PI * 2);
    c.ellipse(78, 56, 9, 12, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(64, 64);
    c.lineTo(59, 76);
    c.lineTo(69, 76);
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = '#15131f';
    for (const x of [54, 64, 74]) {
      c.beginPath();
      c.moveTo(x, 84);
      c.lineTo(x, 98);
      c.stroke();
    }
  });
  const emblem = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshBasicMaterial({ map: skullTex, transparent: true }));
  emblem.position.set(0, 0.78, 0.33);
  noOutline(emblem);
  rig.add(emblem);

  // 頭
  const head = new THREE.Group();
  head.position.set(0, 3.55, -0.3);
  body.add(head);
  head.add(sph(0.98, mSkin, 0, 0, 0));
  // 角（帽子）
  for (const s of [-1, 1]) {
    const horn = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.05, 10), mHat));
    horn.position.set(s * 0.72, 0.95, -0.05);
    horn.rotation.z = -s * 0.55;
    head.add(horn);
  }
  head.add(shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.0, 0.28, 18), mHat)).translateY(0.62).translateZ(-0.05));
  // 目：白目＋光る瞳
  const eyes = new THREE.Group();
  head.add(eyes);
  for (const s of [-1, 1]) {
    eyes.add(sph(0.3, mEyeWhite, s * 0.38, 0.12, 0.76, 1, 1.15, 0.55));
    eyes.add(sph(0.14, mEye, s * 0.36, 0.1, 0.99, 1, 1, 0.7));
    const brow = box(0.62, 0.15, 0.2, mDark, s * 0.4, 0.5, 0.86);
    brow.rotation.z = s * 0.5;
    eyes.add(brow);
  }
  // やられ目（バツ）
  const xEyes = new THREE.Group();
  xEyes.visible = false;
  head.add(xEyes);
  for (const s of [-1, 1]) {
    for (const r of [Math.PI / 4, -Math.PI / 4]) {
      const bar = box(0.62, 0.14, 0.14, mDark, s * 0.4, 0.12, 0.98);
      bar.rotation.z = r;
      xEyes.add(bar);
    }
  }
  // 鼻・口（にやり顔／やられ口）
  head.add(sph(0.16, mSkin, 0, -0.08, 0.98, 1, 1, 1));
  const grin = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.09, 8, 20, Math.PI), mDark);
  grin.position.set(0, -0.36, 0.78);
  grin.rotation.z = Math.PI;
  head.add(grin);
  for (const x of [-0.26, 0, 0.26]) head.add(box(0.14, 0.17, 0.08, mTeeth, x, -0.46, 0.92));
  const oMouth = sph(0.2, mDark, 0, -0.5, 0.9, 1, 1.2, 0.5);
  oMouth.visible = false;
  head.add(oMouth);

  // 目を回す星（やられたとき）
  const stars = new THREE.Group();
  stars.visible = false;
  body.add(stars);
  const starMat = new THREE.MeshStandardMaterial({ color: '#ffd21f', emissive: '#ffb000', emissiveIntensity: 1.2 });
  for (let i = 0; i < 4; i++) {
    const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), starMat);
    stars.add(st);
  }

  // ───────── 盾（左右の半ドーム）─────────
  const shieldMat = new THREE.MeshBasicMaterial({ color: '#35e0ff', transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
  const shieldLine = new THREE.MeshBasicMaterial({ color: '#bff6ff', wireframe: true, transparent: true, opacity: 0.55 });
  const domes: { grp: T.Group; fill: T.Mesh; wire: T.Mesh; k: number }[] = [];
  for (const s of [-1, 1]) {
    const geo = new THREE.SphereGeometry(2.75, 18, 12, s === 1 ? Math.PI / 2 : -Math.PI / 2, Math.PI, 0, Math.PI * 0.62);
    const fill = new THREE.Mesh(geo, shieldMat);
    const wire = new THREE.Mesh(geo, shieldLine);
    noOutline(fill);
    noOutline(wire);
    fill.renderOrder = 5;
    wire.renderOrder = 6;
    const grp = new THREE.Group();
    grp.position.set(0, 1.0, -0.4);
    grp.add(fill, wire);
    rig.add(grp);
    domes.push({ grp, fill, wire, k: 1 });
  }

  // ───────── 頭上のHPバー ─────────
  const barGroup = new THREE.Group();
  barGroup.position.set(0, 5.75, -0.3);
  barGroup.rotation.x = -0.99;
  rig.add(barGroup);
  const barFrame = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.5, 0.1), new THREE.MeshBasicMaterial({ color: '#15131f' }));
  const barBack = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.3), new THREE.MeshBasicMaterial({ color: '#5b1018' }));
  barBack.position.z = 0.06;
  const barFill = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.3), new THREE.MeshBasicMaterial({ color: '#ff3b30' }));
  barFill.position.z = 0.07;
  for (const o of [barFrame, barBack, barFill]) noOutline(o);
  barGroup.add(barFrame, barBack, barFill);

  // ───────── 吹き出し ─────────
  const bubbleTex = SAYINGS.map((text) =>
    api.canvasTexture(512, 256, (c) => {
      c.clearRect(0, 0, 512, 256);
      c.lineJoin = 'round';
      c.fillStyle = '#ffffff';
      c.strokeStyle = '#15131f';
      c.lineWidth = 12;
      c.beginPath();
      c.ellipse(256, 108, 236, 92, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(130, 178);
      c.lineTo(78, 244);
      c.lineTo(190, 192);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.ellipse(256, 108, 224, 80, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#15131f';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      let size = 86;
      c.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
      while (c.measureText(text).width > 410 && size > 30) {
        size -= 4;
        c.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
      }
      c.fillText(text, 256, 110);
    }),
  );
  const bubbleMat = new THREE.SpriteMaterial({ map: bubbleTex[0], transparent: true, depthTest: false, depthWrite: false });
  const bubble = new THREE.Sprite(bubbleMat);
  bubble.renderOrder = 60;
  bubble.visible = false;
  noOutline(bubble);
  bubble.position.set(2.7, 5.2, 0.4);
  rig.add(bubble);
  let bubbleT = 99;

  // ───────── 手下の顔（ドロップターゲットの上）─────────
  const goonSkin = toon('#ffb347');
  const goonMask = toon('#15131f');
  const goonCap = toon(look0.coat);
  const goons: { grp: T.Group; rt: TargetRT; base: T.Vector3 }[] = [];
  for (const id of DROPS) {
    const rt = game.table.get<TargetRT>(id);
    const [x, y] = rt.def.at;
    const a = (rt.def.angle * Math.PI) / 180;
    const nx = Math.cos(a), ny = Math.sin(a);
    const grp = new THREE.Group();
    const base = api.at(x - nx * 0.12, y - ny * 0.12, 1.4);
    grp.position.copy(base);
    // 顔はカメラ（手前）向き、少しだけ台の中央へ振り向く
    grp.rotation.y = nx > 0 ? 0.55 : -0.55;
    grp.add(sph(0.5, goonSkin, 0, 0, 0));
    // 目だし帽（黒いマスク）＋白い目＋ギザギザの口
    grp.add(box(0.9, 0.26, 0.5, goonMask, 0, 0.1, 0.22));
    for (const s of [-1, 1]) grp.add(sph(0.1, mEyeWhite, s * 0.19, 0.12, 0.47, 1, 1.3, 0.6));
    grp.add(box(0.36, 0.09, 0.2, mDark, 0, -0.24, 0.42));
    // 頭の上のバンド（ボスの色）
    const band = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.5, 0.2, 14), goonCap));
    band.position.set(0, 0.34, 0);
    grp.add(band);
    group.add(grp);
    goons.push({ grp, rt, base });
  }

  // ───────── 状態 ─────────
  let curLevel = 0;
  let popT = 1;
  let hit = 0;
  let lastHp = game.vars.bossHp ?? 1;
  let koT = 0;
  let lastSayN = game.vars.sayN ?? 0;
  const tmp = new THREE.Color();

  function applyLook(level: number): void {
    const l = bossLook(level);
    const cols = [l.skin, l.coat, l.coat, l.hat];
    bodyMats.forEach((m, i) => baseColors[i].set(cols[i]));
    mEye.emissive.set(l.eye);
    goonCap.color.set(l.coat);
  }

  game.on((e) => {
    if (e.t === 'table' && e.e.type === 'standup' && e.e.id === 'boss') hit = Math.max(hit, 0.7);
  });

  api.onFrame((t, dt) => {
    const v = game.vars;
    const level = v.bossLevel ?? 0;
    if (level !== curLevel) {
      curLevel = level;
      applyLook(level);
      popT = 0;
    }
    const hpNow = v.bossHp ?? 1;
    if (hpNow < lastHp - 1e-4) hit = 1;
    lastHp = hpNow;
    const ko = (v.bossKo ?? 0) === 1;
    koT += ((ko ? 1 : 0) - koT) * Math.min(1, dt * 5);
    hit = Math.max(0, hit - dt * 3.2);
    popT = Math.min(1, popT + dt * 1.6);

    // 登場（ポンと大きくなる）
    const c1 = 1.70158;
    const sc = Math.max(0.01, popT < 1 ? 1 + (c1 + 1) * Math.pow(popT - 1, 3) + c1 * Math.pow(popT - 1, 2) : 1);
    rig.scale.set(sc, sc, sc);

    // 体：呼吸、被弾でのけぞる・揺れる
    const breathe = Math.sin(t * 2.2) * 0.03;
    body.position.y = breathe - koT * 0.25;
    body.rotation.x = -hit * 0.18 - koT * 0.28;
    body.rotation.z = Math.sin(t * 38) * hit * 0.07 + Math.sin(t * 0.9) * 0.015;
    body.scale.set(1 + hit * 0.05, 1 - hit * 0.04 - koT * 0.08, 1);
    head.rotation.z = Math.sin(t * 1.3) * 0.05 + koT * 0.45 + Math.sin(t * 45) * hit * 0.12;
    head.rotation.x = koT * 0.25;
    eyes.visible = koT < 0.5;
    xEyes.visible = koT >= 0.5;
    const hurt = hit > 0.2 && koT < 0.5;
    oMouth.visible = hurt || koT >= 0.5;
    grin.visible = !oMouth.visible;
    mEye.emissiveIntensity = 1.4 + hit * 3.5 + Math.sin(t * 6) * 0.3;

    // 被弾で赤く光る・やられで灰色に
    bodyMats.forEach((m, i) => {
      tmp.copy(baseColors[i]).lerp(gray, koT * 0.6);
      m.color.copy(tmp);
      m.emissive.setRGB(hit * 0.85, hit * 0.1, hit * 0.05);
    });

    // 目を回す星
    stars.visible = koT > 0.5;
    if (stars.visible) {
      stars.children.forEach((c, i) => {
        const a = t * 3 + (i / stars.children.length) * Math.PI * 2;
        c.position.set(Math.cos(a) * 1.3, 4.95 + Math.sin(t * 5 + i) * 0.1, -0.3 + Math.sin(a) * 0.8);
        c.rotation.y = t * 4;
      });
    }

    // 盾：外れると膨らんで消える、復活するとすっと戻る
    const wantL = (v.shL ?? 1) > 0.5 && !ko;
    const wantR = (v.shR ?? 1) > 0.5 && !ko;
    domes.forEach((d, i) => {
      const want = i === 0 ? wantL : wantR;
      d.k += ((want ? 1 : 0) - d.k) * Math.min(1, dt * (want ? 4 : 9));
      const s = want ? 0.85 + 0.15 * d.k : 1 + (1 - d.k) * 0.6;
      d.grp.scale.setScalar(s);
      d.grp.visible = d.k > 0.03;
    });
    shieldMat.opacity = 0.2 + Math.sin(t * 3) * 0.04;
    shieldLine.opacity = 0.16 + 0.2 * Math.max(0, Math.sin(t * 2.4));

    // HPバー
    const frac = Math.max(0.001, Math.min(1, hpNow));
    barFill.scale.x = frac;
    barFill.position.x = -1.65 * (1 - frac);
    (barFill.material as T.MeshBasicMaterial).color.set(frac > 0.5 ? '#ff3b30' : frac > 0.25 ? '#ff8a1e' : '#ffd21f');
    barGroup.visible = !ko && popT > 0.5;

    // 吹き出し
    const sn = v.sayN ?? 0;
    if (sn !== lastSayN) {
      lastSayN = sn;
      const idx = Math.round(v.say ?? -1);
      if (idx >= 0 && idx < bubbleTex.length) {
        bubbleMat.map = bubbleTex[idx];
        bubbleMat.needsUpdate = true;
        bubbleT = 0;
      }
    }
    bubbleT += dt;
    bubble.visible = bubbleT < 1.5;
    if (bubble.visible) {
      const pop = bubbleT < 0.15 ? 0.3 + (bubbleT / 0.15) * 0.85 : 1.15 - Math.min(0.15, (bubbleT - 0.15) * 0.4);
      bubble.scale.set(3.9 * pop, 1.95 * pop, 1);
      bubbleMat.opacity = Math.min(1, (1.5 - bubbleT) * 3);
    }

    // 手下の顔：倒れたら引っ込む、当たるとぴょんと跳ねる
    for (const gn of goons) {
      const rt = gn.rt;
      gn.grp.visible = rt.sink < 0.55;
      const k = Math.max(0, 1 - rt.hitAge / 0.25);
      gn.grp.position.set(gn.base.x, gn.base.y - rt.sink * 1.4 + Math.sin(k * Math.PI) * 0.25, gn.base.z);
      gn.grp.rotation.z = Math.sin(t * 40) * k * 0.2;
    }
  });
}
