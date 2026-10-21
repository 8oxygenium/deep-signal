// ダウンロードページ確認用の最小の Electron 起動ファイル（ページを開くだけ）
const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
  const w = new BrowserWindow({ width: 1280, height: 900, show: true, webPreferences: { sandbox: true } });
  void w.loadURL(process.env.PAGE_URL);
});
