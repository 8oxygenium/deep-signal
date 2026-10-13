import { it } from 'vitest';
import { simulate } from '../sim';
import { STAGES } from '../../src/stages';
import { Game } from '../../src/core/game';

it('stuck spots', () => {
  const stage = STAGES.find((s) => s.id === (process.env.STAGE ?? 'modern'))!;
  const orig = (Game.prototype as any).checkStuck;
  const spots: string[] = [];
  (Game.prototype as any).checkStuck = function (dt: number) {
    for (const b of this.balls) if (!b.captured && b.stillTime + dt >= 5 && b.stillTime < 5) spots.push(`${b.x.toFixed(2)},${b.y.toFixed(2)} L${b.layer} v=${b.speed.toFixed(1)} flip=${b.touchingFlipper}`);
    return orig.call(this, dt);
  };
  simulate(stage, Number(process.env.SIM_SECONDS ?? 600));
  (Game.prototype as any).checkStuck = orig;
  console.log(spots.join('\n'));
});
