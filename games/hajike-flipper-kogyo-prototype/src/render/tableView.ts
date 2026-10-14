// 台（Table）から3Dの見た目を作り、毎フレーム物理の状態に合わせて動かす。
// 座標：台の (x, y) → three の (x, 高さ, -y)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Game } from '../core/game';
import type { StageDef } from '../stages/types';
import { arcPoints, deg, offsetPolyline, polylineLengths } from '../table/geom';
import { BumperRT, GateRT, KickbackRT, MagnetRT, ScoopRT, SlingRT, SpinnerRT, TargetRT, WarpRT, type LightRT, type RampRT } from '../table/table';
import type { DecoDef, LightDef, P, PartDef, RampDef, WallStyle } from '../table/types';
import { canvasTexture, makeMaterials, type Mats, type Quality } from './materials';
import { paintPlayfield, PF } from './playfield';
import { CH } from '../table/chassis';

const V = (x: number, y: number, h = 0) => new THREE.Vector3(x, h, -y);

interface Anim {
  update(game: Game, t: number, dt: number): void;
}

export class TableView {
  readonly group = new THREE.Group();
  readonly mats: Mats;
  private anims: Anim[] = [];
  private ballMeshes: THREE.Mesh[] = [];
  private ballShadows: THREE.Mesh[] = [];
  private rolls = new Map<number, THREE.Quaternion>();
  private flipperMeshes: { mesh: THREE.Object3D; id: string }[] = [];
  private lightMeshes: { mesh: THREE.Mesh; light: LightRT; mat: THREE.MeshStandardMaterial }[] = [];
  private staticGeo = new Map<THREE.Material, THREE.BufferGeometry[]>();
  /** 部品ID → その部品の標準の3D（静的にまとめた物は含まない） */
  private partObjects = new Map<string, THREE.Object3D[]>();
  private disposers: (() => void)[] = [];
  private debugLines: THREE.LineSegments | null = null;
  private debugFlippers: THREE.LineSegments | null = null;
  readonly decoObjects = new Map<string, THREE.Object3D>();
  private readonly ballGeo = new THREE.SphereGeometry(0.5, 40, 28);
  readonly bounds = new THREE.Box3(new THREE.Vector3(CH.left - 0.9, 0, -40.6), new THREE.Vector3(CH.laneOuter + 0.9, 2, 1.6));

  constructor(
    readonly stage: StageDef,
    readonly game: Game,
    readonly quality: Quality,
  ) {
    this.mats = makeMaterials(stage.theme, quality);
    const layout = game.table.layout;

    // 床
    const pf = paintPlayfield(stage, layout, quality);
    const floorMat = this.mats.floor as THREE.MeshStandardMaterial;
    floorMat.map = pf.texture;
    const fw = PF.x1 - PF.x0;
    const fh = PF.y1 - PF.y0;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(PF.x0 + fw / 2, 0, -(PF.y0 + fh / 2));
    floor.receiveShadow = true;
    this.group.add(floor);

    for (const p of layout.parts) {
      // 部品ごとに作った3Dを覚えておく（ステージの decorate から標準の見た目を隠せるように）
      const before = this.group.children.length;
      this.buildPart(p);
      const id = 'id' in p ? p.id : undefined;
      if (id) this.partObjects.set(id, [...(this.partObjects.get(id) ?? []), ...this.group.children.slice(before)]);
    }
    this.buildCabinet();
    this.flushStatic();
    stage.theme.decorate?.({
      THREE,
      group: this.group,
      game,
      quality,
      at: (x, y, h = 0) => V(x, y, h),
      onFrame: (fn) => this.anims.push({ update: (_g, t, dt) => fn(t, dt) }),
      glow: (c) => this.mats.glow(c),
      metal: () => this.mats.metal,
      canvasTexture: (w, h, draw) => canvasTexture(w, h, draw),
      hide: (partId) => {
        const list = this.partObjects.get(partId) ?? [];
        for (const o of list) {
          o.visible = false;
          o.userData.hiddenByStage = true;
        }
        return list.length;
      },
      onDispose: (fn) => this.disposers.push(fn),
    });
  }

  // ───────── 静的な形（まとめて1メッシュにする） ─────────

  private addStatic(mat: THREE.Material, geo: THREE.BufferGeometry): void {
    const list = this.staticGeo.get(mat) ?? [];
    list.push(geo.index ? geo.toNonIndexed() : geo);
    this.staticGeo.set(mat, list);
  }

  private flushStatic(): void {
    for (const [mat, list] of this.staticGeo) {
      if (!list.length) continue;
      // 属性をそろえる
      for (const g of list) {
        if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.getAttribute('position').count) * 2), 2));
        for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      }
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = this.quality !== 'low';
      m.receiveShadow = true;
      this.group.add(m);
    }
    this.staticGeo.clear();
  }

  private box(a: P, b: P, h: number, thick: number, mat: THREE.Material, base = 0): void {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-4) return;
    const g = new THREE.BoxGeometry(len + thick, h, thick);
    const m = new THREE.Matrix4().compose(
      V((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, base + h / 2),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dy, dx)),
      new THREE.Vector3(1, 1, 1),
    );
    g.applyMatrix4(m);
    this.addStatic(mat, g);
  }

  private wallLine(pts: P[], style: WallStyle, r: number, h?: number, base = 0): void {
    if (style === 'invisible') return;
    const mats = this.mats;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      switch (style) {
        case 'guide':
          this.box(a, b, h ?? 0.75, 0.14, mats.guide, base);
          break;
        case 'rubber':
          this.box(a, b, 0.5, Math.max(0.24, r * 2), mats.rubber, base + 0.1);
          break;
        case 'metal':
          this.box(a, b, h ?? 1.0, Math.max(0.16, r * 2), mats.metal, base);
          break;
        default: {
          const hh = h ?? 1.2;
          const t = Math.max(0.2, r * 2);
          this.box(a, b, hh, t, mats.wall, base);
          this.box(a, b, 0.07, t + 0.06, mats.wallTop, base + hh);
        }
      }
    }
    if (style === 'rubber' || style === 'guide') {
      for (const p of pts) this.post(p, style === 'rubber' ? 0.2 : 0.1, style === 'rubber' ? 'rubber' : 'metal');
    }
  }

  private post(at: P, r: number, style: 'rubber' | 'metal' | 'peg', base = 0): void {
    const mats = this.mats;
    if (style === 'rubber') {
      const pin = new THREE.CylinderGeometry(Math.max(0.08, r * 0.45), Math.max(0.08, r * 0.45), 1.0, 12);
      pin.translate(at[0], base + 0.5, -at[1]);
      this.addStatic(mats.metal, pin);
      const ring = new THREE.CylinderGeometry(r, r, 0.36, 18);
      ring.translate(at[0], base + 0.42, -at[1]);
      this.addStatic(mats.rubber, ring);
    } else {
      const g = new THREE.CylinderGeometry(r, r * 1.05, style === 'peg' ? 0.6 : 0.95, 16);
      g.translate(at[0], base + (style === 'peg' ? 0.3 : 0.47), -at[1]);
      this.addStatic(style === 'peg' ? mats.post : mats.metal, g);
    }
  }

  // ───────── 部品 ─────────

  private buildPart(p: PartDef): void {
    if (p.layer && p.kind !== 'ramp') return; // ランプ上の部品はランプ側で描く
    switch (p.kind) {
      case 'wall':
        if (p.dynamic) this.dynamicWall(p.id ?? '', p.pts, p.style ?? 'wall');
        else this.wallLine(p.closed ? [...p.pts, p.pts[0]] : p.pts, p.style ?? 'wall', p.r ?? 0.1, p.h);
        return;
      case 'arc': {
        const pts = arcPoints(p.c, p.R, p.from, p.to, 4);
        this.wallLine(pts, p.style ?? 'wall', p.r ?? 0.1, p.h);
        return;
      }
      case 'post':
        if (p.dynamic) this.dynamicPost(p.id ?? '', p.at, p.r ?? 0.3);
        else this.post(p.at, p.r ?? 0.3, p.style ?? 'rubber');
        return;
      case 'bumper':
        this.bumper(p.id, p.r ?? 0.95);
        return;
      case 'sling':
        this.sling(p.id);
        return;
      case 'drop':
      case 'standup':
        this.target(p.id);
        return;
      case 'spinner':
        this.spinner(p.id);
        return;
      case 'rollover':
        this.rollover(p.at, p.style ?? 'lane');
        return;
      case 'gate':
        this.gate(p.id ?? '', p.a, p.b);
        return;
      case 'scoop':
        this.scoop(p.id, p.at, p.eject, false);
        return;
      case 'warp':
        this.scoop(p.id, p.at, p.eject, true);
        if (p.tube) this.tube(p.tube, p.tubeH);
        return;
      case 'kickback':
        this.kickback(p.id, p.at);
        return;
      case 'magnet':
        this.magnet(p.id, p.at, p.r);
        return;
      case 'ramp':
        this.ramp(p);
        return;
      case 'flipper':
        this.flipper(p.id);
        return;
      case 'plunger':
        this.plunger();
        return;
      case 'light':
        this.light(p);
        return;
      case 'deco':
        this.deco(p);
        return;
      case 'trigger':
      case 'drain':
        return;
    }
  }

  private flipper(id: string): void {
    const f = this.game.flippers.find((x) => x.id === id)!;
    const L = f.baseLength, r0 = f.baseR0, r1 = f.baseR1;
    const outline = (a: number, b: number) => {
      const phi = Math.asin((a - b) / L);
      const s = new THREE.Shape();
      s.absarc(0, 0, a, Math.PI / 2 + phi, Math.PI * 1.5 - phi, false);
      s.absarc(L, 0, b, -Math.PI / 2 - phi, Math.PI / 2 + phi, false);
      s.closePath();
      return s;
    };
    const body = new THREE.ExtrudeGeometry(outline(r0, r1), { depth: 0.62, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.03, bevelSegments: 2, curveSegments: 16 });
    body.rotateX(-Math.PI / 2);
    body.translate(0, 0.08, 0);
    const rub = new THREE.ExtrudeGeometry(outline(r0 + 0.06, r1 + 0.06), { depth: 0.3, bevelEnabled: false, curveSegments: 16 });
    rub.rotateX(-Math.PI / 2);
    rub.translate(0, 0.2, 0);
    const g = new THREE.Group();
    const m1 = new THREE.Mesh(body, this.mats.flipper);
    const m2 = new THREE.Mesh(rub, this.mats.flipperRubber);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.85, 12), this.mats.metal);
    pin.position.y = 0.42;
    m1.castShadow = m2.castShadow = this.quality !== 'low';
    g.add(m1, m2, pin);
    g.position.copy(V(f.pivotX, f.pivotY, 0));
    this.group.add(g);
    this.flipperMeshes.push({ mesh: g, id });
    this.anims.push({
      update: () => {
        g.position.set(f.pivotX, 0, -f.pivotY);
        g.rotation.y = f.angle;
        const s = f.scale;
        g.scale.set(s, 1, Math.sqrt(s));
      },
    });
  }

  private bumper(id: string, r: number): void {
    const rt = this.game.table.get<BumperRT>(id);
    const c = this.stage.theme.colors;
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.18, r * 1.25, 0.14, 28), this.mats.bumperBase);
    base.position.y = 0.07;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.98, r * 1.02, 0.5, 28), this.mats.bumperBody);
    skirt.position.y = 0.38;
    const capMat = this.mats.glow(c.accent);
    capMat.color.set(c.bumperCap);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.06, r * 0.98, 0.32, 28), capMat);
    cap.position.y = 0.8;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.6, 0.08, 24), this.mats.metal);
    top.position.y = 1.0;
    for (const m of [base, skirt, cap, top]) m.castShadow = this.quality !== 'low';
    g.add(base, skirt, cap, top);
    this.group.add(g);
    this.anims.push({
      update: (_g, t) => {
        g.position.set(rt.x, 0, -rt.y);
        const k = Math.max(0, 1 - rt.hitAge / 0.18);
        cap.position.y = 0.8 - k * 0.22;
        skirt.scale.set(1 + k * 0.08, 1 - k * 0.3, 1 + k * 0.08);
        capMat.emissiveIntensity = 0.5 + 0.25 * Math.sin(t * 3 + rt.x) + k * 4;
      },
    });
  }

  private sling(id: string): void {
    const rt = this.game.table.get<SlingRT>(id);
    const pts = rt.def.pts;
    const shape = new THREE.Shape(pts.map((q) => new THREE.Vector2(q[0], q[1])));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.06, bevelSegments: 2 });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, this.mats.sling);
    m.castShadow = this.quality !== 'low';
    this.group.add(m);
    // 蹴る辺のゴムと光る帯
    const i = rt.def.kickEdge;
    const a = pts[i], b = pts[(i + 1) % 3];
    const c3: P = [(pts[0][0] + pts[1][0] + pts[2][0]) / 3, (pts[0][1] + pts[1][1] + pts[2][1]) / 3];
    const mid: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const ox = mid[0] - c3[0], oy = mid[1] - c3[1];
    const ol = Math.hypot(ox, oy);
    const off: P = [(ox / ol) * 0.12, (oy / ol) * 0.12];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const rubber = new THREE.Mesh(new THREE.BoxGeometry(len, 0.42, 0.2), this.mats.rubber);
    rubber.position.copy(V(mid[0] + off[0], mid[1] + off[1], 0.35));
    rubber.rotation.y = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const glowMat = this.mats.glow(this.stage.theme.colors.accent2);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(len * 0.8, 0.08, 0.5), glowMat);
    strip.position.copy(V(mid[0] - off[0] * 2, mid[1] - off[1] * 2, 0.9));
    strip.rotation.y = rubber.rotation.y;
    this.group.add(rubber, strip);
    const base = rubber.position.clone();
    this.anims.push({
      update: () => {
        const k = Math.max(0, 1 - rt.hitAge / 0.15);
        rubber.position.set(base.x + off[0] * k * 1.6, base.y, base.z - off[1] * k * 1.6);
        glowMat.emissiveIntensity = 0.3 + k * 5;
      },
    });
  }

  private target(id: string): void {
    const rt = this.game.table.get<TargetRT>(id);
    const d = rt.def;
    const big = d.kind === 'standup' && d.big;
    const w = d.w ?? (rt.drop ? 1.0 : big ? 2.2 : 0.9);
    const mat = this.mats.glow(this.stage.theme.colors.target);
    mat.color.set(this.stage.theme.colors.target);
    mat.emissive.set(this.stage.theme.colors.accent);
    const h = big ? 1.5 : 0.95;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, big ? 0.6 : 0.22), mat);
    m.castShadow = this.quality !== 'low';
    const g = new THREE.Group();
    g.add(m);
    m.position.y = h / 2;
    g.position.copy(V(d.at[0], d.at[1], 0));
    g.rotation.y = deg(d.angle + 90);
    if (!rt.drop) {
      const postM = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8), this.mats.metal);
      postM.position.set(0, 0.35, 0.3);
      g.add(postM);
    }
    this.group.add(g);
    this.anims.push({
      update: () => {
        const k = Math.max(0, 1 - rt.hitAge / 0.3);
        m.position.y = h / 2 - rt.sink * (h + 0.05);
        m.visible = rt.sink < 0.98;
        mat.emissiveIntensity = 0.1 + k * 3;
        if (!rt.drop) m.position.z = k * 0.08;
      },
    });
  }

  private spinner(id: string): void {
    const rt = this.game.table.get<SpinnerRT>(id);
    const w = rt.def.w ?? 1.5;
    const g = new THREE.Group();
    g.position.copy(V(rt.def.at[0], rt.def.at[1], 0));
    g.rotation.y = deg(rt.def.angle + 90);
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.25, 8), this.mats.metal);
      p.position.set((s * w) / 2, 0.62, 0);
      g.add(p);
    }
    const plateMat = this.mats.glow(this.stage.theme.colors.accent);
    plateMat.color.set(this.stage.theme.colors.target);
    const plateGeo = new THREE.BoxGeometry(w * 0.92, 0.62, 0.05);
    plateGeo.translate(0, -0.31, 0);
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.y = 1.15;
    g.add(plate);
    this.group.add(g);
    this.anims.push({
      update: () => {
        plate.rotation.x = rt.angle;
        plateMat.emissiveIntensity = 0.1 + Math.min(3, Math.abs(rt.omega) / 12);
      },
    });
  }

  private rollover(at: P, style: string): void {
    if (style === 'button' || style === 'star') {
      const g = new THREE.CylinderGeometry(0.28, 0.3, 0.07, style === 'star' ? 5 : 16);
      g.translate(at[0], 0.035, -at[1]);
      this.addStatic(this.mats.metal, g);
      return;
    }
    const tor = new THREE.TorusGeometry(0.32, 0.035, 6, 16, Math.PI);
    tor.rotateY(Math.PI / 2);
    tor.translate(at[0], 0, -at[1]);
    this.addStatic(this.mats.metal, tor);
  }

  private gate(id: string, a: P, b: P): void {
    const rt = this.game.table.parts.get(id) as GateRT | undefined;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const g = new THREE.Group();
    g.position.copy(V((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0));
    g.rotation.y = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6), this.mats.metal);
    rod.rotation.z = Math.PI / 2;
    rod.position.y = 0.95;
    const flapGeo = new THREE.BoxGeometry(len * 0.95, 0.85, 0.03);
    flapGeo.translate(0, -0.43, 0);
    const flap = new THREE.Mesh(flapGeo, this.mats.metal);
    flap.position.y = 0.95;
    g.add(rod, flap);
    this.group.add(g);
    if (rt) this.anims.push({ update: () => (flap.rotation.x = -rt.open * 1.2) });
  }

  private scoop(id: string, at: P, eject: number, warp: boolean): void {
    const rt = this.game.table.get<ScoopRT | WarpRT>(id);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24), this.mats.dark);
    hole.rotation.x = -Math.PI / 2;
    hole.position.copy(V(at[0], at[1], 0.006));
    this.group.add(hole);
    const ringMat = this.mats.glow(warp ? this.stage.theme.colors.accent2 : this.stage.theme.colors.accent);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 28), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(V(at[0], at[1], 0.01));
    this.group.add(ring);
    if (!warp) {
      const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.7, 20, 1, true, 0, Math.PI), this.mats.metal);
      hood.position.copy(V(at[0], at[1], 0.35));
      // 開いている側を吐き出す向きへ
      hood.rotation.y = deg(eject) + Math.PI / 2;
      (hood.material as THREE.Material).side = THREE.DoubleSide;
      this.group.add(hood);
    }
    this.anims.push({
      update: (_g, t) => {
        const k = Math.max(0, 1 - rt.hitAge / 0.5);
        const e = Math.max(0, 1 - rt.ejectAge / 0.3);
        ringMat.emissiveIntensity = (warp ? 1.2 + Math.sin(t * 6) * 0.6 : 0.2) + k * 3 + e * 3;
      },
    });
  }

  private tube(path: P[], h?: number[]): void {
    const pts = path.map((p, i) => V(p[0], p[1], (h?.[i] ?? 1.6) + 0.5));
    const curve = new THREE.CatmullRomCurve3(pts);
    const mat = new THREE.MeshStandardMaterial({
      color: this.stage.theme.colors.accent2,
      emissive: this.stage.theme.colors.accent2,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.62, 12, false), mat);
    this.group.add(m);
    // 支柱
    for (let i = 1; i < path.length - 1; i += 2) {
      const hh = h?.[i] ?? 1.6;
      const g = new THREE.CylinderGeometry(0.06, 0.06, hh, 6);
      g.translate(path[i][0], hh / 2, -path[i][1]);
      this.addStatic(this.mats.metal, g);
    }
  }

  private kickback(id: string, at: P): void {
    const rt = this.game.table.get<KickbackRT>(id);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), this.mats.metal);
    m.position.copy(V(at[0], at[1] - 0.7, 0.15));
    this.group.add(m);
    this.anims.push({ update: () => (m.position.z = -(at[1] - 0.7) - Math.max(0, 1 - rt.ejectAge / 0.2) * 0.5) });
  }

  private magnet(id: string, at: P, r: number): void {
    const rt = this.game.table.get<MagnetRT>(id);
    const mat = this.mats.glow(this.stage.theme.colors.accent2);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 32), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(V(at[0], at[1], 0.012));
    const outer = new THREE.Mesh(new THREE.RingGeometry(r - 0.06, r, 48), mat);
    outer.rotation.x = -Math.PI / 2;
    outer.position.copy(V(at[0], at[1], 0.012));
    this.group.add(ring, outer);
    this.anims.push({
      update: (_g, t) => {
        mat.emissiveIntensity = rt.active ? 1.5 + Math.sin(t * 12) * 0.8 : 0.1;
        outer.visible = rt.active;
        outer.scale.setScalar(rt.active ? 1 - ((t * 0.8) % 1) * 0.5 : 1);
      },
    });
  }

  private ramp(p: RampDef): void {
    const rt = this.game.table.get<RampRT>(p.id);
    // 経路を細かく分けて高さを補間
    const pts: P[] = [];
    const hs: number[] = [];
    for (let i = 1; i < p.path.length; i++) {
      const a = p.path[i - 1], b = p.path[i];
      const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.4));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        hs.push(p.h[i - 1] + (p.h[i] - p.h[i - 1]) * t);
      }
    }
    pts.push(p.path[p.path.length - 1]);
    hs.push(p.h[p.h.length - 1]);
    const w = (p.w ?? 1.5) / 2 + 0.14;
    const left = offsetPolyline(pts, w);
    const right = offsetPolyline(pts, -w);
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const h = hs[i] - 0.02;
      pos.push(left[i][0], h, -left[i][1], right[i][0], h, -right[i][1]);
      if (i > 0) {
        const a = (i - 1) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const surf = new THREE.BufferGeometry();
    surf.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    surf.setIndex(idx);
    surf.computeVertexNormals();
    const surfMesh = new THREE.Mesh(surf, this.mats.ramp);
    surfMesh.receiveShadow = true;
    this.group.add(surfMesh);
    // 手すり
    const railH = 0.62;
    for (const side of [left, right]) {
      const rp: number[] = [];
      const ri: number[] = [];
      for (let i = 0; i < side.length; i++) {
        const h = hs[i];
        rp.push(side[i][0], h, -side[i][1], side[i][0], h + railH, -side[i][1]);
        if (i > 0) {
          const a = (i - 1) * 2;
          ri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
      rg.setIndex(ri);
      rg.computeVertexNormals();
      const rm = new THREE.Mesh(rg, this.mats.rampSide);
      this.group.add(rm);
      // 上の縁（金属の棒）
      const curvePts = side.map((q, i) => V(q[0], q[1], hs[i] + railH));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curvePts, false, 'catmullrom', 0.1), side.length * 2, 0.05, 6), this.mats.rampRail);
      this.group.add(tube);
    }
    // 支柱
    const acc = polylineLengths(pts);
    let next = 3;
    for (let i = 0; i < pts.length; i++) {
      if (acc[i] < next || hs[i] < 0.8) continue;
      next = acc[i] + 4;
      for (const side of [left, right]) {
        const g = new THREE.CylinderGeometry(0.06, 0.06, hs[i], 6);
        g.translate(side[i][0], hs[i] / 2, -side[i][1]);
        this.addStatic(this.mats.metal, g);
      }
    }
    // 入口の光
    const mat = this.mats.glow(this.stage.theme.colors.accent);
    const arrow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 3), mat);
    arrow.rotation.x = -Math.PI / 2;
    const d0 = rt.dir0;
    arrow.rotation.z = Math.atan2(d0[1], d0[0]);
    arrow.position.copy(V(p.path[0][0] - d0[0] * 1.1, p.path[0][1] - d0[1] * 1.1, 0.015));
    this.group.add(arrow);
    this.anims.push({
      update: (_g, t) => {
        const k = Math.max(0, 1 - rt.hitAge / 0.6);
        mat.emissiveIntensity = 0.4 + 0.4 * Math.sin(t * 5) + k * 3;
      },
    });
  }

  private plunger(): void {
    const pl = this.game.table.plunger!;
    const g = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.4, 10), this.mats.metal);
    rod.rotation.x = Math.PI / 2;
    rod.position.z = 1.2;
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 16), this.mats.flipperRubber);
    tip.rotation.x = Math.PI / 2;
    const spring = new THREE.Mesh(new THREE.TorusKnotGeometry(0.25, 0.04, 40, 6, 6, 1), this.mats.metal);
    spring.rotation.x = Math.PI / 2;
    spring.position.z = 0.9;
    g.add(rod, tip, spring);
    g.position.set(pl.def.at[0], 0.5, 0);
    this.group.add(g);
    this.anims.push({
      update: () => {
        const y = pl.tip.ay;
        g.position.z = -(y - 0.05);
        spring.scale.set(1, 1, 1 - pl.pull * 0.45);
      },
    });
  }

  private light(p: LightDef): void {
    const rt = this.game.table.light(p.id);
    if (!rt) return;
    const s = p.size ?? 0.5;
    let geo: THREE.BufferGeometry;
    switch (p.shape ?? 'circle') {
      case 'arrow': {
        const sh = new THREE.Shape();
        sh.moveTo(s * 1.1, 0);
        sh.lineTo(-s * 0.3, s * 0.75);
        sh.lineTo(-s * 0.3, s * 0.3);
        sh.lineTo(-s * 0.9, s * 0.3);
        sh.lineTo(-s * 0.9, -s * 0.3);
        sh.lineTo(-s * 0.3, -s * 0.3);
        sh.lineTo(-s * 0.3, -s * 0.75);
        sh.closePath();
        geo = new THREE.ShapeGeometry(sh);
        break;
      }
      case 'tri':
        geo = new THREE.CircleGeometry(s, 3);
        break;
      case 'diamond':
        geo = new THREE.CircleGeometry(s, 4);
        break;
      case 'rect':
        geo = new THREE.PlaneGeometry(s * 2.2, s * 1.1);
        break;
      case 'star': {
        const sh = new THREE.Shape();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
          const r = i % 2 === 0 ? s : s * 0.45;
          if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        sh.closePath();
        geo = new THREE.ShapeGeometry(sh);
        break;
      }
      default:
        geo = new THREE.CircleGeometry(s, 24);
    }
    const mat = this.mats.glow(rt.color);
    mat.color.set('#1a1a1a');
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = deg(p.rot ?? 0);
    m.position.copy(V(p.at[0], p.at[1], 0.012));
    this.group.add(m);
    this.lightMeshes.push({ mesh: m, light: rt, mat });
  }

  private dynamicTags = new Set<string>();

  private dynamicWall(id: string, pts: P[], style: WallStyle): void {
    // 動く・消える壁：物理の形の位置に追従（同じIDの定義が複数あっても1回だけ作る）
    if (this.dynamicTags.has(id)) return;
    this.dynamicTags.add(id);
    const shapes = this.game.world.shapes.filter((s) => s.tag === id && s.kind === 'seg');
    const meshes = shapes.map(() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, style === 'guide' ? 0.75 : 1.1, 0.2), style === 'guide' ? this.mats.guide : this.mats.wall);
      this.group.add(m);
      return m;
    });
    void pts;
    this.anims.push({
      update: () => {
        shapes.forEach((s, i) => {
          if (s.kind !== 'seg') return;
          const m = meshes[i];
          const len = Math.hypot(s.bx - s.ax, s.by - s.ay);
          m.scale.x = len + 0.2;
          m.position.set((s.ax + s.bx) / 2, style === 'guide' ? 0.37 : 0.55, -(s.ay + s.by) / 2);
          m.rotation.y = Math.atan2(s.by - s.ay, s.bx - s.ax);
          m.visible = s.enabled;
        });
      },
    });
  }

  private dynamicPost(id: string, at: P, r: number): void {
    const shape = this.game.world.shapes.find((s) => s.tag === id && s.kind === 'circle');
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.6, 18), this.mats.rubber);
    m.position.copy(V(at[0], at[1], 0.3));
    this.group.add(m);
    if (shape && shape.kind === 'circle') {
      this.anims.push({
        update: () => {
          m.position.set(shape.cx, 0.3, -shape.cy);
          m.visible = shape.enabled;
        },
      });
    }
  }

  private deco(p: DecoDef): void {
    const c = this.stage.theme.colors;
    const color = p.color ?? c.accent;
    let obj: THREE.Object3D | null = null;
    switch (p.type) {
      case 'box': {
        const m = new THREE.Mesh(new THREE.BoxGeometry(p.w ?? 1, p.h ?? 1, p.d ?? 1), this.mats.glow(color));
        (m.material as THREE.MeshStandardMaterial).color.set(color);
        m.position.y = (p.z ?? 0) + (p.h ?? 1) / 2;
        obj = new THREE.Group().add(m);
        break;
      }
      case 'text': {
        const tex = canvasTexture(512, 128, (g) => {
          g.font = 'bold 84px "Segoe UI", "Arial Black", sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.shadowColor = color;
          g.shadowBlur = 18;
          g.fillStyle = color;
          g.fillText(p.text ?? '', 256, 66);
        });
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry((p.w ?? 4) * (p.scale ?? 1), (p.w ?? 4) * 0.25 * (p.scale ?? 1)),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
        );
        m.rotation.x = -Math.PI / 2;
        m.position.y = (p.z ?? 0) + 0.02;
        obj = new THREE.Group().add(m);
        break;
      }
      case 'sign': {
        // 立っている看板（ネオン）
        const w = p.w ?? 4;
        const h = p.h ?? 1.6;
        const tex = canvasTexture(512, Math.round((512 * h) / w), (g) => {
          g.fillStyle = 'rgba(10,10,20,0.85)';
          g.fillRect(0, 0, 512, g.canvas.height);
          g.strokeStyle = color;
          g.lineWidth = 10;
          g.shadowColor = color;
          g.shadowBlur = 20;
          g.strokeRect(12, 12, 488, g.canvas.height - 24);
          g.font = `bold ${Math.round(g.canvas.height * 0.5)}px "Segoe UI", "Arial Black", sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillStyle = '#ffffff';
          g.fillText(p.text ?? '', 256, g.canvas.height / 2 + 4);
        });
        const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 1.3, transparent: true });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        m.position.y = (p.z ?? 0.3) + h / 2;
        m.rotation.x = -0.35;
        const g = new THREE.Group().add(m);
        for (const s of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, (p.z ?? 0.3) + 0.2, 6), this.mats.metal);
          leg.position.set((s * w) / 2.4, ((p.z ?? 0.3) + 0.2) / 2, 0.1);
          g.add(leg);
        }
        obj = g;
        break;
      }
      case 'bulbs': {
        // 電球の列（ROUTE 50s）
        const g = new THREE.Group();
        const n = Math.round(p.w ?? 6);
        const mat = this.mats.glow(color);
        mat.color.set('#fff6d0');
        for (let i = 0; i < n; i++) {
          const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mat);
          b.position.set(i * 0.55 - (n - 1) * 0.275, (p.z ?? 1.2), 0);
          g.add(b);
        }
        this.anims.push({ update: (_g, t) => (mat.emissiveIntensity = 1.2 + 0.8 * Math.max(0, Math.sin(t * 4))) });
        obj = g;
        break;
      }
      default: {
        // 汎用：光る円柱
        const m = new THREE.Mesh(new THREE.CylinderGeometry((p.w ?? 1) / 2, (p.w ?? 1) / 2, p.h ?? 1, 20), this.mats.glow(color));
        m.position.y = (p.z ?? 0) + (p.h ?? 1) / 2;
        obj = new THREE.Group().add(m);
      }
    }
    if (!obj) return;
    obj.position.x = p.at[0];
    obj.position.z = -p.at[1];
    obj.rotation.y = deg(p.rot ?? 0);
    obj.scale.multiplyScalar(p.type === 'text' ? 1 : (p.scale ?? 1));
    this.group.add(obj);
    if (p.id) this.decoObjects.set(p.id, obj);
  }

  private buildCabinet(): void {
    const m = this.mats;
    const L = CH.left, R = CH.laneOuter;
    // 左右の側板
    const side = (x0: number, x1: number) => {
      const g = new THREE.BoxGeometry(x1 - x0, 2.2, 42.4);
      g.translate((x0 + x1) / 2, 1.1, -19.6);
      this.addStatic(m.cabinet, g);
    };
    side(L - 1.0, L - 0.1);
    side(R + 0.1, R + 1.0);
    // 奥と手前
    const back = new THREE.BoxGeometry(R - L + 2, 2.2, 1);
    back.translate((L + R) / 2, 1.1, -41.2);
    this.addStatic(m.cabinet, back);
    const front = new THREE.BoxGeometry(R - L + 2, 1.2, 1);
    front.translate((L + R) / 2, 0.6, 1.1);
    this.addStatic(m.cabinet, front);
    // アーチの外側の角を埋める
    const c = CH.archC;
    const sh = new THREE.Shape();
    const pts = arcPoints(c, CH.archR + 0.1, 0, 180, 4);
    sh.moveTo(R + 0.1, c[1]);
    for (const q of pts) sh.lineTo(q[0], q[1]);
    sh.lineTo(L - 0.1, 40.8);
    sh.lineTo(R + 0.1, 40.8);
    sh.closePath();
    const corner = new THREE.ExtrudeGeometry(sh, { depth: 1.7, bevelEnabled: false });
    corner.rotateX(-Math.PI / 2);
    this.addStatic(m.cabinet, corner);
    // エプロン（手前のカバー）
    const apron = new THREE.BoxGeometry(CH.right - L, 0.5, 2.9);
    apron.translate((L + CH.right) / 2, 0.25, -0.85);
    this.addStatic(m.apron, apron);
    const laneCover = new THREE.BoxGeometry(R - CH.right, 0.5, 1.1);
    laneCover.translate((R + CH.right) / 2, 0.25, 0.05);
    this.addStatic(m.apron, laneCover);
    // エプロンの文字
    const c2 = this.stage.theme.colors;
    const tex = canvasTexture(1024, 160, (g) => {
      g.fillStyle = c2.wall;
      g.fillRect(0, 0, 1024, 160);
      g.strokeStyle = c2.accent;
      g.lineWidth = 6;
      g.strokeRect(10, 10, 1004, 140);
      g.font = 'bold 64px "Segoe UI", "Arial Black", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = c2.text;
      g.fillText(`${this.stage.name}`, 512, 64);
      g.font = '28px "Segoe UI", sans-serif';
      g.fillStyle = c2.accent;
      g.fillText('弾け！フリッパー興業', 512, 120);
    });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(CH.right - L - 0.4, 2.6), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
    label.rotation.x = -Math.PI / 2;
    label.position.set((L + CH.right) / 2, 0.505, -0.85);
    this.group.add(label);

    // 奥の看板（バックボード）
    if (this.stage.theme.paintBackboard) {
      const btex = canvasTexture(1024, 320, (g) => this.stage.theme.paintBackboard!(g, 1024, 320));
      const bm = new THREE.Mesh(
        new THREE.PlaneGeometry(R - L + 2, (R - L + 2) * 0.3125),
        new THREE.MeshStandardMaterial({ map: btex, emissive: '#ffffff', emissiveMap: btex, emissiveIntensity: 0.9 }),
      );
      bm.position.set((L + R) / 2, 2.2 + ((R - L + 2) * 0.3125) / 2 - 0.3, -41.6);
      bm.rotation.x = -0.25;
      this.group.add(bm);
    }
  }

  // ───────── 毎フレーム ─────────

  update(game: Game, t: number, dt: number): void {
    for (const a of this.anims) a.update(game, t, dt);
    for (const l of this.lightMeshes) {
      const lv = l.light.level(t);
      l.mat.emissive.set(l.light.color);
      l.mat.emissiveIntensity = 0.1 + lv * 2.4;
    }
    this.updateBalls(game, dt);
    if (this.debugFlippers) this.updateDebugFlippers();
  }

  private updateBalls(game: Game, dt: number): void {
    const balls = game.balls;
    while (this.ballMeshes.length < balls.length) {
      const m = new THREE.Mesh(this.ballGeo, this.mats.ball);
      m.castShadow = this.quality !== 'low';
      this.group.add(m);
      this.ballMeshes.push(m);
      const sh = new THREE.Mesh(new THREE.CircleGeometry(0.48, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2;
      sh.visible = false;
      this.group.add(sh);
      this.ballShadows.push(sh);
    }
    for (let i = 0; i < this.ballMeshes.length; i++) {
      const m = this.ballMeshes[i];
      const sh = this.ballShadows[i];
      const b = balls[i];
      if (!b || !b.active || b.hidden) {
        m.visible = false;
        sh.visible = false;
        continue;
      }
      m.visible = true;
      const sink = b.captured && (b.captured.by.startsWith('scoop') || this.game.table.parts.get(b.captured.by) instanceof ScoopRT) ? 0.35 : 0;
      m.position.set(b.x, 0.5 + b.z - sink, -b.y);
      // 転がり
      let q = this.rolls.get(b.id);
      if (!q) {
        q = new THREE.Quaternion();
        this.rolls.set(b.id, q);
      }
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 0.01 && !b.captured) {
        // 台座標 (vx, vy) → 世界 (vx, 0, -vy)。転がりの軸 = 上向き × 速度
        const axis = new THREE.Vector3(-b.vy, 0, -b.vx).normalize();
        const dq = new THREE.Quaternion().setFromAxisAngle(axis, (sp * dt) / 0.5);
        q.premultiply(dq);
      }
      m.quaternion.copy(q);
      if (this.quality === 'low') {
        sh.visible = true;
        sh.position.set(b.x + 0.15, 0.02 + (b.z > 0 ? b.z - 0.02 : 0), -b.y + 0.15);
      }
    }
  }

  // ───────── デバッグ表示（当たり判定の線） ─────────

  setDebug(on: boolean): void {
    if (!on) {
      if (this.debugLines) this.group.remove(this.debugLines);
      if (this.debugFlippers) this.group.remove(this.debugFlippers);
      this.debugLines = null;
      this.debugFlippers = null;
      return;
    }
    const pos: number[] = [];
    const push = (a: P, b: P, h: number) => pos.push(a[0], h, -a[1], b[0], h, -b[1]);
    for (const s of this.game.world.shapes) {
      const h = 0.05 + s.layer * 0.6;
      if (s.kind === 'seg') {
        const dx = s.bx - s.ax, dy = s.by - s.ay;
        const l = Math.hypot(dx, dy) || 1;
        const nx = (-dy / l) * s.r, ny = (dx / l) * s.r;
        push([s.ax + nx, s.ay + ny], [s.bx + nx, s.by + ny], h);
        push([s.ax - nx, s.ay - ny], [s.bx - nx, s.by - ny], h);
      } else if (s.kind === 'circle') {
        const n = 20;
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
          push([s.cx + Math.cos(a0) * s.r, s.cy + Math.sin(a0) * s.r], [s.cx + Math.cos(a1) * s.r, s.cy + Math.sin(a1) * s.r], h);
        }
      } else {
        const n = 40;
        for (let i = 0; i < n; i++) {
          const a0 = s.a0 + ((s.a1 - s.a0) * i) / n, a1 = s.a0 + ((s.a1 - s.a0) * (i + 1)) / n;
          push([s.cx + Math.cos(a0) * s.R, s.cy + Math.sin(a0) * s.R], [s.cx + Math.cos(a1) * s.R, s.cy + Math.sin(a1) * s.R], h);
        }
      }
    }
    // センサー
    for (const p of this.game.table.layout.parts) {
      if (p.kind === 'rollover' || p.kind === 'scoop' || p.kind === 'kickback' || p.kind === 'warp') {
        const r = p.kind === 'rollover' ? (p.r ?? 0.5) : 0.55;
        const n = 16;
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
          push([p.at[0] + Math.cos(a0) * r, p.at[1] + Math.sin(a0) * r], [p.at[0] + Math.cos(a1) * r, p.at[1] + Math.sin(a1) * r], 0.08);
        }
      }
      if (p.kind === 'trigger') push(p.a, p.b, 0.08);
    }
    for (const r of this.game.table.ramps) {
      push(r.entryA, r.entryB, 0.1);
      push(r.exitA, r.exitB, 0.1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.debugLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#00ff66', depthTest: false, transparent: true }));
    this.debugLines.renderOrder = 999;
    this.group.add(this.debugLines);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(this.game.flippers.length * 4 * 6), 3));
    this.debugFlippers = new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: '#ff3366', depthTest: false, transparent: true }));
    this.debugFlippers.renderOrder = 999;
    this.group.add(this.debugFlippers);
  }

  private updateDebugFlippers(): void {
    const attr = this.debugFlippers!.geometry.getAttribute('position') as THREE.BufferAttribute;
    let k = 0;
    for (const f of this.game.flippers) {
      const ca = Math.cos(f.angle), sa = Math.sin(f.angle);
      const L = f.length;
      const nx = -sa, ny = ca;
      const pts: [P, P][] = [
        [[f.pivotX + nx * f.r0, f.pivotY + ny * f.r0], [f.pivotX + ca * L + nx * f.r1, f.pivotY + sa * L + ny * f.r1]],
        [[f.pivotX - nx * f.r0, f.pivotY - ny * f.r0], [f.pivotX + ca * L - nx * f.r1, f.pivotY + sa * L - ny * f.r1]],
        [[f.pivotX, f.pivotY], [f.pivotX + ca * L, f.pivotY + sa * L]],
        [[f.pivotX - nx * f.r0, f.pivotY - ny * f.r0], [f.pivotX + nx * f.r0, f.pivotY + ny * f.r0]],
      ];
      for (const [a, b] of pts) {
        attr.setXYZ(k++, a[0], 0.1, -a[1]);
        attr.setXYZ(k++, b[0], 0.1, -b[1]);
      }
    }
    attr.needsUpdate = true;
  }

  dispose(): void {
    for (const fn of this.disposers.splice(0)) {
      try {
        fn();
      } catch {
        /* 後片付けの失敗は無視 */
      }
    }
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) {
        const mm = mat as THREE.MeshStandardMaterial;
        mm.map?.dispose();
        mm.dispose();
      }
    });
  }
}
