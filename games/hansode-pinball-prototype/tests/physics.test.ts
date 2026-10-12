import { describe, expect, it } from 'vitest';
import { World } from '../src/physics/world';
import { arc, circle, seg } from '../src/physics/shapes';
import { Flipper } from '../src/physics/flipper';
import { MAX_SPEED, STEP } from '../src/physics/constants';
import { Rng } from '../src/core/rng';

function finite(...v: number[]) {
  return v.every((x) => Number.isFinite(x));
}

function box(w: World, x0: number, y0: number, x1: number, y1: number, r = 0.05) {
  w.addShape(seg(x0, y0, x1, y0, { r }));
  w.addShape(seg(x1, y0, x1, y1, { r }));
  w.addShape(seg(x1, y1, x0, y1, { r }));
  w.addShape(seg(x0, y1, x0, y0, { r }));
}

describe('物理：すり抜け防止', () => {
  it('最高速度のボールを色々な角度で薄い壁の箱にぶつけても外に出ない', () => {
    const rng = new Rng(7);
    let escapes = 0;
    let invalid = 0;
    for (let trial = 0; trial < 400; trial++) {
      const w = new World();
      w.hooks.onInvalid = () => invalid++;
      box(w, -4, 0, 4, 8, rng.pick([0, 0.02, 0.05, 0.1]));
      const a = rng.range(0, Math.PI * 2);
      w.gy = rng.range(-80, 0);
      w.gx = rng.range(-30, 30);
      const b = w.addBall(rng.range(-3.4, 3.4), rng.range(0.6, 7.4));
      b.vx = Math.cos(a) * MAX_SPEED;
      b.vy = Math.sin(a) * MAX_SPEED;
      for (let i = 0; i < 1500; i++) {
        w.step(STEP);
        if (b.x < -4 || b.x > 4 || b.y < 0 || b.y > 8) {
          escapes++;
          break;
        }
        // 時々ボールを加速し直す（ずっと最高速で当て続ける）
        if (i % 120 === 0) {
          const a2 = rng.range(0, Math.PI * 2);
          b.vx = Math.cos(a2) * MAX_SPEED;
          b.vy = Math.sin(a2) * MAX_SPEED;
        }
      }
    }
    expect(invalid).toBe(0);
    expect(escapes).toBe(0);
  });

  it('円弧の囲いと円柱（ポスト）でも抜けない', () => {
    const rng = new Rng(11);
    let escapes = 0;
    for (let trial = 0; trial < 300; trial++) {
      const w = new World();
      w.gx = 0;
      w.gy = rng.range(-60, 0);
      // 半円2つで円を作る（端点の継ぎ目も試す）
      w.addShape(arc(0, 0, 6, 0, Math.PI, { r: 0.05 }));
      w.addShape(arc(0, 0, 6, Math.PI, Math.PI * 2, { r: 0.05 }));
      for (let k = 0; k < 4; k++) w.addShape(circle(rng.range(-3, 3), rng.range(-3, 3), rng.range(0.2, 0.9)));
      const b = w.addBall(0, 4.8);
      for (let i = 0; i < 1500; i++) {
        if (i % 100 === 0) {
          const a = rng.range(0, Math.PI * 2);
          b.vx = Math.cos(a) * MAX_SPEED;
          b.vy = Math.sin(a) * MAX_SPEED;
        }
        w.step(STEP);
        if (Math.hypot(b.x, b.y) > 6 || !finite(b.x, b.y, b.vx, b.vy)) {
          escapes++;
          break;
        }
      }
    }
    expect(escapes).toBe(0);
  });

  it('フリッパー：最高速度のボールを動いているフリッパーに当ててもすり抜けない', () => {
    const rng = new Rng(3);
    let tunnels = 0;
    let invalid = 0;
    let hits = 0;
    for (let trial = 0; trial < 600; trial++) {
      const w = new World();
      w.hooks.onInvalid = () => invalid++;
      const left = rng.chance(0.5);
      const f = w.addFlipper(
        new Flipper({
          id: 'f',
          side: left ? 'left' : 'right',
          pivotX: left ? -2 : 2,
          pivotY: 4,
          length: 3.3,
          r0: 0.55,
          r1: 0.28,
          restDeg: left ? -30 : 210,
          upDeg: left ? 28 : 152,
        }),
      );
      w.hooks.onFlipperHit = () => hits++;
      box(w, -8, -4, 8, 12);
      // フリッパーの上下いろいろな位置から、フリッパーへ向けて撃つ
      const tx = f.pivotX + Math.cos(f.rest) * rng.range(0.3, 3.3);
      const ty = f.pivotY + Math.sin(f.rest) * rng.range(0.3, 3.3);
      const from = rng.range(0, Math.PI * 2);
      const b = w.addBall(tx + Math.cos(from) * 3, ty + Math.sin(from) * 3);
      // 置いた位置がフリッパーに重なっていたらやり直し
      b.vx = -Math.cos(from) * MAX_SPEED;
      b.vy = -Math.sin(from) * MAX_SPEED;
      const flipAt = rng.int(0, 40);
      const releaseAt = flipAt + rng.int(5, 60);
      let side0 = 0;
      for (let i = 0; i < 600; i++) {
        if (i === flipAt) f.pressed = true;
        if (i === releaseAt) f.pressed = false;
        const ca = Math.cos(f.angle), sa = Math.sin(f.angle);
        w.step(STEP);
        const rx = b.x - f.pivotX, ry = b.y - f.pivotY;
        const c2 = Math.cos(f.angle), s2 = Math.sin(f.angle);
        const u = rx * c2 + ry * s2;
        const wv = -rx * s2 + ry * c2;
        const L = f.length;
        if (u > 0.05 * L && u < 0.95 * L && Math.abs(wv) < 1.4) {
          const s = wv > 0 ? 1 : -1;
          if (side0 !== 0 && s !== side0) tunnels++;
          side0 = s;
        } else {
          side0 = 0;
        }
        // フリッパーの中にめり込んでいないか
        const t = Math.max(0, Math.min(1, u / L));
        const rr = f.r0 + (f.r1 - f.r0) * t;
        const qx = f.pivotX + c2 * L * t, qy = f.pivotY + s2 * L * t;
        if (Math.hypot(b.x - qx, b.y - qy) < b.r + rr - 0.12) tunnels++;
        void ca;
        void sa;
      }
    }
    expect(invalid).toBe(0);
    expect(hits).toBeGreaterThan(300);
    expect(tunnels).toBe(0);
  });

  it('マルチボール：ボール同士がぶつかっても壁を抜けない', () => {
    const rng = new Rng(5);
    let escapes = 0;
    for (let trial = 0; trial < 120; trial++) {
      const w = new World();
      box(w, -3, 0, 3, 6, 0.04);
      const balls = [w.addBall(-1.5, 1.5), w.addBall(1.5, 1.5), w.addBall(0, 4)];
      for (let i = 0; i < 1500; i++) {
        if (i % 150 === 0) {
          for (const b of balls) {
            const a = rng.range(0, Math.PI * 2);
            b.vx = Math.cos(a) * MAX_SPEED;
            b.vy = Math.sin(a) * MAX_SPEED;
          }
        }
        w.step(STEP);
        for (const b of balls) if (b.x < -3 || b.x > 3 || b.y < 0 || b.y > 6) escapes++;
      }
    }
    expect(escapes).toBe(0);
  });

  it('フリッパーは押して約0.03〜0.05秒で上がり切る', () => {
    const f = new Flipper({ id: 'f', side: 'left', pivotX: 0, pivotY: 0, length: 3.3, r0: 0.55, r1: 0.28, restDeg: -30, upDeg: 28 });
    f.pressed = true;
    let t = 0;
    while (f.raise < 1 && t < 1) {
      f.update(STEP);
      t += STEP;
    }
    expect(t).toBeGreaterThan(0.025);
    expect(t).toBeLessThan(0.055);
  });
});
