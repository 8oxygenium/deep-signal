import { describe, expect, it } from 'vitest';
import { Game, type GameEvent } from '../src/core/game';
import { testStage } from '../src/stages/test';
import { STEP } from '../src/physics/constants';

function run(g: Game, seconds: number) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) (g as unknown as { fixedStep(): void }).fixedStep();
}

function launch(g: Game, pull = 0.7) {
  run(g, 0.8);
  g.setLaunch(true);
  run(g, pull * 0.9);
  g.setLaunch(false);
}

describe('ゲームの流れ', () => {
  it('揺らしすぎると WARNING 2回のあと TILT になり、フリッパーが動かず得点も入らない', () => {
    const g = new Game(testStage, { seed: 1 });
    const ev: GameEvent[] = [];
    g.on((e) => ev.push(e));
    launch(g);
    run(g, 0.5);
    for (let i = 0; i < 12 && !g.tilted; i++) {
      g.nudge(i % 2 ? 'left' : 'right');
      run(g, 0.2);
    }
    expect(ev.filter((e) => e.t === 'tilt-warning').length).toBe(2);
    expect(g.tilted).toBe(true);
    const before = g.score;
    g.setFlipper('left', true);
    run(g, 0.2);
    expect(g.flippers.find((f) => f.side === 'left')!.raise).toBe(0);
    expect(g.addScore(1000)).toBe(0);
    expect(g.score).toBe(before);
  });

  it('ゆっくり揺らせば TILT にならない（時間で減る）', () => {
    const g = new Game(testStage, { seed: 2 });
    launch(g);
    for (let i = 0; i < 10; i++) {
      g.nudge('up');
      run(g, 2.2);
    }
    expect(g.tilted).toBe(false);
    expect(g.tiltWarnings).toBe(0);
  });

  it('ボールセーブ中に落ちたらボールが戻ってくる', () => {
    const g = new Game(testStage, { seed: 3 });
    const ev: GameEvent[] = [];
    g.on((e) => ev.push(e));
    launch(g);
    run(g, 1);
    const b = g.balls[0];
    b.place(0, 1.5, 0, -30);
    run(g, 0.5);
    expect(ev.some((e) => e.t === 'ballsave')).toBe(true);
    expect(g.ball).toBe(1);
    run(g, 2);
    expect(g.balls.length).toBe(1);
  });

  it('3球落とすとゲームオーバー', () => {
    const g = new Game(testStage, { seed: 4 });
    for (let k = 0; k < 3; k++) {
      launch(g);
      run(g, 0.5);
      g.ballSaveTimer = 0;
      for (const b of g.balls) b.place(0, 1.5, 0, -30);
      run(g, 6);
    }
    expect(g.state).toBe('over');
  });

  it('止まったボールは自動で揺らし、だめなら安全な位置へ戻す', () => {
    const g = new Game(testStage, { seed: 5 });
    launch(g);
    run(g, 0.5);
    const b = g.balls[0];
    // 何かに挟まった想定：毎ステップ同じ位置に戻す
    let resets = 0;
    g.on((e) => {
      if (e.t === 'autosave') resets++;
    });
    b.place(-3, 15, 0, 0);
    for (let i = 0; i < 480 * 9; i++) {
      if (g.stats.autoResets === 0) {
        b.x = -3;
        b.y = 15;
        b.vx = 0;
        b.vy = 0;
      }
      (g as unknown as { fixedStep(): void }).fixedStep();
    }
    expect(g.stats.autoNudges).toBeGreaterThan(0);
    expect(g.stats.autoResets).toBeGreaterThan(0);
    expect(resets).toBeGreaterThan(0);
  });

  it('スキルショット：ぴったりの強さで発射すると得点', () => {
    const g = new Game(testStage, { seed: 6 });
    run(g, 0.8);
    const target = (g.skillWindow[0] + g.skillWindow[1]) / 2;
    g.setLaunch(true);
    while (g.plungerPull < target) run(g, STEP);
    g.setLaunch(false);
    expect(g.score).toBeGreaterThanOrEqual(testStage.skillShot);
  });
});
