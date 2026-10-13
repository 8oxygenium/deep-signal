// テスト用：自動プレイで早送りする（tests/stages.test.ts と tests/tools/ から使う）
import { Game } from '../src/core/game';
import { Rng } from '../src/core/rng';
import type { StageDef } from '../src/stages/types';

/** 届くべき部品のイベント名（type:id） */
export function reachTargets(stage: StageDef): string[] {
  const out: string[] = [];
  const ex = new Set(stage.reachExempt ?? []);
  for (const p of stage.layout().parts) {
    const id = 'id' in p ? p.id : undefined;
    if (!id || ex.has(id)) continue;
    switch (p.kind) {
      case 'bumper':
      case 'drop':
      case 'standup':
      case 'spinner':
      case 'rollover':
      case 'ramp':
      case 'scoop':
      case 'warp':
      case 'trigger':
        out.push(`${p.kind}:${id}`);
    }
  }
  return out;
}

export function simulate(stage: StageDef, seconds: number, seed = 7) {
  const rng = new Rng(seed);
  const g = new Game(stage, { seed, balls: 1_000_000 });
  const dt = 1 / 60;
  let launchHold = 0;
  let maxStill = 0;
  let exceptions = 0;
  let firstError = '';
  const frames = Math.round(seconds / dt);
  for (let i = 0; i < frames; i++) {
    try {
      g.autoPlay(dt, 0.5 + rng.next() * 0.4);
      // 発射：引く長さをランダムに
      if (g.ballInLane && launchHold <= 0 && !g.table.plunger!.pulling) {
        g.setLaunch(true);
        launchHold = 0.25 + rng.next() * 0.75;
      }
      if (launchHold > 0) {
        launchHold -= dt;
        if (launchHold <= 0) g.setLaunch(false);
      }
      // ときどき台を揺らす
      if (rng.chance(0.004)) g.nudge(rng.pick(['left', 'right', 'up'] as const));
      g.update(dt);
      for (const b of g.balls) if (!b.captured) maxStill = Math.max(maxStill, b.stillTime);
      if (g.state === 'over') break;
    } catch (e) {
      exceptions++;
      if (!firstError) firstError = String((e as Error)?.stack ?? e);
      if (exceptions > 5) break;
    }
  }
  return { g, maxStill, exceptions, firstError };
}

