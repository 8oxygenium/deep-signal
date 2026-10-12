// 画面テスト（Playwright + Electron）
// 全画面を巡回してスクリーンショットを screenshots/ に保存し、コンソールエラー0件・保存・入力を確認する。
import { _electron as electron } from 'playwright';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registryFlags, sessionFlags } from './a11y-flags.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'screenshots');
mkdirSync(outDir, { recursive: true });
const ud = mkdtempSync(join(tmpdir(), 'hp-e2e-'));
const errors = [];
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK ' : 'NG '} ${name}${detail ? `  (${detail})` : ''}`);
};

async function launch() {
  const app = await electron.launch({ args: ['.'], cwd: root, env: { ...process.env, HANSODE_E2E: '1', HANSODE_USER_DATA: ud } });
  const page = await app.firstWindow();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  await page.waitForFunction(() => window.__pinball && window.__pinball.screen === 'title', null, { timeout: 20000 });
  await page.waitForTimeout(800);
  return { app, page };
}

const shot = async (page, name) => {
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(outDir, `${name}.png`) });
};
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const wait = (page, ms) => page.waitForTimeout(ms);
const screen = (page) => ev(page, () => window.__pinball.screen);
const startStage = (page, id) =>
  ev(page, (sid) => window.__pinball.app.startStage(window.__pinball.stageDefs.find((s) => s.id === sid)), id);

let { app, page } = await launch();
const stages = await ev(page, () => window.__pinball.stages);
const only = process.argv[2];
console.log('stages:', stages.join(', '));

await shot(page, '01_title');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await wait(page, 400);
check('タイトル→設定', (await screen(page)) === 'settings');
await shot(page, '02_settings');
// カメラ視点を「真上」に変える（保存の確認用）
for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowRight');
await wait(page, 300);
await page.keyboard.press('Escape');
await wait(page, 300);
check('設定→タイトルに戻る', (await screen(page)) === 'title');
await ev(page, () => window.__pinball.app.showGuide('title'));
await wait(page, 300);
await shot(page, '03_guide');
await page.keyboard.press('Enter');
await wait(page, 300);
check('案内→タイトル', (await screen(page)) === 'title');

// ステージ選択：全ステージのカードを撮る
await ev(page, () => window.__pinball.app.toSelect());
await wait(page, 600);
for (let i = 0; i < stages.length; i++) {
  await wait(page, 1000);
  await shot(page, `04_select_${i + 1}_${stages[i]}`);
  await page.keyboard.press('ArrowDown');
}

// 各ステージを遊ぶ
for (let i = 0; i < stages.length; i++) {
  if (only && stages[i] !== only) continue;
  await startStage(page, stages[i]);
  await wait(page, 700);
  // Space 長押しで発射
  await page.keyboard.down('Space');
  await wait(page, 650);
  await page.keyboard.up('Space');
  await wait(page, 1500);
  // 左右Shiftの同時押し
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('ShiftRight');
  await wait(page, 150);
  const both = await ev(page, () => window.__pinball.game.flippers.map((f) => f.raise));
  await page.keyboard.up('ShiftLeft');
  await wait(page, 150);
  const afterL = await ev(page, () => window.__pinball.game.flippers.map((f) => [f.side, Number(f.raise.toFixed(2))]));
  await page.keyboard.up('ShiftRight');
  check(`${stages[i]}: 左右Shift同時押しで両方上がる`, both.every((v) => v > 0.95), JSON.stringify(both.map((v) => v.toFixed(2))));
  check(`${stages[i]}: 左だけ離すと左だけ下がる`, afterL.every(([s, r]) => (s === 'left' ? r < 0.9 : r > 0.95)), JSON.stringify(afterL));
  await wait(page, 1800);
  await shot(page, `05_play_${i + 1}_${stages[i]}`);
  const fps = await ev(page, () => window.__pinball.fps);
  check(`${stages[i]}: 描画が動いている`, fps > 20, `${fps.toFixed(0)}fps`);
  // BGM と効果音が実際に鳴っているか（音量を何回か測って最大を見る）
  let lv = 0;
  for (let k = 0; k < 8; k++) {
    lv = Math.max(lv, await ev(page, () => window.__pinball.audioLevel));
    await wait(page, 120);
  }
  const st = await ev(page, () => window.__pinball.audioState);
  check(`${stages[i]}: 音が鳴っている（BGM/効果音）`, st === 'running' && lv > 0.002, `${st} level=${lv.toFixed(4)}`);
}

// 揺らしすぎで TILT
await startStage(page, stages[0]);
await wait(page, 600);
await page.keyboard.down('Space');
await wait(page, 600);
await page.keyboard.up('Space');
await wait(page, 800);
for (let k = 0; k < 16; k++) {
  await page.keyboard.press(k % 3 === 2 ? 'ArrowUp' : k % 2 ? 'KeyZ' : 'Slash');
  await wait(page, 190);
  if (await ev(page, () => window.__pinball.game.tilted)) break;
}
check('Z と / で揺らしすぎると TILT', await ev(page, () => window.__pinball.game.tilted));
await shot(page, '06_tilt');

// ポーズ
await page.keyboard.press('Escape');
await wait(page, 400);
check('Esc でポーズ', (await screen(page)) === 'pause');
await shot(page, '07_pause');
// ポーズ → 設定 → Esc でポーズ画面に戻れる
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await wait(page, 300);
await page.keyboard.press('Enter');
await wait(page, 400);
check('ポーズ → 設定', (await screen(page)) === 'settings');
await page.keyboard.press('Escape');
await wait(page, 400);
check('設定 → Esc でポーズに戻る', (await screen(page)) === 'pause');
check('ポーズ中も描画は本物のゲームのまま', await ev(page, () => window.__pinball.app.renderer.game === window.__pinball.app.game && !window.__pinball.app.renderer.preview));
await page.keyboard.press('Escape');
await wait(page, 300);
check('Esc でポーズから再開', (await screen(page)) === 'play');

// ステージ選択で ↓ の直後に Enter：プレイ画面がプレビューのデモにすり替わらない
await ev(page, () => window.__pinball.app.toSelect());
await wait(page, 600);
await page.keyboard.press('ArrowDown');
await wait(page, 30);
await page.keyboard.press('Enter');
await wait(page, 600);
check('↓直後のEnterでも、表示は本物のゲーム', await ev(page, () => window.__pinball.screen === 'play' && window.__pinball.app.renderer.game === window.__pinball.app.game && !window.__pinball.app.renderer.preview));

// キー割り当て：左フリッパーに右Shiftを割り当てると左右が入れ替わる（重複しない）
await ev(page, () => window.__pinball.app.showSettings('title'));
await wait(page, 400);
for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowDown');
await wait(page, 300);
await page.keyboard.press('Enter');
await wait(page, 300);
await page.keyboard.press('ShiftRight');
await wait(page, 300);
const binds = await ev(page, () => window.__pinball.app.settings.bindings);
check('割り当ての入れ替え（左右Shiftが重複しない）', binds.left[0] === 'ShiftRight' && binds.right.includes('ShiftLeft') && !binds.right.includes('ShiftRight'), JSON.stringify([binds.left, binds.right]));
// 元に戻す（「キー割り当てを最初に戻す」行）
await page.keyboard.press('Enter');
await wait(page, 300);
await page.keyboard.press('ShiftLeft');
await wait(page, 300);
await page.keyboard.press('Escape');
await wait(page, 300);
await startStage(page, stages[0]);
await wait(page, 500);

// ゲームオーバー → 名前入力 → ランキング
await ev(page, () => window.__pinball.app.debugGameOver(123456));
await wait(page, 1000);
await shot(page, '08_gameover');
await page.keyboard.press('Enter');
await wait(page, 400);
check('ハイスコアで名前入力へ', (await screen(page)) === 'entry');
await page.keyboard.type('hansode');
await wait(page, 200);
await shot(page, '09_entry');
await page.keyboard.press('Enter');
await wait(page, 500);
check('名前入力→ランキング', (await screen(page)) === 'ranking');
await shot(page, '10_ranking');
await wait(page, 600);
await page.keyboard.press('Enter');
await wait(page, 500);
check('ランキング→ステージ選択', (await screen(page)) === 'select');

// F11 でフルスクリーン
await page.keyboard.press('F11');
await wait(page, 900);
const fs1 = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen());
await page.keyboard.press('F11');
await wait(page, 900);
const fs2 = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen());
check('F11 でフルスクリーン切替', fs1 === true && fs2 === false, `${fs1},${fs2}`);

await app.close();

// 保存の確認（ファイルと再起動後）
const hsFile = join(ud, 'highscores.json');
const hs = existsSync(hsFile) ? JSON.parse(readFileSync(hsFile, 'utf8')) : null;
check('ハイスコアがファイルに保存される', !!hs && Object.values(hs).some((l) => l.some((e) => e.name === 'HANSODE' && e.score === 123456)));
({ app, page } = await launch());
const cam = await ev(page, () => window.__pinball.app.settings.camera);
check('設定が保存されて次回も使われる（カメラ=真上）', cam === 'top', cam);
const best = await ev(page, () => JSON.stringify(window.__pinball.app.scores));
check('再起動後もハイスコアが残る', best.includes('HANSODE'));
await app.close();

rmSync(ud, { recursive: true, force: true });
if (process.platform === 'win32') {
  await new Promise((r) => setTimeout(r, 800));
  const sf = sessionFlags();
  const rf = registryFlags();
  check('終了後、固定キー/フィルターキーの設定が本来の値に戻っている', sf.sticky === rf.sticky && sf.filter === rf.filter, `${JSON.stringify(sf)} / 本来 ${JSON.stringify(rf)}`);
}
check('コンソールエラー0件', errors.length === 0, errors.slice(0, 5).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed. screenshots: ${outDir}`);
process.exit(failed.length ? 1 : 0);
