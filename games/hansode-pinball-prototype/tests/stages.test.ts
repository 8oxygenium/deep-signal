// 耐久テスト＋到達テスト：全ステージで、ランダムにフリッパーと揺らしを操作して各10分相当を早送りする。
// - ボールが台の外に出ない（lost 0件）、NaN/無限大が出ない（invalid 0件）、例外0件
// - 詰まったボールは自動で解消される（同じ場所で10秒以上止まり続けない）
// - 全ての的・ランプ・スクープ等にボールが少なくとも1回届く
import { describe, expect, it } from 'vitest';
import { STAGES } from '../src/stages';
import { reachTargets, simulate } from './sim';

const SIM_SECONDS = Number(process.env.SIM_SECONDS ?? 600);
const ONLY = process.env.STAGE;

describe.each(STAGES.filter((s) => !ONLY || s.id === ONLY).map((s) => [s.id, s] as const))('ステージ %s', (_id, stage) => {
  it(`${SIM_SECONDS}秒の自動プレイ：台の外に出ない・NaN無し・例外0件・詰まり解消・全部の的とランプに届く`, () => {
    const { g, maxStill, exceptions, firstError } = simulate(stage, SIM_SECONDS);
    const missing = reachTargets(stage).filter((k) => !g.stats.hits.has(k));
    const summary = {
      drains: g.stats.drains,
      lost: g.stats.lost,
      invalid: g.stats.invalid,
      autoNudges: g.stats.autoNudges,
      autoResets: g.stats.autoResets,
      maxStill: Number(maxStill.toFixed(2)),
      score: g.score,
      rank: g.rank,
      missing,
    };
    console.log(stage.id, JSON.stringify(summary));
    expect(firstError).toBe('');
    expect(exceptions).toBe(0);
    expect(g.stats.lost).toBe(0);
    expect(g.stats.invalid).toBe(0);
    expect(maxStill).toBeLessThan(10);
    expect(missing).toEqual([]);
  });
});
