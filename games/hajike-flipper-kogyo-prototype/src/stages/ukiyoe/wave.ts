// 大波マルチボールの波：北斎の「神奈川沖浪裏」を 2D で描いたカード（キャンバス）を、カメラのほうを向く板（Sprite）に貼り、
// 大きさの違う 3 枚を時間差で左から右へ走らせる。固定・追従・真上のどのカメラでも、画面に正対した「絵」として見える。
// 進み方は game.time の差で決める（ポーズ中は止まる）。しぶき（白い粒）は波頭から飛ばす。
import type * as T from 'three';
import type { Game } from '../../core/game';
import { fibres, greatWave, rng, waveCrestPoint, WAVE_WIDTH, type G } from './art';
import type { Kit } from './kit';
import { INK } from './palette';

interface Spec {
  /** 世界の幅（高さはカードの縦横比から決まる） */
  w: number;
  /** カードの絵の大きさ（キャンバスのピクセル幅） */
  px: number;
  /** 波のふもとの台の y */
  base: number;
  /** 出てくるまでの遅れ（秒） */
  delay: number;
  /** 渡りきるまでの時間（秒） */
  dur: number;
  seed: number;
}

const SPECS: Spec[] = [
  { w: 32, px: 1792, base: 21, delay: 0, dur: 3.6, seed: 2 },
  { w: 26, px: 1536, base: 10, delay: 0.4, dur: 3.3, seed: 6 },
  { w: 20, px: 1280, base: -1.5, delay: 0.8, dur: 3.0, seed: 11 },
];
/** カードの縦横比（高さ／幅） */
const ASPECT = 0.57;

/** 波のカードを描く：右端に大波、左は寄せてくる波（藍の海と青海波、白い泡の縁どり）。左端と下端はぼかして消す */
function paintCard(g: G, W: number, H: number, seed: number): { s: number; x0: number; yb: number } {
  const s = (H * 0.84) / 7.1;
  const yb = H * 0.84;
  const x0 = W - (WAVE_WIDTH + 0.1) * s;
  const r = rng(seed);
  g.clearRect(0, 0, W, H);

  // 大波（海は台の地面の青海波なので、波だけを描く）
  greatWave(g, x0, yb, s, { seed });

  // ふもとの白い泡の裾：波に近いほど厚く、左へ尾を引いて細くなる（波の前に重ねて、ふもとの線を隠す）
  {
    const endX = x0 + (WAVE_WIDTH - 0.5) * s;
    g.save();
    g.lineJoin = 'round';
    g.fillStyle = '#f7f3e4';
    g.strokeStyle = INK;
    g.lineWidth = Math.max(2, s * 0.045);
    // 裾は波の手前半分だけ（長く伸ばすとロープの航跡のように見えるため）
    const startX = Math.max(0.1 * s, endX * 0.5);
    const k = (x: number) => Math.pow(Math.max(0, Math.min(1, (x - startX) / (endX - startX))), 1.4);
    const xs: number[] = [];
    for (let x = startX; x < endX; x += s * (0.38 + r() * 0.36)) xs.push(x);
    xs.push(endX);
    g.beginPath();
    g.moveTo(xs[0], yb);
    // 上の縁：小さなふくらみが続く
    for (let i = 1; i < xs.length; i++) {
      const m = (xs[i - 1] + xs[i]) / 2;
      g.quadraticCurveTo(m, yb - s * (0.1 + 0.3 * k(m)) * (0.7 + 0.6 * r()), xs[i], yb - 0.02 * s);
    }
    // 右の端：丸く閉じて、下の縁を左へ戻る
    g.quadraticCurveTo(endX + s * 0.3, yb + 0.15 * s, endX - 0.1 * s, yb + s * (0.2 + 0.3 * k(endX)));
    for (let i = xs.length - 2; i >= 0; i--) {
      const m = (xs[i] + xs[i + 1]) / 2;
      const th = s * (0.14 + 0.38 * k(xs[i]));
      g.quadraticCurveTo(m, yb + th + s * (0.14 + 0.2 * k(m)) * (0.7 + 0.6 * r()), xs[i], yb + th * 0.8);
    }
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }

  // 和紙の繊維を少し
  g.save();
  g.globalCompositeOperation = 'source-atop';
  fibres(g, W, H, Math.round((W * H) / 2600), seed + 3, 0.08);
  g.restore();

  // 左端と下端をぼかして消す（板の縁が見えないように）
  g.save();
  g.globalCompositeOperation = 'destination-out';
  const lg = g.createLinearGradient(0, 0, W * 0.2, 0);
  lg.addColorStop(0, 'rgba(0,0,0,1)');
  lg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = lg;
  g.fillRect(0, 0, W * 0.2, H);
  const bg = g.createLinearGradient(0, H * 0.9, 0, H);
  bg.addColorStop(0, 'rgba(0,0,0,0)');
  bg.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = bg;
  g.fillRect(0, H * 0.9, W, H * 0.1);
  g.restore();
  return { s, x0, yb };
}

interface Card {
  sprite: T.Sprite;
  spec: Spec;
  h: number;
  s: number;
  x0: number;
  yb: number;
  W: number;
  H: number;
  /** このカードの波頭の世界位置を求める用 */
  active: boolean;
  sprayAcc: number;
}

export function buildWave(kit: Kit, game: Game): { start(): void; update(): void } {
  const THREE = kit.THREE;
  const cards: Card[] = [];
  const group = new THREE.Group();
  kit.api.group.add(group);

  SPECS.forEach((spec, i) => {
    const W = spec.px;
    const H = Math.round(W * ASPECT);
    let info = { s: 0, x0: 0, yb: 0 };
    const tex = kit.api.canvasTexture(W, H, (g) => {
      info = paintCard(g, W, H, spec.seed);
    });
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.center.set(0.5, 0);
    sprite.scale.set(spec.w, spec.w * ASPECT, 1);
    sprite.renderOrder = 40 + i;
    sprite.visible = false;
    group.add(sprite);
    cards.push({ sprite, spec, h: spec.w * ASPECT, s: info.s, x0: info.x0, yb: info.yb, W, H, active: false, sprayAcc: 0 });
  });

  // ── しぶき（白い粒）──
  const dropTex = kit.api.canvasTexture(64, 64, (g) => {
    g.fillStyle = '#fbf8ee';
    g.beginPath();
    g.arc(32, 32, 24, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.stroke();
  });
  const dropMat = new THREE.SpriteMaterial({ map: dropTex, transparent: true, depthTest: false, depthWrite: false });
  const DROPS = 130;
  interface Drop {
    sprite: T.Sprite;
    life: number;
    max: number;
    size: number;
    vr: number;
    vu: number;
  }
  const drops: Drop[] = [];
  for (let i = 0; i < DROPS; i++) {
    const sprite = new THREE.Sprite(dropMat);
    sprite.visible = false;
    sprite.renderOrder = 44;
    group.add(sprite);
    drops.push({ sprite, life: 0, max: 1, size: 0.4, vr: 0, vu: 0 });
  }
  let dropNext = 0;

  // カメラの右・上（台の座標系に直したもの）。描画のたびに更新される
  const right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3(0, 0.82, -0.57);
  const inv = new THREE.Matrix4();
  const tmp = new THREE.Vector3();
  cards[0].sprite.onBeforeRender = (_r, _s, cam) => {
    inv.copy(kit.api.group.matrixWorld).invert();
    right.setFromMatrixColumn(cam.matrixWorld, 0).transformDirection(inv);
    up.setFromMatrixColumn(cam.matrixWorld, 1).transformDirection(inv);
  };

  let t0 = -1;
  let lastGT = game.time;
  const rand = rng(77);
  const base = kit.api.at(0.75, 0, 3.2);
  const END = Math.max(...SPECS.map((s) => s.delay + s.dur));

  const wavePos = (c: Card, k: number): number => {
    // 左の外から右の外へ。最初と最後はゆっくり（ぐっと出てきて、ざぶんと過ぎる）
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const mix = k * 0.7 + e * 0.3;
    const x0 = 0.75 - 34 - c.spec.w * 0.5;
    const x1 = 0.75 + 34 + c.spec.w * 0.5;
    return x0 + (x1 - x0) * mix;
  };

  return {
    start() {
      t0 = game.time;
      for (const c of cards) c.active = true;
    },
    update() {
      // しぶきも含め、進みはすべてゲームの時間で決める（ポーズ中は止まる）
      const dt = Math.max(0, Math.min(0.1, game.time - lastGT));
      lastGT = game.time;
      if (t0 >= 0) {
        const now = game.time - t0;
        for (const c of cards) {
          const k = (now - c.spec.delay) / c.spec.dur;
          if (!c.active || k < 0 || k > 1) {
            c.sprite.visible = false;
            if (k > 1) c.active = false;
            continue;
          }
          c.sprite.visible = true;
          const x = wavePos(c, k);
          c.sprite.position.set(x, base.y + Math.sin(now * 5 + c.spec.seed) * 0.1, -c.spec.base);
          c.sprite.material.rotation = Math.sin(now * 3 + c.spec.seed) * 0.012;
          // しぶき：波頭から、進む向きと上へ
          const speed = ((68 + c.spec.w) / c.spec.dur) * 0.9;
          c.sprayAcc += dt * (now > 0 ? 38 : 0);
          while (c.sprayAcc >= 1) {
            c.sprayAcc -= 1;
            const d = drops[dropNext];
            dropNext = (dropNext + 1) % DROPS;
            const [lx, ly] = waveCrestPoint(0.15 + rand() * 0.85);
            const fx = (c.x0 + lx * c.s) / c.W;
            const fy = (c.yb - ly * c.s) / c.H;
            tmp.copy(c.sprite.position).addScaledVector(right, (fx - 0.5) * c.spec.w).addScaledVector(up, (1 - fy) * c.h);
            d.sprite.position.copy(tmp);
            d.vr = speed * (0.55 + rand() * 0.5);
            d.vu = 3 + rand() * 9;
            d.size = (0.28 + rand() * 0.5) * (c.spec.w / 26);
            d.max = d.life = 0.7 + rand() * 0.7;
            d.sprite.visible = true;
          }
        }
        if (now > END + 1.6) t0 = -1;
      }
      for (const d of drops) {
        if (d.life <= 0) {
          d.sprite.visible = false;
          continue;
        }
        d.life -= dt;
        d.vu -= 22 * dt;
        d.sprite.position.addScaledVector(right, d.vr * dt).addScaledVector(up, d.vu * dt);
        const k = Math.max(0, d.life / d.max);
        d.sprite.scale.setScalar(d.size * Math.min(1, k * 3));
      }
    },
  };
}
