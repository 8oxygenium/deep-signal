// キーボード・ゲームパッドの入力をまとめて「操作（アクション）」にする。
// - e.repeat（押しっぱなしの自動連打）は無視
// - 左右Shiftは e.code で区別。同時押しも両方動く
// - Windows で片方の Shift の keyup が届かない問題に備えて、メインプロセスの
//   GetAsyncKeyState の結果（keys:poll）でも状態を補正する
import { bridge } from './bridge';

export type GameAction = 'left' | 'right' | 'launch' | 'nudgeLeft' | 'nudgeRight' | 'nudgeUp' | 'pause';
export type UiAction = 'up' | 'down' | 'uiLeft' | 'uiRight' | 'ok' | 'back';
export type Action = GameAction | UiAction | 'fullscreen' | 'debug';

export type Bindings = Record<GameAction, string[]>;

export const DEFAULT_BINDINGS: Bindings = {
  left: ['ShiftLeft'],
  right: ['ShiftRight'],
  launch: ['Space', 'Enter'],
  nudgeLeft: ['KeyZ', 'ArrowLeft'],
  nudgeRight: ['Slash', 'ArrowRight'],
  nudgeUp: ['ArrowUp', 'KeyX'],
  pause: ['Escape'],
};

export const ACTION_LABEL: Record<GameAction, string> = {
  left: '左フリッパー',
  right: '右フリッパー',
  launch: 'ボール発射',
  nudgeLeft: '台を左から揺らす',
  nudgeRight: '台を右から揺らす',
  nudgeUp: '台を下から突き上げる',
  pause: 'ポーズ／メニュー',
};

const VK: Record<string, number> = {
  ShiftLeft: 0xa0, ShiftRight: 0xa1, ControlLeft: 0xa2, ControlRight: 0xa3, AltLeft: 0xa4, AltRight: 0xa5,
  Space: 0x20, Enter: 0x0d, Tab: 0x09, Backspace: 0x08, CapsLock: 0x14,
  ArrowLeft: 0x25, ArrowUp: 0x26, ArrowRight: 0x27, ArrowDown: 0x28,
  Slash: 0xbf, Period: 0xbe, Comma: 0xbc, Semicolon: 0xba, Quote: 0xde, BracketLeft: 0xdb, BracketRight: 0xdd,
  Backslash: 0xdc, Minus: 0xbd, Equal: 0xbb, Backquote: 0xc0, IntlRo: 0xc1, IntlYen: 0xdc,
};
for (let i = 0; i < 26; i++) VK[`Key${String.fromCharCode(65 + i)}`] = 0x41 + i;
for (let i = 0; i < 10; i++) {
  VK[`Digit${i}`] = 0x30 + i;
  VK[`Numpad${i}`] = 0x60 + i;
}

export function keyLabel(code: string): string {
  const map: Record<string, string> = {
    ShiftLeft: '左Shift', ShiftRight: '右Shift', ControlLeft: '左Ctrl', ControlRight: '右Ctrl', AltLeft: '左Alt', AltRight: '右Alt',
    Space: 'Space', Enter: 'Enter', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Slash: '/', Escape: 'Esc',
    Period: '.', Comma: ',', Semicolon: ';', Quote: "'", Backslash: '\\', IntlRo: '\\(ろ)', Minus: '-', Equal: '=',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

export type ActionHandler = (action: Action, down: boolean, source: 'key' | 'pad') => void;

export class Input {
  bindings: Bindings;
  private down = new Set<string>();
  private handler: ActionHandler = () => {};
  /** キー割り当て変更中：次に押したキーを渡す */
  private capture: ((code: string) => void) | null = null;
  /** 名前入力などで文字を受け取る */
  textHandler: ((e: KeyboardEvent) => boolean) | null = null;
  private padPrev = new Map<Action, boolean>();
  private padAxisPrev = { x: 0, y: 0 };
  private padIndex = -1;
  rumbleEnabled = true;
  /** ゲーム中か（ゲームパッドのスティックを揺らしに使うか、UI移動に使うか） */
  inGame = false;

  constructor(bindings: Bindings) {
    this.bindings = structuredClone(bindings);
    window.addEventListener('keydown', (e) => this.onKey(e, true), { capture: true });
    window.addEventListener('keyup', (e) => this.onKey(e, false), { capture: true });
    window.addEventListener('blur', () => this.releaseAll());
    bridge.onKeyPoll?.((vk, isDown) => this.onPoll(vk, isDown));
    this.updateWatch();
  }

  setHandler(h: ActionHandler): void {
    this.handler = h;
  }

  setBindings(b: Bindings): void {
    this.bindings = structuredClone(b);
    this.updateWatch();
  }

  captureNext(cb: (code: string) => void): void {
    this.capture = cb;
  }

  private updateWatch(): void {
    const vks = new Set<number>();
    for (const a of ['left', 'right', 'launch'] as GameAction[]) for (const code of this.bindings[a]) if (VK[code]) vks.add(VK[code]);
    bridge.watchKeys?.([...vks]);
  }

  private actionsFor(code: string): GameAction[] {
    const out: GameAction[] = [];
    for (const [a, codes] of Object.entries(this.bindings) as [GameAction, string[]][]) if (codes.includes(code)) out.push(a);
    return out;
  }

  private uiFor(code: string): UiAction | null {
    switch (code) {
      case 'ArrowUp':
        return 'up';
      case 'ArrowDown':
        return 'down';
      case 'ArrowLeft':
        return 'uiLeft';
      case 'ArrowRight':
        return 'uiRight';
      case 'Enter':
      case 'Space':
        return 'ok';
      case 'Escape':
      case 'Backspace':
        return 'back';
    }
    return null;
  }

  private onKey(e: KeyboardEvent, isDown: boolean): void {
    if (this.capture && isDown && !e.repeat) {
      e.preventDefault();
      e.stopPropagation();
      const cb = this.capture;
      this.capture = null;
      cb(e.code);
      return;
    }
    if (isDown && this.textHandler && this.textHandler(e)) {
      e.preventDefault();
      return;
    }
    if (e.code === 'F11') {
      e.preventDefault();
      if (isDown && !e.repeat) this.handler('fullscreen', true, 'key');
      return;
    }
    if (e.code === 'F2') {
      e.preventDefault();
      if (isDown && !e.repeat) this.handler('debug', true, 'key');
      return;
    }
    const acts = this.actionsFor(e.code);
    const ui = this.uiFor(e.code);
    if (acts.length || ui || e.code === 'Tab' || e.altKey) e.preventDefault();
    if (e.repeat) return;
    this.setKey(e.code, isDown);
  }

  private setKey(code: string, isDown: boolean): void {
    if (isDown === this.down.has(code)) return;
    if (isDown) this.down.add(code);
    else this.down.delete(code);
    for (const a of this.actionsFor(code)) {
      // 同じ操作に割り当てた別のキーがまだ押されていれば離さない
      if (!isDown && this.bindings[a].some((c) => this.down.has(c))) continue;
      this.handler(a, isDown, 'key');
    }
    const ui = this.uiFor(code);
    if (ui) this.handler(ui, isDown, 'key');
  }

  private onPoll(vk: number, isDown: boolean): void {
    // 補正は「離した」方向だけ（keyup の取りこぼし対策）。押した方向は keydown に任せる
    if (isDown || !document.hasFocus() || this.textHandler || this.capture || !this.inGame) return;
    for (const [code, v] of Object.entries(VK)) {
      if (v !== vk) continue;
      if (this.actionsFor(code).length === 0) continue;
      this.setKey(code, isDown);
    }
  }

  releaseAll(): void {
    for (const code of [...this.down]) this.setKey(code, false);
  }

  isDown(a: GameAction): boolean {
    return this.bindings[a].some((c) => this.down.has(c));
  }

  /** 毎フレーム：ゲームパッドを読む */
  pollGamepads(): void {
    const pads = navigator.getGamepads?.() ?? [];
    let pad: Gamepad | null = null;
    for (const p of pads) {
      if (p && p.connected) {
        pad = p;
        break;
      }
    }
    if (!pad) {
      // 切断：押されたままの操作を全部離す（フリッパーが上がりっぱなしにならないように）
      if (this.padIndex >= 0) {
        for (const [a, v] of this.padPrev) if (v) this.handler(a, false, 'pad');
        this.padPrev.clear();
        this.padAxisPrev = { x: 0, y: 0 };
      }
      this.padIndex = -1;
      return;
    }
    this.padIndex = pad.index;
    const btn = (i: number) => !!pad!.buttons[i]?.pressed || (pad!.buttons[i]?.value ?? 0) > 0.5;
    const map: [number, Action][] = [
      [4, 'left'],
      [6, 'left'],
      [5, 'right'],
      [7, 'right'],
      [0, 'launch'],
      [9, 'pause'],
      [12, 'up'],
      [13, 'down'],
      [14, 'uiLeft'],
      [15, 'uiRight'],
      [1, 'back'],
    ];
    const state = new Map<Action, boolean>();
    for (const [i, a] of map) state.set(a, (state.get(a) ?? false) || btn(i));
    state.set('ok', btn(0));
    for (const [a, v] of state) {
      const prev = this.padPrev.get(a) ?? false;
      if (v !== prev) {
        this.padPrev.set(a, v);
        this.handler(a, v, 'pad');
      }
    }
    // スティック：ゲーム中は揺らし、メニューでは移動
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    // ヒステリシス：0.65 で入り、0.4 を下回るまで戻らない（境目での連発を防ぐ）
    const stick = (v: number, prev: number) => (Math.abs(v) > 0.65 ? Math.sign(v) : prev !== 0 && Math.abs(v) > 0.4 ? prev : 0);
    const sx = stick(ax, this.padAxisPrev.x);
    const sy = stick(ay, this.padAxisPrev.y);
    if (sx !== this.padAxisPrev.x) {
      if (sx !== 0) {
        if (this.inGame) this.handler(sx < 0 ? 'nudgeLeft' : 'nudgeRight', true, 'pad');
        else this.handler(sx < 0 ? 'uiLeft' : 'uiRight', true, 'pad');
      }
      this.padAxisPrev.x = sx;
    }
    if (sy !== this.padAxisPrev.y) {
      if (sy !== 0) {
        if (this.inGame) {
          if (sy < 0) this.handler('nudgeUp', true, 'pad');
        } else this.handler(sy < 0 ? 'up' : 'down', true, 'pad');
      }
      this.padAxisPrev.y = sy;
    }
  }

  get hasPad(): boolean {
    return this.padIndex >= 0;
  }

  rumble(strong: number, weak: number, ms: number): void {
    if (!this.rumbleEnabled || this.padIndex < 0) return;
    const pad = navigator.getGamepads?.()[this.padIndex];
    const act = (pad as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, p: object) => Promise<unknown> } }) | null)?.vibrationActuator;
    act?.playEffect?.('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak) })?.catch(() => {});
  }
}
