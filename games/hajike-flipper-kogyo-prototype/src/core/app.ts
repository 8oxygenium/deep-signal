// アプリ全体：画面の流れ（タイトル → ステージ選択 → プレイ → ゲームオーバー → 名前入力 → ランキング）、
// ゲームループ、保存、入力の振り分け。
import { AudioEngine } from '../audio/audio';
import { Renderer } from '../render/renderer';
import { STAGES } from '../stages';
import type { StageDef } from '../stages/types';
import { Hud } from '../ui/hud';
import {
  entryScreen,
  gameOverScreen,
  guideScreen,
  pauseScreen,
  rankingScreen,
  selectScreen,
  settingsScreen,
  titleScreen,
  type ScreenCtl,
} from '../ui/screens';
import { bridge, type A11yStatus } from './bridge';
import { Game, type GameEvent } from './game';
import { Input, type Action } from './input';
import { insertScore, loadScores, loadSettings, loadState, rankOf, saveScores, saveSettings, saveState, type AppState, type HighScores, type Settings } from './storage';

export type ScreenName = 'title' | 'select' | 'play' | 'pause' | 'settings' | 'gameover' | 'entry' | 'ranking' | 'guide';

export class App {
  renderer!: Renderer;
  input!: Input;
  audio!: AudioEngine;
  hud!: Hud;
  settings!: Settings;
  scores!: HighScores;
  state!: AppState;
  a11y: A11yStatus = { supported: false, active: false };
  screen: ScreenName = 'title';
  ctl: ScreenCtl | null = null;
  game: Game | null = null;
  /** タイトル・ステージ選択の裏で動くデモ */
  demo: Game | null = null;
  stage: StageDef = STAGES[0];
  selectIndex = 0;
  private uiRoot!: HTMLElement;
  private last = 0;
  private demoTimer = 0;
  private demoIndex = 0;
  private previewTimer: number | null = null;
  private gameOverTimer: number | null = null;
  private returnTo: ScreenName = 'title';
  private unsubGame: (() => void) | null = null;
  private lastName = '';
  private debug = false;
  private debugBox: HTMLDivElement | null = null;
  private suppressBack = 0;
  private mountedAt = 0;
  private pendingGameOver: number | null = null;
  private appliedFullscreen: boolean | null = null;
  private frameCount = 0;
  fps = 0;
  private fpsAcc = 0;
  private fpsFrames = 0;

  async init(root: HTMLElement): Promise<void> {
    [this.settings, this.scores, this.state] = await Promise.all([loadSettings(), loadScores(), loadState()]);
    this.a11y = await bridge.a11yStatus();
    this.renderer = new Renderer(root, { quality: this.settings.quality, camera: this.settings.camera, shake: this.settings.shake });
    this.uiRoot = document.createElement('div');
    this.uiRoot.id = 'ui';
    root.appendChild(this.uiRoot);
    this.hud = new Hud(this.uiRoot);
    this.hud.bindings = this.settings.bindings;
    this.audio = new AudioEngine();
    this.input = new Input(this.settings.bindings);
    this.input.rumbleEnabled = this.settings.rumble;
    this.input.setHandler((a, down, src) => this.onAction(a, down, src));
    this.applySettings();
    const lastIdx = STAGES.findIndex((s) => s.id === this.state.lastStage);
    this.selectIndex = lastIdx >= 0 ? lastIdx : 0;

    window.addEventListener('resize', () => this.hud.resize());
    window.addEventListener('blur', () => {
      if (bridge.info.e2e) return;
      if (this.screen === 'play') this.pause();
      else this.game?.cancelLaunch();
      // 他のアプリを使っている間は音を止める
      void this.audio.ctx.suspend();
    });
    window.addEventListener('focus', () => this.audio.resume());
    window.addEventListener('pointerdown', () => this.audio.resume());
    bridge.onFullscreenChange?.((on) => {
      this.appliedFullscreen = on;
      if (this.settings.fullscreen !== on) {
        this.settings.fullscreen = on;
        void saveSettings(this.settings);
        this.ctl?.refresh?.(this.settings);
      }
    });

    if (!this.state.guideHidden && !bridge.info.e2e) this.showGuide('title');
    else this.toTitle();

    const loop = (now: number) => {
      const dt = this.last ? Math.max(0, Math.min(0.1, (now - this.last) / 1000)) : 0;
      this.last = now;
      this.frame(dt);
      if (!useInterval) requestAnimationFrame(loop);
    };
    const useInterval = bridge.info.e2e && !bridge.info.raf;
    if (useInterval) window.setInterval(() => loop(performance.now()), 16);
    else requestAnimationFrame(loop);
  }

  private applySettings(): void {
    const s = this.settings;
    this.audio.setVolumes(s.bgm, s.sfx);
    this.input.rumbleEnabled = s.rumble;
    this.input.setBindings(s.bindings);
    this.hud.bindings = s.bindings;
    this.renderer.setOptions({ quality: s.quality, camera: s.camera, shake: s.shake });
    if (this.appliedFullscreen !== s.fullscreen) {
      this.appliedFullscreen = s.fullscreen;
      void bridge.isFullscreen().then((on) => {
        if (on !== s.fullscreen) void bridge.setFullscreen(s.fullscreen);
      });
    }
  }

  // ───────── 画面の切り替え ─────────

  private mount(name: ScreenName, ctl: ScreenCtl | null): void {
    // ステージ選択を離れたら、プレビュー切り替えの待ちタイマーを捨てる（プレイ画面がデモにすり替わるのを防ぐ）
    if (name !== 'select' && this.previewTimer !== null) {
      window.clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    this.mountedAt = performance.now();
    this.ctl?.destroy?.();
    this.uiRoot.querySelectorAll('.screen').forEach((e) => e.remove());
    this.screen = name;
    this.ctl = ctl;
    if (ctl) this.uiRoot.appendChild(ctl.el);
    this.input.inGame = name === 'play';
  }

  private sound = (n: 'uiMove' | 'uiOk' | 'uiBack' | 'ominous') => {
    this.audio.resume();
    this.audio.play(n);
  };

  private setDemo(stage: StageDef, preview: boolean): void {
    if (this.demo && this.demo.stage === stage) {
      this.renderer.preview = preview;
      return;
    }
    this.demo = new Game(stage, { attract: true, seed: Math.floor(Math.random() * 1e6) });
    this.renderer.setGame(this.demo);
    this.renderer.preview = preview;
    this.renderer.topReserve = 0;
  }

  toTitle(): void {
    this.endGame();
    this.hud.show(false);
    this.audio.music.stop();
    this.setDemo(STAGES[this.demoIndex % STAGES.length], false);
    this.demoTimer = 0;
    this.mount(
      'title',
      titleScreen(bridge.info.version, this.sound, {
        start: () => this.toSelect(),
        settings: () => this.showSettings('title'),
        guide: () => this.showGuide('title'),
        quit: () => bridge.quit(),
      }),
    );
  }

  toSelect(): void {
    this.endGame();
    this.hud.show(false);
    this.mount(
      'select',
      selectScreen(STAGES, this.scores, this.selectIndex, this.sound, {
        focus: (i) => this.previewStage(i),
        pick: (i) => this.startStage(STAGES[i]),
        back: () => this.toTitle(),
      }),
    );
    this.previewStage(this.selectIndex, true);
  }

  private previewStage(i: number, now = false): void {
    this.selectIndex = i;
    if (this.previewTimer !== null) window.clearTimeout(this.previewTimer);
    const run = () => {
      this.previewTimer = null;
      if (this.screen !== 'select') return;
      const st = STAGES[i];
      this.setDemo(st, true);
      this.audio.setStage(st);
      this.audio.music.setSongs(st.music.songs);
      this.audio.music.setIntensity(0);
      this.audio.music.start();
    };
    if (now) run();
    else this.previewTimer = window.setTimeout(run, 140);
  }

  startStage(stage: StageDef): void {
    this.endGame();
    this.stage = stage;
    this.state.lastStage = stage.id;
    void saveState(this.state);
    this.demo = null;
    const g = new Game(stage);
    this.game = g;
    this.renderer.setGame(g);
    this.renderer.preview = false;
    this.hud.setGame(g);
    this.hud.show(true);
    this.audio.setStage(stage);
    this.audio.music.setSongs(stage.music.songs);
    this.audio.music.setIntensity(0);
    this.audio.music.start();
    this.unsubGame = g.on((e) => this.onGameEvent(e));
    this.mount('play', null);
    requestAnimationFrame(() => (this.renderer.topReserve = this.hud.topFraction));
  }

  private endGame(): void {
    this.unsubGame?.();
    this.unsubGame = null;
    if (this.gameOverTimer !== null) window.clearTimeout(this.gameOverTimer);
    this.gameOverTimer = null;
    this.audio.pull(false);
    this.pendingGameOver = null;
    this.hud.setPaused(false);
    this.game = null;
  }

  pause(): void {
    if (this.screen !== 'play' || !this.game) return;
    this.input.releaseAll();
    this.game.setFlipper('left', false);
    this.game.setFlipper('right', false);
    // 押しっぱなしの発射は撃たずに取り消す
    this.game.cancelLaunch();
    this.audio.pull(false);
    this.audio.music.setPaused(true);
    this.hud.setPaused(true);
    this.showPauseMenu();
  }

  /** ポーズ画面を出す（設定から戻るときもこれ） */
  private showPauseMenu(): void {
    if (!this.game) return;
    this.mount(
      'pause',
      pauseScreen(this.sound, {
        resume: () => this.resume(),
        retry: () => this.startStage(this.stage),
        select: () => this.toSelect(),
        settings: () => this.showSettings('pause'),
        quit: () => bridge.quit(),
      }),
    );
  }

  resume(): void {
    this.audio.music.setPaused(false);
    this.hud.setPaused(false);
    this.mount('play', null);
    this.renderer.topReserve = this.hud.topFraction;
    // ポーズ中にゲームオーバーになっていたら、ここで出す
    if (this.pendingGameOver !== null) {
      const sc = this.pendingGameOver;
      this.pendingGameOver = null;
      this.onGameOver(sc);
    }
  }

  showSettings(from: ScreenName): void {
    this.returnTo = from;
    this.mount(
      'settings',
      settingsScreen(this.settings, this.sound, (cb) => this.input.captureNext(cb), {
        change: (s) => {
          this.settings = s;
          this.applySettings();
          void saveSettings(s);
        },
        guide: () => this.showGuide('settings'),
        back: () => {
          if (this.returnTo === 'pause') this.showPauseMenu();
          else this.toTitle();
        },
      }),
    );
  }

  showGuide(from: ScreenName): void {
    const back = from;
    this.mount(
      'guide',
      guideScreen(this.a11y, this.state.guideHidden, this.sound, (hide) => {
        this.state.guideHidden = hide;
        void saveState(this.state);
        if (back === 'settings') this.showSettings(this.returnTo);
        else this.toTitle();
      }),
    );
    if (!this.demo && !this.game) this.setDemo(STAGES[0], false);
  }

  private onGameOver(score: number): void {
    const g = this.game!;
    const stage = g.stage;
    const time = g.survival;
    const rank = rankOf(this.scores[stage.id], score);
    this.hud.show(false);
    this.audio.music.stop();
    this.mount(
      'gameover',
      gameOverScreen(stage, score, time, rank, this.sound, () => {
        if (rank >= 0) {
          this.mount(
            'entry',
            entryScreen(score, this.lastName, this.sound, (h) => (this.input.textHandler = h), (name) => {
              this.lastName = name;
              const i = insertScore(this.scores, stage.id, { name, score, time: stage.survival ? time : undefined, date: new Date().toISOString() });
              void saveScores(this.scores);
              this.showRanking(stage, i);
            }),
          );
        } else this.showRanking(stage, -1);
      }),
    );
  }

  /** 自動テスト用：今のゲームをこの点数で終わらせる */
  debugGameOver(score: number): void {
    if (!this.game) return;
    this.game.score = score;
    this.game.state = 'over';
    this.onGameOver(score);
  }

  private showRanking(stage: StageDef, highlight: number): void {
    this.mount('ranking', rankingScreen(stage, this.scores[stage.id] ?? [], highlight, this.sound, () => this.toSelect()));
  }

  // ───────── 入力 ─────────

  private onAction(a: Action, down: boolean, src: 'key' | 'pad'): void {
    this.audio.resume();
    if (a === 'fullscreen') {
      this.settings.fullscreen = !this.settings.fullscreen;
      this.appliedFullscreen = this.settings.fullscreen;
      void bridge.setFullscreen(this.settings.fullscreen);
      void saveSettings(this.settings);
      this.ctl?.refresh?.(this.settings);
      return;
    }
    if (a === 'debug') {
      if (bridge.info.isDev) {
        this.debug = !this.debug;
        this.renderer.setDebug(this.debug);
        this.debugBox?.remove();
        this.debugBox = null;
        if (this.debug) {
          this.debugBox = document.createElement('div');
          this.debugBox.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;font:12px/1.4 monospace;color:#7f7;background:#000a;padding:4px 8px;pointer-events:none;white-space:pre';
          document.body.appendChild(this.debugBox);
        }
      }
      return;
    }
    if (this.screen === 'play' && this.game) {
      const g = this.game;
      switch (a) {
        case 'left':
        case 'right':
          g.setFlipper(a, down);
          return;
        case 'launch':
          g.setLaunch(down);
          if (down && g.ballInLane) this.audio.play('pullStart');
          if (!down) this.audio.pull(false);
          return;
        case 'nudgeLeft':
          if (down) g.nudge('left');
          return;
        case 'nudgeRight':
          if (down) g.nudge('right');
          return;
        case 'nudgeUp':
          if (down) g.nudge('up');
          return;
        case 'pause':
          if (down) {
            this.pause();
            // 同じ Esc キーから続けて届く「戻る」で、すぐ再開してしまわないように
            this.suppressBack = performance.now() + 120;
          }
          return;
      }
      return;
    }
    if (!down) return;
    if (a === 'back' && performance.now() < this.suppressBack) return;
    // 画面が出た直後の誤決定を防ぐ
    if (performance.now() - this.mountedAt < 220) return;
    // キーボードの Esc は pause と back の両方で届くので、メニューでは back だけ使う
    if (a === 'pause' && src === 'key') return;
    // メニュー：ゲームパッドの A は ok として届くので、launch は無視
    if (a === 'launch' && src === 'pad') return;
    // キーボードの Space/Enter は ok と launch の両方で来るので、メニューでは ok だけ使う
    if (a === 'launch' || a === 'left' || a === 'right' || a.startsWith('nudge')) return;
    this.ctl?.onAction(a);
  }

  private onGameEvent(e: GameEvent): void {
    this.audio.onGameEvent(e);
    if (e.t === 'rumble') this.input.rumble(e.strong, e.weak, e.ms);
    if (e.t === 'tilt') this.input.rumble(1, 1, 700);
    if (e.t === 'gameover') {
      this.gameOverTimer = window.setTimeout(() => {
        this.gameOverTimer = null;
        if (this.screen === 'play') this.onGameOver(e.score);
        else this.pendingGameOver = e.score;
      }, 1600);
    }
  }

  // ───────── 毎フレーム ─────────

  private frame(dt: number): void {
    this.frameCount++;
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 1) {
      this.fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
      if (this.debugBox) {
        const g = this.game;
        this.debugBox.textContent = `${this.fps.toFixed(0)} fps  解像度×${this.renderer.renderScale}  ${this.settings.quality}` + (g ? `
balls ${g.balls.length}  lost ${g.stats.lost}  autoNudge ${g.stats.autoNudges}  reset ${g.stats.autoResets}` : '');
      }
    }
    this.input.pollGamepads();
    if (this.screen === 'play' && this.game) {
      this.game.update(dt);
      const pl = this.game.table.plunger;
      if (pl?.pulling && this.game.ballInLane) this.audio.pull(true, pl.pull);
    } else if (this.demo && (this.screen === 'title' || this.screen === 'select' || this.screen === 'guide' || (this.screen === 'settings' && this.returnTo === 'title'))) {
      this.demo.update(dt);
      if (this.screen === 'title') {
        this.demoTimer += dt;
        if (this.demoTimer > 28 && STAGES.length > 1) {
          this.demoTimer = 0;
          this.demoIndex++;
          this.setDemo(STAGES[this.demoIndex % STAGES.length], false);
        }
      }
    }
    if (this.screen === 'play' || this.screen === 'pause') this.hud.update(dt);
    this.ctl?.update?.(dt);
    this.renderer.render(dt);
  }
}
