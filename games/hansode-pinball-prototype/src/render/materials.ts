// テーマごとの素材。テクスチャは全部コードで生成する。
import * as THREE from 'three';
import type { ThemeDef } from '../stages/types';

export type Quality = 'low' | 'mid' | 'high';

export interface Mats {
  floor: THREE.Material;
  wall: THREE.Material;
  wallTop: THREE.Material;
  guide: THREE.Material;
  rubber: THREE.Material;
  metal: THREE.Material;
  post: THREE.Material;
  flipper: THREE.Material;
  flipperRubber: THREE.Material;
  bumperBase: THREE.Material;
  bumperBody: THREE.Material;
  sling: THREE.Material;
  target: THREE.Material;
  ramp: THREE.Material;
  rampRail: THREE.Material;
  apron: THREE.Material;
  cabinet: THREE.Material;
  dark: THREE.Material;
  ball: THREE.Material;
  /** ライト（光る部品）用：色ごとに作る */
  glow(color: string): THREE.MeshStandardMaterial;
  toon: boolean;
}

let gradientCache: THREE.DataTexture | null = null;
function toonGradient(): THREE.DataTexture {
  if (gradientCache) return gradientCache;
  const data = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  gradientCache = t;
  return t;
}

let gradient2Cache: THREE.DataTexture | null = null;
function toonGradient2(): THREE.DataTexture {
  if (gradient2Cache) return gradient2Cache;
  const data = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 2, 1, THREE.RGBAFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  gradient2Cache = t;
  return t;
}

export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  return t;
}

function hazardTexture(): THREE.CanvasTexture {
  return canvasTexture(
    128,
    128,
    (g) => {
      g.fillStyle = '#f5c400';
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#111';
      for (let i = -2; i < 4; i++) {
        g.beginPath();
        g.moveTo(i * 64, 0);
        g.lineTo(i * 64 + 32, 0);
        g.lineTo(i * 64 + 32 + 128, 128);
        g.lineTo(i * 64 + 128, 128);
        g.closePath();
        g.fill();
      }
      // 汚れ
      for (let i = 0; i < 60; i++) {
        g.fillStyle = `rgba(60,40,20,${Math.random() * 0.25})`;
        g.fillRect(Math.random() * 128, Math.random() * 128, Math.random() * 10, Math.random() * 4);
      }
    },
    true,
  );
}

function woodTexture(dark = false): THREE.CanvasTexture {
  return canvasTexture(
    256,
    256,
    (g) => {
      g.fillStyle = dark ? '#4a2612' : '#8a5428';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 90; i++) {
        const y = Math.random() * 256;
        g.strokeStyle = `rgba(${dark ? '20,8,2' : '60,28,8'},${0.1 + Math.random() * 0.25})`;
        g.lineWidth = 1 + Math.random() * 2.5;
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x / 30 + i) * 3);
        g.stroke();
      }
    },
    true,
  );
}

export function makeMaterials(theme: ThemeDef, quality: Quality): Mats {
  const c = theme.colors;
  const style = theme.style;
  const toon = style === 'anime' || style === 'comic';
  const grad = style === 'comic' ? toonGradient2() : toonGradient();

  const solid = (color: string, o: { metal?: number; rough?: number; emissive?: string; ei?: number; opacity?: number; map?: THREE.Texture } = {}) => {
    const common = {
      color,
      emissive: o.emissive ?? '#000000',
      emissiveIntensity: o.ei ?? 1,
      transparent: o.opacity !== undefined && o.opacity < 1,
      opacity: o.opacity ?? 1,
      ...(o.map ? { map: o.map } : {}),
    };
    if (toon) return new THREE.MeshToonMaterial({ ...common, gradientMap: grad });
    return new THREE.MeshStandardMaterial({ ...common, metalness: o.metal ?? 0.1, roughness: o.rough ?? 0.5 });
  };

  const glowCache = new Map<string, THREE.MeshStandardMaterial>();
  const glow = (color: string) => {
    let m = glowCache.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: '#111', emissive: color, emissiveIntensity: 0.15, roughness: 0.4, metalness: 0 });
      glowCache.set(color, m);
    }
    return m.clone();
  };

  let wall: THREE.Material;
  let wallTop: THREE.Material;
  switch (theme.wallMaterial ?? (style === 'test' ? 'plain' : 'plain')) {
    case 'glass':
      wall = new THREE.MeshPhysicalMaterial({
        color: c.wall,
        metalness: 0,
        roughness: 0.05,
        transmission: quality === 'high' ? 0.6 : 0,
        transparent: true,
        opacity: 0.45,
        thickness: 0.4,
        clearcoat: 1,
      });
      wallTop = solid(c.accent, { emissive: c.accent, ei: 1.4 });
      break;
    case 'metal':
      wall = solid(c.wall, { metal: 0.95, rough: 0.18 });
      wallTop = solid(c.guide, { metal: 1, rough: 0.12 });
      break;
    case 'wood':
      wall = new THREE.MeshStandardMaterial({ color: '#ffffff', map: woodTexture(true), roughness: 0.55, metalness: 0.05 });
      wallTop = solid('#e8e8f0', { metal: 1, rough: 0.1 });
      break;
    case 'neon':
      wall = solid('#05060c', { metal: 0.3, rough: 0.4, emissive: c.accent, ei: 0.08 });
      wallTop = solid(c.accent, { emissive: c.accent, ei: 2.2 });
      break;
    case 'hazard':
      wall = new THREE.MeshStandardMaterial({ color: '#ffffff', map: hazardTexture(), roughness: 0.7, metalness: 0.1 });
      wallTop = solid('#2a2a2a', { metal: 0.6, rough: 0.5 });
      break;
    case 'toon':
      wall = solid(c.wall);
      wallTop = solid(c.accent);
      break;
    default:
      wall = solid(c.wall, { rough: 0.6 });
      wallTop = solid(c.guide, { rough: 0.4 });
  }

  const ball = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.06 });

  return {
    floor: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: style === 'route50s' ? 0.45 : 0.62, metalness: 0.0 }),
    wall,
    wallTop,
    guide: solid(c.guide, { metal: 0.9, rough: 0.2 }),
    rubber: solid(c.rubber, { rough: 0.85 }),
    metal: solid('#d9dde3', { metal: 1, rough: 0.15 }),
    post: solid(c.guide, { metal: 0.8, rough: 0.25 }),
    flipper: solid(c.flipper, { rough: 0.35 }),
    flipperRubber: solid(c.flipperRubber, { rough: 0.8 }),
    bumperBase: solid('#1d1d22', { rough: 0.6 }),
    bumperBody: solid(c.bumper, { rough: 0.35, metal: style === 'route50s' ? 0.8 : 0.1 }),
    sling: solid(c.sling, { rough: 0.3, opacity: style === 'modern' ? 0.75 : 1 }),
    target: solid(c.target, { rough: 0.4 }),
    ramp:
      style === 'cyber'
        ? solid(c.ramp, { emissive: c.ramp, ei: 0.25, opacity: 0.35 })
        : toon
          ? solid(c.ramp, { opacity: 0.85 })
          : new THREE.MeshStandardMaterial({ color: c.ramp, transparent: true, opacity: 0.55, roughness: 0.15, metalness: 0.1, side: THREE.DoubleSide }),
    rampRail: solid(style === 'cyber' ? c.accent : c.guide, { metal: 0.9, rough: 0.2, emissive: style === 'cyber' ? c.accent : '#000', ei: 1.5 }),
    apron: solid(c.wall, { rough: 0.5, metal: style === 'route50s' ? 0.7 : 0.1 }),
    cabinet:
      style === 'route50s'
        ? new THREE.MeshStandardMaterial({ color: '#ffffff', map: woodTexture(false), roughness: 0.5 })
        : style === 'impossible'
          ? new THREE.MeshStandardMaterial({ color: '#ffffff', map: hazardTexture(), roughness: 0.7 })
          : solid(style === 'cyber' ? '#04050a' : c.bg, { rough: 0.6, metal: 0.4 }),
    dark: new THREE.MeshBasicMaterial({ color: '#030303' }),
    ball,
    glow,
    toon,
  };
}
