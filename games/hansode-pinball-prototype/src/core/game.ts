// 1回のプレイ（3球制）を管理する。描画・音・DOMには依存しない（テストで早送りできる）。
import type { Ball } from '../physics/ball';
import { FLOOR, MAX_STEPS_PER_FRAME, STEP } from '../physics/constants';
import type { Flipper } from '../physics/flipper';
import type { BonusLine, StageDef, StageRules } from '../stages/types';
import { Table, type LightState, type PartRT, type TableEvent } from '../table/table';
import { Rng } from './rng';

export type MsgStyle = 'normal' | 'big' | 'flash' | 'small';

export type GameEvent =
  | { t: 'table'; e: TableEvent }
  | { t: 'flip'; side: 'left' | 'right'; up: boolean }
  | { t: 'score'; points: number; x?: number; y?: number }
  | { t: 'msg'; text: string; sub: string; time: number; style: MsgStyle }
  | { t: 'nudge'; dx: number; dy: number }
  | { t: 'tilt-warning'; n: number }
  | { t: 'tilt' }
  | { t: 'ballsave' }
  | { t: 'extraball' }
  | { t: 'jackpot'; value: number }
  | { t: 'multiball'; balls: number }
  | { t: 'multiball-end' }
  | { t: 'skillshot'; value: number }
  | { t: 'mission'; name: string }
  | { t: 'rank'; name: string; level: number }
  | { t: 'fx'; name: string; x?: number; y?: number; text?: string; color?: string; value?: number }
  | { t: 'shake'; amount: number }
  | { t: 'rumble'; strong: number; weak: number; ms: number }
  | { t: 'music'; intensity: number }
  | { t: 'song'; index: number }
  | { t: 'sfx'; name: string }
  | { t: 'ball-start'; ball: number }
  | { t: 'drain' }
  | { t: 'bonus'; lines: BonusLine[]; mult: number; total: number }
  | { t: 'bonus-line'; index: number }
  | { t: 'gameover'; score: number }
  | { t: 'gimmick'; name: string; text: string; sub: string; phase: 'warn' | 'start' | 'end' }
  | { t: 'autosave'; kind: 'nudge' | 'reset' };

export type GameState = 'play' | 'bonus' | 'over';

export interface HudInfo {
  mission: string;
  missionSub: string;
  progress: string;
  /** 補足（ボスHPなど） */
  extra: string;
}

export interface GameStats {
  lost: number;
  autoNudges: number;
  autoResets: number;
  invalid: number;
  drains: number;
  steps: number;
  hits: Map<string, number>;
}

export interface GameOptions {
  seed?: number;
  /** タイトルのデモ：自動でフリッパーを動かし、ボールは減らない */
  attract?: boolean;
  balls?: number;
}

export class Game {
  readonly stage: StageDef;
  readonly table: Table;
  readonly rules: StageRules;
  readonly rng: Rng;
  readonly attract: boolean;

  state: GameState = 'play';
  score = 0;
  ball = 1;
  readonly ballsPerGame: number;
  extraBalls = 0;
  pfMult = 1;
  bonusMult = 1;
  ballSaveTimer = 0;
  tilted = false;
  tiltMeter = 0;
  tiltWarnings = 0;
  /** 1ボール目発射から最後のボールが落ちるまでのプレイ時間（IMPOSSIBLE の生存時間） */
  survival = 0;
  /** 経過時間（ゲーム内） */
  time = 0;
  multiballActive = false;
  rank = 0;
  readonly hud: HudInfo = { mission: '', missionSub: '', progress: '', extra: '' };
  /** ルールが自由に使う数値（HUD表示用など） */
  readonly vars: Record<string, number> = {};
  /** 左右のフリッパー入力を入れ替える（IMPOSSIBLE） */
  swapFlippers = false;
  /** スキルショットの「ぴったり」の範囲（引き量 0..1） */
  skillWindow: [number, number] = [0.7, 0.78];
  skillShotReady = true;
  launchedThisBall = false;
  bonusLines: BonusLine[] = [];
  bonusTotal = 0;
  readonly stats: GameStats = { lost: 0, autoNudges: 0, autoResets: 0, invalid: 0, drains: 0, steps: 0, hits: new Map() };

  private listeners: ((e: GameEvent) => void)[] = [];
  private acc = 0;
  private timers: { t: number; fn: () => void }[] = [];
  private serveQueue = 0;
  private serveAuto = false;
  private serveCool = 0;
  private autoLaunchAt = -1;
  private nudgeCool = 0;
  private rulesAcc = 0;
  private input = { left: false, right: false, launch: false };
  private flipState = { left: false, right: false };
  private ai = { left: 0, right: 0, launchHold: 0 };
  private bonusTimer = 0;
  private bonusIndex = 0;

  constructor(stage: StageDef, opts: GameOptions = {}) {
    this.stage = stage;
    this.rng = new Rng(opts.seed ?? (Date.now() & 0xffffff));
    this.attract = !!opts.attract;
    this.ballsPerGame = opts.balls ?? 3;
    this.table = new Table(stage.layout());
    this.table.rand = () => this.rng.next();
    this.table.emitFn = (e) => this.onTableEvent(e);
    this.table.world.hooks.onInvalid = (b) => {
      this.stats.invalid++;
      this.resetBall(b);
    };
    this.rules = stage.rules();
    this.rules.init?.(this);
    this.startBall();
  }

  // ───────── 外部（入力・描画・音）向け ─────────

  on(fn: (e: GameEvent) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  emit(e: GameEvent): void {
    for (const l of this.listeners) l(e);
  }

  get world() {
    return this.table.world;
  }

  get balls(): Ball[] {
    return this.table.world.balls;
  }

  get flippers(): Flipper[] {
    return this.table.flippers;
  }

  /** 物理で動いている（捕まっていない）ボール */
  get freeBalls(): Ball[] {
    return this.balls.filter((b) => b.active && !b.captured);
  }

  get ballInLane(): boolean {
    return !!this.table.plunger?.ballOn();
  }

  get plungerPull(): number {
    return this.table.plunger?.pull ?? 0;
  }

  setFlipper(side: 'left' | 'right', down: boolean): void {
    if (this.attract) return;
    this.input[side] = down;
  }

  setLaunch(down: boolean): void {
    if (this.attract) return;
    if (down === this.input.launch) return;
    this.input.launch = down;
    const pl = this.table.plunger;
    if (!pl || this.state !== 'play') return;
    if (down) pl.pulling = true;
    else this.releasePlunger(false);
  }

  /** 台を揺らす。dir: 'left' = 左から揺らす（ボールは右へ押される） */
  nudge(dir: 'left' | 'right' | 'up'): void {
    if (this.state !== 'play' || this.nudgeCool > 0 || this.attract) return;
    this.nudgeCool = 0.15;
    const dx = dir === 'left' ? 1 : dir === 'right' ? -1 : 0;
    const dy = dir === 'up' ? 1 : 0;
    const k = 7.5;
    for (const b of this.freeBalls) {
      b.vx += dx * k * (0.8 + this.rng.next() * 0.4) + (this.rng.next() - 0.5) * 1.2;
      b.vy += dy * k * (0.8 + this.rng.next() * 0.4) + (dy ? 0 : (this.rng.next() - 0.3) * 2);
    }
    this.emit({ t: 'nudge', dx, dy });
    this.emit({ t: 'rumble', strong: 0.25, weak: 0.5, ms: 90 });
    if (this.tilted) return;
    this.tiltMeter += 1;
    if (this.tiltMeter > 2.7) {
      if (this.tiltWarnings < 2) {
        this.tiltWarnings++;
        this.tiltMeter = 1.3;
        this.emit({ t: 'tilt-warning', n: this.tiltWarnings });
        this.msg('WARNING', `揺らしすぎ注意（${this.tiltWarnings}/2）`, 1.6, 'flash');
      } else {
        this.doTilt();
      }
    }
  }

  /** フレームごとに呼ぶ。固定ステップで物理を進める */
  update(frameDt: number): number {
    this.acc += Math.max(0, Math.min(frameDt, 0.25));
    let n = 0;
    while (this.acc >= STEP && n < MAX_STEPS_PER_FRAME) {
      this.fixedStep();
      this.acc -= STEP;
      n++;
    }
    if (n >= MAX_STEPS_PER_FRAME) this.acc = 0;
    return n;
  }

  // ───────── ルール向け API ─────────

  part<T extends PartRT = PartRT>(id: string): T {
    return this.table.get<T>(id);
  }

  light(id: string, state: LightState): void {
    const l = this.table.light(id);
    if (l) l.state = state;
  }

  lightState(id: string): LightState {
    return this.table.light(id)?.state ?? 'off';
  }

  addScore(points: number, x?: number, y?: number): number {
    if (this.tilted || this.state === 'over' || this.attract) return 0;
    const p = Math.round(points * this.pfMult);
    this.score += p;
    this.emit({ t: 'score', points: p, x, y });
    return p;
  }

  msg(text: string, sub = '', time = 2, style: MsgStyle = 'normal'): void {
    this.emit({ t: 'msg', text, sub, time, style });
  }

  fx(name: string, x?: number, y?: number, extra: { text?: string; color?: string; value?: number } = {}): void {
    this.emit({ t: 'fx', name, x, y, ...extra });
  }

  shake(amount: number): void {
    this.emit({ t: 'shake', amount });
  }

  rumble(strong: number, weak: number, ms: number): void {
    this.emit({ t: 'rumble', strong, weak, ms });
  }

  sfx(name: string): void {
    this.emit({ t: 'sfx', name });
  }

  music(intensity: number): void {
    this.emit({ t: 'music', intensity });
  }

  song(index: number): void {
    this.emit({ t: 'song', index });
  }

  after(seconds: number, fn: () => void): void {
    this.timers.push({ t: seconds, fn });
  }

  ballSave(seconds: number): void {
    if (this.tilted) return;
    this.ballSaveTimer = Math.max(this.ballSaveTimer, seconds);
  }

  extraBall(): void {
    if (this.tilted) return;
    this.extraBalls++;
    this.emit({ t: 'extraball' });
    this.msg('EXTRA BALL', 'エクストラボール獲得！', 2.5, 'big');
    this.rumble(0.6, 0.8, 400);
  }

  jackpot(value: number, x?: number, y?: number): void {
    if (this.tilted) return;
    const p = this.addScore(value, x, y);
    this.emit({ t: 'jackpot', value: p });
    this.msg('JACKPOT', `${p.toLocaleString()} 点！`, 2.5, 'big');
    this.shake(1);
    this.rumble(1, 1, 500);
  }

  /** マルチボールを始める。extra 個のボールを追加（プランジャーから自動発射） */
  startMultiball(extra: number, save = 10): void {
    if (this.tilted) return;
    this.serveQueue += extra;
    this.serveAuto = true;
    this.ballSave(save);
    this.multiballActive = true;
    this.emit({ t: 'multiball', balls: extra + 1 });
    this.music(1);
    this.shake(0.8);
    this.rumble(0.8, 1, 600);
  }

  /** ボールを1個追加して指定位置から出す（スクープからの追加ボールなど） */
  addBallAt(x: number, y: number, vx: number, vy: number): Ball {
    const b = this.table.world.addBall(x, y);
    b.vx = vx;
    b.vy = vy;
    return b;
  }

  rankUp(): void {
    this.rank = Math.min(this.stage.ranks.length - 1, this.rank + 1);
    const name = this.stage.ranks[this.rank];
    this.emit({ t: 'rank', name, level: this.rank });
  }

  // ───────── 内部 ─────────

  private startBall(): void {
    this.tilted = false;
    this.table.tilted = false;
    this.tiltMeter = 0;
    this.tiltWarnings = 0;
    for (const f of this.flippers) f.enabled = true;
    this.pfMult = 1;
    this.bonusMult = 1;
    this.skillShotReady = true;
    this.launchedThisBall = false;
    const c = 0.58 + this.rng.next() * 0.3;
    this.skillWindow = [c - 0.045, c + 0.045];
    this.state = 'play';
    this.serveQueue = 1;
    this.serveAuto = this.attract;
    this.serveCool = 0;
    this.rules.onBallStart?.(this);
    this.emit({ t: 'ball-start', ball: this.ball });
  }

  private releasePlunger(auto: boolean): void {
    const pl = this.table.plunger;
    if (!pl) return;
    const onLane = pl.ballOn();
    const pull = pl.release();
    if (!onLane || pull < 0.04) return;
    if (!auto && !this.launchedThisBall) {
      this.launchedThisBall = true;
      this.ballSaveTimer = Math.max(this.ballSaveTimer, this.stage.ballSave);
      if (this.skillShotReady && pull >= this.skillWindow[0] && pull <= this.skillWindow[1]) {
        this.skillShotReady = false;
        const v = this.addScore(this.stage.skillShot);
        this.emit({ t: 'skillshot', value: v });
        this.msg('SKILL SHOT', `ぴったり！ ${v.toLocaleString()} 点`, 2.2, 'big');
      } else {
        this.skillShotReady = false;
      }
    } else if (auto && !this.launchedThisBall) {
      this.launchedThisBall = true;
      this.ballSaveTimer = Math.max(this.ballSaveTimer, this.stage.ballSave);
    }
  }

  private doTilt(): void {
    this.tilted = true;
    this.table.tilted = true;
    this.ballSaveTimer = 0;
    for (const f of this.flippers) {
      f.enabled = false;
    }
    this.emit({ t: 'tilt' });
    this.msg('TILT', 'このボールは得点なし', 4, 'flash');
    this.rumble(1, 1, 900);
    this.music(-1);
  }

  private resetBall(b: Ball): void {
    const s = this.table.layout.safeSpot;
    b.layer = FLOOR;
    b.z = 0;
    b.captured = null;
    b.hidden = false;
    b.place(s[0] + (this.rng.next() - 0.5) * 0.6, s[1], (this.rng.next() - 0.5) * 4, -2);
  }

  private onTableEvent(e: TableEvent): void {
    this.stats.hits.set(`${e.type}:${e.id}`, (this.stats.hits.get(`${e.type}:${e.id}`) ?? 0) + 1);
    switch (e.type) {
      case 'drain':
        if (e.ball) this.onDrain(e.ball);
        return;
      case 'lost':
        this.stats.lost++;
        if (e.ball) this.resetBall(e.ball);
        return;
      case 'launch':
        break;
    }
    this.emit({ t: 'table', e });
    if (this.tilted || this.state !== 'play') return;
    const base = this.stage.scores?.[e.type];
    if (base) this.addScore(base, e.x, e.y);
    if (e.type === 'bumper') this.rumble(0.15, 0.35, 60);
    this.rules.onEvent?.(this, e);
  }

  private onDrain(b: Ball): void {
    this.table.world.removeBall(b);
    this.stats.drains++;
    this.emit({ t: 'drain' });
    if (this.state !== 'play') return;
    if (this.attract) {
      if (this.balls.length === 0) this.serve(1, true);
      return;
    }
    if (this.ballSaveTimer > 0 && !this.tilted) {
      this.emit({ t: 'ballsave' });
      this.msg('BALL SAVED', 'ボールセーブ！', 1.8, 'big');
      this.serve(1, true);
      return;
    }
    const remaining = this.balls.filter((x) => x.active).length + this.serveQueue;
    if (remaining > 0) {
      // 残りが全部ロック中なら解放する
      if (this.freeBalls.length === 0 && this.serveQueue === 0) {
        for (const h of this.table.holders) h.release();
      }
      if (remaining === 1 && this.multiballActive) {
        this.multiballActive = false;
        this.emit({ t: 'multiball-end' });
        this.music(0);
        this.rules.onMultiballEnd?.(this);
      }
      return;
    }
    this.endOfBall();
  }

  private endOfBall(): void {
    this.multiballActive = false;
    this.rules.onBallEnd?.(this);
    this.state = 'bonus';
    this.ballSaveTimer = 0;
    for (const f of this.flippers) f.pressed = false;
    this.bonusLines = this.tilted ? [] : (this.rules.bonus?.(this) ?? []).filter((l) => l.count > 0);
    this.bonusTotal = this.bonusLines.reduce((s, l) => s + l.count * l.each, 0) * this.bonusMult;
    this.bonusIndex = 0;
    this.bonusTimer = 0.9;
    this.emit({ t: 'bonus', lines: this.bonusLines, mult: this.bonusMult, total: this.bonusTotal });
    this.music(-1);
  }

  private stepBonus(dt: number): void {
    this.bonusTimer -= dt;
    if (this.bonusTimer > 0) return;
    if (this.bonusIndex < this.bonusLines.length) {
      const l = this.bonusLines[this.bonusIndex];
      this.score += l.count * l.each * this.bonusMult;
      this.emit({ t: 'bonus-line', index: this.bonusIndex });
      this.bonusIndex++;
      this.bonusTimer = 0.55;
      return;
    }
    // 次のボールへ
    if (this.extraBalls > 0) {
      this.extraBalls--;
      this.msg('SHOOT AGAIN', 'もう一度同じボール！', 2, 'big');
    } else {
      this.ball++;
    }
    if (this.ball > this.ballsPerGame) {
      this.state = 'over';
      this.emit({ t: 'gameover', score: this.score });
      return;
    }
    this.music(0);
    this.startBall();
  }

  /** ボールをプランジャーへ出す */
  private serve(n: number, auto: boolean): void {
    this.serveQueue += n;
    this.serveAuto = this.serveAuto || auto;
  }

  private fixedStep(): void {
    const dt = STEP;
    this.stats.steps++;
    this.time += dt;
    if (this.nudgeCool > 0) this.nudgeCool -= dt;
    this.tiltMeter = Math.max(0, this.tiltMeter - dt * 0.55);

    if (this.state === 'bonus') {
      this.stepBonus(dt);
    }

    // 入力 → フリッパー
    if (this.attract) this.autoPlay(dt);
    const l = this.swapFlippers ? this.input.right : this.input.left;
    const r = this.swapFlippers ? this.input.left : this.input.right;
    for (const side of ['left', 'right'] as const) {
      const want = this.state === 'play' && (side === 'left' ? l : r);
      if (want !== this.flipState[side]) {
        this.flipState[side] = want;
        if (!this.tilted) {
          this.emit({ t: 'flip', side, up: want });
          if (want) this.rules.onFlip?.(this, side);
        }
      }
    }
    for (const f of this.flippers) f.pressed = this.flipState[f.side];

    // ボールの補充
    if (this.serveCool > 0) this.serveCool -= dt;
    const pl = this.table.plunger;
    if (this.serveQueue > 0 && this.serveCool <= 0 && pl && !pl.ballOn() && this.state === 'play') {
      this.serveQueue--;
      const b = this.table.world.addBall(pl.def.at[0], pl.def.at[1] + 0.05);
      b.vy = -1;
      this.serveCool = 0.6;
      if (this.serveAuto || this.attract) this.autoLaunchAt = this.time + 0.7 + (this.attract ? this.rng.next() : 0);
      if (this.serveQueue === 0) this.serveAuto = false;
    }
    if (this.autoLaunchAt > 0 && this.time >= this.autoLaunchAt && pl) {
      this.autoLaunchAt = -1;
      pl.pull = this.attract ? 0.55 + this.rng.next() * 0.4 : 0.78 + this.rng.next() * 0.12;
      this.releasePlunger(true);
    }

    this.table.step(dt);
    this.table.world.step(dt);

    if (this.state === 'play') {
      if (this.ballSaveTimer > 0) this.ballSaveTimer -= dt;
      if (this.launchedThisBall && !this.tilted) this.survival += dt;
      this.checkStuck(dt);
    }

    if (this.timers.length) {
      for (const t of this.timers) t.t -= dt;
      const due = this.timers.filter((t) => t.t <= 0);
      if (due.length) {
        this.timers = this.timers.filter((t) => t.t > 0);
        for (const t of due) t.fn();
      }
    }

    this.rulesAcc += dt;
    if (this.rulesAcc >= 1 / 60) {
      this.rules.update?.(this, this.rulesAcc);
      this.rulesAcc = 0;
    }
  }

  /** 約5秒ほぼ動かないボールは軽く揺らし、それでもだめなら安全な位置へ戻す */
  private checkStuck(dt: number): void {
    const pl = this.table.plunger;
    const laneBall = pl?.ballOn() ?? null;
    for (const b of this.balls) {
      if (!b.active || b.captured) continue;
      const dx = b.x - b.stillX, dy = b.y - b.stillY;
      if (dx * dx + dy * dy > 0.3 * 0.3) {
        b.stillX = b.x;
        b.stillY = b.y;
        b.stillTime = 0;
        continue;
      }
      // プランジャーの上・フリッパーで抱えている（キャッチ中）は正常
      if (b === laneBall) {
        b.stillTime = 0;
        continue;
      }
      if (b.touchingFlipper) {
        const f = this.flippers.find((x) => x.id === b.touchingFlipper);
        if (f && f.pressed) {
          b.stillTime = 0;
          continue;
        }
      }
      const before = b.stillTime;
      b.stillTime += dt;
      if (before < 5 && b.stillTime >= 5) {
        this.stats.autoNudges++;
        const a = this.rng.range(0.3, Math.PI - 0.3);
        b.vx += Math.cos(a) * 14;
        b.vy += Math.sin(a) * 14;
        this.emit({ t: 'autosave', kind: 'nudge' });
        this.emit({ t: 'nudge', dx: Math.cos(a) * 0.5, dy: Math.sin(a) * 0.5 });
      } else if (b.stillTime >= 7.5) {
        this.stats.autoResets++;
        this.resetBall(b);
        this.emit({ t: 'autosave', kind: 'reset' });
      }
    }
  }

  /** デモ用の自動プレイ：ボールがフリッパーに近づいたら打つ */
  autoPlay(dt: number, skill = 0.5): void {
    for (const side of ['left', 'right'] as const) {
      if (this.ai[side] > 0) {
        this.ai[side] -= dt;
        this.input[side] = this.ai[side] > 0.12;
        continue;
      }
      this.input[side] = false;
      for (const f of this.flippers) {
        if (f.side !== side) continue;
        const mx = (f.pivotX + f.tipX) / 2, my = (f.pivotY + f.tipY) / 2;
        for (const b of this.freeBalls) {
          if (b.layer !== FLOOR) continue;
          const d = Math.hypot(b.x - mx, b.y - my);
          if (d < f.length * 0.75 && b.vy < 4 && this.rng.next() < 0.08 + skill * 0.2) {
            this.ai[side] = 0.32 + this.rng.next() * 0.15;
          }
        }
      }
    }
  }

  /** テスト・デモ用：入力を直接書き換える */
  forceInput(left: boolean, right: boolean): void {
    this.input.left = left;
    this.input.right = right;
  }
}
