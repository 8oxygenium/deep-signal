// プレイ中の表示：上部のドットマトリクス（またはスコアリール）、左右のパネル、演出用の帯
import type { Game, GameEvent, MsgStyle } from '../core/game';
import { keyLabel, type Bindings } from '../core/input';
import type { StageDef } from '../stages/types';
import { Dmd, DMD_H, DMD_W, fmt } from './dmd';

interface Msg {
  text: string;
  sub: string;
  time: number;
  style: MsgStyle;
  age: number;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

/** 機械式スコアリール（ROUTE 50s） */
class Reels {
  readonly root = el('div', 'reels');
  private drums: HTMLElement[] = [];
  private shown: number[] = [];
  constructor(n = 8) {
    for (let i = 0; i < n; i++) {
      const win = el('div', 'reel');
      const strip = el('div', 'reel-strip');
      for (let d = 0; d <= 10; d++) strip.appendChild(el('span', '', String(d % 10)));
      win.appendChild(strip);
      this.root.appendChild(win);
      this.drums.push(strip);
      this.shown.push(0);
    }
  }
  set(value: number): void {
    const s = Math.floor(value).toString().padStart(this.drums.length, '0').slice(-this.drums.length);
    for (let i = 0; i < this.drums.length; i++) {
      const d = Number(s[i]);
      if (d === this.shown[i]) continue;
      const strip = this.drums[i];
      if (d === 0 && this.shown[i] === 9) {
        // 9→0 は一周させる
        strip.style.transition = 'transform 0.18s ease-in';
        strip.style.transform = `translateY(-${(10 * 100) / 11}%)`;
        window.setTimeout(() => {
          strip.style.transition = 'none';
          strip.style.transform = 'translateY(0)';
        }, 190);
      } else {
        strip.style.transition = 'transform 0.18s ease-in';
        strip.style.transform = `translateY(-${(d * 100) / 11}%)`;
      }
      this.shown[i] = d;
    }
  }
}

export class Hud {
  readonly root = el('div', 'hud hidden');
  private dmd = new Dmd();
  private reels: Reels | null = null;
  private top = el('div', 'hud-top');
  private display = el('div', 'hud-display');
  private sub = el('div', 'hud-sub');
  private left = el('div', 'hud-panel hud-left');
  private right = el('div', 'hud-panel hud-right');
  private gauge = el('div', 'plunger-gauge');
  private gaugeFill = el('div', 'fill');
  private gaugeSweet = el('div', 'sweet');
  private banner = el('div', 'hud-banner');
  private cutin = el('div', 'cutin');
  private gimmick = el('div', 'gimmick');
  private msgs: Msg[] = [];
  private game: Game | null = null;
  private stage: StageDef | null = null;
  private displayScore = 0;
  private t = 0;
  private dmdAcc = 0;
  private bonusIndex = -1;
  private bonusShown = 0;
  private lastLeft = '';
  private lastRight = '';
  private unsub: (() => void) | null = null;
  bindings: Bindings | null = null;

  constructor(parent: HTMLElement) {
    this.display.appendChild(this.dmd.canvas);
    this.top.append(this.display, this.sub);
    this.root.append(this.top, this.left, this.right, this.gauge, this.banner, this.cutin, this.gimmick);
    this.gauge.append(this.gaugeSweet, this.gaugeFill, el('span', 'label', '発射'));
    parent.appendChild(this.root);
  }

  setPaused(on: boolean): void {
    this.root.classList.toggle('paused', on);
  }

  show(on: boolean): void {
    this.root.classList.toggle('hidden', !on);
  }

  setGame(game: Game): void {
    this.unsub?.();
    this.game = game;
    this.stage = game.stage;
    this.msgs = [];
    this.displayScore = 0;
    this.bonusIndex = -1;
    const st = game.stage;
    this.root.dataset.style = st.theme.style;
    this.root.style.setProperty('--dmd', st.theme.colors.dmd);
    this.root.style.setProperty('--accent', st.theme.colors.accent);
    this.root.style.setProperty('--accent2', st.theme.colors.accent2);
    this.dmd.setColor(st.theme.colors.dmd);
    this.display.innerHTML = '';
    if (st.theme.scoreDisplay === 'reels') {
      this.reels = new Reels(8);
      const box = el('div', 'reel-box');
      box.append(el('div', 'reel-title', st.name), this.reels.root);
      this.display.appendChild(box);
      this.display.appendChild(this.dmd.canvas);
      this.dmd.canvas.classList.add('small');
    } else {
      this.reels = null;
      this.dmd.canvas.classList.remove('small');
      this.display.appendChild(this.dmd.canvas);
    }
    this.lastLeft = '';
    this.lastRight = '';
    this.unsub = game.on((e) => this.onEvent(e));
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const target = Math.min(w * 0.42, h * 0.95, 620);
    this.dmd.setPitch(Math.max(2, Math.floor(target / DMD_W)));
  }

  /** 上部の表示が画面の高さに占める割合（カメラがその下に台を収める） */
  get topFraction(): number {
    const r = this.top.getBoundingClientRect();
    return Math.min(0.3, (r.bottom + 6) / Math.max(1, window.innerHeight));
  }

  private onEvent(e: GameEvent): void {
    switch (e.t) {
      case 'msg':
        this.msgs.push({ text: e.text, sub: e.sub, time: e.time, style: e.style, age: 0 });
        if (this.msgs.length > 4) this.msgs.shift();
        if (e.style === 'big') this.showBanner(e.text, e.sub);
        break;
      case 'fx':
        if (e.name === 'cutin') this.showCutin(e.text ?? '', e.color);
        break;
      case 'gimmick':
        this.showGimmick(e.text, e.sub, e.phase);
        break;
      case 'bonus':
        this.bonusIndex = -1;
        this.bonusShown = 0;
        break;
      case 'bonus-line':
        this.bonusIndex = e.index;
        break;
      case 'ball-start':
        this.bonusIndex = -1;
        break;
    }
  }

  showBanner(text: string, sub: string): void {
    this.banner.innerHTML = `<div class="t">${esc(text)}</div><div class="s">${esc(sub)}</div>`;
    this.banner.classList.remove('on');
    void this.banner.offsetWidth;
    this.banner.classList.add('on');
  }

  showCutin(text: string, color?: string): void {
    // 長い技名でも画面からはみ出さないように文字の大きさを自動で決める
    const n = Math.max(4, [...text].length);
    const size = `min(${(78 / n).toFixed(2)}vw, 8vw, 110px)`;
    this.cutin.innerHTML = `<div class="band"><span style="font-size:${size}">${esc(text)}</span></div><div class="band b2"><span>${esc(text)}</span></div>`;
    if (color) this.cutin.style.setProperty('--cut', color);
    this.cutin.classList.remove('on');
    void this.cutin.offsetWidth;
    this.cutin.classList.add('on');
  }

  showGimmick(text: string, sub: string, phase: 'warn' | 'start' | 'end'): void {
    if (phase === 'end') {
      this.gimmick.classList.remove('on');
      return;
    }
    this.gimmick.innerHTML = `<div class="stripe"></div><div class="t">${phase === 'warn' ? '⚠ 予告 ⚠' : '発動！'}</div><div class="big">${esc(text)}</div><div class="s">${esc(sub)}</div><div class="stripe"></div>`;
    this.gimmick.classList.remove('on');
    void this.gimmick.offsetWidth;
    this.gimmick.classList.add('on');
    this.gimmick.classList.toggle('warn', phase === 'warn');
  }

  update(dt: number): void {
    const g = this.game;
    if (!g) return;
    this.t += dt;
    for (const m of this.msgs) m.age += dt;
    this.msgs = this.msgs.filter((m) => m.age < m.time);
    // スコアは少しずつ追いつく（パタパタ加算）
    const diff = g.score - this.displayScore;
    this.displayScore += diff > 0 ? Math.max(1, diff * Math.min(1, dt * 8)) : diff;
    if (Math.abs(g.score - this.displayScore) < 1) this.displayScore = g.score;
    this.reels?.set(this.displayScore);

    this.dmdAcc += dt;
    if (this.dmdAcc >= 1 / 30) {
      this.dmdAcc = 0;
      this.drawDmd(g);
    }

    const msg = this.msgs[this.msgs.length - 1];
    const subText = msg?.sub || (g.state === 'bonus' ? 'ボーナス集計中' : g.hud.missionSub);
    if (this.sub.textContent !== subText) this.sub.textContent = subText;

    this.updatePanels(g);

    // 発射ゲージ
    const inLane = g.ballInLane && g.state === 'play';
    this.gauge.classList.toggle('on', inLane);
    if (inLane) {
      this.gaugeFill.style.height = `${(g.plungerPull * 100).toFixed(1)}%`;
      const [a, b] = g.skillWindow;
      this.gaugeSweet.style.bottom = `${a * 100}%`;
      this.gaugeSweet.style.height = `${(b - a) * 100}%`;
      this.gaugeSweet.classList.toggle('hidden', !g.skillShotReady || g.launchedThisBall);
    }
  }

  private updatePanels(g: Game): void {
    const st = this.stage!;
    const rank = st.ranks[g.rank] ?? '';
    const left =
      `<div class="stage-name">${esc(st.name)}<small>${esc(st.subtitle)}</small></div>` +
      `<div class="row"><span>ランク</span><b>${esc(rank)}</b></div>` +
      `<div class="mission"><div class="mt">${esc(g.hud.mission || '—')}</div><div class="ms">${esc(g.hud.missionSub)}</div>${g.hud.progress ? `<div class="mp">${esc(g.hud.progress)}</div>` : ''}</div>` +
      (g.hud.extra ? `<div class="extra">${g.hud.extra}</div>` : '');
    if (left !== this.lastLeft) {
      this.left.innerHTML = left;
      this.lastLeft = left;
    }
    const b = this.bindings;
    const k = (a: keyof Bindings) => (b ? b[a].map(keyLabel).slice(0, 2).join(' / ') : '');
    const tiltDots = [0, 1].map((i) => `<i class="${i < g.tiltWarnings ? 'on' : ''}"></i>`).join('');
    const save = g.ballSaveTimer > 0 && g.state === 'play';
    const right =
      `<div class="row big"><span>ボール</span><b>${Math.min(g.ball, g.ballsPerGame)} / ${g.ballsPerGame}</b></div>` +
      `<div class="row"><span>倍率</span><b>x${g.pfMult}${g.bonusMult > 1 ? ` <small>ボーナスx${g.bonusMult}</small>` : ''}</b></div>` +
      (g.extraBalls > 0 ? `<div class="lamp on">SHOOT AGAIN</div>` : '') +
      `<div class="lamp ${save ? 'on blink' : ''}">BALL SAVE</div>` +
      `<div class="row tilt"><span>揺らし</span><span class="dots">${tiltDots}</span>${g.tilted ? '<b class="tilted">TILT</b>' : ''}</div>` +
      (st.survival ? `<div class="row big"><span>生存時間</span><b>${g.survival.toFixed(1)}秒</b></div>` : '') +
      `<div class="keys"><div><kbd>${k('left')}</kbd><kbd>${k('right')}</kbd> フリッパー</div><div><kbd>${k('launch')}</kbd> 長押しで発射</div><div><kbd>${k('nudgeLeft')}</kbd><kbd>${k('nudgeRight')}</kbd><kbd>${k('nudgeUp')}</kbd> 揺らす</div><div><kbd>${k('pause')}</kbd> ポーズ</div></div>`;
    if (right !== this.lastRight) {
      this.right.innerHTML = right;
      this.lastRight = right;
    }
  }

  private drawDmd(g: Game): void {
    const d = this.dmd;
    d.clear();
    const msg = this.msgs[this.msgs.length - 1];
    if (g.state === 'bonus') {
      d.text('BONUS', DMD_W / 2, 1, 1, 'center');
      const lines = g.bonusLines;
      const i = Math.min(this.bonusIndex, lines.length - 1);
      if (i >= 0 && lines[i]) {
        const l = lines[i];
        d.fitText(`${l.label} ${l.count} x ${fmt(l.each)}`, 12, 2);
        let sum = 0;
        for (let k = 0; k <= i; k++) sum += lines[k].count * lines[k].each;
        this.bonusShown = sum * g.bonusMult;
      } else if (lines.length === 0) {
        d.fitText(g.tilted ? 'TILT - NO BONUS' : 'NO BONUS', 14, 2);
      }
      d.text(`${g.bonusMult > 1 ? `x${g.bonusMult}  ` : ''}TOTAL ${fmt(this.bonusShown)}`, DMD_W / 2, 34, 1, 'center');
    } else if (msg) {
      const on = msg.style !== 'flash' || Math.floor(msg.age * 8) % 2 === 0;
      const v = on ? 1 : 0.25;
      if (msg.style === 'big' || msg.style === 'flash') {
        // 枠のアニメーション
        const k = Math.floor(this.t * 20) % 8;
        for (let x = 0; x < DMD_W; x += 4) {
          d.dot(x + k / 2, 0, 0.6);
          d.dot(DMD_W - 1 - x - k / 2, DMD_H - 1, 0.6);
        }
        d.fitText(msg.text, 12, 3, v);
      } else {
        d.fitText(msg.text, 8, 2, v);
        d.text(fmt(this.displayScore), DMD_W / 2, 30, 1, 'center', 0.6);
      }
    } else if (this.reels) {
      // ROUTE 50s：上の小さい表示はミッション
      d.text(`BALL ${Math.min(g.ball, g.ballsPerGame)}`, 2, 2, 1);
      d.text(`x${g.pfMult}`, DMD_W - 2, 2, 1, 'right');
      d.fitText(g.hud.mission || this.stage!.name, 15, 2);
      if (g.hud.progress) d.text(g.hud.progress, DMD_W / 2, 34, 1, 'center');
    } else {
      d.text(`BALL ${Math.min(g.ball, g.ballsPerGame)}`, 2, 1, 1);
      d.text(`x${g.pfMult}`, DMD_W - 2, 1, 1, 'right');
      if (g.ballSaveTimer > 0 && g.state === 'play' && Math.floor(this.t * 3) % 2 === 0) d.text('SAVE', DMD_W / 2, 1, 1, 'center', 0.7);
      if (g.stage.survival) d.text(`${g.survival.toFixed(1)}S`, DMD_W / 2, 1, 1, 'center');
      const s = fmt(this.displayScore);
      d.fitText(s, 10, 3);
      const m = g.hud.mission ? `${g.hud.mission}${g.hud.progress ? ` ${g.hud.progress}` : ''}` : '';
      if (m) {
        const w = d.textWidth(m.toUpperCase());
        if (w > DMD_W - 4) {
          const off = Math.floor(this.t * 30) % (w + DMD_W);
          d.text(m, DMD_W - off, 36, 1, 'left', 0.8);
        } else d.text(m, DMD_W / 2, 36, 1, 'center', 0.8);
      }
    }
    d.present();
  }
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
