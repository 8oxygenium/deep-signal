// ANIME のルール。
// ・変身ゲージ：何かに当てるほど溜まる。満タンで HENSHIN スクープが光り、入れると必殺技カットイン → マルチボール。
// ・コンボ：ランプ／オービット／スクープを短い間隔で続けて通すと得点倍率（g.pfMult）が x2→x5 まで上がり、時間切れで戻る。
// ・ミッション：MAGIC ROAD → STAR SHOWER → SAKURA LOOP の3つ。達成でランクアップ＋ゲージ加算。
// ・マルチボール中はランプがジャックポット、ゲージを溜め直してスクープでスーパージャックポット。
import type { Game } from '../../core/game';
import { LaneSet, Missions } from '../../core/missions';
import type { KickbackRT, ScoopRT, TableEvent } from '../../table/table';
import type { BonusLine, StageRules } from '../types';
import { LANE_IDS, SCOOP_AT } from './layout';

/** 必殺技カットインの名前（マルチボールのたびに順番に） */
export const CUTINS = [
  { text: '必殺！流星群', color: '#ff3d8b' },
  { text: '必殺！桜花乱舞', color: '#ff6fb5' },
  { text: '必殺！天空砲', color: '#6f8bff' },
  { text: '必殺！星光斬', color: '#ffb02e' },
];
const SUPER_CUTIN = { text: '必殺！超新星', color: '#ffe14f' };

/** コンボが続く秒数（コンボ数が増えるほど短くなる） */
const comboWindow = (n: number) => Math.max(4.5, 7.5 - 0.5 * n);
const COMBO_MAX = 5;

/** 当たりごとのゲージ加算（%） */
const GAUGE_GAIN: Partial<Record<string, number>> = { bumper: 1.2, sling: 0.4, standup: 3, spinner: 0.1, rollover: 0.7 };

const pct = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export function animeRules(): StageRules {
  // ── 状態 ──
  let gauge = 0;
  let ready = false;
  let combo = 0;
  let comboTime = 0;
  let extraLit = false;
  let extraGiven = false;
  let mbRound = 0;
  let jackpotValue = 300_000;
  let jackpots = 0;
  let mbSong = false;
  let guardGiven = false;
  // ボールごとの集計（ボーナス用）
  let stars = 0;
  let ramps = 0;
  let loops = 0;
  let spins = 0;
  let missionsThisBall = 0;
  let bestCombo = 0;
  const starL = [false, false, false];
  const starR = [false, false];

  const isLoopUp = (e: TableEvent) => e.type === 'trigger' && !!e.ball && e.ball.vy > 0;

  const lanes = new LaneSet(LANE_IDS, LANE_IDS, (g) => {
    g.bonusMult = Math.min(5, g.bonusMult + 1);
    g.addScore(20_000);
    addGauge(g, 8);
    g.msg(`STAR BONUS x${g.bonusMult}`, 'S・T・A・R そろった！ ボーナス倍率アップ', 2, 'normal');
    g.fx('stars', 0.75, 33.5, { color: '#ffe14f' });
  });

  const missions = new Missions(
    [
      { id: 'road', name: 'MAGIC ROAD', desc: '中央のランプを駆け上がれ', goal: 2, count: (e) => (e.type === 'ramp' ? 1 : 0), reward: 60_000 },
      { id: 'star', name: 'STAR SHOWER', desc: '光る星の的を当てろ', goal: 6, count: (e) => (e.type === 'standup' ? 1 : 0), reward: 80_000 },
      { id: 'loop', name: 'SAKURA LOOP', desc: '左右のオービットを駆け上がれ', goal: 3, count: (e) => (isLoopUp(e) ? 1 : 0), reward: 100_000 },
    ],
    {
      onComplete(_m, g) {
        missionsThisBall++;
        addGauge(g, 25);
        syncMissionLights(g);
      },
      onAllComplete(g) {
        missionsThisBall++;
        syncMissionLights(g);
        // 全部達成で一気に満タン
        gauge = Math.max(gauge, 99.9);
        addGauge(g, 1);
      },
    },
  );

  // ── 部品の操作 ──
  function addGauge(g: Game, n: number): void {
    if (n <= 0 || g.tilted || ready) return;
    gauge = Math.min(100, gauge + n * (g.multiballActive ? 1.8 : 1));
    if (gauge >= 100 - 1e-6) {
      gauge = 100;
      ready = true;
      g.msg('HENSHIN READY', g.multiballActive ? 'スクープで必殺！スーパージャックポット' : 'スクープに入れて変身！', 2.8, 'big');
      g.sfx('henshin');
      g.fx('stars', SCOOP_AT[0], SCOOP_AT[1], { color: '#ff4fa3' });
    }
  }

  function syncMissionLights(g: Game): void {
    ['m1', 'm2', 'm3'].forEach((id, i) => g.light(id, !missions.active || i < missions.index ? 'on' : i === missions.index ? 'blink' : 'off'));
  }

  function syncLights(g: Game): void {
    const mb = g.multiballActive;
    g.light('henshin', ready ? 'fast' : extraLit ? 'blink' : gauge >= 70 ? 'blink' : gauge >= 35 ? 'slow' : 'off');
    g.light('extraBall', extraLit ? 'blink' : 'off');
    g.light('jackpot', mb ? 'blink' : 'off');
    g.light('rampC', mb ? 'fast' : 'slow');
    for (let k = 2; k <= 5; k++) g.light(`c${k}`, g.pfMult >= k ? 'on' : 'off');
  }

  /** ランプ／オービット／スクープを通した：コンボを進める */
  function shot(g: Game, x: number, y: number): void {
    combo = comboTime > 0 ? combo + 1 : 1;
    comboTime = comboWindow(combo);
    bestCombo = Math.max(bestCombo, combo);
    if (combo >= 2) {
      g.pfMult = Math.min(COMBO_MAX, combo);
      g.msg(`COMBO x${g.pfMult}`, '続けて決めると得点倍率アップ！', 1.3, 'small');
      g.fx('stars', x, y, { color: '#6ff0c8' });
      g.sfx(`combo${Math.min(COMBO_MAX, combo)}`);
    }
    if (combo >= 3 && !guardGiven) {
      const kb = g.part<KickbackRT>('kickbackR');
      if (!kb.lit) {
        guardGiven = true;
        kb.lit = true;
        g.light('kickbackR', 'on');
        g.msg('SAKURA GUARD', '右アウトレーンのキックバック点灯！', 1.8);
      }
    }
    if (combo >= COMBO_MAX && !extraGiven && !extraLit) {
      extraLit = true;
      g.msg('EXTRA BALL LIT', 'スクープに入れてエクストラボール！', 2.6, 'big');
    }
  }

  function endCombo(g: Game): void {
    if (combo >= 2) g.msg('COMBO END', `${combo} コンボ！`, 1.2, 'small');
    combo = 0;
    comboTime = 0;
    g.pfMult = 1;
  }

  function beginMultiball(g: Game, sc: ScoopRT, x: number, y: number): void {
    ready = false;
    gauge = 0;
    mbRound++;
    const c = CUTINS[(mbRound - 1) % CUTINS.length];
    jackpotValue = 300_000 + 100_000 * (mbRound - 1);
    jackpots = 0;
    sc.holdFor(3.4);
    g.fx('cutin', x, y, { text: c.text, color: c.color });
    g.sfx('cutin');
    g.shake(0.5);
    g.fx('petals', x, y, { value: 90 });
    g.after(1.0, () => g.fx('stars', x, y, { color: c.color }));
    g.after(1.7, () => {
      g.startMultiball(2, 16);
      mbSong = true;
      g.song(1);
      g.msg('SAKURA MULTIBALL', 'ランプでジャックポット！', 3, 'big');
      g.fx('stars', 0.75, 20, { color: c.color });
    });
  }

  function superJackpot(g: Game, sc: ScoopRT, x: number, y: number): void {
    ready = false;
    gauge = 0;
    sc.holdFor(2.4);
    g.fx('cutin', x, y, { text: SUPER_CUTIN.text, color: SUPER_CUTIN.color });
    g.sfx('cutin');
    g.fx('petals', x, y, { value: 70 });
    g.after(1.2, () => {
      g.jackpot(jackpotValue * 3, x, y);
      g.fx('confetti', x, y);
      jackpotValue += 100_000;
    });
  }

  return {
    init(g) {
      syncMissionLights(g);
      g.light('orbitL', 'slow');
      g.light('orbitR', 'slow');
      syncLights(g);
      g.on((e) => {
        if (e.t === 'skillshot') {
          g.fx('stars', 0.75, 30, { color: '#ffe14f' });
          g.fx('petals', 0.75, 30, { value: 40 });
          addGauge(g, 10);
        }
      });
    },

    onBallStart(g) {
      stars = ramps = loops = spins = missionsThisBall = bestCombo = 0;
      combo = 0;
      comboTime = 0;
      guardGiven = false;
      lanes.reset(g);
      starL.fill(false);
      starR.fill(false);
      for (const id of ['starL1', 'starL2', 'starL3', 'starR1', 'starR2']) g.light(id, 'off');
      g.part<KickbackRT>('kickbackL').lit = true;
      g.light('kickbackL', 'on');
      g.light('kickbackR', g.part<KickbackRT>('kickbackR').lit ? 'on' : 'off');
      syncMissionLights(g);
      syncLights(g);
    },

    onFlip(g, side) {
      lanes.rotate(g, side === 'left' ? -1 : 1);
    },

    onEvent(g, e) {
      missions.handle(g, e);
      const gain = GAUGE_GAIN[e.type];
      if (gain) addGauge(g, gain);
      switch (e.type) {
        case 'rollover':
          if (lanes.hit(g, e.id)) g.addScore(1_000);
          break;
        case 'spinner':
          spins++;
          break;
        case 'standup': {
          stars++;
          if (g.multiballActive) jackpotValue += 10_000;
          const li = ['starL1', 'starL2', 'starL3'].indexOf(e.id);
          const ri = ['starR1', 'starR2'].indexOf(e.id);
          if (li >= 0) {
            starL[li] = true;
            g.light(e.id, 'on');
            if (starL.every(Boolean)) {
              starL.fill(false);
              ['starL1', 'starL2', 'starL3'].forEach((id) => g.light(id, 'fast'));
              g.after(0.7, () => ['starL1', 'starL2', 'starL3'].forEach((id) => g.light(id, 'off')));
              g.addScore(25_000);
              addGauge(g, 10);
              g.msg('STAR COMPLETE', '星を3つそろえた！ ゲージ大幅アップ', 1.8);
              g.fx('stars', e.x, e.y, { color: '#ff4fa3' });
            }
          } else if (ri >= 0) {
            starR[ri] = true;
            g.light(e.id, 'on');
            if (starR.every(Boolean)) {
              starR.fill(false);
              ['starR1', 'starR2'].forEach((id) => g.light(id, 'fast'));
              g.after(0.7, () => ['starR1', 'starR2'].forEach((id) => g.light(id, 'off')));
              const kb = g.part<KickbackRT>('kickbackR');
              if (!kb.lit) {
                kb.lit = true;
                g.light('kickbackR', 'on');
                g.msg('SAKURA GUARD', '右アウトレーンのキックバック点灯！', 1.8);
              } else g.addScore(15_000);
              g.fx('stars', e.x, e.y, { color: '#4fc3ff' });
            }
          }
          break;
        }
        case 'trigger': {
          if (!isLoopUp(e)) break;
          loops++;
          addGauge(g, 5);
          shot(g, e.x, e.y);
          g.addScore(5_000);
          if (g.multiballActive) jackpotValue += 25_000;
          g.fx('petals', e.x, e.y, { value: 14 });
          break;
        }
        case 'ramp': {
          ramps++;
          addGauge(g, 9);
          shot(g, e.x, e.y);
          g.fx('petals', e.x, e.y, { value: 24 });
          if (g.multiballActive) {
            g.jackpot(jackpotValue, e.x, e.y);
            jackpotValue += 60_000;
            jackpots++;
            g.fx('stars', e.x, e.y, { color: '#ffe14f' });
          } else {
            g.msg('MAGIC ROAD', `ランプ ${ramps}回目`, 1.0, 'small');
          }
          break;
        }
        case 'kickback':
          g.light(e.id, 'off');
          g.msg('KICKBACK', 'セーフ！', 1.2);
          break;
        case 'scoop': {
          if (e.id !== 'henshin') break;
          const sc = g.part<ScoopRT>('henshin');
          shot(g, e.x, e.y);
          if (ready && !g.multiballActive) beginMultiball(g, sc, e.x, e.y);
          else if (ready && g.multiballActive) superJackpot(g, sc, e.x, e.y);
          else if (extraLit) {
            extraLit = false;
            extraGiven = true;
            sc.holdFor(1.6);
            g.extraBall();
            g.fx('confetti', e.x, e.y);
          } else {
            addGauge(g, 3);
            sc.holdFor(1.2);
            g.msg('HENSHIN', `ゲージ ${pct(gauge)}%`, 1.0, 'small');
          }
          break;
        }
      }
      syncLights(g);
    },

    update(g, dt) {
      if (comboTime > 0) {
        comboTime -= dt;
        if (comboTime <= 0) endCombo(g);
      }
      // HUD（ミッション欄）
      if (g.multiballActive) {
        g.hud.mission = 'JACKPOT';
        g.hud.missionSub = ready ? 'スクープでスーパージャックポット！' : 'ランプでジャックポット、ゲージを溜めてスクープへ';
        g.hud.progress = jackpotValue.toLocaleString();
      } else if (ready) {
        g.hud.mission = 'HENSHIN READY';
        g.hud.missionSub = '左のスクープに入れて変身！';
        g.hud.progress = '';
      } else missions.hud(g);
      // HUD（変身ゲージとコンボ）
      const gp = pct(gauge);
      const cp = combo >= 2 && comboTime > 0 ? Math.round((comboTime / comboWindow(combo)) * 10) * 10 : 0;
      g.hud.extra =
        `<div>${ready ? '変身ゲージ MAX！' : `変身ゲージ ${gp}%`}</div>` +
        `<div class="hpbar"><i style="width:${gp}%;background:linear-gradient(90deg,#ff4fa3,#ffe14f)"></i></div>` +
        `<div style="margin-top:6px">${combo >= 2 ? `COMBO x${g.pfMult}（${combo}連続）` : 'COMBO ―'}</div>` +
        `<div class="hpbar"><i style="width:${cp}%;background:linear-gradient(90deg,#4fc3ff,#6ff0c8)"></i></div>` +
        (g.multiballActive ? `<div style="margin-top:6px">ジャックポット ${jackpotValue.toLocaleString()}</div>` : '');
      // 描画側（3D装飾）が読む値
      g.vars.gauge = gauge;
      g.vars.ready = ready ? 1 : 0;
      g.vars.combo = combo;
      g.vars.mb = g.multiballActive ? 1 : 0;
      syncLights(g);
    },

    onBallEnd(g) {
      if (mbSong) {
        mbSong = false;
        g.song(0);
        ready = false;
        gauge = 0;
      }
    },

    onMultiballEnd(g) {
      if (mbSong) {
        mbSong = false;
        g.song(0);
      }
      // マルチボール明けはゲージを空から（すぐ次のマルチボールにならないように）
      ready = false;
      gauge = 0;
      if (!missions.active) missions.restart();
      syncMissionLights(g);
      syncLights(g);
      g.msg('MULTIBALL END', '次のミッションへ（目標アップ）', 2);
    },

    bonus(): BonusLine[] {
      return [
        { label: 'STARS', count: stars, each: 1_000 },
        { label: 'RAMPS', count: ramps, each: 5_000 },
        { label: 'LOOPS', count: loops, each: 3_000 },
        { label: 'BEST COMBO', count: bestCombo >= 2 ? bestCombo : 0, each: 10_000 },
        { label: 'SPINS', count: Math.min(spins, 300), each: 100 },
        { label: 'MISSIONS', count: missionsThisBall, each: 25_000 },
      ];
    },
  };
}
