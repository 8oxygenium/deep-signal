// テーマ別のポストエフェクト（シェーダー）
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';

/** トゥーン用：輪郭線つきで描くレンダーパス（ANIME / COMIC） */
export class OutlineRenderPass extends Pass {
  readonly effect: OutlineEffect;
  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    thickness: number,
  ) {
    super();
    this.needsSwap = false;
    this.effect = new OutlineEffect(renderer, { defaultThickness: thickness, defaultColor: [0.02, 0.02, 0.05], defaultAlpha: 1 });
  }
  render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget): void {
    renderer.setRenderTarget(this.renderToScreen ? null : read);
    renderer.clear();
    this.effect.render(this.scene, this.camera);
  }
}

abstract class ShaderPassBase extends Pass {
  protected quad: FullScreenQuad;
  readonly material: THREE.ShaderMaterial;
  constructor(fragment: string, uniforms: Record<string, THREE.IUniform>) {
    super();
    this.material = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, resolution: { value: new THREE.Vector2(1, 1) }, time: { value: 0 }, ...uniforms },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: fragment,
    });
    this.quad = new FullScreenQuad(this.material);
  }
  setSize(w: number, h: number): void {
    this.material.uniforms.resolution.value.set(w, h);
  }
  render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget): void {
    this.material.uniforms.tDiffuse.value = read.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : write);
    this.quad.render(renderer);
  }
  dispose(): void {
    this.material.dispose();
    this.quad.dispose();
  }
}

/** アメコミ風：網点（ハーフトーン）と色の段階化 */
export class ComicPass extends ShaderPassBase {
  constructor() {
    super(
      `uniform sampler2D tDiffuse; uniform vec2 resolution; uniform float dotSize; varying vec2 vUv;
      float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
      void main(){
        vec4 col = texture2D(tDiffuse, vUv);
        vec3 c = col.rgb;
        // 色を段階化（印刷っぽく）
        c = floor(c * 5.0 + 0.5) / 5.0;
        float l = luma(col.rgb);
        vec2 p = vUv * resolution / dotSize;
        float a = 0.785;
        vec2 r = vec2(cos(a)*p.x - sin(a)*p.y, sin(a)*p.x + cos(a)*p.y);
        vec2 f = fract(r) - 0.5;
        float d = length(f);
        float radius = clamp((1.0 - l) * 0.62, 0.0, 0.62);
        float ink = 1.0 - smoothstep(radius - 0.06, radius + 0.06, d);
        // 暗いところほど網点が濃い。明るいところは紙の白っぽさを足す
        vec3 outc = mix(c, c * 0.35, ink * smoothstep(0.85, 0.25, l));
        outc = mix(outc, vec3(1.0, 0.97, 0.88), smoothstep(0.8, 1.0, l) * 0.25);
        gl_FragColor = vec4(outc, 1.0);
      }`,
      { dotSize: { value: 5.0 } },
    );
  }
}

/** 浮世絵：木版画風（平塗り・墨の輪郭・ぼかし摺り・和紙の質感） */
export class UkiyoePass extends ShaderPassBase {
  constructor() {
    super(
      `uniform sampler2D tDiffuse; uniform vec2 resolution; uniform vec3 bokashi; uniform float bokashiAmt; varying vec2 vUv;
      float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 px = 1.0 / resolution;
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = luma(c);
        // 平塗り：明るさを段階にして、色味は保つ
        float lq = floor(l * 5.0 + 0.5) / 5.0;
        vec3 painted = c * (max(lq, 0.04) / max(l, 0.04));
        c = mix(c, painted, 0.65);
        // 墨の輪郭：明るさの差が大きい所に線を足す
        float lx = luma(texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb) - luma(texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb);
        float ly = luma(texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb) - luma(texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb);
        float edge = smoothstep(0.16, 0.42, length(vec2(lx, ly)));
        c = mix(c, vec3(0.09, 0.07, 0.06), edge * 0.75);
        // ぼかし摺り：画面の上の帯を藍色でぼかす
        float b = smoothstep(0.80, 1.0, vUv.y) * bokashiAmt;
        c = mix(c, c * bokashi * 1.6, b);
        // 和紙：細かい繊維のむらと、明るい所の生成り色
        vec2 q = vUv * resolution;
        float fib = n(q * vec2(0.35, 0.06)) * 0.5 + n(q * 0.9) * 0.3 + n(q * vec2(0.05, 0.6)) * 0.2;
        c *= 0.9 + 0.1 * fib;
        c = mix(c, c * vec3(1.0, 0.95, 0.84), 0.35);
        c = mix(c, vec3(0.96, 0.91, 0.79), smoothstep(0.82, 1.0, l) * 0.35);
        gl_FragColor = vec4(c, 1.0);
      }`,
      { bokashi: { value: new THREE.Color('#2b4f8f') }, bokashiAmt: { value: 0.55 } },
    );
  }
}

/** サイバー：グリッチ（RGBずれ・横ずれ・走査線） */
export class GlitchPass extends ShaderPassBase {
  amount = 0;
  constructor() {
    super(
      `uniform sampler2D tDiffuse; uniform vec2 resolution; uniform float time; uniform float amount; varying vec2 vUv;
      float rnd(vec2 s){ return fract(sin(dot(s, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        float band = floor(uv.y * 24.0 + floor(time * 18.0));
        float r = rnd(vec2(band, floor(time * 12.0)));
        float shift = (r > 0.82 ? (r - 0.82) * 0.4 : 0.0) * amount;
        uv.x += shift * (rnd(vec2(band, 3.0)) - 0.5);
        float sp = 0.004 * amount + 0.0012;
        vec3 c;
        c.r = texture2D(tDiffuse, uv + vec2(sp, 0.0)).r;
        c.g = texture2D(tDiffuse, uv).g;
        c.b = texture2D(tDiffuse, uv - vec2(sp, 0.0)).b;
        float scan = 0.94 + 0.06 * sin(vUv.y * resolution.y * 1.6);
        c *= scan;
        gl_FragColor = vec4(c, 1.0);
      }`,
      { amount: { value: 0 } },
    );
  }
  render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget): void {
    this.material.uniforms.amount.value = this.amount;
    super.render(renderer, write, read);
  }
}

/** IMPOSSIBLE：停電（ボールの周りだけスポットライト）と赤い非常灯 */
export class AlarmPass extends ShaderPassBase {
  darkness = 0;
  alarm = 0;
  readonly balls: THREE.Vector2[] = [0, 1, 2, 3].map(() => new THREE.Vector2(-9, -9));
  constructor() {
    super(
      `uniform sampler2D tDiffuse; uniform vec2 resolution; uniform float time; uniform float darkness; uniform float alarm; uniform vec2 balls[4]; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float aspect = resolution.x / resolution.y;
        float light = 0.0;
        for (int i = 0; i < 4; i++) {
          vec2 d = (vUv - balls[i]) * vec2(aspect, 1.0);
          light = max(light, 1.0 - smoothstep(0.07, 0.17, length(d)));
        }
        float vis = mix(1.0, max(light, 0.035), darkness);
        c *= vis;
        float pulse = 0.5 + 0.5 * sin(time * 7.0);
        vec2 v = vUv - 0.5;
        float edge = smoothstep(0.25, 0.75, length(v));
        c += vec3(0.55, 0.0, 0.0) * alarm * pulse * (0.25 + edge);
        gl_FragColor = vec4(c, 1.0);
      }`,
      {
        darkness: { value: 0 },
        alarm: { value: 0 },
        balls: { value: [0, 1, 2, 3].map(() => new THREE.Vector2(-9, -9)) },
      },
    );
  }
  render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget): void {
    this.material.uniforms.darkness.value = this.darkness;
    this.material.uniforms.alarm.value = this.alarm;
    const arr = this.material.uniforms.balls.value as THREE.Vector2[];
    for (let i = 0; i < 4; i++) arr[i].copy(this.balls[i]);
    super.render(renderer, write, read);
  }
}

/** 色味とビネット（全ステージ共通の仕上げ） */
export class GradePass extends ShaderPassBase {
  constructor(tint: THREE.Color, vignette: number, saturation: number) {
    super(
      `uniform sampler2D tDiffuse; uniform vec3 tint; uniform float vignette; uniform float saturation; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = dot(c, vec3(0.299,0.587,0.114));
        c = mix(vec3(l), c, saturation) * tint;
        vec2 v = vUv - 0.5;
        c *= 1.0 - vignette * smoothstep(0.3, 0.85, length(v));
        gl_FragColor = vec4(c, 1.0);
      }`,
      { tint: { value: tint }, vignette: { value: vignette }, saturation: { value: saturation } },
    );
  }
}
