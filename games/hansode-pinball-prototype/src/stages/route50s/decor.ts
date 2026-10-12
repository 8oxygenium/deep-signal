// ROUTE 50s 専用の3D：ジュークボックス（当てると光って揺れる）、バンパーのクロームの輪、
// アーチと側壁をぐるっと走る電球のチェイサー、ネオンの「NOW PLAYING」電光板。
import type * as THREE_NS from 'three';
import type { DecorateApi } from '../types';
import { JUKE } from './layout';

const MENU_TEXT: Record<string, string> = { burger: 'BURGER', shake: 'SHAKE', fries: 'FRIES' };

export function decorate(api: DecorateApi): void {
  const { THREE, group, game } = api;
  const low = api.quality === 'low';
  const chrome = api.metal();

  // ───────── ジュークボックス ─────────
  const jb = new THREE.Group();
  const nx = Math.cos((JUKE.angle * Math.PI) / 180), ny = Math.sin((JUKE.angle * Math.PI) / 180);
  // 的（光る板）の後ろに立てる。+z が正面
  const back = 0.95;
  jb.position.copy(api.at(JUKE.at[0] - nx * back, JUKE.at[1] - ny * back, 0));
  jb.rotation.y = Math.atan2(nx, -ny);
  group.add(jb);

  const archShape = (wd: number, straight: number, inset = 0) => {
    const s = new THREE.Shape();
    const hw = wd / 2 - inset;
    s.moveTo(-hw, 0);
    s.lineTo(hw, 0);
    s.lineTo(hw, straight);
    s.absarc(0, straight, hw, 0, Math.PI, false);
    s.lineTo(-hw, 0);
    return s;
  };
  const wood = new THREE.MeshStandardMaterial({ color: '#7a3a1a', roughness: 0.45, metalness: 0.05 });
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(archShape(2.7, 2.1), { depth: 1.1, bevelEnabled: false, curveSegments: 20 }), wood);
  body.position.z = -0.55;
  jb.add(body);
  // 窓（アーチ形に光る）
  const winMat = new THREE.MeshStandardMaterial({ color: '#2a1608', emissive: '#ffb347', emissiveIntensity: 0.9, roughness: 0.4 });
  const win = new THREE.Mesh(new THREE.ExtrudeGeometry(archShape(2.7, 2.1, 0.32), { depth: 0.04, bevelEnabled: false, curveSegments: 20 }), winMat);
  win.position.set(0, 0.35, 0.56);
  win.scale.y = 0.93;
  jb.add(win);
  // 窓の中のレコード
  const record = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 36), new THREE.MeshStandardMaterial({ color: '#0b0b0e', roughness: 0.3, metalness: 0.4 }));
  disc.rotation.x = Math.PI / 2;
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 24), new THREE.MeshStandardMaterial({ color: '#ff3b4a', emissive: '#ff3b4a', emissiveIntensity: 0.6 }));
  label.rotation.x = Math.PI / 2;
  record.add(disc, label);
  for (let i = 0; i < 3; i++) {
    const groove = new THREE.Mesh(new THREE.TorusGeometry(0.34 + i * 0.1, 0.008, 6, 40), new THREE.MeshBasicMaterial({ color: '#3a3a44' }));
    groove.position.z = 0.03;
    record.add(groove);
  }
  record.position.set(0, 2.0, 0.6);
  jb.add(record);
  // クロームの縁
  const frameShape = archShape(2.8, 2.15, 0);
  const hole = archShape(2.8, 2.15, 0.2);
  frameShape.holes.push(new THREE.Path(hole.getPoints(24)));
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, { depth: 0.12, bevelEnabled: false, curveSegments: 20 }), chrome);
  frame.position.set(0, 0.33, 0.52);
  jb.add(frame);
  // 左右の「泡の管」：色が流れる
  const tubes: THREE_NS.MeshStandardMaterial[] = [];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const m = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ff3b4a', emissiveIntensity: 1.2 });
      tubes.push(m);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.55 - i * 0.2, 8), m);
      tube.position.set(sx * (1.07 - i * 0.14), 1.6, 0.6);
      jb.add(tube);
    }
  }
  // 上の看板
  const crest = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 0.5),
    new THREE.MeshBasicMaterial({
      map: api.canvasTexture(256, 68, (g) => {
        g.fillStyle = '#1a0c06';
        g.fillRect(0, 0, 256, 68);
        g.strokeStyle = '#ffd23f';
        g.lineWidth = 5;
        g.strokeRect(5, 5, 246, 58);
        g.fillStyle = '#ffd23f';
        g.font = '900 40px "Arial Black", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('JUKEBOX', 128, 36);
      }),
    }),
  );
  crest.position.set(0, 3.35, 0.56);
  jb.add(crest);
  // 足もとのスピーカー格子
  const grille = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 0.35),
    new THREE.MeshBasicMaterial({
      map: api.canvasTexture(128, 32, (g) => {
        g.fillStyle = '#2a1a10';
        g.fillRect(0, 0, 128, 32);
        g.strokeStyle = '#c9a15a';
        g.lineWidth = 2;
        for (let x = 4; x < 128; x += 8) {
          g.beginPath();
          g.moveTo(x, 2);
          g.lineTo(x, 30);
          g.stroke();
        }
      }),
    }),
  );
  grille.position.set(0, 0.2, 0.56);
  jb.add(grille);

  let juke = 0;
  const jukeBase = jb.position.clone();

  // ───────── バンパーのクロームの輪 ─────────
  const bumpers = game.table.layout.parts.filter((p) => p.kind === 'bumper');
  const ringMats = new Map<string, THREE_NS.MeshStandardMaterial>();
  for (const p of bumpers) {
    if (p.kind !== 'bumper') continue;
    const r = p.r ?? 0.95;
    const guard = new THREE.Mesh(new THREE.TorusGeometry(r * 1.3, 0.07, 8, 36), chrome);
    guard.rotation.x = -Math.PI / 2;
    guard.position.copy(api.at(p.at[0], p.at[1], 0.12));
    group.add(guard);
    const glowMat = api.glow('#ff3b4a');
    ringMats.set(p.id, glowMat);
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(r * 1.3, 0.03, 6, 36), glowMat);
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.copy(api.at(p.at[0], p.at[1], 0.2));
    group.add(glowRing);
  }
  const bumperPulse = new Map<string, number>();

  // ───────── 電球のチェイサー（アーチと側壁）─────────
  type Bulb = { x: number; y: number };
  const bulbs: Bulb[] = [];
  for (let a = 0; a <= 180; a += 5.6) {
    const r = (a * Math.PI) / 180;
    bulbs.push({ x: 0.75 + Math.cos(r) * 9.45, y: 30.5 + Math.sin(r) * 9.45 });
  }
  const arcCount = bulbs.length;
  for (let y = 29.4; y > 1.6; y -= 1.05) bulbs.push({ x: -8.7, y });
  for (let y = 26.4; y > 1.6; y -= 1.05) bulbs.push({ x: 8.7, y });
  const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }), bulbs.length);
  const m4 = new THREE.Matrix4();
  bulbs.forEach((b, i) => {
    m4.makeTranslation(b.x, 1.62, -b.y);
    bulbMesh.setMatrixAt(i, m4);
    bulbMesh.setColorAt(i, new THREE.Color('#442200'));
  });
  bulbMesh.instanceMatrix.needsUpdate = true;
  group.add(bulbMesh);
  const lit = new THREE.Color(3.2, 2.5, 1.0);
  const dim = new THREE.Color(0.32, 0.24, 0.1);
  const hot = new THREE.Color(3.2, 0.9, 0.9);
  let party = 0;

  // ───────── 手前の電光板「NOW PLAYING」─────────
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 512;
  boardCanvas.height = 96;
  const bg2 = boardCanvas.getContext('2d')!;
  const boardTex = new THREE.CanvasTexture(boardCanvas);
  boardTex.colorSpace = THREE.SRGBColorSpace;
  const drawBoard = (song: string, extra = '') => {
    bg2.fillStyle = '#140a06';
    bg2.fillRect(0, 0, 512, 96);
    bg2.strokeStyle = '#ffb347';
    bg2.lineWidth = 5;
    bg2.strokeRect(4, 4, 504, 88);
    bg2.textAlign = 'center';
    bg2.textBaseline = 'middle';
    bg2.fillStyle = '#ff7a3a';
    bg2.font = '700 22px "Segoe UI", sans-serif';
    bg2.fillText(extra || '♪ NOW PLAYING ♪', 256, 26);
    bg2.fillStyle = '#ffd98a';
    bg2.shadowColor = '#ffb347';
    bg2.shadowBlur = 10;
    bg2.font = '900 36px "Arial Black", "Segoe UI", sans-serif';
    bg2.fillText(song, 256, 63);
    bg2.shadowBlur = 0;
    boardTex.needsUpdate = true;
  };
  const songs = game.stage.music.songs;
  drawBoard(songs[0]?.name ?? '');
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 0.98),
    new THREE.MeshStandardMaterial({ map: boardTex, emissive: '#ffffff', emissiveMap: boardTex, emissiveIntensity: 1.2 }),
  );
  board.position.copy(api.at(0.75, 37.2, 1.7));
  board.rotation.x = -0.3;
  group.add(board);

  // ───────── イベント ─────────
  game.on((e) => {
    if (e.t === 'table') {
      const te = e.e;
      if (te.type === 'standup' && te.id === 'juke') juke = 1;
      if (te.type === 'bumper') bumperPulse.set(te.id, 1);
      if (te.type === 'standup' && MENU_TEXT[te.id]) drawBoard(MENU_TEXT[te.id], '♪ ORDER ♪');
    } else if (e.t === 'song') {
      drawBoard(songs[((e.index % songs.length) + songs.length) % songs.length]?.name ?? '');
      juke = 1.4;
    } else if (e.t === 'jackpot' || e.t === 'multiball' || e.t === 'extraball') {
      party = 3;
    } else if (e.t === 'mission') {
      party = 1.5;
    }
  });

  let slowT = 0;
  api.onFrame((t, dt) => {
    juke = Math.max(0, juke - dt * 1.8);
    party = Math.max(0, party - dt);
    // ジュークボックス：普段はゆっくり色が流れ、当たると光って揺れる
    record.rotation.z = -t * (1.2 + juke * 10);
    winMat.emissiveIntensity = 0.75 + 0.15 * Math.sin(t * 2) + juke * 2.2;
    tubes.forEach((m, i) => {
      m.emissive.setHSL((t * 0.12 + i * 0.17 + juke * 0.3) % 1, 0.95, 0.55);
      m.emissiveIntensity = 1.1 + juke * 2;
    });
    jb.position.set(jukeBase.x + Math.sin(t * 60) * 0.05 * juke, jukeBase.y, jukeBase.z);
    jb.rotation.z = Math.sin(t * 45) * 0.03 * juke;
    // バンパーの輪
    for (const [id, m] of ringMats) {
      const k = Math.max(0, (bumperPulse.get(id) ?? 0) - dt * 4);
      bumperPulse.set(id, k);
      m.emissiveIntensity = 0.5 + 0.2 * Math.sin(t * 3) + k * 4;
    }
    // 電球：3つに1つが走る。マルチボールや大きな得点のときは速く赤く
    slowT += dt * (party > 0 ? 18 : 7);
    const phase = Math.floor(slowT);
    for (let i = 0; i < bulbs.length; i++) {
      const on = (((i - phase) % 3) + 3) % 3 === 0;
      const c = on ? (party > 0 && i % 2 === 0 ? hot : lit) : dim;
      bulbMesh.setColorAt(i, c);
    }
    if (bulbMesh.instanceColor) bulbMesh.instanceColor.needsUpdate = true;
  });
  void low;
  void arcCount;
}
