// ① MODERN ―「現代風」
// ガラスと白い金属、ミニマル。白〜淡い青の発光ライン。最初に遊ぶ人向けのやさしい台。
// ギミック：ランプ2本、ドロップターゲット、スピナー、3つのミッション → マルチボール → ジャックポット
//
// ★ 他のステージを作るときのお手本。1ステージ = 配置（layout）＋ ルール（rules）＋ 見た目（theme）＋ 音（music/sfx）。
import { LaneSet, Missions } from '../core/missions';
import type { Game } from '../core/game';
import { baseLayout, chassis } from '../table/chassis';
import type { PartDef } from '../table/types';
import type { PaintApi, StageDef } from './types';

const C = {
  bg: '#0d1626',
  floor: '#c9d5e2',
  floor2: '#dde6ef',
  wall: '#bfe6ff',
  guide: '#e9eef5',
  rubber: '#f4f8fb',
  flipper: '#ffffff',
  flipperRubber: '#47c2ff',
  bumper: '#f0f6fc',
  bumperCap: '#d8f2ff',
  sling: '#dff4ff',
  target: '#ffffff',
  ramp: '#c8ecff',
  accent: '#3fc4ff',
  accent2: '#9ef0ff',
  dmd: '#79e2ff',
  text: '#23415f',
};

// ───────── 配置 ─────────

/** ランプの大きなUターン（円弧を折れ線に） */
function uturn(cx: number, cy: number, r: number, from: number, to: number, n = 9): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}
const flat = (n: number, h: number) => Array.from({ length: n }, () => h);

function layoutParts(): PartDef[] {
  return [
    ...chassis({ kickbackLeft: true, outlanePosts: true }),

    // 上のレーン（L・U・X）
    { kind: 'wall', pts: [[-2.62, 32.0], [-2.62, 34.6]], style: 'guide' },
    { kind: 'wall', pts: [[-0.38, 32.3], [-0.38, 35.0]], style: 'guide' },
    { kind: 'wall', pts: [[1.88, 32.3], [1.88, 35.0]], style: 'guide' },
    { kind: 'wall', pts: [[4.12, 32.0], [4.12, 34.6]], style: 'guide' },
    { kind: 'rollover', id: 'laneL', at: [-1.5, 33.3] },
    { kind: 'rollover', id: 'laneU', at: [0.75, 33.6] },
    { kind: 'rollover', id: 'laneX', at: [3.0, 33.3] },
    { kind: 'light', id: 'laneL', at: [-1.5, 31.3], shape: 'circle', size: 0.42, color: '#3fc4ff', label: 'L' },
    { kind: 'light', id: 'laneU', at: [0.75, 31.5], shape: 'circle', size: 0.42, color: '#3fc4ff', label: 'U' },
    { kind: 'light', id: 'laneX', at: [3.0, 31.3], shape: 'circle', size: 0.42, color: '#3fc4ff', label: 'X' },

    // ポップバンパー
    { kind: 'bumper', id: 'b1', at: [-0.95, 28.2] },
    { kind: 'bumper', id: 'b2', at: [2.45, 28.4] },
    { kind: 'bumper', id: 'b3', at: [0.75, 25.6] },

    // 中央：ドロップターゲット3枚（ゆるいアーチ状。上に乗ったボールは左右へ転がり落ちる）
    { kind: 'drop', id: 'd1', bank: 'core', at: [-1.25, 19.2], angle: -84, w: 0.95 },
    { kind: 'drop', id: 'd2', bank: 'core', at: [-0.05, 19.4], angle: -88, w: 0.95 },
    { kind: 'drop', id: 'd3', bank: 'core', at: [1.15, 19.2], angle: -96, w: 0.95 },
    // 奥の CORE スクープ（真ん中の的の上に乗ったボールも吸い込む大きさ）
    { kind: 'scoop', id: 'core', at: [-0.05, 20.55], eject: 100, speed: 30, hold: 1.0, r: 0.72 },

    // 右：スタンドアップターゲット2枚（右オービットの壁に埋め込み。両方当てるとキックバック再点灯）
    { kind: 'standup', id: 'standA', at: [6.8, 20.25], angle: 180 },
    { kind: 'standup', id: 'standB', at: [6.8, 21.95], angle: 180 },

    // 左オービットのスピナーと、ループ判定
    { kind: 'spinner', id: 'spin', at: [-7.9, 21.6], angle: 90, w: 1.3 },
    { kind: 'trigger', id: 'loopL', a: [-8.6, 24.2], b: [-7.2, 24.2], dir: [0, 1] },
    { kind: 'trigger', id: 'loopR', a: [7.2, 23.8], b: [8.6, 23.8], dir: [0, 1] },

    // 左ランプ（大きくUターンして左インレーンへ戻る）
    {
      kind: 'ramp',
      id: 'rampL',
      path: [[-4.55, 16.8], [-4.45, 22.0], ...uturn(-6.2, 27.2, 1.85, 0, 180), [-8.05, 22.0], [-8.0, 18.5], [-7.4, 15.2], [-6.45, 12.4]],
      h: [0, 1.2, ...flat(9, 2.5), 2.3, 1.85, 1.35, 0.8],
    },
    // 右ランプ（右インレーンへ戻る）
    {
      kind: 'ramp',
      id: 'rampR',
      path: [[3.95, 17.0], [4.0, 22.0], ...uturn(5.97, 27.2, 1.92, 180, 0), [7.95, 22.0], [7.9, 18.5], [7.35, 15.2], [6.45, 12.4]],
      h: [0, 1.2, ...flat(9, 2.5), 2.3, 1.85, 1.35, 0.8],
    },
    // 左ランプの入口とオービットの間をふさぐ（ボールが挟まらないように）
    { kind: 'wall', pts: [[-7.1, 21.2], [-5.45, 19.0]], style: 'guide' },

    // ライト
    { kind: 'light', id: 'rampL', at: [-4.6, 14.9], shape: 'arrow', rot: 93, size: 0.6, color: '#3fc4ff' },
    { kind: 'light', id: 'rampR', at: [3.9, 15.1], shape: 'arrow', rot: 88, size: 0.6, color: '#3fc4ff' },
    { kind: 'light', id: 'orbitL', at: [-5.6, 14.3], shape: 'arrow', rot: 122, size: 0.45, color: '#9ef0ff' },
    { kind: 'light', id: 'orbitR', at: [5.5, 14.5], shape: 'arrow', rot: 58, size: 0.45, color: '#9ef0ff' },
    { kind: 'light', id: 'core', at: [-0.05, 18.0], shape: 'arrow', rot: 90, size: 0.55, color: '#ff4fa3', label: 'CORE' },
    { kind: 'light', id: 'extraBall', at: [-0.05, 16.3], shape: 'circle', size: 0.42, color: '#ff4040', label: 'EXTRA' },
    { kind: 'light', id: 'jackpot', at: [-1.6, 16.0], shape: 'star', size: 0.55, color: '#ffd23f' },
    { kind: 'light', id: 'm1', at: [-1.2, 13.4], shape: 'diamond', size: 0.4, color: '#3fc4ff', label: 'BOOT' },
    { kind: 'light', id: 'm2', at: [0.0, 13.8], shape: 'diamond', size: 0.4, color: '#3fc4ff', label: 'STREAM' },
    { kind: 'light', id: 'm3', at: [1.2, 13.4], shape: 'diamond', size: 0.4, color: '#3fc4ff', label: 'SPIN' },
    { kind: 'light', id: 'x2', at: [-1.65, 10.9], shape: 'circle', size: 0.32, color: '#ffb02e', label: '2x' },
    { kind: 'light', id: 'x3', at: [-0.55, 11.3], shape: 'circle', size: 0.32, color: '#ffb02e', label: '3x' },
    { kind: 'light', id: 'x4', at: [0.55, 11.3], shape: 'circle', size: 0.32, color: '#ffb02e', label: '4x' },
    { kind: 'light', id: 'x5', at: [1.65, 10.9], shape: 'circle', size: 0.32, color: '#ffb02e', label: '5x' },
    { kind: 'light', id: 'standA', at: [6.05, 20.25], shape: 'tri', rot: 0, size: 0.3, color: '#3fc4ff' },
    { kind: 'light', id: 'standB', at: [6.05, 21.95], shape: 'tri', rot: 0, size: 0.3, color: '#3fc4ff' },
  ];
}

// ───────── ルール ─────────

function rules() {
  // ボールごとのボーナス用カウンター
  let targets = 0;
  let ramps = 0;
  let spins = 0;
  let loops = 0;
  let missionsThisBall = 0;
  // 状態
  let mbReady = false;
  let extraLit = false;
  let extraGiven = false;
  let jackpotValue = 250_000;
  let jackpots = 0;
  let superLit = false;
  const stand = { standA: false, standB: false };

  const lanes = new LaneSet(['laneL', 'laneU', 'laneX'], ['laneL', 'laneU', 'laneX'], (g) => {
    g.bonusMult = Math.min(5, g.bonusMult + 1);
    g.addScore(25_000);
    g.msg(`BONUS x${g.bonusMult}`, 'L・U・X そろった！ ボーナス倍率アップ', 2, 'normal');
    syncBonusLights(g);
  });

  const missions = new Missions(
    [
      { id: 'boot', name: 'SYSTEM BOOT', desc: '中央のドロップターゲットを3枚とも倒せ', goal: 1, count: (e) => (e.type === 'bank' ? 1 : 0), reward: 50_000 },
      { id: 'stream', name: 'DATA STREAM', desc: '左右どちらかのランプを通せ', goal: 3, count: (e) => (e.type === 'ramp' ? 1 : 0), reward: 75_000 },
      { id: 'spin', name: 'SPIN CYCLE', desc: '左のスピナーを回せ', goal: 30, count: (e) => (e.type === 'spinner' ? 1 : 0), reward: 100_000 },
    ],
    {
      onComplete(m, g) {
        missionsThisBall++;
        syncMissionLights(g);
        // 2つ目を達成したら一度だけエクストラボールを点灯
        if (m.id === 'stream' && !extraGiven) {
          extraLit = true;
          g.light('extraBall', 'blink');
          g.light('core', 'blink');
          g.msg('EXTRA BALL LIT', 'CORE（中央の穴）でエクストラボール', 2.4, 'normal');
        }
      },
      onAllComplete(g) {
        missionsThisBall++;
        syncMissionLights(g);
        mbReady = true;
        g.light('core', 'fast');
        g.msg('MULTIBALL READY', 'ドロップを倒して CORE を狙え！', 3, 'big');
      },
    },
  );

  function syncBonusLights(g: Game) {
    for (let k = 2; k <= 5; k++) g.light(`x${k}`, g.bonusMult >= k ? 'on' : 'off');
  }
  function syncMissionLights(g: Game) {
    const ids = ['m1', 'm2', 'm3'];
    ids.forEach((id, i) => g.light(id, i < missions.index || !missions.active ? 'on' : i === missions.index ? 'blink' : 'off'));
  }
  function syncJackpotLights(g: Game) {
    const mb = g.multiballActive;
    g.light('rampL', mb ? 'fast' : 'slow');
    g.light('rampR', mb ? 'fast' : 'slow');
    g.light('jackpot', mb ? 'blink' : 'off');
    g.light('core', mbReady || superLit ? 'fast' : extraLit ? 'blink' : 'off');
  }

  return {
    init(g: Game) {
      syncMissionLights(g);
      g.light('orbitL', 'slow');
      g.light('orbitR', 'slow');
    },
    onBallStart(g: Game) {
      targets = ramps = spins = loops = missionsThisBall = 0;
      lanes.reset(g);
      syncBonusLights(g);
      syncJackpotLights(g);
      // やさしい台：毎ボール キックバックを点灯
      g.part<import('../table/table').KickbackRT>('kickbackL').lit = true;
      g.light('kickbackL', 'on');
      stand.standA = stand.standB = false;
      g.light('standA', 'off');
      g.light('standB', 'off');
    },
    onFlip(g: Game, side: 'left' | 'right') {
      lanes.rotate(g, side === 'left' ? -1 : 1);
    },
    onEvent(g: Game, e: import('../table/table').TableEvent) {
      missions.handle(g, e);
      switch (e.type) {
        case 'rollover':
          if (lanes.hit(g, e.id)) g.addScore(2_000);
          break;
        case 'drop':
          targets++;
          break;
        case 'bank':
          g.addScore(20_000);
          g.table.resetBank(e.id, mbReady ? 6 : 2.5);
          break;
        case 'standup':
          targets++;
          if (e.id === 'standA' || e.id === 'standB') {
            stand[e.id] = true;
            g.light(e.id, 'on');
            if (stand.standA && stand.standB) {
              stand.standA = stand.standB = false;
              g.after(0.6, () => {
                g.light('standA', 'off');
                g.light('standB', 'off');
              });
              const kb = g.part<import('../table/table').KickbackRT>('kickbackL');
              if (!kb.lit) {
                kb.lit = true;
                g.light('kickbackL', 'on');
                g.msg('KICKBACK LIT', '左アウトレーンのキックバック復活', 1.8);
              } else g.addScore(15_000);
            }
          }
          break;
        case 'spinner':
          spins++;
          break;
        case 'trigger':
          loops++;
          g.addScore(5_000 * (g.multiballActive ? 3 : 1));
          g.fx('burst', e.x, e.y, { color: C.accent2 });
          break;
        case 'ramp':
          ramps++;
          if (g.multiballActive) {
            g.jackpot(jackpotValue, e.x, e.y);
            jackpotValue += 50_000;
            jackpots++;
            if (jackpots % 2 === 0) {
              superLit = true;
              g.msg('SUPER JACKPOT LIT', 'CORE でスーパージャックポット！', 2.2);
            }
          } else {
            g.msg('RAMP', `ランプ ${ramps}回目`, 1.0, 'small');
          }
          syncJackpotLights(g);
          break;
        case 'kickback':
          g.light('kickbackL', 'off');
          g.msg('KICKBACK', 'セーフ！', 1.2);
          break;
        case 'scoop': {
          const scoop = g.part<import('../table/table').ScoopRT>('core');
          if (superLit && g.multiballActive) {
            superLit = false;
            scoop.holdFor(1.6);
            g.jackpot(jackpotValue * 2, e.x, e.y);
            g.fx('confetti', e.x, e.y);
          } else if (mbReady && !g.multiballActive) {
            mbReady = false;
            jackpots = 0;
            scoop.holdFor(2.2);
            g.msg('LUX MULTIBALL', 'ランプでジャックポット！', 3, 'big');
            g.after(1.2, () => g.startMultiball(2, 15));
          } else if (extraLit) {
            extraLit = false;
            extraGiven = true;
            g.light('extraBall', 'off');
            scoop.holdFor(1.4);
            g.extraBall();
          } else {
            g.msg('CORE', 'ボーナス +5,000', 1.0, 'small');
          }
          syncJackpotLights(g);
          break;
        }
      }
    },
    update(g: Game) {
      if (g.multiballActive) {
        g.hud.mission = 'JACKPOT';
        g.hud.missionSub = superLit ? 'CORE でスーパージャックポット！' : 'ランプを通すたびにジャックポット';
        g.hud.progress = `${jackpotValue.toLocaleString()}`;
      } else if (mbReady) {
        missions.hud(g, 'MULTIBALL READY', 'ドロップを倒して CORE（中央の穴）を狙え');
      } else {
        missions.hud(g);
      }
      g.hud.extra = `<div>ジャックポット ${jackpotValue.toLocaleString()}</div><div>ボーナス倍率 x${g.bonusMult}</div>`;
    },
    onMultiballEnd(g: Game) {
      superLit = false;
      missions.restart();
      syncMissionLights(g);
      syncJackpotLights(g);
      g.msg('MULTIBALL END', '次のミッションへ（目標アップ）', 2);
    },
    bonus() {
      return [
        { label: 'TARGETS', count: targets, each: 1_000 },
        { label: 'RAMPS', count: ramps, each: 5_000 },
        { label: 'LOOPS', count: loops, each: 3_000 },
        { label: 'SPINS', count: spins, each: 100 },
        { label: 'MISSIONS', count: missionsThisBall, each: 25_000 },
      ];
    },
  };
}

// ───────── 見た目 ─────────

function paint({ g, map, scale }: PaintApi): void {
  const W = g.canvas.width, H = g.canvas.height;
  // 細かいグリッド
  g.save();
  g.strokeStyle = 'rgba(120, 170, 215, 0.18)';
  g.lineWidth = 1;
  for (let x = -9; x <= 11; x += 1) {
    const [px] = map(x, 0);
    g.beginPath();
    g.moveTo(px, 0);
    g.lineTo(px, H);
    g.stroke();
  }
  for (let y = 0; y <= 41; y += 1) {
    const [, py] = map(0, y);
    g.beginPath();
    g.moveTo(0, py);
    g.lineTo(W, py);
    g.stroke();
  }
  g.restore();

  const glowLine = (pts: [number, number][], color: string, w: number, blur = 14) => {
    g.save();
    g.strokeStyle = color;
    g.lineWidth = w * scale;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.shadowColor = color;
    g.shadowBlur = blur;
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const [px, py] = map(x, y);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.stroke();
    g.restore();
  };

  // バンパーの周りの同心円
  const [cx, cy] = map(0.75, 27.3);
  g.save();
  for (let i = 0; i < 4; i++) {
    g.strokeStyle = `rgba(63, 196, 255, ${0.35 - i * 0.07})`;
    g.lineWidth = scale * 0.08;
    g.beginPath();
    g.arc(cx, cy, scale * (3.2 + i * 0.9), 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();

  // フリッパーからランプへ向かう光のライン
  glowLine([[-1.6, 7.2], [-3.2, 11.5], [-4.5, 15.6]], 'rgba(63, 196, 255, 0.75)', 0.12);
  glowLine([[1.6, 7.2], [3.0, 11.5], [3.9, 15.8]], 'rgba(63, 196, 255, 0.75)', 0.12);
  glowLine([[-0.2, 8.5], [-0.1, 13], [-0.05, 17.6]], 'rgba(255, 79, 163, 0.55)', 0.1);
  // 外周の発光ライン
  glowLine([[-8.45, 2], [-8.45, 13]], 'rgba(158, 240, 255, 0.9)', 0.08);
  glowLine([[8.45, 2], [8.45, 13]], 'rgba(158, 240, 255, 0.9)', 0.08);

  // ロゴと文字
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const [lx, ly] = map(0, 8.4);
  g.font = `200 ${Math.round(scale * 1.0)}px "Segoe UI Light", "Segoe UI", sans-serif`;
  g.fillStyle = 'rgba(35, 65, 95, 0.55)';
  g.fillText('M O D E R N', lx, ly);
  g.font = `600 ${Math.round(scale * 0.45)}px "Segoe UI", sans-serif`;
  g.fillStyle = 'rgba(35, 65, 95, 0.75)';
  const label = (t: string, x: number, y: number, rot = 0) => {
    const [px, py] = map(x, y);
    g.save();
    g.translate(px, py);
    g.rotate(rot);
    g.fillText(t, 0, 0);
    g.restore();
  };
  label('DATA', -4.5, 13.9);
  label('STREAM', 3.9, 14.1);
  label('LOOP', -6.3, 13.4, -0.5);
  label('LOOP', 6.2, 13.6, 0.5);
  label('SPIN', -6.4, 22.5, -Math.PI / 2);
  label('A', 5.5, 20.25);
  label('B', 5.5, 21.95);
  g.restore();

  // スクープの周りの枠
  const [sx, sy] = map(-0.05, 20.55);
  g.save();
  g.strokeStyle = 'rgba(255, 79, 163, 0.6)';
  g.shadowColor = '#ff4fa3';
  g.shadowBlur = 12;
  g.lineWidth = scale * 0.07;
  g.beginPath();
  g.arc(sx, sy, scale * 1.15, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

function paintBackboard(g: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#f7fbff');
  grad.addColorStop(1, '#cfe3f5');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#3fc4ff';
  g.lineWidth = 6;
  g.shadowColor = '#3fc4ff';
  g.shadowBlur = 20;
  g.strokeRect(14, 14, w - 28, h - 28);
  g.shadowBlur = 0;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#23415f';
  g.font = '200 120px "Segoe UI Light", "Segoe UI", sans-serif';
  g.fillText('MODERN', w / 2, h * 0.46);
  g.font = '600 30px "Segoe UI", sans-serif';
  g.fillStyle = '#3fc4ff';
  g.fillText('GLASS  ·  LIGHT  ·  MOTION', w / 2, h * 0.8);
}

/** MODERN 専用の装飾：バンパーの上に浮かぶ光のリングと、奥の光の柱 */
function decorate(api: import('./types').DecorateApi): void {
  const { THREE, group, game } = api;
  const ringMat = api.glow(C.accent);
  ringMat.transparent = true;
  ringMat.opacity = 0.85;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.05, 8, 64), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(api.at(0.75, 27.3, 2.4));
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.035, 8, 48), ringMat);
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.copy(api.at(0.75, 27.3, 2.9));
  group.add(ring, ring2);
  const pillarMat = api.glow(C.accent2);
  for (const x of [-7.6, 9.1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 8), pillarMat);
    p.position.copy(api.at(x, 39.0, 2));
    group.add(p);
  }
  let pulse = 0;
  game.on((e) => {
    if (e.t === 'table' && e.e.type === 'bumper') pulse = 1;
    if (e.t === 'jackpot' || e.t === 'multiball') pulse = 2;
  });
  api.onFrame((t, dt) => {
    pulse = Math.max(0, pulse - dt * 3);
    ring.rotation.z = t * 0.4;
    ring2.rotation.z = -t * 0.7;
    ring.position.y = 2.4 + Math.sin(t * 1.3) * 0.15;
    ringMat.emissiveIntensity = 0.8 + pulse * 2.5;
    pillarMat.emissiveIntensity = 1.2 + Math.sin(t * 2) * 0.4 + pulse;
  });
}

export const modernStage: StageDef = {
  id: 'modern',
  name: 'MODERN',
  subtitle: '現代風',
  tagline: 'はじめての人にやさしい、ガラスと光の台',
  description: 'いちばん標準的な配置。ボールセーブが長く、左のキックバックも毎ボール点灯。3つのミッションを達成してマルチボールを狙おう。',
  difficulty: 1,
  ballSave: 15,
  skillShot: 25_000,
  ranks: ['VISITOR', 'TECHNICIAN', 'ENGINEER', 'ARCHITECT', 'DIRECTOR', 'VISIONARY', 'LEGEND'],
  scores: { bumper: 1_000, sling: 100, drop: 500, standup: 1_000, spinner: 200, rollover: 500, ramp: 10_000, scoop: 5_000, 'ramp-enter': 500 },
  layout: () => baseLayout(layoutParts(), { safeSpot: [0.75, 36.6] }),
  rules,
  theme: {
    style: 'modern',
    colors: C,
    paint,
    paintBackboard,
    decorate,
    bloom: 0.7,
    bloomThreshold: 1.25,
    light: 0.95,
    wallMaterial: 'glass',
  },
  music: {
    songs: [{ name: 'GLASS CITY', bpm: 100, root: 57, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 2, 6], kit: 'electro', seed: 11 }],
  },
  sfx: { wave: 'sine', pitch: 1.15, bright: 0.85 },
};
