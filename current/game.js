// ============================================================
// DEEP SIGNAL v0.3.1
// Web版の完成ゲームへ育てるためのベース実装です。
// 将来の展開先:
// - Web版: このままHTML/CSS/JavaScriptで拡張
// - Mobile版: CONFIG.input と CONFIG.render を中心に調整
// - GB Demake版: CONFIG.render.gbTarget を基準に160x144へ縮小
//
// 画像・音声ファイルは使わず、canvas描画とWeb Audio APIだけで動きます。
// ============================================================

// ------------------------------------------------------------
// 設定値
// ------------------------------------------------------------

const CONFIG = {
  version: "v0.3.1",

  // 表示は800x600相当の論理座標で作り、canvas内部は400x300で描画します。
  // CSSで2倍表示することで、ピクセルがくっきり見えるようにしています。
  render: {
    logicalWidth: 800,
    logicalHeight: 600,
    internalWidth: 400,
    internalHeight: 300,
    gbTargetWidth: 160,
    gbTargetHeight: 144,
  },

  world: {
    width: 2400,
    height: 1200,
  },

  player: {
    maxLives: 3,
    maxAmmo: 12,
    speed: 4.4,
    width: 66,
    height: 22,
  },

  sonar: {
    range: 470,
    cooldown: 360,
    revealTime: 330,
    pingTime: 86,
    pulseTime: 72,
  },

  gameplay: {
    supplyRadius: 70,
    clearDelay: 210,
    bombLimit: 6,
  },

  // 空中戦は「海面から迎撃する」モードなので、海面の高さを固定して描きます。
  // ここを変えると、空の広さ・自機の上下移動幅・補給ブイの高さをまとめて調整できます。
  air: {
    seaSurfaceY: 462,
    playerMinOffset: -38,
    playerMaxOffset: -12,
    supplyOffset: 5,
  },

  // 海中ステージの海面はワールド座標で管理します。
  // sea / seaBoss の自機は潜航艇なので、この高さより上には出られません。
  sea: {
    seaSurfaceY: 96,
    playerSafeMargin: 38,
    supplyMinDepth: 300,
    supplyMaxDepth: 700,
    bossSupplyMinDepth: 310,
    bossSupplyMaxDepth: 560,
  },

  // 補給は固定配置ではなく、ステージ開始時と再出現時にランダム配置します。
  // 各ステージ側に supplyRespawn を置けば個別調整できます。
  supply: {
    normalRespawnMin: 1200,
    normalRespawnMax: 1800,
    bossRespawnMin: 2100,
    bossRespawnMax: 2700,
    edgeMargin: 170,
  },

  // Game Boy風の4階調パレットです。
  // なるべくこの4色だけで画面を作ると、GB風版へ落とし込みやすくなります。
  palette: {
    light: "#d8f7a7",
    mid: "#9bbc0f",
    dark: "#306850",
    black: "#081820",
  },
};

const SCREEN_WIDTH = CONFIG.render.logicalWidth;
const SCREEN_HEIGHT = CONFIG.render.logicalHeight;
const RENDER_SCALE = CONFIG.render.internalWidth / CONFIG.render.logicalWidth;
const WORLD_WIDTH = CONFIG.world.width;
const WORLD_HEIGHT = CONFIG.world.height;
const BASE_FRAME_MS = 1000 / 60;

const STATE = {
  TITLE: "title",
  PLAYING: "playing",
  PAUSED: "paused",
  STAGE_CLEAR: "stageClear",
  GAME_OVER: "gameOver",
  COMPLETE: "complete",
};

const STAGE_TYPE = {
  SEA: "sea",
  SEA_BOSS: "seaBoss",
  AIR: "air",
  AIR_BOSS: "airBoss",
};

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = CONFIG.render.internalWidth;
canvas.height = CONFIG.render.internalHeight;
ctx.imageSmoothingEnabled = false;

// ------------------------------------------------------------
// 入力・ゲーム状態
// ------------------------------------------------------------

const keys = {};
let cameraX = 0;
let cameraY = 0;

const game = {
  state: STATE.TITLE,
  score: 0,
  lives: CONFIG.player.maxLives,
  ammo: CONFIG.player.maxAmmo,
  stageIndex: 0,
  stageName: "",
  stageType: STAGE_TYPE.SEA,
  bombCooldown: 0,
  sonarCooldown: 0,
  sonarFlashTimer: 0,
  clearTimer: 0,
  statusText: "",
  statusTimer: 0,
  titleTimer: 0,
  lastTime: 0,
  soundEnabled: true,
};

const player = {
  x: 180,
  y: 120,
  width: CONFIG.player.width,
  height: CONFIG.player.height,
  speed: CONFIG.player.speed,
  invincibleTimer: 0,
};

const ENEMY_TYPES = {
  drone: {
    name: "潜水ドローン",
    domain: "sea",
    width: 52,
    height: 20,
    health: 2,
    speed: 1.25,
    score: 100,
    fireInterval: 118,
  },
  torpedo: {
    name: "高速魚雷艇",
    domain: "sea",
    width: 40,
    height: 14,
    health: 1,
    speed: 4.25,
    score: 160,
    fireInterval: 0,
  },
  mine: {
    name: "浮上機雷",
    domain: "sea",
    width: 24,
    height: 26,
    health: 1,
    speed: 0.58,
    score: 120,
    fireInterval: 0,
  },
  abyssBoss: {
    name: "ABYSS CORE",
    domain: "sea",
    width: 156,
    height: 74,
    health: 14,
    speed: 0.85,
    score: 1600,
    fireInterval: 78,
    boss: true,
  },
  helicopter: {
    name: "ヘリコプター",
    domain: "air",
    width: 48,
    height: 18,
    health: 1,
    speed: 2.2,
    score: 150,
    fireInterval: 118,
  },
  plane: {
    name: "飛行機",
    domain: "air",
    width: 54,
    height: 16,
    health: 1,
    speed: 3.65,
    score: 180,
    fireInterval: 95,
  },
  ufo: {
    name: "小型UFO",
    domain: "air",
    width: 42,
    height: 20,
    health: 2,
    speed: 1.8,
    score: 220,
    fireInterval: 82,
  },
  skyBoss: {
    name: "SKY SIGNAL MOTHERSHIP",
    domain: "air",
    width: 178,
    height: 58,
    health: 18,
    speed: 0.95,
    score: 2600,
    fireInterval: 56,
    boss: true,
  },
};

const STAGES = [
  {
    name: "COASTAL TEST AREA",
    type: STAGE_TYPE.SEA,
    start: { x: 180, y: 120 },
    visibilityBonus: 0.28,
    fireRate: 1.08,
    supplies: [{ x: 690, y: 230 }],
    markers: [
      { x: 430, y: 300, label: "TRAIN-1" },
      { x: 940, y: 420, label: "BUOY-A" },
      { x: 1480, y: 360, label: "PING" },
      { x: 2140, y: 520, label: "EXIT" },
    ],
    enemies: [
      { type: "drone", x: 470, y: 360, direction: 1, patrolLeft: 330, patrolRight: 720 },
      { type: "torpedo", x: 900, y: 500, direction: -1, patrolLeft: 650, patrolRight: 1160 },
      { type: "mine", x: 1240, y: 760, patrolTop: 470 },
      { type: "drone", x: 1600, y: 430, direction: -1, patrolLeft: 1390, patrolRight: 1810 },
      { type: "torpedo", x: 2060, y: 620, direction: 1, patrolLeft: 1840, patrolRight: 2260 },
    ],
  },
  {
    name: "SUNKEN GRID",
    type: STAGE_TYPE.SEA,
    start: { x: 180, y: 150 },
    visibilityBonus: 0.16,
    fireRate: 0.96,
    supplies: [{ x: 780, y: 300 }],
    markers: [
      { x: 420, y: 420, label: "GRID-A" },
      { x: 860, y: 620, label: "BASE 02" },
      { x: 1380, y: 520, label: "RUST-LINE" },
      { x: 2040, y: 740, label: "BROKEN GATE" },
    ],
    enemies: [
      { type: "drone", x: 410, y: 420, direction: 1, patrolLeft: 260, patrolRight: 650 },
      { type: "torpedo", x: 710, y: 600, direction: -1, patrolLeft: 520, patrolRight: 980 },
      { type: "mine", x: 980, y: 850, patrolTop: 540 },
      { type: "drone", x: 1180, y: 560, direction: -1, patrolLeft: 960, patrolRight: 1430 },
      { type: "torpedo", x: 1510, y: 710, direction: 1, patrolLeft: 1250, patrolRight: 1810 },
      { type: "mine", x: 1810, y: 930, patrolTop: 610 },
      { type: "drone", x: 2130, y: 650, direction: -1, patrolLeft: 1900, patrolRight: 2320 },
    ],
  },
  {
    name: "MIDNIGHT TRENCH",
    type: STAGE_TYPE.SEA,
    start: { x: 220, y: 180 },
    visibilityBonus: 0.05,
    fireRate: 0.88,
    supplies: [{ x: 820, y: 340 }],
    markers: [
      { x: 520, y: 620, label: "SIG-01" },
      { x: 1160, y: 760, label: "NODE-A" },
      { x: 1720, y: 920, label: "LOW ECHO" },
      { x: 2180, y: 640, label: "RELAY" },
    ],
    enemies: [
      { type: "drone", x: 520, y: 610, direction: 1, patrolLeft: 340, patrolRight: 760 },
      { type: "mine", x: 720, y: 1040, patrolTop: 640 },
      { type: "torpedo", x: 1120, y: 820, direction: -1, patrolLeft: 830, patrolRight: 1430 },
      { type: "drone", x: 1420, y: 720, direction: -1, patrolLeft: 1190, patrolRight: 1640 },
      { type: "mine", x: 1660, y: 1080, patrolTop: 720 },
      { type: "torpedo", x: 2020, y: 930, direction: 1, patrolLeft: 1740, patrolRight: 2290 },
      { type: "drone", x: 2210, y: 560, direction: -1, patrolLeft: 1960, patrolRight: 2320 },
    ],
  },
  {
    name: "GHOST CURRENT",
    type: STAGE_TYPE.SEA,
    start: { x: 210, y: 200 },
    visibilityBonus: 0,
    fireRate: 0.76,
    supplies: [{ x: 640, y: 360 }],
    markers: [
      { x: 450, y: 720, label: "CURRENT" },
      { x: 980, y: 860, label: "GHOST-1" },
      { x: 1580, y: 640, label: "NO WAKE" },
      { x: 2180, y: 920, label: "SIGNAL VEIN" },
    ],
    enemies: [
      { type: "drone", x: 420, y: 700, direction: 1, patrolLeft: 260, patrolRight: 740 },
      { type: "torpedo", x: 690, y: 790, direction: -1, patrolLeft: 450, patrolRight: 1050 },
      { type: "mine", x: 890, y: 1110, patrolTop: 720 },
      { type: "drone", x: 1120, y: 830, direction: -1, patrolLeft: 880, patrolRight: 1420 },
      { type: "torpedo", x: 1380, y: 980, direction: 1, patrolLeft: 1120, patrolRight: 1700 },
      { type: "mine", x: 1600, y: 1120, patrolTop: 750 },
      { type: "drone", x: 1810, y: 720, direction: 1, patrolLeft: 1580, patrolRight: 2050 },
      { type: "torpedo", x: 2110, y: 940, direction: -1, patrolLeft: 1840, patrolRight: 2320 },
      { type: "drone", x: 2260, y: 620, direction: -1, patrolLeft: 2040, patrolRight: 2330 },
    ],
  },
  {
    name: "BLACK SIGNAL ZONE",
    type: STAGE_TYPE.SEA,
    start: { x: 180, y: 220 },
    visibilityBonus: -0.05,
    fireRate: 0.68,
    supplies: [
      { x: 640, y: 380 },
      { x: 1850, y: 560 },
    ],
    markers: [
      { x: 380, y: 760, label: "BLACK-1" },
      { x: 1040, y: 1020, label: "NOISE" },
      { x: 1480, y: 820, label: "SIGNAL" },
      { x: 2180, y: 1060, label: "DEEP END" },
    ],
    enemies: [
      { type: "drone", x: 430, y: 760, direction: 1, patrolLeft: 260, patrolRight: 680 },
      { type: "mine", x: 570, y: 1110, patrolTop: 780 },
      { type: "torpedo", x: 850, y: 940, direction: -1, patrolLeft: 590, patrolRight: 1140 },
      { type: "drone", x: 1120, y: 860, direction: -1, patrolLeft: 910, patrolRight: 1360 },
      { type: "mine", x: 1260, y: 1120, patrolTop: 790 },
      { type: "torpedo", x: 1480, y: 1030, direction: 1, patrolLeft: 1210, patrolRight: 1780 },
      { type: "drone", x: 1720, y: 700, direction: 1, patrolLeft: 1510, patrolRight: 1940 },
      { type: "mine", x: 1910, y: 1120, patrolTop: 810 },
      { type: "torpedo", x: 2070, y: 890, direction: -1, patrolLeft: 1840, patrolRight: 2310 },
      { type: "drone", x: 2220, y: 980, direction: -1, patrolLeft: 1980, patrolRight: 2330 },
    ],
  },
  {
    name: "ABYSS CORE",
    type: STAGE_TYPE.SEA_BOSS,
    start: { x: 250, y: 210 },
    visibilityBonus: -0.08,
    fireRate: 0.72,
    supplies: [
      { x: 620, y: 360 },
      { x: 1690, y: 420 },
    ],
    markers: [
      { x: 560, y: 700, label: "CORE NOISE" },
      { x: 1220, y: 820, label: "ABYSS LOCK" },
      { x: 1820, y: 740, label: "WEAK ECHO" },
    ],
    enemies: [
      { type: "abyssBoss", x: 1540, y: 760, direction: -1, patrolLeft: 980, patrolRight: 2050, initiallyDetected: true },
    ],
  },
  {
    name: "SURFACE ALERT",
    type: STAGE_TYPE.AIR,
    start: { x: 180, y: 444 },
    visibilityBonus: 0.34,
    fireRate: 0.82,
    supplies: [{ x: 1040, y: 168 }],
    markers: [
      { x: 420, y: 120, label: "SURFACE" },
      { x: 1020, y: 210, label: "AIR RAID" },
      { x: 1680, y: 150, label: "VECTOR" },
      { x: 2200, y: 260, label: "SKY GATE" },
    ],
    enemies: [
      { type: "helicopter", x: 420, y: 150, direction: 1, patrolLeft: 260, patrolRight: 760 },
      { type: "plane", x: 720, y: 95, direction: -1, patrolLeft: 420, patrolRight: 1120, verticalDrift: 0.26 },
      { type: "ufo", x: 1080, y: 210, direction: 1, patrolLeft: 800, patrolRight: 1360 },
      { type: "helicopter", x: 1360, y: 180, direction: -1, patrolLeft: 1160, patrolRight: 1660 },
      { type: "plane", x: 1640, y: 115, direction: 1, patrolLeft: 1360, patrolRight: 2060, verticalDrift: 0.34 },
      { type: "ufo", x: 2050, y: 230, direction: -1, patrolLeft: 1760, patrolRight: 2320 },
      { type: "helicopter", x: 2260, y: 160, direction: -1, patrolLeft: 1940, patrolRight: 2330 },
    ],
  },
  {
    name: "SKY SIGNAL MOTHERSHIP",
    type: STAGE_TYPE.AIR_BOSS,
    start: { x: 260, y: 444 },
    visibilityBonus: 0.36,
    fireRate: 0.7,
    supplies: [
      { x: 620, y: 172 },
      { x: 1800, y: 172 },
    ],
    markers: [
      { x: 640, y: 120, label: "SKY NOISE" },
      { x: 1320, y: 110, label: "MOTHERSHIP" },
      { x: 2020, y: 180, label: "OPEN HATCH" },
    ],
    enemies: [
      { type: "skyBoss", x: 1460, y: 145, direction: -1, patrolLeft: 900, patrolRight: 2020, initiallyDetected: true },
      { type: "helicopter", x: 540, y: 200, direction: 1, patrolLeft: 360, patrolRight: 780 },
      { type: "ufo", x: 2080, y: 230, direction: -1, patrolLeft: 1840, patrolRight: 2320 },
    ],
  },
];

const bombs = [];
const enemyBullets = [];
const explosions = [];
const enemies = [];
const sonarPulses = [];
const supplies = [];
const muzzleFlashes = [];

// ------------------------------------------------------------
// GB風サウンド
// ------------------------------------------------------------

const sound = {
  context: null,
};

function ensureAudio() {
  if (!game.soundEnabled) {
    return null;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  if (!sound.context) {
    sound.context = new AudioContextClass();
  }

  if (sound.context.state === "suspended") {
    sound.context.resume();
  }

  return sound.context;
}

function toggleSound() {
  game.soundEnabled = !game.soundEnabled;
  setStatus(game.soundEnabled ? "SOUND ON" : "SOUND OFF", 80);

  if (game.soundEnabled) {
    playSound("supply");
  }
}

function playSound(name) {
  if (!game.soundEnabled) {
    return;
  }

  const audio = ensureAudio();

  if (!audio) {
    return;
  }

  if (name === "start") {
    playTone(330, 0.08, "square", 0.05, 0);
    playTone(660, 0.08, "square", 0.05, 0.08);
  }

  if (name === "sonar") {
    playTone(523, 0.05, "square", 0.04, 0);
    playTone(659, 0.05, "square", 0.04, 0.05);
    playTone(784, 0.12, "square", 0.035, 0.1);
  }

  if (name === "bomb") {
    playSweep(196, 98, 0.18, "square", 0.05, 0);
  }

  if (name === "explosion") {
    playNoise(0.22, 0.12, 0);
    playTone(72, 0.18, "square", 0.04, 0);
  }

  if (name === "damage") {
    playTone(180, 0.08, "square", 0.06, 0);
    playTone(90, 0.16, "square", 0.06, 0.08);
  }

  if (name === "supply") {
    playTone(440, 0.06, "square", 0.04, 0);
    playTone(660, 0.06, "square", 0.04, 0.06);
    playTone(880, 0.1, "square", 0.04, 0.12);
  }

  if (name === "clear") {
    playTone(392, 0.08, "square", 0.05, 0);
    playTone(523, 0.08, "square", 0.05, 0.08);
    playTone(784, 0.2, "square", 0.05, 0.16);
  }

  if (name === "gameover") {
    playTone(196, 0.12, "square", 0.05, 0);
    playTone(147, 0.12, "square", 0.05, 0.12);
    playTone(98, 0.24, "square", 0.05, 0.24);
  }
}

function playTone(frequency, duration, type, volume, delay) {
  const audio = sound.context;
  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playSweep(from, to, duration, type, volume, delay) {
  const audio = sound.context;
  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playNoise(duration, volume, delay) {
  const audio = sound.context;
  const start = audio.currentTime + delay;
  const sampleRate = audio.sampleRate;
  const buffer = audio.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
  const data = buffer.getChannelData(0);

  // Game Boyのノイズチャンネル風に、荒いランダム値を短く鳴らします。
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() > 0.5 ? 1 : -1;
  }

  const source = audio.createBufferSource();
  const gain = audio.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.connect(gain);
  gain.connect(audio.destination);
  source.start(start);
  source.stop(start + duration);
}

// ------------------------------------------------------------
// キーボード入力
// ------------------------------------------------------------

document.addEventListener("keydown", (event) => {
  if (isGameKey(event.code)) {
    event.preventDefault();
  }

  ensureAudio();

  const firstPress = !keys[event.code];
  keys[event.code] = true;

  if (!firstPress) {
    return;
  }

  if (event.code === "KeyM") {
    toggleSound();
    return;
  }

  if (game.state === STATE.TITLE) {
    if (event.code === "Space" || event.code === "Enter") {
      startNewGame();
    }
    return;
  }

  if (event.code === "KeyP" || event.code === "Escape") {
    togglePause();
    return;
  }

  if (event.code === "KeyR") {
    if (game.state === STATE.COMPLETE) {
      returnToTitle();
    } else {
      startNewGame();
    }
    return;
  }

  if (game.state !== STATE.PLAYING) {
    return;
  }

  if (event.code === "Space") {
    dropBomb();
  }

  if (isSonarKey(event.code)) {
    activateSonar();
  }
});

document.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

function isGameKey(code) {
  return (
    code === "ArrowLeft" ||
    code === "ArrowRight" ||
    code === "ArrowUp" ||
    code === "ArrowDown" ||
    code === "KeyA" ||
    code === "KeyD" ||
    code === "KeyW" ||
    code === "KeyS" ||
    code === "KeyE" ||
    code === "KeyM" ||
    code === "KeyP" ||
    code === "KeyR" ||
    code === "Escape" ||
    code === "ShiftLeft" ||
    code === "ShiftRight" ||
    code === "Space" ||
    code === "Enter"
  );
}

function isSonarKey(code) {
  return code === "KeyE" || code === "ShiftLeft" || code === "ShiftRight";
}

function togglePause() {
  if (game.state === STATE.PLAYING) {
    game.state = STATE.PAUSED;
    setStatus("PAUSED", 9999);
    return;
  }

  if (game.state === STATE.PAUSED) {
    game.state = STATE.PLAYING;
    setStatus("RESUME", 50);
  }
}

// ------------------------------------------------------------
// メインループ
// ------------------------------------------------------------

function gameLoop(timestamp) {
  if (!game.lastTime) {
    game.lastTime = timestamp;
  }

  const elapsed = Math.min(timestamp - game.lastTime, 48);
  const frameScale = elapsed / BASE_FRAME_MS;
  game.lastTime = timestamp;

  update(frameScale);
  draw();
  requestAnimationFrame(gameLoop);
}

function update(frameScale) {
  game.titleTimer += frameScale;

  if (game.state === STATE.PLAYING) {
    updatePlaying(frameScale);
    return;
  }

  if (game.state === STATE.STAGE_CLEAR) {
    updateStageClear(frameScale);
    return;
  }

  updateNonPlaying(frameScale);
}

function updatePlaying(frameScale) {
  updatePlayer(frameScale);
  updateCamera(frameScale);
  updateBombs(frameScale);
  updateEnemies(frameScale);
  updateEnemyBullets(frameScale);
  updateSupplies(frameScale);
  updateSonar(frameScale);
  updateExplosions(frameScale);
  updateMuzzleFlashes(frameScale);
  updateTimers(frameScale);
  checkCollisions();
}

function updateStageClear(frameScale) {
  updateCamera(frameScale);
  updateSonar(frameScale);
  updateExplosions(frameScale);
  updateMuzzleFlashes(frameScale);
  updateTimers(frameScale);

  game.clearTimer -= frameScale;

  if (game.clearTimer <= 0) {
    advanceStage();
  }
}

function updateNonPlaying(frameScale) {
  updateSonar(frameScale);
  updateExplosions(frameScale);
  updateMuzzleFlashes(frameScale);
  updateTimers(frameScale);
}

function updateTimers(frameScale) {
  game.bombCooldown = Math.max(0, game.bombCooldown - frameScale);
  game.sonarCooldown = Math.max(0, game.sonarCooldown - frameScale);
  game.sonarFlashTimer = Math.max(0, game.sonarFlashTimer - frameScale);
  game.statusTimer = Math.max(0, game.statusTimer - frameScale);
  player.invincibleTimer = Math.max(0, player.invincibleTimer - frameScale);
}

function updatePlayer(frameScale) {
  if (keys.ArrowLeft || keys.KeyA) {
    player.x -= player.speed * frameScale;
  }

  if (keys.ArrowRight || keys.KeyD) {
    player.x += player.speed * frameScale;
  }

  if (keys.ArrowUp || keys.KeyW) {
    player.y -= player.speed * frameScale;
  }

  if (keys.ArrowDown || keys.KeyS) {
    player.y += player.speed * frameScale;
  }

  const halfWidth = player.width / 2;
  const halfHeight = player.height / 2;
  player.x = clamp(player.x, halfWidth + 20, WORLD_WIDTH - halfWidth - 20);

  if (isAirStage()) {
    // 空中戦では水上艦としての位置を保ち、海面付近だけを少し上下できます。
    const surfaceY = getAirSeaSurfaceY();
    player.y = clamp(player.y, surfaceY + CONFIG.air.playerMinOffset, surfaceY + CONFIG.air.playerMaxOffset);
  } else if (isSeaStage()) {
    // 海中戦では潜航艇として扱います。海面境界より上へは絶対に出られません。
    const surfaceLimit = getSeaSurfaceY() + CONFIG.sea.playerSafeMargin;
    const wantsSurface = keys.ArrowUp || keys.KeyW;
    player.y = clamp(player.y, surfaceLimit, WORLD_HEIGHT - 220);

    if (player.y <= surfaceLimit + 8 && (wantsSurface || game.statusTimer <= 0)) {
      setStatus("SURFACE LOCKED", 42);
    }
  } else {
    // 将来の space タイプだけが全方向自由移動になる想定です。
    // sea / seaBoss / air / airBoss では自由飛行にしません。
    player.y = clamp(player.y, halfHeight + 56, WORLD_HEIGHT - 220);
  }
}

function updateCamera(frameScale) {
  const targetX = player.x - SCREEN_WIDTH * 0.44;
  const targetY = isAirStage() ? 0 : player.y - SCREEN_HEIGHT * 0.30;
  const followRate = Math.min(1, 0.14 * frameScale);

  cameraX += (targetX - cameraX) * followRate;
  cameraY += (targetY - cameraY) * followRate;

  cameraX = clamp(cameraX, 0, WORLD_WIDTH - SCREEN_WIDTH);
  cameraY = clamp(cameraY, 0, WORLD_HEIGHT - SCREEN_HEIGHT);
}

function dropBomb() {
  if (game.ammo <= 0) {
    setStatus(isAirStage() ? "NO AA SHELLS" : "NO DEPTH CHARGES", 90);
    return;
  }

  if (game.bombCooldown > 0 || bombs.length >= CONFIG.gameplay.bombLimit) {
    return;
  }

  if (isAirStage()) {
    // 空中戦のSpaceは上方向へ飛ぶ対空弾です。
    bombs.push({
      kind: "aa",
      x: player.x,
      y: player.y - player.height / 2 - 12,
      width: 6,
      height: 16,
      speed: 5.6,
    });
    addMuzzleFlash(player.x, player.y - player.height / 2 - 18);
  } else {
    // 海中戦のSpaceは従来通り、ワールド座標で下へ沈む爆雷です。
    bombs.push({
      kind: "depth",
      x: player.x,
      y: player.y + player.height / 2 + 6,
      width: 8,
      height: 14,
      baseSpeed: 2.45,
    });
  }

  game.ammo -= 1;
  game.bombCooldown = isAirStage() ? 11 : 16;
  playSound("bomb");
}

function updateBombs(frameScale) {
  for (const bomb of bombs) {
    if (bomb.kind === "aa") {
      bomb.y -= bomb.speed * frameScale;
    } else {
      const depthDrag = 1 - getDepthFactor(bomb.y) * 0.42;
      bomb.y += bomb.baseSpeed * depthDrag * frameScale;
    }
  }

  removeWhere(bombs, (bomb) => bomb.y > WORLD_HEIGHT + 30 || bomb.y < -40);
}

function updateEnemies(frameScale) {
  for (const enemy of enemies) {
    if (!enemy.alive) {
      continue;
    }

    enemy.detectedTimer = Math.max(0, enemy.detectedTimer - frameScale);
    enemy.pingTimer = Math.max(0, enemy.pingTimer - frameScale);

    if (enemy.type === "drone") updateDrone(enemy, frameScale);
    if (enemy.type === "torpedo") updateTorpedo(enemy, frameScale);
    if (enemy.type === "mine") updateMine(enemy, frameScale);
    if (enemy.type === "abyssBoss") updateAbyssBoss(enemy, frameScale);
    if (enemy.type === "helicopter" || enemy.type === "plane" || enemy.type === "ufo") updateAirEnemy(enemy, frameScale);
    if (enemy.type === "skyBoss") updateSkyBoss(enemy, frameScale);
  }
}

function updateDrone(enemy, frameScale) {
  enemy.x += enemy.speed * enemy.direction * frameScale;

  if (enemy.x < enemy.patrolLeft) {
    enemy.x = enemy.patrolLeft;
    enemy.direction = 1;
  }

  if (enemy.x > enemy.patrolRight) {
    enemy.x = enemy.patrolRight;
    enemy.direction = -1;
  }

  enemy.fireTimer -= frameScale;

  if (enemy.fireTimer <= 0) {
    if (Math.abs(player.x - enemy.x) < 560 && player.y < enemy.y + 90) {
      fireEnemyBullet(enemy);
    }

    enemy.fireTimer = enemy.fireInterval;
  }
}

function updateTorpedo(enemy, frameScale) {
  enemy.x += enemy.speed * enemy.direction * frameScale;

  if (enemy.x < enemy.patrolLeft) {
    enemy.x = enemy.patrolLeft;
    enemy.direction = 1;
  }

  if (enemy.x > enemy.patrolRight) {
    enemy.x = enemy.patrolRight;
    enemy.direction = -1;
  }
}

function updateMine(enemy, frameScale) {
  enemy.phase += 0.045 * frameScale;
  enemy.y -= enemy.speed * frameScale;
  enemy.x += Math.sin(enemy.phase) * 0.18 * frameScale;

  if (enemy.y < enemy.patrolTop) {
    enemy.y = enemy.patrolTop;
  }
}

function updateAbyssBoss(enemy, frameScale) {
  enemy.phase += 0.026 * frameScale;
  enemy.x += enemy.speed * enemy.direction * frameScale;
  enemy.y += Math.sin(enemy.phase) * 0.28 * frameScale;

  if (enemy.x < enemy.patrolLeft) {
    enemy.x = enemy.patrolLeft;
    enemy.direction = 1;
  }

  if (enemy.x > enemy.patrolRight) {
    enemy.x = enemy.patrolRight;
    enemy.direction = -1;
  }

  enemy.fireTimer -= frameScale;

  if (enemy.fireTimer <= 0) {
    if (Math.abs(player.x - enemy.x) < 680 && player.y < enemy.y + 140) {
      fireEnemyBullet(enemy);
    }

    // HP半分以下では攻撃間隔を短くして、ボス後半らしい圧を出します。
    const anger = enemy.health <= enemy.maxHealth / 2 ? 0.58 : 1;
    enemy.fireTimer = enemy.fireInterval * anger;
  }
}

function updateAirEnemy(enemy, frameScale) {
  enemy.phase += 0.04 * frameScale;
  enemy.x += enemy.speed * enemy.direction * frameScale;
  enemy.y += Math.sin(enemy.phase) * (enemy.verticalDrift || 0.18) * frameScale;

  if (enemy.x < enemy.patrolLeft) {
    enemy.x = enemy.patrolLeft;
    enemy.direction = 1;
  }

  if (enemy.x > enemy.patrolRight) {
    enemy.x = enemy.patrolRight;
    enemy.direction = -1;
  }

  enemy.y = clamp(enemy.y, 72, 340);
  enemy.fireTimer -= frameScale;

  if (enemy.fireTimer <= 0) {
    if (Math.abs(player.x - enemy.x) < 560 && player.y > enemy.y - 40) {
      fireEnemyBullet(enemy);
    }

    enemy.fireTimer = enemy.fireInterval;
  }
}

function updateSkyBoss(enemy, frameScale) {
  enemy.phase += 0.02 * frameScale;
  enemy.hatchTimer = (enemy.hatchTimer + frameScale) % 260;
  enemy.summonTimer -= frameScale;
  enemy.x += enemy.speed * enemy.direction * frameScale;
  enemy.y += Math.sin(enemy.phase) * 0.18 * frameScale;

  if (enemy.x < enemy.patrolLeft) {
    enemy.x = enemy.patrolLeft;
    enemy.direction = 1;
  }

  if (enemy.x > enemy.patrolRight) {
    enemy.x = enemy.patrolRight;
    enemy.direction = -1;
  }

  enemy.fireTimer -= frameScale;

  if (enemy.fireTimer <= 0) {
    fireEnemyBullet(enemy);
    if (enemy.health <= enemy.maxHealth / 2) {
      fireEnemyBullet({
        ...enemy,
        x: enemy.x - 44,
      });
      fireEnemyBullet({
        ...enemy,
        x: enemy.x + 44,
      });
    }

    enemy.fireTimer = enemy.fireInterval * (enemy.health <= enemy.maxHealth / 2 ? 0.72 : 1);
  }

  if (enemy.summonTimer <= 0) {
    summonAirEscort(enemy);
    enemy.summonTimer = 360;
  }
}

function summonAirEscort(boss) {
  // ボスが呼ぶ護衛は少数に制限し、処理量と難易度が暴れないようにします。
  const escorts = enemies.filter((enemy) => enemy.alive && enemy.spawnedByBoss).length;

  if (escorts >= 3) {
    return;
  }

  const type = escorts % 2 === 0 ? "ufo" : "helicopter";
  const x = clamp(boss.x + (escorts % 2 === 0 ? -130 : 130), 180, WORLD_WIDTH - 180);
  enemies.push(createEnemy({
    type,
    x,
    y: boss.y + 96,
    direction: x < boss.x ? -1 : 1,
    patrolLeft: Math.max(80, x - 260),
    patrolRight: Math.min(WORLD_WIDTH - 80, x + 260),
    spawnedByBoss: true,
  }, enemies.length));
}

function fireEnemyBullet(enemy) {
  const airAttack = getEnemyDomain(enemy) === "air";

  enemyBullets.push({
    x: enemy.x,
    y: airAttack ? enemy.y + enemy.height / 2 + 8 : enemy.y - enemy.height / 2 - 8,
    width: enemy.type === "skyBoss" ? 8 : 6,
    height: enemy.type === "skyBoss" ? 18 : 12,
    speed: enemy.type === "skyBoss" ? 3.25 : 2.85,
    vy: airAttack ? (enemy.type === "skyBoss" ? 3.25 : 2.85) : -2.85,
    kind: enemy.type === "skyBoss" ? "laser" : "bullet",
  });
}

function updateEnemyBullets(frameScale) {
  for (const bullet of enemyBullets) {
    bullet.y += bullet.vy * frameScale;
  }

  removeWhere(enemyBullets, (bullet) => bullet.y < -40 || bullet.y > WORLD_HEIGHT + 40);
}

function updateSupplies(frameScale) {
  for (const supply of supplies) {
    supply.phase += 0.045 * frameScale;
    supply.flashTimer = Math.max(0, supply.flashTimer - frameScale);

    if (!supply.active) {
      supply.respawnTimer -= frameScale;

      if (supply.respawnTimer <= 0) {
        placeSupplyRandomly(supply);
      }

      continue;
    }

    const nearSupply = distance(player.x, player.y, supply.x, supply.y) <= CONFIG.gameplay.supplyRadius;

    if (nearSupply) {
      collectSupply(supply);
    }
  }
}

function collectSupply(supply) {
  game.ammo = CONFIG.player.maxAmmo;

  // 残機回復は強すぎるため低確率に留めます。基本は弾薬補給として扱います。
  if (game.lives < CONFIG.player.maxLives && Math.random() < 0.12) {
    game.lives += 1;
  }

  supply.active = false;
  supply.respawnTimer = randomSupplyRespawnTime();
  supply.flashTimer = 0;
  setStatus(isAirStage() ? "AA SHELL RESTORED" : "DEPTH CHARGE RESTORED", 115);
  playSound("supply");
}

function activateSonar() {
  if (game.sonarCooldown > 0) {
    setStatus(`${getSensorLabel()} CHARGING`, 55);
    return;
  }

  game.sonarCooldown = CONFIG.sonar.cooldown;
  game.sonarFlashTimer = 42;

  sonarPulses.push({
    x: player.x,
    y: player.y,
    radius: 12,
    maxRadius: CONFIG.sonar.range,
    life: CONFIG.sonar.pulseTime,
    maxLife: CONFIG.sonar.pulseTime,
  });

  let detectedCount = 0;

  for (const enemy of enemies) {
    if (!enemy.alive) {
      continue;
    }

    if (distance(player.x, player.y, enemy.x, enemy.y) <= CONFIG.sonar.range) {
      enemy.detectedTimer = CONFIG.sonar.revealTime;
      enemy.pingTimer = CONFIG.sonar.pingTime;
      detectedCount += 1;
    }
  }

  setStatus(detectedCount > 0 ? `${getSensorLabel()} CONTACT x${detectedCount}` : "NO CONTACT", 95);
  playSound("sonar");
}

function updateSonar(frameScale) {
  for (const pulse of sonarPulses) {
    pulse.life -= frameScale;
    const progress = 1 - pulse.life / pulse.maxLife;
    pulse.radius = 12 + (pulse.maxRadius - 12) * clamp(progress, 0, 1);
  }

  removeWhere(sonarPulses, (pulse) => pulse.life <= 0);
}

function updateExplosions(frameScale) {
  for (const explosion of explosions) {
    explosion.life -= frameScale;
    explosion.radius += explosion.growth * frameScale;
  }

  removeWhere(explosions, (explosion) => explosion.life <= 0);
}

function updateMuzzleFlashes(frameScale) {
  for (const flash of muzzleFlashes) {
    flash.life -= frameScale;
    flash.radius += 0.35 * frameScale;
  }

  removeWhere(muzzleFlashes, (flash) => flash.life <= 0);
}

// ------------------------------------------------------------
// 衝突判定
// ------------------------------------------------------------

function checkCollisions() {
  checkBombHitsEnemies();
  checkEnemyBulletsHitPlayer();
  checkMinesHitPlayer();
}

function checkBombHitsEnemies() {
  for (let bombIndex = bombs.length - 1; bombIndex >= 0; bombIndex -= 1) {
    const bomb = bombs[bombIndex];
    const bombBox = getBox(bomb);

    for (const enemy of enemies) {
      if (!enemy.alive) {
        continue;
      }

      if (canProjectileDamageEnemy(bomb, enemy, bombBox)) {
        bombs.splice(bombIndex, 1);
        hitEnemy(enemy);
        break;
      }
    }
  }
}

function canProjectileDamageEnemy(projectile, enemy, projectileBox) {
  const projectileKind = projectile.kind || "depth";
  const enemyDomain = getEnemyDomain(enemy);

  if (projectileKind === "depth" && enemyDomain !== "sea") {
    return false;
  }

  if (projectileKind === "aa" && enemyDomain !== "air") {
    return false;
  }

  if (enemy.type === "abyssBoss") {
    return isAbyssWeakPointVisible(enemy) && isColliding(projectileBox, getAbyssWeakPointBox(enemy));
  }

  if (enemy.type === "skyBoss") {
    return isSkyBossWeakPointOpen(enemy) && isColliding(projectileBox, getSkyBossWeakPointBox(enemy));
  }

  return isColliding(projectileBox, getBox(enemy));
}

function hitEnemy(enemy) {
  enemy.health -= 1;
  enemy.detectedTimer = Math.max(enemy.detectedTimer, 120);
  enemy.pingTimer = Math.max(enemy.pingTimer, 50);
  addExplosion(enemy.x, enemy.y, 7, 1.4, "light");

  if (enemy.health <= 0) {
    destroyEnemy(enemy, true);
  }
}

function destroyEnemy(enemy, addScore) {
  enemy.alive = false;

  if (enemy.type === "skyBoss") {
    // エンディングへ進む時に、ボスが呼んだ護衛だけが残って足止めしないようにします。
    for (const other of enemies) {
      if (other.spawnedByBoss) {
        other.alive = false;
      }
    }
  }

  if (addScore) {
    game.score += enemy.score;
  }

  addExplosion(enemy.x, enemy.y, 13, 2.2, "mid");
  addExplosion(enemy.x - 12, enemy.y + 5, 8, 1.5, "light");
  playSound("explosion");
  checkStageClear();
}

function checkEnemyBulletsHitPlayer() {
  if (player.invincibleTimer > 0) {
    return;
  }

  const playerBox = getBox(player);

  for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
    const bullet = enemyBullets[i];

    if (isColliding(getBox(bullet), playerBox)) {
      enemyBullets.splice(i, 1);
      damagePlayer();
      return;
    }
  }
}

function checkMinesHitPlayer() {
  if (player.invincibleTimer > 0) {
    return;
  }

  const playerBox = getBox(player);

  for (const enemy of enemies) {
    if (!enemy.alive || enemy.type !== "mine") {
      continue;
    }

    if (isColliding(playerBox, getBox(enemy))) {
      enemy.alive = false;
      addExplosion(enemy.x, enemy.y, 16, 2.4, "light");
      damagePlayer();
      checkStageClear();
      return;
    }
  }
}

function damagePlayer() {
  game.lives -= 1;
  player.invincibleTimer = 120;
  enemyBullets.length = 0;
  addExplosion(player.x, player.y, 10, 2.0, "light");
  playSound("damage");

  if (game.lives <= 0) {
    game.state = STATE.GAME_OVER;
    setStatus("SIGNAL LOST", 120);
    playSound("gameover");
  }
}

function checkStageClear() {
  if (game.state !== STATE.PLAYING) {
    return;
  }

  let remainingEnemies = enemies.some((enemy) => enemy.alive);

  if (isBossStage()) {
    remainingEnemies = enemies.some((enemy) => enemy.alive && ENEMY_TYPES[enemy.type].boss);
  }

  if (!remainingEnemies) {
    if (game.stageIndex >= STAGES.length - 1) {
      game.state = STATE.COMPLETE;
      enemyBullets.length = 0;
      setStatus("SIGNAL ASCENDING", 180);
      playSound("clear");
      return;
    }

    game.state = STATE.STAGE_CLEAR;
    game.clearTimer = CONFIG.gameplay.clearDelay;
    enemyBullets.length = 0;
    setStatus("STAGE CLEAR", 140);
    playSound("clear");
  }
}

function advanceStage() {
  if (game.stageIndex >= STAGES.length - 1) {
    game.state = STATE.COMPLETE;
    setStatus("SIGNAL ASCENDING", 180);
    return;
  }

  loadStage(game.stageIndex + 1, true);
}

// ------------------------------------------------------------
// 描画処理
// ------------------------------------------------------------

function draw() {
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  if (game.state === STATE.TITLE) {
    drawTitleScreen();
    drawLcdOverlay();
    return;
  }

  drawGameScreen();
  drawLcdOverlay();
}

function drawGameScreen() {
  drawBackground();
  drawSupplies();
  drawBombs();
  drawEnemies();
  drawEnemyBullets();
  drawPlayer();
  drawMuzzleFlashes();
  drawSonarPulses();
  drawExplosions();
  drawDepthOverlay();
  drawHud();
  drawMinimap();
  drawControlHelp();

  if (game.state === STATE.PAUSED) {
    drawCenteredMessage("PAUSED", "PRESS P / ESC", "");
  }

  if (game.state === STATE.GAME_OVER) {
    drawCenteredMessage("GAME OVER", `FINAL SCORE ${padScore(game.score)}`, "PRESS R TO RESTART");
  }

  if (game.state === STATE.STAGE_CLEAR) {
    drawCenteredMessage("STAGE CLEAR", `NEXT STAGE IN ${Math.ceil(game.clearTimer / 60)}`, "");
  }

  if (game.state === STATE.COMPLETE) {
    drawCenteredMessage("SIGNAL ASCENDING...", "ORBITAL SIGNAL MODE WILL OPEN IN v0.4.0", "PRESS R TO TITLE");
  }
}

function drawTitleScreen() {
  ctx.fillStyle = gb("mid");
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  drawTitleDecorativeGrid();
  drawTitleSubmarineSilhouette();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = gb("black");
  ctx.font = "56px 'Courier New', monospace";
  ctx.fillText("DEEP SIGNAL", SCREEN_WIDTH / 2, 145);

  ctx.font = "24px 'Courier New', monospace";
  ctx.fillText("BLACK SIGNAL ZONE", SCREEN_WIDTH / 2, 190);

  ctx.font = "18px 'Courier New', monospace";
  ctx.fillText(CONFIG.version, SCREEN_WIDTH / 2, 226);

  const blink = Math.floor(game.titleTimer / 28) % 2 === 0;
  if (blink) {
    ctx.font = "24px 'Courier New', monospace";
    ctx.fillText("PRESS SPACE", SCREEN_WIDTH / 2, 300);
  }

  ctx.font = "16px 'Courier New', monospace";
  ctx.fillText("MOVE: ARROW / WASD    SONAR/RADAR: E / SHIFT", SCREEN_WIDTH / 2, 382);
  ctx.fillText("DEPTH CHARGE / AA SHELL: SPACE    PAUSE: P / ESC", SCREEN_WIDTH / 2, 410);
  ctx.fillText(`SOUND: ${game.soundEnabled ? "ON" : "OFF"}  (M TO TOGGLE)`, SCREEN_WIDTH / 2, 452);

  ctx.textAlign = "left";
}

function drawTitleDecorativeGrid() {
  ctx.strokeStyle = gba("dark", 0.35);
  ctx.lineWidth = 2;

  for (let x = 0; x <= SCREEN_WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, SCREEN_HEIGHT);
    ctx.stroke();
  }

  for (let y = 0; y <= SCREEN_HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SCREEN_WIDTH, y);
    ctx.stroke();
  }
}

function drawTitleSubmarineSilhouette() {
  ctx.fillStyle = gba("black", 0.55);
  ctx.fillRect(258, 252, 284, 26);
  ctx.fillRect(322, 232, 82, 22);
  ctx.fillRect(236, 260, 32, 10);
  ctx.fillRect(532, 260, 34, 10);
  ctx.fillStyle = gba("light", 0.35);
  ctx.fillRect(330, 240, 14, 8);
  ctx.fillRect(354, 240, 14, 8);
  ctx.fillRect(378, 240, 14, 8);
}

function drawBackground() {
  if (isAirStage()) {
    drawAirBackground();
    return;
  }

  const deep = getDepthFactor(cameraY + SCREEN_HEIGHT * 0.5);
  ctx.fillStyle = deep > 0.55 ? gb("dark") : gb("mid");
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  drawSeaGrid();
  drawDepthLines();
  drawBackgroundMarkers();
  drawSeafloor();
  drawSurfaceLines();
  drawWorldBorder();
}

function drawAirBackground() {
  ctx.fillStyle = gb("mid");
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  const seaY = getAirSeaSurfaceY() - cameraY;
  const horizonY = seaY - 42;

  // 空のノイズ。ランダムではなく座標ベースにして、GB液晶のざらつきだけを足します。
  ctx.fillStyle = gba("light", 0.16);
  for (let i = 0; i < 44; i += 1) {
    const x = Math.round((i * 173 + cameraX * 0.12) % SCREEN_WIDTH);
    const y = 84 + ((i * 47) % 260);
    ctx.fillRect(x, y, 2, 2);
  }

  drawAirClouds();

  // 空中戦はレーダー迎撃なので、測距線を薄く重ねます。
  ctx.strokeStyle = gba("dark", 0.24);
  ctx.lineWidth = 2;

  const gridSize = 120;
  const startX = Math.floor(cameraX / gridSize) * gridSize;

  for (let worldX = startX; worldX <= cameraX + SCREEN_WIDTH; worldX += gridSize) {
    const screenX = Math.round(worldX - cameraX);
    line(screenX, 72, screenX, seaY);
  }

  for (let y = 110; y <= seaY - 30; y += 76) {
    line(0, y, SCREEN_WIDTH, y);
  }

  const sweepX = Math.round((game.titleTimer * 7 - cameraX * 0.2) % SCREEN_WIDTH);
  ctx.strokeStyle = gba("light", 0.3);
  line(sweepX, 78, sweepX + 48, seaY - 8);

  ctx.fillStyle = gba("dark", 0.34);
  ctx.fillRect(0, horizonY, SCREEN_WIDTH, 3);
  ctx.fillStyle = gba("light", 0.42);
  ctx.fillRect(0, horizonY + 7, SCREEN_WIDTH, 2);

  // 海は画面下部だけに抑え、空中の敵が主役に見える構図にします。
  ctx.fillStyle = gb("dark");
  ctx.fillRect(0, seaY, SCREEN_WIDTH, SCREEN_HEIGHT - seaY);
  ctx.fillStyle = gb("light");
  ctx.fillRect(0, seaY - 5, SCREEN_WIDTH, 5);
  ctx.fillStyle = gba("light", 0.54);

  for (let x = -40; x <= SCREEN_WIDTH + 40; x += 42) {
    const waveY = seaY + 18 + Math.sin((x + cameraX) * 0.03 + game.titleTimer * 0.06) * 4;
    ctx.fillRect(Math.round(x), Math.round(waveY), 24, 3);
  }

  drawBackgroundMarkers();
  drawWorldBorder();
}

function drawAirClouds() {
  ctx.fillStyle = gba("light", 0.34);

  for (let i = 0; i < 6; i += 1) {
    const baseX = Math.round(((i * 420 - cameraX * 0.18) % (SCREEN_WIDTH + 240)) - 120);
    const baseY = 92 + (i % 3) * 54;
    ctx.fillRect(baseX, baseY, 52, 10);
    ctx.fillRect(baseX + 18, baseY - 10, 38, 10);
    ctx.fillRect(baseX + 58, baseY + 4, 34, 8);
  }
}

function drawSurfaceLines() {
  const surfaceY = Math.round(getSeaSurfaceY() - cameraY);

  if (surfaceY < -40 || surfaceY > SCREEN_HEIGHT + 40) {
    return;
  }

  // 海面より上はプレイ領域ではないため、暗いロック帯として表示します。
  if (surfaceY > 0) {
    ctx.fillStyle = gba("black", 0.46);
    ctx.fillRect(0, 0, SCREEN_WIDTH, surfaceY);
    ctx.fillStyle = gba("dark", 0.55);

    for (let y = 8; y < surfaceY; y += 16) {
      ctx.fillRect(0, y, SCREEN_WIDTH, 2);
    }

    ctx.fillStyle = gba("light", 0.68);
    ctx.font = "14px 'Courier New', monospace";
    ctx.textBaseline = "middle";
    ctx.fillText("SURFACE LOCK", 18, Math.max(22, surfaceY - 18));
  }

  ctx.fillStyle = gb("light");
  ctx.fillRect(0, surfaceY, SCREEN_WIDTH, 4);
  ctx.fillRect(0, surfaceY + 8, SCREEN_WIDTH, 2);
}

function drawSeaGrid() {
  ctx.strokeStyle = gba("dark", 0.35);
  ctx.lineWidth = 2;

  const gridSize = 80;
  const startX = Math.floor(cameraX / gridSize) * gridSize;
  const startY = Math.floor(cameraY / gridSize) * gridSize;

  for (let worldX = startX; worldX <= cameraX + SCREEN_WIDTH; worldX += gridSize) {
    const screenX = Math.round(worldX - cameraX);
    ctx.beginPath();
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, SCREEN_HEIGHT);
    ctx.stroke();
  }

  for (let worldY = startY; worldY <= cameraY + SCREEN_HEIGHT; worldY += gridSize) {
    const screenY = Math.round(worldY - cameraY);
    ctx.beginPath();
    ctx.moveTo(0, screenY);
    ctx.lineTo(SCREEN_WIDTH, screenY);
    ctx.stroke();
  }
}

function drawDepthLines() {
  ctx.font = "14px 'Courier New', monospace";
  ctx.textBaseline = "middle";
  ctx.fillStyle = gba("black", 0.74);
  ctx.strokeStyle = gba("black", 0.28);
  ctx.lineWidth = 1;

  const lineStep = 160;
  const startY = Math.ceil(cameraY / lineStep) * lineStep;

  for (let worldY = startY; worldY <= cameraY + SCREEN_HEIGHT; worldY += lineStep) {
    const screenY = Math.round(worldY - cameraY);
    ctx.beginPath();
    ctx.moveTo(0, screenY);
    ctx.lineTo(SCREEN_WIDTH, screenY);
    ctx.stroke();
    ctx.fillText(`DEPTH ${String(Math.round(worldY)).padStart(4, "0")}m`, 14, screenY - 10);
  }
}

function drawBackgroundMarkers() {
  ctx.font = "12px 'Courier New', monospace";
  ctx.textBaseline = "top";

  for (const marker of getCurrentStage().markers) {
    if (!isPointVisible(marker.x, marker.y, 40)) {
      continue;
    }

    const x = Math.round(marker.x - cameraX);
    const y = Math.round(marker.y - cameraY);

    ctx.fillStyle = gba("black", 0.35);
    ctx.fillRect(x - 12, y, 24, 2);
    ctx.fillRect(x, y - 12, 2, 24);
    ctx.fillText(marker.label, x + 10, y + 8);
  }
}

function drawSeafloor() {
  const firstWorldX = Math.floor(cameraX / 40) * 40 - 40;
  const lastWorldX = cameraX + SCREEN_WIDTH + 40;

  ctx.beginPath();
  ctx.moveTo(Math.round(firstWorldX - cameraX), SCREEN_HEIGHT + 80);

  for (let worldX = firstWorldX; worldX <= lastWorldX; worldX += 40) {
    const worldY = getSeafloorY(worldX);
    ctx.lineTo(Math.round(worldX - cameraX), Math.round(worldY - cameraY));
  }

  ctx.lineTo(SCREEN_WIDTH + 80, SCREEN_HEIGHT + 80);
  ctx.closePath();
  ctx.fillStyle = gb("dark");
  ctx.fill();

  ctx.strokeStyle = gb("black");
  ctx.lineWidth = 3;
  ctx.beginPath();

  for (let worldX = firstWorldX; worldX <= lastWorldX; worldX += 40) {
    const worldY = getSeafloorY(worldX);
    const screenX = Math.round(worldX - cameraX);
    const screenY = Math.round(worldY - cameraY);

    if (worldX === firstWorldX) {
      ctx.moveTo(screenX, screenY);
    } else {
      ctx.lineTo(screenX, screenY);
    }
  }

  ctx.stroke();
}

function drawWorldBorder() {
  ctx.strokeStyle = gb("black");
  ctx.lineWidth = 2;

  const left = Math.round(-cameraX);
  const right = Math.round(WORLD_WIDTH - cameraX);
  const top = Math.round(-cameraY);
  const bottom = Math.round(WORLD_HEIGHT - cameraY);

  if (left >= -4 && left <= SCREEN_WIDTH + 4) line(left, 0, left, SCREEN_HEIGHT);
  if (right >= -4 && right <= SCREEN_WIDTH + 4) line(right, 0, right, SCREEN_HEIGHT);
  if (top >= -4 && top <= SCREEN_HEIGHT + 4) line(0, top, SCREEN_WIDTH, top);
  if (bottom >= -4 && bottom <= SCREEN_HEIGHT + 4) line(0, bottom, SCREEN_WIDTH, bottom);
}

function drawSupplies() {
  for (const supply of supplies) {
    if (!supply.active) {
      continue;
    }

    if (!isPointVisible(supply.x, supply.y, 80)) {
      continue;
    }

    const x = Math.round(supply.x - cameraX);
    const bob = supply.kind === "airBuoy" ? Math.sin(supply.phase) * 4 : 0;
    const y = Math.round(supply.y - cameraY + bob);
    const flash = supply.flashTimer > 0 && Math.floor(supply.flashTimer / 8) % 2 === 0;

    if (supply.kind === "airBuoy") {
      drawSupplyBuoy(x, y, flash);
    } else {
      drawSupplyPod(x, y, flash);
    }
  }
}

function drawSupplyPod(x, y, flash) {
  ctx.fillStyle = flash ? gb("light") : gb("black");
  ctx.fillRect(x - 14, y - 10, 28, 20);
  ctx.fillStyle = gb("mid");
  ctx.fillRect(x - 9, y - 5, 18, 10);
  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 2, y - 15, 4, 30);
  ctx.fillRect(x - 17, y - 2, 34, 4);
}

function drawSupplyBuoy(x, y, flash) {
  // 空中戦の補給は、海面に浮いたブイとして描きます。
  ctx.fillStyle = flash ? gb("light") : gb("black");
  ctx.fillRect(x - 12, y - 13, 24, 18);
  ctx.fillStyle = gb("light");
  ctx.fillRect(x - 7, y - 8, 14, 8);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - 16, y + 5, 32, 5);
  ctx.fillRect(x - 4, y - 22, 8, 9);
  ctx.fillStyle = gba("light", 0.42);
  ctx.fillRect(x - 24, y + 13, 18, 2);
  ctx.fillRect(x + 8, y + 13, 18, 2);
}

function drawBombs() {
  for (const bomb of bombs) {
    if (!isObjectVisible(bomb, 40)) {
      continue;
    }

    const x = Math.round(bomb.x - cameraX);
    const y = Math.round(bomb.y - cameraY);

    if (bomb.kind === "aa") {
      ctx.fillStyle = gb("light");
      ctx.fillRect(x - 2, y - 10, 4, 20);
      ctx.fillStyle = gb("black");
      ctx.fillRect(x - 4, y + 3, 8, 5);
    } else {
      ctx.fillStyle = gb("black");
      ctx.fillRect(x - 3, y - 7, 6, 14);
      ctx.fillStyle = gb("dark");
      ctx.fillRect(x - 6, y + 5, 12, 3);
      ctx.fillStyle = gb("light");
      ctx.fillRect(x - 2, y - 10, 4, 3);
    }
  }
}

function drawEnemies() {
  for (const enemy of enemies) {
    if (!enemy.alive || !isObjectVisible(enemy, 90)) {
      continue;
    }

    const visibility = getEnemyVisibility(enemy);

    if (visibility < 0.36 && enemy.detectedTimer <= 0) {
      drawEnemyShadow(enemy, visibility);
    } else {
      drawEnemySprite(enemy, visibility);
    }

    if (enemy.pingTimer > 0) {
      drawEnemyPingOutline(enemy);
    }
  }
}

function drawEnemySprite(enemy, visibility) {
  ctx.save();
  ctx.globalAlpha = clamp(visibility, 0.18, 1);

  if (enemy.type === "drone") drawDrone(enemy);
  if (enemy.type === "torpedo") drawTorpedo(enemy);
  if (enemy.type === "mine") drawMine(enemy);
  if (enemy.type === "abyssBoss") drawAbyssBoss(enemy);
  if (enemy.type === "helicopter") drawHelicopter(enemy);
  if (enemy.type === "plane") drawPlane(enemy);
  if (enemy.type === "ufo") drawUfo(enemy);
  if (enemy.type === "skyBoss") drawSkyBoss(enemy);

  ctx.restore();
}

function drawEnemyShadow(enemy, visibility) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);
  const alpha = clamp(visibility + game.sonarFlashTimer / 120, 0.12, 0.48);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = gb("black");
  ctx.shadowBlur = 8;
  ctx.fillStyle = gb("black");
  ctx.fillRect(x - enemy.width / 2 - 4, y - enemy.height / 2 - 2, enemy.width + 8, enemy.height + 4);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - enemy.width / 2, y - 2, enemy.width, 4);
  ctx.restore();
}

function drawEnemyPingOutline(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);
  const alpha = clamp(enemy.pingTimer / CONFIG.sonar.pingTime, 0, 1);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = gb("light");
  ctx.lineWidth = 3;
  ctx.strokeRect(
    Math.round(x - enemy.width / 2 - 6),
    Math.round(y - enemy.height / 2 - 6),
    enemy.width + 12,
    enemy.height + 12
  );
  ctx.restore();
}

function drawDrone(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);

  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 27, y - 8, 54, 16);
  ctx.fillRect(x - 19, y - 15, 32, 7);
  ctx.fillRect(x - 12, y + 8, 24, 6);
  ctx.fillStyle = gb("light");
  ctx.fillRect(x + enemy.direction * 20 - 3, y - 3, 6, 6);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - 38, y - 3, 11, 6);
  ctx.fillRect(x + 27, y - 3, 11, 6);
}

function drawTorpedo(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);

  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 21, y - 5, 42, 10);
  ctx.fillStyle = gb("light");
  ctx.fillRect(x + enemy.direction * 16 - 3, y - 3, 6, 6);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - enemy.direction * 24 - 4, y - 8, 8, 16);
  ctx.fillRect(x - 7, y + 5, 14, 5);
}

function drawMine(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);

  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 10, y - 10, 20, 20);
  ctx.fillStyle = gb("light");
  ctx.fillRect(x - 5, y - 5, 10, 10);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - 2, y - 18, 4, 8);
  ctx.fillRect(x - 2, y + 10, 4, 8);
  ctx.fillRect(x - 18, y - 2, 8, 4);
  ctx.fillRect(x + 10, y - 2, 8, 4);
}

function drawAbyssBoss(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);

  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 74, y - 24, 148, 48);
  ctx.fillRect(x - 52, y - 38, 104, 14);
  ctx.fillRect(x - 62, y + 24, 124, 14);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - 92, y - 7, 18, 14);
  ctx.fillRect(x + 74, y - 7, 18, 14);
  ctx.fillRect(x - 18, y + 38, 36, 8);

  if (isAbyssWeakPointVisible(enemy)) {
    const weak = getAbyssWeakPointBox(enemy);
    ctx.fillStyle = enemy.pingTimer > 0 ? gb("light") : gb("mid");
    ctx.fillRect(Math.round(weak.left - cameraX), Math.round(weak.top - cameraY), weak.right - weak.left, weak.bottom - weak.top);
  }

  drawBossHealthBar(enemy, x - 74, y - 56, 148);
}

function drawHelicopter(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);

  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 22, y - 5, 44, 11);
  ctx.fillRect(x - 14, y + 6, 22, 7);
  ctx.fillRect(x + 18 * enemy.direction, y - 2, 14 * enemy.direction, 5);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - 30, y - 13, 60, 3);
  ctx.fillRect(x - 5, y - 20, 10, 3);
  ctx.fillStyle = gb("light");
  ctx.fillRect(x + 9 * enemy.direction, y - 2, 6, 5);
}

function drawPlane(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);

  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 24, y - 4, 48, 8);
  ctx.fillRect(x - 8, y - 14, 22, 8);
  ctx.fillRect(x - 10, y + 5, 28, 7);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - enemy.direction * 30 - 4, y - 9, 8, 18);
  ctx.fillStyle = gb("light");
  ctx.fillRect(x + enemy.direction * 17 - 3, y - 3, 6, 6);
}

function drawUfo(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);

  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 22, y - 4, 44, 12);
  ctx.fillRect(x - 14, y - 12, 28, 8);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - 30, y + 2, 8, 5);
  ctx.fillRect(x + 22, y + 2, 8, 5);
  ctx.fillStyle = gb("light");
  ctx.fillRect(x - 8, y - 8, 16, 4);
}

function drawSkyBoss(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);

  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 86, y - 18, 172, 36);
  ctx.fillRect(x - 54, y - 32, 108, 14);
  ctx.fillRect(x - 64, y + 18, 128, 12);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - 106, y - 6, 20, 12);
  ctx.fillRect(x + 86, y - 6, 20, 12);
  ctx.fillRect(x - 18, y + 30, 36, 8);

  if (isSkyBossWeakPointOpen(enemy)) {
    const weak = getSkyBossWeakPointBox(enemy);
    ctx.fillStyle = gb("light");
    ctx.fillRect(Math.round(weak.left - cameraX), Math.round(weak.top - cameraY), weak.right - weak.left, weak.bottom - weak.top);
  } else {
    ctx.fillStyle = gb("mid");
    ctx.fillRect(x - 18, y - 7, 36, 6);
  }

  drawBossHealthBar(enemy, x - 86, y - 48, 172);
}

function drawBossHealthBar(enemy, x, y, width) {
  const rate = clamp(enemy.health / enemy.maxHealth, 0, 1);

  ctx.fillStyle = gb("black");
  ctx.fillRect(x, y, width, 8);
  ctx.fillStyle = gb("light");
  ctx.fillRect(x + 2, y + 2, Math.round((width - 4) * rate), 4);
}

function drawEnemyBullets() {
  for (const bullet of enemyBullets) {
    if (!isObjectVisible(bullet, 40)) {
      continue;
    }

    const x = Math.round(bullet.x - cameraX);
    const y = Math.round(bullet.y - cameraY);

    ctx.fillStyle = bullet.kind === "laser" ? gb("light") : gb("black");
    ctx.fillRect(x - bullet.width / 2, y - bullet.height / 2, bullet.width, bullet.height);
    ctx.fillStyle = bullet.vy > 0 ? gb("dark") : gb("light");
    ctx.fillRect(x - 2, y + (bullet.vy > 0 ? 6 : -9), 4, 3);
  }
}

function drawPlayer() {
  if (player.invincibleTimer > 0 && Math.floor(player.invincibleTimer / 8) % 2 === 0) {
    return;
  }

  const x = Math.round(player.x - cameraX);
  const y = Math.round(player.y - cameraY);

  if (isSeaStage()) {
    drawSubmersiblePlayer(x, y);
    return;
  }

  drawSurfaceInterceptorPlayer(x, y);
}

function drawSubmersiblePlayer(x, y) {
  // 海中ステージの自機は水上艦ではなく、潜航艇・深海調査艇として描きます。
  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 29, y - 9, 58, 18);
  ctx.fillRect(x - 20, y - 17, 28, 8);
  ctx.fillRect(x - 18, y + 9, 36, 7);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - 40, y - 4, 12, 8);
  ctx.fillRect(x + 29, y - 5, 12, 10);
  ctx.fillRect(x - 5, y - 25, 5, 8);
  ctx.fillRect(x - 10, y - 28, 15, 3);
  ctx.fillStyle = gb("light");
  ctx.fillRect(x + 15, y - 4, 7, 7);
  ctx.fillRect(x - 4, y - 13, 6, 5);
  ctx.fillRect(x + 5, y - 13, 6, 5);
}

function drawSurfaceInterceptorPlayer(x, y) {
  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 32, y - 5, 64, 10);
  ctx.fillRect(x - 24, y + 5, 48, 7);
  ctx.fillRect(x - 8, y - 18, 22, 13);
  ctx.fillStyle = gb("light");
  ctx.fillRect(x + 26, y - 2, 12, 7);
  ctx.fillRect(x - 3, y - 15, 6, 5);
  ctx.fillRect(x + 6, y - 15, 6, 5);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - 39, y - 2, 10, 7);
  ctx.fillRect(x + 16, y - 26, 3, 10);
  ctx.fillRect(x + 12, y - 28, 10, 2);

  if (isAirStage()) {
    // 空中戦では艦橋上に対空砲を表示し、攻撃モードの違いを見た目でも伝えます。
    ctx.fillStyle = gb("light");
    ctx.fillRect(x - 3, y - 34, 6, 14);
    ctx.fillRect(x - 8, y - 23, 16, 4);
  }
}

function drawSonarPulses() {
  for (const pulse of sonarPulses) {
    if (!isPointVisible(pulse.x, pulse.y, pulse.radius + 20)) {
      continue;
    }

    const x = Math.round(pulse.x - cameraX);
    const y = Math.round(pulse.y - cameraY);
    const alpha = clamp(pulse.life / pulse.maxLife, 0, 1);

    ctx.save();
    ctx.strokeStyle = gba("light", 0.8 * alpha);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, pulse.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = gba("black", 0.36 * alpha);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, pulse.radius * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawExplosions() {
  for (const explosion of explosions) {
    if (!isPointVisible(explosion.x, explosion.y, explosion.radius + 30)) {
      continue;
    }

    const x = Math.round(explosion.x - cameraX);
    const y = Math.round(explosion.y - cameraY);
    const r = Math.round(explosion.radius);

    ctx.fillStyle = gb(explosion.color);
    ctx.fillRect(x - r, y - 2, r * 2, 4);
    ctx.fillRect(x - 2, y - r, 4, r * 2);
    ctx.fillStyle = gb("light");
    ctx.fillRect(x - 3, y - 3, 6, 6);
  }
}

function drawMuzzleFlashes() {
  for (const flash of muzzleFlashes) {
    if (!isPointVisible(flash.x, flash.y, 30)) {
      continue;
    }

    const x = Math.round(flash.x - cameraX);
    const y = Math.round(flash.y - cameraY);
    const r = Math.round(flash.radius);

    ctx.fillStyle = gb("light");
    ctx.fillRect(x - r, y - 2, r * 2, 4);
    ctx.fillRect(x - 2, y - r, 4, r * 2);
    ctx.fillStyle = gb("black");
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
}

function drawDepthOverlay() {
  const deep = isAirStage() ? 0.08 : getDepthFactor(player.y);
  ctx.fillStyle = gba("black", 0.06 + deep * 0.28);
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  if (game.sonarFlashTimer > 0) {
    ctx.fillStyle = gba("light", game.sonarFlashTimer / 180);
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  }
}

function drawHud() {
  ctx.fillStyle = gb("black");
  ctx.fillRect(0, 0, SCREEN_WIDTH, 72);

  const ammoLabel = isAirStage() ? "AA SHELL" : "DEPTH CHARGE";
  const sensorLabel = getSensorLabel();
  const sensorText = game.sonarCooldown <= 0
    ? `${sensorLabel} READY`
    : `${sensorLabel} ${Math.ceil(game.sonarCooldown / 60)}`;

  ctx.fillStyle = gb("light");
  ctx.font = "16px 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`SCORE ${padScore(game.score)}`, 18, 18);
  ctx.fillText(`LIVES ${game.lives}`, 178, 18);
  ctx.fillText(`${ammoLabel} ${game.ammo}/${CONFIG.player.maxAmmo}`, 282, 18);
  ctx.fillText(`DEPTH ${Math.round(player.y)}m`, 520, 18);

  ctx.fillStyle = gb("mid");
  ctx.fillText(`STAGE ${game.stageIndex + 1}: ${game.stageName}`, 18, 48);
  ctx.fillText(`MODE: ${getStageModeLabel()}`, 330, 48);

  ctx.fillStyle = game.sonarCooldown <= 0 ? gb("light") : gb("mid");
  ctx.fillText(sensorText, 506, 48);
  drawSonarCooldownBar(632, 39, 78, 12);

  ctx.fillStyle = gb("mid");
  ctx.fillText(`SND ${game.soundEnabled ? "ON" : "OFF"}`, 720, 48);

  if (game.ammo <= 0) {
    ctx.fillStyle = gb("light");
    ctx.fillText(isAirStage() ? "NO AA" : "NO CHG", 690, 18);
  } else if (game.statusTimer > 0) {
    ctx.fillStyle = gb("light");
    ctx.fillText(game.statusText, 650, 18);
  }
}

function drawSonarCooldownBar(x, y, width, height) {
  const charge = 1 - clamp(game.sonarCooldown / CONFIG.sonar.cooldown, 0, 1);

  ctx.strokeStyle = gb("mid");
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = gb("light");
  ctx.fillRect(x + 2, y + 2, Math.round((width - 4) * charge), height - 4);
}

function drawMinimap() {
  const mapWidth = 154;
  const mapHeight = 78;
  const mapX = SCREEN_WIDTH - mapWidth - 18;
  const mapY = 86;
  const scaleX = mapWidth / WORLD_WIDTH;
  const scaleY = mapHeight / WORLD_HEIGHT;

  ctx.fillStyle = gba("black", 0.72);
  ctx.fillRect(mapX, mapY, mapWidth, mapHeight);
  ctx.strokeStyle = gb("light");
  ctx.lineWidth = 2;
  ctx.strokeRect(mapX, mapY, mapWidth, mapHeight);

  ctx.strokeStyle = gb("mid");
  ctx.lineWidth = 1;
  ctx.strokeRect(
    Math.round(mapX + cameraX * scaleX),
    Math.round(mapY + cameraY * scaleY),
    Math.round(SCREEN_WIDTH * scaleX),
    Math.round(SCREEN_HEIGHT * scaleY)
  );

  for (const supply of supplies) {
    if (!supply.active) {
      continue;
    }

    ctx.fillStyle = gb("light");
    ctx.fillRect(Math.round(mapX + supply.x * scaleX) - 2, Math.round(mapY + supply.y * scaleY) - 2, 5, 5);
  }

  for (const enemy of enemies) {
    if (!enemy.alive) {
      continue;
    }

    const alpha = getEnemyMapAlpha(enemy);

    if (alpha <= 0) {
      continue;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = enemy.detectedTimer > 0 ? gb("light") : gb("mid");
    ctx.fillRect(Math.round(mapX + enemy.x * scaleX) - 2, Math.round(mapY + enemy.y * scaleY) - 2, 4, 4);
    ctx.restore();
  }

  ctx.fillStyle = gb("black");
  ctx.fillRect(Math.round(mapX + player.x * scaleX) - 3, Math.round(mapY + player.y * scaleY) - 3, 6, 6);
}

function drawControlHelp() {
  ctx.fillStyle = gb("black");
  ctx.fillRect(0, SCREEN_HEIGHT - 36, SCREEN_WIDTH, 36);
  ctx.fillStyle = gb("light");
  ctx.font = "14px 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("MOVE ARROW/WASD  SPACE FIRE  E/SHIFT SONAR/RADAR  P/ESC PAUSE  M SOUND  R RESTART", 18, SCREEN_HEIGHT - 18);
}

function drawCenteredMessage(title, subtitle, prompt) {
  ctx.fillStyle = gba("black", 0.78);
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = gb("light");
  ctx.font = "42px 'Courier New', monospace";
  ctx.fillText(title, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 34);

  ctx.fillStyle = gb("mid");
  ctx.font = "20px 'Courier New', monospace";
  ctx.fillText(subtitle, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 22);

  if (prompt) {
    ctx.fillText(prompt, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 62);
  }

  ctx.textAlign = "left";
}

function drawLcdOverlay() {
  // 疑似LCDの走査線と残像感です。低解像度canvasを拡大する前提で薄く重ねます。
  ctx.fillStyle = gba("black", 0.08);

  for (let y = 0; y < SCREEN_HEIGHT; y += 4) {
    ctx.fillRect(0, y, SCREEN_WIDTH, 1);
  }

  ctx.fillStyle = gba("light", 0.06);
  for (let x = 0; x < SCREEN_WIDTH; x += 6) {
    ctx.fillRect(x, 0, 1, SCREEN_HEIGHT);
  }

  ctx.strokeStyle = gba("black", 0.5);
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, SCREEN_WIDTH - 8, SCREEN_HEIGHT - 8);
}

// ------------------------------------------------------------
// ステージと状態
// ------------------------------------------------------------

function startNewGame() {
  game.score = 0;
  game.lives = CONFIG.player.maxLives;
  game.ammo = CONFIG.player.maxAmmo;
  game.lastTime = 0;
  loadStage(0, false);
  game.state = STATE.PLAYING;
  playSound("start");
}

function returnToTitle() {
  game.lastTime = 0;
  loadStage(0, false);
  game.state = STATE.TITLE;
  setStatus("", 0);
}

function createEnemy(layout, index) {
  const base = ENEMY_TYPES[layout.type];
  const stage = getCurrentStage();
  const patrolPadding = base.boss ? 520 : layout.type === "torpedo" || layout.type === "plane" ? 320 : 210;
  const baseFireInterval = base.fireInterval > 0
    ? Math.max(34, base.fireInterval * (stage.fireRate || 1))
    : 0;

  return {
    id: index,
    type: layout.type,
    name: base.name,
    domain: base.domain,
    x: layout.x,
    y: layout.y,
    width: base.width,
    height: base.height,
    health: layout.health || base.health,
    maxHealth: layout.health || base.health,
    speed: layout.speed || base.speed,
    score: base.score,
    direction: layout.direction || 1,
    alive: true,
    fireInterval: baseFireInterval + (baseFireInterval > 0 ? (index % 3) * 12 : 0),
    fireTimer: 50 + index * 13,
    patrolLeft: Math.max(base.width / 2, layout.patrolLeft || layout.x - patrolPadding),
    patrolRight: Math.min(WORLD_WIDTH - base.width / 2, layout.patrolRight || layout.x + patrolPadding),
    patrolTop: layout.patrolTop || 260,
    verticalDrift: layout.verticalDrift || 0,
    phase: index * 0.8,
    hatchTimer: layout.hatchTimer || 0,
    summonTimer: layout.summonTimer || 220,
    spawnedByBoss: Boolean(layout.spawnedByBoss),
    detectedTimer: layout.initiallyDetected ? CONFIG.sonar.revealTime : 0,
    pingTimer: 0,
  };
}

function loadStage(stageIndex, keepPlayerResources) {
  const stage = STAGES[stageIndex];

  game.stageIndex = stageIndex;
  game.stageName = stage.name;
  game.stageType = stage.type || STAGE_TYPE.SEA;
  game.state = STATE.PLAYING;
  game.clearTimer = 0;
  game.bombCooldown = 0;
  game.sonarCooldown = 0;
  game.sonarFlashTimer = 0;
  game.statusText = "";
  game.statusTimer = 0;

  if (!keepPlayerResources) {
    game.score = 0;
    game.lives = CONFIG.player.maxLives;
    game.ammo = CONFIG.player.maxAmmo;
  } else {
    game.ammo = CONFIG.player.maxAmmo;
  }

  player.x = stage.start.x;
  player.y = stage.start.y;
  player.speed = isAirStage() ? CONFIG.player.speed * 0.92 : CONFIG.player.speed;
  player.invincibleTimer = 0;

  cameraX = clamp(player.x - SCREEN_WIDTH * 0.44, 0, WORLD_WIDTH - SCREEN_WIDTH);
  cameraY = isAirStage() ? 0 : clamp(player.y - SCREEN_HEIGHT * 0.30, 0, WORLD_HEIGHT - SCREEN_HEIGHT);

  bombs.length = 0;
  enemyBullets.length = 0;
  explosions.length = 0;
  sonarPulses.length = 0;
  muzzleFlashes.length = 0;

  enemies.length = 0;
  for (let i = 0; i < stage.enemies.length; i += 1) {
    enemies.push(createEnemy(stage.enemies[i], i));
  }

  supplies.length = 0;
  createStageSupplyPoint();

  setStatus(`ENTER ${stage.name}`, 130);
}

function getCurrentStage() {
  return STAGES[game.stageIndex];
}

function createStageSupplyPoint() {
  const supply = {
    x: 0,
    y: 0,
    kind: isAirStage() ? "airBuoy" : "seaPod",
    active: true,
    respawnTimer: 0,
    flashTimer: 80,
    phase: Math.random() * Math.PI * 2,
  };

  placeSupplyRandomly(supply);
  supplies.push(supply);
}

function placeSupplyRandomly(supply) {
  const position = getRandomSupplyPosition();

  supply.x = position.x;
  supply.y = position.y;
  supply.kind = position.kind;
  supply.active = true;
  supply.respawnTimer = 0;
  supply.flashTimer = 90;
  supply.phase = Math.random() * Math.PI * 2;
}

function getRandomSupplyPosition() {
  if (game.stageType === STAGE_TYPE.AIR) {
    return {
      x: randomWorldX(),
      y: getAirSupplyY(),
      kind: "airBuoy",
    };
  }

  if (game.stageType === STAGE_TYPE.AIR_BOSS) {
    return getAirBossSupplyPosition();
  }

  if (game.stageType === STAGE_TYPE.SEA_BOSS) {
    return getSeaBossSupplyPosition();
  }

  return {
    x: randomWorldX(),
    y: randomRange(CONFIG.sea.supplyMinDepth, CONFIG.sea.supplyMaxDepth),
    kind: "seaPod",
  };
}

function getSeaBossSupplyPosition() {
  const boss = enemies.find((enemy) => enemy.alive && enemy.type === "abyssBoss");

  for (let i = 0; i < 24; i += 1) {
    const x = randomWorldX();
    const y = randomRange(CONFIG.sea.bossSupplyMinDepth, CONFIG.sea.bossSupplyMaxDepth);

    if (!boss || distance(x, y, boss.x, boss.y) > 520) {
      return { x, y, kind: "seaPod" };
    }
  }

  return { x: 360, y: 420, kind: "seaPod" };
}

function getAirBossSupplyPosition() {
  const boss = enemies.find((enemy) => enemy.alive && enemy.type === "skyBoss");

  for (let i = 0; i < 24; i += 1) {
    const x = randomWorldX();

    if (!boss || Math.abs(x - boss.x) > 320) {
      return { x, y: getAirSupplyY(), kind: "airBuoy" };
    }
  }

  return { x: 320, y: getAirSupplyY(), kind: "airBuoy" };
}

function randomSupplyRespawnTime() {
  const stage = getCurrentStage();

  // stage.supplyRespawn を追加すれば、ステージ単位で再出現時間を上書きできます。
  if (stage.supplyRespawn) {
    return randomRange(stage.supplyRespawn.min, stage.supplyRespawn.max);
  }

  if (isBossStage()) {
    return randomRange(CONFIG.supply.bossRespawnMin, CONFIG.supply.bossRespawnMax);
  }

  return randomRange(CONFIG.supply.normalRespawnMin, CONFIG.supply.normalRespawnMax);
}

function randomWorldX() {
  return randomRange(CONFIG.supply.edgeMargin, WORLD_WIDTH - CONFIG.supply.edgeMargin);
}

function getAirSeaSurfaceY() {
  return CONFIG.air.seaSurfaceY;
}

function getAirSupplyY() {
  return getAirSeaSurfaceY() + CONFIG.air.supplyOffset;
}

function getSeaSurfaceY() {
  return CONFIG.sea.seaSurfaceY;
}

// ------------------------------------------------------------
// 汎用関数
// ------------------------------------------------------------

function addExplosion(x, y, radius, growth, color) {
  explosions.push({
    x,
    y,
    radius,
    growth,
    color,
    life: 24,
  });
}

function addMuzzleFlash(x, y) {
  muzzleFlashes.push({
    x,
    y,
    radius: 4,
    life: 10,
  });
}

function setStatus(text, duration) {
  game.statusText = text;
  game.statusTimer = duration;
}

function isAirStage() {
  return game.stageType === STAGE_TYPE.AIR || game.stageType === STAGE_TYPE.AIR_BOSS;
}

function isSeaStage() {
  return game.stageType === STAGE_TYPE.SEA || game.stageType === STAGE_TYPE.SEA_BOSS;
}

function isBossStage() {
  return game.stageType === STAGE_TYPE.SEA_BOSS || game.stageType === STAGE_TYPE.AIR_BOSS;
}

function getStageModeLabel() {
  if (isAirStage()) return "SURFACE AIR";
  if (game.stageType === STAGE_TYPE.SEA_BOSS) return "BOSS";
  return "DEEP SEA";
}

function getSensorLabel() {
  return isAirStage() ? "RADAR" : "SONAR";
}

function getEnemyDomain(enemy) {
  return enemy.domain || (ENEMY_TYPES[enemy.type] ? ENEMY_TYPES[enemy.type].domain : "sea");
}

function isAbyssWeakPointVisible(enemy) {
  return enemy.detectedTimer > 0 || enemy.pingTimer > 0;
}

function isSkyBossWeakPointOpen(enemy) {
  return enemy.hatchTimer < 82;
}

function getAbyssWeakPointBox(enemy) {
  return {
    left: enemy.x - 18,
    right: enemy.x + 18,
    top: enemy.y - 10,
    bottom: enemy.y + 20,
  };
}

function getSkyBossWeakPointBox(enemy) {
  return {
    left: enemy.x - 22,
    right: enemy.x + 22,
    top: enemy.y - 14,
    bottom: enemy.y + 8,
  };
}

function getEnemyVisibility(enemy) {
  if (getEnemyDomain(enemy) === "air") {
    return enemy.detectedTimer > 0 ? 1 : 0.9;
  }

  if (enemy.detectedTimer > 0) {
    return 1;
  }

  if (enemy.pingTimer > 0) {
    return 0.78;
  }

  const depth = getDepthFactor(enemy.y);
  const visibility = 1 - depth * 0.92 + getCurrentStage().visibilityBonus;
  return clamp(visibility, 0.12, 1);
}

function getEnemyMapAlpha(enemy) {
  if (getEnemyDomain(enemy) === "air") return enemy.detectedTimer > 0 || enemy.y < 260 ? 1 : 0.76;
  if (ENEMY_TYPES[enemy.type].boss) return enemy.detectedTimer > 0 ? 1 : 0.34;
  if (enemy.detectedTimer > 0) return 1;
  if (enemy.y < 440) return 0.78;
  if (enemy.y < 760) return 0.22;
  return 0.06;
}

function getDepthFactor(worldY) {
  return clamp((worldY - 180) / 860, 0, 1);
}

function getSeafloorY(worldX) {
  return WORLD_HEIGHT - 94 + Math.sin(worldX * 0.006) * 18 + Math.sin(worldX * 0.018) * 7;
}

function getBox(object) {
  return {
    left: object.x - object.width / 2,
    right: object.x + object.width / 2,
    top: object.y - object.height / 2,
    bottom: object.y + object.height / 2,
  };
}

function isColliding(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function isObjectVisible(object, margin) {
  const box = getBox(object);

  return (
    box.right >= cameraX - margin &&
    box.left <= cameraX + SCREEN_WIDTH + margin &&
    box.bottom >= cameraY - margin &&
    box.top <= cameraY + SCREEN_HEIGHT + margin
  );
}

function isPointVisible(x, y, margin) {
  return (
    x >= cameraX - margin &&
    x <= cameraX + SCREEN_WIDTH + margin &&
    y >= cameraY - margin &&
    y <= cameraY + SCREEN_HEIGHT + margin
  );
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function removeWhere(array, shouldRemove) {
  for (let i = array.length - 1; i >= 0; i -= 1) {
    if (shouldRemove(array[i])) {
      array.splice(i, 1);
    }
  }
}

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function padScore(score) {
  return String(score).padStart(6, "0");
}

function gb(name) {
  return CONFIG.palette[name] || CONFIG.palette.black;
}

function gba(name, alpha) {
  const color = parseHexColor(gb(name));
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function parseHexColor(hex) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

// ブラウザ確認用の読み取り用デバッグ窓です。
// 通常のプレイには影響しません。
window.__deepSignalDebug = {
  getState() {
    return {
      version: CONFIG.version,
      state: game.state,
      stageIndex: game.stageIndex,
      stageName: game.stageName,
      stageType: game.stageType,
      mode: getStageModeLabel(),
      score: game.score,
      lives: game.lives,
      ammo: game.ammo,
      soundEnabled: game.soundEnabled,
      sonarCooldown: game.sonarCooldown,
      playerX: player.x,
      playerY: player.y,
      cameraX,
      cameraY,
      seaSurfaceY: getSeaSurfaceY(),
      airSeaSurfaceY: getAirSeaSurfaceY(),
      bombs: bombs.length,
      projectiles: bombs.map((bomb) => bomb.kind || "depth"),
      enemiesAlive: enemies.filter((enemy) => enemy.alive).length,
      bosses: enemies
        .filter((enemy) => ENEMY_TYPES[enemy.type].boss)
        .map((enemy) => ({ type: enemy.type, alive: enemy.alive, health: enemy.health, hatchOpen: isSkyBossWeakPointOpen(enemy) })),
      supplies: supplies.map((supply) => ({
        x: supply.x,
        y: supply.y,
        kind: supply.kind,
        active: supply.active,
        respawnTimer: supply.respawnTimer,
      })),
      render: {
        internalWidth: canvas.width,
        internalHeight: canvas.height,
        logicalWidth: SCREEN_WIDTH,
        logicalHeight: SCREEN_HEIGHT,
      },
    };
  },
};

// タイトル画面の背景用にステージ1を読み込み、状態だけtitleへ戻します。
loadStage(0, false);
game.state = STATE.TITLE;
requestAnimationFrame(gameLoop);
