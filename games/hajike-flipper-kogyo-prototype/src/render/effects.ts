// パーティクル（火花・星・桜・紙吹雪・グリッチ片）と、飛び出す文字（擬音・得点）
import * as THREE from 'three';

export type ParticleKind = 'spark' | 'star' | 'petal' | 'square' | 'smoke';
const KIND: Record<ParticleKind, number> = { spark: 0, star: 1, petal: 2, square: 3, smoke: 4 };

const MAX = 900;

export class Particles {
  readonly points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private size = new Float32Array(MAX);
  private alpha = new Float32Array(MAX);
  private kind = new Float32Array(MAX);
  private rot = new Float32Array(MAX);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private spin = new Float32Array(MAX);
  private grav = new Float32Array(MAX);
  private next = 0;
  private geo = new THREE.BufferGeometry();

  private mat: THREE.ShaderMaterial;

  constructor(pixelRatio: number) {
    const g = this.geo;
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('kind', new THREE.BufferAttribute(this.kind, 1));
    g.setAttribute('rot', new THREE.BufferAttribute(this.rot, 1));
    const mat = (this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 520 * pixelRatio } },
      vertexShader: `
        attribute float size; attribute float alpha; attribute float kind; attribute float rot; attribute vec3 color;
        varying vec3 vColor; varying float vAlpha; varying float vKind; varying float vRot;
        uniform float scale;
        void main(){
          vColor = color; vAlpha = alpha; vKind = kind; vRot = rot;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha; varying float vKind; varying float vRot;
        void main(){
          vec2 p = gl_PointCoord - 0.5;
          float c = cos(vRot), s = sin(vRot);
          p = vec2(c*p.x - s*p.y, s*p.x + c*p.y);
          float a = 0.0;
          if (vKind < 0.5) { a = 1.0 - smoothstep(0.0, 0.5, length(p)); a = a*a*1.6; }
          else if (vKind < 1.5) {
            float ang = atan(p.y, p.x); float r = length(p);
            float star = 0.22 + 0.2 * pow(abs(cos(ang * 2.5)), 3.0);
            a = 1.0 - smoothstep(star - 0.04, star, r);
          }
          else if (vKind < 2.5) { vec2 q = p * vec2(1.0, 1.9); a = 1.0 - smoothstep(0.28, 0.34, length(q)); }
          else if (vKind < 3.5) { a = step(abs(p.x), 0.32) * step(abs(p.y), 0.32); }
          else { a = (1.0 - smoothstep(0.1, 0.5, length(p))) * 0.5; }
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor, a * vAlpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.userData.outlineParameters = { visible: false };
  }

  setPixelRatio(pixelRatio: number): void {
    this.mat.uniforms.scale.value = 520 * pixelRatio;
  }

  setBlending(additive: boolean): void {
    (this.points.material as THREE.ShaderMaterial).blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  }

  spawn(x: number, h: number, z: number, vx: number, vy: number, vz: number, color: THREE.Color, size: number, life: number, kind: ParticleKind, grav = -12): void {
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = h;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = color.r;
    this.col[i * 3 + 1] = color.g;
    this.col[i * 3 + 2] = color.b;
    this.size[i] = size;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.kind[i] = KIND[kind];
    this.rot[i] = Math.random() * 6.28;
    this.spin[i] = (Math.random() - 0.5) * 8;
    this.grav[i] = grav;
  }

  /** 台の座標 (x, y) で飛び散らせる */
  burst(tx: number, ty: number, h: number, color: string | THREE.Color, n: number, speed: number, kind: ParticleKind = 'spark', size = 0.35, life = 0.5): void {
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.8 + 0.2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(tx, h, -ty, Math.cos(a) * s, up * s, Math.sin(a) * s, c, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.8), kind, kind === 'petal' ? -2 : -14);
    }
  }

  update(dt: number): void {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = this.kind[i];
      const drag = k === 2 ? 1.6 : 0.8;
      this.vel[i * 3] *= 1 - drag * dt;
      this.vel[i * 3 + 2] *= 1 - drag * dt;
      this.vel[i * 3 + 1] += this.grav[i] * dt;
      if (k === 2) {
        // 花びらはひらひら
        this.vel[i * 3] += Math.sin(this.life[i] * 5 + i) * 3 * dt;
        this.vel[i * 3 + 1] = Math.max(this.vel[i * 3 + 1], -1.6);
      }
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] = Math.max(0.05, this.pos[i * 3 + 1] + this.vel[i * 3 + 1] * dt);
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.rot[i] += this.spin[i] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, t * 2.5);
    }
    for (const name of ['position', 'alpha', 'rot']) (this.geo.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('size') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('kind') as THREE.BufferAttribute).needsUpdate = true;
  }
}

export type PopupStyle = 'score' | 'comic' | 'glitch' | 'anime' | 'warn' | 'chrome';

interface Popup {
  sprite: THREE.Sprite;
  life: number;
  max: number;
  vy: number;
  base: number;
}

const textCache = new Map<string, THREE.CanvasTexture>();

function popupTexture(text: string, style: PopupStyle, color: string): THREE.CanvasTexture {
  const key = `${style}|${color}|${text}`;
  const hit = textCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (style === 'comic') {
    // ギザギザの吹き出し＋太い文字
    g.translate(256, 128);
    g.beginPath();
    const n = 18;
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? 120 : 84;
      g.lineTo(Math.cos(a) * r * 1.8, Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = '#111';
    g.stroke();
    g.rotate(-0.12);
    g.font = '900 110px "Impact", "Arial Black", sans-serif';
    g.lineWidth = 16;
    g.strokeStyle = '#111';
    g.strokeText(text, 0, 6);
    g.fillStyle = '#fff36a';
    g.fillText(text, 0, 6);
  } else if (style === 'glitch') {
    g.font = 'bold 84px "Consolas", monospace';
    g.fillStyle = '#ff2a6d';
    g.fillText(text, 262, 128);
    g.fillStyle = '#05d9e8';
    g.fillText(text, 250, 124);
    g.fillStyle = '#ffffff';
    g.fillText(text, 256, 126);
  } else if (style === 'anime') {
    g.font = '900 92px "Segoe UI", "Arial Black", sans-serif';
    g.lineWidth = 14;
    g.strokeStyle = '#ffffff';
    g.strokeText(text, 256, 128);
    g.fillStyle = color;
    g.fillText(text, 256, 128);
  } else if (style === 'warn') {
    g.font = '900 90px "Impact", "Arial Black", sans-serif';
    g.lineWidth = 12;
    g.strokeStyle = '#000';
    g.strokeText(text, 256, 128);
    g.fillStyle = '#ffd400';
    g.fillText(text, 256, 128);
  } else {
    g.font = 'bold 76px "Segoe UI", "Arial Black", sans-serif';
    g.shadowColor = color;
    g.shadowBlur = 24;
    g.fillStyle = '#ffffff';
    g.fillText(text, 256, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (textCache.size > 200) textCache.clear();
  textCache.set(key, t);
  return t;
}

export class Popups {
  readonly group = new THREE.Group();
  private items: Popup[] = [];

  add(tx: number, ty: number, h: number, text: string, style: PopupStyle, color: string, scale = 1, life = 1.0): void {
    const tex = popupTexture(text, style, color);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const s = new THREE.Sprite(mat);
    const w = (style === 'comic' ? 5.2 : 3.6) * scale;
    s.scale.set(w, w / 2, 1);
    s.position.set(tx, h, -ty);
    s.renderOrder = 50;
    s.userData.outlineParameters = { visible: false };
    this.group.add(s);
    this.items.push({ sprite: s, life, max: life, vy: style === 'comic' ? 1.2 : 2.4, base: w });
    if (this.items.length > 24) this.remove(0);
  }

  private remove(i: number): void {
    const it = this.items[i];
    this.group.remove(it.sprite);
    it.sprite.material.dispose();
    this.items.splice(i, 1);
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      if (it.life <= 0) {
        this.remove(i);
        continue;
      }
      const t = 1 - it.life / it.max;
      it.sprite.position.y += it.vy * dt;
      const pop = t < 0.12 ? 0.4 + (t / 0.12) * 0.75 : 1.15 - Math.min(0.15, (t - 0.12) * 0.6);
      it.sprite.scale.set(it.base * pop, (it.base / 2) * pop, 1);
      it.sprite.material.opacity = Math.min(1, (it.life / it.max) * 3);
    }
  }
}
