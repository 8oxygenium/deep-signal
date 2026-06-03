// ============================================================
// DEEP SIGNAL v0.5.1 vertical control hint tuning
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
  version: "v0.5.1 vertical control hint tuning",

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
    seaHeight: 1700,
    airHeight: 1200,
    spaceHeight: 1400,
  },

  player: {
    startLives: 3,
    maxLives: 5,
    maxAmmo: 12,
    speed: 4.4,
    width: 66,
    height: 22,
    invincibleTime: 118,
    contactKnockback: 46,
    bossKnockback: 82,
  },

  sonar: {
    range: 500,
    cooldown: 340,
    revealTime: 360,
    pingTime: 104,
    pulseTime: 76,
  },

  gameplay: {
    supplyRadius: 70,
    clearDelay: 180,
    bombLimit: 10,
    orbitalUnlockDelay: 300,
  },

  storage: {
    unlockKey: "DEEP_SIGNAL_UNLOCKS",
  },

  // 宇宙エンドレス用の基本値です。
  // space タイプだけが全方向自由移動になり、海面や深度の制約を受けません。
  space: {
    supplyRespawnMin: 1320,
    supplyRespawnMax: 1920,
    enemyMinY: 140,
    enemyMaxY: 1220,
    playerMargin: 54,
    waveClearDelay: 72,
    beamCooldown: 7,
    beamSpeed: 9.1,
    beamWidth: 9,
    beamHeight: 24,
    signalCoreWave: 10,
    signalCoreClearDelay: 180,
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
    supplyMaxDepth: 1180,
    bossSupplyMinDepth: 310,
    bossSupplyMaxDepth: 980,
  },

  // 補給は固定配置ではなく、ステージ開始時と再出現時にランダム配置します。
  // 各ステージ側に supplyRespawn を置けば個別調整できます。
  supply: {
    normalRespawnMin: 1080,
    normalRespawnMax: 1500,
    bossRespawnMin: 1800,
    bossRespawnMax: 2400,
    edgeMargin: 170,
    lowAmmoRespawnFactor: 0.46,
    searchSamples: 28,
  },

  drops: {
    oneUpBaseChance: 0.018,
    oneUpStrongChance: 0.045,
    oneUpBossChance: 1.0,
    oneUpLifetime: 560,
    oneUpScoreBonus: 1000,
    pickupRadius: 42,
  },

  effects: {
    bossWarningTime: 150,
    bossEntryTime: 170,
    maxParticles: 78,
  },

  input: {
    // スマホの左側ドラッグは、指の座標へ吸い寄せるのではなく、
    // 指を動かした量だけ相対移動させます。調整しやすいよう倍率を設定化しています。
    touchMoveScale: 1.35,
    touchVerticalMoveScale: 1.68,
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
  STAGE_SELECT: "stageSelect",
  STAGE_CLEAR: "stageClear",
  GAME_OVER: "gameOver",
  COMPLETE: "complete",
};

const STAGE_TYPE = {
  SEA: "sea",
  SEA_BOSS: "seaBoss",
  AIR: "air",
  AIR_BOSS: "airBoss",
  SPACE: "space",
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

// スマホ用の仮想入力です。キーボード入力は従来通り残し、
// タッチ中だけ移動目標とショット継続フラグを足します。
const touchInput = {
  movePointerId: null,
  shootPointerId: null,
  moveActive: false,
  shootActive: false,
  targetX: 0,
  targetY: 0,
  dragStartScreenX: 0,
  dragStartScreenY: 0,
  dragStartPlayerX: 0,
  dragStartPlayerY: 0,
  dragLastScreenX: 0,
  dragLastScreenY: 0,
};

const game = {
  state: STATE.TITLE,
  score: 0,
  lives: CONFIG.player.startLives,
  ammo: CONFIG.player.maxAmmo,
  stageIndex: 0,
  stageName: "",
  stageType: STAGE_TYPE.SEA,
  bombCooldown: 0,
  sonarCooldown: 0,
  sonarFlashTimer: 0,
  clearTimer: 0,
  wave: 0,
  reachedWave: 0,
  spaceWavePending: false,
  spaceWaveTimer: 0,
  spaceBossClearPending: false,
  signalCoreDefeated: false,
  stageSelectIndex: 0,
  unlocks: {
    orbital: false,
    stageSelect: false,
  },
  bestScore: 0,
  bestWave: 0,
  bossWarningTimer: 0,
  screenShakeTimer: 0,
  screenShakePower: 0,
  statusText: "",
  statusTimer: 0,
  fireNoticeText: "",
  fireNoticeTimer: 0,
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
    speed: 3.95,
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
  rammer: {
    name: "突撃自爆ドローン",
    domain: "sea",
    width: 34,
    height: 18,
    health: 1,
    speed: 2.55,
    score: 230,
    fireInterval: 0,
  },
  abyssBoss: {
    name: "ABYSS CORE",
    domain: "sea",
    width: 156,
    height: 74,
    health: 10,
    speed: 0.85,
    score: 1600,
    fireInterval: 96,
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
    fireInterval: 130,
  },
  plane: {
    name: "飛行機",
    domain: "air",
    width: 54,
    height: 16,
    health: 1,
    speed: 3.45,
    score: 180,
    fireInterval: 108,
  },
  ufo: {
    name: "小型UFO",
    domain: "air",
    width: 42,
    height: 20,
    health: 2,
    speed: 1.8,
    score: 220,
    fireInterval: 92,
  },
  skyBoss: {
    name: "SKY SIGNAL MOTHERSHIP",
    domain: "air",
    width: 178,
    height: 58,
    health: 15,
    speed: 0.85,
    score: 2600,
    fireInterval: 72,
    boss: true,
  },
  asteroid: {
    name: "軌道隕石",
    domain: "space",
    width: 44,
    height: 38,
    health: 2,
    speed: 0.58,
    score: 110,
    fireInterval: 0,
  },
  orbitalDrone: {
    name: "軌道ドローン",
    domain: "space",
    width: 44,
    height: 22,
    health: 2,
    speed: 1.56,
    score: 210,
    fireInterval: 150,
  },
  signalWisp: {
    name: "信号ウィスプ",
    domain: "space",
    width: 30,
    height: 30,
    health: 1,
    speed: 1.05,
    score: 180,
    fireInterval: 0,
  },
  hunterUFO: {
    name: "追跡UFO",
    domain: "space",
    width: 46,
    height: 24,
    health: 2,
    speed: 1.24,
    score: 260,
    fireInterval: 158,
  },
  signalCore: {
    name: "SIGNAL CORE",
    domain: "space",
    width: 148,
    height: 82,
    health: 18,
    speed: 0.82,
    score: 3200,
    fireInterval: 112,
    boss: true,
  },
};

const STAGES = [
  {
    name: "COASTAL TEST AREA",
    type: STAGE_TYPE.SEA,
    start: { x: 180, y: 120 },
    visibilityBonus: 0.38,
    fireRate: 1.7,
    supplyRespawn: { min: 720, max: 960 },
    supplies: [{ x: 690, y: 230 }],
    markers: [
      { x: 430, y: 300, label: "TRAIN-1" },
      { x: 940, y: 420, label: "BUOY-A" },
      { x: 1480, y: 360, label: "PING" },
      { x: 2140, y: 520, label: "EXIT" },
    ],
    enemies: [
      { type: "drone", x: 470, y: 360, direction: 1, patrolLeft: 330, patrolRight: 720 },
      { type: "torpedo", x: 900, y: 500, direction: -1, patrolLeft: 650, patrolRight: 1160, speed: 3.35 },
      { type: "mine", x: 1240, y: 760, patrolTop: 470 },
      { type: "drone", x: 1600, y: 430, direction: -1, patrolLeft: 1390, patrolRight: 1810 },
    ],
  },
  {
    name: "SUNKEN GRID",
    type: STAGE_TYPE.SEA,
    start: { x: 180, y: 150 },
    visibilityBonus: 0.22,
    fireRate: 1.08,
    supplyRespawn: { min: 840, max: 1140 },
    supplies: [{ x: 780, y: 300 }],
    markers: [
      { x: 420, y: 420, label: "GRID-A" },
      { x: 860, y: 620, label: "BASE 02" },
      { x: 1380, y: 520, label: "RUST-LINE" },
      { x: 2040, y: 740, label: "BROKEN GATE" },
    ],
    enemies: [
      { type: "drone", x: 410, y: 420, direction: 1, patrolLeft: 260, patrolRight: 650 },
      { type: "torpedo", x: 710, y: 600, direction: -1, patrolLeft: 520, patrolRight: 980, speed: 3.55 },
      { type: "mine", x: 980, y: 850, patrolTop: 540 },
      { type: "drone", x: 1180, y: 560, direction: -1, patrolLeft: 960, patrolRight: 1430 },
      { type: "torpedo", x: 1510, y: 710, direction: 1, patrolLeft: 1250, patrolRight: 1810 },
      { type: "mine", x: 1810, y: 930, patrolTop: 610 },
      { type: "rammer", x: 1880, y: 720, direction: -1, patrolLeft: 1650, patrolRight: 2110, speed: 2.35 },
      { type: "drone", x: 2130, y: 650, direction: -1, patrolLeft: 1900, patrolRight: 2320 },
    ],
  },
  {
    name: "MIDNIGHT TRENCH",
    type: STAGE_TYPE.SEA,
    start: { x: 220, y: 180 },
    visibilityBonus: 0.1,
    fireRate: 0.94,
    supplyRespawn: { min: 960, max: 1320 },
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
      { type: "rammer", x: 1730, y: 1240, direction: 1, patrolLeft: 1480, patrolRight: 2020, speed: 2.45 },
      { type: "torpedo", x: 2020, y: 930, direction: 1, patrolLeft: 1740, patrolRight: 2290 },
      { type: "drone", x: 2210, y: 560, direction: -1, patrolLeft: 1960, patrolRight: 2320 },
    ],
  },
  {
    name: "GHOST CURRENT",
    type: STAGE_TYPE.SEA,
    start: { x: 210, y: 200 },
    visibilityBonus: 0.0,
    fireRate: 0.82,
    supplyRespawn: { min: 1080, max: 1440 },
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
      { type: "rammer", x: 1660, y: 1320, direction: -1, patrolLeft: 1360, patrolRight: 1900 },
      { type: "drone", x: 1810, y: 720, direction: 1, patrolLeft: 1580, patrolRight: 2050 },
      { type: "torpedo", x: 2110, y: 940, direction: -1, patrolLeft: 1840, patrolRight: 2320 },
      { type: "rammer", x: 2200, y: 1180, direction: -1, patrolLeft: 1920, patrolRight: 2320 },
      { type: "drone", x: 2260, y: 620, direction: -1, patrolLeft: 2040, patrolRight: 2330 },
    ],
  },
  {
    name: "BLACK SIGNAL ZONE",
    type: STAGE_TYPE.SEA,
    start: { x: 180, y: 220 },
    visibilityBonus: -0.05,
    fireRate: 0.76,
    supplyRespawn: { min: 1140, max: 1500 },
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
      { type: "rammer", x: 1550, y: 1370, direction: 1, patrolLeft: 1270, patrolRight: 1810 },
      { type: "drone", x: 1720, y: 700, direction: 1, patrolLeft: 1510, patrolRight: 1940 },
      { type: "mine", x: 1910, y: 1120, patrolTop: 810 },
      { type: "torpedo", x: 2070, y: 890, direction: -1, patrolLeft: 1840, patrolRight: 2310 },
      { type: "rammer", x: 2160, y: 1450, direction: -1, patrolLeft: 1880, patrolRight: 2320 },
      { type: "drone", x: 2220, y: 980, direction: -1, patrolLeft: 1980, patrolRight: 2330 },
    ],
  },
  {
    name: "ABYSS CORE",
    type: STAGE_TYPE.SEA_BOSS,
    start: { x: 250, y: 210 },
    visibilityBonus: -0.04,
    fireRate: 0.94,
    supplyRespawn: { min: 1500, max: 2040 },
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
      { type: "rammer", x: 900, y: 880, direction: 1, patrolLeft: 720, patrolRight: 1140, speed: 2.35 },
      { type: "abyssBoss", x: 1540, y: 760, direction: -1, patrolLeft: 980, patrolRight: 2050 },
    ],
  },
  {
    name: "SURFACE ALERT",
    type: STAGE_TYPE.AIR,
    start: { x: 180, y: 444 },
    visibilityBonus: 0.34,
    fireRate: 1.0,
    supplyRespawn: { min: 840, max: 1200 },
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
    fireRate: 0.9,
    supplyRespawn: { min: 1620, max: 2220 },
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
  {
    name: "ORBITAL SIGNAL MODE",
    type: STAGE_TYPE.SPACE,
    start: { x: 420, y: 700 },
    visibilityBonus: 0,
    fireRate: 1,
    supplyRespawn: { min: 1500, max: 2160 },
    supplies: [{ x: 1180, y: 620 }],
    markers: [
      { x: 420, y: 260, label: "ORBIT" },
      { x: 980, y: 940, label: "SIGNAL ARC" },
      { x: 1680, y: 420, label: "LOW STAR" },
      { x: 2180, y: 1040, label: "DEEP SPACE" },
    ],
    enemies: [],
  },
];

const SPACE_STAGE_INDEX = STAGES.length - 1;

const bombs = [];
const enemyBullets = [];
const explosions = [];
const enemies = [];
const sonarPulses = [];
const supplies = [];
const oneUps = [];
const muzzleFlashes = [];
const particles = [];
const popups = [];

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
    playSweep(196, 98, 0.14, "square", 0.045, 0);
  }

  if (name === "beam") {
    playTone(988, 0.035, "square", 0.038, 0);
    playTone(1318, 0.045, "square", 0.03, 0.035);
  }

  if (name === "empty") {
    playTone(110, 0.05, "square", 0.035, 0);
  }

  if (name === "alert") {
    playTone(880, 0.045, "square", 0.035, 0);
    playTone(440, 0.055, "square", 0.032, 0.07);
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

  if (name === "oneup") {
    playTone(523, 0.06, "square", 0.05, 0);
    playTone(659, 0.06, "square", 0.05, 0.06);
    playTone(784, 0.06, "square", 0.05, 0.12);
    playTone(1046, 0.12, "square", 0.045, 0.18);
  }

  if (name === "bonus") {
    playTone(784, 0.05, "square", 0.04, 0);
    playTone(988, 0.08, "square", 0.04, 0.06);
  }

  if (name === "clear") {
    playTone(392, 0.06, "square", 0.045, 0);
    playTone(523, 0.06, "square", 0.045, 0.06);
    playTone(784, 0.14, "square", 0.045, 0.12);
  }

  if (name === "warning") {
    playTone(196, 0.07, "square", 0.045, 0);
    playTone(196, 0.07, "square", 0.045, 0.14);
    playTone(98, 0.18, "square", 0.04, 0.28);
    playNoise(0.1, 0.035, 0.02);
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

  if (game.state === STATE.STAGE_SELECT) {
    handleStageSelectInput(event.code);
    return;
  }

  if (game.state === STATE.TITLE) {
    if (event.code === "Space" || event.code === "Enter") {
      startNewGame();
    }
    if (event.code === "KeyO") {
      if (game.unlocks.orbital) {
        startDirectSpaceMode();
      } else {
        setStatus("ORBITAL SIGNAL LOCKED", 80);
      }
    }
    if (event.code === "KeyS") {
      if (game.unlocks.stageSelect) {
        openStageSelect();
      } else {
        setStatus("STAGE SELECT LOCKED", 80);
      }
    }
    return;
  }

  if (game.state === STATE.COMPLETE && isContinueKey(event.code)) {
    startSpaceMode();
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

  if (game.state === STATE.GAME_OVER && isContinueKey(event.code)) {
    returnToTitle();
    return;
  }

  if (game.state === STATE.STAGE_CLEAR && isContinueKey(event.code)) {
    advanceStage();
    return;
  }

  if (game.state !== STATE.PLAYING) {
    return;
  }

  if (isSpaceStage() && game.spaceWavePending && isContinueKey(event.code)) {
    advanceSpaceWave();
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

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerEnd);
canvas.addEventListener("pointercancel", handlePointerEnd);
canvas.addEventListener("lostpointercapture", handlePointerEnd);

// 一部のスマホブラウザで pointerdown が拾えない場合の保険です。
// ゲーム中の操作は pointer 系に任せ、click はタイトルなどの決定だけに使います。
canvas.addEventListener("click", (event) => {
  if (game.state !== STATE.PLAYING) {
    event.preventDefault();
    handleTouchConfirm();
  }
});

function handlePointerDown(event) {
  event.preventDefault();
  ensureAudio();

  if (canvas.setPointerCapture) {
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      // 古いブラウザで失敗しても、タッチ操作自体は続けられます。
    }
  }

  if (game.state !== STATE.PLAYING) {
    handleTouchConfirm();
    return;
  }

  const point = getPointerWorldPoint(event);
  const isLeftSide = point.screenX < SCREEN_WIDTH / 2;

  if (isLeftSide && touchInput.movePointerId === null) {
    touchInput.movePointerId = event.pointerId;
    touchInput.moveActive = true;
    startRelativeTouchDrag(point);
    return;
  }

  if (!isLeftSide && touchInput.shootPointerId === null) {
    touchInput.shootPointerId = event.pointerId;
    touchInput.shootActive = true;
    dropBomb();
  }
}

function handlePointerMove(event) {
  if (event.pointerId !== touchInput.movePointerId) {
    return;
  }

  event.preventDefault();
  updateRelativeTouchDrag(getPointerWorldPoint(event));
}

function handlePointerEnd(event) {
  if (event.pointerId === touchInput.movePointerId) {
    touchInput.movePointerId = null;
    touchInput.moveActive = false;
  }

  if (event.pointerId === touchInput.shootPointerId) {
    touchInput.shootPointerId = null;
    touchInput.shootActive = false;
  }
}

function handleTouchConfirm() {
  ensureAudio();

  if (game.state === STATE.TITLE) {
    startNewGame();
    return;
  }

  if (game.state === STATE.STAGE_SELECT) {
    startFromStageSelect(game.stageSelectIndex);
    return;
  }

  if (game.state === STATE.COMPLETE) {
    startSpaceMode();
    return;
  }

  if (game.state === STATE.GAME_OVER) {
    returnToTitle();
    return;
  }

  if (game.state === STATE.STAGE_CLEAR) {
    advanceStage();
    return;
  }

  if (isSpaceStage() && game.spaceWavePending) {
    advanceSpaceWave();
  }
}

function getPointerWorldPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const screenX = clamp(((event.clientX - rect.left) / rect.width) * SCREEN_WIDTH, 0, SCREEN_WIDTH);
  const screenY = clamp(((event.clientY - rect.top) / rect.height) * SCREEN_HEIGHT, 0, SCREEN_HEIGHT);

  return {
    screenX,
    screenY,
    worldX: cameraX + screenX,
    worldY: cameraY + screenY,
  };
}

function startRelativeTouchDrag(point) {
  touchInput.dragStartScreenX = point.screenX;
  touchInput.dragStartScreenY = point.screenY;
  touchInput.dragStartPlayerX = player.x;
  touchInput.dragStartPlayerY = player.y;
  touchInput.dragLastScreenX = point.screenX;
  touchInput.dragLastScreenY = point.screenY;
}

function updateRelativeTouchDrag(point) {
  const dx = (point.screenX - touchInput.dragStartScreenX) * CONFIG.input.touchMoveScale;
  const dy = (point.screenY - touchInput.dragStartScreenY) * CONFIG.input.touchVerticalMoveScale;

  // 指の絶対位置ではなく、ドラッグ開始地点からの移動量だけを自機に反映します。
  // 指が自機の上に乗らないので、スマホ画面でも自機を見失いにくくなります。
  player.x = touchInput.dragStartPlayerX + dx;
  player.y = touchInput.dragStartPlayerY + dy;
  touchInput.dragLastScreenX = point.screenX;
  touchInput.dragLastScreenY = point.screenY;
  clampPlayerToStage();

  if (isAirStage() && Math.abs(dy) > 18 && game.statusTimer <= 0) {
    setStatus("SURFACE MODE", 36);
    showFireNotice("ALT LOCK");
  }
}

function clearTouchInput() {
  touchInput.movePointerId = null;
  touchInput.shootPointerId = null;
  touchInput.moveActive = false;
  touchInput.shootActive = false;
  touchInput.dragStartScreenX = 0;
  touchInput.dragStartScreenY = 0;
  touchInput.dragStartPlayerX = 0;
  touchInput.dragStartPlayerY = 0;
  touchInput.dragLastScreenX = 0;
  touchInput.dragLastScreenY = 0;
}

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
    code === "KeyO" ||
    code === "KeyP" ||
    code === "KeyR" ||
    code === "KeyZ" ||
    code === "Escape" ||
    code === "Backspace" ||
    code === "ShiftLeft" ||
    code === "ShiftRight" ||
    code === "Space" ||
    code === "Enter"
  );
}

function isSonarKey(code) {
  return code === "KeyE" || code === "ShiftLeft" || code === "ShiftRight";
}

function isContinueKey(code) {
  return code === "Space" || code === "Enter" || code === "KeyZ";
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

function openStageSelect() {
  game.stageSelectIndex = 0;
  game.state = STATE.STAGE_SELECT;
  setStatus("", 0);
}

function handleStageSelectInput(code) {
  const maxIndex = SPACE_STAGE_INDEX; // 0〜7が本編、8がORBITAL SIGNAL MODEです。SECRETは未実装なので選択対象外。

  if (code === "Escape" || code === "Backspace") {
    returnToTitle();
    return;
  }

  if (code === "ArrowUp" || code === "KeyW") {
    game.stageSelectIndex = (game.stageSelectIndex + maxIndex) % (maxIndex + 1);
    playSound("empty");
    return;
  }

  if (code === "ArrowDown" || code === "KeyS") {
    game.stageSelectIndex = (game.stageSelectIndex + 1) % (maxIndex + 1);
    playSound("empty");
    return;
  }

  if (isContinueKey(code)) {
    startFromStageSelect(game.stageSelectIndex);
  }
}

function startFromStageSelect(index) {
  resetRunResources();

  if (index >= SPACE_STAGE_INDEX) {
    startSpaceMode();
    return;
  }

  game.wave = 0;
  game.reachedWave = 0;
  loadStage(index, true);
  game.state = STATE.PLAYING;
  playSound("start");
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

  if (game.state === STATE.COMPLETE) {
    updateOrbitalUnlock(frameScale);
    return;
  }

  updateNonPlaying(frameScale);
}

function updatePlaying(frameScale) {
  updateTouchInput(frameScale);
  updatePlayer(frameScale);
  updateCamera(frameScale);
  updateBombs(frameScale);
  updateEnemies(frameScale);
  updateEnemyBullets(frameScale);
  updateSupplies(frameScale);
  updateOneUps(frameScale);
  updateSonar(frameScale);
  updateExplosions(frameScale);
  updateParticles(frameScale);
  updatePopups(frameScale);
  updateMuzzleFlashes(frameScale);
  updateTimers(frameScale);
  updateSpaceWaveTransition(frameScale);
  checkCollisions();
}

function updateTouchInput(frameScale) {
  if (touchInput.shootActive) {
    dropBomb();
  }
}

function updateSpaceWaveTransition(frameScale) {
  if (!isSpaceStage() || !game.spaceWavePending) {
    return;
  }

  game.spaceWaveTimer -= frameScale;

  if (game.spaceWaveTimer <= 0) {
    advanceSpaceWave();
  }
}

function updateStageClear(frameScale) {
  updateCamera(frameScale);
  updateSonar(frameScale);
  updateExplosions(frameScale);
  updateParticles(frameScale);
  updatePopups(frameScale);
  updateMuzzleFlashes(frameScale);
  updateTimers(frameScale);

  game.clearTimer -= frameScale;

  if (game.clearTimer <= 0) {
    advanceStage();
  }
}

function updateOrbitalUnlock(frameScale) {
  updateCamera(frameScale);
  updateSonar(frameScale);
  updateExplosions(frameScale);
  updateParticles(frameScale);
  updatePopups(frameScale);
  updateMuzzleFlashes(frameScale);
  updateTimers(frameScale);

  game.clearTimer -= frameScale;

  if (game.clearTimer <= 0) {
    startSpaceMode();
  }
}

function updateNonPlaying(frameScale) {
  updateSonar(frameScale);
  updateExplosions(frameScale);
  updateParticles(frameScale);
  updatePopups(frameScale);
  updateMuzzleFlashes(frameScale);
  updateTimers(frameScale);
}

function updateTimers(frameScale) {
  game.bombCooldown = Math.max(0, game.bombCooldown - frameScale);
  game.sonarCooldown = Math.max(0, game.sonarCooldown - frameScale);
  game.sonarFlashTimer = Math.max(0, game.sonarFlashTimer - frameScale);
  game.bossWarningTimer = Math.max(0, game.bossWarningTimer - frameScale);
  game.screenShakeTimer = Math.max(0, game.screenShakeTimer - frameScale);
  game.statusTimer = Math.max(0, game.statusTimer - frameScale);
  game.fireNoticeTimer = Math.max(0, game.fireNoticeTimer - frameScale);
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

  if (isSpaceStage()) {
    // space タイプだけは全方向自由移動です。海面や深度の制限はありません。
    player.y = clamp(player.y, halfHeight + CONFIG.space.playerMargin, getWorldHeight() - halfHeight - CONFIG.space.playerMargin);
  } else if (isAirStage()) {
    // 空中戦では浮上潜水艦として海面付近に留まり、少しだけ上下できます。
    const surfaceY = getAirSeaSurfaceY();
    const beforeClampY = player.y;
    player.y = clamp(player.y, surfaceY + CONFIG.air.playerMinOffset, surfaceY + CONFIG.air.playerMaxOffset);
    const wantsAirVertical = keys.ArrowUp || keys.KeyW || keys.ArrowDown || keys.KeyS;

    if ((wantsAirVertical || Math.abs(beforeClampY - player.y) > 10) && game.statusTimer <= 0) {
      setStatus("SURFACE MODE", 36);
    }
  } else if (isSeaStage()) {
    // 海中戦では潜航艇として扱います。海面境界より上へは絶対に出られません。
    const surfaceLimit = getSeaSurfaceY() + CONFIG.sea.playerSafeMargin;
    const wantsSurface = keys.ArrowUp || keys.KeyW;
    player.y = clamp(player.y, surfaceLimit, getWorldHeight() - 220);

    if (player.y <= surfaceLimit + 8 && wantsSurface && game.statusTimer <= 0) {
      setStatus("SURFACE LOCKED", 32);
    }
  } else {
    // 将来の space タイプだけが全方向自由移動になる想定です。
    // sea / seaBoss / air / airBoss では自由飛行にしません。
    player.y = clamp(player.y, halfHeight + 56, getWorldHeight() - 220);
  }
}

function updateCamera(frameScale) {
  const targetX = player.x - SCREEN_WIDTH * 0.44;
  const targetY = isAirStage() ? 0 : player.y - SCREEN_HEIGHT * 0.30;
  const followRate = Math.min(1, 0.14 * frameScale);

  cameraX += (targetX - cameraX) * followRate;
  cameraY += (targetY - cameraY) * followRate;

  cameraX = clamp(cameraX, 0, WORLD_WIDTH - SCREEN_WIDTH);
  cameraY = clamp(cameraY, 0, getWorldHeight() - SCREEN_HEIGHT);
}

function dropBomb() {
  if (game.ammo <= 0) {
    showFireNotice("RELOAD");
    setStatus(isSpaceStage() ? "NO ENERGY" : isAirStage() ? "NO AA SHELLS" : "NO DEPTH CHARGES", 90);
    playSound("empty");
    return;
  }

  if (bombs.length >= CONFIG.gameplay.bombLimit) {
    showFireNotice("OVERHEAT");
    setStatus("OVERHEAT", 90);
    return;
  }

  if (game.bombCooldown > 0) {
    showFireNotice("WAIT");
    setStatus("WAIT", 70);
    return;
  }

  let fireHint = "";

  if (isSpaceStage()) {
    // 宇宙モードでは上方向へ短いパルスビームを撃ちます。
    bombs.push({
      kind: "beam",
      x: player.x,
      y: player.y - player.height / 2 - 12,
      width: CONFIG.space.beamWidth,
      height: CONFIG.space.beamHeight,
      speed: CONFIG.space.beamSpeed,
    });
    addMuzzleFlash(player.x, player.y - player.height / 2 - 18);
    fireHint = "BEAM UP";
  } else if (isAirStage()) {
    // 空中戦のSpaceは上方向へ飛ぶ対空弾です。
    bombs.push({
      kind: "aa",
      x: player.x,
      y: player.y - player.height / 2 - 12,
      width: 7,
      height: 20,
      speed: 6.65,
    });
    addMuzzleFlash(player.x, player.y - player.height / 2 - 18);
    fireHint = "AA SHELL UP";
  } else {
    // 海中戦のSpaceは従来通り、ワールド座標で下へ沈む爆雷です。
    bombs.push({
      kind: "depth",
      x: player.x,
      y: player.y + player.height / 2 + 6,
      width: 8,
      height: 14,
      baseSpeed: 3.35,
    });
    addMuzzleFlash(player.x, player.y + player.height / 2 + 14);
    fireHint = "DEPTH CHARGE DOWN";
  }

  game.ammo -= 1;
  game.bombCooldown = isSpaceStage() ? 6 : isAirStage() ? 8 : 10;
  if (game.statusTimer <= 0 && fireHint) {
    setStatus(fireHint, 24);
  }
  playSound(isSpaceStage() ? "beam" : "bomb");
}

function showFireNotice(text) {
  // 子どもテストで「押しても何が起きたか分からない」と分かったため、
  // 発射できない理由を機体の真上にも短く出します。
  game.fireNoticeText = text;
  game.fireNoticeTimer = 58;
}

function drawSupplyDirectionHint() {
  if (game.state !== STATE.PLAYING) {
    return;
  }

  const supply = supplies.find((item) => item.active);
  if (!supply) {
    return;
  }

  const screenX = supply.x - cameraX;
  const screenY = supply.y - cameraY;

  if (screenX >= 28 && screenX <= SCREEN_WIDTH - 28 && screenY >= 82 && screenY <= SCREEN_HEIGHT - 36) {
    return;
  }

  const dx = supply.x - player.x;
  const dy = supply.y - player.y;
  const horizontal = Math.abs(dx) > Math.abs(dy) * 1.12;
  const label = horizontal
    ? (dx >= 0 ? "SUPPLY >" : "< SUPPLY")
    : (dy >= 0 ? "SUPPLY v" : "^ SUPPLY");
  const edgeX = clamp(screenX, 34, SCREEN_WIDTH - 116);
  const edgeY = clamp(screenY, 92, SCREEN_HEIGHT - 42);

  ctx.save();
  ctx.fillStyle = "rgba(8, 24, 32, 0.86)";
  ctx.fillRect(edgeX - 8, edgeY - 18, 106, 24);
  ctx.strokeStyle = gb("light");
  ctx.lineWidth = 2;
  ctx.strokeRect(edgeX - 8, edgeY - 18, 106, 24);
  ctx.fillStyle = gb("light");
  ctx.font = "14px 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.fillText(label, edgeX, edgeY);
  ctx.restore();
}

function updateBombs(frameScale) {
  for (const bomb of bombs) {
    if (bomb.kind === "aa" || bomb.kind === "beam") {
      bomb.y -= bomb.speed * frameScale;
    } else {
      const depthDrag = 1 - getDepthFactor(bomb.y) * 0.28;
      bomb.y += bomb.baseSpeed * depthDrag * frameScale;
    }
  }

  removeWhere(bombs, (bomb) => bomb.y > getWorldHeight() + 30 || bomb.y < -40);
}

function updateEnemies(frameScale) {
  const actionFrameScale = game.bossWarningTimer > 0 ? frameScale * 0.28 : frameScale;

  for (const enemy of enemies) {
    if (!enemy.alive) {
      continue;
    }

    enemy.detectedTimer = Math.max(0, enemy.detectedTimer - frameScale);
    enemy.pingTimer = Math.max(0, enemy.pingTimer - frameScale);

    if (enemy.entryTimer > 0) {
      updateBossEntry(enemy, frameScale);
      continue;
    }

    if (enemy.type === "drone") updateDrone(enemy, actionFrameScale);
    if (enemy.type === "torpedo") updateTorpedo(enemy, actionFrameScale);
    if (enemy.type === "mine") updateMine(enemy, actionFrameScale);
    if (enemy.type === "rammer") updateRammer(enemy, actionFrameScale);
    if (enemy.type === "abyssBoss") updateAbyssBoss(enemy, actionFrameScale);
    if (enemy.type === "helicopter" || enemy.type === "plane" || enemy.type === "ufo") updateAirEnemy(enemy, actionFrameScale);
    if (enemy.type === "skyBoss") updateSkyBoss(enemy, actionFrameScale);
    if (enemy.type === "asteroid") updateAsteroid(enemy, actionFrameScale);
    if (enemy.type === "orbitalDrone") updateOrbitalDrone(enemy, actionFrameScale);
    if (enemy.type === "signalWisp") updateSignalWisp(enemy, actionFrameScale);
    if (enemy.type === "hunterUFO") updateHunterUFO(enemy, actionFrameScale);
    if (enemy.type === "signalCore") updateSignalCore(enemy, actionFrameScale);
  }
}

function updateBossEntry(enemy, frameScale) {
  enemy.entryTimer = Math.max(0, enemy.entryTimer - frameScale);

  if (enemy.type === "abyssBoss") {
    // 深海ボスは暗闇からゆっくり浮かび上がるように、目標深度へ近づけます。
    enemy.y += (enemy.targetY - enemy.y) * 0.026 * frameScale;
    enemy.detectedTimer = Math.max(enemy.detectedTimer, 40);
    enemy.pingTimer = Math.max(enemy.pingTimer, 24);
  }

  if (enemy.type === "skyBoss") {
    // 空中ボスは画面上から降下して登場します。
    enemy.y += (enemy.targetY - enemy.y) * 0.03 * frameScale;
  }

  if (enemy.entryTimer <= 0) {
    enemy.y = enemy.targetY;
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

function updateRammer(enemy, frameScale) {
  enemy.phase += 0.06 * frameScale;
  enemy.rammerState = enemy.rammerState || "patrol";
  enemy.rammerCooldown = Math.max(0, enemy.rammerCooldown - frameScale);

  if (enemy.rammerState === "warning") {
    enemy.warnTimer -= frameScale;
    enemy.pingTimer = Math.max(enemy.pingTimer, 32);
    enemy.detectedTimer = Math.max(enemy.detectedTimer, 72);

    if (enemy.warnTimer <= 0) {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      enemy.chargeVx = (dx / length) * 6.1;
      enemy.chargeVy = (dy / length) * 6.1;
      enemy.chargeTimer = 54;
      enemy.rammerState = "charge";
    }

    return;
  }

  if (enemy.rammerState === "charge") {
    enemy.x += enemy.chargeVx * frameScale;
    enemy.y += enemy.chargeVy * frameScale;
    enemy.chargeTimer -= frameScale;

    if (enemy.chargeTimer <= 0 || enemy.x < 40 || enemy.x > WORLD_WIDTH - 40 || enemy.y < getSeaSurfaceY() + 80 || enemy.y > getWorldHeight() - 120) {
      enemy.rammerState = "patrol";
      enemy.rammerCooldown = 150;
      enemy.direction *= -1;
      addExplosion(enemy.x, enemy.y, 8, 1.2, "mid");
    }

    return;
  }

  enemy.x += enemy.speed * enemy.direction * frameScale;
  enemy.y += Math.sin(enemy.phase) * 0.55 * frameScale;

  if (enemy.x < enemy.patrolLeft) {
    enemy.x = enemy.patrolLeft;
    enemy.direction = 1;
  }

  if (enemy.x > enemy.patrolRight) {
    enemy.x = enemy.patrolRight;
    enemy.direction = -1;
  }

  enemy.y = clamp(enemy.y, getSeaSurfaceY() + 90, getWorldHeight() - 190);

  if (enemy.rammerCooldown <= 0 && distance(player.x, player.y, enemy.x, enemy.y) <= 160) {
    enemy.rammerState = "warning";
    enemy.warnTimer = 58;
    enemy.pingTimer = CONFIG.sonar.pingTime;
    enemy.detectedTimer = Math.max(enemy.detectedTimer, 90);
    setStatus("RAMMER ALERT", 60);
    playSound("alert");
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
  enemy.hatchTimer = (enemy.hatchTimer + frameScale) % 280;
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

    enemy.fireTimer = enemy.fireInterval * (enemy.health <= enemy.maxHealth / 2 ? 0.78 : 1);
  }

  if (enemy.summonTimer <= 0) {
    summonAirEscort(enemy);
    enemy.summonTimer = 540;
  }
}

function updateAsteroid(enemy, frameScale) {
  enemy.phase += 0.018 * frameScale;
  enemy.x += enemy.speed * enemy.direction * frameScale;
  enemy.y += Math.sin(enemy.phase) * 0.22 * frameScale;
  wrapSpaceEnemy(enemy);
}

function updateOrbitalDrone(enemy, frameScale) {
  enemy.phase += 0.035 * frameScale;
  enemy.x += enemy.speed * enemy.direction * frameScale;
  enemy.y += Math.sin(enemy.phase) * 0.55 * frameScale;
  wrapSpaceEnemy(enemy);
  updateSpaceEnemyFire(enemy, frameScale);
}

function updateSignalWisp(enemy, frameScale) {
  enemy.phase += 0.055 * frameScale;
  enemy.x += Math.sin(enemy.phase * 0.75) * enemy.speed * 0.75 * frameScale;
  enemy.y += Math.cos(enemy.phase) * enemy.speed * 0.62 * frameScale;
  enemy.x += enemy.direction * 0.38 * frameScale;
  wrapSpaceEnemy(enemy);
}

function updateHunterUFO(enemy, frameScale) {
  enemy.phase += 0.035 * frameScale;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const length = Math.max(1, Math.hypot(dx, dy));

  // ハンターはゆるく追尾します。速すぎると接触事故が増えるため、加速は控えめです。
  enemy.x += (dx / length) * enemy.speed * 0.72 * frameScale;
  enemy.y += (dy / length) * enemy.speed * 0.54 * frameScale;
  enemy.x += Math.sin(enemy.phase) * 0.34 * frameScale;
  clampSpaceEnemy(enemy);
  updateSpaceEnemyFire(enemy, frameScale);
}

function updateSignalCore(enemy, frameScale) {
  enemy.phase += 0.024 * frameScale;
  enemy.x += enemy.speed * enemy.direction * frameScale;
  enemy.y += Math.sin(enemy.phase) * 0.34 * frameScale;

  if (enemy.x < enemy.patrolLeft) {
    enemy.x = enemy.patrolLeft;
    enemy.direction = 1;
  }

  if (enemy.x > enemy.patrolRight) {
    enemy.x = enemy.patrolRight;
    enemy.direction = -1;
  }

  enemy.hatchTimer = (enemy.hatchTimer + frameScale) % 210;
  enemy.fireTimer -= frameScale;

  if (enemy.fireTimer <= 0) {
    fireSignalCorePattern(enemy);
    enemy.fireTimer = enemy.health <= enemy.maxHealth / 2 ? 82 : enemy.fireInterval;
  }

  enemy.summonTimer -= frameScale;
  if (enemy.summonTimer <= 0) {
    summonSignalCoreDrone(enemy);
    enemy.summonTimer = 520;
  }

  clampSpaceEnemy(enemy);
}

function isSignalCoreWeakPointOpen(enemy) {
  return enemy.hatchTimer < 90 || enemy.detectedTimer > 0 || enemy.pingTimer > 0;
}

function getSignalCoreWeakPointBox(enemy) {
  return {
    left: enemy.x - 26,
    right: enemy.x + 26,
    top: enemy.y - 18,
    bottom: enemy.y + 18,
  };
}

function fireSignalCorePattern(enemy) {
  const bulletCount = enemy.health <= enemy.maxHealth / 2 ? 10 : 8;
  const baseAngle = enemy.phase * 0.18;

  for (let i = 0; i < bulletCount; i += 1) {
    const angle = baseAngle + (Math.PI * 2 * i) / bulletCount;
    const speed = enemy.health <= enemy.maxHealth / 2 ? 2.35 : 2.05;

    enemyBullets.push({
      x: enemy.x,
      y: enemy.y,
      width: 7,
      height: 7,
      speed,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      kind: "space",
    });
  }
}

function summonSignalCoreDrone(boss) {
  const escorts = enemies.filter((enemy) => enemy.alive && enemy.spawnedByBoss).length;
  if (escorts >= 2) {
    return;
  }

  const offset = escorts % 2 === 0 ? -120 : 120;
  enemies.push(createEnemy({
    type: "orbitalDrone",
    x: clamp(boss.x + offset, 180, WORLD_WIDTH - 180),
    y: clamp(boss.y + 120, CONFIG.space.enemyMinY, CONFIG.space.enemyMaxY),
    direction: offset < 0 ? -1 : 1,
    spawnedByBoss: true,
    initiallyDetected: boss.detectedTimer > 0,
  }, enemies.length));
}

function updateSpaceEnemyFire(enemy, frameScale) {
  enemy.fireTimer -= frameScale;

  if (enemy.fireTimer <= 0) {
    if (distance(player.x, player.y, enemy.x, enemy.y) < 620) {
      fireEnemyBullet(enemy);
    }

    const waveSpread = isSpaceStage() ? randomRange(14, 34) : 0;
    enemy.fireTimer = enemy.fireInterval + waveSpread;
  }
}

function wrapSpaceEnemy(enemy) {
  if (enemy.x < 60) {
    enemy.x = 60;
    enemy.direction = 1;
  }

  if (enemy.x > WORLD_WIDTH - 60) {
    enemy.x = WORLD_WIDTH - 60;
    enemy.direction = -1;
  }

  clampSpaceEnemy(enemy);
}

function clampSpaceEnemy(enemy) {
  enemy.y = clamp(enemy.y, CONFIG.space.enemyMinY, CONFIG.space.enemyMaxY);
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
  const enemyDomain = getEnemyDomain(enemy);
  const airAttack = enemyDomain === "air";
  const bossShot = enemy.type === "skyBoss";

  if (enemyDomain === "space") {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const waveBonus = Math.min(0.34, Math.max(0, game.wave - 1) * 0.025);
    const speed = (enemy.type === "hunterUFO" ? 2.52 : 2.28) + waveBonus;

    enemyBullets.push({
      x: enemy.x,
      y: enemy.y,
      width: 7,
      height: 7,
      speed,
      vx: (dx / length) * speed,
      vy: (dy / length) * speed,
      kind: "space",
    });
    return;
  }

  enemyBullets.push({
    x: enemy.x,
    y: airAttack ? enemy.y + enemy.height / 2 + 8 : enemy.y - enemy.height / 2 - 8,
    width: bossShot ? 8 : 6,
    height: bossShot ? 18 : 12,
    speed: bossShot ? 3.05 : 2.7,
    vy: airAttack ? (bossShot ? 3.05 : 2.7) : -2.7,
    kind: bossShot ? "laser" : "bullet",
  });
}

function updateEnemyBullets(frameScale) {
  for (const bullet of enemyBullets) {
    bullet.x += (bullet.vx || 0) * frameScale;
    bullet.y += bullet.vy * frameScale;
  }

  removeWhere(enemyBullets, (bullet) => (
    bullet.x < -40 ||
    bullet.x > WORLD_WIDTH + 40 ||
    bullet.y < -40 ||
    bullet.y > getWorldHeight() + 40
  ));
}

function updateSupplies(frameScale) {
  for (const supply of supplies) {
    supply.phase += 0.045 * frameScale;
    supply.flashTimer = Math.max(0, supply.flashTimer - frameScale);

    if (!supply.active) {
      // 弾がほぼ空の時は、既に待機中の補給も少し早く戻します。
      const respawnBoost = game.ammo <= 2 ? 1.35 : 1;
      supply.respawnTimer -= frameScale * respawnBoost;

      if (supply.respawnTimer <= 0) {
        placeSupplyRandomly(supply);
        const supplyHint = getSupplySearchHint(supply);
        setStatus(supplyHint, 110);
        addPopup(supplyHint, supply.x, supply.y - 24);
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
  if (game.lives < CONFIG.player.maxLives && Math.random() < 0.06) {
    game.lives += 1;
  }

  supply.active = false;
  supply.respawnTimer = randomSupplyRespawnTime();
  supply.flashTimer = 0;
  setStatus(isSpaceStage() ? "ENERGY RESTORED" : isAirStage() ? "AA SHELL RESTORED" : "DEPTH CHARGE RESTORED", 115);
  addPopup("SUPPLIED", supply.x, supply.y - 24);
  playSound("supply");
}

function updateOneUps(frameScale) {
  for (let i = oneUps.length - 1; i >= 0; i -= 1) {
    const oneUp = oneUps[i];
    oneUp.timer -= frameScale;
    oneUp.phase += 0.08 * frameScale;

    if (oneUp.kind === "air") {
      // 空中戦の救援カプセルは、海面へ向かってゆっくり落ちてきます。
      oneUp.y = Math.min(oneUp.y + oneUp.vy * frameScale, getAirSupplyY() - 12);
    } else if (oneUp.kind === "space") {
      // 宇宙の1UPカプセルは微小重力で漂います。
      oneUp.x += Math.sin(oneUp.phase * 0.7) * 0.12 * frameScale;
      oneUp.y += Math.cos(oneUp.phase) * 0.16 * frameScale;
      oneUp.y = clamp(oneUp.y, 80, getWorldHeight() - 80);
    } else {
      // 海中の救命カプセルは少しだけ浮遊します。
      oneUp.y += Math.sin(oneUp.phase) * 0.18 * frameScale;
    }

    if (oneUp.timer <= 0) {
      oneUps.splice(i, 1);
      continue;
    }

    if (distance(player.x, player.y, oneUp.x, oneUp.y) <= CONFIG.drops.pickupRadius) {
      collectOneUp(oneUp);
      oneUps.splice(i, 1);
    }
  }
}

function maybeDropOneUp(enemy) {
  if (!shouldDropOneUp(enemy)) {
    return;
  }

  const domain = getEnemyDomain(enemy);
  spawnOneUp(enemy.x, enemy.y, domain === "air" ? "air" : domain === "space" ? "space" : "sea");
}

function shouldDropOneUp(enemy) {
  const type = ENEMY_TYPES[enemy.type];

  if (type.boss) {
    return Math.random() < CONFIG.drops.oneUpBossChance;
  }

  const strongEnemy = enemy.maxHealth >= 2 || enemy.type === "ufo" || enemy.type === "torpedo" || enemy.type === "rammer";
  const chance = strongEnemy ? CONFIG.drops.oneUpStrongChance : CONFIG.drops.oneUpBaseChance;
  return Math.random() < chance;
}

function spawnOneUp(x, y, kind) {
  oneUps.push({
    x: clamp(x, 60, WORLD_WIDTH - 60),
    y: kind === "air"
      ? Math.max(90, y)
      : kind === "space"
        ? clamp(y, 90, getWorldHeight() - 90)
        : clamp(y, getSeaSurfaceY() + 80, getWorldHeight() - 120),
    kind,
    timer: CONFIG.drops.oneUpLifetime,
    phase: Math.random() * Math.PI * 2,
    vy: kind === "air" ? 0.55 : kind === "space" ? 0.12 : 0,
    width: 32,
    height: 22,
  });
}

function collectOneUp(oneUp) {
  addBurstParticles(oneUp.x, oneUp.y, 12, "light");

  if (game.lives < CONFIG.player.maxLives) {
    game.lives += 1;
    setStatus("1UP! EXTRA LIFE", 120);
    addPopup("1UP!", oneUp.x, oneUp.y - 24);
    playSound("oneup");
    return;
  }

  game.score += CONFIG.drops.oneUpScoreBonus;
  setStatus(`SCORE BONUS +${CONFIG.drops.oneUpScoreBonus}`, 120);
  addPopup("+1000 SCORE", oneUp.x, oneUp.y - 24);
  playSound("bonus");
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

function updateParticles(frameScale) {
  for (const particle of particles) {
    particle.life -= frameScale;
    particle.x += particle.vx * frameScale;
    particle.y += particle.vy * frameScale;
    particle.vy += particle.gravity * frameScale;
  }

  removeWhere(particles, (particle) => particle.life <= 0);
}

function updatePopups(frameScale) {
  for (const popup of popups) {
    popup.life -= frameScale;
    popup.y -= 0.32 * frameScale;
  }

  removeWhere(popups, (popup) => popup.life <= 0);
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
  // SIGNAL CORE撃破演出中は残った弾や接触判定を止め、演出中の二重被弾や不正参照を避けます。
  if (game.spaceBossClearPending) {
    return;
  }

  checkBombHitsEnemies();
  checkEnemyBulletsHitPlayer();
  checkEnemyBodiesHitPlayer();
}

function checkBombHitsEnemies() {
  for (let bombIndex = bombs.length - 1; bombIndex >= 0; bombIndex -= 1) {
    const bomb = bombs[bombIndex];
    if (!bomb || !hasUsablePosition(bomb)) {
      bombs.splice(bombIndex, 1);
      continue;
    }

    const bombBox = getBox(bomb);

    for (const enemy of enemies) {
      if (!enemy || !enemy.alive || !ENEMY_TYPES[enemy.type] || !hasUsablePosition(enemy)) {
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
  if (!projectile || !enemy || !projectileBox || !ENEMY_TYPES[enemy.type]) {
    return false;
  }

  const projectileKind = projectile.kind || "depth";
  const enemyDomain = getEnemyDomain(enemy);

  if (enemy.entryTimer > 0) {
    return false;
  }

  if (projectileKind === "depth" && enemyDomain !== "sea") {
    return false;
  }

  if (projectileKind === "aa" && enemyDomain !== "air") {
    return false;
  }

  if (projectileKind === "beam" && enemyDomain !== "space") {
    return false;
  }

  if (enemy.type === "abyssBoss") {
    return isAbyssWeakPointVisible(enemy) && isColliding(projectileBox, getAbyssWeakPointBox(enemy));
  }

  if (enemy.type === "skyBoss") {
    return isSkyBossWeakPointOpen(enemy) && isColliding(projectileBox, getSkyBossWeakPointBox(enemy));
  }

  if (enemy.type === "signalCore") {
    return isSignalCoreWeakPointOpen(enemy) && isColliding(projectileBox, getSignalCoreWeakPointBox(enemy));
  }

  return isColliding(projectileBox, getBox(enemy));
}

function hitEnemy(enemy) {
  if (!enemy || !ENEMY_TYPES[enemy.type]) {
    return;
  }

  enemy.health = getFiniteNumber(enemy.health, 1) - 1;
  enemy.detectedTimer = Math.max(getFiniteNumber(enemy.detectedTimer, 0), 120);
  enemy.pingTimer = Math.max(getFiniteNumber(enemy.pingTimer, 0), 50);
  addExplosion(enemy.x, enemy.y, 7, 1.4, "light");
  addBurstParticles(enemy.x, enemy.y, ENEMY_TYPES[enemy.type].boss ? 10 : 5, "light");

  if (enemy.health <= 0) {
    destroyEnemy(enemy, true);
  }
}

function destroyEnemy(enemy, addScore) {
  if (!enemy || !ENEMY_TYPES[enemy.type]) {
    return;
  }

  enemy.alive = false;

  if (enemy.type === "skyBoss") {
    // エンディングへ進む時に、ボスが呼んだ護衛だけが残って足止めしないようにします。
    for (const other of enemies) {
      if (other.spawnedByBoss) {
        other.alive = false;
      }
    }
  }

  if (enemy.type === "signalCore") {
    // SIGNAL CORE撃破時は、召喚ドローンで解放演出が遅れすぎないよう同時に消します。
    for (const other of enemies) {
      if (other.spawnedByBoss) {
        other.alive = false;
      }
    }
    game.signalCoreDefeated = true;
    unlockOrbitalRewards();
  }

  if (addScore) {
    game.score += enemy.score;
  }

  if (addScore) {
    maybeDropOneUp(enemy);
  }

  if (ENEMY_TYPES[enemy.type].boss) {
    addExplosion(enemy.x, enemy.y, 32, 3.2, "light");
    addExplosion(enemy.x - 42, enemy.y + 10, 20, 2.6, "mid");
    addExplosion(enemy.x + 38, enemy.y - 8, 18, 2.2, "light");
    addBurstParticles(enemy.x, enemy.y, 30, "light");
    startScreenShake(36, 7);
  } else {
    addExplosion(enemy.x, enemy.y, 13, 2.2, "mid");
    addExplosion(enemy.x - 12, enemy.y + 5, 8, 1.5, "light");
    addBurstParticles(enemy.x, enemy.y, 9, "mid");
  }

  playSound("explosion");
  checkStageClear();
}

function checkEnemyBulletsHitPlayer() {
  if (player.invincibleTimer > 0 || game.spaceBossClearPending) {
    return;
  }

  const playerBox = getContactBox(player, 0.74);

  for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
    const bullet = enemyBullets[i];
    if (!bullet || !hasUsablePosition(bullet)) {
      enemyBullets.splice(i, 1);
      continue;
    }

    if (isColliding(getBox(bullet), playerBox)) {
      enemyBullets.splice(i, 1);
      damagePlayer("bullet", bullet);
      return;
    }
  }
}

function checkEnemyBodiesHitPlayer() {
  if (player.invincibleTimer > 0 || game.spaceBossClearPending) {
    return;
  }

  const playerBox = getContactBox(player, 0.74);

  for (const enemy of enemies) {
    if (!enemy || !enemy.alive || enemy.entryTimer > 0 || !ENEMY_TYPES[enemy.type] || !hasUsablePosition(enemy)) {
      continue;
    }

    const enemyBox = getEnemyContactBox(enemy);

    if (!isColliding(playerBox, enemyBox)) {
      continue;
    }

    handleEnemyBodyContact(enemy);
    return;
  }
}

function handleEnemyBodyContact(enemy) {
  if (!enemy || !ENEMY_TYPES[enemy.type]) {
    damagePlayer("contact", enemy);
    return;
  }

  if (enemy.type === "mine") {
    enemy.alive = false;
    addExplosion(enemy.x, enemy.y, 16, 2.4, "light");
    addBurstParticles(enemy.x, enemy.y, 14, "light");
    damagePlayer("mine", enemy);
    checkStageClear();
    return;
  }

  if (enemy.type === "rammer") {
    enemy.alive = false;
    addExplosion(enemy.x, enemy.y, 18, 2.8, "light");
    addBurstParticles(enemy.x, enemy.y, 16, "light");
    damagePlayer("rammer", enemy);
    checkStageClear();
    return;
  }

  const enemyConfig = ENEMY_TYPES[enemy.type];
  damagePlayer(enemyConfig.boss ? "boss contact" : "contact", enemy);

  if (!enemyConfig.boss) {
    const enemyX = getFiniteNumber(enemy.x, player.x);
    const enemyWidth = getFiniteNumber(enemy.width, 32);
    const push = enemyX < player.x ? -16 : 16;
    enemy.x = clamp(enemyX + push, enemyWidth, WORLD_WIDTH - enemyWidth);
  }
}

function damagePlayer(reason = "damage", source = null) {
  if (player.invincibleTimer > 0 || game.spaceBossClearPending) {
    return false;
  }

  const damageReason = typeof reason === "string" ? reason : "damage";
  const isBodyContact = damageReason.includes("contact") || damageReason === "mine" || damageReason === "rammer";

  game.lives = Math.max(0, getFiniteNumber(game.lives, CONFIG.player.startLives) - 1);
  startInvincibility();
  applyKnockback(source, damageReason);
  enemyBullets.length = 0;
  addExplosion(player.x, player.y, 10, 2.0, "light");
  addBurstParticles(player.x, player.y, 14, "light");
  startScreenShake(damageReason.includes("boss") ? 24 : 16, damageReason.includes("boss") ? 6 : 4);
  setStatus(isBodyContact ? "DAMAGE!" : "HIT!", 58);
  addPopup(isBodyContact ? "DAMAGE!" : "HIT!", player.x, player.y - 30);
  playSound("damage");

  if (game.lives <= 0) {
    updateBestProgress();
    game.state = STATE.GAME_OVER;
    setStatus("SIGNAL LOST", 120);
    playSound("gameover");
  }

  return true;
}

function startInvincibility() {
  player.invincibleTimer = CONFIG.player.invincibleTime;
}

function applyKnockback(source, reason) {
  const sourceHasPosition = source && hasUsablePosition(source);
  const fallbackDirection = player.x < WORLD_WIDTH / 2 ? -1 : 1;
  let dx = sourceHasPosition ? player.x - source.x : fallbackDirection;
  let dy = sourceHasPosition ? player.y - source.y : isSpaceStage() ? -0.25 : 0;

  // 完全に同じ座標で重なった場合も、必ずどちらかへ押し戻します。
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) + Math.abs(dy) < 0.01) {
    dx = player.x < WORLD_WIDTH / 2 ? -1 : 1;
    dy = isAirStage() ? 0 : -0.35;
  }

  const length = Math.max(1, Math.hypot(dx, dy));
  const damageReason = typeof reason === "string" ? reason : "damage";
  const power = damageReason.includes("boss") ? CONFIG.player.bossKnockback : CONFIG.player.contactKnockback;

  player.x += (dx / length) * power;
  player.y += (dy / length) * power;
  clampPlayerToStage();
}

function clampPlayerToStage() {
  const halfWidth = getFiniteNumber(player.width, CONFIG.player.width) / 2;
  const halfHeight = getFiniteNumber(player.height, CONFIG.player.height) / 2;
  player.x = getFiniteNumber(player.x, WORLD_WIDTH / 2);
  player.y = getFiniteNumber(player.y, Math.min(getWorldHeight() - 120, SCREEN_HEIGHT / 2));
  player.x = clamp(player.x, halfWidth + 20, WORLD_WIDTH - halfWidth - 20);

  if (isSpaceStage()) {
    const worldHeight = Math.max(SCREEN_HEIGHT, getWorldHeight());
    player.y = clamp(player.y, halfHeight + CONFIG.space.playerMargin, worldHeight - halfHeight - CONFIG.space.playerMargin);
    return;
  }

  if (isAirStage()) {
    const surfaceY = getAirSeaSurfaceY();
    player.y = clamp(player.y, surfaceY + CONFIG.air.playerMinOffset, surfaceY + CONFIG.air.playerMaxOffset);
    return;
  }

  if (isSeaStage()) {
    const surfaceLimit = getSeaSurfaceY() + CONFIG.sea.playerSafeMargin;
    player.y = clamp(player.y, surfaceLimit, getWorldHeight() - 220);
    return;
  }

  player.y = clamp(player.y, player.height / 2 + 56, getWorldHeight() - 220);
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
    if (isSpaceStage()) {
      if (game.signalCoreDefeated) {
        beginSignalCoreClear();
        return;
      }
      beginSpaceWaveClear();
      return;
    }

    if (game.stageType === STAGE_TYPE.AIR_BOSS) {
      game.unlocks.orbital = true;
      savePersistentProgress();
      game.state = STATE.COMPLETE;
      game.clearTimer = CONFIG.gameplay.orbitalUnlockDelay;
      enemyBullets.length = 0;
      setStatus("ORBITAL SIGNAL MODE UNLOCKED", 180);
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
  if (game.stageIndex >= SPACE_STAGE_INDEX - 1) {
    game.state = STATE.COMPLETE;
    game.clearTimer = CONFIG.gameplay.orbitalUnlockDelay;
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

  if (game.state === STATE.STAGE_SELECT) {
    drawStageSelectScreen();
    drawLcdOverlay();
    return;
  }

  if (game.screenShakeTimer > 0) {
    const shake = game.screenShakePower * (game.screenShakeTimer / 22);
    ctx.translate(randomRange(-shake, shake), randomRange(-shake, shake));
  }

  drawGameScreen();
  drawLcdOverlay();
}

function drawGameScreen() {
  drawBackground();
  drawSupplies();
  drawOneUps();
  drawBombs();
  drawEnemies();
  drawEnemyBullets();
  drawPlayer();
  drawMuzzleFlashes();
  drawSonarPulses();
  drawExplosions();
  drawParticles();
  drawPopups();
  drawDepthOverlay();
  drawPlayerFireNotice();
  drawSupplyDirectionHint();
  drawHud();
  drawMinimap();
  drawControlHelp();
  drawBossWarning();

  if (game.state === STATE.PAUSED) {
    drawCenteredMessage("PAUSED", "PRESS P / ESC", "");
  }

  if (game.state === STATE.GAME_OVER) {
    if (isSpaceStage()) {
      drawSpaceGameOver();
    } else {
      drawCenteredMessage("GAME OVER", `FINAL SCORE ${padScore(game.score)}`, "PRESS R TO RESTART");
    }
  }

  if (game.state === STATE.STAGE_CLEAR) {
    drawStageClearOverlay();
  }

  if (game.spaceBossClearPending) {
    drawSignalCoreClearOverlay();
  }

  if (game.state === STATE.COMPLETE) {
    drawOrbitalUnlockOverlay();
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
  ctx.font = "18px 'Courier New', monospace";
  ctx.fillText("TAP / SPACE: START STORY", SCREEN_WIDTH / 2, 304);
  ctx.fillText(`O: ORBITAL SIGNAL${game.unlocks.orbital ? "" : " [LOCKED]"}`, SCREEN_WIDTH / 2, 332);
  ctx.fillText(`S: STAGE SELECT${game.unlocks.stageSelect ? "" : " [LOCKED]"}`, SCREEN_WIDTH / 2, 360);

  ctx.font = "14px 'Courier New', monospace";
  ctx.fillText("MOBILE: LEFT DRAG MOVE / RIGHT TAP-HOLD FIRE", SCREEN_WIDTH / 2, 390);
  ctx.fillText("KEYBOARD: ARROW/WASD MOVE / SPACE FIRE / ENTER OK", SCREEN_WIDTH / 2, 414);

  if (blink && game.statusTimer > 0) {
    ctx.fillText(game.statusText, SCREEN_WIDTH / 2, 438);
  }

  ctx.font = "14px 'Courier New', monospace";
  ctx.fillText(`BEST SCORE: ${padScore(game.bestScore)}   BEST WAVE: ${game.bestWave}`, SCREEN_WIDTH / 2, 470);
  ctx.fillText(`SOUND: ${game.soundEnabled ? "ON" : "OFF"}  (M TO TOGGLE)`, SCREEN_WIDTH / 2, 496);

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

function drawStageSelectScreen() {
  ctx.fillStyle = gb("mid");
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  drawTitleDecorativeGrid();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = gb("black");
  ctx.font = "42px 'Courier New', monospace";
  ctx.fillText("STAGE SELECT", SCREEN_WIDTH / 2, 68);

  const entries = [
    "1 COASTAL TEST AREA",
    "2 SUNKEN GRID",
    "3 MIDNIGHT TRENCH",
    "4 GHOST CURRENT",
    "5 BLACK SIGNAL ZONE",
    "6 ABYSS CORE",
    "7 SURFACE ALERT",
    "8 SKY SIGNAL MOTHERSHIP",
    "ORBITAL SIGNAL MODE",
  ];

  ctx.font = "18px 'Courier New', monospace";
  for (let i = 0; i < entries.length; i += 1) {
    const y = 126 + i * 34;
    const selected = i === game.stageSelectIndex;
    ctx.fillStyle = selected ? gb("black") : gb("dark");

    if (selected) {
      ctx.fillRect(112, y - 14, SCREEN_WIDTH - 224, 26);
      ctx.fillStyle = gb("light");
    }

    ctx.fillText(`${selected ? "> " : "  "}${entries[i]}`, SCREEN_WIDTH / 2, y);
  }

  ctx.fillStyle = gb("dark");
  ctx.fillText("SECRET: ??? [LOCKED]", SCREEN_WIDTH / 2, 442);
  ctx.font = "14px 'Courier New', monospace";
  ctx.fillText("UP/DOWN SELECT   SPACE/ENTER/Z START   ESC/BACKSPACE TITLE", SCREEN_WIDTH / 2, 488);
  ctx.fillText("MOBILE TAP: START SELECTED STAGE", SCREEN_WIDTH / 2, 514);
  ctx.fillText(`BEST SCORE ${padScore(game.bestScore)}   BEST WAVE ${game.bestWave}`, SCREEN_WIDTH / 2, 540);
  ctx.textAlign = "left";
}

function drawBackground() {
  if (isSpaceStage()) {
    drawSpaceBackground();
    return;
  }

  if (isAirStage()) {
    drawAirBackground();
    return;
  }

  const deep = getDepthFactor(cameraY + SCREEN_HEIGHT * 0.5);
  ctx.fillStyle = deep > 0.55 ? gb("dark") : gb("mid");
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  drawSeaGrid();
  drawSeaAtmosphere(deep);
  drawWreckage();
  drawDepthLines();
  drawBackgroundMarkers();
  drawSeafloor();
  drawSurfaceLines();
  drawWorldBorder();
}

function drawSpaceBackground() {
  ctx.fillStyle = gb("black");
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  // 星は座標ベースで描き、ランダム生成を毎フレーム行わないようにしています。
  for (let i = 0; i < 64; i += 1) {
    const worldX = (i * 211 + 97) % WORLD_WIDTH;
    const worldY = (i * 149 + 53) % getWorldHeight();

    if (!isPointVisible(worldX, worldY, 8)) {
      continue;
    }

    const blink = (Math.floor(game.titleTimer / 22) + i) % 4 === 0;
    ctx.fillStyle = blink ? gba("light", 0.78) : gba("mid", 0.58);
    ctx.fillRect(Math.round(worldX - cameraX), Math.round(worldY - cameraY), i % 7 === 0 ? 3 : 2, i % 5 === 0 ? 3 : 2);
  }

  const planetX = Math.round(1980 - cameraX * 0.35);
  const planetY = Math.round(260 - cameraY * 0.18);
  ctx.fillStyle = gba("dark", 0.52);
  ctx.fillRect(planetX - 52, planetY - 28, 104, 56);
  ctx.fillStyle = gba("mid", 0.34);
  ctx.fillRect(planetX - 42, planetY - 8, 84, 8);
  ctx.fillRect(planetX - 30, planetY + 12, 60, 6);

  ctx.strokeStyle = gba("dark", 0.28);
  ctx.lineWidth = 2;
  for (let y = 120 - (cameraY % 180); y <= SCREEN_HEIGHT; y += 180) {
    line(0, y, SCREEN_WIDTH, y + 42);
  }

  ctx.strokeStyle = gba("light", 0.16);
  const sweepX = Math.round((game.titleTimer * 4 - cameraX * 0.14) % SCREEN_WIDTH);
  line(sweepX, 80, sweepX + 80, SCREEN_HEIGHT - 80);

  drawBackgroundMarkers();
  drawWorldBorder();
}

function drawSeaAtmosphere(deep) {
  // 深いほど粒子を濃くし、海中の圧迫感を出します。座標ベースなので処理は軽めです。
  ctx.fillStyle = gba("black", 0.08 + deep * 0.18);

  for (let i = 0; i < 78; i += 1) {
    const worldX = (i * 137 + Math.floor(game.titleTimer * 0.6)) % WORLD_WIDTH;
    const worldY = getSeaSurfaceY() + 42 + ((i * 83 + Math.floor(game.titleTimer * 0.35)) % (getWorldHeight() - 180));

    if (!isPointVisible(worldX, worldY, 12)) {
      continue;
    }

    const x = Math.round(worldX - cameraX);
    const y = Math.round(worldY - cameraY);
    const size = i % 5 === 0 ? 4 : 2;
    ctx.fillRect(x, y, size, size);
  }

  ctx.fillStyle = gba("light", 0.18);
  for (let i = 0; i < 24; i += 1) {
    const worldX = (i * 251 + Math.floor(game.titleTimer * 0.25)) % WORLD_WIDTH;
    const worldY = getSeaSurfaceY() + 80 + ((i * 97 - Math.floor(game.titleTimer * 1.2)) % (getWorldHeight() - 260));

    if (isPointVisible(worldX, worldY, 10)) {
      ctx.fillRect(Math.round(worldX - cameraX), Math.round(worldY - cameraY), 3, 3);
    }
  }
}

function drawWreckage() {
  const wrecks = [
    { x: 360, y: 760, w: 120, h: 22 },
    { x: 980, y: 1000, w: 150, h: 28 },
    { x: 1530, y: 690, w: 100, h: 18 },
    { x: 2110, y: 1060, w: 170, h: 26 },
  ];

  ctx.fillStyle = gba("black", 0.32);
  ctx.strokeStyle = gba("black", 0.38);
  ctx.lineWidth = 2;

  for (const wreck of wrecks) {
    if (!isPointVisible(wreck.x, wreck.y, 140)) {
      continue;
    }

    const x = Math.round(wreck.x - cameraX);
    const y = Math.round(wreck.y - cameraY);
    ctx.fillRect(x - wreck.w / 2, y - wreck.h / 2, wreck.w, wreck.h);
    ctx.fillRect(x - wreck.w / 3, y - wreck.h / 2 - 12, wreck.w / 5, 12);
    line(x - wreck.w / 2, y + wreck.h / 2 + 6, x + wreck.w / 2, y + wreck.h / 2 - 10);
  }
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
    ctx.fillStyle = gba("black", 0.72);
    ctx.fillRect(0, 0, SCREEN_WIDTH, surfaceY);
    ctx.fillStyle = gba("dark", 0.38);

    for (let y = 8; y < surfaceY; y += 16) {
      ctx.fillRect(0, y, SCREEN_WIDTH, 2);
    }

    ctx.fillStyle = gba("black", 0.44);
    for (let x = 0; x < SCREEN_WIDTH; x += 34) {
      ctx.fillRect(x, 0, 2, surfaceY);
    }

    ctx.fillStyle = gba("light", 0.5);
    ctx.font = "14px 'Courier New', monospace";
    ctx.textBaseline = "middle";
    ctx.fillText("SURFACE LOCK / DIVE AREA ONLY", 18, Math.max(22, surfaceY - 18));
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

  const lineStep = isSeaStage() ? 120 : 160;
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
  const bottom = Math.round(getWorldHeight() - cameraY);

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
    const bob = supply.kind === "airBuoy" ? Math.sin(supply.phase) * 4 : supply.kind === "spacePod" ? Math.sin(supply.phase) * 5 : 0;
    const y = Math.round(supply.y - cameraY + bob);
    const readyBlink = Math.floor((game.titleTimer + supply.phase * 10) / 24) % 2 === 0;
    const flash = supply.flashTimer > 0 ? Math.floor(supply.flashTimer / 8) % 2 === 0 : readyBlink;

    if (supply.kind === "airBuoy") {
      drawSupplyBuoy(x, y, flash);
    } else if (supply.kind === "spacePod") {
      drawSpaceSupplyPod(x, y, flash);
    } else {
      drawSupplyPod(x, y, flash);
    }
  }
}

function drawSupplyPod(x, y, flash) {
  ctx.save();
  ctx.globalAlpha = flash ? 1 : 0.82;
  ctx.fillStyle = flash ? gb("light") : gb("black");
  ctx.fillRect(x - 14, y - 10, 28, 20);
  ctx.fillStyle = gb("mid");
  ctx.fillRect(x - 9, y - 5, 18, 10);
  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 2, y - 15, 4, 30);
  ctx.fillRect(x - 17, y - 2, 34, 4);
  ctx.restore();
}

function drawSupplyBuoy(x, y, flash) {
  // 空中戦の補給は、海面に浮いたブイとして描きます。
  ctx.save();
  ctx.globalAlpha = flash ? 1 : 0.82;
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
  ctx.restore();
}

function drawSpaceSupplyPod(x, y, flash) {
  ctx.save();
  ctx.globalAlpha = flash ? 1 : 0.82;
  ctx.fillStyle = flash ? gb("light") : gb("black");
  ctx.fillRect(x - 15, y - 12, 30, 24);
  ctx.fillStyle = gb("mid");
  ctx.fillRect(x - 8, y - 7, 16, 14);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - 24, y - 3, 9, 6);
  ctx.fillRect(x + 15, y - 3, 9, 6);
  ctx.fillStyle = gba("light", 0.5);
  ctx.fillRect(x - 3, y - 20, 6, 8);
  ctx.fillRect(x - 3, y + 12, 6, 8);
  ctx.restore();
}

function drawOneUps() {
  for (const oneUp of oneUps) {
    if (!isPointVisible(oneUp.x, oneUp.y, 70)) {
      continue;
    }

    const blink = Math.floor(oneUp.timer / 12) % 2 === 0;
    const x = Math.round(oneUp.x - cameraX);
    const y = Math.round(oneUp.y - cameraY + Math.sin(oneUp.phase) * 3);

    ctx.save();
    ctx.globalAlpha = oneUp.timer < 120 && !blink ? 0.35 : 1;

    if (oneUp.kind === "air") {
      drawAirOneUpCapsule(x, y, blink);
    } else if (oneUp.kind === "space") {
      drawSpaceOneUpCapsule(x, y, blink);
    } else {
      drawSeaOneUpCapsule(x, y, blink);
    }

    ctx.restore();
  }
}

function drawSeaOneUpCapsule(x, y, blink) {
  ctx.fillStyle = blink ? gb("light") : gb("black");
  ctx.fillRect(x - 15, y - 8, 30, 16);
  ctx.fillStyle = gb("mid");
  ctx.fillRect(x - 9, y - 5, 18, 10);
  ctx.fillStyle = gb("light");
  ctx.font = "12px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("1UP", x, y + 1);
  ctx.textAlign = "left";
}

function drawAirOneUpCapsule(x, y, blink) {
  ctx.fillStyle = blink ? gb("light") : gb("black");
  ctx.fillRect(x - 13, y - 10, 26, 18);
  ctx.fillStyle = gb("mid");
  ctx.fillRect(x - 5, y - 18, 10, 8);
  ctx.fillStyle = gb("light");
  ctx.font = "12px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("1UP", x, y + 1);
  ctx.textAlign = "left";
}

function drawSpaceOneUpCapsule(x, y, blink) {
  ctx.fillStyle = blink ? gb("light") : gb("black");
  ctx.fillRect(x - 14, y - 10, 28, 20);
  ctx.fillStyle = gb("mid");
  ctx.fillRect(x - 6, y - 16, 12, 6);
  ctx.fillRect(x - 6, y + 10, 12, 6);
  ctx.fillStyle = gb("light");
  ctx.font = "12px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("1UP", x, y + 1);
  ctx.textAlign = "left";
}

function drawBombs() {
  for (const bomb of bombs) {
    if (!isObjectVisible(bomb, 40)) {
      continue;
    }

    const x = Math.round(bomb.x - cameraX);
    const y = Math.round(bomb.y - cameraY);

    if (bomb.kind === "beam") {
      ctx.fillStyle = gb("light");
      ctx.fillRect(x - 3, y - 12, 6, 24);
      ctx.fillStyle = gb("mid");
      ctx.fillRect(x - 7, y + 5, 14, 5);
    } else if (bomb.kind === "aa") {
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
  if (enemy.type === "rammer") drawRammer(enemy);
  if (enemy.type === "abyssBoss") drawAbyssBoss(enemy);
  if (enemy.type === "helicopter") drawHelicopter(enemy);
  if (enemy.type === "plane") drawPlane(enemy);
  if (enemy.type === "ufo") drawUfo(enemy);
  if (enemy.type === "skyBoss") drawSkyBoss(enemy);
  if (enemy.type === "asteroid") drawAsteroid(enemy);
  if (enemy.type === "orbitalDrone") drawOrbitalDrone(enemy);
  if (enemy.type === "signalWisp") drawSignalWisp(enemy);
  if (enemy.type === "hunterUFO") drawHunterUFO(enemy);
  if (enemy.type === "signalCore") drawSignalCore(enemy);

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
  const padding = enemy.type === "rammer" ? 10 : 6;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = gb("light");
  ctx.lineWidth = enemy.type === "rammer" ? 4 : 3;
  ctx.strokeRect(
    Math.round(x - enemy.width / 2 - padding),
    Math.round(y - enemy.height / 2 - padding),
    enemy.width + padding * 2,
    enemy.height + padding * 2
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

function drawRammer(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);
  const alertBlink = enemy.rammerState === "warning" && Math.floor(enemy.warnTimer / 7) % 2 === 0;
  const charge = enemy.rammerState === "charge";

  ctx.fillStyle = alertBlink || charge ? gb("light") : gb("black");
  ctx.fillRect(x - 16, y - 7, 32, 14);
  ctx.fillStyle = gb("dark");
  if (enemy.direction > 0) {
    ctx.fillRect(x - 24, y - 4, 10, 8);
  } else {
    ctx.fillRect(x + 14, y - 4, 10, 8);
  }
  ctx.fillRect(x - 4, y + 7, 8, 5);
  ctx.fillStyle = gb("light");
  ctx.fillRect(x + 9 * enemy.direction - 3, y - 3, 6, 6);

  if (enemy.rammerState === "warning") {
    ctx.strokeStyle = gb("light");
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 25, y - 16, 50, 32);
    ctx.fillRect(x - 30, y - 2, 8, 4);
    ctx.fillRect(x + 22, y - 2, 8, 4);
  }
}

function drawAbyssBoss(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);
  const entryAlpha = enemy.entryTimer > 0 ? clamp(1 - enemy.entryTimer / CONFIG.effects.bossEntryTime, 0.22, 1) : 1;

  ctx.save();
  ctx.globalAlpha *= entryAlpha;
  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 74, y - 24, 148, 48);
  ctx.fillRect(x - 52, y - 38, 104, 14);
  ctx.fillRect(x - 62, y + 24, 124, 14);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - 92, y - 7, 18, 14);
  ctx.fillRect(x + 74, y - 7, 18, 14);
  ctx.fillRect(x - 18, y + 38, 36, 8);

  if (enemy.entryTimer > 0 || game.sonarFlashTimer > 0) {
    ctx.strokeStyle = gba("light", 0.4 + game.sonarFlashTimer / 120);
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 82, y - 42, 164, 88);
  }

  if (isAbyssWeakPointVisible(enemy)) {
    const weak = getAbyssWeakPointBox(enemy);
    ctx.fillStyle = enemy.pingTimer > 0 ? gb("light") : gb("mid");
    ctx.fillRect(Math.round(weak.left - cameraX), Math.round(weak.top - cameraY), weak.right - weak.left, weak.bottom - weak.top);
  }

  drawBossHealthBar(enemy, x - 74, y - 56, 148);
  ctx.restore();
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
  const entryAlpha = enemy.entryTimer > 0 ? clamp(1 - enemy.entryTimer / CONFIG.effects.bossEntryTime, 0.25, 1) : 1;

  ctx.save();
  ctx.globalAlpha *= entryAlpha;
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
    ctx.strokeStyle = gb("light");
    ctx.lineWidth = 3;
    ctx.strokeRect(Math.round(weak.left - cameraX - 5), Math.round(weak.top - cameraY - 5), weak.right - weak.left + 10, weak.bottom - weak.top + 10);
  } else {
    ctx.fillStyle = gb("mid");
    ctx.fillRect(x - 18, y - 7, 36, 6);
  }

  drawBossHealthBar(enemy, x - 86, y - 48, 172);
  ctx.restore();
}

function drawAsteroid(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);

  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 18, y - 14, 36, 28);
  ctx.fillRect(x - 12, y - 20, 24, 6);
  ctx.fillRect(x - 22, y - 6, 6, 16);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - 8, y - 8, 8, 6);
  ctx.fillRect(x + 6, y + 4, 10, 5);
  ctx.fillStyle = gba("light", 0.45);
  ctx.fillRect(x - 14, y - 13, 6, 4);
}

function drawOrbitalDrone(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);

  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 22, y - 8, 44, 16);
  ctx.fillRect(x - 10, y - 15, 20, 7);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - 32, y - 3, 10, 6);
  ctx.fillRect(x + 22, y - 3, 10, 6);
  ctx.fillStyle = gb("light");
  ctx.fillRect(x - 4, y - 4, 8, 8);
}

function drawSignalWisp(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);
  const pulse = Math.floor(game.titleTimer / 10) % 2 === 0;

  ctx.fillStyle = pulse || enemy.pingTimer > 0 ? gb("light") : gb("dark");
  ctx.fillRect(x - 10, y - 10, 20, 20);
  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 5, y - 5, 10, 10);
  ctx.fillStyle = gba("light", 0.5);
  ctx.fillRect(x - 17, y - 2, 7, 4);
  ctx.fillRect(x + 10, y - 2, 7, 4);
}

function drawHunterUFO(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);

  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 24, y - 7, 48, 14);
  ctx.fillRect(x - 14, y - 16, 28, 9);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - 31, y - 2, 7, 7);
  ctx.fillRect(x + 24, y - 2, 7, 7);
  ctx.fillStyle = gb("light");
  ctx.fillRect(x + (player.x > enemy.x ? 7 : -13), y - 11, 10, 4);
}

function drawSignalCore(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);
  const weakVisible = isSignalCoreWeakPointOpen(enemy);
  const pulse = Math.floor(game.titleTimer / 12) % 2 === 0;

  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 66, y - 30, 132, 60);
  ctx.fillRect(x - 48, y - 48, 96, 18);
  ctx.fillRect(x - 48, y + 30, 96, 18);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - 86, y - 8, 20, 16);
  ctx.fillRect(x + 66, y - 8, 20, 16);
  ctx.fillRect(x - 12, y - 62, 24, 14);
  ctx.fillRect(x - 12, y + 48, 24, 14);

  ctx.strokeStyle = gba(enemy.pingTimer > 0 || game.sonarFlashTimer > 0 ? "light" : "mid", weakVisible ? 0.9 : 0.42);
  ctx.lineWidth = weakVisible ? 4 : 2;
  ctx.strokeRect(x - 74, y - 56, 148, 112);

  if (weakVisible) {
    const weak = getSignalCoreWeakPointBox(enemy);
    ctx.fillStyle = pulse || enemy.pingTimer > 0 ? gb("light") : gb("mid");
    ctx.fillRect(Math.round(weak.left - cameraX), Math.round(weak.top - cameraY), weak.right - weak.left, weak.bottom - weak.top);
    ctx.strokeStyle = gb("light");
    ctx.lineWidth = 3;
    ctx.strokeRect(Math.round(weak.left - cameraX - 6), Math.round(weak.top - cameraY - 6), weak.right - weak.left + 12, weak.bottom - weak.top + 12);
  } else {
    ctx.fillStyle = gb("mid");
    ctx.fillRect(x - 22, y - 6, 44, 12);
  }

  drawBossHealthBar(enemy, x - 66, y - 76, 132);
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

    if (bullet.kind === "space") {
      ctx.fillStyle = gb("light");
      ctx.fillRect(x - 4, y - 4, 8, 8);
      ctx.fillStyle = gb("dark");
      ctx.fillRect(x - 2, y - 2, 4, 4);
    } else {
      ctx.fillStyle = bullet.kind === "laser" ? gb("light") : gb("black");
      ctx.fillRect(x - bullet.width / 2, y - bullet.height / 2, bullet.width, bullet.height);
      ctx.fillStyle = bullet.vy > 0 ? gb("dark") : gb("light");
      ctx.fillRect(x - 2, y + (bullet.vy > 0 ? 6 : -9), 4, 3);
    }
  }
}

function drawPlayer() {
  const x = Math.round(player.x - cameraX);
  const y = Math.round(player.y - cameraY);
  const invincibleBlink = player.invincibleTimer > 0 && Math.floor(player.invincibleTimer / 6) % 2 === 0;

  ctx.save();
  if (invincibleBlink) {
    ctx.globalAlpha = 0.45;
  }

  if (isSpaceStage()) {
    drawSpacePlayer(x, y);
    ctx.restore();
    return;
  }

  if (isSeaStage()) {
    drawSubmersiblePlayer(x, y);
    ctx.restore();
    return;
  }

  drawSurfaceInterceptorPlayer(x, y);
  ctx.restore();
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
  const waterline = Math.round(getAirSeaSurfaceY() - cameraY);

  // 空中戦の自機は「浮上した潜水艦」です。船ではなく低い船体と司令塔で見せます。
  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 36, y - 5, 72, 13);
  ctx.fillRect(x - 24, y + 8, 48, 6);
  ctx.fillRect(x - 10, y - 21, 24, 16);
  ctx.fillStyle = gb("light");
  ctx.fillRect(x + 25, y - 1, 13, 6);
  ctx.fillRect(x - 3, y - 16, 6, 5);
  ctx.fillRect(x + 7, y - 16, 6, 5);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - 45, y - 1, 10, 7);
  ctx.fillRect(x + 15, y - 31, 3, 12);
  ctx.fillRect(x + 10, y - 33, 13, 2);
  ctx.fillStyle = gba("light", 0.4);
  ctx.fillRect(x - 46, waterline + 4, 92, 2);
  ctx.fillRect(x - 30, waterline + 11, 60, 2);

  if (isAirStage()) {
    // 司令塔上の小さな対空砲。空を飛ばず、海面から撃ち上げる構図にします。
    ctx.fillStyle = gb("light");
    ctx.fillRect(x - 2, y - 39, 5, 18);
    ctx.fillRect(x - 8, y - 24, 16, 4);
  }
}

function drawSpacePlayer(x, y) {
  // 宇宙モードの自機は、深海艇が軌道戦闘艇へ変形したようなGB風シルエットです。
  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 24, y - 11, 48, 22);
  ctx.fillRect(x - 10, y - 24, 20, 13);
  ctx.fillRect(x - 34, y + 3, 18, 9);
  ctx.fillRect(x + 16, y + 3, 18, 9);
  ctx.fillStyle = gb("dark");
  ctx.fillRect(x - 31, y + 12, 10, 10);
  ctx.fillRect(x + 21, y + 12, 10, 10);
  ctx.fillStyle = gb("light");
  ctx.fillRect(x - 5, y - 18, 10, 6);
  ctx.fillRect(x - 3, y - 3, 6, 8);
  ctx.fillRect(x - 18, y + 13, 7, 4);
  ctx.fillRect(x + 11, y + 13, 7, 4);
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

    if (isSpaceStage()) {
      // 宇宙ではSCANNERらしく、円形波にグリッド線を重ねて見つけた感触を強めます。
      ctx.strokeStyle = gba("mid", 0.42 * alpha);
      ctx.lineWidth = 2;
      line(x - pulse.radius * 0.72, y, x + pulse.radius * 0.72, y);
      line(x, y - pulse.radius * 0.72, x, y + pulse.radius * 0.72);
    }

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

function drawParticles() {
  for (const particle of particles) {
    if (!isPointVisible(particle.x, particle.y, 20)) {
      continue;
    }

    const x = Math.round(particle.x - cameraX);
    const y = Math.round(particle.y - cameraY);

    ctx.save();
    ctx.globalAlpha = clamp(particle.life / 34, 0, 1);
    ctx.fillStyle = gb(particle.color);
    ctx.fillRect(x, y, particle.size, particle.size);
    ctx.restore();
  }
}

function drawPopups() {
  for (const popup of popups) {
    if (!isPointVisible(popup.x, popup.y, 60)) {
      continue;
    }

    const x = Math.round(popup.x - cameraX);
    const y = Math.round(popup.y - cameraY);

    ctx.save();
    ctx.globalAlpha = clamp(popup.life / 36, 0, 1);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "18px 'Courier New', monospace";
    ctx.fillStyle = gb("light");
    ctx.fillRect(x - popup.text.length * 5 - 6, y - 13, popup.text.length * 10 + 12, 24);
    ctx.fillStyle = gb("black");
    ctx.fillText(popup.text, x, y);
    ctx.restore();
    ctx.textAlign = "left";
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
  if (isSpaceStage()) {
    ctx.fillStyle = gba("black", 0.06);
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    if (game.sonarFlashTimer > 0) {
      ctx.fillStyle = gba("light", game.sonarFlashTimer / 210);
      ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    }
    return;
  }

  const deep = isAirStage() ? 0.08 : getDepthFactor(player.y);
  const tunedDepth = clamp(deep + getStageDepthBias(), 0, 1);

  // v0.3.6では暗さの上限を少し抑え、深層感と視認性の両方を残します。
  ctx.fillStyle = gba("black", isAirStage() ? 0.08 : 0.1 + tunedDepth * 0.38);
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  if (game.sonarFlashTimer > 0) {
    ctx.fillStyle = gba("light", game.sonarFlashTimer / 150);
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  }
}

function drawHud() {
  ctx.fillStyle = gb("black");
  ctx.fillRect(0, 0, SCREEN_WIDTH, 72);

  const ammoLabel = isSpaceStage() ? "ENERGY" : isAirStage() ? "AA SHELL" : "DEPTH CHARGE";
  const positionLabel = isSpaceStage() ? `WAVE ${game.wave}` : isAirStage() ? "SURFACE" : `DEPTH ${Math.round(player.y)}m`;
  const stageText = isSpaceStage() ? `WAVE ${game.wave}: ORBITAL SIGNAL MODE` : `STAGE ${game.stageIndex + 1}: ${game.stageName}`;
  const sensorLabel = getSensorLabel();
  const sensorText = game.sonarCooldown <= 0
    ? `${sensorLabel} READY`
    : `${sensorLabel} ${Math.ceil(game.sonarCooldown / 60)}`;
  const modeX = isSpaceStage() ? 300 : 330;
  const sensorX = isSpaceStage() ? 530 : 506;
  const cooldownBarX = isSpaceStage() ? 660 : 632;
  const soundX = isSpaceStage() ? 744 : 720;

  ctx.fillStyle = gb("light");
  ctx.font = "16px 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`SCORE ${padScore(game.score)}`, 18, 18);
  ctx.fillText(`LIVES ${game.lives}/${CONFIG.player.maxLives}`, 178, 18);
  ctx.fillText(`${ammoLabel} ${game.ammo}/${CONFIG.player.maxAmmo}`, 282, 18);
  ctx.fillText(positionLabel, 520, 18);

  ctx.fillStyle = gb("mid");
  ctx.fillText(stageText, 18, 48);
  ctx.fillText(`MODE: ${getStageModeLabel()}`, modeX, 48);

  ctx.fillStyle = gb("light");
  ctx.font = "12px 'Courier New', monospace";
  ctx.fillText("v0.5.1 V-MOVE", 636, 66);
  ctx.font = "16px 'Courier New', monospace";

  ctx.fillStyle = game.sonarCooldown <= 0 ? gb("light") : gb("mid");
  ctx.fillText(sensorText, sensorX, 48);
  drawSonarCooldownBar(cooldownBarX, 39, 78, 12);

  ctx.fillStyle = gb("mid");
  ctx.fillText(`SND ${game.soundEnabled ? "ON" : "OFF"}`, soundX, 48);

  if (game.ammo <= 0) {
    ctx.fillStyle = gb("light");
    ctx.fillText(isSpaceStage() ? "NO EN" : isAirStage() ? "NO AA" : "NO CHG", 690, 18);
  } else if (game.statusTimer > 0) {
    if (game.statusText.includes("RESTORED") || game.statusText.includes("1UP") || game.statusText.includes("BONUS")) {
      ctx.fillStyle = gb("light");
      ctx.fillRect(622, 8, 170, 20);
      ctx.fillStyle = gb("black");
    } else {
      ctx.fillStyle = gb("light");
    }
    ctx.fillText(game.statusText, 630, 18);
  }

  drawBossHudBar();
}

function drawPlayerFireNotice() {
  if (game.fireNoticeTimer <= 0 || !game.fireNoticeText || game.state !== STATE.PLAYING) {
    return;
  }

  const noticeX = clamp(Math.round(player.x - cameraX), 74, SCREEN_WIDTH - 74);
  const noticeY = clamp(Math.round(player.y - cameraY - player.height / 2 - 34), 92, SCREEN_HEIGHT - 58);
  const blinkOn = Math.floor(game.fireNoticeTimer / 7) % 2 === 0;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "24px 'Courier New', monospace";
  ctx.fillStyle = blinkOn ? gb("light") : gb("mid");
  ctx.fillRect(noticeX - 62, noticeY - 18, 124, 36);
  ctx.strokeStyle = gb("black");
  ctx.lineWidth = 3;
  ctx.strokeRect(noticeX - 62, noticeY - 18, 124, 36);
  ctx.fillStyle = gb("black");
  ctx.fillText(game.fireNoticeText, noticeX, noticeY + 1);
  ctx.restore();
}

function drawBossHudBar() {
  const boss = enemies.find((enemy) => enemy.alive && ENEMY_TYPES[enemy.type].boss);

  if (!boss) {
    return;
  }

  const x = 552;
  const y = 62;
  const width = 222;
  const rate = clamp(boss.health / boss.maxHealth, 0, 1);

  ctx.fillStyle = gb("black");
  ctx.fillRect(x - 2, y - 2, width + 4, 12);
  ctx.strokeStyle = gb("light");
  ctx.strokeRect(x - 2, y - 2, width + 4, 12);
  ctx.fillStyle = isSkyBossWeakPointOpen(boss) || isAbyssWeakPointVisible(boss) || (boss.type === "signalCore" && isSignalCoreWeakPointOpen(boss)) ? gb("light") : gb("mid");
  ctx.fillRect(x, y, Math.round(width * rate), 8);
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
  const scaleY = mapHeight / getWorldHeight();

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
  ctx.fillText("MOVE ARROW/WASD OR LEFT DRAG  SPACE/RIGHT TAP FIRE  E/SHIFT SENSOR  P/ESC PAUSE  R RESTART", 18, SCREEN_HEIGHT - 18);
}

function drawBossWarning() {
  if (game.bossWarningTimer <= 0 || !isBossStage() || game.state !== STATE.PLAYING) {
    return;
  }

  const blink = Math.floor(game.bossWarningTimer / 12) % 2 === 0;

  ctx.fillStyle = gba("black", 0.64);
  ctx.fillRect(0, SCREEN_HEIGHT / 2 - 82, SCREEN_WIDTH, 164);
  ctx.strokeStyle = blink ? gb("light") : gb("mid");
  ctx.lineWidth = 4;
  ctx.strokeRect(84, SCREEN_HEIGHT / 2 - 58, SCREEN_WIDTH - 168, 116);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = blink ? gb("light") : gb("mid");
  ctx.font = "42px 'Courier New', monospace";
  ctx.fillText("WARNING", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 22);
  ctx.font = "20px 'Courier New', monospace";
  ctx.fillText("BOSS SIGNAL DETECTED", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 25);
  ctx.textAlign = "left";
}

function drawStageClearOverlay() {
  const blink = Math.floor(game.clearTimer / 14) % 2 === 0;

  ctx.fillStyle = gba("black", 0.76);
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  ctx.strokeStyle = blink ? gb("light") : gb("mid");
  ctx.lineWidth = 4;
  ctx.strokeRect(112, SCREEN_HEIGHT / 2 - 72, SCREEN_WIDTH - 224, 144);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = gb("light");
  ctx.font = "32px 'Courier New', monospace";
  ctx.fillText("STAGE CLEAR", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 48);
  ctx.font = "22px 'Courier New', monospace";
  ctx.fillText(`${game.stageName}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 15);
  ctx.font = "30px 'Courier New', monospace";
  ctx.fillText(`SCORE ${padScore(game.score)}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 20);
  ctx.fillStyle = gb("mid");
  ctx.font = "16px 'Courier New', monospace";
  ctx.fillText(`LIVES ${game.lives}/${CONFIG.player.maxLives}   AMMO ${game.ammo}/${CONFIG.player.maxAmmo}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 48);
  ctx.fillText(`AUTO NEXT IN ${Math.ceil(game.clearTimer / 60)}   PRESS SPACE / ENTER / Z`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 72);
  ctx.textAlign = "left";
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

function drawOrbitalUnlockOverlay() {
  // STAGE 8後の接続画面です。完全終了ではなく、宇宙エンドレスへ進めることを明示します。
  const blink = Math.floor(game.clearTimer / 16) % 2 === 0;
  const autoCount = Math.max(0, Math.ceil(game.clearTimer / 60));

  ctx.fillStyle = gba("black", 0.72);
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  for (let i = 0; i < 7; i += 1) {
    const y = 132 + i * 42 + Math.sin((game.titleTimer + i * 11) * 0.04) * 5;
    ctx.strokeStyle = gba(i % 2 === 0 ? "mid" : "light", i % 2 === 0 ? 0.2 : 0.13);
    ctx.lineWidth = 2;
    line(110, y, SCREEN_WIDTH - 110, y - 22);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = blink ? gb("light") : gb("mid");
  ctx.lineWidth = 4;
  ctx.strokeRect(96, 164, SCREEN_WIDTH - 192, 210);

  ctx.fillStyle = gb("light");
  ctx.font = "32px 'Courier New', monospace";
  ctx.fillText("SIGNAL ASCENDING...", SCREEN_WIDTH / 2, 210);

  ctx.fillStyle = blink ? gb("light") : gb("mid");
  ctx.font = "26px 'Courier New', monospace";
  ctx.fillText("ORBITAL SIGNAL MODE", SCREEN_WIDTH / 2, 262);
  ctx.fillText("UNLOCKED", SCREEN_WIDTH / 2, 300);

  ctx.fillStyle = gb("mid");
  ctx.font = "16px 'Courier New', monospace";
  ctx.fillText(`AUTO ORBIT IN ${autoCount}`, SCREEN_WIDTH / 2, 340);
  ctx.fillText("PRESS SPACE / ENTER / Z", SCREEN_WIDTH / 2, 366);

  ctx.textAlign = "left";
}

function drawSpaceGameOver() {
  ctx.fillStyle = gba("black", 0.82);
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = gb("light");
  ctx.font = "42px 'Courier New', monospace";
  ctx.fillText("GAME OVER", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 70);

  ctx.fillStyle = gb("mid");
  ctx.font = "22px 'Courier New', monospace";
  ctx.fillText(`FINAL SCORE ${padScore(getFiniteNumber(game.score, 0))}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 18);
  ctx.fillStyle = gb("light");
  ctx.fillText(`REACHED WAVE ${Math.max(getFiniteNumber(game.reachedWave, 0), getFiniteNumber(game.wave, 0))}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 20);
  ctx.fillStyle = gb("mid");
  ctx.font = "16px 'Courier New', monospace";
  ctx.fillText(`BEST SCORE ${padScore(getFiniteNumber(game.bestScore, 0))}   BEST WAVE ${getFiniteNumber(game.bestWave, 0)}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 48);

  ctx.fillStyle = gb("mid");
  ctx.font = "16px 'Courier New', monospace";
  ctx.fillText("PRESS R TO RESTART", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 82);
  ctx.fillText("PRESS SPACE TO TITLE", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 108);
  ctx.textAlign = "left";
}

function drawSignalCoreClearOverlay() {
  const blink = Math.floor(game.spaceWaveTimer / 14) % 2 === 0;

  ctx.fillStyle = gba("black", 0.7);
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  ctx.strokeStyle = blink ? gb("light") : gb("mid");
  ctx.lineWidth = 4;
  ctx.strokeRect(94, SCREEN_HEIGHT / 2 - 96, SCREEN_WIDTH - 188, 190);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = gb("light");
  ctx.font = "30px 'Courier New', monospace";
  ctx.fillText("SIGNAL CORE DESTROYED", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 56);
  ctx.font = "22px 'Courier New', monospace";
  ctx.fillText("STAGE SELECT UNLOCKED", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 16);
  ctx.fillStyle = gb("mid");
  ctx.fillText("ORBITAL SIGNAL CONTINUES", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 24);
  ctx.font = "16px 'Courier New', monospace";
  ctx.fillText("PRESS SPACE / ENTER / Z", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 64);
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
  clearTouchInput();
  resetRunResources();
  game.wave = 0;
  game.reachedWave = 0;
  game.spaceWavePending = false;
  game.spaceWaveTimer = 0;
  game.spaceBossClearPending = false;
  game.signalCoreDefeated = false;
  game.lastTime = 0;
  loadStage(0, false);
  game.state = STATE.PLAYING;
  playSound("start");
}

function resetRunResources() {
  game.score = 0;
  game.lives = CONFIG.player.startLives;
  game.ammo = CONFIG.player.maxAmmo;
}

function returnToTitle() {
  clearTouchInput();
  game.lastTime = 0;
  game.wave = 0;
  game.spaceWavePending = false;
  game.spaceWaveTimer = 0;
  game.spaceBossClearPending = false;
  game.signalCoreDefeated = false;
  loadStage(0, false);
  game.state = STATE.TITLE;
  setStatus("", 0);
}

function startSpaceMode() {
  clearTouchInput();
  game.wave = 1;
  game.reachedWave = 1;
  game.spaceWavePending = false;
  game.spaceWaveTimer = 0;
  game.spaceBossClearPending = false;
  game.signalCoreDefeated = false;
  loadStage(SPACE_STAGE_INDEX, true);
  game.wave = 1;
  game.reachedWave = 1;
  spawnSpaceWave();
  game.state = STATE.PLAYING;
  game.clearTimer = 0;
  setStatus("WAVE 1", 130);
  playSound("start");
}

function startDirectSpaceMode() {
  resetRunResources();
  startSpaceMode();
}

function beginSpaceWaveClear() {
  if (game.spaceWavePending) {
    return;
  }

  // wave間は短い待ちだけにして、テンポを崩さず次の波へ移れるようにします。
  game.spaceWavePending = true;
  game.spaceWaveTimer = CONFIG.space.waveClearDelay;
  bombs.length = 0;
  enemyBullets.length = 0;
  setStatus(`WAVE ${game.wave} CLEAR / NEXT WAVE`, 100);
  addPopup("WAVE CLEAR", player.x, player.y - 52);
  playSound("clear");
}

function beginSignalCoreClear() {
  if (game.spaceWavePending) {
    return;
  }

  game.spaceWavePending = true;
  game.spaceBossClearPending = true;
  game.spaceWaveTimer = CONFIG.space.signalCoreClearDelay;
  bombs.length = 0;
  enemyBullets.length = 0;
  setStatus("SIGNAL CORE DESTROYED", 180);
  addPopup("STAGE SELECT UNLOCKED", player.x, player.y - 58);
  playSound("clear");
}

function advanceSpaceWave() {
  game.spaceWavePending = false;
  game.spaceWaveTimer = 0;
  game.spaceBossClearPending = false;
  game.signalCoreDefeated = false;
  game.wave += 1;
  game.reachedWave = Math.max(game.reachedWave, game.wave);
  updateBestProgress();
  bombs.length = 0;
  enemyBullets.length = 0;
  explosions.length = 0;
  particles.length = 0;
  popups.length = 0;
  spawnSpaceWave();

  if (game.wave % 5 === 0 || game.ammo <= 2) {
    for (const supply of supplies) {
      placeSupplyRandomly(supply);
    }
  }

  setStatus(game.wave % 3 === 0 ? `NEXT WAVE ${game.wave} / SIGNAL DENSITY UP` : `NEXT WAVE ${game.wave}`, 150);
  playSound("sonar");
}

function spawnSpaceWave() {
  enemies.length = 0;

  const wave = Math.max(1, game.wave);

  if (wave === CONFIG.space.signalCoreWave) {
    enemies.push(createEnemy({
      type: "signalCore",
      x: player.x,
      y: clamp(player.y - 280, CONFIG.space.enemyMinY + 80, CONFIG.space.enemyMaxY - 180),
      direction: Math.random() > 0.5 ? 1 : -1,
      patrolLeft: 260,
      patrolRight: WORLD_WIDTH - 260,
      hatchTimer: 0,
      summonTimer: 420,
      initiallyDetected: true,
    }, 0));
    setStatus("WAVE 10 / SIGNAL CORE", 180);
    playSound("warning");
    return;
  }

  const enemyTypes = getSpaceWaveEnemyTypes(wave);

  for (let i = 0; i < enemyTypes.length; i += 1) {
    const type = enemyTypes[i];
    const x = randomRange(180, WORLD_WIDTH - 180);
    const y = randomRange(CONFIG.space.enemyMinY, CONFIG.space.enemyMaxY);
    const direction = Math.random() > 0.5 ? 1 : -1;

    enemies.push(createEnemy({
      type,
      x,
      y,
      direction,
      patrolLeft: Math.max(80, x - randomRange(240, 440)),
      patrolRight: Math.min(WORLD_WIDTH - 80, x + randomRange(240, 440)),
      initiallyDetected: wave <= 2 && i < 2,
    }, enemies.length));
  }
}

function getSpaceWaveEnemyTypes(wave) {
  // v0.4.1ではwave 1〜10の上昇を緩やかにし、序盤で各敵に慣れる時間を作ります。
  if (wave === 1) return ["asteroid", "orbitalDrone", "signalWisp"];
  if (wave === 2) return ["asteroid", "orbitalDrone", "orbitalDrone", "signalWisp"];
  if (wave === 3) return ["asteroid", "orbitalDrone", "signalWisp", "signalWisp", "hunterUFO"];
  if (wave === 4) return ["asteroid", "orbitalDrone", "orbitalDrone", "signalWisp", "hunterUFO", "hunterUFO"];
  if (wave === 5) return ["asteroid", "asteroid", "orbitalDrone", "orbitalDrone", "signalWisp", "signalWisp", "hunterUFO"];

  const count = Math.min(15, 6 + Math.floor(wave * 0.85));
  const types = [];

  for (let i = 0; i < count; i += 1) {
    if (i % 6 === 0) {
      types.push("asteroid");
    } else if (i % 5 === 0 || (wave >= 8 && i % 4 === 0)) {
      types.push("hunterUFO");
    } else if (i % 3 === 0) {
      types.push("signalWisp");
    } else {
      types.push("orbitalDrone");
    }
  }

  return types;
}

function createEnemy(layout, index) {
  const base = ENEMY_TYPES[layout.type];
  const stage = getCurrentStage();
  const patrolPadding = base.boss ? 520 : layout.type === "torpedo" || layout.type === "plane" ? 320 : 210;
  const spaceWave = stage.type === STAGE_TYPE.SPACE ? Math.max(1, game.wave || 1) : 0;
  const speedScale = spaceWave > 0 ? Math.min(1.75, 1 + (spaceWave - 1) * 0.045) : 1;
  const fireScale = spaceWave > 0 ? Math.max(0.62, 1 - (spaceWave - 1) * 0.025) : 1;
  const baseFireInterval = base.fireInterval > 0
    ? Math.max(34, base.fireInterval * (stage.fireRate || 1) * fireScale)
    : 0;
  const hasBossEntry = base.boss && (stage.type === STAGE_TYPE.SEA_BOSS || stage.type === STAGE_TYPE.AIR_BOSS);
  const startY = hasBossEntry && layout.type === "abyssBoss"
    ? layout.y + 190
    : hasBossEntry && layout.type === "skyBoss"
      ? -70
      : layout.y;

  return {
    id: index,
    type: layout.type,
    name: base.name,
    domain: base.domain,
    x: layout.x,
    y: startY,
    targetY: layout.y,
    width: base.width,
    height: base.height,
    health: layout.health || base.health,
    maxHealth: layout.health || base.health,
    speed: (layout.speed || base.speed) * speedScale,
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
    entryTimer: hasBossEntry ? CONFIG.effects.bossEntryTime : 0,
    rammerState: "patrol",
    rammerCooldown: 80 + index * 10,
    warnTimer: 0,
    chargeTimer: 0,
    chargeVx: 0,
    chargeVy: 0,
    hatchTimer: layout.hatchTimer || 0,
    summonTimer: layout.summonTimer || (layout.type === "skyBoss" ? 360 : 220),
    spawnedByBoss: Boolean(layout.spawnedByBoss),
    detectedTimer: layout.initiallyDetected ? CONFIG.sonar.revealTime : 0,
    pingTimer: 0,
  };
}

function loadStage(stageIndex, keepPlayerResources) {
  const stage = STAGES[stageIndex];

  clearTouchInput();
  game.stageIndex = stageIndex;
  game.stageName = stage.name;
  game.stageType = stage.type || STAGE_TYPE.SEA;
  game.state = STATE.PLAYING;
  game.clearTimer = 0;
  game.bossWarningTimer = isBossStage() ? CONFIG.effects.bossWarningTime : 0;
  game.screenShakeTimer = 0;
  game.screenShakePower = 0;
  game.bombCooldown = 0;
  game.sonarCooldown = 0;
  game.sonarFlashTimer = 0;
  game.spaceWavePending = false;
  game.spaceWaveTimer = 0;
  game.spaceBossClearPending = false;
  game.signalCoreDefeated = false;
  game.statusText = "";
  game.statusTimer = 0;
  game.fireNoticeText = "";
  game.fireNoticeTimer = 0;

  if (!keepPlayerResources) {
    game.score = 0;
    game.lives = CONFIG.player.startLives;
    game.ammo = CONFIG.player.maxAmmo;
  } else {
    game.ammo = CONFIG.player.maxAmmo;
  }

  player.x = stage.start.x;
  player.y = stage.start.y;
  player.speed = isSpaceStage() ? CONFIG.player.speed * 1.05 : isAirStage() ? CONFIG.player.speed * 0.92 : CONFIG.player.speed;
  player.invincibleTimer = 0;
  clampPlayerToStage();

  cameraX = clamp(player.x - SCREEN_WIDTH * 0.44, 0, WORLD_WIDTH - SCREEN_WIDTH);
  cameraY = isAirStage() ? 0 : clamp(player.y - SCREEN_HEIGHT * 0.30, 0, getWorldHeight() - SCREEN_HEIGHT);

  bombs.length = 0;
  enemyBullets.length = 0;
  explosions.length = 0;
  sonarPulses.length = 0;
  oneUps.length = 0;
  muzzleFlashes.length = 0;
  particles.length = 0;
  popups.length = 0;

  enemies.length = 0;
  for (let i = 0; i < stage.enemies.length; i += 1) {
    enemies.push(createEnemy(stage.enemies[i], i));
  }

  supplies.length = 0;
  createStageSupplyPoint();

  setStatus(`ENTER ${stage.name}`, 130);

  if (isBossStage()) {
    playSound("warning");
  }
}

function getCurrentStage() {
  return STAGES[game.stageIndex] || STAGES[0];
}

function createStageSupplyPoint() {
  const supply = {
    x: 0,
    y: 0,
    kind: isSpaceStage() ? "spacePod" : isAirStage() ? "airBuoy" : "seaPod",
    active: true,
    respawnTimer: 0,
    flashTimer: 80,
    phase: Math.random() * Math.PI * 2,
    previousX: null,
    previousY: null,
  };

  placeSupplyRandomly(supply);
  supplies.push(supply);
}

function placeSupplyRandomly(supply) {
  // 取得後の再出現も必ずここを通し、ステージ種別ごとのランダム位置へ置き直します。
  // 「補給が固定に戻った」ように見えないよう、固定フォールバックも避けます。
  const position = chooseSupplyPosition(supply);

  if (hasPreviousSupplyPosition(supply)) {
    supply.previousX = supply.x;
    supply.previousY = supply.y;
  }
  supply.x = position.x;
  supply.y = position.y;
  supply.kind = position.kind;
  supply.active = true;
  supply.respawnTimer = 0;
  supply.flashTimer = 90;
  supply.phase = Math.random() * Math.PI * 2;
}

function chooseSupplyPosition(supply) {
  // v0.5.1: 補給を探しに行く遊びにするため、複数候補から「遠い」位置を優先します。
  // 近場に固定化して見えないよう、前回位置とプレイヤー位置の両方から離します。
  const minPreviousDistance = isAirStage() ? 760 : isSpaceStage() ? 740 : 680;
  const minPlayerDistance = isAirStage() ? 700 : isSpaceStage() ? 680 : 620;
  let bestPosition = null;
  let bestScore = -Infinity;

  for (let i = 0; i < CONFIG.supply.searchSamples; i += 1) {
    const candidate = getRandomSupplyPosition();
    const previousDistance = hasPreviousSupplyPosition(supply)
      ? distance(candidate.x, candidate.y, supply.x, supply.y)
      : minPreviousDistance + 1;
    const playerDistance = distance(candidate.x, candidate.y, player.x, player.y);
    let score = playerDistance * 1.48 + previousDistance * 0.78 + Math.random() * 220;

    if (previousDistance < minPreviousDistance) {
      score -= (minPreviousDistance - previousDistance) * 2.4;
    }
    if (playerDistance < minPlayerDistance) {
      score -= (minPlayerDistance - playerDistance) * 3.1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestPosition = candidate;
    }
  }

  return bestPosition || getRandomSupplyPosition();
}

function getSupplySearchHint(supply) {
  const dx = supply.x - player.x;
  const dy = supply.y - player.y;

  if (Math.abs(dx) > Math.abs(dy) * 1.15) {
    return dx >= 0 ? "SUPPLY EAST" : "SUPPLY WEST";
  }

  if (isSpaceStage()) {
    return dy >= 0 ? "SUPPLY DOWN" : "SUPPLY UP";
  }

  if (isAirStage()) {
    return dx >= 0 ? "SUPPLY EAST" : "SUPPLY WEST";
  }

  return dy >= 0 ? "SUPPLY DEEP" : "SUPPLY ABOVE";
}

function hasPreviousSupplyPosition(supply) {
  return Number.isFinite(supply.x) && Number.isFinite(supply.y) && !(supply.x === 0 && supply.y === 0);
}

function getRandomSupplyPosition() {
  if (isSpaceStage()) {
    return {
      x: randomWorldX(),
      y: randomRange(190, getWorldHeight() - 190),
      kind: "spacePod",
    };
  }

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

  if (game.stageIndex === 0) {
    return {
      x: randomWorldX(),
      y: randomRange(CONFIG.sea.supplyMinDepth, 560),
      kind: "seaPod",
    };
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

  return {
    x: randomWorldX(),
    y: randomRange(CONFIG.sea.bossSupplyMinDepth, CONFIG.sea.bossSupplyMaxDepth),
    kind: "seaPod",
  };
}

function getAirBossSupplyPosition() {
  const boss = enemies.find((enemy) => enemy.alive && enemy.type === "skyBoss");

  for (let i = 0; i < 24; i += 1) {
    const x = randomWorldX();

    if (!boss || Math.abs(x - boss.x) > 320) {
      return { x, y: getAirSupplyY(), kind: "airBuoy" };
    }
  }

  const sideMin = CONFIG.supply.edgeMargin;
  const sideMax = WORLD_WIDTH - CONFIG.supply.edgeMargin;
  const fallbackX = boss && boss.x < WORLD_WIDTH / 2
    ? randomRange(WORLD_WIDTH * 0.58, sideMax)
    : randomRange(sideMin, WORLD_WIDTH * 0.42);
  return { x: fallbackX, y: getAirSupplyY(), kind: "airBuoy" };
}

function randomSupplyRespawnTime() {
  const stage = getCurrentStage();
  let minTime;
  let maxTime;

  // stage.supplyRespawn を追加すれば、ステージ単位で再出現時間を上書きできます。
  if (stage.supplyRespawn) {
    minTime = stage.supplyRespawn.min;
    maxTime = stage.supplyRespawn.max;
  } else if (isSpaceStage()) {
    minTime = CONFIG.space.supplyRespawnMin;
    maxTime = CONFIG.space.supplyRespawnMax;
  } else if (isBossStage()) {
    minTime = CONFIG.supply.bossRespawnMin;
    maxTime = CONFIG.supply.bossRespawnMax;
  } else {
    minTime = CONFIG.supply.normalRespawnMin;
    maxTime = CONFIG.supply.normalRespawnMax;
  }

  if (isSpaceStage() && game.wave > 0 && game.wave % 5 === 0) {
    minTime *= 0.72;
    maxTime *= 0.82;
  }

  // 弾切れ付近では詰みを避けるため、次の補給を少し早めます。
  if (game.ammo <= 2) {
    minTime *= CONFIG.supply.lowAmmoRespawnFactor;
    maxTime *= CONFIG.supply.lowAmmoRespawnFactor;
  }

  return randomRange(minTime, maxTime);
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

function getWorldHeight() {
  const stage = getCurrentStage();

  if (stage && stage.worldHeight) {
    return stage.worldHeight;
  }

  if (isSeaStage()) {
    return CONFIG.world.seaHeight;
  }

  if (isSpaceStage()) {
    return CONFIG.world.spaceHeight;
  }

  return CONFIG.world.airHeight;
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

function addBurstParticles(x, y, count, color) {
  const freeSlots = Math.max(0, CONFIG.effects.maxParticles - particles.length);
  const particleCount = Math.min(count, freeSlots);

  for (let i = 0; i < particleCount; i += 1) {
    const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.4;
    const speed = randomRange(0.7, 2.6);

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: isAirStage() ? 0.035 : -0.01,
      size: Math.random() > 0.55 ? 4 : 3,
      color,
      life: randomRange(20, 42),
    });
  }
}

function addPopup(text, x, y) {
  popups.push({
    text,
    x,
    y,
    life: 70,
  });
}

function startScreenShake(duration, power) {
  game.screenShakeTimer = Math.max(game.screenShakeTimer, duration);
  game.screenShakePower = Math.max(game.screenShakePower, power);
}

function setStatus(text, duration) {
  game.statusText = text;
  game.statusTimer = duration;
}

function loadPersistentProgress() {
  const saved = readStorageProgress();

  if (!saved) {
    return;
  }

  game.unlocks.orbital = Boolean(saved.orbitalUnlocked || saved.orbital);
  game.unlocks.stageSelect = Boolean(saved.stageSelectUnlocked || saved.stageSelect);
  game.bestScore = Number(saved.bestScore) || 0;
  game.bestWave = Number(saved.bestWave) || 0;
}

function readStorageProgress() {
  try {
    if (!window.localStorage) {
      return null;
    }

    const raw = window.localStorage.getItem(CONFIG.storage.unlockKey);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function savePersistentProgress() {
  try {
    if (!window.localStorage) {
      return;
    }

    window.localStorage.setItem(CONFIG.storage.unlockKey, JSON.stringify({
      orbitalUnlocked: game.unlocks.orbital,
      stageSelectUnlocked: game.unlocks.stageSelect,
      bestScore: game.bestScore,
      bestWave: game.bestWave,
    }));
  } catch (error) {
    // localStorageが使えない環境でもゲーム進行は止めません。
  }
}

function unlockOrbitalRewards() {
  game.unlocks.orbital = true;
  game.unlocks.stageSelect = true;
  savePersistentProgress();
}

function updateBestProgress() {
  let changed = false;
  const score = getFiniteNumber(game.score, 0);
  const reachedWave = getFiniteNumber(game.reachedWave, 0);

  if (score > getFiniteNumber(game.bestScore, 0)) {
    game.bestScore = score;
    changed = true;
  }

  if (reachedWave > getFiniteNumber(game.bestWave, 0)) {
    game.bestWave = reachedWave;
    changed = true;
  }

  if (changed) {
    savePersistentProgress();
  }
}

function isAirStage() {
  return game.stageType === STAGE_TYPE.AIR || game.stageType === STAGE_TYPE.AIR_BOSS;
}

function isSeaStage() {
  return game.stageType === STAGE_TYPE.SEA || game.stageType === STAGE_TYPE.SEA_BOSS;
}

function isSpaceStage() {
  return game.stageType === STAGE_TYPE.SPACE;
}

function isBossStage() {
  return game.stageType === STAGE_TYPE.SEA_BOSS || game.stageType === STAGE_TYPE.AIR_BOSS;
}

function getStageModeLabel() {
  if (isSpaceStage()) return "ORBITAL SIGNAL";
  if (isAirStage()) return "SURFACED SUB";
  if (game.stageType === STAGE_TYPE.SEA_BOSS) return "BOSS";
  return "DEEP SEA";
}

function getSensorLabel() {
  if (isSpaceStage()) return "SCANNER";
  return isAirStage() ? "RADAR" : "SONAR";
}

function getEnemyDomain(enemy) {
  return enemy.domain || (ENEMY_TYPES[enemy.type] ? ENEMY_TYPES[enemy.type].domain : "sea");
}

function isAbyssWeakPointVisible(enemy) {
  return enemy.detectedTimer > 0 || enemy.pingTimer > 0;
}

function isSkyBossWeakPointOpen(enemy) {
  return enemy.hatchTimer < 96;
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

  if (getEnemyDomain(enemy) === "space") {
    if (enemy.type === "signalCore") return enemy.detectedTimer > 0 || enemy.pingTimer > 0 ? 1 : 0.86;
    if (enemy.detectedTimer > 0) return 1;
    if (enemy.pingTimer > 0) return enemy.type === "signalWisp" ? 0.94 : 0.9;
    return enemy.type === "signalWisp" ? 0.42 : 0.88;
  }

  if (enemy.detectedTimer > 0) {
    return 1;
  }

  if (enemy.pingTimer > 0) {
    return 0.78;
  }

  const depth = getDepthFactor(enemy.y);
  const visibility = 1 - depth * 1.08 + getCurrentStage().visibilityBonus;
  return clamp(visibility, enemy.type === "rammer" ? 0.12 : 0.1, 1);
}

function getStageDepthBias() {
  // 序盤は暗さを抑え、後半で段階的に深海感を強めます。
  const biases = [-0.18, -0.12, -0.04, 0.02, 0.08, 0.02, 0, 0];
  return biases[game.stageIndex] || 0;
}

function getEnemyMapAlpha(enemy) {
  if (getEnemyDomain(enemy) === "air") return enemy.detectedTimer > 0 || enemy.y < 260 ? 1 : 0.76;
  if (getEnemyDomain(enemy) === "space") {
    if (enemy.detectedTimer > 0 || enemy.pingTimer > 0) return 1;
    if (enemy.type === "signalCore") return 0.9;
    return enemy.type === "signalWisp" ? 0.34 : 0.72;
  }
  if (ENEMY_TYPES[enemy.type].boss) return enemy.detectedTimer > 0 ? 1 : 0.34;
  if (enemy.detectedTimer > 0) return 1;
  if (enemy.y < 440) return 0.78;
  if (enemy.y < 760) return 0.22;
  return 0.06;
}

function getDepthFactor(worldY) {
  const playableDepth = Math.max(860, getWorldHeight() - getSeaSurfaceY() - 260);
  return clamp((worldY - getSeaSurfaceY() - 80) / playableDepth, 0, 1);
}

function getSeafloorY(worldX) {
  return getWorldHeight() - 94 + Math.sin(worldX * 0.006) * 18 + Math.sin(worldX * 0.018) * 7;
}

function getBox(object) {
  const width = getFiniteNumber(object && object.width, 8);
  const height = getFiniteNumber(object && object.height, 8);
  const x = getFiniteNumber(object && object.x, player.x);
  const y = getFiniteNumber(object && object.y, player.y);

  return {
    left: x - width / 2,
    right: x + width / 2,
    top: y - height / 2,
    bottom: y + height / 2,
  };
}

function getContactBox(object, scale) {
  const width = getFiniteNumber(object && object.width, 8) * scale;
  const height = getFiniteNumber(object && object.height, 8) * scale;
  const x = getFiniteNumber(object && object.x, player.x);
  const y = getFiniteNumber(object && object.y, player.y);

  return {
    left: x - width / 2,
    right: x + width / 2,
    top: y - height / 2,
    bottom: y + height / 2,
  };
}

function getEnemyContactBox(enemy) {
  if (!enemy || !ENEMY_TYPES[enemy.type]) {
    return getContactBox(enemy || player, 0.7);
  }

  if (ENEMY_TYPES[enemy.type].boss) {
    return getContactBox(enemy, 0.46);
  }

  if (getEnemyDomain(enemy) === "space") {
    if (enemy.type === "signalCore") return getContactBox(enemy, 0.58);
    return getContactBox(enemy, enemy.type === "signalWisp" ? 0.62 : enemy.type === "asteroid" ? 0.7 : 0.74);
  }

  if (enemy.type === "mine" || enemy.type === "rammer") {
    return getContactBox(enemy, 0.78);
  }

  if (getDepthFactor(enemy.y) > 0.72) {
    return getContactBox(enemy, 0.68);
  }

  return getContactBox(enemy, 0.78);
}

function isColliding(a, b) {
  if (!a || !b) {
    return false;
  }

  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function getFiniteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function hasUsablePosition(object) {
  return Boolean(object) && Number.isFinite(object.x) && Number.isFinite(object.y);
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
      maxLives: CONFIG.player.maxLives,
      ammo: game.ammo,
      soundEnabled: game.soundEnabled,
      sonarCooldown: game.sonarCooldown,
      bossWarningTimer: game.bossWarningTimer,
      screenShakeTimer: game.screenShakeTimer,
      playerX: player.x,
      playerY: player.y,
      cameraX,
      cameraY,
      worldHeight: getWorldHeight(),
      seaSurfaceY: getSeaSurfaceY(),
      airSeaSurfaceY: getAirSeaSurfaceY(),
      bombs: bombs.length,
      projectiles: bombs.map((bomb) => bomb.kind || "depth"),
      particles: particles.length,
      muzzleFlashes: muzzleFlashes.length,
      popups: popups.length,
      oneUps: oneUps.map((oneUp) => ({
        x: oneUp.x,
        y: oneUp.y,
        kind: oneUp.kind,
        timer: oneUp.timer,
      })),
      enemiesAlive: enemies.filter((enemy) => enemy.alive).length,
      enemies: enemies
        .filter((enemy) => enemy.alive)
        .map((enemy) => ({ type: enemy.type, x: enemy.x, y: enemy.y, state: enemy.rammerState || "" })),
      bosses: enemies
        .filter((enemy) => ENEMY_TYPES[enemy.type].boss)
        .map((enemy) => ({
          type: enemy.type,
          alive: enemy.alive,
          health: enemy.health,
          entryTimer: enemy.entryTimer,
          hatchOpen: isSkyBossWeakPointOpen(enemy),
        })),
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
loadPersistentProgress();
loadStage(0, false);
game.state = STATE.TITLE;
requestAnimationFrame(gameLoop);
