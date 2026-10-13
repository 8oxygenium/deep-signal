// 静止スタート走査：台のあちこちにボールを止めた状態で置き、何もしないで放置したとき
// 「止まったまま動かなくなる場所（ポケット・谷・平らな棚）」がないかを全ステージで調べる。
import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { STEP } from '../src/physics/constants';
import { closest, type Closest } from '../src/physics/shapes';
import { STAGES } from '../src/stages';
import type { StageDef } from '../src/stages/types';

const ONLY = process.env.STAGE;

export function deadSpots(stage: StageDef, step = 0.5): { total: number; dead: [number, number][] } {
  const C: Closest = { qx: 0, qy: 0, r: 0 };
  const probe = new Game(stage, { seed: 1 });
  const shapes = probe.world.shapes.filter((s) => s.layer === 0 && s.enabled);
  const free = (x: number, y: number) => {
    for (const s of shapes) {
      closest(s, x, y, C);
      if (Math.hypot(x - C.qx, y - C.qy) < C.r + 0.55) return false;
    }
    for (const f of probe.flippers) {
      const d = Math.hypot(x - f.pivotX, y - f.pivotY);
      if (d < f.length + 1) return false;
    }
    return true;
  };
  const dead: [number, number][] = [];
  let total = 0;
  let k = 0;
  for (let y0 = 3; y0 <= 38.5; y0 += step) {
    for (let x0 = -8.2; x0 <= 8.2; x0 += step) {
      // 頂点の真上にぴったり置くような「ありえない釣り合い」を避けるため、少しだけずらす
      k++;
      const x = x0 + (((k * 7919) % 97) / 97 - 0.5) * 0.08;
      const y = y0 + (((k * 104729) % 89) / 89 - 0.5) * 0.08;
      if (!free(x, y)) continue;
      total++;
      const g = new Game(stage, { seed: 1 });
      g.balls.forEach((b) => g.world.removeBall(b));
      (g as unknown as { serveQueue: number }).serveQueue = 0;
      const b = g.world.addBall(x, y);
      const run = (sec: number) => {
        for (let i = 0; i < sec / STEP; i++) (g as unknown as { fixedStep(): void }).fixedStep();
      };
      run(3.5);
      if (!b.active || b.captured) continue;
      const px = b.x, py = b.y;
      run(1.0);
      if (!b.active || b.captured) continue;
      if (Math.hypot(b.x - px, b.y - py) < 0.05 && b.speed < 0.3 && !g.ballInLane) dead.push([Number(b.x.toFixed(2)), Number(b.y.toFixed(2))]);
    }
  }
  return { total, dead };
}

describe.each(STAGES.filter((s) => !ONLY || s.id === ONLY).map((s) => [s.id, s] as const))('ステージ %s', (_id, stage) => {
  it('止めて置いたボールが動かなくなる場所（ポケット・谷・棚）がほぼ無い', () => {
    const { total, dead } = deadSpots(stage);
    // 同じ場所に集まる点をまとめて表示
    const spots = new Map<string, number>();
    for (const [x, y] of dead) {
      const k = `${x.toFixed(1)},${y.toFixed(1)}`;
      spots.set(k, (spots.get(k) ?? 0) + 1);
    }
    console.log(stage.id, `${dead.length}/${total}`, JSON.stringify([...spots.entries()].slice(0, 12)));
    expect(dead.length / Math.max(1, total)).toBeLessThan(0.01);
  });
});
