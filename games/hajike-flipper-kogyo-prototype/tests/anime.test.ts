// ANIME のルールの確認：コンボ倍率、変身ゲージ → 必殺技カットイン → マルチボール、エクストラボール
import { describe, expect, it } from 'vitest';
import { Game, type GameEvent } from '../src/core/game';
import type { Ball } from '../src/physics/ball';
import { animeStage } from '../src/stages/anime';
import type { KitApi } from '../src/stages/types';
import type { TableEventType } from '../src/table/table';

function newGame() {
  const g = new Game(animeStage, { seed: 3 });
  const events: GameEvent[] = [];
  g.on((e) => events.push(e));
  const emit = (type: TableEventType, id: string, ball: Partial<Ball> | null = null) => g.table.emit({ type, id, ball: ball as Ball | null, x: 0.8, y: 20, speed: 10 });
  const run = (sec: number) => {
    for (let i = 0; i < sec * 60; i++) g.update(1 / 60);
  };
  return { g, events, emit, run };
}

describe('ANIME のルール', () => {
  it('ランプを続けて通すとコンボで倍率が上がり、時間切れで戻る', () => {
    const { g, emit, run } = newGame();
    expect(g.pfMult).toBe(1);
    emit('ramp', 'rampC');
    expect(g.pfMult).toBe(1);
    run(1);
    emit('ramp', 'rampC');
    expect(g.pfMult).toBe(2);
    run(1);
    emit('ramp', 'rampC');
    expect(g.pfMult).toBe(3);
    run(10);
    expect(g.pfMult).toBe(1);
  });

  it('オービットは下から上へ通ったときだけコンボになる', () => {
    const { g, emit, run } = newGame();
    emit('trigger', 'loopL', { vy: -20 });
    run(0.5);
    emit('trigger', 'loopL', { vy: -20 });
    expect(g.pfMult).toBe(1);
    emit('trigger', 'loopR', { vy: 20 });
    run(0.5);
    emit('trigger', 'loopR', { vy: 20 });
    expect(g.pfMult).toBe(2);
  });

  it('ゲージ満タン → スクープでカットインとマルチボール', () => {
    const { g, events, emit, run } = newGame();
    for (let i = 0; i < 12; i++) emit('ramp', 'rampC');
    run(0.1);
    expect(g.vars.ready).toBe(1);
    expect(g.vars.gauge).toBe(100);
    emit('scoop', 'henshin');
    expect(events.some((e) => e.t === 'fx' && e.name === 'cutin' && (e.text ?? '').startsWith('必殺！'))).toBe(true);
    expect(g.multiballActive).toBe(false);
    run(2.5);
    expect(g.multiballActive).toBe(true);
    expect(g.vars.gauge).toBe(0);
    // マルチボール中、ランプはジャックポット
    const before = g.score;
    emit('ramp', 'rampC');
    expect(events.some((e) => e.t === 'jackpot')).toBe(true);
    expect(g.score - before).toBeGreaterThan(300_000);
  });

  it('5コンボでエクストラボールが点灯し、スクープで獲得できる', () => {
    const { g, emit, run } = newGame();
    for (let i = 0; i < 5; i++) {
      emit('ramp', 'rampC');
      run(0.3);
    }
    expect(g.pfMult).toBe(5);
    expect(g.vars.ready).toBe(0);
    emit('scoop', 'henshin');
    expect(g.extraBalls).toBe(1);
  });

  it('ミッションは達成するとランクが上がる', () => {
    const { g, emit } = newGame();
    expect(g.rank).toBe(0);
    emit('ramp', 'rampC');
    emit('ramp', 'rampC');
    expect(g.rank).toBe(1);
  });
});

describe('ANIME の音', () => {
  const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

  it('BGM の編成：全ステップで例外なく、有限の音程で鳴らす', () => {
    for (const song of animeStage.music.songs) {
      expect(typeof song.kit).toBe('function');
      const kit = song.kit as (k: KitApi) => void;
      let notes = 0;
      for (const hot of [false, true]) {
        for (let bar = 0; bar < 8; bar++) {
          for (let step = 0; step < 16; step++) {
            const root = song.root + song.scale[song.chords[bar % song.chords.length]] - 12;
            kit({
              hot,
              step,
              bar,
              t: 0,
              stepDur: 60 / song.bpm / 4,
              stepsPerBar: 16,
              chord: [root + 12, root + 16, root + 19],
              root,
              mel: step % 3 === 0 ? root + 12 : -1,
              melLen: 2,
              counter: -1,
              pat: (p: string) => p[step % p.length] === 'x',
              mtof,
              kick: () => notes++,
              snare: () => notes++,
              hat: () => notes++,
              brush: () => notes++,
              noise: () => notes++,
              voice: (f: number, _t: number, dur: number) => {
                expect(Number.isFinite(f) && f > 20 && f < 20000).toBe(true);
                expect(dur).toBeGreaterThan(0);
                notes++;
              },
            });
          }
        }
      }
      expect(notes).toBeGreaterThan(500);
    }
  });

  it('専用の効果音：どれも例外なく、有限の値で鳴らす', () => {
    const custom = animeStage.sfx.custom!;
    const names = Object.keys(custom);
    for (const need of ['bumper', 'sling', 'target', 'ramp', 'scoop', 'mission', 'multiball', 'jackpot', 'cutin', 'henshin', 'combo2', 'combo5']) expect(names).toContain(need);
    let calls = 0;
    const ok = (v: number | undefined) => v === undefined || (Number.isFinite(v) && v >= 0);
    const synth = {
      tone: (o: { freq: number; to?: number; dur: number; gain?: number; at?: number }) => {
        expect(o.freq).toBeGreaterThan(1);
        expect(o.dur).toBeGreaterThan(0);
        expect(ok(o.to) && ok(o.gain) && ok(o.at)).toBe(true);
        calls++;
      },
      noiseHit: (o: { dur: number; freq?: number; to?: number }) => {
        expect(o.dur).toBeGreaterThan(0);
        expect(ok(o.freq) && ok(o.to)).toBe(true);
        calls++;
      },
      bell: () => calls++,
    };
    for (const n of names) custom[n](synth, { pan: 0.3, speed: 40 });
    expect(calls).toBeGreaterThan(names.length);
  });
});
