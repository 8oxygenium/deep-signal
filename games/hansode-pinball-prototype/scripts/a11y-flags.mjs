// 固定キー/フィルターキーの「今のセッションの値」と「本来の値（レジストリ）」を読む（テスト用）
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);

export function sessionFlags() {
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  const SK = koffi.struct('A_STICKYKEYS', { cbSize: 'uint32', dwFlags: 'uint32' });
  const FK = koffi.struct('A_FILTERKEYS', { cbSize: 'uint32', dwFlags: 'uint32', a: 'uint32', b: 'uint32', c: 'uint32', d: 'uint32' });
  const spiSK = user32.func('__stdcall', 'SystemParametersInfoW', 'bool', ['uint32', 'uint32', koffi.inout(koffi.pointer(SK)), 'uint32']);
  const spiFK = user32.func('__stdcall', 'SystemParametersInfoW', 'bool', ['uint32', 'uint32', koffi.inout(koffi.pointer(FK)), 'uint32']);
  const s = { cbSize: 8, dwFlags: 0 };
  spiSK(0x3a, 8, s, 0);
  const f = { cbSize: 24, dwFlags: 0, a: 0, b: 0, c: 0, d: 0 };
  spiFK(0x32, 24, f, 0);
  return { sticky: s.dwFlags >>> 0, filter: f.dwFlags >>> 0 };
}

export function registryFlags() {
  const q = (sub) =>
    Number(spawnSync('powershell', ['-NoProfile', '-Command', `(Get-ItemProperty 'HKCU:\\Control Panel\\Accessibility\\${sub}').Flags`], { encoding: 'utf8' }).stdout.trim());
  return { sticky: q('StickyKeys'), filter: q('Keyboard Response') };
}
