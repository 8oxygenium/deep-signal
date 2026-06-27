// PUDDING INFERNO GRID v0.2.8
'use strict';

// ============================================================
// CONFIG
// ============================================================
const CFG = {
  VERSION: 'GRID v0.2.8',
  CANVAS_W: 390,
  CANVAS_H: 844,

  COLS: 32,
  ROWS: 24,
  TILE: 48,

  PLAYER_HP_MAX: 3,
  KNIGHT_HP: 2,

  // 階層化：B1〜B4が通常階・B5=ボス階（全5階）
  TOTAL_FLOORS: 5,
  BOSS_FLOOR: 5,
  BOSS_HP: 6,

  HOLD_FIRST_MS: 300,
  HOLD_REPEAT_MS: 150,
  ENEMY_ANIM_MS: 140,
  INVINCIBLE_TURNS: 2,
  BLINK_MS: 200,
  TRAP_COUNT: 5,
  DANGER_MS: 500,

  // カメラ（プリンをビューポート中央に）
  VIEW_COLS: 0, // 計算で決まる
  VIEW_ROWS: 0,

  // 視野半径（タイル数）
  VISION_R: 5,

  // 攻撃エフェクト時間
  ATK_SQUISH_MS: 100,
  ATK_FLY_MS: 100,
  ATK_FLASH_MS: 100,
  ATK_SHAKE_MS: 50,
};

// ============================================================
// キャンバス・リサイズ
// ============================================================
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const W = CFG.CANVAS_W;
const H = CFG.CANVAS_H;

// コントロールUI高さ
const CTRL_H = 200;
const HUD_H  = 50;

// ゲームビューポート（px）
const VIEW_W = W;
const VIEW_H = H - HUD_H - CTRL_H;

// タイル数（ビューポートに収まる数、奇数に）
let VIEW_COLS = Math.floor(VIEW_W / CFG.TILE);
if (VIEW_COLS % 2 === 0) VIEW_COLS--;
let VIEW_ROWS = Math.floor(VIEW_H / CFG.TILE);
if (VIEW_ROWS % 2 === 0) VIEW_ROWS--;

// グリッド描画オフセット（ビューポート内）
const GRID_OX = Math.floor((VIEW_W - VIEW_COLS * CFG.TILE) / 2);
const GRID_OY = HUD_H;

function resizeCanvas() {
  const vw = window.innerWidth  || document.documentElement.clientWidth  || W;
  const vh = window.innerHeight || document.documentElement.clientHeight || H;
  const ratio = Math.min(vw / W, vh / H) || 1;
  canvas.width  = W;
  canvas.height = H;
  canvas.style.width  = Math.floor(W * ratio) + 'px';
  canvas.style.height = Math.floor(H * ratio) + 'px';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('load',   resizeCanvas);
requestAnimationFrame(resizeCanvas);

// ============================================================
// ユーティリティ
// ============================================================
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function tileToScreen(col, row, camCol, camRow) {
  const halfC = Math.floor(VIEW_COLS / 2);
  const halfR = Math.floor(VIEW_ROWS / 2);
  const sx = GRID_OX + (col - camCol + halfC) * CFG.TILE + CFG.TILE / 2;
  const sy = GRID_OY + (row - camRow + halfR) * CFG.TILE + CFG.TILE / 2;
  return { x: sx, y: sy };
}

function isOnScreen(col, row, camCol, camRow) {
  const halfC = Math.floor(VIEW_COLS / 2);
  const halfR = Math.floor(VIEW_ROWS / 2);
  return col >= camCol - halfC && col <= camCol + halfC &&
         row >= camRow - halfR && row <= camRow + halfR;
}

// BFS（壁を避けた最短路。戻り値：次の1手[dc,dr]、見つからない場合null）
function bfsStep(grid, startC, startR, goalC, goalR, blockedSet) {
  const key = (c, r) => `${c},${r}`;
  const visited = new Set([key(startC, startR)]);
  const queue = [{ c: startC, r: startR, first: null }];
  const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.c === goalC && cur.r === goalR) return cur.first;
    for (const [dc, dr] of dirs) {
      const nc = cur.c + dc, nr = cur.r + dr;
      const k = key(nc, nr);
      if (visited.has(k)) continue;
      if (nc < 0 || nc >= CFG.COLS || nr < 0 || nr >= CFG.ROWS) continue;
      if (grid[nr][nc] === 'W') continue;
      if (blockedSet && blockedSet.has(k)) continue;
      visited.add(k);
      queue.push({ c: nc, r: nr, first: cur.first || [dc, dr] });
    }
  }
  return null;
}

// BFS：到達可能チェック（通路かどうか）
function isReachable(grid, startC, startR, goalC, goalR) {
  return bfsStep(grid, startC, startR, goalC, goalR, null) !== null ||
    (startC === goalC && startR === goalR);
}

// BFS：最短路のマス列（罠避けルート計算用）
function bfsPath(grid, startC, startR, goalC, goalR) {
  const key = (c, r) => `${c},${r}`;
  const visited = new Set([key(startC, startR)]);
  const queue = [{ c: startC, r: startR, path: [] }];
  const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.c === goalC && cur.r === goalR) return cur.path;
    for (const [dc, dr] of dirs) {
      const nc = cur.c + dc, nr = cur.r + dr;
      const k = key(nc, nr);
      if (visited.has(k)) continue;
      if (nc < 0 || nc >= CFG.COLS || nr < 0 || nr >= CFG.ROWS) continue;
      if (grid[nr][nc] === 'W') continue;
      visited.add(k);
      queue.push({ c: nc, r: nr, path: [...cur.path, [nc, nr]] });
    }
  }
  return null;
}

// ============================================================
// ゲームステート
// ============================================================
const STATE = {
  TITLE: 'TITLE',
  PLAYING: 'PLAYING',
  ENEMY_ANIM: 'ENEMY_ANIM',
  ATK_EFFECT: 'ATK_EFFECT',
  CLEAR: 'CLEAR',
  DEATH: 'DEATH',
};
let gameState = STATE.TITLE;

// ============================================================
// グリッドデータ
// ============================================================
// cell値: 'W'=壁 '.'=通路 'T'=罠 'G'=出口
let grid = [];
// fogMap: 0=未踏 1=既踏 2=現在可視（drawで都度計算するので参照用）
let fogMap = [];

// ============================================================
// エンティティ
// ============================================================
const player = {
  col: 1, row: 1,
  hp: CFG.PLAYER_HP_MAX,
  hasHat: true,
  hasCream: true,
  status: 'normal',
  invincible: 0,
  decals: [],
  // 顔の向き（シレン式）。最後に動いた向きを覚える。faceY<0=上(後ろ向き) faceY>0=下(正面) faceX=横
  faceX: 0, faceY: 1, // 開始は正面（下）＝顔が見える
};

let enemies = [];
let traps = [];

// 出口位置
let exitCol = 0, exitRow = 0;

// 現在の階層（1=B1 … 5=B5ボス）
let currentFloor = 1;

// ボス（心ノ臓）撃破でCLEARにする保留フラグ（攻撃エフェクト解決後に発火）
let pendingBossClear = false;

// 難易度：'easy'=死んだ階から再挑戦(HP全回復) / 'hard'=B1から(本格ローグライク)。タイトルで選択
let difficulty = 'easy';

// 敵種の構成（type配列。長さ=その階の敵数）。blob=肉塊はStep3でB3+に追加予定
const FLOOR_COMP = {
  1: ['knight', 'knight'],
  2: ['knight', 'knight', 'fang'],
  3: ['knight', 'fang', 'blob'],
  4: ['knight', 'knight', 'fang', 'blob'],
};
function floorComposition(floor) {
  if (floor >= CFG.BOSS_FLOOR) return ['knight', 'knight', 'fang', 'blob']; // B5ボスは別途・暫定
  return FLOOR_COMP[floor] || FLOOR_COMP[4];
}

function makeEnemy(col, row, type) {
  const hp = type === 'fang' ? 1 : type === 'blob' ? 3 : type === 'boss' ? CFG.BOSS_HP : CFG.KNIGHT_HP;
  return { col, row, type, hp, hpMax: hp, warnCol: -1, warnRow: -1, alive: true, flashTimer: 0,
           slowTick: 0, cyc: 0, enraged: false, slamTiles: [] };
}

// ボスの周囲8マス（壁・盤外を除く）＝スラム範囲
function ringTiles(col, row) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (dc === 0 && dr === 0) continue;
    const c = col + dc, r = row + dr;
    if (c < 0 || c >= CFG.COLS || r < 0 || r >= CFG.ROWS) continue;
    if (grid[r][c] === 'W') continue;
    out.push([c, r]);
  }
  return out;
}

// ボス（心ノ臓）の1ターン：rest→charge(周囲を◇予告)→slam(予告マスにいたらダメージ)のサイクル。
// HP半分で激化＝牙1体召喚＋テンポUP。ほぼ動かない根を張った核。
function bossTurn(e) {
  const half = Math.ceil(e.hpMax / 2);
  if (e.hp <= half && !e.enraged) {
    e.enraged = true;
    bossSummon(e);
    dangerText = 'しんぞうが あばれる！'; dangerTimer = CFG.DANGER_MS;
  }
  const pat = e.enraged ? ['rest', 'charge', 'slam'] : ['rest', 'rest', 'charge', 'slam'];
  const act = pat[e.cyc % pat.length];
  e.cyc++;
  if (act === 'charge') {
    e.slamTiles = ringTiles(e.col, e.row); // 予告（プレイヤーの次の手で見える）
  } else if (act === 'slam') {
    if (e.slamTiles && e.slamTiles.some(t => t[0] === player.col && t[1] === player.row)) {
      if (player.invincible <= 0) applyDamage();
    }
    e.slamTiles = [];
  } else {
    e.slamTiles = []; // rest
  }
}

// ボスがHP半分で牙を1体召喚（周辺の空き床へ）
function bossSummon(boss) {
  const cand = [];
  for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
    const c = boss.col + dc, r = boss.row + dr;
    if (c < 0 || c >= CFG.COLS || r < 0 || r >= CFG.ROWS) continue;
    if (grid[r][c] !== '.') continue;
    if (c === player.col && r === player.row) continue;
    if (enemies.some(en => en.alive && en.col === c && en.row === r)) continue;
    cand.push([c, r]);
  }
  if (cand.length) {
    const [c, r] = cand[Math.floor(Math.random() * cand.length)];
    enemies.push(makeEnemy(c, r, 'fang'));
  }
}

// B5専用アリーナ：中央に大部屋、中央上にボス、出口なし（撃破=CLEAR）
function generateBossArena() {
  grid = []; fogMap = [];
  for (let r = 0; r < CFG.ROWS; r++) {
    grid.push(new Array(CFG.COLS).fill('W'));
    fogMap.push(new Array(CFG.COLS).fill(0));
  }
  const rw = 13, rh = 9;
  const rx = Math.floor((CFG.COLS - rw) / 2), ry = Math.floor((CFG.ROWS - rh) / 2);
  for (let r = ry; r < ry + rh; r++) for (let c = rx; c < rx + rw; c++) grid[r][c] = '.';
  // プレイヤーは部屋下端中央
  player.col = rx + Math.floor(rw / 2);
  player.row = ry + rh - 1;
  // ボスは中央やや上
  enemies = [ makeEnemy(rx + Math.floor(rw / 2), ry + 2, 'boss') ];
  traps = [];
  exitCol = -1; exitRow = -1; // 出口なし
}

// 敵の配置マス選び：非スタート部屋の中心を散らして優先、足りなければ部屋内の床マスで補う
// （スタート近傍マンハッタン3以内と出口は避ける）
function pickEnemyCells(rooms, startRoom, count) {
  const cells = [], used = new Set();
  const add = (c, r) => { const k = c + ',' + r; if (!used.has(k)) { used.add(k); cells.push([c, r]); } };
  const farEnough = (c, r) => Math.abs(c - startRoom.cx) + Math.abs(r - startRoom.cy) > 3;
  const others = rooms.filter(rm => rm !== startRoom);
  // 部屋中心を散らす
  const shuffled = others.slice();
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  for (const rm of shuffled) {
    if (cells.length >= count) break;
    if (rm.cx === exitCol && rm.cy === exitRow) continue;
    add(rm.cx, rm.cy);
  }
  // 足りなければ部屋内の床マスで補う
  if (cells.length < count) {
    const interior = [];
    for (const rm of others) {
      for (let rr = rm.y; rr < rm.y + rm.h; rr++) {
        for (let cc = rm.x; cc < rm.x + rm.w; cc++) {
          if (grid[rr] && grid[rr][cc] === '.' && !(cc === exitCol && rr === exitRow) && farEnough(cc, rr)) interior.push([cc, rr]);
        }
      }
    }
    for (let i = interior.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [interior[i], interior[j]] = [interior[j], interior[i]]; }
    for (const [cc, rr] of interior) { if (cells.length >= count) break; add(cc, rr); }
  }
  return cells;
}

// カメラ
let camCol = 0, camRow = 0;

// ============================================================
// 攻撃エフェクト
// ============================================================
let atkEffect = null;
// { phase:'squish'|'fly'|'flash', timer, fromX,fromY, toX,toY,
//   targetEnemy, particles:[], shakeTimer }

// ============================================================
// 敵アニメ
// ============================================================
let enemyAnimTimer = 0;

// ============================================================
// 死亡・クリア
// ============================================================
let deathTimer = 0, deathPhase = 0, deathRetryVisible = false;
let clearTimer = 0;

// ============================================================
// UI状態
// ============================================================
let dangerText = '', dangerTimer = 0;
let wallPulse = 0;
let shakeX = 0, shakeY = 0;

// ミニマップ
let minimapOpen = false;

// チュートリアル吹き出し
const tuto = {
  shown: { move: false, enemy: false, bump: false, map: false },
  text: '', timer: 0,
};

// 長押しヒント
let holdHintTimer  = -1;   // -1=待機中, >0=表示中, 0=終了
let holdHintShown  = false;
let firstMoveTimer = 0;    // 最初の移動から何ms経過
let hasMoved = false;

// でぐちチカイ
let exitNearShown = false;

// ============================================================
// BSP ダンジョン生成
// ============================================================
function generateDungeon() {
  // ボス階は専用アリーナ
  if (currentFloor >= CFG.BOSS_FLOOR) { generateBossArena(); return; }

  // グリッドを全部壁で初期化
  grid = [];
  fogMap = [];
  for (let r = 0; r < CFG.ROWS; r++) {
    grid.push(new Array(CFG.COLS).fill('W'));
    fogMap.push(new Array(CFG.COLS).fill(0));
  }

  // BSP分割
  const rootNode = { x: 1, y: 1, w: CFG.COLS - 2, h: CFG.ROWS - 2 };
  const leaves = [];
  bspSplit(rootNode, leaves, 0);

  // 各葉に部屋を作成
  const rooms = [];
  for (const leaf of leaves) {
    const room = carveRoom(leaf);
    if (room) rooms.push(room);
  }

  // 隣接する部屋を接続（空間が近い順に）
  connectRooms(rooms);

  // スタート部屋（左上寄り）・出口部屋（右下寄り）を選択
  rooms.sort((a, b) => (a.cx + a.cy) - (b.cx + b.cy));
  const startRoom = rooms[0];
  const endRoom   = rooms[rooms.length - 1];

  // プレイヤー初期位置
  player.col = startRoom.cx;
  player.row = startRoom.cy;

  // 出口
  exitCol = endRoom.cx;
  exitRow = endRoom.cy;
  grid[exitRow][exitCol] = 'G';

  // 到達可能チェック（生成の保険）
  if (!isReachable(grid, player.col, player.row, exitCol, exitRow)) {
    // 再生成（再帰は避けて1回だけ上書き）
    generateDungeon();
    return;
  }

  // 敵配置：階ごとの構成（type配列）に従い、散らして配置。Step2＝knight＋fang
  enemies = [];
  const comp = floorComposition(currentFloor);
  const cells = pickEnemyCells(rooms, startRoom, comp.length);
  for (let i = 0; i < cells.length; i++) {
    enemies.push(makeEnemy(cells[i][0], cells[i][1], comp[i] || 'knight'));
  }

  // 罠配置（スタート〜出口の最短ルート上は除外）
  placeTrapsSafe();
}

function bspSplit(node, leaves, depth) {
  const MIN_SIZE = 10;
  const canSplitH = node.h > MIN_SIZE * 2;
  const canSplitV = node.w > MIN_SIZE * 2;

  if (depth >= 3 || (!canSplitH && !canSplitV)) {
    leaves.push(node);
    return;
  }

  let splitH = canSplitH && (!canSplitV || Math.random() < 0.5);

  if (splitH) {
    const splitY = MIN_SIZE + Math.floor(Math.random() * (node.h - MIN_SIZE * 2));
    bspSplit({ x: node.x, y: node.y,           w: node.w, h: splitY           }, leaves, depth + 1);
    bspSplit({ x: node.x, y: node.y + splitY,  w: node.w, h: node.h - splitY  }, leaves, depth + 1);
  } else {
    const splitX = MIN_SIZE + Math.floor(Math.random() * (node.w - MIN_SIZE * 2));
    bspSplit({ x: node.x,          y: node.y, w: splitX,           h: node.h }, leaves, depth + 1);
    bspSplit({ x: node.x + splitX, y: node.y, w: node.w - splitX,  h: node.h }, leaves, depth + 1);
  }
}

function carveRoom(leaf) {
  const MIN_W = 5, MAX_W = 8;
  const MIN_H = 4, MAX_H = 6;
  const rw = Math.min(MAX_W, Math.max(MIN_W, Math.floor(Math.random() * (MAX_W - MIN_W + 1)) + MIN_W));
  const rh = Math.min(MAX_H, Math.max(MIN_H, Math.floor(Math.random() * (MAX_H - MIN_H + 1)) + MIN_H));

  if (rw > leaf.w - 2 || rh > leaf.h - 2) return null;

  const rx = leaf.x + 1 + Math.floor(Math.random() * (leaf.w - rw - 1));
  const ry = leaf.y + 1 + Math.floor(Math.random() * (leaf.h - rh - 1));

  for (let r = ry; r < ry + rh; r++) {
    for (let c = rx; c < rx + rw; c++) {
      if (r >= 0 && r < CFG.ROWS && c >= 0 && c < CFG.COLS) {
        grid[r][c] = '.';
      }
    }
  }
  return {
    x: rx, y: ry, w: rw, h: rh,
    cx: Math.floor(rx + rw / 2),
    cy: Math.floor(ry + rh / 2),
  };
}

function connectRooms(rooms) {
  // 最小全域木的に近い部屋ペアを接続
  const connected = new Set([0]);
  while (connected.size < rooms.length) {
    let bestDist = Infinity, bestA = -1, bestB = -1;
    for (const a of connected) {
      for (let b = 0; b < rooms.length; b++) {
        if (connected.has(b)) continue;
        const d = Math.abs(rooms[a].cx - rooms[b].cx) + Math.abs(rooms[a].cy - rooms[b].cy);
        if (d < bestDist) { bestDist = d; bestA = a; bestB = b; }
      }
    }
    if (bestA < 0) break;
    carveCorridor(rooms[bestA].cx, rooms[bestA].cy, rooms[bestB].cx, rooms[bestB].cy);
    connected.add(bestB);
  }
}

function carveCorridor(ax, ay, bx, by) {
  // L字形通路（水平→垂直 or 垂直→水平をランダム選択）
  let cx = ax, cy = ay;
  if (Math.random() < 0.5) {
    // 水平優先
    while (cx !== bx) { cx += cx < bx ? 1 : -1; safeCarve(cx, cy); }
    while (cy !== by) { cy += cy < by ? 1 : -1; safeCarve(cx, cy); }
  } else {
    // 垂直優先
    while (cy !== by) { cy += cy < by ? 1 : -1; safeCarve(cx, cy); }
    while (cx !== bx) { cx += cx < bx ? 1 : -1; safeCarve(cx, cy); }
  }
}

function safeCarve(c, r) {
  if (c >= 1 && c < CFG.COLS - 1 && r >= 1 && r < CFG.ROWS - 1) {
    if (grid[r][c] === 'W') grid[r][c] = '.';
  }
}

function placeTrapsSafe() {
  traps = [];
  const pathCells = new Set();
  pathCells.add(`${player.col},${player.row}`);
  pathCells.add(`${exitCol},${exitRow}`);
  const shortPath = bfsPath(grid, player.col, player.row, exitCol, exitRow);
  if (shortPath) shortPath.forEach(([c, r]) => pathCells.add(`${c},${r}`));
  enemies.forEach(e => pathCells.add(`${e.col},${e.row}`));

  const candidates = [];
  for (let r = 1; r < CFG.ROWS - 1; r++) {
    for (let c = 1; c < CFG.COLS - 1; c++) {
      if (grid[r][c] === '.' && !pathCells.has(`${c},${r}`)) {
        candidates.push([c, r]);
      }
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const count = Math.min(CFG.TRAP_COUNT, candidates.length);
  for (let i = 0; i < count; i++) {
    const [c, r] = candidates[i];
    // 前半60%は見える罠、後半40%は隠し罠（見える多め）
    const hidden = (i >= Math.ceil(count * 0.6));
    traps.push({ col: c, row: r, hidden, revealed: false });
    grid[r][c] = 'T';
  }
}

// ============================================================
// フォグ更新（視野半径内を可視に）
// ============================================================
function updateFog() {
  const r2 = CFG.VISION_R;
  for (let dr = -r2; dr <= r2; dr++) {
    for (let dc = -r2; dc <= r2; dc++) {
      if (Math.hypot(dc, dr) > r2 + 0.5) continue;
      const c = player.col + dc, r = player.row + dr;
      if (c < 0 || c >= CFG.COLS || r < 0 || r >= CFG.ROWS) continue;
      if (fogMap[r][c] < 2) fogMap[r][c] = 2;
    }
  }
}

function afterMoveUpdateFog() {
  // 直前に可視だったマスを「既踏(1)」に降格
  for (let r = 0; r < CFG.ROWS; r++) {
    for (let c = 0; c < CFG.COLS; c++) {
      if (fogMap[r][c] === 2) fogMap[r][c] = 1;
    }
  }
  updateFog();
}

// ============================================================
// ゲーム初期化
// ============================================================
function initGame() {
  currentFloor = 1;
  generateDungeon();

  player.hp = CFG.PLAYER_HP_MAX;
  player.hasHat = true;
  player.hasCream = true;
  player.status = 'normal';
  player.invincible = 0;
  player.decals = [];
  player.faceX = 0; player.faceY = 1;

  camCol = player.col;
  camRow = player.row;

  deathTimer = 0; deathPhase = 0; deathRetryVisible = false;
  clearTimer = 0;
  pendingBossClear = false;
  dangerText = ''; dangerTimer = 0;
  atkEffect = null;
  enemyAnimTimer = 0;
  minimapOpen = false;
  exitNearShown = false;
  hasMoved = false;
  firstMoveTimer = 0;
  holdHintTimer = -1;
  holdHintShown = false;
  shakeX = 0; shakeY = 0;

  tuto.shown = { move: false, enemy: false, bump: false, map: false };
  tuto.text = ''; tuto.timer = 0;

  // 初期フォグ
  for (let r = 0; r < CFG.ROWS; r++) fogMap[r].fill(0);
  updateFog();

  // チュートリアル吹き出し：開始直後
  showTuto('いどうして たんけんしよう！', 2000);
  tuto.shown.move = true;

  lastMoveDir = null;
  isHolding = false;
  holdTimer = 0;
  holdRepeatTimer = 0;
}

// 現在の currentFloor のダンジョンを生成し、フォグ・カメラ・UI状態を整える（HP・飾りは触らない）
function buildFloor() {
  generateDungeon(); // player.col/row は新しいスタート位置にセットされる
  player.invincible = 0;
  player.decals = [];
  player.status = 'normal';
  pendingBossClear = false;
  // フォグ：通常階は全未踏、ボス階はアリーナ全可視（ボスが見える）
  if (currentFloor >= CFG.BOSS_FLOOR) {
    for (let r = 0; r < CFG.ROWS; r++) fogMap[r].fill(2);
  } else {
    for (let r = 0; r < CFG.ROWS; r++) fogMap[r].fill(0);
  }
  updateFog();
  camCol = player.col;
  camRow = player.row;
  exitNearShown = false;
  atkEffect = null;
  minimapOpen = false;
  lastMoveDir = null; isHolding = false; holdTimer = 0; holdRepeatTimer = 0;
  dangerText = ''; dangerTimer = 0;
}

// 次の階へ降りる：HP・飾りは引き継ぐ
function nextFloor() {
  currentFloor++;
  buildFloor();
  gameState = STATE.PLAYING;
  const label = currentFloor >= CFG.BOSS_FLOOR ? 'ボスの ま！' : 'ちか ' + currentFloor + ' かい！';
  showTuto(label, 1500);
}

// やさしい：死んだ階を作り直し、HP・飾りを全回復して再挑戦
function retryCurrentFloor() {
  player.hp = CFG.PLAYER_HP_MAX;
  player.hasHat = true;
  player.hasCream = true;
  buildFloor();
  deathTimer = 0; deathPhase = 0; deathRetryVisible = false;
  const label = currentFloor >= CFG.BOSS_FLOOR ? 'ボスに もういちど！' : 'ちか ' + currentFloor + ' かいから！';
  showTuto(label, 1500);
}

// 死亡後の再開：難易度で分岐（easy=死んだ階から / hard=B1から）
function restartAfterDeath() {
  if (difficulty === 'easy') retryCurrentFloor();
  else initGame();
  gameState = STATE.PLAYING;
}

// ============================================================
// ターン処理
// ============================================================
function isWall(c, r) {
  if (c < 0 || c >= CFG.COLS || r < 0 || r >= CFG.ROWS) return true;
  return grid[r][c] === 'W';
}
function isTrap(c, r) { return traps.some(t => t.col === c && t.row === r); }
function enemyAt(c, r) { return enemies.find(e => e.alive && e.col === c && e.row === r); }

function doPlayerMove(dc, dr) {
  if (gameState !== STATE.PLAYING) return false;
  const nc = player.col + dc;
  const nr = player.row + dr;
  // 押した向きを顔に反映（壁・敵でも：押した方向を見るのが自然）。最後の向きを保持
  player.faceX = dc; player.faceY = dr;
  if (isWall(nc, nr)) return false;

  const target = enemyAt(nc, nr);
  if (target) {
    // ぶつかり攻撃
    triggerAttack(target, nc, nr, dc, dr, true);
    return true;
  }

  player.col = nc;
  player.row = nr;
  hasMoved = true;

  // でぐち近い
  const distExit = Math.abs(player.col - exitCol) + Math.abs(player.row - exitRow);
  if (distExit <= 3 && !exitNearShown) {
    exitNearShown = true;
    showTuto('でぐち ちかい！', 1000);
  }

  // 出口＝次の階へ降りる（最終階のみクリア）
  if (player.col === exitCol && player.row === exitRow) {
    if (currentFloor < CFG.TOTAL_FLOORS) {
      nextFloor();
    } else {
      gameState = STATE.CLEAR;
      clearTimer = 0;
      afterMoveUpdateFog();
    }
    return true;
  }

  // 罠
  const steppedTrap = traps.find(t => t.col === player.col && t.row === player.row);
  if (steppedTrap) {
    // 隠し罠：踏む前に「初回かどうか」を記録してからreveal
    const isFirstHiddenStep = steppedTrap.hidden && !steppedTrap.revealed;
    if (steppedTrap.hidden) steppedTrap.revealed = true; // 以後ずっと見える

    // 「あぶない！」：見える罠は常に表示、隠し罠は初回のみ
    const showDanger = !steppedTrap.hidden || isFirstHiddenStep;
    if (showDanger && player.status !== 'melted') {
      dangerText = 'あぶない！';
      dangerTimer = CFG.DANGER_MS;
    }
    player.status = 'melted';
    if (player.invincible <= 0) applyDamage();
  }

  afterMoveUpdateFog();
  camCol = player.col;
  camRow = player.row;

  // 敵が可視に入った？
  checkEnemyVisible();

  doEnemyTurns();
  return true;
}

function doWait() {
  if (gameState !== STATE.PLAYING) return;
  doEnemyTurns();
}

function checkEnemyVisible() {
  if (tuto.shown.enemy) return;
  for (const e of enemies) {
    if (!e.alive) continue;
    if (fogMap[e.row][e.col] === 2) {
      tuto.shown.enemy = true;
      showTuto('おすと こうげき！', 2000);
      return;
    }
  }
}

function triggerAttack(target, atCol, atRow, dc, dr, isBump) {
  // 攻撃ボタン or ぶつかり共通エフェクト
  const fromPos = tileToScreen(player.col, player.row, camCol, camRow);
  const toPos   = tileToScreen(atCol, atRow, camCol, camRow);

  atkEffect = {
    phase: 'squish',
    timer: CFG.ATK_SQUISH_MS,
    fromX: fromPos.x, fromY: fromPos.y,
    toX: toPos.x, toY: toPos.y,
    dc, dr,
    targetEnemy: target,
    particles: [],
    shakeTimer: 0,
    hit: false,
    isBump,
  };

  // ぶつかり攻撃のチュートリアル
  if (isBump && !tuto.shown.bump) {
    tuto.shown.bump = true;
    setTimeout(() => showTuto('ぶつかっても こうげきできる！', 1000), 300);
  }

  gameState = STATE.ATK_EFFECT;
}

function doAttackHit(target) {
  if (!target || !target.alive) return;
  target.hp--;
  target.flashTimer = CFG.ATK_FLASH_MS;
  if (target.hp <= 0) {
    target.alive = false;
    target.warnCol = -1;
    if (target.type === 'boss') pendingBossClear = true; // 心ノ臓撃破＝魔物崩壊→CLEAR
  }
  shakeX = 1; shakeY = 1;
}

function applyDamage() {
  if (player.invincible > 0) return;
  player.hp--;
  if (player.hp === 2 && player.hasHat) {
    player.hasHat = false;
    player.decals.push({ col: player.col, row: player.row, type: 'hat', timer: 3000 });
  } else if (player.hp === 1 && player.hasCream) {
    player.hasCream = false;
    player.decals.push({ col: player.col, row: player.row, type: 'cream', timer: 3000 });
  }
  if (player.hp <= 0) { player.hp = 0; triggerDeath(); return; }
  player.invincible = CFG.INVINCIBLE_TURNS;
}

function triggerDeath() {
  gameState = STATE.DEATH;
  deathTimer = 0; deathPhase = 0; deathRetryVisible = false;
}

function doEnemyTurns() {
  if (player.invincible > 0) player.invincible--;

  const alive = enemies.filter(e => e.alive);
  const occ = new Set(alive.map(e => `${e.col},${e.row}`));

  for (const e of alive) {
    // ボス（心ノ臓）は専用の行動（スラムサイクル）。通常の追跡・隣接攻撃はしない
    if (e.type === 'boss') { bossTurn(e); continue; }

    const adjToPlayer = Math.abs(e.col - player.col) + Math.abs(e.row - player.row) === 1;

    if (adjToPlayer) {
      if (e.type === 'fang') {
        // 牙：予告なしで即噛む（脆い代わりに先制。騎士の◇予告1ターンの猶予が無い）
        if (player.invincible <= 0) applyDamage();
        e.warnCol = -1; e.warnRow = -1;
      } else if (e.warnCol === player.col && e.warnRow === player.row) {
        if (player.invincible <= 0) applyDamage();
        e.warnCol = -1; e.warnRow = -1;
      } else {
        e.warnCol = player.col;
        e.warnRow = player.row;
      }
    } else {
      e.warnCol = -1; e.warnRow = -1;
      // 肉塊：2ターンに1回だけ動く（鈍重な壁役）。休むターンはその場待機
      if (e.type === 'blob') {
        e.slowTick = (e.slowTick || 0) + 1;
        if (e.slowTick % 2 === 0) continue;
      }
      const blocked = new Set(occ);
      blocked.delete(`${e.col},${e.row}`);
      const step = bfsStep(grid, e.col, e.row, player.col, player.row, blocked);
      if (step) {
        const [dc, dr] = step;
        const nc = e.col + dc, nr = e.row + dr;
        if (nc === player.col && nr === player.row) {
          if (player.invincible <= 0) applyDamage();
        } else {
          occ.delete(`${e.col},${e.row}`);
          e.col = nc; e.row = nr;
          occ.add(`${e.col},${e.row}`);
        }
      }
    }
  }

  if (gameState === STATE.PLAYING) {
    gameState = STATE.ENEMY_ANIM;
    enemyAnimTimer = CFG.ENEMY_ANIM_MS;
  }
}

// 攻撃ボタン：最寄りの隣接敵を自動ターゲット
function doAttackButton() {
  if (gameState !== STATE.PLAYING) return;
  const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
  let nearest = null, nearestDist = Infinity;
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = Math.abs(e.col - player.col) + Math.abs(e.row - player.row);
    if (d <= 1 && d < nearestDist) { nearestDist = d; nearest = e; }
  }
  if (nearest) {
    const dc = nearest.col - player.col, dr = nearest.row - player.row;
    player.faceX = dc; player.faceY = dr; // 攻撃する敵の方を向く
    triggerAttack(nearest, nearest.col, nearest.row, dc, dr, false);
  } else {
    // 空振り：ターン消費
    doEnemyTurns();
  }
}

// ============================================================
// 入力
// ============================================================
let lastMoveDir = null;
let isHolding = false;
let holdTimer = 0;
let holdRepeatTimer = 0;
let swipeStart = null;
let mouseDown = false;

function toCanvasXY(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const sw = parseFloat(canvas.style.width)  || W;
  const sh = parseFloat(canvas.style.height) || H;
  return {
    x: (clientX - rect.left) * (W / sw),
    y: (clientY - rect.top)  * (H / sh),
  };
}

// ボタン矩形（Canvas座標系）
function getCtrlRects() {
  const base = H - CTRL_H;
  // 十字（左下）
  const cx = W * 0.28, cy = base + CTRL_H * 0.5;
  const sz = 48, gap = 3;
  return {
    up:    { x: cx - sz/2, y: cy - sz - gap, w: sz, h: sz },
    down:  { x: cx - sz/2, y: cy + gap,      w: sz, h: sz },
    left:  { x: cx - sz - gap - sz/2, y: cy - sz/2, w: sz, h: sz },
    right: { x: cx + gap + sz/2,      y: cy - sz/2, w: sz, h: sz },
    attack: { x: W - 90, y: base + 20, w: 72, h: 72 },   // 右下：攻撃
    // wait=左下隅 / map=右下隅 に大きく離す（下ボタン底795・攻撃底736より上端798で確実に分離）
    wait:   { x:  8,      y: H - 46, w: 56, h: 40 },  // 左下隅 x:8-64 y:798-838
    map:    { x: W - 64,  y: H - 46, w: 56, h: 40 },  // 右下隅 x:326-382 y:798-838
  };
}

function hitRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function handleDown(cx, cy) {
  if (minimapOpen) { minimapOpen = false; return; }
  if (gameState === STATE.TITLE) {
    const tr = getTitleRects();
    difficulty = hitRect(cx, cy, tr.hard) ? 'hard' : 'easy'; // ハードボタン以外はやさしい開始
    initGame(); gameState = STATE.PLAYING; return;
  }
  if (gameState === STATE.CLEAR) { initGame(); gameState = STATE.PLAYING; return; }
  if (gameState === STATE.DEATH) { if (deathRetryVisible) restartAfterDeath(); return; }
  if (gameState !== STATE.PLAYING && gameState !== STATE.ENEMY_ANIM) return;
  if (gameState !== STATE.PLAYING) return;

  const r = getCtrlRects();
  if (hitRect(cx, cy, r.attack)) { doAttackButton(); return; }
  if (hitRect(cx, cy, r.wait))   { doWait(); return; }
  if (hitRect(cx, cy, r.map))    {
    minimapOpen = !minimapOpen;
    if (!tuto.shown.map) {
      tuto.shown.map = true;
      showTuto('あるいた ところが ちずになる！', 2000);
    }
    return;
  }
  if (hitRect(cx, cy, r.up))    { startMove(0, -1); return; }
  if (hitRect(cx, cy, r.down))  { startMove(0,  1); return; }
  if (hitRect(cx, cy, r.left))  { startMove(-1, 0); return; }
  if (hitRect(cx, cy, r.right)) { startMove( 1, 0); return; }
}

function handleUp() {
  lastMoveDir = null;
  isHolding = false;
  holdTimer = 0;
  holdRepeatTimer = 0;
}

function startMove(dc, dr) {
  const moved = doPlayerMove(dc, dr);
  if (moved) {
    lastMoveDir = { dc, dr };
    holdTimer = CFG.HOLD_FIRST_MS;
    isHolding = false;
    holdRepeatTimer = 0;
  } else {
    lastMoveDir = null;
  }
}

function handleSwipeEnd(sx, sy, ex, ey) {
  if (gameState !== STATE.PLAYING) return;
  const dx = ex - sx, dy = ey - sy;
  if (Math.hypot(dx, dy) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) doPlayerMove(dx > 0 ? 1 : -1, 0);
  else doPlayerMove(0, dy > 0 ? 1 : -1);
}

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  const p = toCanvasXY(t.clientX, t.clientY);
  swipeStart = p;
  handleDown(p.x, p.y);
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  const p = toCanvasXY(t.clientX, t.clientY);
  if (swipeStart) {
    const r = getCtrlRects();
    const inBtn = Object.values(r).some(b => hitRect(swipeStart.x, swipeStart.y, b));
    if (!inBtn) handleSwipeEnd(swipeStart.x, swipeStart.y, p.x, p.y);
    swipeStart = null;
  }
  handleUp();
}, { passive: false });

canvas.addEventListener('mousedown', (e) => {
  const p = toCanvasXY(e.clientX, e.clientY);
  swipeStart = p; mouseDown = true;
  handleDown(p.x, p.y);
});
canvas.addEventListener('mouseup', (e) => {
  if (!mouseDown) return;
  mouseDown = false;
  const p = toCanvasXY(e.clientX, e.clientY);
  if (swipeStart) {
    const r = getCtrlRects();
    const inBtn = Object.values(r).some(b => hitRect(swipeStart.x, swipeStart.y, b));
    if (!inBtn) handleSwipeEnd(swipeStart.x, swipeStart.y, p.x, p.y);
    swipeStart = null;
  }
  handleUp();
});

const keyHeld = {};
window.addEventListener('keydown', (e) => {
  if (keyHeld[e.key]) return;
  keyHeld[e.key] = true;
  if (minimapOpen) { minimapOpen = false; return; }
  if (gameState === STATE.TITLE) { initGame(); gameState = STATE.PLAYING; return; }
  if (gameState === STATE.CLEAR) { initGame(); gameState = STATE.PLAYING; return; }
  if (gameState === STATE.DEATH && deathRetryVisible) { restartAfterDeath(); return; }
  if (gameState !== STATE.PLAYING) return;
  const dm = { ArrowUp:[0,-1], w:[0,-1], W:[0,-1], ArrowDown:[0,1], s:[0,1], S:[0,1],
               ArrowLeft:[-1,0], a:[-1,0], A:[-1,0], ArrowRight:[1,0], d:[1,0], D:[1,0] };
  if (dm[e.key]) { const [dc,dr] = dm[e.key]; startMove(dc, dr); }
  if (e.key === 'j' || e.key === 'J') doAttackButton();
  if (e.key === '.' || e.key === ' ') doWait();
  if (e.key === 'm' || e.key === 'M') minimapOpen = !minimapOpen;
});
window.addEventListener('keyup', (e) => { keyHeld[e.key] = false; handleUp(); });

// ============================================================
// チュートリアル吹き出し
// ============================================================
function showTuto(text, ms) {
  tuto.text = text;
  tuto.timer = ms;
}

// ============================================================
// UPDATE
// ============================================================
let lastTime = 0;

function update(dt) {
  wallPulse += dt * 0.001;

  // デカルタイマー
  player.decals = player.decals.filter(d => { d.timer -= dt; return d.timer > 0; });

  // あぶない！
  if (dangerTimer > 0) dangerTimer = Math.max(0, dangerTimer - dt);

  // チュートリアル
  if (tuto.timer > 0) {
    tuto.timer -= dt;
    // 最初の移動でmoveヒント消す
    if (tuto.shown.move && hasMoved && tuto.text === 'いどうして たんけんしよう！') tuto.timer = 0;
  }

  // 画面揺れ
  if (shakeX !== 0 || shakeY !== 0) { shakeX = 0; shakeY = 0; }

  // 敵フラッシュ
  for (const e of enemies) {
    if (e.flashTimer > 0) e.flashTimer = Math.max(0, e.flashTimer - dt);
  }

  // 長押しヒント（最初の移動から2秒後に1回）
  if (hasMoved && !holdHintShown) {
    firstMoveTimer += dt;
    if (firstMoveTimer >= 2000) {
      holdHintTimer = 2000;
      holdHintShown = true;
    }
  }
  if (holdHintTimer > 0) holdHintTimer -= dt;

  if (gameState === STATE.ATK_EFFECT) {
    updateAtkEffect(dt);
    return;
  }

  if (gameState === STATE.ENEMY_ANIM) {
    enemyAnimTimer -= dt;
    if (enemyAnimTimer <= 0) {
      gameState = STATE.PLAYING;
      if (player.hp <= 0) triggerDeath();
    }
    return;
  }

  if (gameState === STATE.DEATH) {
    deathTimer += dt;
    if      (deathPhase === 0 && deathTimer >= 500)  { deathPhase = 1; deathTimer = 0; }
    else if (deathPhase === 1 && deathTimer >= 1500) { deathPhase = 2; deathTimer = 0; }
    else if (deathPhase === 2 && deathTimer >= 500)  { deathPhase = 3; deathTimer = 0; }
    else if (deathPhase === 3 && deathTimer >= 1500) { deathRetryVisible = true; }
    return;
  }

  if (gameState === STATE.CLEAR) {
    clearTimer += dt;
    return;
  }

  // 長押し連続移動
  if (gameState === STATE.PLAYING && lastMoveDir) {
    if (!isHolding) {
      holdTimer -= dt;
      if (holdTimer <= 0) { isHolding = true; holdRepeatTimer = 0; }
    } else {
      holdRepeatTimer -= dt;
      if (holdRepeatTimer <= 0) {
        holdRepeatTimer = CFG.HOLD_REPEAT_MS;
        const ok = doPlayerMove(lastMoveDir.dc, lastMoveDir.dr);
        if (!ok) handleUp(); // 壁 or 敵で停止
      }
    }
  }
}

function updateAtkEffect(dt) {
  const ef = atkEffect;
  if (!ef) { gameState = STATE.PLAYING; return; }

  ef.timer -= dt;

  if (ef.phase === 'squish' && ef.timer <= 0) {
    ef.phase = 'fly';
    ef.timer = CFG.ATK_FLY_MS;
    // 欠片パーティクル生成
    for (let i = 0; i < 5; i++) {
      const angle = Math.atan2(ef.toY - ef.fromY, ef.toX - ef.fromX) + (Math.random() - 0.5) * 0.6;
      ef.particles.push({
        x: ef.fromX, y: ef.fromY,
        vx: Math.cos(angle) * (4 + Math.random() * 3),
        vy: Math.sin(angle) * (4 + Math.random() * 3),
        life: 1,
      });
    }
  } else if (ef.phase === 'fly' && ef.timer <= 0) {
    // 命中
    if (!ef.hit) {
      ef.hit = true;
      doAttackHit(ef.targetEnemy);
      // ぶつかり攻撃なら移動しない・攻撃ボタンも移動しない
    }
    ef.phase = 'flash';
    ef.timer = CFG.ATK_FLASH_MS;
    ef.shakeTimer = CFG.ATK_SHAKE_MS;
  } else if (ef.phase === 'flash' && ef.timer <= 0) {
    atkEffect = null;
    if (gameState === STATE.ATK_EFFECT) {
      if (pendingBossClear) {
        // 心ノ臓を倒した＝CLEAR（敵ターンは回さない）
        pendingBossClear = false;
        gameState = STATE.CLEAR;
        clearTimer = 0;
      } else {
        gameState = STATE.PLAYING;
        doEnemyTurns();
      }
    }
    return;
  }

  // パーティクル更新
  if (ef.particles) {
    for (const p of ef.particles) {
      p.x += p.vx; p.y += p.vy; p.life -= 0.12;
    }
    ef.particles = ef.particles.filter(p => p.life > 0);
  }
}

// ============================================================
// DRAW
// ============================================================
function draw(now) {
  ctx.save();
  // 画面揺れ（攻撃命中時）
  if (atkEffect && atkEffect.shakeTimer > 0) {
    atkEffect.shakeTimer -= 16;
    ctx.translate((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
  }

  ctx.clearRect(-2, -2, W + 4, H + 4);
  drawBackground();

  if (gameState === STATE.TITLE) {
    drawTitle(now);
    drawVignette();
    ctx.restore();
    return;
  }

  // ゲームビューポートをクリップ
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HUD_H, W, VIEW_H);
  ctx.clip();
  drawGridView(now);
  drawDecals();
  drawEnemies(now);
  drawPlayer(now);
  ctx.restore();

  drawHUD(now);
  drawControls(now);

  if (minimapOpen) drawMinimap(now);
  if (gameState === STATE.CLEAR) drawClear(now);
  if (gameState === STATE.DEATH) drawDeath(now);

  drawVignette();
  drawTutoHint(now);
  drawDangerText();
  drawHoldHint(now);

  ctx.restore();
}

// --- 背景 ---
function drawBackground() {
  const p = Math.sin(wallPulse) * 1.5;
  ctx.fillStyle = '#3B1A1A';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 8; i++) {
    const x = (i / 8) * W, ww = W / 8 + p;
    const g = ctx.createLinearGradient(x, 0, x + ww, 0);
    g.addColorStop(0, 'rgba(92,42,42,0)');
    g.addColorStop(0.5,'rgba(92,42,42,0.16)');
    g.addColorStop(1, 'rgba(92,42,42,0)');
    ctx.fillStyle = g; ctx.fillRect(x, 0, ww, H);
  }
  const ft = ctx.createLinearGradient(0, 0, 0, HUD_H + 10);
  ft.addColorStop(0, 'rgba(15,8,8,0.95)'); ft.addColorStop(1, 'rgba(15,8,8,0)');
  ctx.fillStyle = ft; ctx.fillRect(0, 0, W, HUD_H + 10);
  const fb = ctx.createLinearGradient(0, H - 60, 0, H);
  fb.addColorStop(0, 'rgba(15,8,8,0)'); fb.addColorStop(1, 'rgba(15,8,8,0.95)');
  ctx.fillStyle = fb; ctx.fillRect(0, H - 60, W, 60);
}

// --- グリッドビュー ---
function drawGridView(now) {
  const halfC = Math.floor(VIEW_COLS / 2);
  const halfR = Math.floor(VIEW_ROWS / 2);

  for (let vr = 0; vr < VIEW_ROWS; vr++) {
    for (let vc = 0; vc < VIEW_COLS; vc++) {
      const gc = camCol - halfC + vc;
      const gr = camRow - halfR + vr;
      if (gc < 0 || gc >= CFG.COLS || gr < 0 || gr >= CFG.ROWS) {
        // 範囲外は黒
        const px = GRID_OX + vc * CFG.TILE;
        const py = GRID_OY + vr * CFG.TILE;
        ctx.fillStyle = '#0F0808';
        ctx.fillRect(px, py, CFG.TILE, CFG.TILE);
        continue;
      }

      const fog = fogMap[gr][gc];
      if (fog === 0) {
        // 未踏→黒
        const px = GRID_OX + vc * CFG.TILE;
        const py = GRID_OY + vr * CFG.TILE;
        ctx.fillStyle = '#0F0808';
        ctx.fillRect(px, py, CFG.TILE, CFG.TILE);
        continue;
      }

      const px = GRID_OX + vc * CFG.TILE;
      const py = GRID_OY + vr * CFG.TILE;
      const cell = grid[gr][gc];
      const dim = fog === 1; // 既踏：暗め

      ctx.save();
      if (dim) ctx.globalAlpha = 0.4;

      if (cell === 'W') {
        // 肉壁
        const pulse = Math.sin(wallPulse * 1.2 + gc * 0.3 + gr * 0.5) * (dim ? 0 : 1);
        ctx.fillStyle = '#5C2A2A';
        ctx.fillRect(px, py, CFG.TILE, CFG.TILE);
        if (!dim) {
          ctx.fillStyle = '#8B4040';
          ctx.fillRect(px + 2, py + 2, CFG.TILE - 4, 3 + pulse);
        }
        ctx.strokeStyle = '#3B1A1A';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, CFG.TILE, CFG.TILE);
      } else {
        // 床
        ctx.fillStyle = gc % 2 === gr % 2 ? '#2A1010' : '#251010';
        ctx.fillRect(px, py, CFG.TILE, CFG.TILE);
        ctx.strokeStyle = 'rgba(139,64,64,0.2)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, CFG.TILE, CFG.TILE);

        if (cell === 'T') {
          // この座標の罠データを取得して hidden/revealed を判定
          const trapData = traps.find(t => t.col === gc && t.row === gr);
          const isVisible = !trapData || !trapData.hidden || trapData.revealed;
          // 見える罠：可視(fog2)なら炎グロー、既踏(fog1)なら薄橙
          // 隠し罠：reveal済みなら同じ表示、未revealなら普通の床（描画しない）
          if (isVisible) {
            if (!dim) {
              const glow = Math.sin(now * 0.004 + gc + gr) * 0.15 + 0.85;
              const tg = ctx.createRadialGradient(px+CFG.TILE/2,py+CFG.TILE/2,2, px+CFG.TILE/2,py+CFG.TILE/2,CFG.TILE/2);
              tg.addColorStop(0,'#FF8C00'); tg.addColorStop(0.6,'#FF4500'); tg.addColorStop(1,'#CC2200');
              ctx.fillStyle = tg; ctx.fillRect(px, py, CFG.TILE, CFG.TILE);
              ctx.strokeStyle = `rgba(255,140,0,${glow})`; ctx.lineWidth = 1.5;
              ctx.strokeRect(px+1, py+1, CFG.TILE-2, CFG.TILE-2);
            } else {
              // 既踏・見える罠は薄く残す
              ctx.fillStyle = 'rgba(255,69,0,0.5)';
              ctx.fillRect(px, py, CFG.TILE, CFG.TILE);
            }
          }
          // 隠し罠で未reveal → 普通の床として描画済み（追加描画なし）
        }

        if (cell === 'G') {
          const ep = Math.sin(now * 0.004) * 0.25 + 0.75;
          const exitGrad = ctx.createRadialGradient(px+CFG.TILE/2,py+CFG.TILE/2,0, px+CFG.TILE/2,py+CFG.TILE/2,CFG.TILE/2);
          exitGrad.addColorStop(0, `rgba(255,200,50,${ep * 0.9})`);
          exitGrad.addColorStop(0.5, `rgba(255,140,0,${ep * 0.6})`);
          exitGrad.addColorStop(1, 'rgba(100,40,0,0)');
          ctx.fillStyle = exitGrad;
          ctx.fillRect(px, py, CFG.TILE, CFG.TILE);
          if (!dim) {
            ctx.shadowBlur = 16 * ep; ctx.shadowColor = '#FFD700';
            ctx.fillStyle = '#FFD700';
            ctx.font = `bold ${Math.floor(CFG.TILE * 0.35)}px sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('出', px + CFG.TILE/2, py + CFG.TILE/2);
            ctx.shadowBlur = 0;
          }
        }
      }

      ctx.restore();
    }
  }

  // 敵の攻撃予告（可視マスのみ）
  for (const e of enemies) {
    if (!e.alive || e.warnCol < 0) continue;
    if (fogMap[e.warnRow][e.warnCol] < 2) continue;
    const sp = tileToScreen(e.warnCol, e.warnRow, camCol, camRow);
    const blink = Math.floor(now / 250) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.85 : 0.45;
    ctx.translate(sp.x, sp.y);
    ctx.rotate(Math.PI / 4);
    const ms = CFG.TILE * 0.6;
    ctx.fillStyle = 'rgba(255,40,0,0.5)';
    ctx.fillRect(-ms/2,-ms/2,ms,ms);
    ctx.strokeStyle = blink ? '#FFFF00' : '#FF2200';
    ctx.lineWidth = 2;
    if (blink) { ctx.shadowBlur = 8; ctx.shadowColor = '#FF4400'; }
    ctx.strokeRect(-ms/2,-ms/2,ms,ms);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ボス（心ノ臓）のスラム予告：周囲マスを赤く点滅＝「ここから逃げろ」
  for (const e of enemies) {
    if (!e.alive || e.type !== 'boss' || !e.slamTiles || !e.slamTiles.length) continue;
    const blink = Math.floor(now / 200) % 2 === 0;
    for (const [c, r] of e.slamTiles) {
      if (r < 0 || r >= CFG.ROWS || c < 0 || c >= CFG.COLS || fogMap[r][c] < 2) continue;
      const sp = tileToScreen(c, r, camCol, camRow);
      ctx.save();
      ctx.globalAlpha = blink ? 0.5 : 0.26;
      ctx.fillStyle = '#FF2030';
      ctx.fillRect(sp.x - CFG.TILE / 2, sp.y - CFG.TILE / 2, CFG.TILE, CFG.TILE);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = blink ? '#FFEE40' : '#FF4040';
      ctx.lineWidth = 2;
      ctx.strokeRect(sp.x - CFG.TILE / 2 + 2, sp.y - CFG.TILE / 2 + 2, CFG.TILE - 4, CFG.TILE - 4);
      ctx.restore();
    }
  }

  // 攻撃エフェクト
  if (atkEffect) drawAtkEffect(now);
}

// --- 攻撃エフェクト ---
function drawAtkEffect(now) {
  const ef = atkEffect;
  if (!ef) return;

  // パーティクル（黄色い欠片）
  for (const p of ef.particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = '#F5C842';
    ctx.shadowBlur = 6; ctx.shadowColor = '#F5C842';
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // フラッシュ（命中位置）
  if (ef.phase === 'flash') {
    const ratio = ef.timer / CFG.ATK_FLASH_MS;
    ctx.save();
    ctx.globalAlpha = ratio * 0.8;
    ctx.fillStyle = '#FFFF88';
    ctx.shadowBlur = 20; ctx.shadowColor = '#F5C842';
    ctx.beginPath();
    ctx.arc(ef.toX, ef.toY, CFG.TILE * 0.5 * ratio, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// --- デカル ---
function drawDecals() {
  for (const d of player.decals) {
    if (!isOnScreen(d.col, d.row, camCol, camRow)) continue;
    const sp = tileToScreen(d.col, d.row, camCol, camRow);
    const alpha = Math.min(1, d.timer / 500);
    ctx.save(); ctx.globalAlpha = alpha;
    if (d.type === 'hat')   drawHatAt(sp.x, sp.y - CFG.TILE * 0.3);
    if (d.type === 'cream') drawCreamDropAt(sp.x, sp.y);
    ctx.restore();
  }
}

// --- 敵 ---
function drawEnemies(now) {
  for (const e of enemies) {
    if (!e.alive) continue;
    if (!isOnScreen(e.col, e.row, camCol, camRow)) continue;
    if (fogMap[e.row][e.col] < 2) continue; // 未踏・既踏は描かない
    const sp = tileToScreen(e.col, e.row, camCol, camRow);
    const x = sp.x, y = sp.y;
    const sz = CFG.TILE * 0.72;
    const gdx = Math.sign(player.col - e.col), gdy = Math.sign(player.row - e.row);

    ctx.save();
    // 被弾フラッシュ
    if (e.flashTimer > 0) { ctx.filter = 'brightness(300%) saturate(0%)'; }

    // ボス（心ノ臓）：大きく脈打つ心臓・別グラフィックで描いて終了
    if (e.type === 'boss') { drawBoss(x, y, sz, e, now); ctx.restore(); continue; }
    // 牙（fang）：小さく脆い・別グラフィックで描いて終了
    if (e.type === 'fang') { drawFang(x, y, sz, e, gdx, gdy); ctx.restore(); continue; }
    // 肉塊（blob）：大きく硬い壁役・別グラフィックで描いて終了
    if (e.type === 'blob') { drawBlob(x, y, sz, e, gdx, gdy, now); ctx.restore(); continue; }

    // 体（騎士 knight）
    ctx.fillStyle = '#882200';
    ctx.strokeStyle = '#D4C5A9'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, sz/2, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();

    // 亀裂（ダメージ表現）
    ctx.filter = 'none';
    if (e.hp < e.hpMax) {
      ctx.strokeStyle = e.hp <= 1 ? 'rgba(255,200,0,0.9)' : 'rgba(0,0,0,0.7)';
      ctx.lineWidth = e.hp <= 1 ? 2 : 1.5;
      ctx.beginPath();
      if (e.hp <= 1) {
        // 崩れかけ：大きな亀裂3本
        ctx.moveTo(x-sz*0.3, y-sz*0.3); ctx.lineTo(x+sz*0.1, y+sz*0.1);
        ctx.moveTo(x+sz*0.2, y-sz*0.35); ctx.lineTo(x-sz*0.1, y+sz*0.2);
        ctx.moveTo(x-sz*0.1, y-sz*0.1); ctx.lineTo(x+sz*0.3, y+sz*0.25);
      } else {
        // 亀裂1本
        ctx.moveTo(x-sz*0.2, y-sz*0.25); ctx.lineTo(x+sz*0.15, y+sz*0.15);
      }
      ctx.stroke();
    }

    // 鎧十字
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x-sz/3,y); ctx.lineTo(x+sz/3,y);
    ctx.moveTo(x,y-sz/3); ctx.lineTo(x,y+sz/3);
    ctx.stroke();

    // にらむ目：プレイヤー方向へ目を寄せる＝「こっちを狙ってる」圧
    const gx = x + gdx * sz*0.16, gy = y + gdy * sz*0.16;
    ctx.fillStyle = '#FFD24A';
    ctx.shadowBlur = 4; ctx.shadowColor = '#FF6A00';
    ctx.beginPath();
    ctx.arc(gx - sz*0.13, gy, sz*0.075, 0, Math.PI*2);
    ctx.arc(gx + sz*0.13, gy, sz*0.075, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // いかり眉（吊り上げ）
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(gx - sz*0.22, gy - sz*0.15); ctx.lineTo(gx - sz*0.05, gy - sz*0.04);
    ctx.moveTo(gx + sz*0.22, gy - sz*0.15); ctx.lineTo(gx + sz*0.05, gy - sz*0.04);
    ctx.stroke();

    // 炎
    const fl = Math.sin(now*0.008)*2;
    ctx.fillStyle = 'rgba(255,100,0,0.55)';
    ctx.beginPath(); ctx.arc(x, y-sz/2-2+fl, 4, 0, Math.PI*2); ctx.fill();

    ctx.restore();
  }
}

// 牙（fang）：骨色の小型＋白い歯＋赤く光るにらみ目（プレイヤー方向）。HP1で脆いが予告なし噛み
function drawFang(x, y, sz, e, gdx, gdy) {
  const r = sz * 0.30;          // 騎士より小さい
  const cy = y - r * 0.15;
  // 体（骨色）
  ctx.fillStyle = '#E8E0C8';
  ctx.strokeStyle = '#6B0000'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  // 牙（下にギザギザの白い歯）
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#6B0000'; ctx.lineWidth = 1;
  const teeth = 4, span = r * 1.5, tw = span / teeth, ty = cy + r * 0.55;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const tx = x - span / 2 + i * tw;
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + tw / 2, ty + sz * 0.18);
    ctx.lineTo(tx + tw, ty);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // にらむ目（プレイヤー方向・赤く光る・鋭い）
  const ex = x + gdx * r * 0.4, ey = cy + gdy * r * 0.4;
  ctx.fillStyle = '#FF2A00';
  ctx.shadowBlur = 5; ctx.shadowColor = '#FF3000';
  ctx.beginPath();
  ctx.arc(ex - r * 0.34, ey, r * 0.17, 0, Math.PI*2);
  ctx.arc(ex + r * 0.34, ey, r * 0.17, 0, Math.PI*2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// ハート形（2つの円＝コブ＋下向き三角＝先端、を同色で塗ってシルエットに）
function fillHeart(cx, cy, R) {
  const r = R * 0.48, ly = cy - R * 0.18;
  ctx.beginPath(); ctx.arc(cx - r * 0.92, ly, r, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.92, ly, r, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - r * 1.84, ly);
  ctx.lineTo(cx + r * 1.84, ly);
  ctx.lineTo(cx, cy + R * 0.95);
  ctx.closePath(); ctx.fill();
}

// ボス＝心ノ臓：大きく脈打つ巨大な心臓。激化で鼓動が速く・赤く。HP低下で亀裂、頭上にHPピップ
function drawBoss(x, y, sz, e, now) {
  const beat = e.enraged ? 0.16 : 0.09;
  const speed = e.enraged ? 0.012 : 0.006;
  const pulse = 1 + Math.sin(now * speed) * beat;
  const R = sz * 0.82 * pulse; // 1マスより大きく描く
  // 本体（グロー付き）
  ctx.shadowBlur = 18; ctx.shadowColor = e.enraged ? '#FF2030' : '#AA1020';
  ctx.fillStyle = e.enraged ? '#C81830' : '#9C1228';
  fillHeart(x, y, R);
  ctx.shadowBlur = 0;
  // 血管
  ctx.strokeStyle = 'rgba(74,8,16,0.7)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - R * 0.18, y - R * 0.1); ctx.lineTo(x - R * 0.04, y + R * 0.45);
  ctx.moveTo(x + R * 0.18, y - R * 0.1); ctx.lineTo(x + R * 0.04, y + R * 0.45);
  ctx.stroke();
  // ダメージ亀裂（HPが減るほど濃く）
  const dmg = 1 - e.hp / e.hpMax;
  if (dmg > 0) {
    ctx.strokeStyle = 'rgba(255,220,120,' + (0.4 + dmg * 0.5).toFixed(2) + ')';
    ctx.lineWidth = 1.5 + dmg * 2;
    ctx.beginPath();
    ctx.moveTo(x - R * 0.3, y - R * 0.2); ctx.lineTo(x + R * 0.1, y + R * 0.25);
    if (dmg > 0.5) { ctx.moveTo(x + R * 0.28, y - R * 0.25); ctx.lineTo(x - R * 0.08, y + R * 0.28); }
    ctx.stroke();
  }
  // HPピップ（頭上）
  const n = e.hpMax, w = 7, gap = 2, totalW = n * w + (n - 1) * gap;
  const sx = x - totalW / 2, hy = y - sz * 1.0;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i < e.hp ? '#FF4060' : '#3A0810';
    ctx.fillRect(sx + i * (w + gap), hy, w, 5);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(sx + i * (w + gap), hy, w, 5);
  }
}

// 肉塊（blob）：大きくボコボコの肉・鈍重・重いまぶたのにらみ目。HP3でダメージ亀裂あり
function drawBlob(x, y, sz, e, gdx, gdy, now) {
  const R = sz * 0.52;          // 騎士より大きい
  const wob = Math.sin(now * 0.003 + e.col * 0.7 + e.row * 0.5) * (R * 0.05); // ぷるぷる
  // ボコボコの肉塊（円周にコブ）
  ctx.fillStyle = '#7A2233';
  ctx.strokeStyle = '#3A0E18'; ctx.lineWidth = 2;
  ctx.beginPath();
  const bumps = 9;
  for (let i = 0; i <= bumps; i++) {
    const a = (i / bumps) * Math.PI * 2;
    const rr = R + Math.sin(a * 3 + e.row) * (R * 0.10) + wob;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 明るいコブ（粒）
  ctx.fillStyle = 'rgba(180,80,100,0.5)';
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + e.col;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * R * 0.4, y + Math.sin(a) * R * 0.4, R * 0.13, 0, Math.PI*2);
    ctx.fill();
  }
  // ダメージ亀裂（HP3なので減ると見える）
  if (e.hp < e.hpMax) {
    ctx.strokeStyle = e.hp <= 1 ? 'rgba(255,210,80,0.9)' : 'rgba(0,0,0,0.55)';
    ctx.lineWidth = e.hp <= 1 ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x - R * 0.4, y - R * 0.3); ctx.lineTo(x + R * 0.1, y + R * 0.2);
    if (e.hp <= 1) { ctx.moveTo(x + R * 0.3, y - R * 0.35); ctx.lineTo(x - R * 0.05, y + R * 0.3); }
    ctx.stroke();
  }
  // にらむ目（プレイヤー方向・重いまぶた）
  const ex = x + gdx * R * 0.3, ey = y + gdy * R * 0.3;
  ctx.fillStyle = '#FFE36A';
  ctx.shadowBlur = 4; ctx.shadowColor = '#FF8A00';
  ctx.beginPath();
  ctx.arc(ex - R * 0.22, ey, R * 0.1, 0, Math.PI*2);
  ctx.arc(ex + R * 0.22, ey, R * 0.1, 0, Math.PI*2);
  ctx.fill(); ctx.shadowBlur = 0;
  // ぶ厚いまぶた（重い印象）
  ctx.strokeStyle = '#3A0E18'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ex - R * 0.34, ey - R * 0.06); ctx.lineTo(ex - R * 0.10, ey - R * 0.12);
  ctx.moveTo(ex + R * 0.34, ey - R * 0.06); ctx.lineTo(ex + R * 0.10, ey - R * 0.12);
  ctx.stroke();
}

// --- プレイヤー ---
function drawPlayer(now) {
  const sp = tileToScreen(player.col, player.row, camCol, camRow);
  const x = sp.x, y = sp.y;

  // 無敵点滅
  if (player.invincible > 0) {
    if (Math.floor(now / CFG.BLINK_MS) % 2 === 0) return;
  }

  const s = Math.floor(CFG.TILE * 0.72);
  const hp = player.hp;
  const melt = player.status === 'melted';

  // スクワッシュ（攻撃エフェクト）
  let scaleX = 1, scaleY = 1;
  if (atkEffect && atkEffect.phase === 'squish') {
    const ratio = 1 - atkEffect.timer / CFG.ATK_SQUISH_MS;
    scaleX = 1 + ratio * 0.25 * atkEffect.dc;
    scaleY = 1 + ratio * 0.25 * atkEffect.dr;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scaleX || 1, scaleY || 1);
  ctx.translate(-x, -y);

  if (melt) ctx.globalAlpha = 0.75;
  if (hp <= 1) { ctx.shadowBlur = 14; ctx.shadowColor = '#CC0000'; }

  const bodyW = s * 1.2, bodyH = s * 0.9, bottomW = s * 1.5;

  ctx.fillStyle = '#C8922A';
  ctx.beginPath();
  ctx.moveTo(x-bodyW/2, y-bodyH/2); ctx.lineTo(x+bodyW/2, y-bodyH/2);
  ctx.lineTo(x+bottomW/2, y+bodyH/2); ctx.lineTo(x-bottomW/2, y+bodyH/2);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#F5C842';
  ctx.beginPath();
  ctx.moveTo(x-bodyW/2+3, y-bodyH/2+3); ctx.lineTo(x+bodyW/2-3, y-bodyH/2+3);
  ctx.lineTo(x+bottomW/2-5, y+bodyH/2-2); ctx.lineTo(x-bottomW/2+5, y+bodyH/2-2);
  ctx.closePath(); ctx.fill();

  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x-bodyW/2, y-bodyH/2); ctx.lineTo(x+bodyW/2, y-bodyH/2);
  ctx.lineTo(x+bottomW/2, y+bodyH/2); ctx.lineTo(x-bottomW/2, y+bodyH/2);
  ctx.closePath(); ctx.stroke();

  if (hp <= 1) {
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x-3, y-bodyH/2+4); ctx.lineTo(x+1, y+3); ctx.lineTo(x+4, y+bodyH/2-2);
    ctx.stroke();
  }

  const eyeY = y - 3, eyeOff = Math.floor(s * 0.22);
  // シレン式の向き表現：上=後ろ向き(顔を隠す)、左右=顔を強めにその側へ、下/静止=正面
  const facingUp = player.faceY < 0;
  const face = player.faceX * Math.round(s * 0.20); // 横向きは強めに振る
  if (facingUp) {
    // 後ろを向く＝顔を見せず、背中の縫い目だけ。HP1のヒビ・赤グローはbody側に残るのでダメージ表現は維持
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - bodyH*0.28); ctx.lineTo(x, y + bodyH*0.34);
    ctx.stroke();
  } else {
  ctx.save();
  ctx.translate(face, 0);
  if (hp <= 1) {
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x-eyeOff-3,eyeY-3); ctx.lineTo(x-eyeOff+3,eyeY+3);
    ctx.moveTo(x-eyeOff+3,eyeY-3); ctx.lineTo(x-eyeOff-3,eyeY+3);
    ctx.moveTo(x+eyeOff-3,eyeY-3); ctx.lineTo(x+eyeOff+3,eyeY+3);
    ctx.moveTo(x+eyeOff+3,eyeY-3); ctx.lineTo(x+eyeOff-3,eyeY+3);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x, eyeY+8, 3, 0.2*Math.PI, 0.8*Math.PI, false); ctx.stroke();
  } else {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x-eyeOff,eyeY,2.5,0,Math.PI*2); ctx.arc(x+eyeOff,eyeY,2.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,180,160,0.6)';
    ctx.beginPath();
    ctx.arc(x-eyeOff-4,eyeY+5,3,0,Math.PI*2); ctx.arc(x+eyeOff+4,eyeY+5,3,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, eyeY+8, 4, 0.1*Math.PI, 0.9*Math.PI, false); ctx.stroke();
  }
  ctx.restore();
  }

  if (player.hasCream) {
    ctx.fillStyle = '#FFF8E7'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y-bodyH/2-2, 7, Math.PI, 0, false);
    ctx.lineTo(x+7, y-bodyH/2-2); ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (hp === 2) { ctx.fillStyle = '#FFF8E7'; ctx.fillRect(x+3, y-bodyH/2-2, 3, 6); }
  }
  if (player.hasHat) drawHatAt(x, y - bodyH/2 - 7);

  if (melt) {
    ctx.globalAlpha = 0.45; ctx.fillStyle = '#F5C842';
    ctx.beginPath();
    ctx.ellipse(x, y+bodyH/2+3, bottomW/2+1, 4, 0, 0, Math.PI*2);
    ctx.fill(); ctx.globalAlpha = 0.75;
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawHatAt(x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#CC2200'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-6,0); ctx.lineTo(6,0); ctx.lineTo(4,-9); ctx.lineTo(-4,-9); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillRect(-8,0,16,2.5); ctx.strokeRect(-8,0,16,2.5);
  ctx.restore();
}

function drawCreamDropAt(x, y) {
  ctx.fillStyle = '#FFF8E7'; ctx.strokeStyle = '#888'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI*2); ctx.fill(); ctx.stroke();
}

// --- HUD ---
function drawHUD(now) {
  ctx.fillStyle = 'rgba(15,8,8,0.78)';
  ctx.fillRect(0, 0, W, HUD_H);

  // HP
  for (let i = 0; i < CFG.PLAYER_HP_MAX; i++) {
    ctx.fillStyle = i < player.hp ? '#F5C842' : '#5C2A2A';
    ctx.beginPath(); ctx.arc(18 + i*26, 18, 9, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; ctx.stroke();
  }

  // 階層（HPの右）
  const floorLabel = currentFloor >= CFG.BOSS_FLOOR ? 'ボスのま' : 'ちか ' + currentFloor + ' かい';
  ctx.fillStyle = currentFloor >= CFG.BOSS_FLOOR ? '#FF6A4A' : 'rgba(245,200,66,0.9)';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(floorLabel, 96, 18);

  // 状態
  if (player.status === 'melted') {
    ctx.fillStyle = '#FF8C00'; ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('溶けてる！', W/2, 6);
  }

  // 敵数
  const alive = enemies.filter(e => e.alive).length;
  ctx.fillStyle = 'rgba(212,197,169,0.7)'; ctx.font = '12px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(alive > 0 ? `まものが ${alive} たい いる` : '! まものたおした！', W/2, 32);

  // 無敵残り
  if (player.invincible > 0) {
    ctx.fillStyle = 'rgba(168,216,234,0.9)'; ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText(`むてき ${player.invincible}`, W - 8, 6);
  }
}

// --- コントロール ---
function drawControls(now) {
  const r = getCtrlRects();

  // 下部背景
  ctx.fillStyle = 'rgba(15,8,8,0.55)';
  ctx.fillRect(0, H - CTRL_H, W, CTRL_H);

  // 十字
  const arrows = { up:'▲', down:'▼', left:'◀', right:'▶' };
  for (const d of ['up','down','left','right']) {
    const btn = r[d];
    ctx.fillStyle = 'rgba(92,42,42,0.75)'; ctx.strokeStyle = 'rgba(212,197,169,0.5)'; ctx.lineWidth = 1.5;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#D4C5A9'; ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(arrows[d], btn.x+btn.w/2, btn.y+btn.h/2);
  }

  // 攻撃ボタン（右下・大きめ・赤）
  const atk = r.attack;
  ctx.fillStyle = 'rgba(160,20,0,0.8)'; ctx.strokeStyle = 'rgba(255,100,0,0.7)'; ctx.lineWidth = 2;
  roundRect(ctx, atk.x, atk.y, atk.w, atk.h, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FFF8E7'; ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('こうげき', atk.x+atk.w/2, atk.y+atk.h/2 - 6);
  ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(255,220,180,0.8)';
  ctx.fillText('ちかくの まもの', atk.x+atk.w/2, atk.y+atk.h/2 + 10);

  // 待機ボタン
  const wt = r.wait;
  ctx.fillStyle = 'rgba(60,30,30,0.7)'; ctx.strokeStyle = 'rgba(212,197,169,0.35)'; ctx.lineWidth = 1.2;
  roundRect(ctx, wt.x, wt.y, wt.w, wt.h, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(212,197,169,0.8)'; ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('⏳まつ', wt.x+wt.w/2, wt.y+wt.h/2);

  // マップボタン
  const mp = r.map;
  ctx.fillStyle = 'rgba(30,50,60,0.7)'; ctx.strokeStyle = 'rgba(168,216,234,0.35)'; ctx.lineWidth = 1.2;
  roundRect(ctx, mp.x, mp.y, mp.w, mp.h, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(168,216,234,0.85)'; ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🗺 ちず', mp.x+mp.w/2, mp.y+mp.h/2);

  // PCヒント
  ctx.fillStyle = 'rgba(212,197,169,0.3)'; ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASD/矢印・J=攻撃・M=マップ・スペース=待機', W/2, H - 6);
}

// --- ミニマップ ---
function drawMinimap(now) {
  const MM = 3; // 1マス=3px
  const mmW = CFG.COLS * MM, mmH = CFG.ROWS * MM;
  const mmX = Math.floor((W - mmW) / 2), mmY = Math.floor((H - mmH) / 2 - 20);

  // 背景
  ctx.fillStyle = 'rgba(15,8,8,0.88)';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(mmX, mmY);

  for (let r = 0; r < CFG.ROWS; r++) {
    for (let c = 0; c < CFG.COLS; c++) {
      const fog = fogMap[r][c];
      if (fog === 0) { ctx.fillStyle = '#0F0808'; }
      else if (grid[r][c] === 'W') { ctx.fillStyle = fog === 2 ? '#5C2A2A' : '#3A1A1A'; }
      else if (grid[r][c] === 'G' && fog >= 1) { ctx.fillStyle = '#FFD700'; }
      else if (grid[r][c] === 'T' && fog >= 1) { ctx.fillStyle = '#FF4500'; }
      else { ctx.fillStyle = fog === 2 ? '#4A2A2A' : '#2E1414'; }
      ctx.fillRect(c * MM, r * MM, MM, MM);
    }
  }

  // 現在地（橙・点滅）
  const blinkOn = Math.floor(now / 300) % 2 === 0;
  if (blinkOn) {
    ctx.fillStyle = '#FF8C00';
    ctx.fillRect(player.col * MM - 1, player.row * MM - 1, MM + 2, MM + 2);
  }

  ctx.restore();

  ctx.fillStyle = 'rgba(212,197,169,0.8)'; ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('ちず', W/2, mmY - 22);
  ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(212,197,169,0.5)';
  ctx.fillText('どこかタップ / M で とじる', W/2, mmY + mmH + 8);
}

// --- タイトル ---
// タイトルの難易度ボタン矩形（Canvas座標）
function getTitleRects() {
  const bw = 152, bh = 58, gap = 14, cy = H * 0.68;
  return {
    easy: { x: W/2 - bw - gap/2, y: cy, w: bw, h: bh },
    hard: { x: W/2 + gap/2,      y: cy, w: bw, h: bh },
  };
}

function drawTitle(now) {
  ctx.fillStyle = 'rgba(15,8,8,0.65)'; ctx.fillRect(0,0,W,H);
  ctx.shadowBlur = 18; ctx.shadowColor = '#CC2200';
  ctx.fillStyle = '#F5C842'; ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('PUDDING', W/2, H*0.25);
  ctx.fillStyle = '#CC2200'; ctx.font = 'bold 46px sans-serif';
  ctx.fillText('INFERNO', W/2, H*0.25+50);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#F5C842'; ctx.font = 'bold 18px sans-serif';
  ctx.fillText(CFG.VERSION, W/2, H*0.25+96);

  // ミニプリン
  ctx.save(); ctx.translate(W/2, H*0.52); ctx.scale(2.0, 2.0);
  ctx.fillStyle = '#C8922A';
  ctx.beginPath(); ctx.moveTo(-18,-14); ctx.lineTo(18,-14); ctx.lineTo(24,14); ctx.lineTo(-24,14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#F5C842';
  ctx.beginPath(); ctx.moveTo(-15,-12); ctx.lineTo(15,-12); ctx.lineTo(21,12); ctx.lineTo(-21,12); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#000'; ctx.lineWidth=0.8; ctx.stroke();
  ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(-6,-3,2.5,0,Math.PI*2); ctx.arc(6,-3,2.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#FFF8E7'; ctx.beginPath(); ctx.arc(0,-14,7,Math.PI,0,false); ctx.fill();
  ctx.fillStyle='#CC2200'; ctx.beginPath(); ctx.moveTo(-5,-22); ctx.lineTo(5,-22); ctx.lineTo(4,-30); ctx.lineTo(-4,-30); ctx.closePath(); ctx.fill();
  ctx.fillRect(-7,-22,14,2); ctx.restore();

  // 難易度ボタン（タップでその難易度でスタート）
  const tr = getTitleRects();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='rgba(212,197,169,0.75)'; ctx.font='13px sans-serif';
  ctx.fillText('むずかしさを えらんで スタート', W/2, tr.easy.y - 20);
  // やさしい
  ctx.fillStyle='rgba(40,110,80,0.9)'; ctx.strokeStyle='rgba(150,230,190,0.85)'; ctx.lineWidth=2;
  roundRect(ctx, tr.easy.x, tr.easy.y, tr.easy.w, tr.easy.h, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#EAFBF0'; ctx.font='bold 19px sans-serif';
  ctx.fillText('やさしい', tr.easy.x + tr.easy.w/2, tr.easy.y + 21);
  ctx.font='11px sans-serif'; ctx.fillStyle='rgba(234,251,240,0.85)';
  ctx.fillText('しんだ かいから', tr.easy.x + tr.easy.w/2, tr.easy.y + 42);
  // ハード
  ctx.fillStyle='rgba(150,30,20,0.9)'; ctx.strokeStyle='rgba(255,130,100,0.85)'; ctx.lineWidth=2;
  roundRect(ctx, tr.hard.x, tr.hard.y, tr.hard.w, tr.hard.h, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#FFF0EA'; ctx.font='bold 19px sans-serif';
  ctx.fillText('ハード', tr.hard.x + tr.hard.w/2, tr.hard.y + 21);
  ctx.font='11px sans-serif'; ctx.fillStyle='rgba(255,240,234,0.85)';
  ctx.fillText('さいしょから', tr.hard.x + tr.hard.w/2, tr.hard.y + 42);

  ctx.fillStyle='rgba(212,197,169,0.4)'; ctx.font='12px sans-serif';
  ctx.fillText('ターン制グリッド探索版', W/2, H*0.86);
}

// --- クリア ---
function drawClear(now) {
  ctx.fillStyle='rgba(15,8,8,0.8)'; ctx.fillRect(0,0,W,H);
  ctx.shadowBlur=16; ctx.shadowColor='#F5C842';
  ctx.fillStyle='#F5C842'; ctx.font='bold 42px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('クリア！', W/2, H/2-50);
  ctx.shadowBlur=0;
  ctx.fillStyle='#D4C5A9'; ctx.font='16px sans-serif';
  ctx.fillText('まかいのからだのなかを', W/2, H/2+0);
  ctx.fillText('だっしゅつした！', W/2, H/2+24);
  if (clearTimer>1200) {
    const blink=Math.floor(now/600)%2===0;
    if (blink) {
      ctx.fillStyle='#F5C842'; ctx.font='bold 18px sans-serif';
      ctx.fillText('タップ / クリックでもういちど', W/2, H/2+80);
    }
  }
}

// --- 死亡 ---
function drawDeath(now) {
  ctx.fillStyle='rgba(15,8,8,0.88)'; ctx.fillRect(0,0,W,H);
  const cx=W/2, cy=H/2;
  if (deathPhase===0) {
    drawCorpse(cx,cy,1,1);
  } else if (deathPhase===1) {
    const t=deathTimer/1500;
    ctx.globalAlpha=1-t*0.8;
    drawCorpse(cx,cy,1-t*0.5,1);
    ctx.globalAlpha=1;
    ctx.fillStyle=`rgba(245,200,66,${t*0.55})`;
    ctx.beginPath(); ctx.ellipse(cx,cy+22,t*38+4,t*9+2,0,0,Math.PI*2); ctx.fill();
  } else if (deathPhase>=2) {
    drawPlate(cx,cy+22);
    if (deathPhase>=3) {
      ctx.fillStyle='#D4C5A9'; ctx.font='bold 22px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('また ちょうせんするか？', cx, cy-55);
      ctx.fillStyle='rgba(212,197,169,0.5)'; ctx.font='13px sans-serif';
      ctx.fillText('プリンくんは まかいのおくで さらだけが のこった…', cx, cy-28);
      // どこから再開するか（難易度）
      ctx.fillStyle='rgba(168,216,234,0.75)'; ctx.font='12px sans-serif';
      ctx.fillText(difficulty === 'easy' ? ('ちか ' + currentFloor + ' かいから やりなおせる') : 'ハード：さいしょ（ちか1かい）から', cx, cy-6);
    }
    if (deathRetryVisible) {
      ctx.fillStyle='#CC2200'; ctx.strokeStyle='#FF8C00'; ctx.lineWidth=2;
      roundRect(ctx,cx-80,cy+55,160,46,10); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#FFF8E7'; ctx.font='bold 17px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('もう一度', cx, cy+78);
    }
  }
}

function drawCorpse(x,y,scale) {
  ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
  ctx.fillStyle='#C8922A';
  ctx.beginPath(); ctx.moveTo(-20,-15); ctx.lineTo(20,-15); ctx.lineTo(26,15); ctx.lineTo(-26,15); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#F5C842';
  ctx.beginPath(); ctx.moveTo(-17,-13); ctx.lineTo(17,-13); ctx.lineTo(23,13); ctx.lineTo(-23,13); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#000'; ctx.lineWidth=1.8; ctx.stroke();
  ctx.strokeStyle='#000'; ctx.lineWidth=1.8;
  ctx.beginPath();
  ctx.moveTo(-9,-5); ctx.lineTo(-3,1); ctx.moveTo(-3,-5); ctx.lineTo(-9,1);
  ctx.moveTo(3,-5);  ctx.lineTo(9,1);  ctx.moveTo(9,-5);  ctx.lineTo(3,1);
  ctx.stroke();
  ctx.restore();
}

function drawPlate(x,y) {
  ctx.save(); ctx.translate(x,y);
  ctx.fillStyle='#B0A090'; ctx.strokeStyle='#000'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.ellipse(0,0,50,10,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle='#D4C5A9'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.ellipse(0,0,44,7,0,0,Math.PI*2); ctx.stroke();
  ctx.restore();
}

// --- ビネット ---
function drawVignette() {
  const rad=ctx.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,H*0.7);
  if (player.hp<=1 && (gameState===STATE.PLAYING||gameState===STATE.ENEMY_ANIM||gameState===STATE.ATK_EFFECT)) {
    rad.addColorStop(0,'rgba(0,0,0,0)');
    rad.addColorStop(0.6,'rgba(80,0,0,0.2)');
    rad.addColorStop(1,'rgba(180,0,0,0.65)');
  } else {
    rad.addColorStop(0,'rgba(0,0,0,0)');
    rad.addColorStop(0.6,'rgba(15,8,8,0.1)');
    rad.addColorStop(1,'rgba(15,8,8,0.65)');
  }
  ctx.fillStyle=rad; ctx.fillRect(0,0,W,H);
}

// --- チュートリアル吹き出し ---
function drawTutoHint(now) {
  if (tuto.timer <= 0 || !tuto.text) return;
  const alpha = Math.min(1, tuto.timer / 300);
  ctx.save();
  ctx.globalAlpha = alpha;
  const bx = W/2, by = H - CTRL_H - 50;
  const tw = ctx.measureText(tuto.text).width + 28;
  ctx.fillStyle = 'rgba(245,200,66,0.9)';
  roundRect(ctx, bx - tw/2, by - 18, tw, 36, 8);
  ctx.fill();
  ctx.fillStyle = '#3B1A1A'; ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(tuto.text, bx, by);
  ctx.restore();
}

// --- あぶない！ ---
function drawDangerText() {
  if (dangerTimer <= 0) return;
  const alpha = Math.min(1, dangerTimer / 200);
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = '#FF4500'; ctx.font = 'bold 26px sans-serif';
  ctx.shadowBlur = 12; ctx.shadowColor = '#FF8C00';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('あぶない！', W/2, HUD_H + VIEW_H/2);
  ctx.shadowBlur = 0; ctx.restore();
}

// --- 長押しヒント ---
function drawHoldHint(now) {
  if (!holdHintShown || holdHintTimer <= 0) return;
  const alpha = Math.min(1, holdHintTimer / 400) * 0.75;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = '#D4C5A9'; ctx.font = '13px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('おしっぱなしで れんぞく いどう！', W/2, H - CTRL_H - 18);
  ctx.restore();
}

// --- ユーティリティ ---
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r);
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r);
  ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}

// ============================================================
// メインループ
// ============================================================
function loop(now) {
  const dt = Math.min(now - lastTime, 50);
  lastTime = now;
  update(dt);
  draw(now);
  requestAnimationFrame(loop);
}

requestAnimationFrame((now) => { lastTime = now; loop(now); });
