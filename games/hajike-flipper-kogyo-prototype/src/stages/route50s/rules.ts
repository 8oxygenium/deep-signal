// ROUTE 50s のルール：ドライブインのミッション＋ジュークボックス。
//   ORDER UP（メニューの的を全部）→ CRUISE（R-O-A-D レーン）→ DRIVE-IN MOVIE（スクープ）→ JUKEBOX HIT
//   → 全部そろえると DRAG RACE マルチボール → ジャックポット。CRUISE 達成でエクストラボールが点灯。
// 得点は昔の電気機械式らしく、点数の大きさに合わせて「チン」（chime10 / 100 / 1000）を鳴らす。
import { LaneSet, Missions } from '../../core/missions';
import type { Game } from '../../core/game';
import type { KickbackRT, ScoopRT, TableEvent } from '../../table/table';
import type { BonusLine, StageRules } from '../types';
import { MENU_IDS, ROAD_IDS } from './layout';

type MenuId = (typeof MENU_IDS)[number];

/** 点数に合わせて電気機械式のチャイムを鳴らす（10点=高い「チン」/ 100点=中 / 1000点=低い「ゴーン」） */
export function chimeFor(points: number): string {
  return points >= 1000 ? 'chime1000' : points >= 100 ? 'chime100' : 'chime10';
}

/** 得点を加えて、大きさに合わせたチャイムを鳴らす */
function award(g: Game, points: number, x?: number, y?: number): void {
  const p = g.addScore(points, x, y);
  if (p > 0) g.sfx(chimeFor(points));
}

/** ルールの中から別のきっかけ（レーン完成など）をミッションへ伝えるための作り物のイベント */
function virtual(id: string, x = 0, y = 0): TableEvent {
  return { type: 'bank', id, ball: null, x, y, speed: 0 };
}

export function rules(): StageRules {
  // ボールごとのボーナス用カウンター
  let bumps = 0;
  let menus = 0;
  let roads = 0;
  let movies = 0;
  let jukes = 0;
  let missionsThisBall = 0;
  // ゲーム全体の状態
  let mbReady = false;
  let extraLit = false;
  let extraGiven = false;
  let superLit = false;
  let jackpotValue = 100_000;
  let jackpots = 0;
  let songIndex = 0;
  let lastSongAt = -99;
  const menu: Record<MenuId, boolean> = { burger: false, shake: false, fries: false };
  const buttons = { btnL: false, btnR: false };

  const lanes = new LaneSet([...ROAD_IDS], [...ROAD_IDS], (g) => {
    roads++;
    g.bonusMult = Math.min(5, g.bonusMult + 1);
    if (g.multiballActive) {
      g.jackpot(jackpotValue, 0.75, 33);
      bumpJackpot(g);
    } else {
      award(g, 5_000, 0.75, 33);
      g.msg(`BONUS x${g.bonusMult}`, 'R・O・A・D そろった！ ボーナス倍率アップ', 2, 'normal');
    }
    g.sfx('chime1000');
    missions.handle(g, virtual('road', 0.75, 33));
    syncMissionLights(g);
  });

  const missions = new Missions(
    [
      { id: 'order', name: 'ORDER UP', desc: 'メニューの的 BURGER・SHAKE・FRIES を全部倒せ', goal: 1, count: (e) => (e.type === 'bank' && e.id === 'order' ? 1 : 0), reward: 25_000 },
      { id: 'cruise', name: 'CRUISE', desc: '上の R・O・A・D レーンを全部そろえて道をひとっ走り', goal: 1, count: (e) => (e.type === 'bank' && e.id === 'road' ? 1 : 0), reward: 40_000 },
      { id: 'movie', name: 'DRIVE-IN MOVIE', desc: '映画館スクープ（DRIVE-IN）にボールを入れろ', goal: 2, count: (e) => (e.type === 'scoop' && e.id === 'movie' ? 1 : 0), reward: 60_000 },
      { id: 'juke', name: 'JUKEBOX HIT', desc: 'ジュークボックスを叩いて曲を変えろ', goal: 3, count: (e) => (e.type === 'standup' && e.id === 'juke' ? 1 : 0), reward: 80_000 },
    ],
    {
      onComplete(m, g) {
        missionsThisBall++;
        syncMissionLights(g);
        g.sfx('chime1000');
        // ミッションを達成するとキックバックが点灯
        lightKickback(g);
        // CRUISE を達成したら一度だけエクストラボールを点灯（DRIVE-IN で受け取る）
        if (m.id === 'cruise' && !extraGiven) {
          extraLit = true;
          g.light('extraBall', 'blink');
          g.msg('EXTRA BALL LIT', 'DRIVE-IN（奥の穴）でエクストラボール', 2.6, 'normal');
          syncScoopLights(g);
        }
      },
      onAllComplete(g) {
        missionsThisBall++;
        syncMissionLights(g);
        mbReady = true;
        g.msg('MULTIBALL READY', 'DRIVE-IN に入れて DRAG RACE 開始！', 3, 'big');
        syncScoopLights(g);
      },
    },
  );

  function bumpJackpot(g: Game): void {
    jackpotValue += 25_000;
    jackpots++;
    if (jackpots % 2 === 0 && !superLit) {
      superLit = true;
      g.msg('SUPER JACKPOT LIT', 'DRIVE-IN でスーパージャックポット！', 2.4, 'normal');
    }
    syncScoopLights(g);
  }

  function lightKickback(g: Game): void {
    const kb = g.part<KickbackRT>('kickbackL');
    if (!kb.lit) {
      kb.lit = true;
      g.light('kickbackL', 'on');
      g.msg('KICKBACK LIT', '左アウトレーンのキックバックが復活', 1.8, 'small');
    }
  }

  function syncMissionLights(g: Game): void {
    ['m1', 'm2', 'm3', 'm4'].forEach((id, i) => g.light(id, !missions.active || i < missions.index ? 'on' : i === missions.index ? 'blink' : 'off'));
  }
  function syncScoopLights(g: Game): void {
    g.light('movie', superLit && g.multiballActive ? 'fast' : mbReady ? 'fast' : extraLit ? 'blink' : 'slow');
    g.light('jackpot', g.multiballActive ? 'blink' : 'off');
    if (!extraLit) g.light('extraBall', 'off');
  }
  function syncMenuLights(g: Game): void {
    for (const id of MENU_IDS) g.light(id, menu[id] ? 'on' : 'off');
  }

  function playSong(g: Game, next: number): void {
    const songs = g.stage.music.songs;
    songIndex = ((next % songs.length) + songs.length) % songs.length;
    g.song(songIndex);
    g.sfx('juke');
    g.msg('NOW PLAYING', songs[songIndex].name, 2.6, 'normal');
  }

  return {
    init(g) {
      syncMissionLights(g);
      syncMenuLights(g);
      syncScoopLights(g);
      g.light('btnL', 'off');
      g.light('btnR', 'off');
      g.light('juke', 'slow');
    },
    onBallStart(g) {
      bumps = menus = roads = movies = jukes = missionsThisBall = 0;
      lanes.reset(g);
      menu.burger = menu.shake = menu.fries = false;
      buttons.btnL = buttons.btnR = false;
      syncMenuLights(g);
      g.light('btnL', 'off');
      g.light('btnR', 'off');
      superLit = false;
      syncMissionLights(g);
      syncScoopLights(g);
      // ★3：キックバックは最初は消えている（ボタンかミッションで点灯）
      g.part<KickbackRT>('kickbackL').lit = false;
      g.light('kickbackL', 'off');
    },
    onFlip(g, side) {
      lanes.rotate(g, side === 'left' ? -1 : 1);
    },
    onEvent(g, e) {
      missions.handle(g, e);
      switch (e.type) {
        case 'bumper':
          bumps++;
          break;
        case 'rollover':
          if ((ROAD_IDS as readonly string[]).includes(e.id)) {
            const fresh = !lanes.lit[ROAD_IDS.indexOf(e.id as (typeof ROAD_IDS)[number])];
            lanes.hit(g, e.id);
            award(g, fresh ? 500 : 100, e.x, e.y);
          } else if (e.id === 'btnL' || e.id === 'btnR') {
            award(g, 200, e.x, e.y);
            buttons[e.id] = true;
            g.light(e.id, 'on');
            if (buttons.btnL && buttons.btnR) {
              buttons.btnL = buttons.btnR = false;
              g.after(0.5, () => {
                g.light('btnL', 'off');
                g.light('btnR', 'off');
              });
              if (g.part<KickbackRT>('kickbackL').lit) award(g, 5_000);
              else lightKickback(g);
            }
          } else {
            // インレーン・アウトレーン
            g.sfx('chime10');
          }
          break;
        case 'standup': {
          const id = e.id;
          if (id === 'juke') {
            jukes++;
            award(g, 2_000, e.x, e.y);
            // 連続で当たっても曲が切り替わりすぎないよう、4秒に1回だけ曲を変える
            if (g.time - lastSongAt >= 4) {
              lastSongAt = g.time;
              playSong(g, songIndex + 1);
            }
            g.fx('burst', e.x, e.y, { color: '#ffd23f' });
            g.shake(0.25);
            break;
          }
          if (!(id === 'burger' || id === 'shake' || id === 'fries')) break;
          if (menu[id]) {
            award(g, 200, e.x, e.y);
            break;
          }
          menu[id] = true;
          menus++;
          g.light(id, 'on');
          award(g, 1_000, e.x, e.y);
          if (menu.burger && menu.shake && menu.fries) {
            // 3つそろった：ORDER UP!
            g.after(0.7, () => {
              menu.burger = menu.shake = menu.fries = false;
              syncMenuLights(g);
            });
            for (const m of MENU_IDS) g.light(m, 'fast');
            g.msg('ORDER UP!', 'メニューが全部そろった！', 1.8, 'normal');
            g.sfx('chime1000');
            if (g.multiballActive) {
              g.jackpot(jackpotValue, e.x, e.y);
              bumpJackpot(g);
            } else {
              award(g, 5_000, e.x, e.y);
            }
            missions.handle(g, virtual('order', e.x, e.y));
          }
          break;
        }
        case 'kickback':
          g.light('kickbackL', 'off');
          g.msg('KICKBACK', 'セーフ！', 1.2, 'small');
          break;
        case 'scoop': {
          if (e.id !== 'movie') break;
          movies++;
          const scoop = g.part<ScoopRT>('movie');
          g.sfx('chime1000');
          if (superLit && g.multiballActive) {
            superLit = false;
            scoop.holdFor(1.8);
            g.jackpot(jackpotValue * 2, e.x, e.y);
            g.fx('confetti', e.x, e.y);
          } else if (mbReady && !g.multiballActive) {
            mbReady = false;
            jackpots = 0;
            jackpotValue = 100_000;
            scoop.holdFor(2.4);
            g.rankUp();
            g.msg('DRAG RACE', 'マルチボール！ R-O-A-D か ORDER UP でジャックポット', 3.2, 'big');
            g.fx('confetti', e.x, e.y);
            g.after(1.3, () => {
              g.pfMult = 2;
              g.startMultiball(2, 15);
              syncScoopLights(g);
            });
          } else if (extraLit) {
            extraLit = false;
            extraGiven = true;
            g.light('extraBall', 'off');
            scoop.holdFor(1.6);
            g.extraBall();
          } else {
            award(g, 2_000, e.x, e.y);
            g.msg('DRIVE-IN', 'いま上映中…', 1.2, 'small');
          }
          syncScoopLights(g);
          break;
        }
      }
    },
    update(g) {
      const song = g.stage.music.songs[songIndex]?.name ?? '';
      if (g.multiballActive) {
        g.hud.mission = 'DRAG RACE';
        g.hud.missionSub = superLit ? 'DRIVE-IN でスーパージャックポット！' : 'R・O・A・D か ORDER UP でジャックポット';
        g.hud.progress = jackpotValue.toLocaleString();
      } else if (mbReady) {
        missions.hud(g, 'MULTIBALL READY', 'DRIVE-IN（奥の穴）に入れて DRAG RACE 開始');
      } else {
        missions.hud(g);
      }
      g.hud.extra = `<div>♪ ${song}</div><div>ROAD ${lanes.count}/4 ・ ボーナス x${g.bonusMult}</div>`;
    },
    onBallEnd(g) {
      g.pfMult = 1;
    },
    onMultiballEnd(g) {
      superLit = false;
      g.pfMult = 1;
      missions.restart();
      syncMissionLights(g);
      syncScoopLights(g);
      g.msg('MULTIBALL END', '次のミッションへ（目標アップ）', 2);
    },
    bonus(): BonusLine[] {
      return [
        { label: 'BUMPERS', count: bumps, each: 50 },
        { label: 'MENU', count: menus, each: 500 },
        { label: 'JUKEBOX', count: jukes, each: 1_000 },
        { label: 'DRIVE-IN', count: movies, each: 2_500 },
        { label: 'ROAD', count: roads, each: 3_000 },
        { label: 'MISSIONS', count: missionsThisBall, each: 10_000 },
      ];
    },
  };
}
