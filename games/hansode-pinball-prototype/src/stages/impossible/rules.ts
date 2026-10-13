// IMPOSSIBLE のルールと「理不尽ギミック」。
//  - ギミックは時間でランダムに発動。必ず予告（warn）→ 発動（start）→ 終了（end）の順で帯を出す
//  - 回転・傾き・重力・フリッパーの大きさ・仕切りの位置などは「目標値（Env）」を決め、毎フレーム少しずつ近づける
//    （急に変わって台の外へ出たり、ボールが挟まったりしないように）
import { LaneSet, Missions } from '../../core/missions';
import type { Game } from '../../core/game';
import type { Rng } from '../../core/rng';
import type { Circle, Seg } from '../../physics/shapes';
import type { BumperRT, ScoopRT, TableEvent } from '../../table/table';
import type { BonusLine, StageRules } from '../types';
import { DIV_TRAVEL, GRAV, TIRE_COUNT, TIRE_SPOTS, WALKERS, walkerPos, SEP } from './layout';

// ───────── 環境（ギミックが決める目標値） ─────────

interface Env {
  /** 台の回転（rad、反時計回りが+） */
  rot: number;
  pitch: number;
  /** 重力の倍率（傾斜が急） */
  steep: number;
  /** 重力の向き（1 = 下、-0.5 = 逆向き） */
  gravDir: number;
  dark: number;
  flipL: number;
  flipR: number;
  swap: boolean;
  divL: number;
  divR: number;
  bump: number;
}

const baseEnv = (): Env => ({ rot: 0, pitch: 0, steep: 1, gravDir: 1, dark: 0, flipL: 1, flipR: 1, swap: false, divL: 0, divR: 0, bump: 1 });

interface Ctx {
  g: Game;
  rng: Rng;
  /** タイヤの出現・消去などのためにルール本体から渡される */
  tires: { show(g: Game): void; hide(g: Game): void };
}

interface Run {
  def: GimmickDef;
  phase: 'warn' | 'run';
  /** このフェーズの経過秒 */
  t: number;
  dur: number;
  data: Record<string, number>;
  done?: boolean;
}

interface GimmickDef {
  id: string;
  /** 同じグループは同時に発動しない */
  group: string;
  weight: number;
  warn: number;
  dur: [number, number];
  /** 帯の見出し（日本語）と補足 */
  text: string;
  sub: string;
  /** ドットマトリクス用（英語）と補足（日本語） */
  dmd: [string, string];
  /** 発動時の効果音 */
  sfx?: string;
  minClock?: number;
  start?(c: Ctx, run: Run): void;
  apply?(env: Env, run: Run, c: Ctx): void;
  tick?(c: Ctx, run: Run, dt: number): void;
  end?(c: Ctx, run: Run): void;
}

const tri = (x: number) => {
  const p = x - Math.floor(x);
  return p < 0.5 ? p * 2 : 2 - p * 2;
};

const GIMMICKS: GimmickDef[] = [
  {
    id: 'spin',
    group: 'rot',
    weight: 3,
    warn: 3.2,
    dur: [11, 14],
    text: '台が回転します',
    sub: 'ボールは勝手に転がります',
    dmd: ['SPINNING!', '台がぐるぐる回りだした！'],
    sfx: 'creak',
    start(c, run) {
      run.data.dir = c.rng.chance(0.5) ? 1 : -1;
      // 傾きは約28度まで。これ以上傾けると、フリッパーの付け根や仕切りの角にボールが挟まって動かなくなる
      run.data.amp = c.rng.range(0.3, 0.38);
    },
    apply(env, run) {
      env.rot = run.data.dir * run.data.amp + 0.06 * Math.sin(run.t * 0.9);
    },
  },
  {
    id: 'steep',
    group: 'rot',
    weight: 2,
    warn: 3.0,
    dur: [8, 11],
    text: '傾斜が急になります',
    sub: 'ボールが超高速になります',
    dmd: ['TOO STEEP!', '坂道ダッシュ！'],
    sfx: 'creak',
    apply(env) {
      env.pitch = 0.17;
      env.steep = 1.5;
    },
  },
  {
    id: 'swap',
    group: 'ctrl',
    weight: 3,
    warn: 3.0,
    dur: [8, 11],
    text: '左右が入れ替わる！',
    sub: '左は右。右は左。',
    dmd: ['SWAPPED!', '左右が入れ替わった！'],
    sfx: 'boing',
    apply(env) {
      env.swap = true;
    },
  },
  {
    id: 'shrink',
    group: 'flip',
    weight: 2,
    warn: 3.0,
    dur: [8, 11],
    text: 'フリッパーが縮む',
    sub: '気のせいではありません',
    dmd: ['TINY FLIPPERS', 'フリッパーがちっちゃい！'],
    sfx: 'shrink',
    apply(env) {
      env.flipL = 0.6;
      env.flipR = 0.6;
    },
  },
  {
    id: 'giant',
    group: 'flip',
    weight: 2,
    warn: 3.0,
    dur: [8, 11],
    text: 'フリッパー巨大化',
    sub: 'むしろ打ちにくくなります',
    dmd: ['GIANT FLIPPERS', 'フリッパーが巨大化！'],
    sfx: 'grow',
    apply(env) {
      env.flipL = 1.25;
      env.flipR = 1.25;
    },
  },
  {
    id: 'uneven',
    group: 'flip',
    weight: 1.5,
    warn: 3.0,
    dur: [8, 11],
    text: 'フリッパー不揃い',
    sub: '左右の大きさがバラバラ。仕様です',
    dmd: ['UNEVEN!', '左右の大きさがバラバラ'],
    sfx: 'boing',
    start(c, run) {
      run.data.small = c.rng.chance(0.5) ? 0 : 1;
    },
    apply(env, run) {
      const smallLeft = run.data.small === 0;
      env.flipL = smallLeft ? 0.55 : 1.25;
      env.flipR = smallLeft ? 1.25 : 0.55;
    },
  },
  {
    id: 'reverse',
    group: 'grav',
    weight: 2,
    warn: 3.2,
    dur: [3.4, 4.2],
    text: '重力が逆転します',
    sub: 'ボールは天井へ向かいます',
    dmd: ['GRAVITY REVERSED', 'ボールが上へ落ちる！'],
    sfx: 'whoosh',
    minClock: 8,
    apply(env) {
      env.gravDir = -0.5;
    },
  },
  {
    id: 'dark',
    group: 'light',
    weight: 2,
    warn: 3.0,
    dur: [8, 10],
    text: '停電します',
    sub: '電気代の支払いを忘れました',
    dmd: ['BLACKOUT', '停電！ ボールしか見えない'],
    sfx: 'powerdown',
    apply(env) {
      env.dark = 1;
    },
  },
  {
    id: 'outlane',
    group: 'lane',
    weight: 3,
    warn: 3.2,
    dur: [11, 14],
    text: 'アウトレーンが動く',
    sub: '死に穴は君を追いかける',
    dmd: ['OUTLANE MOVES', '死に穴が左右に動く！'],
    sfx: 'creak',
    start(c, run) {
      run.data.phase0 = c.rng.chance(0.5) ? 0 : 0.5;
    },
    apply(env, run) {
      const k = run.t / 5.5 + run.data.phase0;
      env.divL = DIV_TRAVEL * tri(k);
      env.divR = DIV_TRAVEL * tri(k + 0.5);
    },
  },
  {
    id: 'bumpers',
    group: 'bump',
    weight: 2,
    warn: 3.0,
    dur: [8, 10],
    text: 'バンパーが暴走',
    sub: '工事中のため、走り回ります',
    dmd: ['RUNAWAY BUMPERS', 'バンパーが走り回る！'],
    sfx: 'clank',
    apply(env) {
      env.bump = 3.4;
    },
  },
  {
    id: 'quake',
    group: 'quake',
    weight: 1.5,
    warn: 3.0,
    dur: [4.5, 5.5],
    text: '地震がきます',
    sub: '台が崩れかけているので',
    dmd: ['EARTHQUAKE', '台がガタガタ揺れる！'],
    sfx: 'rumble',
    tick(c, run, dt) {
      const g = c.g;
      run.data.acc = (run.data.acc ?? 0) + dt;
      if (run.data.acc >= 0.32) {
        run.data.acc = 0;
        g.shake(0.8);
        g.rumble(0.7, 0.9, 120);
        for (const b of g.freeBalls) {
          b.vx += (c.rng.next() - 0.5) * 9;
          b.vy += (c.rng.next() - 0.35) * 7;
        }
      }
    },
  },
  {
    id: 'tires',
    group: 'tire',
    weight: 2.5,
    warn: 3.0,
    dur: [9, 12],
    text: 'タイヤ落下注意',
    sub: 'ヘルメットは着用しましょう',
    dmd: ['TIRES FALLING', 'タイヤが降ってくる！'],
    sfx: 'thud',
    start(c) {
      c.tires.show(c.g);
    },
    end(c) {
      c.tires.hide(c.g);
    },
  },
];

// ───────── ルール本体 ─────────

const approach = (cur: number, target: number, step: number) => (cur < target ? Math.min(target, cur + step) : Math.max(target, cur - step));

/** 調整用つまみ（テストで発動頻度を上げて耐久を確かめる用。ふだんは 1 / 0） */
export const tuning = { pace: 1, maxRuns: 0 };

type Shot = 'bridge' | 'loopL' | 'loopR' | 'pit' | 'bank';
const SHOTS: { id: Shot; light: string; label: string }[] = [
  { id: 'bridge', light: 'bridge', label: '橋（ランプ）' },
  { id: 'loopL', light: 'orbitL', label: '左の外周' },
  { id: 'loopR', light: 'orbitR', label: '右の外周' },
  { id: 'pit', light: 'pit', label: 'PIT（中央の穴）' },
  { id: 'bank', light: 'bank', label: '中央の的' },
];

export function createRules(): StageRules {
  // ボールごと
  let targets = 0;
  let bumperHits = 0;
  let spins = 0;
  let missionsThisBall = 0;
  let gimmicksThisBall = 0;
  let clock = 0;
  let nextAt = 6;
  let lastId = '';
  let runs: Run[] = [];
  // ゲーム全体
  let mbReady = false;
  let extraLit = false;
  let extraGiven = false;
  let jackpotValue = 250_000;
  let jackpots = 0;
  let jpShot: Shot = 'bridge';
  let jpTimer = 0;
  let welcomed = false;
  const lastTrigger: Record<string, number> = {};
  // なめらかに近づける実際の値
  const st = { rot: 0, pitch: 0, steep: 1, gravDir: 1, flipL: 1, flipR: 1, divL: 0, divR: 0, bump: 1, phase: 0 };
  const prevDiv = { L: 0, R: 0 };
  let divSegs: Record<'L' | 'R', { segs: Seg[]; post: Circle | null }> | null = null;
  let tireShapes: Circle[] = [];
  /** タイヤを落とす予約の世代（片付けたあとに古い予約が落ちてこないように） */
  let tireGen = 0;

  const lanes = new LaneSet(['laneN', 'laneO', 'laneX'], ['laneN', 'laneO', 'laneX'], (g) => {
    g.bonusMult = Math.min(5, g.bonusMult + 1);
    g.addScore(25_000);
    g.msg(`NO! x${g.bonusMult}`, 'N・O・! そろった！ ボーナス倍率アップ', 2, 'normal');
    syncBonusLights(g);
  });

  const missions = new Missions(
    [
      { id: 'keepout', name: 'KEEP OUT', desc: '立入禁止！ 中央の的を3枚とも倒せ', goal: 1, count: (e) => (e.type === 'bank' ? 1 : 0), reward: 50_000 },
      { id: 'hammer', name: 'JACKHAMMER', desc: '暴れるバンパーを12回たたけ', goal: 12, count: (e) => (e.type === 'bumper' ? 1 : 0), reward: 75_000 },
      { id: 'run', name: 'ESCAPE ROUTE', desc: '橋か外周を通って逃げろ', goal: 2, count: (e) => (e.type === 'ramp' || (e.type === 'trigger' && (e.id === 'loopL' || e.id === 'loopR')) ? 1 : 0), reward: 100_000 },
    ],
    {
      onComplete(m, g) {
        missionsThisBall++;
        syncMissionLights(g);
        void m;
      },
      onAllComplete(g) {
        missionsThisBall++;
        syncMissionLights(g);
        mbReady = true;
        g.light('pit', 'fast');
        g.msg('PANIC READY', 'PIT（中央の穴）に入れて PANIC MULTIBALL！', 3, 'big');
      },
    },
  );

  function syncBonusLights(g: Game) {
    void g;
  }

  function syncMissionLights(g: Game) {
    const ids = ['m1', 'm2', 'm3'];
    ids.forEach((id, i) => g.light(id, i < missions.index || !missions.active ? 'on' : i === missions.index ? 'blink' : 'off'));
  }

  function syncShotLights(g: Game) {
    const mb = g.multiballActive;
    for (const s of SHOTS) {
      if (s.id === 'pit') continue;
      g.light(s.light, mb ? (s.id === jpShot ? 'fast' : 'off') : s.id === 'bridge' ? 'slow' : s.id === 'bank' ? 'off' : 'slow');
    }
    g.light('jackpot', mb ? 'blink' : 'off');
    if (mb) g.light('pit', jpShot === 'pit' ? 'fast' : 'off');
    else g.light('pit', mbReady ? 'fast' : extraLit ? 'blink' : 'off');
    g.light('extraBall', extraLit ? 'blink' : 'off');
  }

  function pickShot(g: Game, avoid?: Shot) {
    const pool = SHOTS.filter((s) => s.id !== avoid);
    jpShot = g.rng.pick(pool).id;
    jpTimer = 8;
    syncShotLights(g);
  }

  function hitShot(g: Game, shot: Shot, e: TableEvent) {
    if (!g.multiballActive) return;
    if (shot === jpShot) {
      g.jackpot(jackpotValue, e.x, e.y);
      jackpotValue += 75_000;
      jackpots++;
      g.fx('confetti', e.x, e.y);
      pickShot(g, shot);
      const nx = SHOTS.find((s) => s.id === jpShot)!;
      g.after(1.6, () => g.msg('JACKPOT MOVED', `ジャックポットは「${nx.label}」へ逃げた！`, 1.8, 'small'));
    } else {
      g.addScore(2_000, e.x, e.y);
    }
  }

  // ───────── ギミックの進行 ─────────

  function emit(g: Game, run: Run, phase: 'warn' | 'start' | 'end') {
    g.emit({ t: 'gimmick', name: run.def.id, text: run.def.text, sub: run.def.sub, phase });
  }

  function startWarn(c: Ctx, def: GimmickDef) {
    const g = c.g;
    const run: Run = { def, phase: 'warn', t: 0, dur: c.rng.range(def.dur[0], def.dur[1]), data: {} };
    runs.push(run);
    lastId = def.id;
    emit(g, run, 'warn');
    g.msg('WARNING', def.text, def.warn, 'flash');
    g.shake(0.25);
  }

  function beginRun(c: Ctx, run: Run) {
    const g = c.g;
    run.phase = 'run';
    run.t = 0;
    gimmicksThisBall++;
    run.def.start?.(c, run);
    emit(g, run, 'start');
    g.msg(run.def.dmd[0], run.def.dmd[1], 2.2, 'flash');
    g.sfx(run.def.sfx ?? 'crash');
    g.shake(0.6);
    g.rumble(0.6, 0.8, 250);
  }

  function endRun(c: Ctx, run: Run, announce: boolean) {
    const g = c.g;
    if (run.phase === 'run') run.def.end?.(c, run);
    emit(g, run, 'end');
    if (announce && run.phase === 'run') {
      if (run.def.id === 'swap') g.msg('BACK TO NORMAL', '左右がもとに戻った（たぶん）', 1.6, 'normal');
    }
  }

  function abortAll(c: Ctx) {
    for (const r of runs) endRun(c, r, false);
    runs = [];
  }

  function chooseGimmick(c: Ctx): GimmickDef | null {
    const busy = new Set(runs.map((r) => r.def.group));
    let pool = GIMMICKS.filter((d) => !busy.has(d.group) && (d.minClock ?? 0) <= clock && d.id !== lastId);
    if (!pool.length) pool = GIMMICKS.filter((d) => !busy.has(d.group));
    if (!pool.length) return null;
    const total = pool.reduce((s, d) => s + d.weight, 0);
    let r = c.rng.next() * total;
    for (const d of pool) {
      r -= d.weight;
      if (r <= 0) return d;
    }
    return pool[pool.length - 1];
  }

  const tires = {
    show(g: Game) {
      const gen = ++tireGen;
      const idx = TIRE_SPOTS.map((_, i) => i);
      // シャッフルして先頭の TIRE_COUNT 個
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(g.rng.next() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
      }
      tireShapes.forEach((s, i) => {
        const spot = TIRE_SPOTS[idx[i]];
        g.after(i * 0.4, () => {
          if (gen !== tireGen) return;
          s.cx = spot[0];
          s.cy = spot[1];
          s.enabled = true;
          g.fx('burst', spot[0], spot[1], { color: '#222222' });
          g.sfx('thud');
          g.shake(0.35);
        });
      });
    },
    hide(g: Game) {
      tireGen++;
      for (const s of tireShapes) {
        if (s.enabled) g.fx('burst', s.cx, s.cy, { color: '#555555' });
        s.enabled = false;
      }
    },
  };

  function setDivider(side: 'L' | 'R', off: number, dt: number) {
    if (!divSegs) return;
    const d = divSegs[side];
    const xd = side === 'L' ? -SEP + off : SEP - off;
    const vx = dt > 0 ? (off - prevDiv[side]) / dt * (side === 'L' ? 1 : -1) : 0;
    prevDiv[side] = off;
    if (d.segs.length >= 2) {
      const [a, b] = d.segs;
      a.ax = a.bx = xd;
      a.vx = vx;
      b.ax = xd;
      b.vx = vx * 0.5;
    }
    if (d.post) {
      d.post.cx = xd;
      d.post.vx = vx;
    }
  }

  function ease(g: Game, env: Env, dt: number, active: boolean) {
    st.rot = approach(st.rot, env.rot, 0.24 * dt);
    st.pitch = approach(st.pitch, env.pitch, 0.1 * dt);
    st.steep = approach(st.steep, env.steep, 1.2 * dt);
    st.gravDir = approach(st.gravDir, g.ballInLane ? 1 : env.gravDir, 3.0 * dt);
    st.flipL = approach(st.flipL, env.flipL, 1.2 * dt);
    st.flipR = approach(st.flipR, env.flipR, 1.2 * dt);
    st.divL = approach(st.divL, env.divL, 1.1 * dt);
    st.divR = approach(st.divR, env.divR, 1.1 * dt);
    st.bump = approach(st.bump, env.bump, 1.8 * dt);

    // 崩れかけた台のゆらぎ（見た目と重力が一致するように、同じ角度を使う）
    const sway = 0.03 * Math.sin(g.time * 0.37) + 0.014 * Math.sin(g.time * 1.13 + 1);
    const th = st.rot + sway;
    const gd = st.gravDir;
    g.world.gx = -GRAV * Math.sin(th) * gd;
    g.world.gy = -GRAV * Math.cos(th) * gd;
    g.world.gravityScale = st.steep;
    g.vars.rot = th;
    g.vars.pitch = st.pitch;

    for (const f of g.flippers) f.scale = f.side === 'left' ? st.flipL : st.flipR;
    g.swapFlippers = env.swap;
    g.vars.darkness = env.dark;
    // 非常灯：予告中は強く、発動中は中くらい。長く生きるほど赤くなる
    const warning = runs.some((r) => r.phase === 'warn');
    const base = 0.2 + Math.min(0.3, clock / 200);
    const want = warning ? 0.95 : active ? base + 0.2 : base;
    g.vars.alarm = want;

    // 仕切り（死に穴）：ふだんもほんの少しゆらぐ
    const wob = 0.12 + 0.12 * Math.sin(g.time * 0.8);
    setDivider('L', Math.max(0, st.divL + wob * 0.6), dt);
    setDivider('R', Math.max(0, st.divR + (0.24 - wob) * 0.6), dt);

    // 歩くバンパー
    st.phase += dt * st.bump;
    const ampK = 1 + ((st.bump - 1) / 2.4) * 0.3;
    for (const w of WALKERS) {
      const [x, y] = walkerPos(w, st.phase, ampK);
      g.part<BumperRT>(w.id).moveTo(x, y, dt);
    }
  }

  const ctxOf = (g: Game): Ctx => ({ g, rng: g.rng, tires });

  return {
    init(g: Game) {
      const tag = (id: string) => g.table.shapesByTag(id);
      divSegs = {
        L: { segs: tag('divL').filter((s): s is Seg => s.kind === 'seg'), post: (tag('divTopL')[0] as Circle) ?? null },
        R: { segs: tag('divR').filter((s): s is Seg => s.kind === 'seg'), post: (tag('divTopR')[0] as Circle) ?? null },
      };
      tireShapes = [];
      for (let i = 0; i < TIRE_COUNT; i++) {
        const s = tag(`tire${i}`)[0] as Circle | undefined;
        if (s) {
          s.enabled = false;
          tireShapes.push(s);
        }
      }
      for (const w of WALKERS) {
        const [x, y] = walkerPos(w, 0);
        g.part<BumperRT>(w.id).moveTo(x, y, 0);
      }
      g.vars.alarm = 0.2;
      syncMissionLights(g);
      syncShotLights(g);
    },

    onBallStart(g: Game) {
      abortAll(ctxOf(g));
      // 前のボールのタイヤは必ず片付ける
      tireGen++;
      for (const s of tireShapes) s.enabled = false;
      targets = bumperHits = spins = missionsThisBall = gimmicksThisBall = 0;
      clock = 0;
      nextAt = (6 + g.rng.next() * 3) / tuning.pace;
      lastId = '';
      lanes.reset(g);
      g.swapFlippers = false;
      syncMissionLights(g);
      syncShotLights(g);
      g.light('standA', 'off');
      g.light('standB', 'off');
      if (!welcomed) {
        welcomed = true;
        g.msg('WELCOME', 'ようこそ、無理な台へ。', 2.6, 'big');
      }
    },

    onFlip(g: Game, side: 'left' | 'right') {
      lanes.rotate(g, side === 'left' ? -1 : 1);
    },

    onEvent(g: Game, e: TableEvent) {
      // 外周の出入口：すき間でボールが跳ねて何度も通過しても、1.5秒に1回だけ数える
      if (e.type === 'trigger') {
        if (g.time - (lastTrigger[e.id] ?? -99) < 1.5) return;
        lastTrigger[e.id] = g.time;
      }
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
          g.table.resetBank(e.id, g.multiballActive ? 3 : 2.2);
          hitShot(g, 'bank', e);
          break;
        case 'standup':
          targets++;
          g.light(e.id, 'on');
          break;
        case 'bumper':
          bumperHits++;
          break;
        case 'spinner':
          spins++;
          break;
        case 'trigger':
          g.addScore(5_000 * (g.multiballActive ? 3 : 1));
          g.fx('burst', e.x, e.y, { color: '#ffd400' });
          hitShot(g, e.id === 'loopL' ? 'loopL' : 'loopR', e);
          break;
        case 'ramp':
          if (!g.multiballActive) g.msg('BRIDGE', '崩れかけの橋を渡った！', 1.2, 'small');
          hitShot(g, 'bridge', e);
          syncShotLights(g);
          break;
        case 'scoop': {
          const scoop = g.part<ScoopRT>('pit');
          if (mbReady && !g.multiballActive) {
            mbReady = false;
            jackpots = 0;
            jackpotValue = 250_000;
            scoop.holdFor(2.2);
            g.msg('PANIC MULTIBALL', 'ジャックポットは逃げ回る！', 3, 'big');
            g.after(1.2, () => {
              g.startMultiball(2, 8);
              pickShot(g);
            });
          } else if (g.multiballActive) {
            scoop.holdFor(1.0);
            hitShot(g, 'pit', e);
          } else if (extraLit) {
            extraLit = false;
            extraGiven = true;
            scoop.holdFor(1.4);
            g.extraBall();
          } else {
            g.msg('PIT', 'ただの穴です', 1.0, 'small');
          }
          syncShotLights(g);
          break;
        }
      }
    },

    update(g: Game, dt: number) {
      const c = ctxOf(g);
      const playing = g.state === 'play' && !g.tilted;
      if (playing && g.launchedThisBall) {
        clock += dt;
        // 予告 → 発動 → 終了
        for (const r of runs) {
          r.t += dt;
          if (r.phase === 'warn' && r.t >= r.def.warn) beginRun(c, r);
          else if (r.phase === 'run') {
            r.def.tick?.(c, r, dt);
            if (r.t >= r.dur) {
              endRun(c, r, true);
              r.done = true;
              nextAt = Math.min(nextAt, clock + ((6.5 - 4.5 * Math.min(1, clock / 70)) * g.rng.range(0.75, 1.3)) / tuning.pace);
            }
          }
        }
        runs = runs.filter((r) => !r.done);
        // 次のギミック
        const pressure = Math.min(1, clock / 70);
        const maxRuns = tuning.maxRuns || (pressure > 0.45 ? 2 : 1);
        if (clock >= nextAt && runs.length < maxRuns) {
          const def = chooseGimmick(c);
          if (def) {
            startWarn(c, def);
            nextAt = pressure > 0.45 || tuning.maxRuns > 1 ? clock + g.rng.range(4, 8) / tuning.pace : Infinity;
          }
        }
        // エクストラボール：1球で40秒生き延びる
        if (!extraGiven && !extraLit && clock >= 40) {
          extraLit = true;
          g.msg('EXTRA BALL LIT', '40秒も生きた！ PITに入れろ', 2.6, 'big');
          syncShotLights(g);
        }
      } else if (!playing && runs.length) {
        abortAll(c);
      }

      // 目標値を集計して、なめらかに近づける
      const env = baseEnv();
      for (const r of runs) if (r.phase === 'run') r.def.apply?.(env, r, c);
      ease(g, env, dt, runs.some((r) => r.phase === 'run'));

      // マルチボール中のジャックポットは時々逃げる
      if (g.multiballActive) {
        jpTimer -= dt;
        if (jpTimer <= 0) {
          pickShot(g, jpShot);
          g.msg('JACKPOT MOVED', 'ジャックポットが移動した！', 1.4, 'small');
        }
        g.hud.mission = 'PANIC';
        const cur = SHOTS.find((s) => s.id === jpShot)!;
        g.hud.missionSub = `ジャックポットは「${cur.label}」`;
        g.hud.progress = jackpotValue.toLocaleString();
      } else if (mbReady) {
        missions.hud(g, 'PANIC READY', 'PIT（中央の穴）に入れろ');
      } else if (extraLit) {
        missions.hud(g, 'EXTRA LIT', 'PIT（中央の穴）に入れろ');
      } else {
        missions.hud(g);
      }
      g.hud.extra = `<div>ギミック ${gimmicksThisBall} 回</div><div>ジャックポット ${jackpotValue.toLocaleString()}</div>`;
    },

    onBallEnd(g: Game) {
      abortAll(ctxOf(g));
      g.swapFlippers = false;
    },

    onMultiballEnd(g: Game) {
      missions.restart();
      syncMissionLights(g);
      syncShotLights(g);
      g.msg('PANIC OVER', '生き延びた…？ 次のミッションへ', 2);
    },

    bonus(): BonusLine[] {
      return [
        { label: 'TARGETS', count: targets, each: 1_000 },
        { label: 'BUMPERS', count: bumperHits, each: 200 },
        { label: 'SPINS', count: spins, each: 100 },
        { label: 'SURVIVED SEC', count: Math.floor(clock), each: 1_000 },
        { label: 'DISASTERS', count: gimmicksThisBall, each: 5_000 },
        { label: 'MISSIONS', count: missionsThisBall, each: 25_000 },
      ];
    },
  };
}
