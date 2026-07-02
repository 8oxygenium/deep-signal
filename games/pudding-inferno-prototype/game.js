// PUDDING INFERNO v0.1.1
'use strict';

// ============================================================
// CONFIG (難易度チューニング用定数)
// ============================================================
const CONFIG = {
  VERSION: 'v0.1.1',

  // キャンバス
  CANVAS_W: 390,
  CANVAS_H: 844,

  // プリンくん
  PLAYER_SPEED: 3.2,
  PLAYER_SPEED_MELTED: 2.4,
  PLAYER_SPEED_FROZEN: 1.8,
  PLAYER_SIZE: 28,
  PLAYER_HP_MAX: 3,
  BULLET_SPEED: 6,
  BULLET_SIZE: 8,
  BULLET_COOLDOWN: 400, // ms

  // 炎の鎧騎士
  KNIGHT_SIZE: 30,
  KNIGHT_SPEED: 1.2,
  KNIGHT_HP: 3,
  KNIGHT_ATTACK_INTERVAL: 2200, // ms 次の攻撃予告開始まで
  KNIGHT_WARN_DURATION: 1000,   // ms 予告時間
  KNIGHT_WARN_BLINK: 200,       // ms 点滅間隔
  KNIGHT_DAMAGE: 1,

  // 罠
  TRAP_DAMAGE_INTERVAL: 1200,   // ms 罠の再ダメージ間隔

  // ヒット演出
  HIT_FREEZE_MS: 150,
  HIT_VIBRATE_MS: 200,
  HIT_DECAL_MS: 400,

  // 死亡演出
  DEATH_SILENCE_MS: 500,
  DEATH_MELT_MS: 1500,
  DEATH_PLATE_MS: 500,
  DEATH_RETRY_DELAY_MS: 1500,

  // 部屋レイアウト
  ROOM_PADDING: 40,
  TILE_SIZE: 40,

  // スティック
  STICK_RADIUS: 48,
  STICK_KNOB: 20,
  STICK_DEADZONE: 12,

  // ボタン
  BTN_ATTACK_R: 60,
  BTN_SKILL_R: 44,
};

// ============================================================
// ユーティリティ
// ============================================================
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function norm(v) {
  const l = Math.hypot(v.x, v.y);
  if (l < 0.001) return { x: 0, y: 0 };
  return { x: v.x / l, y: v.y / l };
}
function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ============================================================
// キャンバス・リサイズ
// ============================================================
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const W = CONFIG.CANVAS_W;
  const H = CONFIG.CANVAS_H;
  // ビューポートがまだ確定していない（0）瞬間に呼ばれても潰れないようフォールバック
  const vw = window.innerWidth || document.documentElement.clientWidth || W;
  const vh = window.innerHeight || document.documentElement.clientHeight || H;
  const ratio = Math.min(vw / W, vh / H) || 1;
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = Math.floor(W * ratio) + 'px';
  canvas.style.height = Math.floor(H * ratio) + 'px';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('load', resizeCanvas);
// 初期レイアウトが確定する前に0で計測されるケースの保険（iframe/PWA等）
requestAnimationFrame(resizeCanvas);

// ============================================================
// ゲームステート
// ============================================================
const STATE = {
  TITLE: 'TITLE',
  PLAYING: 'PLAYING',
  SKILL_SELECT: 'SKILL_SELECT',
  DEATH: 'DEATH',
};

let gameState = STATE.TITLE;
let currentRoom = 0;
let playerSkills = [];  // 取得スキル一覧
let tutorialStep = 0;   // 部屋0 チュートリアル進行

// ============================================================
// プレイヤー
// ============================================================
const player = {
  x: 0, y: 0,
  vx: 0, vy: 0,
  hp: CONFIG.PLAYER_HP_MAX,
  hpMax: CONFIG.PLAYER_HP_MAX,
  status: 'normal', // 'normal' | 'melted' | 'frozen'
  statusTimer: 0,
  invincible: false,
  invincibleTimer: 0,
  hitFreeze: false,
  hitFreezeTimer: 0,
  facingX: 0, facingY: -1,
  lastBulletTime: 0,
  frozenBarrier: false, // 急速冷凍バリア残り
  // 装飾
  hasHat: true,
  hasCream: true,
  decals: [],       // 落ちた飾り { x,y,timer,type }

  reset() {
    this.x = CONFIG.CANVAS_W / 2;
    this.y = CONFIG.CANVAS_H * 0.6;
    this.hp = CONFIG.PLAYER_HP_MAX;
    this.hpMax = CONFIG.PLAYER_HP_MAX;
    this.status = 'normal';
    this.statusTimer = 0;
    this.invincible = false;
    this.invincibleTimer = 0;
    this.hitFreeze = false;
    this.hitFreezeTimer = 0;
    this.facingX = 0;
    this.facingY = -1;
    this.lastBulletTime = 0;
    this.frozenBarrier = false;
    this.hasHat = true;
    this.hasCream = true;
    this.decals = [];
  },
};

// ============================================================
// 弾
// ============================================================
let bullets = [];
function spawnBullet(x, y, dx, dy, fromPlayer) {
  bullets.push({ x, y, dx, dy, fromPlayer, life: 60 });
}

// ============================================================
// 敵
// ============================================================
let enemies = [];

function createKnight(x, y, dummy) {
  return {
    type: 'knight',
    dummy: !!dummy,
    x, y,
    hp: dummy ? 99 : CONFIG.KNIGHT_HP,
    speed: dummy ? 0.8 : CONFIG.KNIGHT_SPEED,
    warnTimer: 0,
    warnActive: false,
    warnX: 0, warnY: 0,
    attackCooldown: dummy ? 9999 : CONFIG.KNIGHT_ATTACK_INTERVAL,
    timeUntilAttack: dummy ? 9999 : CONFIG.KNIGHT_ATTACK_INTERVAL,
    size: CONFIG.KNIGHT_SIZE,
    phase: 'idle', // 'idle' | 'warn' | 'fire'
    moveAngle: Math.random() * Math.PI * 2,
    moveTimer: 0,
    alive: true,
  };
}

// ============================================================
// 罠
// ============================================================
let traps = [];
let trapDamageTimers = {};

function createTrap(x, y) {
  return { x, y, w: CONFIG.TILE_SIZE, h: CONFIG.TILE_SIZE };
}

// ============================================================
// 部屋定義
// ============================================================
const W = CONFIG.CANVAS_W;
const H = CONFIG.CANVAS_H;
const PAD = CONFIG.ROOM_PADDING;

// 皿（チュートリアル）
let plateGoal = null;
let plateTouched = false;

function setupRoom(roomIndex) {
  enemies = [];
  traps = [];
  trapDamageTimers = {};
  bullets = [];
  plateTouched = false;
  plateGoal = null;
  tutorialStep = 0;

  const cx = W / 2;
  const cy = H / 2;

  if (roomIndex === 0) {
    // チュートリアル：敵なし・罠なし・皿あり
    plateGoal = { x: cx, y: cy - 60, r: 22 };
    // ダミー敵（攻撃しない）
    const dummy = createKnight(cx + 80, cy + 60, true);
    enemies.push(dummy);
  } else if (roomIndex === 1) {
    // 騎士1体のみ
    enemies.push(createKnight(cx, cy - 120));
  } else if (roomIndex === 2) {
    // 騎士2体＋罠2個
    enemies.push(createKnight(cx - 80, cy - 100));
    enemies.push(createKnight(cx + 80, cy - 100));
    traps.push(createTrap(cx - CONFIG.TILE_SIZE / 2, cy + 60));
    traps.push(createTrap(cx + CONFIG.TILE_SIZE * 1.5, cy - 20));
  } else if (roomIndex === 3) {
    // 騎士3体＋罠3個
    enemies.push(createKnight(cx - 100, cy - 130));
    enemies.push(createKnight(cx + 100, cy - 130));
    enemies.push(createKnight(cx, cy - 200));
    traps.push(createTrap(cx - CONFIG.TILE_SIZE / 2, cy + 60));
    traps.push(createTrap(cx + CONFIG.TILE_SIZE * 1.5, cy - 20));
    traps.push(createTrap(cx - CONFIG.TILE_SIZE * 2, cy));
  }

  // プレイヤー配置
  player.x = cx;
  player.y = H - PAD - 60;

  roomCleared = false;
  clearTimer = 0;
}

let roomCleared = false;
let clearTimer = 0;

// ============================================================
// 入力管理
// ============================================================
const input = {
  // スティック
  stickActive: false,
  stickOriginX: 0,
  stickOriginY: 0,
  stickCurX: 0,
  stickCurY: 0,
  stickDX: 0,
  stickDY: 0,
  stickTouchId: -1,

  // 攻撃ボタン
  attackPressed: false,
  attackTouchId: -1,

  // スキルボタン
  skillPressed: false,
  skillTouchId: -1,

  // キーボード
  keys: {},

  // 移動方向（正規化済）
  moveDX: 0,
  moveDY: 0,
  moving: false,
};

// スティックとボタンの領域判定
function isLeftSide(x) { return x < W / 2; }

function getAttackBtnPos() {
  return { x: W - 70, y: H - 100 };
}
function getSkillBtnPos() {
  return { x: W - 70, y: H - 195 };
}

function isBtnHit(tx, ty, btn, r) {
  return Math.hypot(tx - btn.x, ty - btn.y) < r;
}

// タッチ開始
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  for (const t of e.changedTouches) {
    const x = (t.clientX - rect.left) / parseFloat(canvas.style.width) * W;
    const y = (t.clientY - rect.top) / parseFloat(canvas.style.height) * H;
    handlePointerDown(t.identifier, x, y);
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  for (const t of e.changedTouches) {
    const x = (t.clientX - rect.left) / parseFloat(canvas.style.width) * W;
    const y = (t.clientY - rect.top) / parseFloat(canvas.style.height) * H;
    handlePointerMove(t.identifier, x, y);
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    handlePointerUp(t.identifier);
  }
}, { passive: false });

// マウスフォールバック
let mouseId = 9999;
canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / parseFloat(canvas.style.width) * W;
  const y = (e.clientY - rect.top) / parseFloat(canvas.style.height) * H;
  handlePointerDown(mouseId, x, y);
});
canvas.addEventListener('mousemove', (e) => {
  if (e.buttons === 0) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / parseFloat(canvas.style.width) * W;
  const y = (e.clientY - rect.top) / parseFloat(canvas.style.height) * H;
  handlePointerMove(mouseId, x, y);
});
canvas.addEventListener('mouseup', () => handlePointerUp(mouseId));

function handlePointerDown(id, x, y) {
  if (gameState === STATE.TITLE) {
    startGame();
    return;
  }
  if (gameState === STATE.DEATH) {
    // リトライボタン処理はdrawDeath内のフラグで
    if (deathRetryVisible) {
      retryGame();
    }
    return;
  }
  if (gameState === STATE.SKILL_SELECT) {
    handleSkillCardTap(x, y);
    return;
  }

  const atk = getAttackBtnPos();
  const skl = getSkillBtnPos();

  if (isBtnHit(x, y, atk, CONFIG.BTN_ATTACK_R)) {
    input.attackPressed = true;
    input.attackTouchId = id;
    triggerAttack();
    return;
  }
  if (playerSkills.length > 0 && isBtnHit(x, y, skl, CONFIG.BTN_SKILL_R)) {
    input.skillPressed = true;
    input.skillTouchId = id;
    triggerSkill();
    return;
  }
  if (isLeftSide(x) && input.stickTouchId === -1) {
    input.stickActive = true;
    input.stickOriginX = x;
    input.stickOriginY = y;
    input.stickCurX = x;
    input.stickCurY = y;
    input.stickTouchId = id;
  }
}

function handlePointerMove(id, x, y) {
  if (id === input.stickTouchId) {
    input.stickCurX = x;
    input.stickCurY = y;
    const dx = x - input.stickOriginX;
    const dy = y - input.stickOriginY;
    const d = Math.hypot(dx, dy);
    if (d > CONFIG.STICK_DEADZONE) {
      input.stickDX = dx / d;
      input.stickDY = dy / d;
    } else {
      input.stickDX = 0;
      input.stickDY = 0;
    }
  }
}

function handlePointerUp(id) {
  if (id === input.stickTouchId) {
    input.stickActive = false;
    input.stickTouchId = -1;
    input.stickDX = 0;
    input.stickDY = 0;
  }
  if (id === input.attackTouchId) {
    input.attackPressed = false;
    input.attackTouchId = -1;
  }
  if (id === input.skillTouchId) {
    input.skillPressed = false;
    input.skillTouchId = -1;
  }
}

// キーボード
window.addEventListener('keydown', (e) => {
  input.keys[e.key] = true;
  if (gameState === STATE.TITLE) { startGame(); return; }
  if (gameState === STATE.DEATH && deathRetryVisible) { retryGame(); return; }
  if (e.key === 'j' || e.key === 'J') triggerAttack();
  if (e.key === 'k' || e.key === 'K') triggerSkill();
});
window.addEventListener('keyup', (e) => { input.keys[e.key] = false; });

function getKeyboardDir() {
  let dx = 0, dy = 0;
  if (input.keys['ArrowLeft'] || input.keys['a'] || input.keys['A']) dx -= 1;
  if (input.keys['ArrowRight'] || input.keys['d'] || input.keys['D']) dx += 1;
  if (input.keys['ArrowUp'] || input.keys['w'] || input.keys['W']) dy -= 1;
  if (input.keys['ArrowDown'] || input.keys['s'] || input.keys['S']) dy += 1;
  if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
  return { dx, dy };
}

// ============================================================
// 攻撃
// ============================================================
function triggerAttack() {
  if (gameState !== STATE.PLAYING) return;
  if (player.hitFreeze) return;
  const now = performance.now();
  if (now - player.lastBulletTime < CONFIG.BULLET_COOLDOWN) return;
  player.lastBulletTime = now;

  // 最近敵に自動照準
  let tx = player.facingX, ty = player.facingY;
  if (tx === 0 && ty === 0) ty = -1;

  let nearestDist = Infinity;
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = dist(player, e);
    if (d < nearestDist) {
      nearestDist = d;
      const n = norm({ x: e.x - player.x, y: e.y - player.y });
      tx = n.x; ty = n.y;
    }
  }

  const hasToromi = playerSkills.includes('toromi');
  if (hasToromi && player.status === 'melted') {
    // 貫通弾：3方向スプレー
    for (let i = -1; i <= 1; i++) {
      const angle = Math.atan2(ty, tx) + i * 0.2;
      spawnBullet(player.x, player.y, Math.cos(angle), Math.sin(angle), true);
    }
  } else {
    spawnBullet(player.x, player.y, tx, ty, true);
  }
}

function triggerSkill() {
  if (gameState !== STATE.PLAYING) return;
  if (playerSkills.includes('frozen')) {
    player.status = 'frozen';
    player.statusTimer = 5000;
    player.frozenBarrier = true;
  }
}

// ============================================================
// ダメージ処理
// ============================================================
let hitEffect = { active: false, timer: 0, phase: 0 };
let screenShake = { x: 0, y: 0, timer: 0 };

function damagePlayer(amount) {
  if (player.invincible) return;
  if (player.hitFreeze) return;

  // 冷凍バリア
  if (player.frozenBarrier) {
    player.frozenBarrier = false;
    screenShake.timer = 200;
    return;
  }

  player.hp -= amount;
  if (player.hp < 0) player.hp = 0;

  // 飾り剥がれ
  if (player.hp === 2 && player.hasHat) {
    player.hasHat = false;
    player.decals.push({ x: player.x - 5, y: player.y - 30, timer: 2500, type: 'hat' });
  } else if (player.hp === 1 && player.hasCream) {
    player.hasCream = false;
    player.decals.push({ x: player.x, y: player.y - 20, timer: 2500, type: 'cream' });
  }

  hitEffect.active = true;
  hitEffect.timer = CONFIG.HIT_FREEZE_MS + CONFIG.HIT_VIBRATE_MS + CONFIG.HIT_DECAL_MS;
  hitEffect.phase = 0;
  player.hitFreeze = true;
  player.hitFreezeTimer = CONFIG.HIT_FREEZE_MS;

  screenShake.timer = CONFIG.HIT_VIBRATE_MS;

  player.invincible = true;
  player.invincibleTimer = 1200;

  if (player.hp <= 0) {
    triggerDeath();
  }
}

// ============================================================
// 死亡
// ============================================================
let deathTimer = 0;
let deathPhase = 0; // 0=silence 1=melt 2=plate 3=text 4=retryVisible
let deathRetryVisible = false;

function triggerDeath() {
  gameState = STATE.DEATH;
  deathTimer = 0;
  deathPhase = 0;
  deathRetryVisible = false;
}

function updateDeath(dt) {
  deathTimer += dt;
  if (deathPhase === 0 && deathTimer >= CONFIG.DEATH_SILENCE_MS) {
    deathPhase = 1; deathTimer = 0;
  } else if (deathPhase === 1 && deathTimer >= CONFIG.DEATH_MELT_MS) {
    deathPhase = 2; deathTimer = 0;
  } else if (deathPhase === 2 && deathTimer >= CONFIG.DEATH_PLATE_MS) {
    deathPhase = 3; deathTimer = 0;
  } else if (deathPhase === 3 && deathTimer >= CONFIG.DEATH_RETRY_DELAY_MS) {
    deathPhase = 4;
    deathRetryVisible = true;
  }
}

function retryGame() {
  player.reset();
  playerSkills = [];
  currentRoom = 0;
  setupRoom(0);
  gameState = STATE.PLAYING;
}

// ============================================================
// スキル選択
// ============================================================
const ALL_SKILLS = [
  {
    id: 'toromi',
    name: 'とろみパンチ',
    desc: '溶けている間、弾が貫通して複数に当たる',
    icon: '💧',
  },
  {
    id: 'frozen',
    name: 'きゅうそくれいとう',
    desc: 'バリア1回付き・固まり状態に移行する',
    icon: '❄️',
  },
  {
    id: 'morituke',
    name: 'もりつけ',
    desc: 'HP1回復（飾りが1個復活する）',
    icon: '🍮',
  },
];

let skillChoices = [];

function openSkillSelect() {
  gameState = STATE.SKILL_SELECT;
  // 常に3種すべて出す（v0.1は固定3択）
  skillChoices = [...ALL_SKILLS];
  skillCardAlpha = [1, 1, 1];
  skillCardFadeOut = [false, false, false];
  skillCardFadeTimer = [0, 0, 0];
  skillSelectLocked = false; // ロック解除
}

let skillCardAlpha = [1, 1, 1];
let skillCardFadeOut = [false, false, false];
let skillCardFadeTimer = [0, 0, 0];
let skillSelectLocked = false; // BUG-1対策：選択ロック

function handleSkillCardTap(x, y) {
  // カード3枚の位置
  const cards = getSkillCardRects();
  for (let i = 0; i < cards.length; i++) {
    if (skillCardFadeOut[i]) continue;
    const c = cards[i];
    if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
      selectSkill(i);
      return;
    }
  }
}

function getSkillCardRects() {
  const cardW = 100;
  const cardH = 160;
  const gap = 12;
  const totalW = cardW * 3 + gap * 2;
  const startX = (W - totalW) / 2;
  const cardY = H / 2 - cardH / 2;
  return [0, 1, 2].map(i => ({
    x: startX + i * (cardW + gap),
    y: cardY,
    w: cardW,
    h: cardH,
  }));
}

function selectSkill(idx) {
  // BUG-1対策：ロック済みなら即return、選んだカードを即フェード扱いにしてから処理
  if (skillSelectLocked) return;
  if (skillCardFadeOut[idx]) return;
  skillSelectLocked = true;
  skillCardFadeOut[idx] = true; // 選択カード自身も即フェード開始（再タップ防止）

  const skill = skillChoices[idx];
  // もりつけ：即時HP回復
  if (skill.id === 'morituke') {
    if (player.hp < player.hpMax) {
      player.hp++;
      if (!player.hasCream && player.hp >= 2) player.hasCream = true;
      if (!player.hasHat && player.hp >= 3) player.hasHat = true;
    }
  } else {
    if (!playerSkills.includes(skill.id)) {
      playerSkills.push(skill.id);
    }
  }

  // 選ばなかった2枚フェードアウト
  for (let i = 0; i < 3; i++) {
    if (i !== idx) {
      skillCardFadeOut[i] = true;
    }
  }
  // 少し待ってから次の部屋へ
  setTimeout(() => {
    nextRoom();
  }, 500);
}

function nextRoom() {
  currentRoom++;
  if (currentRoom > 3) {
    // v0.1はループ or タイトルへ
    currentRoom = 1;
  }
  setupRoom(currentRoom);
  gameState = STATE.PLAYING;
}

// ============================================================
// ゲームスタート
// ============================================================
function startGame() {
  player.reset();
  playerSkills = [];
  currentRoom = 0;
  setupRoom(0);
  gameState = STATE.PLAYING;
}

// ============================================================
// UPDATE
// ============================================================
let lastTime = 0;
let wallPulse = 0; // 脈打つ壁アニメ用
let blinkTimer = 0;

function update(dt) {
  wallPulse += dt * 0.001;
  blinkTimer += dt;

  if (gameState === STATE.TITLE) return;
  if (gameState === STATE.DEATH) { updateDeath(dt); return; }
  if (gameState === STATE.SKILL_SELECT) {
    updateSkillFade(dt);
    return;
  }

  // === PLAYING ===

  // 入力から移動方向を取得
  const kd = getKeyboardDir();
  let mdx = 0, mdy = 0;

  if (input.stickActive) {
    mdx = input.stickDX;
    mdy = input.stickDY;
  }
  if (kd.dx !== 0 || kd.dy !== 0) {
    mdx = kd.dx;
    mdy = kd.dy;
  }

  const moving = (Math.hypot(mdx, mdy) > 0.1);

  // 止まれる疑似リアルタイム：移動入力がない間は全停止
  if (!moving) {
    // 描画だけ進む（壁・ビネット）
    return;
  }

  input.moveDX = mdx;
  input.moveDY = mdy;
  input.moving = moving;

  if (moving) {
    player.facingX = mdx;
    player.facingY = mdy;
  }

  // ヒットフリーズ
  if (player.hitFreeze) {
    player.hitFreezeTimer -= dt;
    if (player.hitFreezeTimer <= 0) {
      player.hitFreeze = false;
    }
    // フリーズ中は移動更新しないが他は進める
    updateTimers(dt);
    updateBullets(dt);
    return;
  }

  updateTimers(dt);
  updatePlayer(dt, mdx, mdy);
  updateBullets(dt);
  updateEnemies(dt);
  checkCollisions();
  checkTrapCollisions(dt);
  checkRoomClear();
}

function updateTimers(dt) {
  // 無敵タイマー
  if (player.invincible) {
    player.invincibleTimer -= dt;
    if (player.invincibleTimer <= 0) player.invincible = false;
  }
  // 状態タイマー
  if (player.statusTimer > 0) {
    player.statusTimer -= dt;
    if (player.statusTimer <= 0 && player.status !== 'normal') {
      player.status = 'normal';
    }
  }
  // デカルタイマー
  player.decals = player.decals.filter(d => {
    d.timer -= dt;
    return d.timer > 0;
  });
  // スクリーンシェイク
  if (screenShake.timer > 0) {
    screenShake.timer -= dt;
    screenShake.x = (Math.random() - 0.5) * 2;
    screenShake.y = (Math.random() - 0.5) * 2;
  } else {
    screenShake.x = 0;
    screenShake.y = 0;
  }
}

function updatePlayer(dt, mdx, mdy) {
  let spd = CONFIG.PLAYER_SPEED;
  if (player.status === 'melted') spd = CONFIG.PLAYER_SPEED_MELTED;
  if (player.status === 'frozen') spd = CONFIG.PLAYER_SPEED_FROZEN;

  player.x += mdx * spd;
  player.y += mdy * spd;

  // 壁衝突
  const s = CONFIG.PLAYER_SIZE;
  player.x = clamp(player.x, PAD + s, W - PAD - s);
  player.y = clamp(player.y, PAD + s + 50, H - PAD - s - 50);
}

function updateBullets(dt) {
  for (const b of bullets) {
    b.x += b.dx * CONFIG.BULLET_SPEED;
    b.y += b.dy * CONFIG.BULLET_SPEED;
    b.life--;
    // 壁
    if (b.x < PAD || b.x > W - PAD || b.y < PAD + 50 || b.y > H - PAD - 50) {
      b.life = 0;
    }
  }
  bullets = bullets.filter(b => b.life > 0);
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.dummy) {
      // チュートリアルダミー：うろうろ
      e.moveTimer += dt;
      if (e.moveTimer > 2000) {
        e.moveAngle = Math.random() * Math.PI * 2;
        e.moveTimer = 0;
      }
      const s = e.speed;
      e.x += Math.cos(e.moveAngle) * s;
      e.y += Math.sin(e.moveAngle) * s;
      e.x = clamp(e.x, PAD + 20, W - PAD - 20);
      e.y = clamp(e.y, PAD + 70, H - PAD - 70);
      continue;
    }

    if (e.phase === 'idle') {
      // プレイヤーに向かって歩く
      const n = norm({ x: player.x - e.x, y: player.y - e.y });
      e.x += n.x * e.speed;
      e.y += n.y * e.speed;

      e.timeUntilAttack -= dt;
      if (e.timeUntilAttack <= 0) {
        e.phase = 'warn';
        e.warnTimer = CONFIG.KNIGHT_WARN_DURATION;
        // 予告位置：プレイヤー現在地
        e.warnX = player.x;
        e.warnY = player.y;
        e.timeUntilAttack = CONFIG.KNIGHT_ATTACK_INTERVAL;
      }
    } else if (e.phase === 'warn') {
      e.warnTimer -= dt;
      if (e.warnTimer <= 0) {
        // 炎弾発射
        const n = norm({ x: e.warnX - e.x, y: e.warnY - e.y });
        spawnBullet(e.x, e.y, n.x, n.y, false);
        e.phase = 'idle';
      }
    }

    // 壁
    e.x = clamp(e.x, PAD + 20, W - PAD - 20);
    e.y = clamp(e.y, PAD + 70, H - PAD - 70);
  }
}

function checkCollisions() {
  const ps = CONFIG.PLAYER_SIZE;
  const bs = CONFIG.BULLET_SIZE;

  // プレイヤー弾 vs 敵
  const hasToromi = playerSkills.includes('toromi');
  for (const b of bullets) {
    if (!b.fromPlayer) continue;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (dist(b, e) < bs + e.size / 2) {
        b.life = 0;
        if (!e.dummy) {
          e.hp--;
          if (e.hp <= 0) e.alive = false;
        }
        // 通常弾は1体で消える。とろみパンチ（溶け中）のみ貫通継続
        if (!(hasToromi && player.status === 'melted')) break;
      }
    }
  }

  // 敵弾 vs プレイヤー
  for (const b of bullets) {
    if (b.fromPlayer) continue;
    if (dist(b, player) < bs + ps / 2) {
      b.life = 0;
      player.status = 'melted';
      player.statusTimer = 4000;
      damagePlayer(CONFIG.KNIGHT_DAMAGE);
    }
  }

  // プレイヤー vs 敵接触（近接ダメージ）
  for (const e of enemies) {
    if (!e.alive || e.dummy) continue;
    if (dist(player, e) < ps / 2 + e.size / 2 - 4) {
      player.status = 'melted';
      player.statusTimer = 3000;
      damagePlayer(CONFIG.KNIGHT_DAMAGE);
    }
  }

  // チュートリアル皿
  if (plateGoal && !plateTouched) {
    if (dist(player, plateGoal) < CONFIG.PLAYER_SIZE + plateGoal.r) {
      plateTouched = true;
      // ダミー敵を消してスキル選択へ
      enemies = enemies.filter(e => !e.dummy);
      tutorialStep = 1;
      openSkillSelect();
    }
  }
}

function checkTrapCollisions(dt) {
  const ps = CONFIG.PLAYER_SIZE / 2;
  for (let i = 0; i < traps.length; i++) {
    const tr = traps[i];
    if (rectOverlap(
      player.x - ps, player.y - ps, ps * 2, ps * 2,
      tr.x, tr.y, tr.w, tr.h
    )) {
      const key = 'trap_' + i;
      // 初回踏み込みは半インターバル分の猶予を与える（即ダメ防止）
      if (trapDamageTimers[key] === undefined) trapDamageTimers[key] = CONFIG.TRAP_DAMAGE_INTERVAL * 0.5;
      trapDamageTimers[key] -= dt;
      if (trapDamageTimers[key] <= 0) {
        trapDamageTimers[key] = CONFIG.TRAP_DAMAGE_INTERVAL;
        player.status = 'melted';
        player.statusTimer = 3000;
        damagePlayer(1);
      }
    }
  }
}

function checkRoomClear() {
  if (roomCleared) return;
  // 部屋0はplate取得で別処理
  if (currentRoom === 0) return;

  const aliveEnemies = enemies.filter(e => e.alive && !e.dummy);
  if (aliveEnemies.length === 0) {
    roomCleared = true;
    setTimeout(() => {
      openSkillSelect();
    }, 600);
  }
}

function updateSkillFade(dt) {
  for (let i = 0; i < 3; i++) {
    if (skillCardFadeOut[i]) {
      skillCardAlpha[i] -= dt / 500;
      if (skillCardAlpha[i] < 0) skillCardAlpha[i] = 0;
    }
  }
}

// ============================================================
// DRAW
// ============================================================
function draw(now) {
  ctx.save();
  ctx.translate(screenShake.x, screenShake.y);

  drawBackground();

  if (gameState === STATE.TITLE) {
    drawTitle(now);
  } else if (gameState === STATE.PLAYING || gameState === STATE.SKILL_SELECT) {
    drawRoom();
    drawDecals();
    drawTraps();
    drawBullets();
    drawEnemies(now);
    drawPlayer(now);
    drawHUD();
    if (currentRoom === 0 && !plateTouched) drawTutorialHints(now);
    if (gameState === STATE.SKILL_SELECT) drawSkillSelect();
  } else if (gameState === STATE.DEATH) {
    drawRoom();
    drawDeath(now);
  }

  drawVignette();
  ctx.restore();
}

// --- 脈打つ肉壁背景 ---
function drawBackground() {
  const pulse = Math.sin(wallPulse * 1.0) * 1.5; // 1〜2px膨縮

  // 基本背景
  ctx.fillStyle = '#3B1A1A';
  ctx.fillRect(0, 0, W, H);

  // 肉壁テクスチャ（縦縞ノイズ風）
  for (let i = 0; i < 8; i++) {
    const x = (i / 8) * W;
    const ww = W / 8 + pulse;
    const grad = ctx.createLinearGradient(x, 0, x + ww, 0);
    grad.addColorStop(0, 'rgba(92,42,42,0.0)');
    grad.addColorStop(0.5, 'rgba(92,42,42,0.18)');
    grad.addColorStop(1, 'rgba(92,42,42,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, ww, H);
  }

  // 上下FOGグラデ
  const fogT = ctx.createLinearGradient(0, 0, 0, 80);
  fogT.addColorStop(0, 'rgba(15,8,8,0.95)');
  fogT.addColorStop(1, 'rgba(15,8,8,0.0)');
  ctx.fillStyle = fogT;
  ctx.fillRect(0, 0, W, 80);

  const fogB = ctx.createLinearGradient(0, H - 80, 0, H);
  fogB.addColorStop(0, 'rgba(15,8,8,0.0)');
  fogB.addColorStop(1, 'rgba(15,8,8,0.95)');
  ctx.fillStyle = fogB;
  ctx.fillRect(0, H - 80, W, 80);

  // 壁：部屋の縁（肉壁）
  const pad = PAD;
  const pulse2 = Math.sin(wallPulse * 1.2) * 2;
  ctx.strokeStyle = '#8B4040';
  ctx.lineWidth = 6 + pulse2;
  ctx.strokeRect(pad, pad + 40, W - pad * 2, H - pad * 2 - 80);

  // 内側ハイライト
  ctx.strokeStyle = 'rgba(139,64,64,0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(pad + 4, pad + 44, W - pad * 2 - 8, H - pad * 2 - 88);
}

// --- 部屋内要素 ---
function drawRoom() {
  // 扉（下端中央）
  if (roomCleared || currentRoom === 0) {
    ctx.fillStyle = '#8B4040';
    ctx.fillRect(W / 2 - 20, H - PAD - 40, 40, 40);
    ctx.fillStyle = '#D4C5A9';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', W / 2, H - PAD - 15);
  }
}

function drawTraps() {
  for (const tr of traps) {
    // 溶岩床
    const g = ctx.createRadialGradient(
      tr.x + tr.w / 2, tr.y + tr.h / 2, 2,
      tr.x + tr.w / 2, tr.y + tr.h / 2, tr.w / 2
    );
    g.addColorStop(0, '#FF8C00');
    g.addColorStop(0.6, '#FF4500');
    g.addColorStop(1, '#CC2200');
    ctx.fillStyle = g;
    ctx.fillRect(tr.x, tr.y, tr.w, tr.h);

    // 発光効果
    const pulse = Math.sin(wallPulse * 3) * 0.15 + 0.85;
    ctx.shadowBlur = 12 * pulse;
    ctx.shadowColor = '#FF8C00';
    ctx.strokeStyle = '#FF8C00';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tr.x, tr.y, tr.w, tr.h);
    ctx.shadowBlur = 0;
  }
}

function drawDecals() {
  for (const d of player.decals) {
    const alpha = Math.min(1, d.timer / 500);
    ctx.globalAlpha = alpha;
    if (d.type === 'hat') {
      drawHat(d.x, d.y, 1.0);
    } else if (d.type === 'cream') {
      drawCreamDrop(d.x, d.y);
    }
    ctx.globalAlpha = 1;
  }
}

function drawBullets() {
  for (const b of bullets) {
    if (b.fromPlayer) {
      // プリン弾（黄）
      ctx.fillStyle = '#F5C842';
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#F5C842';
      ctx.beginPath();
      ctx.arc(b.x, b.y, CONFIG.BULLET_SIZE, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 炎弾（赤橙）
      ctx.fillStyle = '#FF4500';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#FF8C00';
      ctx.beginPath();
      ctx.arc(b.x, b.y, CONFIG.BULLET_SIZE - 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
}

// --- 敵描画 ---
function drawEnemies(now) {
  const stopped = !input.moving && gameState === STATE.PLAYING;
  for (const e of enemies) {
    if (!e.alive) continue;

    ctx.save();

    if (e.dummy) {
      // チュートリアルダミー：透明感ある緑鎧
      if (stopped) ctx.filter = 'saturate(30%)';
      drawKnight(e.x, e.y, e.size, '#447744', now, e);
      ctx.filter = 'none';
      ctx.restore();
      continue;
    }

    // 停止時グレー
    if (stopped) ctx.filter = 'saturate(30%)';

    drawKnight(e.x, e.y, e.size, '#882200', now, e);

    // 予告マーカー
    if (e.phase === 'warn' && !stopped) {
      const ratio = 1 - e.warnTimer / CONFIG.KNIGHT_WARN_DURATION;
      const blink = Math.floor(now / CONFIG.KNIGHT_WARN_BLINK) % 2 === 0;
      const bright = ratio >= 0.8;
      // 最低alpha=0.55（0〜0.8の点滅中でも十分見える）、最大輝度時は1
      const alpha = bright ? 1 : (blink ? 0.9 : 0.55);
      ctx.filter = 'none';
      ctx.globalAlpha = alpha;
      drawWarnMarker(e.warnX, e.warnY, ratio);
      ctx.globalAlpha = 1;
    } else if (e.phase === 'warn' && stopped) {
      // 停止中でも予告は見える強さで表示
      ctx.filter = 'none';
      ctx.globalAlpha = 0.6;
      drawWarnMarker(e.warnX, e.warnY, 0);
      ctx.globalAlpha = 1;
    }

    ctx.filter = 'none';
    ctx.restore();
  }
}

function drawKnight(x, y, size, color, now, e) {
  // 体
  ctx.fillStyle = color;
  ctx.strokeStyle = '#D4C5A9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 鎧テクスチャ（十字）
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - size / 3, y);
  ctx.lineTo(x + size / 3, y);
  ctx.moveTo(x, y - size / 3);
  ctx.lineTo(x, y + size / 3);
  ctx.stroke();

  // 炎エフェクト（非ダミー）
  if (color !== '#447744') {
    const flame = Math.sin(now * 0.008) * 3;
    ctx.fillStyle = 'rgba(255,100,0,0.5)';
    ctx.beginPath();
    ctx.arc(x, y - size / 2 - 3 + flame, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // HPバー（小）
  if (!e.dummy) {
    const bw = size;
    const bh = 4;
    const bx = x - bw / 2;
    const by = y + size / 2 + 4;
    ctx.fillStyle = '#330000';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#FF4500';
    ctx.fillRect(bx, by, bw * (e.hp / CONFIG.KNIGHT_HP), bh);
  }
}

function drawWarnMarker(x, y, ratio) {
  // ratio=0〜1（0=警告開始直後、1=発射直前）
  const s = CONFIG.TILE_SIZE * 1.4; // TILE×1.4に拡大（小3でも視認できる）
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  // 内側：ratio が上がるほど赤が濃くなる
  const innerAlpha = 0.35 + ratio * 0.45;
  ctx.fillStyle = `rgba(255,40,0,${innerAlpha})`;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  // 輪郭：常時はっきり表示（発射直前はグロー強め）
  ctx.strokeStyle = ratio >= 0.8 ? '#FFFF00' : '#FF2200';
  ctx.lineWidth = ratio >= 0.8 ? 3.5 : 2.5;
  if (ratio >= 0.8) {
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#FF4400';
  }
  ctx.strokeRect(-s / 2, -s / 2, s, s);
  ctx.shadowBlur = 0;
  ctx.restore();
}

// --- プレイヤー描画 ---
function drawPlayer(now) {
  const x = player.x;
  const y = player.y;
  const s = CONFIG.PLAYER_SIZE;
  const melt = player.status === 'melted';
  const froz = player.status === 'frozen';
  const hp = player.hp;

  ctx.save();

  // 溶け：opacity下げ
  if (melt) ctx.globalAlpha = 0.75;

  // 凍り：フィルタ
  if (froz) ctx.filter = 'hue-rotate(180deg) saturate(150%)';

  // ヒビ（HP1）
  if (hp <= 1) {
    // 赤いオーラ
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#CC0000';
  }

  // 本体（プリン台形）
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;

  // 本体プリン形（台形）
  const bodyW = s * 1.2;
  const bodyH = s * 0.9;
  const bottomW = s * 1.5;

  ctx.beginPath();
  // 上部（狭い）
  ctx.moveTo(x - bodyW / 2, y - bodyH / 2);
  ctx.lineTo(x + bodyW / 2, y - bodyH / 2);
  // 右側（広がる）
  ctx.lineTo(x + bottomW / 2, y + bodyH / 2);
  // 下辺
  ctx.lineTo(x - bottomW / 2, y + bodyH / 2);
  ctx.closePath();

  // HP1以下ヒビ表現（黒線を後から描く）
  if (hp <= 1) {
    ctx.fillStyle = '#C8922A';
  } else {
    ctx.fillStyle = '#C8922A';
  }
  ctx.fill();

  ctx.fillStyle = '#F5C842';
  ctx.beginPath();
  ctx.moveTo(x - bodyW / 2 + 3, y - bodyH / 2 + 3);
  ctx.lineTo(x + bodyW / 2 - 3, y - bodyH / 2 + 3);
  ctx.lineTo(x + bottomW / 2 - 5, y + bodyH / 2 - 2);
  ctx.lineTo(x - bottomW / 2 + 5, y + bodyH / 2 - 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#000';
  ctx.lineWidth = 2;

  // ヒビ（HP1）
  if (hp <= 1) {
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 4, y - bodyH / 2 + 5);
    ctx.lineTo(x, y + 4);
    ctx.lineTo(x + 5, y + bodyH / 2 - 2);
    ctx.stroke();
  }

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;

  // 表情
  const eyeY = y - 4;
  const eyeOffX = 6;
  if (hp <= 1) {
    // 痛い顔
    ctx.fillStyle = '#000';
    // 目（><）
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - eyeOffX - 4, eyeY - 3);
    ctx.lineTo(x - eyeOffX + 4, eyeY + 3);
    ctx.moveTo(x - eyeOffX + 4, eyeY - 3);
    ctx.lineTo(x - eyeOffX - 4, eyeY + 3);
    ctx.moveTo(x + eyeOffX - 4, eyeY - 3);
    ctx.lineTo(x + eyeOffX + 4, eyeY + 3);
    ctx.moveTo(x + eyeOffX + 4, eyeY - 3);
    ctx.lineTo(x + eyeOffX - 4, eyeY + 3);
    ctx.stroke();
    // 口
    ctx.beginPath();
    ctx.arc(x, eyeY + 9, 4, 0.2 * Math.PI, 0.8 * Math.PI, false);
    ctx.stroke();
  } else {
    // 通常顔
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x - eyeOffX, eyeY, 3, 0, Math.PI * 2);
    ctx.arc(x + eyeOffX, eyeY, 3, 0, Math.PI * 2);
    ctx.fill();
    // ほっぺ
    ctx.fillStyle = 'rgba(255,180,160,0.6)';
    ctx.beginPath();
    ctx.arc(x - eyeOffX - 5, eyeY + 6, 4, 0, Math.PI * 2);
    ctx.arc(x + eyeOffX + 5, eyeY + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    // 口（笑顔）
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, eyeY + 10, 5, 0.1 * Math.PI, 0.9 * Math.PI, false);
    ctx.stroke();
  }

  // クリーム（HP2以上）
  if (player.hasCream) {
    ctx.fillStyle = '#FFF8E7';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    // クリームの山
    ctx.beginPath();
    ctx.arc(x, y - bodyH / 2 - 2, 9, Math.PI, 0, false);
    ctx.lineTo(x + 9, y - bodyH / 2 - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // クリームが垂れる（HP2かつhasCream）
    if (player.hp === 2) {
      ctx.fillStyle = '#FFF8E7';
      ctx.fillRect(x + 4, y - bodyH / 2 - 2, 4, 8);
    }
  }

  // ハット（HP3）
  if (player.hasHat) {
    drawHat(x, y - bodyH / 2 - 8, 1.0);
  }

  // 溶け水溜まり
  if (melt) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#F5C842';
    ctx.beginPath();
    ctx.ellipse(x, y + bodyH / 2 + 4, bottomW / 2 + 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.75;
  }

  // 凍り：青リング＋キラ粒子
  if (froz) {
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#A8D8EA';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#A8D8EA';
    ctx.beginPath();
    ctx.arc(x, y, s * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // キラ粒子
    for (let i = 0; i < 4; i++) {
      const a = (now * 0.002 + i * Math.PI / 2) % (Math.PI * 2);
      const px = x + Math.cos(a) * (s + 8);
      const py = y + Math.sin(a) * (s + 8);
      ctx.fillStyle = 'rgba(168,216,234,0.8)';
      ctx.fillRect(px - 1, py - 1, 3, 3);
    }
  }

  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawHat(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#CC2200';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  // 帽子（三角形ぽい）
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(8, 0);
  ctx.lineTo(5, -10);
  ctx.lineTo(-5, -10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // ツバ
  ctx.fillRect(-10, 0, 20, 3);
  ctx.strokeRect(-10, 0, 20, 3);
  ctx.restore();
}

function drawCreamDrop(x, y) {
  ctx.fillStyle = '#FFF8E7';
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// --- HUD ---
function drawHUD() {
  // 上端帯
  ctx.fillStyle = 'rgba(15,8,8,0.7)';
  ctx.fillRect(0, 0, W, 50);

  // HP（プリンアイコン×最大3）
  for (let i = 0; i < player.hpMax; i++) {
    const ix = 16 + i * 28;
    const iy = 15;
    if (i < player.hp) {
      ctx.fillStyle = '#F5C842';
    } else {
      ctx.fillStyle = '#5C2A2A';
    }
    ctx.beginPath();
    ctx.arc(ix, iy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // スキルアイコン（取得済み）
  for (let i = 0; i < playerSkills.length; i++) {
    const sk = ALL_SKILLS.find(s => s.id === playerSkills[i]);
    if (!sk) continue;
    const ix = W - 40 - i * 36;
    const iy = 25;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ix, iy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sk.icon, ix, iy);
  }

  // 部屋番号
  ctx.fillStyle = 'rgba(212,197,169,0.7)';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('ROOM ' + currentRoom, W / 2, 10);

  // 状態バッジ
  if (player.status === 'melted') {
    ctx.fillStyle = '#FF8C00';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('溶けてる！', W / 2, 28);
  } else if (player.status === 'frozen') {
    ctx.fillStyle = '#A8D8EA';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('固まり中', W / 2, 28);
  }

  // タッチ停止中アイコン（時計）
  const stopped = !input.moving && gameState === STATE.PLAYING;
  if (stopped) {
    drawPauseIcon(W - 22, 22);
  }

  // 攻撃ボタン
  drawAttackBtn();

  // スキルボタン
  if (playerSkills.length > 0) {
    drawSkillBtn();
  }

  // スティック
  if (input.stickActive) {
    drawStick();
  }
}

function drawPauseIcon(x, y) {
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.stroke();
  // 時計の針
  const now = performance.now();
  const a = now * 0.0 - Math.PI / 2; // 静止した針
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(-Math.PI / 2) * 6, y + Math.sin(-Math.PI / 2) * 6);
  ctx.stroke();
}

function drawAttackBtn() {
  const btn = getAttackBtnPos();
  const r = CONFIG.BTN_ATTACK_R;
  const pressed = input.attackPressed;

  ctx.strokeStyle = pressed ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(204,34,0,0.2)';
  ctx.beginPath();
  ctx.arc(btn.x, btn.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = pressed ? '#FF8C00' : '#CC2200';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('攻撃', btn.x, btn.y);
}

function drawSkillBtn() {
  const btn = getSkillBtnPos();
  const r = CONFIG.BTN_SKILL_R;
  const pressed = input.skillPressed;
  const sk = ALL_SKILLS.find(s => s.id === playerSkills[0]);

  ctx.strokeStyle = pressed ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(50,100,200,0.2)';
  ctx.beginPath();
  ctx.arc(btn.x, btn.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (sk) {
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sk.icon, btn.x, btn.y);
  }
}

function drawStick() {
  const ox = input.stickOriginX;
  const oy = input.stickOriginY;
  const r = CONFIG.STICK_RADIUS;

  // ベース
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ox, oy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // ノブ
  const kx = ox + input.stickDX * r;
  const ky = oy + input.stickDY * r;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(kx, ky, CONFIG.STICK_KNOB, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// --- タイトル ---
function drawTitle(now) {
  ctx.fillStyle = 'rgba(15,8,8,0.6)';
  ctx.fillRect(0, 0, W, H);

  // ロゴ
  const logoY = H * 0.3;
  ctx.shadowBlur = 20;
  ctx.shadowColor = '#CC2200';
  ctx.fillStyle = '#F5C842';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PUDDING', W / 2, logoY);
  ctx.fillStyle = '#CC2200';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('INFERNO', W / 2, logoY + 54);
  ctx.shadowBlur = 0;

  // プリンくんイラスト（タイトル用大きめ）
  ctx.save();
  ctx.translate(W / 2, H * 0.58);
  ctx.scale(2.5, 2.5);
  // 簡易プリン
  ctx.fillStyle = '#C8922A';
  ctx.beginPath();
  ctx.moveTo(-20, -15);
  ctx.lineTo(20, -15);
  ctx.lineTo(26, 15);
  ctx.lineTo(-26, 15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#F5C842';
  ctx.beginPath();
  ctx.moveTo(-17, -13);
  ctx.lineTo(17, -13);
  ctx.lineTo(23, 13);
  ctx.lineTo(-23, 13);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // 目
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(-7, -3, 3, 0, Math.PI * 2);
  ctx.arc(7, -3, 3, 0, Math.PI * 2);
  ctx.fill();
  // クリーム
  ctx.fillStyle = '#FFF8E7';
  ctx.beginPath();
  ctx.arc(0, -15, 8, Math.PI, 0, false);
  ctx.fill();
  // 帽子
  ctx.fillStyle = '#CC2200';
  ctx.beginPath();
  ctx.moveTo(-6, -23);
  ctx.lineTo(6, -23);
  ctx.lineTo(4, -32);
  ctx.lineTo(-4, -32);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-8, -23, 16, 2);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 0.7;
  ctx.strokeRect(-8, -23, 16, 2);
  ctx.restore();

  // 「タップでスタート」点滅
  const blink2 = Math.floor(now / 600) % 2 === 0;
  if (blink2) {
    ctx.fillStyle = '#D4C5A9';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('タップ / クリックでスタート', W / 2, H * 0.82);
  }

  // サブタイトル
  ctx.fillStyle = 'rgba(212,197,169,0.5)';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('～ 魔界の体内からプリンくんを救え ～', W / 2, H * 0.88);
}

// --- スキル選択 ---
function drawSkillSelect() {
  // 暗転オーバーレイ
  ctx.fillStyle = 'rgba(15,8,8,0.82)';
  ctx.fillRect(0, 0, W, H);

  // タイトル
  ctx.fillStyle = '#F5C842';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('スキルを選べ', W / 2, H / 2 - 120);

  ctx.fillStyle = 'rgba(212,197,169,0.6)';
  ctx.font = '13px sans-serif';
  ctx.fillText('1つ選ぶと次の部屋へ', W / 2, H / 2 - 95);

  const cards = getSkillCardRects();

  for (let i = 0; i < skillChoices.length; i++) {
    const sk = skillChoices[i];
    const c = cards[i];
    const alpha = skillCardAlpha[i];
    if (alpha <= 0) continue;

    ctx.save();
    ctx.globalAlpha = alpha;

    // 今の状態に合うカードを金縁で誘導
    let isRecommended = false;
    if (sk.id === 'toromi' && player.status === 'melted') isRecommended = true;
    if (sk.id === 'frozen' && player.hp <= 1) isRecommended = true;
    if (sk.id === 'morituke' && player.hp < player.hpMax) isRecommended = true;

    // カード背景
    ctx.fillStyle = '#3B1A1A';
    ctx.strokeStyle = isRecommended ? '#FFD700' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = isRecommended ? 2.5 : 1.5;
    roundRect(ctx, c.x, c.y, c.w, c.h, 10);
    ctx.fill();
    ctx.stroke();

    // 金縁グロー
    if (isRecommended) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#FFD700';
      roundRect(ctx, c.x, c.y, c.w, c.h, 10);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // アイコン
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sk.icon, c.x + c.w / 2, c.y + 45);

    // 名前
    ctx.fillStyle = '#F5C842';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // 長い名前は2行
    const nameLines = splitText(sk.name, c.w - 10);
    let ny = c.y + 78;
    for (const line of nameLines) {
      ctx.fillText(line, c.x + c.w / 2, ny);
      ny += 16;
    }

    // 説明
    ctx.fillStyle = 'rgba(212,197,169,0.8)';
    ctx.font = '10px sans-serif';
    const descLines = splitText(sk.desc, c.w - 10);
    let dy = ny + 4;
    for (const line of descLines) {
      ctx.fillText(line, c.x + c.w / 2, dy);
      dy += 13;
    }

    ctx.restore();
  }
}

function splitText(text, maxWidth) {
  // 簡易行分割（日本語は文字数で）
  const charPerLine = Math.floor(maxWidth / 11);
  const lines = [];
  let i = 0;
  while (i < text.length) {
    lines.push(text.slice(i, i + charPerLine));
    i += charPerLine;
  }
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// --- 死亡演出 ---
function drawDeath(now) {
  const t = deathTimer;

  ctx.fillStyle = 'rgba(15,8,8,0.85)';
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  const cy = H / 2;

  if (deathPhase === 0) {
    // 静止（沈黙）
    drawPlayerCorpse(cx, cy, 1);
  } else if (deathPhase === 1) {
    // 溶ける
    const progress = t / CONFIG.DEATH_MELT_MS;
    const scale = 1 - progress * 0.6;
    const alpha = 1 - progress * 0.8;
    ctx.globalAlpha = alpha;
    drawPlayerCorpse(cx, cy, scale);
    ctx.globalAlpha = 1;
    // 溶け水溜まり
    ctx.fillStyle = `rgba(245,200,66,${progress * 0.6})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 20, progress * 40 + 5, progress * 10 + 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (deathPhase >= 2) {
    // 皿
    drawPlate(cx, cy + 20);

    if (deathPhase >= 3) {
      ctx.fillStyle = '#D4C5A9';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('また挑むか？', cx, cy - 60);

      ctx.fillStyle = 'rgba(212,197,169,0.5)';
      ctx.font = '13px sans-serif';
      ctx.fillText('プリンくんは魔界の奥で皿だけが残った…', cx, cy - 30);
    }

    if (deathRetryVisible) {
      // リトライボタン
      const bw = 160, bh = 48;
      const bx = cx - bw / 2, by = cy + 60;
      ctx.fillStyle = '#CC2200';
      ctx.strokeStyle = '#FF8C00';
      ctx.lineWidth = 2;
      roundRect(ctx, bx, by, bw, bh, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFF8E7';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('もう一度', cx, by + bh / 2);
    }
  }
}

function drawPlayerCorpse(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // 本体
  ctx.fillStyle = '#C8922A';
  ctx.beginPath();
  ctx.moveTo(-20, -15);
  ctx.lineTo(20, -15);
  ctx.lineTo(26, 15);
  ctx.lineTo(-26, 15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#F5C842';
  ctx.beginPath();
  ctx.moveTo(-17, -13);
  ctx.lineTo(17, -13);
  ctx.lineTo(23, 13);
  ctx.lineTo(-23, 13);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 目（螺旋でなく×）
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, -5); ctx.lineTo(-4, 1);
  ctx.moveTo(-4, -5); ctx.lineTo(-10, 1);
  ctx.moveTo(4, -5); ctx.lineTo(10, 1);
  ctx.moveTo(10, -5); ctx.lineTo(4, 1);
  ctx.stroke();
  ctx.restore();
}

function drawPlate(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#B0A090';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 50, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // 皿の縁
  ctx.strokeStyle = '#D4C5A9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, 44, 7, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// --- ビネット ---
function drawVignette() {
  const rad = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);

  if (player.hp <= 1 && (gameState === STATE.PLAYING || gameState === STATE.SKILL_SELECT)) {
    // 危機：赤ビネット常時点灯
    rad.addColorStop(0, 'rgba(0,0,0,0)');
    rad.addColorStop(0.6, 'rgba(80,0,0,0.2)');
    rad.addColorStop(1, 'rgba(180,0,0,0.65)');
  } else {
    rad.addColorStop(0, 'rgba(0,0,0,0)');
    rad.addColorStop(0.6, 'rgba(15,8,8,0.15)');
    rad.addColorStop(1, 'rgba(15,8,8,0.7)');
  }

  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, W, H);
}

// --- チュートリアルヒント ---
function drawTutorialHints(now) {
  // 「記憶の皿」（光る目標）
  if (plateGoal) {
    const pulse3 = Math.sin(now * 0.004) * 0.3 + 0.7;
    ctx.save();
    ctx.shadowBlur = 20 * pulse3;
    ctx.shadowColor = '#F5C842';
    ctx.fillStyle = `rgba(245,200,66,${pulse3 * 0.8})`;
    ctx.strokeStyle = '#F5C842';
    ctx.lineWidth = 2;
    // 皿形
    ctx.beginPath();
    ctx.ellipse(plateGoal.x, plateGoal.y, plateGoal.r, plateGoal.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // テキスト（「皿」＋「動いて取れ」・子に伝わる平易な語）
    ctx.fillStyle = '#D4C5A9';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('皿', plateGoal.x, plateGoal.y - 20);
    ctx.font = '14px sans-serif';
    ctx.fillText('動いて取れ', plateGoal.x, plateGoal.y - 4);
    ctx.restore();
  }

  // 「指を離すと止まる」ヒント：点滅やめ、常時表示、フォント大きく
  // 停止中のみ表示するが、チカチカしない
  const stopped = !input.moving;
  if (stopped) {
    ctx.fillStyle = 'rgba(255,240,180,0.92)';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 背景帯で読みやすくする
    const hintText = '指を離すと　世界が止まる';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(W / 2 - 160, H - PAD - 125, 320, 34);
    ctx.fillStyle = 'rgba(255,240,180,0.95)';
    ctx.fillText(hintText, W / 2, H - PAD - 108);
  }

  // ダミー敵説明
  ctx.fillStyle = 'rgba(168,216,234,0.7)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('↑ ダミー敵（攻撃しない）', W / 2, H / 2 + 120);
}

// ============================================================
// メインループ
// ============================================================
function loop(now) {
  const dt = Math.min(now - lastTime, 50); // 最大50ms(20fps下限)
  lastTime = now;

  update(dt);
  draw(now);

  requestAnimationFrame(loop);
}

requestAnimationFrame((now) => {
  lastTime = now;
  loop(now);
});
