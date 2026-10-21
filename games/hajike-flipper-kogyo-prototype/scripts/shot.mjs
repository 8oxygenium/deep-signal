// 開発用：アプリを起動して、ページ内でスクリプトを実行しスクリーンショットを撮る
// 使い方: node scripts/shot.mjs <出力.png> [ページで実行するJS] [待ち秒]
import { _electron as electron } from 'playwright';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [out = 'shot.png', script = '', wait = '1.5'] = process.argv.slice(2);
const ud = mkdtempSync(join(tmpdir(), 'hp-shot-'));
const app = await electron.launch({ args: ['.'], cwd: root, env: { ...process.env, HANSODE_E2E: '1', HANSODE_USER_DATA: ud } });
const page = await app.firstWindow();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.setViewportSize?.({ width: 1280, height: 800 }).catch(() => {});
// SHOT_SIZE=800x560 のように指定すると、ウィンドウの中身をその大きさにして撮る
if (process.env.SHOT_SIZE) {
  const [w, hh] = process.env.SHOT_SIZE.split('x').map(Number);
  await page.setViewportSize({ width: w, height: hh });
}
await page.waitForTimeout(1200);
if (script) {
  const r = await page.evaluate(script);
  if (r !== undefined) console.log('result:', typeof r === 'string' ? r : JSON.stringify(r));
}
await page.waitForTimeout(Number(wait) * 1000);
await page.screenshot({ path: out });
console.log(errors.length ? errors.join('\n') : 'no console errors');
await app.close();
