import { it } from 'vitest';
import { Game } from '../../src/core/game';
import { STAGES } from '../../src/stages';
import { STEP } from '../../src/physics/constants';

const stage = STAGES.find((s) => s.id === (process.env.STAGE ?? 'modern'))!;
it('shotmap', () => {
  const rows: string[] = [];
  for (const side of ['right', 'left'] as const) {
    for (let ang = 40; ang <= 140; ang += 4) {
      const a = side === 'right' ? ang : 180 - ang;
      for (const sp of [70, 95]) {
        const g = new Game(stage, { seed: 1 });
        g.balls.forEach((b) => g.world.removeBall(b));
        (g as any).serveQueue = 0;
        const x = side === 'right' ? 1.6 : -1.6;
        const b = g.world.addBall(x, 6.4);
        b.vx = Math.cos((a * Math.PI) / 180) * sp;
        b.vy = Math.sin((a * Math.PI) / 180) * sp;
        const seen: string[] = [];
        const off = g.on((e) => {
          if (e.t === 'table') {
            const k = `${e.e.type}:${e.e.id}`;
            if (!['wall', 'rubber', 'flipper', 'ballball'].includes(e.e.type) && !seen.includes(k)) seen.push(k);
          }
        });
        for (let i = 0; i < 480 * 2.5; i++) (g as any).fixedStep();
        off();
        rows.push(`${side} a=${a} v=${sp}: ${seen.slice(0, 5).join(' ')}`);
      }
    }
  }
  console.log(rows.join('\n'));
});
