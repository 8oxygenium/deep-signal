// UKIYO-E のルールの確認：七福神そろい → 社殿でジャックポット（見得）、ミッション全達成 → 大波マルチボール（ボールが増える）、
// ドットマトリクスに出す英語の文字が使える文字だけであること
import { describe, expect, it } from 'vitest';
import { Game, type GameEvent } from '../src/core/game';
import { Rng } from '../src/core/rng';
import { STEP } from '../src/physics/constants';
import { ukiyoeStage } from '../src/stages/ukiyoe';
import { GODS } from '../src/stages/ukiyoe/layout';
import type { TableEvent } from '../src/table/table';

function run(g: Game, seconds: number): void {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) (g as unknown as { fixedStep(): void }).fixedStep();
}

function launch(g: Game): void {
  run(g, 0.8);
  g.setLaunch(true);
  run(g, 0.7);
  g.setLaunch(false);
  run(g, 1.5);
}

const hit = (g: Game, type: TableEvent['type'], id: string): void => g.table.emit({ type, id, ball: null, x: 0.7, y: 24, speed: 20 });

const DMD_OK = /^[A-Z0-9 .,!?:\-+/'()%=#&<>*x]*$/;

describe('UKIYO-E', () => {
  it('七福神を7人そろえると社殿が光り、スクープで見得とジャックポット', () => {
    const g = new Game(ukiyoeStage, { seed: 3 });
    const ev: GameEvent[] = [];
    g.on((e) => ev.push(e));
    launch(g);
    for (const god of GODS) hit(g, 'standup', god.id);
    expect(ev.some((e) => e.t === 'msg' && e.text === 'SHICHIFUKU READY')).toBe(true);
    expect(g.lightState('shrine')).toBe('fast');
    hit(g, 'scoop', 'shrine');
    expect(ev.some((e) => e.t === 'fx' && e.name === 'mie' && e.text === '七福神揃い踏み')).toBe(true);
    expect(ev.some((e) => e.t === 'sfx' && e.name === 'tsuke')).toBe(true);
    const before = g.score;
    run(g, 3.0);
    expect(ev.some((e) => e.t === 'jackpot')).toBe(true);
    expect(g.score).toBeGreaterThan(before + 200_000);
    // 集めた神様は次の周回のためにリセットされる
    expect(GODS.every((god) => g.lightState(god.id) === 'off')).toBe(true);
  });

  it('ミッションを全部達成して社殿へ入れると、見得 → 大波 → マルチボール（ボールが増える）', () => {
    const g = new Game(ukiyoeStage, { seed: 5 });
    const ev: GameEvent[] = [];
    g.on((e) => ev.push(e));
    launch(g);
    for (let i = 0; i < 3; i++) hit(g, 'trigger', 'torii');
    for (let i = 0; i < 2; i++) hit(g, 'ramp', 'koi');
    for (let i = 0; i < 2; i++) hit(g, 'ramp', 'ryu');
    for (let i = 0; i < 5; i++) hit(g, 'standup', 'ebisu');
    expect(ev.some((e) => e.t === 'msg' && e.text === 'NAMI READY')).toBe(true);
    expect(g.rank).toBeGreaterThanOrEqual(4);
    expect(g.lightState('shrine')).toBe('fast');
    hit(g, 'scoop', 'shrine');
    expect(ev.some((e) => e.t === 'fx' && e.name === 'mie' && e.text === '神奈川沖浪裏')).toBe(true);
    const balls0 = g.balls.length;
    run(g, 3.0);
    expect(ev.some((e) => e.t === 'fx' && e.name === 'wave')).toBe(true);
    expect(g.multiballActive).toBe(false);
    run(g, 2.0);
    expect(g.multiballActive).toBe(true);
    expect(ev.some((e) => e.t === 'multiball')).toBe(true);
    run(g, 2.0);
    expect(g.balls.length).toBeGreaterThanOrEqual(balls0 + 2);
    // マルチボール中はランプでジャックポット
    const before = ev.filter((e) => e.t === 'jackpot').length;
    hit(g, 'ramp', 'koi');
    expect(ev.filter((e) => e.t === 'jackpot').length).toBe(before + 1);
  });

  it('松竹梅をそろえるとボーナス倍率が上がる', () => {
    const g = new Game(ukiyoeStage, { seed: 7 });
    launch(g);
    for (const id of ['laneMatsu', 'laneTake', 'laneUme']) hit(g, 'rollover', id);
    expect(g.bonusMult).toBe(2);
  });

  it('ドットマトリクスに出す英語の文字は使える文字だけ（ランク名・メッセージ）', () => {
    for (const r of ukiyoeStage.ranks) expect(DMD_OK.test(r.toUpperCase()), r).toBe(true);
    const g = new Game(ukiyoeStage, { seed: 9, balls: 1_000 });
    const texts = new Set<string>();
    g.on((e) => {
      if (e.t === 'msg') texts.add(e.text);
      if (e.t === 'rank') texts.add(e.name);
    });
    const rng = new Rng(4);
    const dt = 1 / 60;
    let hold = 0;
    for (let i = 0; i < 60 * 240; i++) {
      g.autoPlay(dt, 0.7);
      if (g.ballInLane && hold <= 0 && !g.table.plunger!.pulling) {
        g.setLaunch(true);
        hold = 0.3 + rng.next() * 0.6;
      }
      if (hold > 0) {
        hold -= dt;
        if (hold <= 0) g.setLaunch(false);
      }
      g.update(dt);
      // ときどきゲームの流れを進める（的・ランプ・スクープを直接叩く）
      if (i % 600 === 300) {
        hit(g, 'trigger', 'torii');
        hit(g, 'ramp', 'koi');
        hit(g, 'ramp', 'ryu');
        hit(g, 'standup', GODS[(i / 600) % GODS.length | 0].id);
        hit(g, 'scoop', 'shrine');
      }
    }
    for (const t of texts) expect(DMD_OK.test(t.toUpperCase()), t).toBe(true);
    expect(texts.size).toBeGreaterThan(6);
  });
});
