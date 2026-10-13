// メニュー画面（DOM）。キーボード・ゲームパッド・マウスのどれでも操作できる。
import type { A11yStatus } from '../core/bridge';
import { ACTION_LABEL, DEFAULT_BINDINGS, keyLabel, type Action, type Bindings, type GameAction } from '../core/input';
import type { HighScores, ScoreEntry, Settings } from '../core/storage';
import type { StageDef } from '../stages/types';
import { fmt } from './dmd';
import { esc } from './hud';
import { kanjiNumber } from './kanji';
import { lantern, nobori } from './kogyo';

export interface ScreenCtl {
  el: HTMLElement;
  onAction(a: Action): void;
  update?(dt: number): void;
  destroy?(): void;
  /** 外から設定が変わったとき（F11 など） */
  refresh?(s: Settings): void;
}

export interface UiSound {
  (name: 'uiMove' | 'uiOk' | 'uiBack' | 'ominous'): void;
}

function h(html: string): HTMLElement {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild as HTMLElement;
}

/** 縦に並んだボタンの共通処理 */
class MenuList {
  index = 0;
  constructor(
    private readonly items: HTMLElement[],
    private readonly sound: UiSound,
    private readonly onPick: (i: number) => void,
    private readonly onFocus?: (i: number) => void,
  ) {
    items.forEach((it, i) => {
      // 実際にマウスを動かしたときだけ（画面が出た瞬間にカーソル下へ移らないように）
      it.addEventListener('mousemove', (e) => {
        if ((e.movementX || e.movementY) && this.index !== i) this.focus(i);
      });
      it.addEventListener('click', () => {
        this.focus(i);
        this.sound('uiOk');
        this.onPick(i);
      });
    });
    this.focus(0, true);
  }
  focus(i: number, silent = false): void {
    const n = this.items.length;
    const next = ((i % n) + n) % n;
    if (next !== this.index && !silent) this.sound('uiMove');
    this.index = next;
    this.items.forEach((it, k) => it.classList.toggle('focus', k === this.index));
    this.items[this.index]?.scrollIntoView?.({ block: 'nearest' });
    this.onFocus?.(this.index);
  }
  move(d: number): void {
    this.focus(this.index + d);
  }
  pick(): void {
    this.sound('uiOk');
    this.onPick(this.index);
  }
}

// ───────── タイトル（見世物小屋の呼び込み） ─────────

/** 口上（呼び込み）。順番に1行ずつ、1文字ずつ押し出すように出す（CSS だけで繰り返す） */
const KOUJOU = [
  'さあさあ、寄ってらっしゃい見てらっしゃい！',
  '世にも不思議な鉄の玉、弾けて跳ねての大立ち回り！',
  '本日の演目は七つ。とくとご覧あれ！',
  'お代は見てのお帰り…いえいえ、タダでございます！',
];
const KOUJOU_SLOT = 4.6;

function koujouHtml(): string {
  const period = KOUJOU.length * KOUJOU_SLOT;
  return KOUJOU.map(
    (line, i) =>
      `<div class="kj-line">${[...line]
        .map((c, k) => `<span style="animation-duration:${period}s;animation-delay:${(i * KOUJOU_SLOT + k * 0.03).toFixed(2)}s">${esc(c)}</span>`)
        .join('')}</div>`,
  ).join('');
}

export function titleScreen(version: string, sound: UiSound, on: { start(): void; settings(): void; guide(): void; quit(): void }): ScreenCtl {
  const lanterns = [
    lantern('大入', '#d8261c'),
    lantern('興', '#f2e9d8', '#b3121a'),
    lantern('弾', '#d8261c'),
    lantern('祭', '#f2e9d8', '#b3121a'),
    lantern('鉄', '#d8261c'),
    lantern('球', '#f2e9d8', '#b3121a'),
    lantern('満員', '#d8261c'),
  ]
    .map((l, i) => l.replace('class="lantern"', `class="lantern" data-i="${i}"`))
    .join('');
  const el = h(`<div class="screen title kogyo">
    <div class="tt-shade"></div>
    <div class="tt-rope">${lanterns}</div>
    <div class="tt-side l">${nobori('千客万来', '#b3121a', '#fff8e8', '#f2c94c', 0)}${nobori('弾け！鉄球', '#f4ead2', '#1f2f6b', '#b3121a', 0.7)}</div>
    <div class="tt-side r">${nobori('大入満員', '#1f2f6b', '#fff8e8', '#f2c94c', 0.35)}${nobori('七番勝負', '#f4ead2', '#b3121a', '#1f2f6b', 1.1)}</div>
    <div class="tt-center">
      <div class="tt-ribbon">見世物小屋　フリッパー一座　本日開演</div>
      <div class="tt-sign">
        <div class="logo"><span class="hj">弾け！</span><span class="fk">フリッパー興業</span></div>
        <div class="en">Hajike! Flipper Kogyo</div>
      </div>
      <div class="koujou">${koujouHtml()}</div>
      <div class="menu">
        <button>演目をえらぶ</button>
        <button>設定</button>
        <button>固定キーの案内</button>
        <button>終了</button>
      </div>
      <div class="press">Space / Enter / Aボタン で決定</div>
    </div>
    <div class="ver">v${esc(version)}</div>
  </div>`);
  const items = [...el.querySelectorAll('button')] as HTMLElement[];
  const menu = new MenuList(items, sound, (i) => [on.start, on.settings, on.guide, on.quit][i]());
  return {
    el,
    onAction(a) {
      if (a === 'up' || a === 'uiLeft') menu.move(-1);
      else if (a === 'down' || a === 'uiRight') menu.move(1);
      else if (a === 'ok' || a === 'launch') menu.pick();
    },
  };
}

// ───────── ステージ選択（本日の演目：まねき看板） ─────────

export function stars(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export function selectScreen(
  stages: StageDef[],
  scores: HighScores,
  initial: number,
  sound: UiSound,
  on: { focus(i: number): void; pick(i: number): void; back(): void },
): ScreenCtl {
  const boards = stages
    .map((s, i) => {
      const best = scores[s.id]?.[0];
      // 縦書き。列（改行）ごとの字数と列の数から、看板に収まる文字の大きさを決める
      const cols = (s.maneki ?? s.subtitle).split('\n');
      const longest = Math.max(3, ...cols.map((c) => [...c].length));
      const size = `min(${(21.5 / longest).toFixed(2)}vh, ${(8.6 / cols.length).toFixed(2)}vw, 46px)`;
      return `<div class="maneki ${s.ominous ? 'ominous' : ''}" style="--c:${s.theme.colors.accent}">
        <div class="mk-lamp">${lantern(kanjiNumber(i + 1), s.ominous ? '#2a2a2a' : '#d8261c', s.ominous ? '#ffcc00' : '#1a0d08')}</div>
        <div class="mk-roof"></div>
        <div class="mk-board">
          <div class="mk-no">${kanjiNumber(i + 1)}番</div>
          <div class="mk-jp" style="font-size:${size}">${esc(s.maneki ?? s.subtitle)}</div>
          <div class="mk-en">${esc(s.name)}</div>
        </div>
        <div class="mk-best">${best ? `${fmt(best.score)}${s.survival && best.time !== undefined ? `<br>${best.time.toFixed(1)}秒` : ''}` : '---'}</div>
      </div>`;
    })
    .join('');
  const el = h(`<div class="screen select kogyo">
    <div class="sel-top">
      <div class="sel-head"><span class="lt">本日の演目</span><span class="en">TODAY'S PROGRAM</span></div>
      <div class="maneki-row">${boards}</div>
    </div>
    <div class="sel-bottom">
      <div class="detail"></div>
      <div class="preview-slot"></div>
    </div>
    <div class="hint">←→ 選ぶ　Enter 開演　Esc 戻る</div>
    <div class="ominous-fx"></div>
  </div>`);
  const detail = el.querySelector('.detail') as HTMLElement;
  const items = [...el.querySelectorAll('.maneki')] as HTMLElement[];
  const showDetail = (i: number) => {
    const s = stages[i];
    const list = scores[s.id] ?? [];
    const top = list
      .slice(0, 3)
      .map((e, k) => `<li><span>${k + 1}</span><b>${esc(e.name)}</b><em>${fmt(e.score)}${s.survival && e.time !== undefined ? ` <small>${e.time.toFixed(1)}秒</small>` : ''}</em></li>`)
      .join('');
    detail.style.setProperty('--c', s.theme.colors.accent);
    detail.innerHTML = `<div class="dno">第${kanjiNumber(i + 1)}番</div><div class="dn">${esc(s.subtitle)}<small>${esc(s.name)}</small></div>
      <div class="dt">${esc(s.tagline)}</div><p>${esc(s.description)}</p>
      <div class="dd">難しさ <span class="stars">${stars(s.difficulty)}</span>　ボールセーブ ${s.ballSave}秒</div>
      <ol class="top3">${top || '<li class="none">まだ記録がありません</li>'}</ol>
      <div class="go">Enter で開演</div>`;
    el.classList.toggle('is-ominous', !!s.ominous);
    if (s.ominous) {
      sound('ominous');
      el.classList.remove('shock');
      void el.offsetWidth;
      el.classList.add('shock');
    }
    on.focus(i);
  };
  const menu = new MenuList(items, sound, (i) => on.pick(i), showDetail);
  menu.focus(initial, true);
  return {
    el,
    onAction(a) {
      if (a === 'up' || a === 'uiLeft') menu.move(-1);
      else if (a === 'down' || a === 'uiRight') menu.move(1);
      else if (a === 'ok' || a === 'launch') menu.pick();
      else if (a === 'back' || a === 'pause') {
        sound('uiBack');
        on.back();
      }
    },
  };
}

// ───────── 設定 ─────────

type Row =
  | { kind: 'slider'; key: 'bgm' | 'sfx' | 'shake'; label: string }
  | { kind: 'choice'; key: 'camera' | 'quality' | 'fullscreen' | 'rumble'; label: string; options: [unknown, string][] }
  | { kind: 'bind'; action: GameAction }
  | { kind: 'button'; label: string; run(): void };

export function settingsScreen(
  settings: Settings,
  sound: UiSound,
  capture: (cb: (code: string) => void) => void,
  on: { change(s: Settings): void; guide(): void; back(): void },
): ScreenCtl {
  const s = structuredClone(settings);
  const rows: Row[] = [
    { kind: 'slider', key: 'bgm', label: 'BGMの音量' },
    { kind: 'slider', key: 'sfx', label: '効果音の音量' },
    { kind: 'slider', key: 'shake', label: '画面揺れ' },
    { kind: 'choice', key: 'camera', label: 'カメラ視点', options: [['fixed', '固定（斜め上）'], ['follow', 'ボール追従'], ['top', '真上']] },
    { kind: 'choice', key: 'quality', label: '画質', options: [['low', '低'], ['mid', '中'], ['high', '高']] },
    { kind: 'choice', key: 'fullscreen', label: '表示', options: [[false, 'ウィンドウ'], [true, 'フルスクリーン']] },
    { kind: 'choice', key: 'rumble', label: 'コントローラーの振動', options: [[true, 'オン'], [false, 'オフ']] },
    ...(Object.keys(ACTION_LABEL) as GameAction[]).map((a) => ({ kind: 'bind' as const, action: a })),
    {
      kind: 'button',
      label: 'キー割り当てを最初に戻す',
      run: () => {
        s.bindings = structuredClone(DEFAULT_BINDINGS);
        commit();
      },
    },
    { kind: 'button', label: '固定キーの案内を見る', run: () => on.guide() },
    { kind: 'button', label: '戻る', run: () => on.back() },
  ];
  const el = h(`<div class="screen settings"><h2>設定</h2><div class="rows"></div><div class="hint">↑↓ 選ぶ　←→ 変更　Enter キー割り当て／決定　Esc 戻る</div></div>`);
  const box = el.querySelector('.rows') as HTMLElement;
  let capturing = false;

  const valueHtml = (r: Row): string => {
    switch (r.kind) {
      case 'slider': {
        const v = Math.round(s[r.key] * 100);
        return `<span class="bar"><i style="width:${v}%"></i></span><span class="num">${r.key === 'shake' && v === 0 ? 'オフ' : `${v}%`}</span>`;
      }
      case 'choice':
        return r.options.map(([v, l]) => `<span class="opt ${s[r.key] === v ? 'sel' : ''}">${esc(l)}</span>`).join('');
      case 'bind':
        return s.bindings[r.action].map((c) => `<kbd>${esc(keyLabel(c))}</kbd>`).join(' ');
      case 'button':
        return '';
    }
  };
  const labelOf = (r: Row) => (r.kind === 'bind' ? ACTION_LABEL[r.action] : r.label);
  const els = rows.map((r) => {
    const e = h(`<div class="row ${r.kind}"><span class="lb">${esc(labelOf(r))}</span><span class="val"></span></div>`);
    box.appendChild(e);
    return e;
  });
  const render = () => rows.forEach((r, i) => ((els[i].querySelector('.val') as HTMLElement).innerHTML = valueHtml(r)));
  const commit = () => {
    render();
    on.change(structuredClone(s));
  };
  const change = (r: Row, d: number) => {
    if (r.kind === 'slider') {
      s[r.key] = Math.min(1, Math.max(0, Math.round((s[r.key] + d * 0.1) * 10) / 10));
    } else if (r.kind === 'choice') {
      const i = r.options.findIndex(([v]) => v === s[r.key]);
      const n = r.options.length;
      (s as unknown as Record<string, unknown>)[r.key] = r.options[(((i + d) % n) + n) % n][0];
    } else return;
    sound('uiMove');
    commit();
  };
  const startCapture = (r: Row & { kind: 'bind' }, rowEl: HTMLElement) => {
    capturing = true;
    rowEl.classList.add('capturing');
    (rowEl.querySelector('.val') as HTMLElement).innerHTML = '<em>新しいキーを押してください（Escでやめる）</em>';
    capture((code) => {
      capturing = false;
      rowEl.classList.remove('capturing');
      // F2・F11 は固定の操作（デバッグ・全画面）なので割り当てない。Esc はポーズ以外ではキャンセル扱い
      if (code === 'F2' || code === 'F11' || (code === 'Escape' && r.action !== 'pause')) {
        sound('uiBack');
        commit();
        return;
      }
      const prev = s.bindings[r.action][0];
      // 他の操作で使っているキーなら「入れ替え」：相手には自分の元のキーを渡す
      for (const a of Object.keys(s.bindings) as GameAction[]) {
        if (a === r.action || !s.bindings[a].includes(code)) continue;
        const swapped = s.bindings[a].map((c) => (c === code ? prev : c));
        s.bindings[a] = swapped.filter((c, i) => c && swapped.indexOf(c) === i);
        if (!s.bindings[a].length) s.bindings[a] = [prev];
      }
      const rest = s.bindings[r.action].filter((c) => c !== code);
      s.bindings[r.action] = [code, ...rest.slice(1)].slice(0, 3);
      sound('uiOk');
      commit();
    });
  };
  const menu = new MenuList(els, sound, (i) => {
    const r = rows[i];
    if (r.kind === 'bind') startCapture(r, els[i]);
    else if (r.kind === 'button') r.run();
    else change(r, 1);
  });
  els.forEach((e, i) => {
    // スライダーのバーをクリックした位置の値にする
    e.addEventListener(
      'click',
      (ev) => {
        const r = rows[i];
        const bar = (ev.target as HTMLElement).closest('.bar') as HTMLElement | null;
        if (r.kind !== 'slider' || !bar) return;
        ev.stopPropagation();
        const rect = bar.getBoundingClientRect();
        s[r.key] = Math.min(1, Math.max(0, Math.round(((ev.clientX - rect.left) / rect.width) * 10) / 10));
        commit();
      },
      true,
    );
    e.addEventListener('wheel', (ev) => {
      const r = rows[i];
      if (r.kind === 'slider' || r.kind === 'choice') {
        ev.preventDefault();
        change(r, (ev as WheelEvent).deltaY < 0 ? 1 : -1);
      }
    });
    e.querySelectorAll('.opt').forEach(() => {});
  });
  render();
  return {
    el,
    refresh(next) {
      s.fullscreen = next.fullscreen;
      render();
    },
    onAction(a) {
      if (capturing) return;
      const r = rows[menu.index];
      if (a === 'up') menu.move(-1);
      else if (a === 'down') menu.move(1);
      else if (a === 'uiLeft') change(r, -1);
      else if (a === 'uiRight') change(r, 1);
      else if (a === 'ok') menu.pick();
      else if (a === 'back' || a === 'pause') {
        sound('uiBack');
        on.back();
      }
    },
  };
}

// ───────── ポーズ ─────────

export function pauseScreen(sound: UiSound, on: { resume(): void; retry(): void; select(): void; settings(): void; quit(): void }): ScreenCtl {
  const el = h(`<div class="screen pause"><div class="panel"><h2>幕間 <small>ポーズ</small></h2><div class="menu">
    <button>再開</button><button>リトライ</button><button>演目選択へ</button><button>設定</button><button>ゲーム終了</button>
  </div></div></div>`);
  const items = [...el.querySelectorAll('button')] as HTMLElement[];
  const menu = new MenuList(items, sound, (i) => [on.resume, on.retry, on.select, on.settings, on.quit][i]());
  return {
    el,
    onAction(a) {
      if (a === 'up') menu.move(-1);
      else if (a === 'down') menu.move(1);
      else if (a === 'ok') menu.pick();
      else if (a === 'back' || a === 'pause') {
        sound('uiBack');
        on.resume();
      }
    },
  };
}

// ───────── ゲームオーバー ─────────

export function gameOverScreen(stage: StageDef, score: number, time: number, rank: number, sound: UiSound, next: () => void): ScreenCtl {
  const el = h(`<div class="screen gameover"><div class="panel">
    <div class="go">終演<small>GAME OVER</small></div>
    <div class="sc">${fmt(score)}</div>
    ${stage.survival ? `<div class="tm">生存時間 ${time.toFixed(1)} 秒</div>` : ''}
    ${rank >= 0 ? `<div class="hi">ハイスコア！ 第${rank + 1}位</div>` : '<div class="lo">ランク外…もう一回！</div>'}
    <div class="hint">Enter で次へ</div>
  </div></div>`);
  let t = 0;
  return {
    el,
    update(dt) {
      t += dt;
    },
    onAction(a) {
      if (t < 0.8) return;
      if (a === 'ok' || a === 'launch' || a === 'back') {
        sound('uiOk');
        next();
      }
    },
  };
}

// ───────── 名前入力 ─────────

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function entryScreen(score: number, initial: string, sound: UiSound, setText: (h: ((e: KeyboardEvent) => boolean) | null) => void, done: (name: string) => void): ScreenCtl {
  const name: string[] = initial.replace(/[^A-Z0-9]/g, '').slice(0, 8).split('');
  let cur = Math.min(name.length, 7);
  const el = h(`<div class="screen entry"><div class="panel">
    <h2>ハイスコア！ 名前を入れてください</h2>
    <div class="sc">${fmt(score)}</div>
    <div class="slots"></div>
    <div class="hint">キーボードで入力（英数字3〜8文字）　Backspace 消す　Enter 決定<br>ゲームパッド：↑↓ 文字　→/A 次へ　B 消す　START 決定</div>
    <div class="err"></div>
  </div></div>`);
  const slots = el.querySelector('.slots') as HTMLElement;
  const err = el.querySelector('.err') as HTMLElement;
  const render = () => {
    let html = '';
    for (let i = 0; i < 8; i++) html += `<span class="slot ${i === cur ? 'cur' : ''} ${i < name.length ? 'on' : ''}">${esc(name[i] ?? '_')}</span>`;
    slots.innerHTML = html;
  };
  const finish = () => {
    const n = name.join('');
    if (n.length < 3) {
      err.textContent = '3文字以上にしてください';
      sound('uiBack');
      return;
    }
    setText(null);
    sound('uiOk');
    done(n);
  };
  const type = (ch: string) => {
    if (name.length >= 8) return;
    name.push(ch);
    cur = Math.min(7, name.length);
    err.textContent = '';
    sound('uiMove');
    render();
  };
  const back = () => {
    if (name.length) name.pop();
    cur = Math.min(7, name.length);
    sound('uiBack');
    render();
  };
  setText((e) => {
    if (e.repeat) return true;
    if (/^[a-zA-Z0-9]$/.test(e.key)) {
      type(e.key.toUpperCase());
      return true;
    }
    if (e.code === 'Backspace') {
      back();
      return true;
    }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      finish();
      return true;
    }
    return e.code.startsWith('Shift') ? false : true;
  });
  render();
  return {
    el,
    onAction(a) {
      // ゲームパッド用
      if (a === 'up' || a === 'down') {
        const c = name[cur];
        const i = c === undefined ? -1 : CHARS.indexOf(c);
        name[cur] = CHARS[(i + (a === 'up' ? 1 : -1) + CHARS.length) % CHARS.length];
        name.splice(cur + 1, Infinity, ...name.slice(cur + 1).filter((x) => x !== undefined));
        sound('uiMove');
        render();
      } else if (a === 'uiRight' || a === 'ok') {
        if (name[cur] === undefined) name[cur] = 'A';
        cur = Math.min(7, cur + 1, name.length);
        render();
      } else if (a === 'uiLeft') {
        cur = Math.max(0, cur - 1);
        render();
      } else if (a === 'back') back();
      else if (a === 'pause') finish();
    },
    destroy() {
      setText(null);
    },
  };
}

// ───────── ランキング ─────────

export function rankingScreen(stage: StageDef, list: ScoreEntry[], highlight: number, sound: UiSound, next: () => void): ScreenCtl {
  const rows = Array.from({ length: 10 }, (_, i) => {
    const e = list[i];
    return `<tr class="${i === highlight ? 'me' : ''}"><td class="r">${i + 1}</td><td class="n">${e ? esc(e.name) : '---'}</td><td class="s">${e ? fmt(e.score) : ''}</td>${stage.survival ? `<td class="t">${e?.time !== undefined ? `${e.time.toFixed(1)}秒` : ''}</td>` : ''}</tr>`;
  }).join('');
  const el = h(`<div class="screen ranking" style="--c:${stage.theme.colors.accent}"><div class="panel">
    <h2>番付 <small>RANKING ｜ ${esc(stage.name)} ${esc(stage.subtitle)}</small></h2>
    <table><thead><tr><th>位</th><th>名前</th><th>スコア</th>${stage.survival ? '<th>生存</th>' : ''}</tr></thead><tbody>${rows}</tbody></table>
    <div class="hint">Enter で演目選択へ</div>
  </div></div>`);
  let t = 0;
  return {
    el,
    update(dt) {
      t += dt;
    },
    onAction(a) {
      if (t < 0.5) return;
      if (a === 'ok' || a === 'launch' || a === 'back' || a === 'pause') {
        sound('uiOk');
        next();
      }
    },
  };
}

// ───────── 固定キーの案内 ─────────

export function guideScreen(status: A11yStatus, hidden: boolean, sound: UiSound, done: (hideNext: boolean) => void): ScreenCtl {
  const auto = status.supported && status.active;
  const el = h(`<div class="screen guide"><div class="panel">
    <h2>Shiftキーの「固定キー」について</h2>
    <p>このゲームは左右のShiftキーでフリッパーを動かします。Windowsでは Shift を5回続けて押すと「固定キー機能を有効にしますか？」、右Shiftを8秒押し続けると「フィルターキー」の確認が出て、ゲームが止まってしまいます。</p>
    <div class="status ${auto ? 'ok' : 'ng'}">${
      auto
        ? '✔ このアプリを遊んでいる間は、これらのショートカットを自動で止めています（終了すると元に戻ります）。'
        : '⚠ 自動で止められませんでした。お手数ですが、下の手順で設定をオフにしてください。'
    }</div>
    <h3>手動でオフにする方法（念のため）</h3>
    <ol>
      <li>Windowsの「設定」→「アクセシビリティ」→「キーボード」を開く</li>
      <li>「固定キー機能」を開き、<b>「固定キー機能のキーボード ショートカット」をオフ</b></li>
      <li>同じ画面の「フィルター キー機能」を開き、<b>「フィルター キー機能のキーボード ショートカット」をオフ</b></li>
    </ol>
    <label class="check"><input type="checkbox" ${hidden ? 'checked' : ''}> 次から表示しない</label>
    <div class="menu"><button>OK</button></div>
  </div></div>`);
  const cb = el.querySelector('input') as HTMLInputElement;
  const btn = el.querySelector('button') as HTMLElement;
  btn.classList.add('focus');
  btn.addEventListener('click', () => {
    sound('uiOk');
    done(cb.checked);
  });
  return {
    el,
    onAction(a) {
      if (a === 'ok') {
        sound('uiOk');
        done(cb.checked);
      } else if (a === 'uiLeft' || a === 'uiRight' || a === 'up' || a === 'down') {
        cb.checked = !cb.checked;
        sound('uiMove');
      } else if (a === 'back' || a === 'pause') {
        sound('uiBack');
        done(cb.checked);
      }
    },
  };
}

export type { Bindings };
