// 3D 装飾の共通道具：平塗り（トゥーン）の素材、部品のまとめ（描画呼び出しを減らす）
import type * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { DecorateApi } from '../types';

export interface ToonOpts {
  map?: T.Texture;
  emissive?: string;
  ei?: number;
  opacity?: number;
  side?: T.Side;
  /** 輪郭線を描かない（絵・水面など） */
  noOutline?: boolean;
  /** 輪郭線の太さ（省略時は標準） */
  outline?: number;
}

export class Kit {
  readonly THREE: DecorateApi['THREE'];
  readonly low: boolean;
  private gradient: T.DataTexture;
  constructor(readonly api: DecorateApi) {
    this.THREE = api.THREE;
    this.low = api.quality === 'low';
    const THREE = this.THREE;
    // 平塗り：影は1段だけ（木版画は陰影をつけない）
    const data = new Uint8Array([150, 150, 150, 255, 255, 255, 255, 255]);
    this.gradient = new THREE.DataTexture(data, 2, 1, THREE.RGBAFormat);
    this.gradient.minFilter = THREE.NearestFilter;
    this.gradient.magFilter = THREE.NearestFilter;
    this.gradient.needsUpdate = true;
  }

  toon(color: string, o: ToonOpts = {}): T.MeshToonMaterial {
    const THREE = this.THREE;
    const m = new THREE.MeshToonMaterial({
      color,
      gradientMap: this.gradient,
      ...(o.map ? { map: o.map } : {}),
      ...(o.emissive ? { emissive: new THREE.Color(o.emissive), emissiveIntensity: o.ei ?? 1 } : {}),
      transparent: o.opacity !== undefined && o.opacity < 1,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
    });
    if (o.noOutline) m.userData.outlineParameters = { visible: false };
    else if (o.outline !== undefined) m.userData.outlineParameters = { thickness: o.outline };
    return m;
  }

  /** 光に左右されない素材（絵・後光など） */
  basic(color: string, o: { map?: T.Texture; opacity?: number; side?: T.Side; noOutline?: boolean } = {}): T.MeshBasicMaterial {
    const THREE = this.THREE;
    const m = new THREE.MeshBasicMaterial({
      color,
      ...(o.map ? { map: o.map } : {}),
      transparent: (o.opacity !== undefined && o.opacity < 1) || !!o.map,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
    });
    if (o.noOutline !== false) m.userData.outlineParameters = { visible: false };
    return m;
  }

  mesh(geo: T.BufferGeometry, mat: T.Material, parent?: T.Object3D, x = 0, y = 0, z = 0): T.Mesh {
    const m = new this.THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = !this.low;
    parent?.add(m);
    return m;
  }

  /** 同じ素材の子メッシュを1つにまとめる（輪郭線の描き直しで呼び出しが倍になるため）。動かす部品は userData.keep = true */
  bake(g: T.Object3D): void {
    const buckets = new Map<T.Material, T.Mesh[]>();
    for (const c of [...g.children]) {
      const m = c as T.Mesh;
      if (!m.isMesh || m.userData.keep || Array.isArray(m.material)) continue;
      const list = buckets.get(m.material) ?? [];
      list.push(m);
      buckets.set(m.material, list);
    }
    for (const [mat, list] of buckets) {
      if (list.length < 2) continue;
      const geos = list.map((m) => {
        m.updateMatrix();
        const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
        if (!geo.getAttribute('uv')) geo.setAttribute('uv', new this.THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count * 2), 2));
        geo.applyMatrix4(m.matrix);
        return geo;
      });
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const mesh = new this.THREE.Mesh(merged, mat);
      mesh.castShadow = list[0].castShadow;
      for (const m of list) {
        g.remove(m);
        m.geometry.dispose();
      }
      g.add(mesh);
    }
  }
}
