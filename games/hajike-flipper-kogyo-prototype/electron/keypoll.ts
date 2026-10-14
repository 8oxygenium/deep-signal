// Windows では左右Shiftを同時に押したまま片方を離すと、離した側の keyup が
// ブラウザに届かないことがある。フリッパーが上がりっぱなしになるのを防ぐため、
// メインプロセスで GetAsyncKeyState を数msごとに読み、変化をレンダラーへ送る（保険）。

type Getter = (vk: number) => number;

export class KeyPoller {
  private get: Getter | null = null;
  private watched: number[] = [];
  private state = new Map<number, boolean>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly send: (vk: number, down: boolean) => void) {
    if (process.platform !== 'win32') return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const koffi = require('koffi');
      const user32 = koffi.load('user32.dll');
      this.get = user32.func('__stdcall', 'GetAsyncKeyState', 'int16', ['int32']);
    } catch {
      this.get = null;
    }
  }

  get supported(): boolean {
    return this.get !== null;
  }

  watch(vks: number[]): void {
    this.watched = Array.from(new Set(vks.filter((v) => Number.isInteger(v) && v > 0 && v < 256)));
    this.state.clear();
  }

  start(): void {
    if (!this.get || this.timer) return;
    this.state.clear();
    this.timer = setInterval(() => this.poll(), 4);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.state.clear();
  }

  private poll(): void {
    const get = this.get;
    if (!get) return;
    for (const vk of this.watched) {
      const down = (get(vk) & 0x8000) !== 0;
      if (this.state.get(vk) !== down) {
        this.state.set(vk, down);
        this.send(vk, down);
      }
    }
  }
}
