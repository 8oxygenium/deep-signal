// UKIYO-E のルール。
// ・ミッション（ランク制）：鳥居をくぐる → 鯉の滝を登る → 龍のランプ → 七福神。全部達成すると社殿が光る。
// ・七福神：参道・左のレーン・上の布袋の的を当てて7人そろえると社殿が開き、スクープに入れると「七福神揃い踏み」の見得でジャックポット。
// ・大波マルチボール：ミッション全達成後に社殿のスクープへ入れると、見得 → 大波が台を横切る → ボールが増える。
//   マルチボール中は2本のランプがジャックポット。七福神をそろえるとスーパージャックポット。
// ・松竹梅のレーンをそろえるとボーナス倍率＋キックバック点灯。社殿はふだんは「おみくじ」。
import type { Game } from '../../core/game';
import { LaneSet, Missions } from '../../core/missions';
import type { KickbackRT, ScoopRT, TableEvent } from '../../table/table';
import type { BonusLine, StageRules } from '../types';
import { GODS, LANES, SHRINE } from './layout';

export const UKIYOE_RANKS = ['MINARAI', 'WAKASHU', 'KAOYAKU', 'SHINUCHI', 'OYAKATA', 'IEMOTO', 'KOKUHO'];

const INK = '#17110c';
const RED = '#b3201a';
const INDIGO = '#1f3f7a';

const OMIKUJI = [
  { en: 'DAIKICHI', jp: '大吉', pts: 50_000, w: 1 },
  { en: 'CHUKICHI', jp: '中吉', pts: 25_000, w: 2 },
  { en: 'KICHI', jp: '吉', pts: 10_000, w: 3 },
  { en: 'SUEKICHI', jp: '末吉', pts: 5_000, w: 3 },
  { en: 'KYO', jp: '凶', pts: 1_000, w: 1 },
];

export function ukiyoeRules(): StageRules {
  // ── 状態（ゲームを通して持ち越す）──
  const collected = new Set<string>();
  const kb = { L: true, R: false };
  let godsReady = false;
  let waveReady = false;
  let extraLit = false;
  let extraGiven = false;
  let waveBusy = false;
  let jackpotValue = 300_000;
  let godsRounds = 0;
  let waveRounds = 0;
  let mbSong = false;
  // ── ボールごとの集計（ボーナス用）──
  let godHits = 0;
  let toriis = 0;
  let koiRamps = 0;
  let ryuRamps = 0;
  let loops = 0;
  let spins = 0;
  let missionsThisBall = 0;
  // 筆文字の出しすぎ防止
  const brushAt = new Map<string, number>();

  function brush(g: Game, key: string, x: number, y: number, text: string, color = INK, size = 1.5, cool = 0.22): void {
    const last = brushAt.get(key) ?? -9;
    if (g.time - last < cool) return;
    brushAt.set(key, g.time);
    g.fx('brush', x, y, { text, color, value: size });
  }

  /** 消えているキックバックを1つ点灯（左 → 右の順）。点灯できたら true */
  function relightKickback(g: Game): boolean {
    if (!kb.L) {
      kb.L = true;
      g.part<KickbackRT>('kickbackL').lit = true;
      return true;
    }
    if (!kb.R) {
      kb.R = true;
      g.part<KickbackRT>('kickbackR').lit = true;
      return true;
    }
    return false;
  }

  const lanes = new LaneSet(
    LANES.map((l) => l.id),
    LANES.map((l) => l.id),
    (g) => {
      g.bonusMult = Math.min(5, g.bonusMult + 1);
      g.addScore(25_000);
      g.msg(`BONUS x${g.bonusMult}`, '松・竹・梅 そろった！ ボーナス倍率アップ', 2, 'normal');
      g.fx('petals', 0.75, 33, { value: 28 });
      brush(g, 'lanes', 0.75, 33.5, '松竹梅！', '#2f6a30', 1.7, 0.5);
      relightKickback(g);
      syncLights(g);
    },
  );

  const missions = new Missions(
    [
      { id: 'omairi', name: 'OMAIRI', desc: '鳥居をくぐって参道へ入れ', goal: 3, count: (e) => (e.type === 'trigger' && e.id === 'torii' ? 1 : 0), reward: 50_000 },
      { id: 'taki', name: 'TAKINOBORI', desc: '鯉の滝（左のランプ）を駆け上がれ', goal: 2, count: (e) => (e.type === 'ramp' && e.id === 'koi' ? 1 : 0), reward: 75_000 },
      { id: 'ryu', name: 'NOBORIRYU', desc: '龍のランプ（右）を通せ', goal: 2, count: (e) => (e.type === 'ramp' && e.id === 'ryu' ? 1 : 0), reward: 100_000 },
      { id: 'fuku', name: 'SHICHIFUKU', desc: '七福神の的を当てろ', goal: 5, count: (e) => (e.type === 'standup' ? 1 : 0), reward: 125_000 },
    ],
    {
      onComplete(m, g) {
        missionsThisBall++;
        syncMissionLights(g);
        // 鳥居（1つ目）を達成するとキックバックが戻る
        if (m.id === 'omairi' && relightKickback(g)) g.msg('KICKBACK LIT', 'アウトレーンのキックバックが戻った', 1.8);
        // 2つ目（滝）を達成したら一度だけエクストラボールを点灯
        if (m.id === 'taki' && !extraGiven && !extraLit) {
          extraLit = true;
          g.msg('EXTRA BALL LIT', '社殿のスクープでエクストラボール', 2.4, 'normal');
        }
      },
      onAllComplete(g) {
        missionsThisBall++;
        syncMissionLights(g);
        waveReady = true;
        g.msg('NAMI READY', '社殿のスクープへ！ 大波マルチボール', 3, 'big');
        syncLights(g);
      },
    },
  );

  // ───────── 表示まわり ─────────

  function syncMissionLights(g: Game): void {
    ['m1', 'm2', 'm3', 'm4'].forEach((id, i) => g.light(id, !missions.active || i < missions.index ? 'on' : i === missions.index ? 'blink' : 'off'));
  }

  function syncBonusLights(g: Game): void {
    for (let k = 2; k <= 5; k++) g.light(`x${k}`, g.bonusMult >= k ? 'on' : 'off');
  }

  function syncLights(g: Game): void {
    const mb = g.multiballActive;
    g.light('koi', mb ? 'fast' : 'slow');
    g.light('ryu', mb ? 'fast' : 'slow');
    g.light('torii', 'slow');
    g.light('shrine', godsReady ? 'fast' : waveReady && !mb ? 'fast' : extraLit ? 'blink' : 'off');
    g.light('extraBall', extraLit ? 'blink' : 'off');
    g.light('jackpot', mb ? 'blink' : 'off');
    g.light('kickbackL', kb.L ? 'on' : 'off');
    g.light('kickbackR', kb.R ? 'on' : 'off');
    for (const god of GODS) g.light(god.id, collected.has(god.id) ? (godsReady ? 'fast' : 'on') : 'off');
  }

  function godsRow(): string {
    return GODS.map((god) => {
      const on = collected.has(god.id);
      return `<span style="color:${on ? god.color : 'rgba(27,18,10,0.28)'};font-weight:900">${god.name.charAt(0)}</span>`;
    }).join(' ');
  }

  // ───────── 七福神 ─────────

  function godHit(g: Game, e: TableEvent): void {
    const god = GODS.find((x) => x.id === e.id);
    if (!god) return;
    godHits++;
    if (collected.has(god.id)) {
      g.addScore(500, e.x, e.y);
      brush(g, 'god', e.x, e.y, 'カッ！', INK, 1.2, 0.3);
      return;
    }
    collected.add(god.id);
    const n = collected.size;
    g.addScore(5_000 * n, e.x, e.y);
    g.light(god.id, 'on');
    brush(g, 'god', e.x, e.y, `${god.name}！`, god.color, 1.6, 0.1);
    g.fx('stars', e.x, e.y, { color: god.color });
    g.msg(god.en, `${god.name}を迎えた！ ${n}/7`, 1.6, 'small');
    if (g.multiballActive) jackpotValue += 25_000;
    if (n >= GODS.length) allGods(g, e);
  }

  function allGods(g: Game, e: TableEvent): void {
    if (g.multiballActive) {
      // マルチボール中はその場でスーパージャックポット
      collected.clear();
      godsRounds++;
      g.jackpot(jackpotValue * 3, e.x, e.y);
      g.fx('confetti', e.x, e.y);
      g.fx('petals', e.x, e.y, { value: 40 });
      brush(g, 'jp', e.x, e.y + 1.2, '七福神！', RED, 2.0, 0.5);
      g.after(0.8, () => syncLights(g));
      jackpotValue += 100_000;
      return;
    }
    godsReady = true;
    g.msg('SHICHIFUKU READY', '七福神そろい！ 社殿のスクープへ', 3, 'big');
    g.sfx('rank');
    g.fx('petals', SHRINE[0], SHRINE[1], { value: 40 });
    syncLights(g);
  }

  function claimGods(g: Game, sc: ScoopRT, e: TableEvent): void {
    godsReady = false;
    godsRounds++;
    const value = 300_000 + 150_000 * (godsRounds - 1);
    sc.holdFor(3.7);
    g.fx('mie', 0, 0, { text: '七福神揃い踏み', color: '#c8161d' });
    g.sfx('tsuke');
    g.shake(0.5);
    collected.clear();
    g.after(2.5, () => {
      g.jackpot(value, e.x, e.y);
      g.fx('confetti', e.x, e.y);
      g.fx('petals', e.x, e.y, { value: 60 });
      brush(g, 'jp', e.x, e.y + 1.2, '大当たり！', RED, 2.0, 0.5);
      kb.L = kb.R = true;
      g.part<KickbackRT>('kickbackL').lit = true;
      g.part<KickbackRT>('kickbackR').lit = true;
      syncLights(g);
    });
  }

  // ───────── 大波マルチボール ─────────

  function startWave(g: Game, sc: ScoopRT, e: TableEvent): void {
    waveReady = false;
    waveBusy = true;
    waveRounds++;
    jackpotValue = 300_000 + 100_000 * (waveRounds - 1);
    sc.holdFor(5.9);
    g.fx('mie', 0, 0, { text: '神奈川沖浪裏', color: '#1f3f7a' });
    g.sfx('tsuke');
    g.shake(0.5);
    // 見得が明けたところへ大波が台を横切る
    g.after(2.4, () => {
      g.fx('wave', e.x, e.y);
      g.sfx('wave');
      g.shake(0.7);
    });
    // 波が引いたとき、ボールが増える（1球はプランジャーから、1球は波の上から）
    g.after(4.5, () => {
      g.startMultiball(1, 18);
      g.addBallAt(SHRINE[0] + (g.rng.next() - 0.5) * 3, 36.4, (g.rng.next() - 0.5) * 6, -6);
      mbSong = true;
      g.song(1);
      g.msg('NAMI MULTIBALL', '大波マルチボール！ ランプでジャックポット', 3, 'big');
      g.fx('petals', 0.75, 28, { value: 50 });
      brush(g, 'jp', 0.75, 30, 'ザブーン！', INDIGO, 2.0, 0.5);
      syncLights(g);
    });
    g.after(6.0, () => {
      waveBusy = false;
    });
  }

  // ───────── おみくじ・エクストラボール ─────────

  function omikuji(g: Game, sc: ScoopRT, e: TableEvent): void {
    const total = OMIKUJI.reduce((s, o) => s + o.w, 0);
    let r = g.rng.next() * total;
    let pick = OMIKUJI[0];
    for (const o of OMIKUJI) {
      r -= o.w;
      if (r <= 0) {
        pick = o;
        break;
      }
    }
    sc.holdFor(1.5);
    g.addScore(pick.pts, e.x, e.y);
    if (pick.pts >= 25_000) relightKickback(g);
    g.msg(`OMIKUJI ${pick.en}`, `おみくじ：${pick.jp}！ +${pick.pts.toLocaleString()}`, 1.8, pick.pts >= 25_000 ? 'normal' : 'small');
    brush(g, 'omikuji', e.x, e.y + 1.2, pick.jp + '！', pick.pts >= 25_000 ? RED : INK, 1.7, 0.4);
  }

  return {
    init(g) {
      syncMissionLights(g);
      g.light('orbitL', 'slow');
      g.light('orbitR', 'slow');
      syncLights(g);
    },

    onBallStart(g) {
      godHits = toriis = koiRamps = ryuRamps = loops = spins = missionsThisBall = 0;
      lanes.reset(g);
      syncBonusLights(g);
      // 発射したボールは左のオービットから落ちやすいので、左のキックバックは毎ボール点灯（右はミッションなどで点灯）
      kb.L = true;
      g.part<KickbackRT>('kickbackL').lit = kb.L;
      g.part<KickbackRT>('kickbackR').lit = kb.R;
      syncMissionLights(g);
      syncLights(g);
    },

    onFlip(g, side) {
      lanes.rotate(g, side === 'left' ? -1 : 1);
    },

    onEvent(g, e) {
      missions.handle(g, e);
      switch (e.type) {
        case 'bumper':
          brush(g, 'bumper', e.x, e.y, 'カーン！', RED, 1.3, 0.28);
          break;
        case 'sling':
          brush(g, 'sling', e.x, e.y, 'ドン！', INK, 1.6, 0.25);
          break;
        case 'rollover':
          if (lanes.hit(g, e.id)) g.addScore(2_000);
          break;
        case 'standup':
          godHit(g, e);
          break;
        case 'spinner':
          spins++;
          break;
        case 'trigger':
          if (e.id === 'torii') {
            toriis++;
            g.addScore(3_000, e.x, e.y);
            brush(g, 'torii', e.x, e.y + 0.6, '参拝！', RED, 1.4, 0.6);
            g.fx('burst', e.x, e.y, { color: '#e0b238' });
          } else if (e.id === 'loopL' || e.id === 'loopR') {
            loops++;
            g.addScore(5_000 * (g.multiballActive ? 3 : 1), e.x, e.y);
            g.fx('burst', e.x, e.y, { color: '#e0b238' });
          }
          break;
        case 'ramp-enter':
          brush(g, `re${e.id}`, e.x, e.y + 1.0, e.id === 'koi' ? 'ザザァ！' : 'ゴォォ！', e.id === 'koi' ? INDIGO : '#1f6b4a', 1.3, 0.8);
          break;
        case 'ramp':
          if (e.id === 'koi') koiRamps++;
          else ryuRamps++;
          g.fx('stars', e.x, e.y, { color: e.id === 'koi' ? '#4f9bd0' : '#2f9a6a' });
          if (g.multiballActive) {
            g.jackpot(jackpotValue, e.x, e.y);
            jackpotValue += 50_000;
            brush(g, 'jp', e.x, e.y, e.id === 'koi' ? '登竜門！' : '昇龍！', RED, 1.8, 0.4);
          } else {
            g.msg(e.id === 'koi' ? 'TAKINOBORI' : 'RYU', e.id === 'koi' ? `鯉の滝登り ${koiRamps}回目` : `龍のランプ ${ryuRamps}回目`, 1.0, 'small');
            brush(g, 'jp', e.x, e.y, e.id === 'koi' ? '滝登り！' : '昇龍！', e.id === 'koi' ? INDIGO : '#1f6b4a', 1.6, 0.4);
          }
          break;
        case 'kickback':
          if (e.id === 'kickbackL') kb.L = false;
          else kb.R = false;
          g.light(e.id, 'off');
          g.msg('KICKBACK', 'セーフ！', 1.2);
          brush(g, 'kick', e.x, e.y + 1, 'ドスッ！', INK, 1.5, 0.5);
          break;
        case 'scoop': {
          const sc = g.part<ScoopRT>('shrine');
          if (waveBusy) {
            sc.holdFor(1.0);
          } else if (godsReady) claimGods(g, sc, e);
          else if (waveReady && !g.multiballActive) startWave(g, sc, e);
          else if (extraLit) {
            extraLit = false;
            extraGiven = true;
            sc.holdFor(1.6);
            g.extraBall();
            g.fx('confetti', e.x, e.y);
            brush(g, 'jp', e.x, e.y + 1.2, '福来たる！', RED, 1.8, 0.5);
          } else omikuji(g, sc, e);
          break;
        }
      }
      syncLights(g);
    },

    update(g) {
      if (g.multiballActive) {
        g.hud.mission = 'JACKPOT';
        g.hud.missionSub = collected.size >= 5 ? '七福神をそろえてスーパージャックポット！' : '2本のランプを通すたびにジャックポット';
        g.hud.progress = jackpotValue.toLocaleString();
      } else if (godsReady) {
        g.hud.mission = 'SHICHIFUKU READY';
        g.hud.missionSub = '社殿のスクープに入れて七福神ジャックポット！';
        g.hud.progress = '';
      } else if (waveReady) {
        g.hud.mission = 'NAMI READY';
        g.hud.missionSub = '社殿のスクープへ！ 大波マルチボール';
        g.hud.progress = '';
      } else missions.hud(g);
      g.hud.extra = `<div>七福神 ${godsRow()}　${collected.size}/7</div><div>ジャックポット ${jackpotValue.toLocaleString()}</div><div>ボーナス倍率 x${g.bonusMult}</div>`;
      g.vars.gods = collected.size;
      g.vars.godsReady = godsReady ? 1 : 0;
      g.vars.mb = g.multiballActive ? 1 : 0;
      g.vars.waveReady = waveReady ? 1 : 0;
    },

    onBallEnd(g) {
      if (mbSong) {
        mbSong = false;
        g.song(0);
      }
      // 大波の途中でボールが…ということはないが、念のため
      waveBusy = false;
    },

    onMultiballEnd(g) {
      if (mbSong) {
        mbSong = false;
        g.song(0);
      }
      missions.restart();
      syncMissionLights(g);
      syncLights(g);
      g.msg('NAMI END', '波が引いた… 次のミッションへ（目標アップ）', 2);
    },

    bonus(): BonusLine[] {
      return [
        { label: 'GODS', count: godHits, each: 1_000 },
        { label: 'TORII', count: toriis, each: 3_000 },
        { label: 'RAMPS', count: koiRamps + ryuRamps, each: 5_000 },
        { label: 'LOOPS', count: loops, each: 3_000 },
        { label: 'WHEEL', count: Math.min(spins, 300), each: 100 },
        { label: 'MISSIONS', count: missionsThisBall, each: 25_000 },
      ];
    },
  };
}
