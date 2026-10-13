// ダウンロードページ（games/hajike-flipper-kogyo.html）の確認：PC幅とスマホ幅で表示崩れ（横はみ出し）が無いこと、
// ボタンのリンク先が正しいこと、画像が読み込めること、一覧ページからリンクされていること。
import { _electron as electron } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, '..', '..');
const pagePath = join(site, 'games', 'hajike-flipper-kogyo.html');
const EXPECT = 'https://github.com/8oxygenium/hajike-flipper-kogyo/releases/latest/download/Hajike-Flipper-Kogyo-Setup.exe';
const outDir = join(root, 'screenshots');
mkdirSync(outDir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'OK ' : 'NG '} ${name}${detail ? `  (${detail})` : ''}`);
};

const app = await electron.launch({ args: [join(root, 'scripts', 'page-check-main.cjs')], cwd: root, env: { ...process.env, PAGE_URL: pathToFileURL(pagePath).href } });
const page = await app.firstWindow();
await page.waitForLoadState('load');
for (const [w, h, name] of [
  [1280, 900, 'pc'],
  [390, 844, 'phone'],
]) {
  await app.evaluate(({ BrowserWindow }, [ww, hh]) => BrowserWindow.getAllWindows()[0].setContentSize(ww, hh), [w, h]);
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => ({
    href: document.getElementById('download')?.getAttribute('href'),
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    imgs: [...document.images].map((i) => [i.getAttribute('src'), i.complete && i.naturalWidth > 0]),
    btn: (() => {
      const r = document.getElementById('download').getBoundingClientRect();
      return { w: r.width, h: r.height, inView: r.left >= 0 && r.right <= window.innerWidth };
    })(),
  }));
  check(`${name}: ダウンロードボタンのリンク先`, info.href === EXPECT, info.href);
  check(`${name}: 横にはみ出さない`, info.overflow <= 0, `${info.overflow}px`);
  check(`${name}: ボタンが画面内で押しやすい大きさ`, info.btn.inView && info.btn.h >= 44, JSON.stringify(info.btn));
  check(`${name}: 画像がすべて読み込める`, info.imgs.every(([, ok]) => ok), JSON.stringify(info.imgs.filter(([, ok]) => !ok)));
  await page.screenshot({ path: join(outDir, `download_page_${name}.png`), fullPage: true });
}
await app.close();
const index = readFileSync(join(site, 'games', 'index.html'), 'utf8');
check('games/index.html からリンクされている', index.includes('href="hajike-flipper-kogyo.html"'));
const n = results.filter(Boolean).length;
console.log(`\n${n}/${results.length} passed`);
process.exit(n === results.length ? 0 : 1);
