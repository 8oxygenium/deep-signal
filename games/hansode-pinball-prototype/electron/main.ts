import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { AccessibilityShortcuts } from './accessibility';
import { KeyPoller } from './keypoll';

// テスト用：保存先を差し替え（本番の userData を汚さない）
if (process.env.HANSODE_USER_DATA) app.setPath('userData', process.env.HANSODE_USER_DATA);

// 効果音・BGMをユーザー操作なしで鳴らせるように
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const isDev = !app.isPackaged;
const isE2E = process.env.HANSODE_E2E === '1';
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const smokeArg = process.argv.find((a) => a.startsWith('--smoke-test'));
const smokeSeconds = smokeArg ? Number(smokeArg.split('=')[1] ?? '8') || 8 : 0;

let win: BrowserWindow | null = null;
let a11y: AccessibilityShortcuts | null = null;
let poller: KeyPoller | null = null;
let disposed = false;

function disposeA11y(): void {
  if (disposed) return;
  disposed = true;
  poller?.stop();
  a11y?.dispose();
}

// 異常終了時もできる限り元に戻す
process.on('exit', disposeA11y);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'] as const) {
  process.on(sig, () => {
    disposeA11y();
    process.exit(0);
  });
}
process.on('uncaughtException', (err) => {
  console.error(err);
  disposeA11y();
  process.exit(1);
});

const STORE_NAMES = new Set(['settings', 'highscores', 'state']);

function storePath(name: string): string {
  return path.join(app.getPath('userData'), `${name}.json`);
}

function readStore(name: string): unknown {
  if (!STORE_NAMES.has(name)) return null;
  try {
    return JSON.parse(fs.readFileSync(storePath(name), 'utf8'));
  } catch {
    return null;
  }
}

function writeStore(name: string, data: unknown): boolean {
  if (!STORE_NAMES.has(name)) return false;
  const file = storePath(name);
  const tmp = `${file}.tmp`;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
    return true;
  } catch (e) {
    console.error('save failed', name, e);
    return false;
  }
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 560,
    backgroundColor: '#05060a',
    title: 'HANSODE PINBALL',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'dist', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win.setMenu(null);

  win.on('focus', () => {
    a11y?.disable();
    poller?.start();
  });
  win.on('blur', () => {
    // 他のアプリを使っている間はユーザー本来の設定に戻しておく
    poller?.stop();
    a11y?.restore();
  });
  win.on('enter-full-screen', () => win?.webContents.send('win:fullscreen', true));
  win.on('leave-full-screen', () => win?.webContents.send('win:fullscreen', false));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('render-process-gone', () => a11y?.restore());

  win.once('ready-to-show', () => {
    win?.show();
    win?.focus();
  });
  win.on('closed', () => {
    win = null;
  });

  if (devServerUrl) void win.loadURL(devServerUrl);
  else void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  if (smokeSeconds > 0) {
    // インストーラー確認用：数秒動かしてから状態を書き出して正常終了する
    setTimeout(() => {
      const result = { a11y: a11y?.status() ?? null, title: win?.getTitle(), time: Date.now() };
      try {
        fs.writeFileSync(path.join(app.getPath('userData'), 'smoke-result.json'), JSON.stringify(result, null, 2));
      } catch {
        /* noop */
      }
      app.quit();
    }, smokeSeconds * 1000);
  }
}

const gotLock = isE2E || smokeSeconds > 0 ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    a11y = new AccessibilityShortcuts(app.getPath('userData'));
    a11y.init();
    a11y.disable();
    poller = new KeyPoller((vk, down) => win?.webContents.send('keys:poll', vk, down));

    ipcMain.on('app:info', (e) => {
      e.returnValue = {
        isDev,
        e2e: isE2E,
        smoke: smokeSeconds > 0,
        version: app.getVersion(),
        platform: process.platform,
        keyPoll: poller?.supported ?? false,
      };
    });
    ipcMain.handle('storage:load', (_e, name: string) => readStore(name));
    ipcMain.handle('storage:save', (_e, name: string, data: unknown) => writeStore(name, data));
    ipcMain.handle('win:setFullscreen', (_e, on: boolean) => {
      win?.setFullScreen(!!on);
      return win?.isFullScreen() ?? false;
    });
    ipcMain.handle('win:isFullscreen', () => win?.isFullScreen() ?? false);
    ipcMain.handle('a11y:status', () => a11y?.status() ?? { supported: false, active: false });
    ipcMain.on('keys:watch', (_e, vks: number[]) => poller?.watch(Array.isArray(vks) ? vks : []));
    ipcMain.on('app:quit', () => app.quit());

    createWindow();
  });

  app.on('before-quit', disposeA11y);
  app.on('will-quit', disposeA11y);
  app.on('window-all-closed', () => {
    disposeA11y();
    app.quit();
  });
}
