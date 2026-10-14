// 描画の速さを測る（ステージ × 画質）。本番と同じ requestAnimationFrame のループで、自動プレイ中の実際の fps を測る。
// 使い方: npm run build && node scripts/perf.mjs [stageId|all] [high|mid|low|all] [幅x高さ]
import { _electron as electron } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const onlyStage = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2] : null;
const qualities = process.argv[3] && process.argv[3] !== 'all' ? [process.argv[3]] : ['high', 'mid', 'low'];
const [W, H] = (process.argv[4] ?? '1920x1080').split('x').map(Number);
const ud = mkdtempSync(join(tmpdir(), 'hp-perf-'));

const app = await electron.launch({ args: ['.'], cwd: root, env: { ...process.env, HANSODE_E2E: 'raf', HANSODE_USER_DATA: ud } });
const page = await app.firstWindow();
if (process.env.NOAUTO) await page.addInitScript(() => { window.__noAutoScale = true; });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.waitForFunction(() => window.__pinball && window.__pinball.screen === 'title', null, { timeout: 20000 });
await app.evaluate(({ BrowserWindow }, [w, h]) => {
  const win = BrowserWindow.getAllWindows()[0];
  win.setContentSize(w, h);
  win.focus();
}, [W, H]);
await page.waitForTimeout(500);
const stages = (await page.evaluate(() => window.__pinball.stages)).filter((s) => !onlyStage || s === onlyStage);

for (const q of qualities) {
  for (const id of stages) {
    const r = await page.evaluate(
      async ([sid, quality]) => {
        const P = window.__pinball;
        const a = P.app;
        if (window.__noAutoScale) a.renderer.autoScale = () => {};
        a.settings.quality = quality;
        a.renderer.setOptions({ quality });
        a.startStage(P.stageDefs.find((s) => s.id === sid));
        // 自動で遊ばせる（マルチボールなども起きる）
        P.game.attract = true;
        await new Promise((res) => setTimeout(res, 2500));
        // 描画処理そのものにかかる時間（CPU側、GPUが詰まっていればその待ちも入る）
        const R = a.renderer;
        const orig = R.render;
        let rt = 0, rn = 0;
        R.render = function (dt) {
          const t = performance.now();
          orig.call(this, dt);
          rt += performance.now() - t;
          rn++;
        };
        const dts = [];
        await new Promise((res) => {
          let last = 0;
          const t0 = performance.now();
          const tick = (now) => {
            if (last) dts.push(now - last);
            last = now;
            if (now - t0 < 6000) requestAnimationFrame(tick);
            else res();
          };
          requestAnimationFrame(tick);
        });
        R.render = orig;
        dts.sort((x, y) => x - y);
        const avg = dts.reduce((s, v) => s + v, 0) / dts.length;
        return { fps: 1000 / avg, p95: dts[Math.floor(dts.length * 0.95)], slow: dts.filter((d) => d > 25).length / dts.length, scale: a.renderer.renderScale, cpu: rt / Math.max(1, rn) };
      },
      [id, q],
    );
    console.log(`${q.padEnd(4)} ${id.padEnd(10)} ${r.fps.toFixed(0).padStart(3)}fps  p95 ${r.p95.toFixed(1)}ms  25ms超 ${(r.slow * 100).toFixed(1)}%  描画処理 ${r.cpu.toFixed(1)}ms  自動解像度×${r.scale}`);
  }
}
await app.close();
rmSync(ud, { recursive: true, force: true });
if (errors.length) console.log('errors:', errors.slice(0, 5));
