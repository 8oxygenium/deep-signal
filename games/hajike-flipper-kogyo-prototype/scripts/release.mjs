// npm run release：ビルド → インストーラー作成 →（gh がログイン済みなら）GitHub Releases へアップロード
// exe はサイト（Cloudflare Pages）には置かず、GitHub の公開リポジトリの Releases に置く。
// ダウンロードリンクは常に最新版：https://github.com/<OWNER>/<REPO>/releases/latest/download/Hajike-Flipper-Kogyo-Setup.exe
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OWNER = process.env.RELEASE_OWNER ?? '8oxygenium';
const REPO = process.env.RELEASE_REPO ?? 'hajike-flipper-kogyo';
const EXE = join(root, 'release', 'Hajike-Flipper-Kogyo-Setup.exe');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const tag = `v${pkg.version}`;

const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
// gh の場所：PATH にあればそれ、無ければ標準のインストール先（入れた直後で PATH が古いままのとき用）。
// シェルを通さずに直接起動する（シェル経由だと空白を含む引数が分割されてしまう）
function findGh() {
  if (process.platform !== 'win32') return 'gh';
  const w = spawnSync('where', ['gh'], { encoding: 'utf8' });
  const hit = w.status === 0 ? w.stdout.split(/\r?\n/).find((l) => l.trim().toLowerCase().endsWith('.exe')) : null;
  if (hit) return hit.trim();
  for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs')]) {
    if (base && existsSync(join(base, 'GitHub CLI', 'gh.exe'))) return join(base, 'GitHub CLI', 'gh.exe');
  }
  return 'gh';
}
const GH = findGh();
const gh = (args, opts = {}) => spawnSync(GH, args, { cwd: root, encoding: 'utf8', ...opts });

console.log('■ 1/3 ビルドとインストーラー作成');
if (!process.argv.includes('--skip-build')) run('npm run dist');
if (!existsSync(EXE)) {
  console.error('インストーラーができていません:', EXE);
  process.exit(1);
}
const mb = (statSync(EXE).size / 1024 / 1024).toFixed(1);
console.log(`  → ${EXE}（${mb} MB）`);

console.log('■ 2/3 GitHub CLI（gh）の確認');
const ver = gh(['--version']);
if (ver.status !== 0) {
  console.log('  gh が見つかりません。アップロードは「リリース手順.md」の手順で行ってください。');
  console.log(`  （作成済みのインストーラー：${EXE}）`);
  process.exit(0);
}
const auth = gh(['auth', 'status']);
if (auth.status !== 0) {
  console.log('  gh にログインしていません。`gh auth login` の後でもう一度 `npm run release` を実行するか、「リリース手順.md」の手順で手動アップロードしてください。');
  process.exit(0);
}

console.log(`■ 3/3 GitHub Releases へアップロード（${OWNER}/${REPO} ${tag}）`);
if (gh(['repo', 'view', `${OWNER}/${REPO}`]).status !== 0) {
  console.log('  公開リポジトリを作成します');
  const r = gh(['repo', 'create', `${OWNER}/${REPO}`, '--public', '--add-readme', '--description', '弾け！フリッパー興業（Hajike! Flipper Kogyo）- 7演目の3Dピンボール（Windows版インストーラーの配布用）'], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
const exists = gh(['release', 'view', tag, '-R', `${OWNER}/${REPO}`]).status === 0;
const r = exists
  ? gh(['release', 'upload', tag, EXE, '--clobber', '-R', `${OWNER}/${REPO}`], { stdio: 'inherit' })
  : gh(
      ['release', 'create', tag, EXE, '-R', `${OWNER}/${REPO}`, '--title', `弾け！フリッパー興業 ${tag}`, '--notes', `Windows 10/11 用インストーラー（${mb} MB）。初回に警告が出たら「詳細情報」→「実行」で起動できます。`, '--latest'],
      { stdio: 'inherit' },
    );
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(`\n完了：https://github.com/${OWNER}/${REPO}/releases/latest/download/Hajike-Flipper-Kogyo-Setup.exe`);
