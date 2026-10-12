// Three.js の描画全体：シーン、カメラ、ポストエフェクト、演出（揺れ・パーティクル）
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Game, GameEvent } from '../core/game';
import type { StageDef } from '../stages/types';
import type { Quality } from './materials';
import { TableView } from './tableView';
import { AlarmPass, ComicPass, GlitchPass, GradePass, OutlineRenderPass } from './passes';
import { Particles, Popups, type ParticleKind, type PopupStyle } from './effects';
import { CH } from '../table/chassis';

export type CameraMode = 'fixed' | 'follow' | 'top';

const TABLE_CENTER = new THREE.Vector3(0.75, 0, -19.8);

const COMIC_WORDS = ['BAM!', 'POW!', 'KRAK!', 'ZAP!', 'WHAM!', 'BOOM!', 'THWIP!', 'KA-POW!', 'BLAM!', 'SMASH!'];

export interface RendererOptions {
  quality: Quality;
  camera: CameraMode;
  shake: number;
}

export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private glitch: GlitchPass | null = null;
  private alarm: AlarmPass | null = null;
  private pivot = new THREE.Group();
  private view: TableView | null = null;
  private particles: Particles;
  private popups = new Popups();
  private lights = new THREE.Group();
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private redLights: THREE.PointLight[] = [];
  private envTex: THREE.Texture;
  private stage: StageDef | null = null;
  private game: Game | null = null;
  private unsub: (() => void) | null = null;
  private time = 0;
  private shakeAmp = 0;
  private shakeVec = new THREE.Vector2();
  private jiggle = new THREE.Vector3();
  private jiggleVel = new THREE.Vector3();
  private followY = 12;
  private width = 1;
  private height = 1;
  private debug = false;
  private ambientAcc = 0;
  /** 画面上部の HUD の高さ（割合） */
  topReserve = 0.13;
  /** ステージ選択のプレビュー表示 */
  preview = false;
  opts: RendererOptions;

  constructor(
    readonly container: HTMLElement,
    opts: RendererOptions,
  ) {
    this.opts = { ...opts };
    this.gl = new THREE.WebGLRenderer({ antialias: opts.quality !== 'low', powerPreference: 'high-performance' });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, opts.quality === 'high' ? 2 : opts.quality === 'mid' ? 1.5 : 1));
    this.gl.shadowMap.enabled = opts.quality !== 'low';
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 0.85;
    container.appendChild(this.gl.domElement);
    this.gl.domElement.className = 'gl';

    const pm = new THREE.PMREMGenerator(this.gl);
    this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.45;

    this.hemi = new THREE.HemisphereLight('#ffffff', '#303040', 1.2);
    this.sun = new THREE.DirectionalLight('#ffffff', 2.2);
    this.sun.position.set(-6, 30, 6);
    this.sun.target.position.copy(TABLE_CENTER);
    this.sun.castShadow = opts.quality !== 'low';
    this.sun.shadow.mapSize.set(opts.quality === 'high' ? 2048 : 1024, opts.quality === 'high' ? 2048 : 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -16;
    sc.right = 16;
    sc.top = 26;
    sc.bottom = -26;
    sc.near = 1;
    sc.far = 80;
    this.sun.shadow.bias = -0.0008;
    this.lights.add(this.hemi, this.sun, this.sun.target);
    this.scene.add(this.lights, this.pivot);

    this.particles = new Particles(this.gl.getPixelRatio());

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get canvas(): HTMLCanvasElement {
    return this.gl.domElement;
  }

  setGame(game: Game): void {
    this.unsub?.();
    if (this.view) {
      this.pivot.remove(this.view.group);
      this.view.dispose();
    }
    this.game = game;
    this.stage = game.stage;
    const stage = game.stage;
    this.view = new TableView(stage, game, this.opts.quality);
    this.view.group.position.set(-TABLE_CENTER.x, 0, -TABLE_CENTER.z);
    this.pivot.position.copy(TABLE_CENTER);
    this.pivot.clear();
    this.pivot.add(this.view.group);
    this.view.group.add(this.particles.points, this.popups.group);
    if (this.debug) this.view.setDebug(true);

    const th = stage.theme;
    this.scene.background = new THREE.Color(th.colors.bg);
    const li = th.light ?? 1;
    this.hemi.intensity = 0.55 * li;
    this.sun.intensity = 1.5 * li;
    this.scene.environmentIntensity = 0.4 * li;
    this.hemi.color.set(stage.theme.style === 'route50s' ? '#ffe8c0' : '#ffffff');
    this.particles.setBlending(stage.theme.style !== 'comic');
    for (const r of this.redLights) this.lights.remove(r);
    this.redLights = [];
    if (th.style === 'impossible') {
      for (let i = 0; i < 2; i++) {
        const p = new THREE.PointLight('#ff2020', 30, 30, 1.6);
        this.redLights.push(p);
        this.lights.add(p);
      }
    }
    this.followY = 12;
    this.buildComposer();
    this.unsub = game.on((e) => this.onEvent(e));
  }

  setDebug(on: boolean): void {
    this.debug = on;
    this.view?.setDebug(on);
  }

  setOptions(o: Partial<RendererOptions>): void {
    const needRebuild = o.quality !== undefined && o.quality !== this.opts.quality;
    this.opts = { ...this.opts, ...o };
    if (needRebuild) {
      this.gl.setPixelRatio(Math.min(window.devicePixelRatio, this.opts.quality === 'high' ? 2 : this.opts.quality === 'mid' ? 1.5 : 1));
      this.gl.shadowMap.enabled = this.opts.quality !== 'low';
      this.sun.castShadow = this.opts.quality !== 'low';
      if (this.game) this.setGame(this.game);
      this.resize();
    }
  }

  private buildComposer(): void {
    const stage = this.stage!;
    const style = stage.theme.style;
    const q = this.opts.quality;
    this.composer?.dispose();
    const composer = new EffectComposer(this.gl);
    if (style === 'anime' || style === 'comic') {
      composer.addPass(new OutlineRenderPass(this.scene, this.camera, this.gl, style === 'comic' ? 0.006 : 0.0035));
    } else {
      composer.addPass(new RenderPass(this.scene, this.camera));
    }
    this.bloom = null;
    if (q !== 'low') {
      const strength = stage.theme.bloom ?? 0.6;
      this.bloom = new UnrealBloomPass(new THREE.Vector2(this.width, this.height), strength, 0.5, 0.9);
      composer.addPass(this.bloom);
    }
    this.glitch = null;
    this.alarm = null;
    if (style === 'comic') composer.addPass(new ComicPass());
    if (style === 'cyber') {
      this.glitch = new GlitchPass();
      composer.addPass(this.glitch);
    }
    if (style === 'impossible') {
      this.alarm = new AlarmPass();
      composer.addPass(this.alarm);
    }
    composer.addPass(new OutputPass());
    if (style === 'modern') composer.addPass(new GradePass(new THREE.Color(0.97, 1.0, 1.04), 0.35, 1.0));
    else if (style === 'route50s') composer.addPass(new GradePass(new THREE.Color(1.06, 1.0, 0.9), 0.5, 1.05));
    else if (style === 'cyber') composer.addPass(new GradePass(new THREE.Color(1, 1, 1), 0.55, 1.15));
    else composer.addPass(new GradePass(new THREE.Color(1, 1, 1), 0.3, 1.05));
    this.composer = composer;
    this.composer.setSize(this.width, this.height);
  }

  resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.width = w;
    this.height = h;
    this.gl.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
    this.bloom?.setSize(w, h);
  }

  // ───────── カメラ ─────────

  private corners(y0 = -1.6, y1 = 41.6): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    for (const x of [CH.left - 1.0, CH.laneOuter + 1.0]) for (const h of [0, 2.2]) for (const y of [y0, y1]) out.push(new THREE.Vector3(x, h, -y));
    return out;
  }

  /** 箱が画面の空き部分にちょうど収まるようにカメラを置く */
  private fit(target: THREE.Vector3, dir: THREE.Vector3, pts: THREE.Vector3[], marginX: number, top: number, bottom = 0.02): void {
    const cam = this.camera;
    const proj = (d: number) => {
      cam.position.copy(target).addScaledVector(dir, d);
      cam.lookAt(target);
      cam.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      const v = new THREE.Vector3();
      for (const p of pts) {
        v.copy(p).applyMatrix4(this.pivotMatrix()).project(cam);
        x0 = Math.min(x0, v.x);
        x1 = Math.max(x1, v.x);
        y0 = Math.min(y0, v.y);
        y1 = Math.max(y1, v.y);
      }
      return { x0, x1, y0, y1 };
    };
    const availW = 2 * (1 - marginX);
    const availH = 2 - top * 2 - bottom * 2;
    let lo = 5, hi = 300;
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) / 2;
      const b = proj(mid);
      if (b.x1 - b.x0 <= availW && b.y1 - b.y0 <= availH) hi = mid;
      else lo = mid;
    }
    const d = hi;
    // 中心を合わせる
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    for (let k = 0; k < 3; k++) {
      const b = proj(d);
      const cx = (b.x0 + b.x1) / 2;
      const cy = (b.y0 + b.y1) / 2;
      const wantY = -top + bottom;
      const halfH = d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const halfW = halfH * cam.aspect;
      right.setFromMatrixColumn(cam.matrixWorld, 0);
      up.setFromMatrixColumn(cam.matrixWorld, 1);
      target.addScaledVector(right, cx * halfW * 0.9);
      target.addScaledVector(up, (cy - wantY) * halfH * 0.9);
    }
    proj(d);
  }

  private pivotMatrix(): THREE.Matrix4 {
    this.pivot.updateMatrixWorld();
    return this.view ? this.view.group.matrixWorld : new THREE.Matrix4();
  }

  private placeCamera(dt: number): void {
    const cam = this.camera;
    cam.clearViewOffset();
    if (this.preview) {
      const az = Math.sin(this.time * 0.25) * 0.55;
      const el = THREE.MathUtils.degToRad(34);
      const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      this.fit(TABLE_CENTER.clone(), dir, this.corners(), 0.08, 0.12, 0.08);
      cam.setViewOffset(this.width, this.height, -this.width * 0.2, 0, this.width, this.height);
      return;
    }
    const mode = this.opts.camera;
    if (mode === 'top') {
      const dir = new THREE.Vector3(0, 1, 0.02).normalize();
      this.fit(TABLE_CENTER.clone(), dir, this.corners(), 0.04, this.topReserve);
    } else if (mode === 'follow') {
      let by = 10;
      const balls = this.game?.balls.filter((b) => b.active && !b.hidden) ?? [];
      if (balls.length) by = Math.min(...balls.map((b) => b.y));
      this.followY += (Math.min(29, Math.max(11, by + 4)) - this.followY) * Math.min(1, dt * 3);
      const el = THREE.MathUtils.degToRad(42);
      const dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el));
      const y0 = Math.max(-1.6, this.followY - 13);
      this.fit(new THREE.Vector3(0.75, 0, -this.followY), dir, this.corners(y0, y0 + 26), 0.04, this.topReserve);
    } else {
      const el = THREE.MathUtils.degToRad(57);
      const dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el));
      this.fit(TABLE_CENTER.clone(), dir, this.corners(), 0.04, this.topReserve);
    }
    // 画面の揺れ
    if (this.shakeAmp > 0.001) {
      const s = this.shakeAmp * this.opts.shake;
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      const nx = this.shakeVec.x * s + (Math.random() - 0.5) * s * 0.5;
      const ny = this.shakeVec.y * s + (Math.random() - 0.5) * s * 0.5;
      cam.position.addScaledVector(right, nx).addScaledVector(up, ny);
      this.shakeVec.multiplyScalar(-0.75);
    }
  }

  // ───────── 演出 ─────────

  shake(amount: number, dx = 0, dy = 0): void {
    this.shakeAmp = Math.min(1.6, this.shakeAmp + amount);
    if (dx || dy) this.shakeVec.set(dx, dy);
    else this.shakeVec.set(Math.random() - 0.5, Math.random() - 0.5).normalize();
  }

  private color(kind: 'accent' | 'accent2' | 'bumper'): string {
    const c = this.stage!.theme.colors;
    return kind === 'accent' ? c.accent : kind === 'accent2' ? c.accent2 : c.bumperCap;
  }

  private hitFx(x: number, y: number, big: boolean): void {
    const style = this.stage!.theme.style;
    const n = big ? 26 : 12;
    let kind: ParticleKind = 'spark';
    if (style === 'anime') kind = 'star';
    else if (style === 'cyber') kind = 'square';
    this.particles.burst(x, y, 0.9, this.color('accent'), n, big ? 9 : 6, kind, style === 'anime' ? 0.55 : 0.32, 0.45);
    if (style === 'comic' && (big || Math.random() < 0.6)) {
      const w = COMIC_WORDS[Math.floor(Math.random() * COMIC_WORDS.length)];
      const cols = ['#ff3b30', '#2f7bff', '#ffcc00', '#ff6ad5'];
      this.popups.add(x, y, 2.4, w, 'comic', cols[Math.floor(Math.random() * cols.length)], big ? 0.9 : 0.7, 0.8);
    }
  }

  popup(x: number, y: number, text: string, style: PopupStyle, color: string, scale = 1, life = 1.1): void {
    this.popups.add(x, y, 2.5, text, style, color, scale, life);
  }

  private onEvent(e: GameEvent): void {
    if (!this.stage) return;
    const style = this.stage.theme.style;
    switch (e.t) {
      case 'table': {
        const te = e.e;
        switch (te.type) {
          case 'bumper':
            this.hitFx(te.x, te.y, false);
            break;
          case 'sling':
            this.particles.burst(te.x, te.y, 0.6, this.color('accent2'), 8, 5, style === 'cyber' ? 'square' : 'spark', 0.25, 0.3);
            if (style === 'comic' && Math.random() < 0.4) this.popups.add(te.x, te.y, 2, 'POW!', 'comic', '#ff3b30', 0.55, 0.6);
            break;
          case 'drop':
          case 'standup':
            this.hitFx(te.x, te.y, false);
            break;
          case 'bank':
            this.hitFx(te.x, te.y, true);
            break;
          case 'ramp':
            this.particles.burst(te.x, te.y, 1.2, this.color('accent'), 20, 7, style === 'anime' ? 'star' : style === 'cyber' ? 'square' : 'spark', 0.4, 0.6);
            break;
          case 'scoop':
          case 'warp':
            this.particles.burst(te.x, te.y, 0.5, this.color('accent2'), 16, 5, style === 'cyber' ? 'square' : 'spark', 0.35, 0.5);
            break;
          case 'launch':
            this.shake(0.15, 0, -1);
            break;
          case 'wall':
            if (te.speed > 40) this.shake(0.05);
            break;
        }
        break;
      }
      case 'nudge':
        this.shake(0.35, e.dx, e.dy * 0.6);
        this.jiggleVel.x += e.dx * 0.5;
        this.jiggleVel.z -= e.dy * 0.5;
        break;
      case 'shake':
        this.shake(e.amount * 0.7);
        break;
      case 'tilt':
        this.shake(1.2);
        break;
      case 'jackpot':
      case 'multiball':
        this.shake(0.9);
        if (this.game) {
          for (const b of this.game.balls) this.particles.burst(b.x, b.y, 1, this.color('accent'), 30, 10, style === 'anime' ? 'star' : 'spark', 0.5, 0.8);
        }
        break;
      case 'fx':
        this.onFx(e);
        break;
      case 'score':
        if (e.points >= 25000 && e.x !== undefined && e.y !== undefined) {
          this.popup(e.x, e.y, e.points.toLocaleString(), style === 'cyber' ? 'glitch' : style === 'anime' ? 'anime' : 'score', this.color('accent'), 0.6, 0.9);
        }
        break;
    }
  }

  private onFx(e: Extract<GameEvent, { t: 'fx' }>): void {
    const x = e.x ?? 0.75, y = e.y ?? 20;
    switch (e.name) {
      case 'burst':
        this.particles.burst(x, y, 1, e.color ?? this.color('accent'), 30, 9, 'spark', 0.45, 0.7);
        break;
      case 'stars':
        this.particles.burst(x, y, 1, e.color ?? this.color('accent'), 30, 9, 'star', 0.6, 0.9);
        break;
      case 'petals':
        for (let i = 0; i < (e.value ?? 40); i++) {
          this.particles.spawn(-8 + Math.random() * 18, 6 + Math.random() * 4, -Math.random() * 40, (Math.random() - 0.3) * 2, -1, (Math.random() - 0.5) * 2, new THREE.Color(Math.random() < 0.5 ? '#ffc0d8' : '#ffe0ec'), 0.5, 4 + Math.random() * 2, 'petal', -1.2);
        }
        break;
      case 'confetti':
        for (let i = 0; i < 60; i++) {
          const c = new THREE.Color().setHSL(Math.random(), 0.9, 0.6);
          this.particles.spawn(x + (Math.random() - 0.5) * 4, 3, -y + (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 10, 6 + Math.random() * 6, (Math.random() - 0.5) * 10, c, 0.35, 2, 'square', -9);
        }
        break;
      case 'text':
        this.popup(x, y, e.text ?? '', this.stage!.theme.style === 'comic' ? 'comic' : this.stage!.theme.style === 'cyber' ? 'glitch' : this.stage!.theme.style === 'impossible' ? 'warn' : 'anime', e.color ?? this.color('accent'), 1, 1.4);
        break;
      case 'comic':
        this.popups.add(x, y, 2.6, e.text ?? 'POW!', 'comic', e.color ?? '#ff3b30', 1.1, 1.0);
        break;
      case 'glitch':
        if (this.glitch) this.glitch.amount = Math.max(this.glitch.amount, e.value ?? 1);
        break;
    }
  }

  // ───────── 毎フレーム ─────────

  render(dt: number): void {
    this.time += dt;
    const game = this.game;
    if (!game || !this.view || !this.composer) return;
    this.view.update(game, this.time, dt);
    this.particles.update(dt);
    this.popups.update(dt);

    // 台の揺れ（部品が少し遅れて揺れる）
    this.jiggleVel.addScaledVector(this.jiggle, -180 * dt);
    this.jiggleVel.multiplyScalar(Math.exp(-9 * dt));
    this.jiggle.addScaledVector(this.jiggleVel, dt * 8);
    const rot = game.vars.rot ?? 0;
    this.pivot.rotation.y = rot;
    this.pivot.rotation.x = game.vars.pitch ?? 0;
    this.pivot.position.set(TABLE_CENTER.x + this.jiggle.x * 0.3, 0, TABLE_CENTER.z + this.jiggle.z * 0.3);

    this.shakeAmp *= Math.exp(-7 * dt);
    this.placeCamera(dt);

    // テーマ別の常時演出
    const style = this.stage!.theme.style;
    this.ambientAcc += dt;
    if (style === 'anime' && this.ambientAcc > 0.12) {
      this.ambientAcc = 0;
      this.particles.spawn(-9 + Math.random() * 20, 7, -Math.random() * 42, 1.2, -0.8, 0.3, new THREE.Color(Math.random() < 0.5 ? '#ffb7d0' : '#ffe2ee'), 0.45, 7, 'petal', -0.6);
    } else if (style === 'cyber' && this.ambientAcc > 0.2) {
      this.ambientAcc = 0;
      this.particles.spawn(-9 + Math.random() * 20, 0.2, -Math.random() * 42, 0, 1.5, 0, new THREE.Color(Math.random() < 0.5 ? '#05d9e8' : '#ff2a6d'), 0.2, 2.5, 'square', 0.3);
    } else if (style === 'impossible' && this.ambientAcc > 0.25) {
      this.ambientAcc = 0;
      const x = Math.random() < 0.5 ? CH.left : CH.right;
      this.particles.burst(x, 4 + Math.random() * 30, 1.6, '#ffaa33', 4, 5, 'spark', 0.25, 0.4);
    }
    if (this.glitch) {
      const target = Math.max(game.vars.glitch ?? 0, Math.random() < 0.004 ? 0.8 : 0);
      this.glitch.amount = Math.max(target, this.glitch.amount * Math.exp(-4 * dt));
      this.glitch.material.uniforms.time.value = this.time;
    }
    if (this.alarm) {
      this.alarm.darkness += ((game.vars.darkness ?? 0) - this.alarm.darkness) * Math.min(1, dt * 4);
      this.alarm.alarm += ((game.vars.alarm ?? 0.25) - this.alarm.alarm) * Math.min(1, dt * 4);
      this.alarm.material.uniforms.time.value = this.time;
      const balls = game.balls.filter((b) => b.active && !b.hidden);
      const v = new THREE.Vector3();
      const m = this.view.group.matrixWorld;
      for (let i = 0; i < 4; i++) {
        const b = balls[i];
        if (!b) {
          this.alarm.balls[i].set(-9, -9);
          continue;
        }
        v.set(b.x, 0.5 + b.z, -b.y).applyMatrix4(m).project(this.camera);
        this.alarm.balls[i].set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
      }
      this.redLights.forEach((p, i) => {
        const a = this.time * 2.4 + i * Math.PI;
        p.position.set(TABLE_CENTER.x + Math.cos(a) * 12, 7, TABLE_CENTER.z + Math.sin(a) * 18);
      });
    }
    this.composer.render(dt);
  }

  /** スクリーンショット用 */
  snapshot(): string {
    return this.gl.domElement.toDataURL('image/png');
  }
}
