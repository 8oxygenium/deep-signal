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
    // シードを2つ回し、どちらかで届けばよい（1つのシードの偶然に頼らない）
    const r1 = simulate(stage, SIM_SECONDS, 7);
    const r2 = simulate(stage, SIM_SECONDS, 31);
    const { g, maxStill, exceptions, firstError } = r1;
    const missing = reachTargets(stage).filter((k) => !g.stats.hits.has(k) && !r2.g.stats.hits.has(k));
    const autos = g.stats.autoNudges + g.stats.autoResets + r2.g.stats.autoNudges + r2.g.stats.autoResets;
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
      seed2: { drains: r2.g.stats.drains, lost: r2.g.stats.lost, invalid: r2.g.stats.invalid, autoNudges: r2.g.stats.autoNudges, autoResets: r2.g.stats.autoResets },
    };
    console.log(stage.id, JSON.stringify(summary));
    expect(firstError).toBe('');
    expect(r2.firstError).toBe('');
    expect(exceptions + r2.exceptions).toBe(0);
    expect(g.stats.lost + r2.g.stats.lost).toBe(0);
    expect(g.stats.invalid + r2.g.stats.invalid).toBe(0);
    expect(Math.max(maxStill, r2.maxStill)).toBeLessThan(10);
    // 止まって自動で揺らす/戻すことがほとんど無い（ポケットが無い）
    expect(autos).toBeLessThanOrEqual(8);
    // ちゃんとボールが落ちて次へ進んでいる（どこかに閉じ込められていない）
    expect(g.stats.drains + r2.g.stats.drains).toBeGreaterThan(6);
    expect(missing).toEqual([]);
  });
});
