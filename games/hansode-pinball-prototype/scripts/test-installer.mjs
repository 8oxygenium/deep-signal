// インストーラー確認：exe でインストール → 起動 → 終了 → アンインストールが通ること、
// 起動中は固定キー等のショートカットが無効になり、終了後に元の設定へ戻っていることを確かめる。
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const EXE = join(root, 'release', 'HANSODE-Pinball-Setup.exe');
const APP = 'HANSODE PINBALL';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'OK ' : 'NG '} ${name}${detail ? `  (${detail})` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!existsSync(EXE)) {
  console.error('先に npm run dist でインストーラーを作ってください:', EXE);
  process.exit(1);
}

// 固定キー等の現在の設定を読む
const koffi = require('koffi');
const user32 = koffi.load('user32.dll');
const SK = koffi.struct('T_STICKYKEYS', { cbSize: 'uint32', dwFlags: 'uint32' });
const FK = koffi.struct('T_FILTERKEYS', { cbSize: 'uint32', dwFlags: 'uint32', a: 'uint32', b: 'uint32', c: 'uint32', d: 'uint32' });
const spiSK = user32.func('__stdcall', 'SystemParametersInfoW', 'bool', ['uint32', 'uint32', koffi.inout(koffi.pointer(SK)), 'uint32']);
const spiFK = user32.func('__stdcall', 'SystemParametersInfoW', 'bool', ['uint32', 'uint32', koffi.inout(koffi.pointer(FK)), 'uint32']);
const flags = () => {
  const s = { cbSize: 8, dwFlags: 0 };
  spiSK(0x3a, 8, s, 0);
  const f = { cbSize: 24, dwFlags: 0, a: 0, b: 0, c: 0, d: 0 };
  spiFK(0x32, 24, f, 0);
  return { sticky: s.dwFlags >>> 0, filter: f.dwFlags >>> 0 };
};

const before = flags();
console.log('起動前の設定:', JSON.stringify(before));

const dir = mkdtempSync(join(tmpdir(), 'hp-install-'));
const installDir = join(dir, 'app');
const ud = join(dir, 'userdata');

// 1. サイレントインストール（/D は最後・引用符なし）
let r = spawnSync(EXE, ['/S', `/D=${installDir}`], { stdio: 'inherit', timeout: 300000 });
const installedExe = join(installDir, `${APP}.exe`);
check('インストール（サイレント）が終わる', r.status === 0, `exit=${r.status}`);
check('インストール先にアプリが入る', existsSync(installedExe), installedExe);
const desktopLnk = join(homedir(), 'Desktop', `${APP}.lnk`);
const oneDriveDesktop = join(homedir(), 'OneDrive', 'Desktop', `${APP}.lnk`);
const startLnk = join(process.env.APPDATA ?? '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${APP}.lnk`);
check('デスクトップにショートカット', existsSync(desktopLnk) || existsSync(oneDriveDesktop));
check('スタートメニューにショートカット', existsSync(startLnk), startLnk);

// 2. 起動（数秒動かして自動で正常終了する --smoke-test）
const child = spawn(installedExe, ['--smoke-test=7'], { env: { ...process.env, HANSODE_USER_DATA: ud }, stdio: 'ignore' });
let exited = false;
child.on('exit', () => (exited = true));
await sleep(4000);
const during = flags();
const hotkeyOff = (during.sticky & 0x4) === 0 || (before.sticky & 0x1) !== 0;
check('起動中は固定キーのショートカットが無効', hotkeyOff, `sticky=${during.sticky}`);
check('起動中は右Shift長押し（フィルターキー）のショートカットも無効', (during.filter & 0x4) === 0 || (before.filter & 0x1) !== 0, `filter=${during.filter}`);
for (let i = 0; i < 40 && !exited; i++) await sleep(500);
check('アプリが正常に終了する', exited);
const smoke = existsSync(join(ud, 'smoke-result.json')) ? JSON.parse(readFileSync(join(ud, 'smoke-result.json'), 'utf8')) : null;
check('アプリが動いた記録（smoke-result.json）', !!smoke && smoke.title === APP, smoke ? JSON.stringify(smoke.a11y) : '');
await sleep(500);
const after = flags();
check('終了後に固定キーの設定が元に戻る', after.sticky === before.sticky && after.filter === before.filter, `${JSON.stringify(before)} → ${JSON.stringify(after)}`);

// 3. アンインストール
const uninst = join(installDir, `Uninstall ${APP}.exe`);
check('アンインストーラーがある', existsSync(uninst));
if (existsSync(uninst)) {
  r = spawnSync(uninst, ['/S'], { stdio: 'inherit', timeout: 300000 });
  for (let i = 0; i < 60 && existsSync(installedExe); i++) await sleep(1000);
  check('アンインストールでアプリが消える', !existsSync(installedExe));
  check('デスクトップのショートカットが消える', !existsSync(desktopLnk) && !existsSync(oneDriveDesktop));
  check('スタートメニューのショートカットが消える', !existsSync(startLnk));
}

rmSync(dir, { recursive: true, force: true });
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
