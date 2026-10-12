// Windows の「固定キー」「フィルターキー」「切り替えキー」のショートカット（Shift 5回連打 /
// 右Shift 8秒長押し / NumLock 5秒長押し）をアプリ起動中だけ無効化する。
// Microsoft の「Disabling Shortcut Keys in Games」と同じ手法で、SystemParametersInfoW を
// fWinIni=0（レジストリへ保存しない）で呼ぶため、万一プロセスが落ちても次回ログオンで元に戻る。
// さらに元の値を userData にバックアップし、異常終了後の次回起動時にも復元する。
import * as fs from 'fs';
import * as path from 'path';

const SPI_GETFILTERKEYS = 0x0032;
const SPI_SETFILTERKEYS = 0x0033;
const SPI_GETTOGGLEKEYS = 0x0034;
const SPI_SETTOGGLEKEYS = 0x0035;
const SPI_GETSTICKYKEYS = 0x003a;
const SPI_SETSTICKYKEYS = 0x003b;

const FEATURE_ON = 0x1; // SKF_STICKYKEYSON / FKF_FILTERKEYSON / TKF_TOGGLEKEYSON
const HOTKEYACTIVE = 0x4;
const CONFIRMHOTKEY = 0x8;

export interface A11yFlags {
  sticky: number;
  filter: number;
  toggle: number;
}

export interface A11yStatus {
  supported: boolean;
  active: boolean;
  error?: string;
  original?: A11yFlags | null;
}

interface Api {
  getSticky(): number;
  setSticky(flags: number): boolean;
  getFilter(): FilterKeys;
  setFilter(fk: FilterKeys): boolean;
  getToggle(): number;
  setToggle(flags: number): boolean;
}

interface FilterKeys {
  cbSize: number;
  dwFlags: number;
  iWaitMSec: number;
  iDelayMSec: number;
  iRepeatMSec: number;
  iBounceMSec: number;
}

function loadApi(): Api {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  const STICKYKEYS = koffi.struct('HP_STICKYKEYS', { cbSize: 'uint32', dwFlags: 'uint32' });
  const TOGGLEKEYS = koffi.struct('HP_TOGGLEKEYS', { cbSize: 'uint32', dwFlags: 'uint32' });
  const FILTERKEYS = koffi.struct('HP_FILTERKEYS', {
    cbSize: 'uint32',
    dwFlags: 'uint32',
    iWaitMSec: 'uint32',
    iDelayMSec: 'uint32',
    iRepeatMSec: 'uint32',
    iBounceMSec: 'uint32',
  });
  const spiSticky = user32.func('__stdcall', 'SystemParametersInfoW', 'bool', ['uint32', 'uint32', koffi.inout(koffi.pointer(STICKYKEYS)), 'uint32']);
  const spiToggle = user32.func('__stdcall', 'SystemParametersInfoW', 'bool', ['uint32', 'uint32', koffi.inout(koffi.pointer(TOGGLEKEYS)), 'uint32']);
  const spiFilter = user32.func('__stdcall', 'SystemParametersInfoW', 'bool', ['uint32', 'uint32', koffi.inout(koffi.pointer(FILTERKEYS)), 'uint32']);

  return {
    getSticky() {
      const s = { cbSize: 8, dwFlags: 0 };
      if (!spiSticky(SPI_GETSTICKYKEYS, 8, s, 0)) throw new Error('SPI_GETSTICKYKEYS failed');
      return s.dwFlags >>> 0;
    },
    setSticky(flags) {
      return !!spiSticky(SPI_SETSTICKYKEYS, 8, { cbSize: 8, dwFlags: flags >>> 0 }, 0);
    },
    getToggle() {
      const s = { cbSize: 8, dwFlags: 0 };
      if (!spiToggle(SPI_GETTOGGLEKEYS, 8, s, 0)) throw new Error('SPI_GETTOGGLEKEYS failed');
      return s.dwFlags >>> 0;
    },
    setToggle(flags) {
      return !!spiToggle(SPI_SETTOGGLEKEYS, 8, { cbSize: 8, dwFlags: flags >>> 0 }, 0);
    },
    getFilter() {
      const s: FilterKeys = { cbSize: 24, dwFlags: 0, iWaitMSec: 0, iDelayMSec: 0, iRepeatMSec: 0, iBounceMSec: 0 };
      if (!spiFilter(SPI_GETFILTERKEYS, 24, s, 0)) throw new Error('SPI_GETFILTERKEYS failed');
      return s;
    },
    setFilter(fk) {
      return !!spiFilter(SPI_SETFILTERKEYS, 24, { ...fk, cbSize: 24 }, 0);
    },
  };
}

/** 機能そのものが ON のときはユーザーが使っているので触らない。OFF のときだけショートカットを止める。 */
function withoutHotkey(flags: number): number {
  if (flags & FEATURE_ON) return flags;
  return flags & ~(HOTKEYACTIVE | CONFIRMHOTKEY);
}

export class AccessibilityShortcuts {
  private api: Api | null = null;
  private original: A11yFlags | null = null;
  private originalFilter: FilterKeys | null = null;
  private disabled = false;
  private lastError: string | undefined;
  private readonly backupFile: string;

  constructor(userDataDir: string) {
    this.backupFile = path.join(userDataDir, 'a11y-backup.json');
    if (process.platform !== 'win32') {
      this.lastError = 'Windows以外では不要';
      return;
    }
    try {
      this.api = loadApi();
    } catch (e) {
      this.lastError = String(e);
      this.api = null;
    }
  }

  get supported(): boolean {
    return this.api !== null;
  }

  /** 起動時に呼ぶ。前回異常終了していたらバックアップから戻してから、現在値を記録する。 */
  init(): void {
    const api = this.api;
    if (!api) return;
    try {
      if (fs.existsSync(this.backupFile)) {
        const prev = JSON.parse(fs.readFileSync(this.backupFile, 'utf8')) as { flags: A11yFlags; filter: FilterKeys };
        api.setSticky(prev.flags.sticky);
        api.setToggle(prev.flags.toggle);
        api.setFilter(prev.filter);
      }
      const fk = api.getFilter();
      this.original = { sticky: api.getSticky(), filter: fk.dwFlags, toggle: api.getToggle() };
      this.originalFilter = fk;
      fs.mkdirSync(path.dirname(this.backupFile), { recursive: true });
      fs.writeFileSync(this.backupFile, JSON.stringify({ flags: this.original, filter: fk }));
    } catch (e) {
      this.lastError = String(e);
      this.original = null;
    }
  }

  disable(): void {
    const api = this.api;
    if (!api || !this.original || !this.originalFilter || this.disabled) return;
    try {
      const ok1 = api.setSticky(withoutHotkey(this.original.sticky));
      const ok2 = api.setToggle(withoutHotkey(this.original.toggle));
      const ok3 = api.setFilter({ ...this.originalFilter, dwFlags: withoutHotkey(this.originalFilter.dwFlags) });
      this.disabled = ok1 && ok2 && ok3;
      if (!this.disabled) this.lastError = 'SystemParametersInfoW の設定に失敗しました';
    } catch (e) {
      this.lastError = String(e);
    }
  }

  restore(): void {
    const api = this.api;
    if (!api || !this.original || !this.originalFilter || !this.disabled) return;
    try {
      api.setSticky(this.original.sticky);
      api.setToggle(this.original.toggle);
      api.setFilter(this.originalFilter);
    } catch (e) {
      this.lastError = String(e);
    }
    this.disabled = false;
  }

  /** 終了時。元に戻してバックアップを消す（同期処理なので exit ハンドラからも呼べる）。 */
  dispose(): void {
    this.restore();
    try {
      if (fs.existsSync(this.backupFile)) fs.unlinkSync(this.backupFile);
    } catch {
      /* noop */
    }
  }

  status(): A11yStatus {
    return {
      supported: this.supported && this.original !== null,
      active: this.disabled,
      error: this.lastError,
      original: this.original,
    };
  }
}
