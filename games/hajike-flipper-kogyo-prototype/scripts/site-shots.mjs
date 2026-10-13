// ダウンロードページ用のスクリーンショット（実際のアプリ画面）を撮って assets/img/ に JPEG で保存する
// 使い方: npm run build && node scripts/site-shots.mjs [3枚目のステージID]
import { _electron as electron } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '..', '..', 'assets', 'img');
const third = process.argv[2] ?? 'cyber';
const ud = mkdtempSync(join(tmpdir(), 'hp-site-'));
const app = await electron.launch({ args: ['.'], cwd: root, env: { ...process.env, HANSODE_E2E: '1', HANSODE_USER_DATA: ud } });
const page = await app.firstWindow();
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 800));
await page.waitForFunction(() => window.__pinball && window.__pinball.screen === 'title', null, { timeout: 20000 });

const play = async (id, file) => {
  await page.evaluate((sid) => window.__pinball.app.startStage(window.__pinball.stageDefs.find((s) => s.id === sid)), id);
  await page.waitForTimeout(600);
  // 発射して、しばらく自動でフリッパーを動かしてから撮る
  await page.evaluate(() => {
    const g = window.__pinball.game;
    g.setLaunch(true);
    setTimeout(() => g.setLaunch(false), 700);
    window.__autoTimer = setInterval(() => {
      const gg = window.__pinball.game;
      if (!gg) return;
      gg.autoPlay(1 / 60, 0.8);
      if (gg.ballInLane && !gg.table.plunger.pulling) {
        gg.setLaunch(true);
        setTimeout(() => gg.setLaunch(false), 600);
      }
    }, 16);
  });
  await page.waitForTimeout(6500);
  await page.screenshot({ path: join(out, file), type: 'jpeg', quality: 82 });
  await page.evaluate(() => clearInterval(window.__autoTimer));
};

await play('modern', 'hajike-flipper-kogyo-1.jpg');
await page.evaluate(() => window.__pinball.app.toSelect());
await page.waitForTimeout(1800);
await page.screenshot({ path: join(out, 'hajike-flipper-kogyo-2.jpg'), type: 'jpeg', quality: 82 });
await play(third, 'hajike-flipper-kogyo-3.jpg');
await app.close();
rmSync(ud, { recursive: true, force: true });
console.log('saved to', out);
