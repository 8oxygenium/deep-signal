// Electron の preload が公開する API（window.hansode）。ブラウザ単体（開発・テスト）では代わりに localStorage を使う。

export interface A11yStatus {
  supported: boolean;
  active: boolean;
  error?: string;
}

export interface Bridge {
  info: { isDev: boolean; e2e: boolean; raf?: boolean; smoke: boolean; version: string; platform: string; keyPoll: boolean };
  load(name: string): Promise<unknown>;
  save(name: string, data: unknown): Promise<boolean>;
  quit(): void;
  setFullscreen(on: boolean): Promise<boolean>;
  isFullscreen(): Promise<boolean>;
  onFullscreenChange?(cb: (on: boolean) => void): void;
  a11yStatus(): Promise<A11yStatus>;
  watchKeys?(vks: number[]): void;
  onKeyPoll?(cb: (vk: number, down: boolean) => void): void;
}

declare global {
  interface Window {
    hansode?: Bridge;
  }
}

const fallback: Bridge = {
  info: { isDev: true, e2e: false, smoke: false, version: 'dev', platform: 'browser', keyPoll: false },
  async load(name) {
    try {
      const s = localStorage.getItem(`hajike-flipper-kogyo:${name}`);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  },
  async save(name, data) {
    try {
      localStorage.setItem(`hajike-flipper-kogyo:${name}`, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  },
  quit() {
    window.close();
  },
  async setFullscreen(on) {
    try {
      if (on) await document.documentElement.requestFullscreen();
      else if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* noop */
    }
    return !!document.fullscreenElement;
  },
  async isFullscreen() {
    return !!document.fullscreenElement;
  },
  async a11yStatus() {
    return { supported: false, active: false, error: 'ブラウザ版では使えません' };
  },
};

export const bridge: Bridge = (typeof window !== 'undefined' && window.hansode) || fallback;
