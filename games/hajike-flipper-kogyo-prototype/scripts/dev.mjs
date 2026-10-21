// 開発用：Vite の開発サーバーを立ててから Electron をその URL で起動する
import { createServer } from 'vite';
import { spawn, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execSync('node scripts/make-icon.mjs', { cwd: root, stdio: 'inherit' });
execSync('npx tsc -p electron/tsconfig.json', { cwd: root, stdio: 'inherit' });
const server = await createServer({ root, configFile: join(root, 'vite.config.mts') });
await server.listen();
const url = server.resolvedUrls.local[0];
const child = spawn(electronPath, ['.'], { cwd: root, stdio: 'inherit', env: { ...process.env, VITE_DEV_SERVER_URL: url } });
child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
