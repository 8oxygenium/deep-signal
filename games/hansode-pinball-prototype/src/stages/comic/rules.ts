// COMIC のルール
//  ・悪役ボスにHPがあり、当てるたびに減る。手下（ドロップバンク）を倒す/HQに入ると「盾」が外れてダメージが増える
//  ・ボスを倒す → 大量得点 → ヒーローマルチボール（ボスを殴るたびにジャックポット）→ 次のボスはHPが増えて復活
//  ・3つのミッション（ランク制）。達成するとボスに必殺技ダメージ。全部達成でHQにエクストラボール点灯
import { Missions } from '../../core/missions';
import type { Game } from '../../core/game';
import type { KickbackRT, ScoopRT, TableEvent } from '../../table/table';
import type { StageRules } from '../types';
import { bossLook, bossMaxHp, SAY } from './boss';
import { BOSS_AT } from './layout';

const SHIELD_REGEN = 26; // 外れた盾が戻るまでの秒数
const YELLOW = '#ffd21f';
const RED = '#ff3b30';
const CYAN = '#35e0ff';

export function comicRules(): StageRules {
  // ボールごとのボーナス用カウンター
  let hunted = 0;
  let bossHits = 0;
  let skyways = 0;
  let loops = 0;
  let spins = 0;
  let hqVisits = 0;
  let missionsThisBall = 0;

  // ボス
  let level = 0;
  let hp = bossMaxHp(0);
  let shL = true;
  let shR = true;
  let regenL = 0;
  let regenR = 0;
  let ko = false;
  let lastDmg = -9;
  let lastJack = -9;
  let sayCount = 0;
  let song = 0;
  let demoKo = 0;

  // ジャックポット・エクストラボール
  let jackpotValue = 250_000;
  let jackpots = 0;
  let superLit = false;
  let extraLit = false;
  let extraGiven = false;
  const pow = { powA: false, powB: false };

  const say = (g: Game, id: number) => {
    sayCount++;
    g.vars.say = id;
    g.vars.sayN = sayCount;
  };

  /** 曲の切り替え（同じ曲なら何もしない：曲が頭から鳴り直さないように） */
  const setSong = (g: Game, i: number) => {
    if (song === i || g.attract) return; // タイトルのデモでは曲を変えない
    song = i;
    g.song(i);
  };

  const broken = () => (shL ? 0 : 1) + (shR ? 0 : 1);

  const missions = new Missions(
    [
      { id: 'hunt', name: 'HENCHMEN HUNT', desc: '手下（ドロップターゲット）を倒せ', goal: 6, count: (e) => (e.type === 'drop' ? 1 : 0), reward: 50_000 },
      { id: 'bam', name: 'BAM BARRAGE', desc: 'バンパーを連打して叩け', goal: 20, count: (e) => (e.type === 'bumper' ? 1 : 0), reward: 75_000 },
      { id: 'sky', name: 'SKYWAY STRIKE', desc: '左のスカイウェイ（ランプ）を通せ', goal: 2, count: (e) => (e.type === 'ramp' ? 1 : 0), reward: 100_000 },
    ],
    {
      onComplete(m, g) {
        missionsThisBall++;
        syncMissionLights(g);
        heroBlast(g, m.name);
      },
      onAllComplete(g) {
        missionsThisBall++;
        syncMissionLights(g);
        heroBlast(g, 'ALL CLEAR');
        if (!extraGiven && !extraLit) {
          extraLit = true;
          g.msg('EXTRA BALL LIT', 'HQ（右の穴）でエクストラボール！', 2.6, 'normal');
        }
        // 少し間を置いて、目標が上がった次の周回へ
        g.after(2.8, () => {
          missions.restart();
          syncMissionLights(g);
        });
      },
    },
  );

  // ───── ボス ─────

  /** ミッション達成の必殺技 */
  function heroBlast(g: Game, name: string): void {
    if (ko) return;
    g.fx('comic', BOSS_AT[0], BOSS_AT[1] - 1.2, { text: 'KA-POW!', color: RED });
    g.msg('HERO BLAST', `${name} … ボスに3ダメージ！`, 2, 'normal');
    damage(g, 3, BOSS_AT[0], BOSS_AT[1] - 1.2);
  }

  function breakShield(g: Game, prefer: 'L' | 'R'): boolean {
    if (ko) return false;
    let side: 'L' | 'R' | null;
    if (prefer === 'L') side = shL ? 'L' : shR ? 'R' : null;
    else side = shR ? 'R' : shL ? 'L' : null;
    if (!side) return false;
    if (side === 'L') {
      shL = false;
      regenL = SHIELD_REGEN;
    } else {
      shR = false;
      regenR = SHIELD_REGEN;
    }
    const x = BOSS_AT[0] + (side === 'L' ? -1.9 : 1.9);
    g.fx('comic', x, BOSS_AT[1] - 1.0, { text: 'CRACK!', color: CYAN });
    g.fx('burst', x, BOSS_AT[1] - 0.6, { color: CYAN });
    g.sfx('shield');
    if (!shL && !shR) {
      g.msg('SHIELD DOWN', 'ボス丸裸！ いまがチャンス（ダメージ3倍）', 2.4, 'big');
      say(g, SAY.GRRR);
    } else g.msg('SHIELD HALF', '盾が半分外れた！ ダメージ2倍', 1.8, 'normal');
    return true;
  }

  /** ボスにダメージ。倒したら true */
  function damage(g: Game, amount: number, x: number, y: number): boolean {
    if (ko) return false;
    hp = Math.max(0, hp - amount);
    if (hp <= 0) {
      defeat(g, x, y);
      return true;
    }
    return false;
  }

  function defeat(g: Game, x: number, y: number): void {
    ko = true;
    hp = 0;
    const look = bossLook(level);
    const v = g.addScore(300_000 * (level + 1), x, y);
    g.fx('comic', BOSS_AT[0], BOSS_AT[1] - 1.5, { text: 'KA-BOOM!', color: YELLOW });
    g.fx('stars', BOSS_AT[0], BOSS_AT[1] - 1.5, { color: YELLOW });
    g.fx('confetti', BOSS_AT[0], BOSS_AT[1] - 1.5);
    g.sfx('bossDown');
    g.shake(1.2);
    g.rumble(1, 1, 700);
    g.rankUp();
    g.bonusMult = Math.min(5, g.bonusMult + 1);
    syncBonusLights(g);
    g.msg('BOSS DEFEATED', `${look.name} を撃破！ +${v.toLocaleString()}`, 3, 'big');
    say(g, SAY.NOOO);
    jackpots = 0;
    jackpotValue = 250_000 + level * 100_000;
    superLit = false;
    const lv = level;
    // 撃破の演出中（マルチボール開始まで）にボールが落ちても、ご褒美が消えないように守る
    g.ballSave(3);
    g.after(1.6, () => {
      if (!ko || lv !== level) return;
      if (g.state === 'play' && !g.tilted && !g.multiballActive) {
        g.startMultiball(2, 14);
        setSong(g, 1);
        g.msg('HERO MULTIBALL', 'ボスを殴ってジャックポット！', 3, 'big');
      }
    });
  }

  /** 倒れたボスの代わりに、強い次のボスが現れる */
  function nextBoss(g: Game): void {
    ko = false;
    level++;
    hp = bossMaxHp(level);
    shL = shR = true;
    regenL = regenR = 0;
    superLit = false;
    g.table.resetBank('hl', 0.4);
    g.table.resetBank('hr', 0.4);
    const look = bossLook(level);
    setSong(g, 0);
    g.msg('NEW BOSS', `${look.name} 登場！ HP ${hp}`, 2.8, 'big');
    say(g, SAY.CANNOT);
  }

  function tryJackpot(g: Game, x: number, y: number): void {
    if (g.time - lastJack < 0.9) return;
    lastJack = g.time;
    g.jackpot(jackpotValue, x, y);
    g.fx('comic', x, y - 1.2, { text: 'JACKPOT!', color: YELLOW });
    jackpotValue += 50_000;
    jackpots++;
    if (jackpots % 3 === 0 && !superLit) {
      superLit = true;
      g.msg('SUPER JACKPOT LIT', 'HQ でスーパージャックポット！', 2.2);
    }
  }

  function hitBoss(g: Game, e: TableEvent): void {
    if (g.time - lastDmg < 0.18) return; // 同じ接触の二重カウント防止
    lastDmg = g.time;
    bossHits++;
    const bx = BOSS_AT[0], by = BOSS_AT[1] - 1.3;
    if (ko) {
      if (g.multiballActive) {
        say(g, SAY.OOF);
        tryJackpot(g, bx, by);
      }
      return;
    }
    const b = broken();
    const dmg = 1 + b;
    g.addScore(3_000 * dmg, e.x, e.y);
    g.sfx(b === 0 ? 'bossShield' : 'boss');
    const jx = bx + (g.rng.next() - 0.5) * 2;
    if (b === 0) {
      g.fx('comic', jx, by, { text: 'CLANG!', color: CYAN });
      say(g, sayCount % 2 === 0 ? SAY.AGAIN : SAY.HAHA);
    } else {
      g.fx('comic', jx, by, { text: b === 2 ? 'KRAK!' : 'POW!', color: b === 2 ? RED : YELLOW });
      say(g, b === 2 ? SAY.ARGH : SAY.OUCH);
    }
    g.shake(0.06 * dmg);
    g.rumble(0.3 + 0.2 * dmg, 0.2, 90);
    damage(g, dmg, bx, by);
  }

  // ───── ライト・表示 ─────

  function syncBonusLights(g: Game) {
    for (let k = 2; k <= 5; k++) g.light(`x${k}`, g.bonusMult >= k ? 'on' : 'off');
  }
  function syncMissionLights(g: Game) {
    ['m1', 'm2', 'm3'].forEach((id, i) => g.light(id, i < missions.index || !missions.active ? 'on' : i === missions.index ? 'blink' : 'off'));
  }
  function syncLights(g: Game) {
    const mb = g.multiballActive;
    g.light('boss', ko ? 'fast' : !shL && !shR ? 'blink' : 'slow');
    g.light('shL', shL ? 'on' : regenL < 4 && regenL > 0 ? 'fast' : 'off');
    g.light('shR', shR ? 'on' : regenR < 4 && regenR > 0 ? 'fast' : 'off');
    g.light('hl', mb ? 'fast' : ko ? 'off' : shL ? 'slow' : 'off');
    g.light('hr', mb ? 'fast' : ko ? 'off' : shR ? 'slow' : 'off');
    g.light('sky', mb ? 'fast' : 'slow');
    g.light('hq', extraLit ? 'blink' : superLit ? 'fast' : !ko && (shL || shR) ? 'slow' : 'off');
    g.light('extraBall', extraLit ? 'blink' : 'off');
    g.light('jackpot', mb ? 'blink' : 'off');
    g.light('powA', pow.powA ? 'on' : 'off');
    g.light('powB', pow.powB ? 'on' : 'off');
  }

  function bossHud(g: Game): string {
    const look = bossLook(level);
    const max = bossMaxHp(level);
    const pct = Math.max(0, Math.round((hp / max) * 100));
    if (ko) {
      return `<div><b>${look.name}</b> LV${level + 1} … KO!</div><div class="hpbar"><i style="width:0%"></i></div><div>ジャックポット ${jackpotValue.toLocaleString()}</div>`;
    }
    const shield = `${shL ? '■' : '□'}${shR ? '■' : '□'}`;
    return (
      `<div><b>${look.name}</b> LV${level + 1}</div>` +
      `<div class="hpbar"><i style="width:${pct}%"></i></div>` +
      `<div>HP ${hp}/${max}　盾 ${shield}</div>` +
      `<div>ボーナス倍率 x${g.bonusMult}</div>`
    );
  }

  function pushVars(g: Game) {
    g.vars.bossHp = hp / bossMaxHp(level);
    g.vars.bossLevel = level;
    g.vars.bossKo = ko ? 1 : 0;
    g.vars.shL = shL ? 1 : 0;
    g.vars.shR = shR ? 1 : 0;
  }

  return {
    init(g) {
      syncMissionLights(g);
      syncBonusLights(g);
      g.light('orbitL', 'slow');
      g.light('orbitR', 'slow');
      pushVars(g);
      syncLights(g);
    },
    onBallStart(g) {
      hunted = bossHits = skyways = loops = spins = hqVisits = missionsThisBall = 0;
      pow.powA = pow.powB = false;
      g.table.resetBank('hl', 0.05);
      g.table.resetBank('hr', 0.05);
      // 最初のボールだけキックバックが点灯している
      if (g.ball === 1) {
        g.part<KickbackRT>('kickbackL').lit = true;
        g.light('kickbackL', 'on');
      }
      syncBonusLights(g);
      pushVars(g);
      syncLights(g);
    },
    onEvent(g, e) {
      missions.handle(g, e);
      switch (e.type) {
        case 'drop':
          hunted++;
          break;
        case 'bank':
          g.addScore(20_000, e.x, e.y);
          g.table.resetBank(e.id, 1.4);
          if (ko) {
            jackpotValue += 50_000;
            g.msg('JACKPOT UP', `ジャックポット ${jackpotValue.toLocaleString()}`, 1.4, 'small');
          } else breakShield(g, e.id === 'hl' ? 'L' : 'R');
          break;
        case 'standup':
          if (e.id === 'boss') hitBoss(g, e);
          else if (e.id === 'powA' || e.id === 'powB') {
            pow[e.id] = true;
            if (pow.powA && pow.powB) {
              pow.powA = pow.powB = false;
              const kb = g.part<KickbackRT>('kickbackL');
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
          g.addScore(3_000 * (g.multiballActive ? 3 : 1));
          g.fx('burst', e.x, e.y, { color: YELLOW });
          break;
        case 'ramp':
          skyways++;
          if (g.multiballActive) {
            tryJackpot(g, e.x, e.y);
          } else if (!ko) {
            g.fx('comic', BOSS_AT[0], BOSS_AT[1] - 1.3, { text: 'ZAP!', color: CYAN });
            g.msg('SKYWAY', 'ボスに2ダメージ！', 1.2, 'small');
            g.sfx('boss');
            damage(g, 2, BOSS_AT[0], BOSS_AT[1] - 1.3);
          }
          break;
        case 'kickback':
          g.light('kickbackL', 'off');
          g.msg('KICKBACK', 'セーフ！', 1.2);
          break;
        case 'scoop': {
          hqVisits++;
          const scoop = g.part<ScoopRT>('hq');
          if (superLit && g.multiballActive) {
            superLit = false;
            scoop.holdFor(1.6);
            g.jackpot(jackpotValue * 2, e.x, e.y);
            g.fx('confetti', e.x, e.y);
          } else if (extraLit) {
            extraLit = false;
            extraGiven = true;
            scoop.holdFor(1.4);
            g.extraBall();
          } else if (!ko && breakShield(g, 'R')) {
            scoop.holdFor(0.4);
            g.addScore(10_000, e.x, e.y);
          } else {
            g.addScore(10_000, e.x, e.y);
            g.msg('HQ', '本部で補給！ +10,000', 1.0, 'small');
          }
          break;
        }
      }
    },
    update(g, dt) {
      // タイトル/ステージ選択のデモはマルチボールが終わらない仕組みなので、倒れたボスを少しして復活させる
      if (g.attract && ko) {
        demoKo += dt;
        if (demoKo > 6) {
          demoKo = 0;
          g.multiballActive = false;
          nextBoss(g);
        }
      }
      if (!ko) {
        if (!shL) {
          regenL -= dt;
          if (regenL <= 0) {
            shL = true;
            g.msg('SHIELD UP', 'ボスの盾が復活…', 1.4, 'small');
          }
        }
        if (!shR) {
          regenR -= dt;
          if (regenR <= 0) {
            shR = true;
            g.msg('SHIELD UP', 'ボスの盾が復活…', 1.4, 'small');
          }
        }
      }
      if (g.multiballActive) {
        g.hud.mission = 'JACKPOT';
        g.hud.missionSub = superLit ? 'HQ でスーパージャックポット！' : 'ボスを殴るたびにジャックポット';
        g.hud.progress = `${jackpotValue.toLocaleString()}`;
      } else if (ko) {
        g.hud.mission = 'BOSS DOWN';
        g.hud.missionSub = 'もうすぐマルチボール！';
        g.hud.progress = '';
      } else {
        missions.hud(g);
      }
      g.hud.extra = bossHud(g);
      pushVars(g);
      syncLights(g);
      syncMissionLights(g);
    },
    onBallEnd(g) {
      // マルチボールが始まる前/最中にボールが尽きたとき：次のボスへ
      if (ko) nextBoss(g);
      setSong(g, 0);
      g.vars.say = -1;
    },
    onMultiballEnd(g) {
      if (ko) nextBoss(g);
      setSong(g, 0);
      g.msg('MULTIBALL END', 'ヒーローの勝利！ 次のボスが来るぞ', 2);
    },
    bonus() {
      return [
        { label: 'HENCHMEN', count: hunted, each: 1_500 },
        { label: 'BOSS HITS', count: bossHits, each: 4_000 },
        { label: 'SKYWAYS', count: skyways, each: 8_000 },
        { label: 'ORBITS', count: loops, each: 3_000 },
        { label: 'HQ', count: hqVisits, each: 5_000 },
        { label: 'SPINS', count: spins, each: 100 },
        { label: 'MISSIONS', count: missionsThisBall, each: 25_000 },
      ];
    },
  };
}
