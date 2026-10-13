// CYBER のルール。
//   ハッキング：左バス(L)・上のレーン(T)・右バス(R)を「光っている順」に通す → ファイアウォール消滅（台が書き換わる）
//     + 周回で OVERCLOCK（得点2倍）/ LOW-G（重力0.45）/ OVERLOAD（両方）
//   ROOT：ファイアウォールが消えたチャンバーに入ると磁石が捕まえて投げ返す（ROOT ACCESS）
//   ミッション4つ → CORE でマルチボール（ZERO DAY）→ ワープでジャックポット、ROOT でスーパー
import { LaneSet, Missions } from '../../core/missions';
import type { Game } from '../../core/game';
import type { KickbackRT, MagnetRT, ScoopRT, TableEvent, TableEventType } from '../../table/table';
import type { BonusLine, StageRules } from '../types';
import { FIREWALL_TAGS, ROOT } from './layout';

export type Node = 'L' | 'T' | 'R';

/** ハッキングの順番（周回ごとに変わる） */
export const SEQS: Node[][] = [
  ['L', 'T', 'R'],
  ['R', 'T', 'L'],
  ['T', 'L', 'R'],
  ['T', 'R', 'L'],
];
const NODE_LIGHT: Record<Node, string> = { L: 'nodeL', T: 'nodeT', R: 'nodeR' };
const NODE_NAME: Record<Node, string> = { L: 'LEFT BUS', T: 'TOP BUS', R: 'RIGHT BUS' };
const NODE_JP: Record<Node, string> = { L: '左バス', T: '上のレーン', R: '右バス' };

/** ハッキング成功ごとの追加効果（FIREWALL DOWN は毎回） */
type Kit = { name: string; jp: string; oc: number; low: number };
const KITS: Kit[] = [
  { name: 'OVERCLOCK', jp: 'バンパー暴走！ 得点2倍', oc: 16, low: 0 },
  { name: 'LOW-G', jp: '重力ダウン！ ボールがふわふわ', oc: 0, low: 16 },
  { name: 'OVERLOAD', jp: '得点2倍 + 低重力！', oc: 12, low: 12 },
];

export const LOW_G = 0.45;
const HACK_WINDOW = 40;
const FIREWALL_OPEN = 36;

const synth = (type: TableEventType, id: string, x = 0.75, y = 20): TableEvent => ({ type, id, ball: null, x, y, speed: 0 });

export function createRules(): StageRules {
  // ── ボールごとのカウンター（ボーナス集計用）──
  let nodesPassed = 0;
  let hacksBall = 0;
  let warpsBall = 0;
  let targetsBall = 0;
  let rootsBall = 0;
  let missionsBall = 0;
  let spins = 0;

  // ── ハッキングの状態 ──
  let seqNo = 0; // 何回目のハッキングか（順番と効果の選択に使う）
  let step = 0;
  let seqTimer = 0;
  const seq = (): Node[] => SEQS[seqNo % SEQS.length];

  // ── ファイアウォール ──
  let fwDown = false;
  let fwTimer = 0;
  let fwForced = false; // マルチボール中はずっと開ける
  let wantUp = false;

  // ── モード ──
  let oc = 0;
  let low = 0;
  let glitchKick = 0;

  // ── 進行 ──
  let roots = 0;
  let mbReady = false;
  let inMb = false;
  let extraLit = false;
  let extraGiven = false;
  let jackpotValue = 300_000;
  let jackpots = 0;
  let superLit = false;
  let jpNext: 'w1' | 'w2' | null = null;
  let hackMsgFlash = 0;
  const stand = { ant1: false, ant2: false };

  const lanes = new LaneSet(['ln1', 'ln2', 'ln3', 'ln4'], ['ln1', 'ln2', 'ln3', 'ln4'], (g) => {
    g.bonusMult = Math.min(5, g.bonusMult + 1);
    g.addScore(25_000);
    g.msg(`BONUS x${g.bonusMult}`, 'A B C D そろった！ ボーナス倍率アップ', 2, 'normal');
    syncBonusLights(g);
  });

  const missions = new Missions(
    [
      { id: 'breach', name: 'BREACH', desc: 'ハッキングレーンを光る順に通して、ファイアウォールを破れ', goal: 1, count: (e) => (e.type === 'trigger' && e.id === 'hack' ? 1 : 0), reward: 60_000 },
      { id: 'tunnel', name: 'TUNNELING', desc: 'ワープチューブを通り抜けろ', goal: 2, count: (e) => (e.type === 'warp' ? 1 : 0), reward: 80_000 },
      { id: 'scan', name: 'PORT SCAN', desc: '右のドロップターゲット3枚を倒し切れ', goal: 2, count: (e) => (e.type === 'bank' ? 1 : 0), reward: 100_000 },
      { id: 'root', name: 'ROOT ACCESS', desc: 'ファイアウォールが消えたら、中央の ROOT チャンバーへ入れ', goal: 1, count: (e) => (e.type === 'magnet' && e.id === 'root' ? 1 : 0), reward: 150_000 },
    ],
    {
      onComplete(_m, g) {
        missionsBall++;
        syncMissionLights(g);
      },
      onAllComplete(g) {
        missionsBall++;
        syncMissionLights(g);
        mbReady = true;
        g.light('core', 'fast');
        g.msg('ZERO DAY READY', 'CORE（右のスクープ）に入れてマルチボール！', 3, 'big');
        g.fx('glitch', 0.75, 20, { value: 0.8 });
      },
    },
  );

  // ───────── ライト ─────────

  function syncBonusLights(g: Game) {
    for (let k = 2; k <= 5; k++) g.light(`x${k}`, g.bonusMult >= k ? 'on' : 'off');
  }
  function syncMissionLights(g: Game) {
    ['m1', 'm2', 'm3', 'm4'].forEach((id, i) => g.light(id, i < missions.index || !missions.active ? 'on' : i === missions.index ? 'blink' : 'off'));
  }
  function syncNodes(g: Game) {
    const s = seq();
    (['L', 'T', 'R'] as Node[]).forEach((n) => {
      const i = s.indexOf(n);
      g.light(NODE_LIGHT[n], i < step ? 'on' : i === step ? 'fast' : 'slow');
    });
  }
  function syncCoreLights(g: Game) {
    const mb = g.multiballActive;
    g.light('w1', mb ? (jpNext === 'w2' ? 'off' : 'fast') : 'slow');
    g.light('w2', mb ? (jpNext === 'w1' ? 'off' : 'fast') : 'slow');
    g.light('jackpot', mb ? 'blink' : 'off');
    g.light('core', mbReady ? 'fast' : extraLit ? 'blink' : 'off');
    g.light('root', fwDown ? 'fast' : 'off');
  }

  // ───────── ファイアウォール ─────────

  function applyFirewall(g: Game) {
    for (const tag of FIREWALL_TAGS) for (const s of g.table.shapesByTag(tag)) s.enabled = !fwDown;
    const m = g.part<MagnetRT>('root');
    m.active = fwDown;
    m.mode = 'grab';
    m.throwAngle = 270;
    m.throwSpeed = 20;
  }
  function openFirewall(g: Game, seconds: number, forced = false) {
    wantUp = false;
    fwDown = true;
    fwForced = fwForced || forced;
    fwTimer = Math.max(fwTimer, seconds);
    applyFirewall(g);
    syncCoreLights(g);
  }
  /** チャンバーの中（と入口のすぐ下）にボールがいない */
  function chamberClear(g: Game): boolean {
    const x0 = ROOT.x - ROOT.w - 0.3, x1 = ROOT.x + ROOT.w + 0.3, y0 = ROOT.y0 - 0.8, y1 = ROOT.y1 + 0.3;
    for (const b of g.balls) {
      if (!b.active) continue;
      if (b.x > x0 && b.x < x1 && b.y > y0 && b.y < y1) return false;
    }
    return g.part<MagnetRT>('root').held.length === 0;
  }
  function closeFirewall(g: Game) {
    fwDown = false;
    fwForced = false;
    wantUp = false;
    fwTimer = 0;
    applyFirewall(g);
    syncCoreLights(g);
  }

  // ───────── ハッキング ─────────

  function resetSeq(g: Game, timedOut: boolean) {
    if (timedOut && step > 0) g.msg('TRACED', '時間切れ… ハッキングやり直し', 1.6, 'small');
    step = 0;
    seqTimer = 0;
    syncNodes(g);
  }

  function nodeHit(g: Game, node: Node, x: number, y: number) {
    if (g.tilted) return;
    const s = seq();
    if (s[step] !== node) return;
    step++;
    nodesPassed++;
    g.fx('burst', x, y, { color: '#05d9e8' });
    if (step === 1) seqTimer = HACK_WINDOW;
    if (step >= s.length) {
      hackComplete(g);
      return;
    }
    const next = s[step];
    g.msg(`NODE ${step}/${s.length}`, `次は ${NODE_JP[next]}（${NODE_NAME[next]}）を通せ`, 1.6, 'normal');
    g.sfx('node');
    syncNodes(g);
  }

  function hackComplete(g: Game) {
    const kit = KITS[seqNo % KITS.length];
    seqNo++;
    hacksBall++;
    step = 0;
    seqTimer = 0;
    syncNodes(g);
    g.addScore(40_000);
    g.sfx('hackDone');
    g.fx('glitch', 0.75, 20, { value: 0.9 });
    g.fx('cutin', 0.75, 20, { text: 'FIREWALL DOWN', color: '#ff2a6d' });
    g.msg('FIREWALL DOWN', `ハッキング成功！ ROOT チャンバーが開いた … ${kit.name}`, 3, 'flash');
    g.shake(0.6);
    g.rumble(0.6, 0.8, 300);
    glitchKick = 1;
    hackMsgFlash = 2.5;
    openFirewall(g, FIREWALL_OPEN);
    if (kit.oc) oc = Math.max(oc, kit.oc);
    if (kit.low) low = Math.max(low, kit.low);
    if (kit.oc || kit.low) {
      g.after(1.4, () => {
        g.msg(kit.name, kit.jp, 2.4, 'big');
        g.sfx(kit.low ? 'lowg' : 'overclock');
      });
    }
    if (g.multiballActive) {
      superLit = true;
      g.after(3.4, () => g.msg('SUPER JACKPOT LIT', 'ROOT チャンバーでスーパージャックポット！', 2.2));
    }
    missions.handle(g, synth('trigger', 'hack'));
    syncCoreLights(g);
  }

  // ───────── ROOT ─────────

  function rootAccess(g: Game, e: TableEvent) {
    const m = g.part<MagnetRT>('root');
    m.holdFor(1.15);
    g.sfx('rootIn');
    m.throwAngle = 270 + g.rng.range(-9, 9);
    m.throwSpeed = 19 + g.rng.range(0, 3);
    g.fx('glitch', e.x, e.y, { value: 1.2 });
    g.fx('confetti', e.x, e.y);
    if (g.multiballActive) {
      if (superLit) {
        superLit = false;
        g.jackpot(jackpotValue * 3, e.x, e.y);
        g.msg('SUPER JACKPOT', `${(jackpotValue * 3).toLocaleString()} 点！`, 2.6, 'normal');
      } else {
        g.addScore(75_000, e.x, e.y);
        g.msg('ROOT ACCESS', 'スーパージャックポット点灯中に ROOT へ！', 1.6, 'small');
      }
      rootsBall++;
      roots++;
      syncCoreLights(g);
      return;
    }
    roots++;
    rootsBall++;
    const v = g.addScore(100_000 + roots * 50_000, e.x, e.y);
    g.msg('ROOT ACCESS', `管理者権限を奪取！ +${v.toLocaleString()}`, 2.6, 'big');
    g.ballSave(6);
    if (roots >= 2 && !extraGiven && !extraLit) {
      extraLit = true;
      g.light('extraBall', 'blink');
      g.after(2.4, () => g.msg('EXTRA BALL LIT', 'CORE（右のスクープ）でエクストラボール', 2.4));
    }
    // 使い終わったら壁を戻す（ボールが出てから）
    wantUp = true;
    syncCoreLights(g);
  }

  function endMultiball(g: Game, announce: boolean) {
    inMb = false;
    superLit = false;
    jpNext = null;
    fwForced = false;
    wantUp = true;
    missions.restart();
    syncMissionLights(g);
    syncCoreLights(g);
    g.song(0);
    if (announce) g.msg('MULTIBALL END', '次のミッションへ（目標アップ）', 2);
  }

  // ───────── ルール本体 ─────────

  let lanesBonusMult = 1;
  function hudExtra(): string {
    const s = seq();
    const seqHtml = s
      .map((n, i) =>
        i < step ? `<b style="color:#6dff9c">${n}</b>` : i === step ? `<b style="color:#ffe14a;text-shadow:0 0 6px #ffe14a">[${n}]</b>` : `<span style="opacity:.55">${n}</span>`,
      )
      .join(' › ');
    const lines = [`<div>HACK&nbsp; ${seqHtml}${step > 0 ? ` <small style="opacity:.7">${Math.ceil(seqTimer)}s</small>` : ''}</div>`];
    lines.push(
      fwDown
        ? `<div style="color:#ff2a6d">FIREWALL DOWN${fwForced ? '' : ` <small>${Math.ceil(fwTimer)}s</small>`}</div>`
        : `<div style="opacity:.7">FIREWALL <small>ACTIVE</small></div>`,
    );
    if (oc > 0) lines.push(`<div style="color:#ffe14a">OVERCLOCK x2 <small>${Math.ceil(oc)}s</small></div>`);
    if (low > 0) lines.push(`<div style="color:#b967ff">LOW-G <small>${Math.ceil(low)}s</small></div>`);
    lines.push(`<div>ジャックポット ${jackpotValue.toLocaleString()}</div><div>ボーナス倍率 x${lanesBonusMult}</div>`);
    return lines.join('');
  }
  return {
    init(g: Game) {
      g.vars.glitch = 0;
      syncMissionLights(g);
      syncNodes(g);
      applyFirewall(g);
      syncCoreLights(g);
    },

    onBallStart(g: Game) {
      nodesPassed = hacksBall = warpsBall = targetsBall = rootsBall = missionsBall = spins = 0;
      step = 0;
      seqTimer = 0;
      oc = low = 0;
      fwForced = false;
      closeFirewall(g);
      g.world.gravityScale = 1;
      lanes.reset(g);
      syncBonusLights(g);
      syncNodes(g);
      syncCoreLights(g);
      stand.ant1 = stand.ant2 = false;
      g.light('ant1', 'off');
      g.light('ant2', 'off');
      g.light('kickbackR', 'off');
      g.part<KickbackRT>('kickbackR').lit = false;
    },

    onBallEnd(g: Game) {
      oc = low = 0;
      g.world.gravityScale = 1;
      g.vars.glitch = 0;
      // マルチボールの途中でボールが尽きたとき：後始末（onMultiballEnd が呼ばれない経路）
      if (inMb) endMultiball(g, false);
    },

    onFlip(g: Game, side: 'left' | 'right') {
      lanes.rotate(g, side === 'left' ? -1 : 1);
    },

    onEvent(g: Game, e: TableEvent) {
      missions.handle(g, e);
      switch (e.type) {
        case 'trigger':
          if (e.id === 'loopL') nodeHit(g, 'L', e.x, e.y);
          else if (e.id === 'loopR') nodeHit(g, 'R', e.x, e.y);
          g.addScore(2_000);
          break;
        case 'rollover':
          if (e.id.startsWith('ln')) {
            if (lanes.hit(g, e.id)) g.addScore(2_000);
            nodeHit(g, 'T', e.x, e.y);
          }
          break;
        case 'spinner':
          spins++;
          break;
        case 'bumper':
          if (oc > 0) g.fx('burst', e.x, e.y, { color: '#ffe14a' });
          break;
        case 'drop':
        case 'standup':
          targetsBall++;
          if (e.type === 'standup' && (e.id === 'ant1' || e.id === 'ant2')) {
            stand[e.id] = true;
            g.light(e.id, 'on');
            if (stand.ant1 && stand.ant2) {
              stand.ant1 = stand.ant2 = false;
              g.after(0.6, () => {
                g.light('ant1', 'off');
                g.light('ant2', 'off');
              });
              const kb = g.part<KickbackRT>('kickbackR');
              if (!kb.lit) {
                kb.lit = true;
                g.light('kickbackR', 'on');
                g.msg('KICKBACK LIT', '右アウトレーンのキックバック点灯', 1.8);
              } else g.addScore(15_000);
            }
          }
          break;
        case 'bank':
          g.addScore(20_000);
          g.msg('PORT SCAN', 'ポートを全部スキャン！', 1.4, 'small');
          g.table.resetBank(e.id, g.multiballActive ? 4 : 2.2);
          break;
        case 'kickback':
          g.light('kickbackR', 'off');
          g.msg('KICKBACK', 'セーフ！', 1.2);
          break;
        case 'warp': {
          warpsBall++;
          g.fx('glitch', e.x, e.y, { value: 0.9 });
          if (g.multiballActive) {
            const lit = jpNext === null || jpNext === e.id;
            if (lit) {
              g.jackpot(jackpotValue, e.x, e.y);
              jackpotValue += 75_000;
              jackpots++;
              jpNext = e.id === 'w1' ? 'w2' : 'w1';
              if (jackpots % 2 === 0) {
                superLit = true;
                g.msg('SUPER JACKPOT LIT', 'ROOT チャンバーでスーパージャックポット！', 2.2);
              }
            } else {
              g.addScore(10_000, e.x, e.y);
              g.msg('WRONG TUNNEL', '光っているワープから入れ！', 1.2, 'small');
            }
            syncCoreLights(g);
          } else {
            g.msg('WARP', `ワープ ${warpsBall}回目`, 1.0, 'small');
          }
          break;
        }
        case 'magnet':
          if (e.id === 'root') rootAccess(g, e);
          break;
        case 'scoop': {
          const scoop = g.part<ScoopRT>('core');
          if (mbReady && !g.multiballActive) {
            mbReady = false;
            inMb = true;
            jackpots = 0;
            jpNext = null;
            superLit = false;
            scoop.holdFor(2.2);
            g.msg('ZERO DAY', 'マルチボール！ 光るワープでジャックポット！', 3, 'flash');
            g.fx('cutin', e.x, e.y, { text: 'ZERO DAY', color: '#b967ff' });
            g.fx('glitch', e.x, e.y, { value: 1.0 });
            g.song(1);
            openFirewall(g, 9999, true);
            g.after(1.2, () => g.startMultiball(2, 12));
          } else if (extraLit) {
            extraLit = false;
            extraGiven = true;
            g.light('extraBall', 'off');
            scoop.holdFor(1.4);
            g.extraBall();
          } else {
            g.msg('CORE', 'ボーナス +5,000', 1.0, 'small');
          }
          syncCoreLights(g);
          break;
        }
      }
    },

    update(g: Game, dt: number) {
      // ハッキングの制限時間
      if (step > 0) {
        seqTimer -= dt;
        if (seqTimer <= 0) resetSeq(g, true);
      }
      // ファイアウォール：時間が来たら（チャンバーが空になってから）閉じる
      if (fwDown && !fwForced) {
        fwTimer -= dt;
        if (fwTimer <= 0) wantUp = true;
      }
      if (fwDown && wantUp && chamberClear(g)) {
        closeFirewall(g);
        g.msg('FIREWALL UP', 'ファイアウォール復旧', 1.4, 'small');
        g.fx('glitch', ROOT.x, ROOT.y0, { value: 0.8 });
        g.sfx('fwUp');
      }
      // モード
      const wasLow = low > 0;
      const wasOc = oc > 0;
      if (oc > 0) oc = Math.max(0, oc - dt);
      if (low > 0) low = Math.max(0, low - dt);
      g.world.gravityScale = low > 0 ? LOW_G : 1;
      g.pfMult = oc > 0 ? 2 : 1;
      if (wasLow && low <= 0) g.msg('GRAVITY NORMAL', '重力がもとに戻った', 1.4, 'small');
      if (wasOc && oc <= 0) g.msg('OVERCLOCK END', '得点倍率がもとに戻った', 1.4, 'small');

      // 見た目用の値（decorate / グリッチが読む）
      glitchKick = Math.max(0, glitchKick - dt * 0.8);
      hackMsgFlash = Math.max(0, hackMsgFlash - dt);
      g.vars.fw = fwDown ? 0 : 1;
      g.vars.oc = oc > 0 ? 1 : 0;
      g.vars.low = low > 0 ? 1 : 0;
      g.vars.hackStep = step;
      g.vars.hackNext = step < seq().length ? ['L', 'T', 'R'].indexOf(seq()[step]) : -1;
      g.vars.mb = g.multiballActive ? 1 : 0;
      g.vars.glitch = Math.min(1.6, (low > 0 ? 0.22 + 0.1 * Math.sin(g.time * 3) : 0) + (oc > 0 ? 0.16 : 0) + (g.multiballActive ? 0.14 : 0) + glitchKick * 0.55 + (step > 0 ? 0.04 : 0));
      lanesBonusMult = g.bonusMult;

      // HUD
      if (g.multiballActive) {
        g.hud.mission = 'JACKPOT';
        g.hud.missionSub = superLit ? 'ROOT チャンバーでスーパージャックポット！' : jpNext ? `光っているワープ（${jpNext.toUpperCase()}）でジャックポット` : '光っているワープでジャックポット';
        g.hud.progress = jackpotValue.toLocaleString();
      } else if (mbReady) {
        missions.hud(g, 'ZERO DAY READY', 'CORE（右のスクープ）に入れてマルチボール');
      } else {
        missions.hud(g);
      }
      g.hud.extra = hudExtra();
    },

    onMultiballEnd(g: Game) {
      endMultiball(g, true);
    },

    bonus(): BonusLine[] {
      return [
        { label: 'NODES', count: nodesPassed, each: 3_000 },
        { label: 'HACKS', count: hacksBall, each: 30_000 },
        { label: 'WARPS', count: warpsBall, each: 5_000 },
        { label: 'ROOT', count: rootsBall, each: 40_000 },
        { label: 'TARGETS', count: targetsBall, each: 1_000 },
        { label: 'SPINS', count: spins, each: 100 },
        { label: 'MISSIONS', count: missionsBall, each: 25_000 },
      ];
    },
  };
}
