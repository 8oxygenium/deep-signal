// ミッション（ランク）制とレーンのしくみ。どのステージのルールからも使える部品。
import type { TableEvent } from '../table/table';
import type { Game } from './game';

export interface MissionDef {
  id: string;
  /** ドットマトリクスに出す英語名 */
  name: string;
  /** 日本語の説明（HUD） */
  desc: string;
  goal: number;
  /** このイベントで何進むか（0 なら関係なし） */
  count(e: TableEvent, g: Game): number;
  reward: number;
}

export interface MissionOptions {
  /** 1つ達成したとき */
  onComplete?(m: MissionDef, g: Game): void;
  /** 全部達成したとき（マルチボールの準備など） */
  onAllComplete?(g: Game): void;
  /** 周回ごとの目標の倍率 */
  scale?(round: number): number;
}

/** 順番に1つずつ挑戦するミッション。達成するとランクが上がる */
export class Missions {
  index = 0;
  progress = 0;
  done = 0;
  round = 0;
  active = true;
  constructor(
    readonly defs: MissionDef[],
    private readonly opts: MissionOptions = {},
  ) {}

  get current(): MissionDef | null {
    return this.active ? (this.defs[this.index] ?? null) : null;
  }

  goal(m = this.current): number {
    if (!m) return 0;
    const k = this.opts.scale ? this.opts.scale(this.round) : 1 + this.round * 0.5;
    return Math.max(1, Math.ceil(m.goal * k));
  }

  handle(g: Game, e: TableEvent): void {
    const m = this.current;
    if (!m) return;
    const inc = m.count(e, g);
    if (inc <= 0) return;
    this.progress += inc;
    if (this.progress >= this.goal(m)) this.complete(g);
  }

  /** テーブルのイベント以外（ハッキング成功など）でミッションを進める */
  advance(g: Game, n = 1): void {
    const m = this.current;
    if (!m || n <= 0) return;
    this.progress += n;
    if (this.progress >= this.goal(m)) this.complete(g);
  }

  complete(g: Game): void {
    const m = this.current;
    if (!m) return;
    this.progress = 0;
    this.done++;
    const v = g.addScore(m.reward * (1 + this.round));
    g.emit({ t: 'mission', name: m.name });
    g.msg('MISSION COMPLETE', `${m.desc} … 達成！ +${v.toLocaleString()}`, 2.6, 'big');
    g.rankUp();
    this.index++;
    if (this.index >= this.defs.length) {
      this.active = false;
      this.opts.onAllComplete?.(g);
    } else this.opts.onComplete?.(m, g);
  }

  /** もう一周（目標が上がる） */
  restart(): void {
    this.round++;
    this.index = 0;
    this.progress = 0;
    this.active = true;
  }

  /** HUD のミッション欄を更新 */
  hud(g: Game, idleTitle = '', idleSub = ''): void {
    const m = this.current;
    if (m) {
      g.hud.mission = m.name;
      g.hud.missionSub = m.desc;
      g.hud.progress = `${Math.min(this.progress, this.goal(m))}/${this.goal(m)}`;
    } else {
      g.hud.mission = idleTitle;
      g.hud.missionSub = idleSub;
      g.hud.progress = '';
    }
  }
}

/** 点灯させて全部そろえるレーン（ロールオーバーや的の組）。フリッパーでレーンチェンジもできる */
export class LaneSet {
  lit: boolean[];
  constructor(
    readonly ids: string[],
    /** 対応するライトのID（省略時は ids と同じ） */
    readonly lights: string[] = ids,
    private readonly onComplete: (g: Game) => void = () => {},
  ) {
    this.lit = ids.map(() => false);
  }

  /** 該当すれば true */
  hit(g: Game, id: string): boolean {
    const i = this.ids.indexOf(id);
    if (i < 0) return false;
    if (!this.lit[i]) {
      this.lit[i] = true;
      this.sync(g);
      if (this.lit.every(Boolean)) {
        for (const l of this.lights) g.light(l, 'fast');
        g.after(0.9, () => {
          this.lit = this.ids.map(() => false);
          this.sync(g);
        });
        this.onComplete(g);
      }
    }
    return true;
  }

  /** レーンチェンジ：点灯パターンを左右にずらす */
  rotate(g: Game, dir: 1 | -1): void {
    if (this.lit.every(Boolean) || this.lit.every((v) => !v)) return;
    const n = this.lit.length;
    this.lit = this.lit.map((_, i) => this.lit[(i - dir + n) % n]);
    this.sync(g);
  }

  sync(g: Game): void {
    this.lights.forEach((l, i) => g.light(l, this.lit[i] ? 'on' : 'off'));
  }

  reset(g: Game): void {
    this.lit = this.ids.map(() => false);
    this.sync(g);
  }

  get count(): number {
    return this.lit.filter(Boolean).length;
  }
}
