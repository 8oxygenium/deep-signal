// ============================================================
// DEEP SIGNAL
// ソナーで敵を探し、爆雷で倒す探索型レトロPC風シューティングです。
// 画像素材は使わず、canvas の図形描画だけで作っています。
// ============================================================

// canvas と描画用コンテキストを取得します。
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// canvas の表示サイズです。ゲーム画面は 800 x 600 のまま固定します。
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

// ゲーム内の広い海域です。画面にはこの一部だけを表示します。
const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1200;

// 60fps を基準にした移動倍率です。環境差で速度が大きく変わるのを防ぎます。
const BASE_FRAME_MS = 1000 / 60;

// 自機やゲーム進行の基本値です。
const MAX_LIVES = 3;
const MAX_AMMO = 12;
const SUPPLY_RADIUS = 70;
const CLEAR_DELAY = 210;

// ソナーの設定です。単位はだいたい 60fps のフレーム数です。
const SONAR_RANGE = 470;
const SONAR_COOLDOWN = 360;
const SONAR_REVEAL_TIME = 330;
const SONAR_PING_TIME = 70;

// 押されているキーを記録します。
const keys = {};

// カメラ位置です。world座標のどこを画面左上として表示するかを表します。
// 改造しやすいよう、cameraX / cameraY という名前で分けています。
let cameraX = 0;
let cameraY = 0;

// ゲーム全体の状態です。
const game = {
  score: 0,
  lives: MAX_LIVES,
  ammo: MAX_AMMO,
  stageIndex: 0,
  stageName: "",
  state: "playing", // "playing", "clear", "complete", "gameover"
  bombCooldown: 0,
  sonarCooldown: 0,
  clearTimer: 0,
  statusText: "",
  statusTimer: 0,
  lastTime: 0,
};

// プレイヤーの調査船です。x, y はワールド座標の中心位置です。
const player = {
  x: 180,
  y: 120,
  width: 66,
  height: 22,
  speed: 4.4,
  invincibleTimer: 0,
};

// 敵の種類ごとの基本設定です。
// 数値を変えるだけで、体力・速度・得点を調整できます。
const ENEMY_TYPES = {
  drone: {
    name: "潜水ドローン",
    width: 58,
    height: 24,
    health: 2,
    speed: 1.25,
    score: 100,
    fireInterval: 118,
  },
  torpedo: {
    name: "高速魚雷艇",
    width: 46,
    height: 16,
    health: 1,
    speed: 4.25,
    score: 160,
    fireInterval: 0,
  },
  mine: {
    name: "浮上機雷",
    width: 28,
    height: 30,
    health: 1,
    speed: 0.58,
    score: 120,
    fireInterval: 0,
  },
};

// 3ステージ分のデータです。
// start は自機の開始位置、supply は補給ポイント、enemies は敵配置です。
const STAGES = [
  {
    name: "COASTAL TEST AREA",
    start: { x: 180, y: 120 },
    visibilityBonus: 0.28,
    supplies: [
      { x: 690, y: 230 },
    ],
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
    name: "MIDNIGHT TRENCH",
    start: { x: 220, y: 180 },
    visibilityBonus: 0.05,
    supplies: [
      { x: 820, y: 340 },
    ],
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
    name: "BLACK SIGNAL ZONE",
    start: { x: 180, y: 220 },
    visibilityBonus: -0.05,
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
];

// 爆雷、敵弾、爆発、敵、ソナー波、補給ポイントを配列で管理します。
const bombs = [];
const enemyBullets = [];
const explosions = [];
const enemies = [];
const sonarPulses = [];
const supplies = [];

// ------------------------------------------------------------
// キーボード入力
// ------------------------------------------------------------

document.addEventListener("keydown", (event) => {
  if (isGameKey(event.code)) {
    event.preventDefault();
  }

  // キーを押しっぱなしにしたときの連続 keydown を避けます。
  const firstPress = !keys[event.code];
  keys[event.code] = true;

  if (!firstPress) {
    return;
  }

  if (event.code === "Space" && game.state === "playing") {
    dropBomb();
  }

  if (isSonarKey(event.code) && game.state === "playing") {
    activateSonar();
  }

  if (event.code === "KeyR" && (game.state === "gameover" || game.state === "complete")) {
    resetGame();
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
    code === "ShiftLeft" ||
    code === "ShiftRight" ||
    code === "Space" ||
    code === "KeyR"
  );
}

function isSonarKey(code) {
  return code === "KeyE" || code === "ShiftLeft" || code === "ShiftRight";
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

  if (game.state === "playing") {
    updatePlaying(frameScale);
  } else {
    updateNonPlaying(frameScale);
  }

  draw();
  requestAnimationFrame(gameLoop);
}

// ------------------------------------------------------------
// 更新処理
// ------------------------------------------------------------

function updatePlaying(frameScale) {
  updatePlayer(frameScale);
  updateCamera(frameScale);
  updateBombs(frameScale);
  updateEnemies(frameScale);
  updateEnemyBullets(frameScale);
  updateSupplies(frameScale);
  updateSonar(frameScale);
  updateExplosions(frameScale);
  updateTimers(frameScale);
  checkCollisions();
}

function updateNonPlaying(frameScale) {
  // クリアやゲームオーバー中も、爆発とソナー波は少しだけ動かします。
  updateCamera(frameScale);
  updateSonar(frameScale);
  updateExplosions(frameScale);
  updateTimers(frameScale);

  if (game.state === "clear") {
    game.clearTimer -= frameScale;

    if (game.clearTimer <= 0) {
      advanceStage();
    }
  }
}

function updateTimers(frameScale) {
  if (game.bombCooldown > 0) {
    game.bombCooldown -= frameScale;
  }

  if (game.sonarCooldown > 0) {
    game.sonarCooldown -= frameScale;
  }

  if (game.statusTimer > 0) {
    game.statusTimer -= frameScale;
  }

  if (player.invincibleTimer > 0) {
    player.invincibleTimer -= frameScale;
  }
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

  // 水上艦のイメージを保つため、上部〜中段を主な行動範囲にします。
  // ただし探索感を出すため、かなり下の深度まで入れるようにしています。
  const halfWidth = player.width / 2;
  const halfHeight = player.height / 2;
  player.x = clamp(player.x, halfWidth + 20, WORLD_WIDTH - halfWidth - 20);
  player.y = clamp(player.y, halfHeight + 56, WORLD_HEIGHT - 220);
}

function updateCamera(frameScale) {
  // 自機を画面中央より少し上に置くと、下方向の海域と爆雷の落下が見やすくなります。
  const targetX = player.x - SCREEN_WIDTH * 0.44;
  const targetY = player.y - SCREEN_HEIGHT * 0.30;
  const followRate = Math.min(1, 0.14 * frameScale);

  cameraX += (targetX - cameraX) * followRate;
  cameraY += (targetY - cameraY) * followRate;

  // カメラはワールド外を映さないように制限します。
  cameraX = clamp(cameraX, 0, WORLD_WIDTH - SCREEN_WIDTH);
  cameraY = clamp(cameraY, 0, WORLD_HEIGHT - SCREEN_HEIGHT);
}

function dropBomb() {
  if (game.ammo <= 0) {
    setStatus("NO DEPTH CHARGES", 90);
    return;
  }

  if (game.bombCooldown > 0 || bombs.length >= 6) {
    return;
  }

  bombs.push({
    x: player.x,
    y: player.y + player.height / 2 + 6,
    width: 8,
    height: 14,
    baseSpeed: 2.45,
  });

  game.ammo -= 1;
  game.bombCooldown = 16;
}

function updateBombs(frameScale) {
  for (const bomb of bombs) {
    // 深いほど水圧・抵抗が強い、というゲーム的な扱いで少し沈降を遅くします。
    const depthDrag = 1 - getDepthFactor(bomb.y) * 0.42;
    bomb.y += bomb.baseSpeed * depthDrag * frameScale;
  }

  // 画面外でも、ワールド内にある爆雷は判定を続けます。
  removeWhere(bombs, (bomb) => bomb.y > WORLD_HEIGHT + 30);
}

function updateEnemies(frameScale) {
  for (const enemy of enemies) {
    if (!enemy.alive) {
      continue;
    }

    if (enemy.detectedTimer > 0) {
      enemy.detectedTimer -= frameScale;
    }

    if (enemy.pingTimer > 0) {
      enemy.pingTimer -= frameScale;
    }

    if (enemy.type === "drone") {
      updateDrone(enemy, frameScale);
    }

    if (enemy.type === "torpedo") {
      updateTorpedo(enemy, frameScale);
    }

    if (enemy.type === "mine") {
      updateMine(enemy, frameScale);
    }
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

  // ドローンは自機が近いときだけ弾を撃ちます。
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
  // 浮上機雷はゆっくり上へ移動し、少し左右に揺れます。
  enemy.phase += 0.045 * frameScale;
  enemy.y -= enemy.speed * frameScale;
  enemy.x += Math.sin(enemy.phase) * 0.18 * frameScale;

  if (enemy.y < enemy.patrolTop) {
    enemy.y = enemy.patrolTop;
  }
}

function fireEnemyBullet(enemy) {
  enemyBullets.push({
    x: enemy.x,
    y: enemy.y - enemy.height / 2 - 8,
    width: 6,
    height: 12,
    speed: 2.85,
  });
}

function updateEnemyBullets(frameScale) {
  for (const bullet of enemyBullets) {
    bullet.y -= bullet.speed * frameScale;
  }

  removeWhere(enemyBullets, (bullet) => bullet.y < -30);
}

function updateSupplies(frameScale) {
  for (const supply of supplies) {
    if (supply.cooldown > 0) {
      supply.cooldown -= frameScale;
    }

    if (supply.flashTimer > 0) {
      supply.flashTimer -= frameScale;
    }

    const nearSupply = distance(player.x, player.y, supply.x, supply.y) <= SUPPLY_RADIUS;
    const needsSupply = game.ammo < MAX_AMMO || game.lives < MAX_LIVES;

    if (nearSupply && needsSupply && supply.cooldown <= 0) {
      game.ammo = MAX_AMMO;

      if (game.lives < MAX_LIVES) {
        game.lives += 1;
      }

      supply.cooldown = 260;
      supply.flashTimer = 90;
      setStatus("SUPPLIED", 100);
    }
  }
}

function activateSonar() {
  if (game.sonarCooldown > 0) {
    setStatus("SONAR CHARGING", 55);
    return;
  }

  game.sonarCooldown = SONAR_COOLDOWN;

  sonarPulses.push({
    x: player.x,
    y: player.y,
    radius: 16,
    maxRadius: SONAR_RANGE,
    life: 62,
    maxLife: 62,
  });

  let detectedCount = 0;

  for (const enemy of enemies) {
    if (!enemy.alive) {
      continue;
    }

    if (distance(player.x, player.y, enemy.x, enemy.y) <= SONAR_RANGE) {
      enemy.detectedTimer = SONAR_REVEAL_TIME;
      enemy.pingTimer = SONAR_PING_TIME;
      detectedCount += 1;
    }
  }

  setStatus(detectedCount > 0 ? `SONAR CONTACT x${detectedCount}` : "NO CONTACT", 95);
}

function updateSonar(frameScale) {
  for (const pulse of sonarPulses) {
    pulse.life -= frameScale;
    const progress = 1 - pulse.life / pulse.maxLife;
    pulse.radius = 16 + (pulse.maxRadius - 16) * clamp(progress, 0, 1);
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

      if (isColliding(bombBox, getBox(enemy))) {
        bombs.splice(bombIndex, 1);
        hitEnemy(enemy);
        break;
      }
    }
  }
}

function hitEnemy(enemy) {
  enemy.health -= 1;
  enemy.detectedTimer = Math.max(enemy.detectedTimer, 120);
  enemy.pingTimer = Math.max(enemy.pingTimer, 42);
  addExplosion(enemy.x, enemy.y, 7, 1.4, "#ffec7a");

  if (enemy.health <= 0) {
    destroyEnemy(enemy, true);
  }
}

function destroyEnemy(enemy, addScore) {
  enemy.alive = false;

  if (addScore) {
    game.score += enemy.score;
  }

  addExplosion(enemy.x, enemy.y, 13, 2.2, enemy.type === "mine" ? "#ffec7a" : "#ff6b6b");
  addExplosion(enemy.x - 12, enemy.y + 5, 8, 1.5, "#d8f7ff");
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
      addExplosion(enemy.x, enemy.y, 16, 2.4, "#ffec7a");
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
  addExplosion(player.x, player.y, 10, 2.0, "#7cf5ff");

  if (game.lives <= 0) {
    game.state = "gameover";
    setStatus("SIGNAL LOST", 120);
  }
}

function checkStageClear() {
  if (game.state !== "playing") {
    return;
  }

  const remainingEnemies = enemies.some((enemy) => enemy.alive);

  if (!remainingEnemies) {
    game.state = "clear";
    game.clearTimer = CLEAR_DELAY;
    enemyBullets.length = 0;
    setStatus("STAGE CLEAR", 140);
  }
}

function advanceStage() {
  if (game.stageIndex >= STAGES.length - 1) {
    game.state = "complete";
    setStatus("ALL SIGNALS CLEAR", 180);
    return;
  }

  loadStage(game.stageIndex + 1, true);
}

// ------------------------------------------------------------
// 描画処理
// ------------------------------------------------------------

function draw() {
  ctx.imageSmoothingEnabled = false;

  drawBackground();
  drawSupplies();
  drawBombs();
  drawEnemies();
  drawEnemyBullets();
  drawPlayer();
  drawSonarPulses();
  drawExplosions();
  drawDepthOverlay();
  drawHud();
  drawMinimap();
  drawControlHelp();
  drawScanlines();

  if (game.state === "gameover") {
    drawCenteredMessage("GAME OVER", `FINAL SCORE ${padScore(game.score)}`, "PRESS R TO RESTART");
  }

  if (game.state === "clear") {
    drawCenteredMessage("STAGE CLEAR", `NEXT STAGE IN ${Math.ceil(game.clearTimer / 60)}`, "");
  }

  if (game.state === "complete") {
    drawCenteredMessage("ALL SIGNALS CLEAR", `FINAL SCORE ${padScore(game.score)}`, "PRESS R TO RESTART");
  }
}

function drawBackground() {
  const deep = getDepthFactor(cameraY + SCREEN_HEIGHT * 0.5);
  ctx.fillStyle = lerpColor("#082235", "#02070d", deep);
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  drawSurfaceLines();
  drawSeaGrid();
  drawDepthLines();
  drawBackgroundMarkers();
  drawSeafloor();
  drawWorldBorder();
}

function drawSurfaceLines() {
  const surfaceY = Math.round(96 - cameraY);

  if (surfaceY < -40 || surfaceY > SCREEN_HEIGHT + 40) {
    return;
  }

  ctx.fillStyle = "#10324a";
  ctx.fillRect(0, surfaceY, SCREEN_WIDTH, 4);
  ctx.fillRect(0, surfaceY + 8, SCREEN_WIDTH, 2);

  ctx.fillStyle = "rgba(124, 245, 255, 0.35)";
  for (let x = -40; x < SCREEN_WIDTH + 40; x += 56) {
    ctx.fillRect(Math.round(x - (cameraX % 56)), surfaceY - 6, 28, 2);
  }
}

function drawSeaGrid() {
  ctx.strokeStyle = "rgba(82, 205, 225, 0.13)";
  ctx.lineWidth = 1;

  const gridSize = 80;
  const startX = Math.floor(cameraX / gridSize) * gridSize;
  const endX = cameraX + SCREEN_WIDTH;

  for (let worldX = startX; worldX <= endX; worldX += gridSize) {
    const screenX = Math.round(worldX - cameraX);
    ctx.beginPath();
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, SCREEN_HEIGHT);
    ctx.stroke();
  }

  const startY = Math.floor(cameraY / gridSize) * gridSize;
  const endY = cameraY + SCREEN_HEIGHT;

  for (let worldY = startY; worldY <= endY; worldY += gridSize) {
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
  ctx.fillStyle = "rgba(216, 247, 255, 0.55)";
  ctx.strokeStyle = "rgba(216, 247, 255, 0.18)";
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

    ctx.fillStyle = "rgba(124, 245, 255, 0.22)";
    ctx.fillRect(x - 12, y, 24, 2);
    ctx.fillRect(x, y - 12, 2, 24);
    ctx.fillStyle = "rgba(124, 245, 255, 0.48)";
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
  ctx.fillStyle = "#0d2b35";
  ctx.fill();

  ctx.strokeStyle = "#1c5462";
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
  ctx.strokeStyle = "rgba(255, 236, 122, 0.45)";
  ctx.lineWidth = 2;

  const left = Math.round(-cameraX);
  const right = Math.round(WORLD_WIDTH - cameraX);
  const top = Math.round(-cameraY);
  const bottom = Math.round(WORLD_HEIGHT - cameraY);

  if (left >= -4 && left <= SCREEN_WIDTH + 4) {
    ctx.beginPath();
    ctx.moveTo(left, 0);
    ctx.lineTo(left, SCREEN_HEIGHT);
    ctx.stroke();
  }

  if (right >= -4 && right <= SCREEN_WIDTH + 4) {
    ctx.beginPath();
    ctx.moveTo(right, 0);
    ctx.lineTo(right, SCREEN_HEIGHT);
    ctx.stroke();
  }

  if (top >= -4 && top <= SCREEN_HEIGHT + 4) {
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(SCREEN_WIDTH, top);
    ctx.stroke();
  }

  if (bottom >= -4 && bottom <= SCREEN_HEIGHT + 4) {
    ctx.beginPath();
    ctx.moveTo(0, bottom);
    ctx.lineTo(SCREEN_WIDTH, bottom);
    ctx.stroke();
  }
}

function drawSupplies() {
  for (const supply of supplies) {
    if (!isPointVisible(supply.x, supply.y, 80)) {
      continue;
    }

    const x = Math.round(supply.x - cameraX);
    const y = Math.round(supply.y - cameraY);
    const flash = supply.flashTimer > 0 && Math.floor(supply.flashTimer / 8) % 2 === 0;

    ctx.fillStyle = flash ? "#ffffff" : "#6dff9b";
    ctx.fillRect(x - 14, y - 10, 28, 20);
    ctx.fillStyle = "#103829";
    ctx.fillRect(x - 9, y - 5, 18, 10);
    ctx.fillStyle = "#6dff9b";
    ctx.fillRect(x - 2, y - 15, 4, 30);
    ctx.fillRect(x - 17, y - 2, 34, 4);
  }
}

function drawBombs() {
  for (const bomb of bombs) {
    if (!isObjectVisible(bomb, 40)) {
      continue;
    }

    const x = Math.round(bomb.x - cameraX);
    const y = Math.round(bomb.y - cameraY);

    ctx.fillStyle = "#d8f7ff";
    ctx.fillRect(x - 3, y - 7, 6, 14);
    ctx.fillStyle = "#7cf5ff";
    ctx.fillRect(x - 6, y + 5, 12, 3);
    ctx.fillStyle = "#ffec7a";
    ctx.fillRect(x - 2, y - 10, 4, 3);
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

  if (enemy.type === "drone") {
    drawDrone(enemy);
  }

  if (enemy.type === "torpedo") {
    drawTorpedo(enemy);
  }

  if (enemy.type === "mine") {
    drawMine(enemy);
  }

  ctx.restore();
}

function drawEnemyShadow(enemy, visibility) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);
  const shadowAlpha = clamp(visibility + 0.08, 0.12, 0.28);

  ctx.save();
  ctx.globalAlpha = shadowAlpha;
  ctx.shadowColor = "rgba(124, 245, 255, 0.35)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#0a131a";
  ctx.fillRect(x - enemy.width / 2 - 4, y - enemy.height / 2 - 2, enemy.width + 8, enemy.height + 4);
  ctx.fillStyle = "rgba(124, 245, 255, 0.16)";
  ctx.fillRect(x - enemy.width / 2, y - 2, enemy.width, 4);
  ctx.restore();
}

function drawEnemyPingOutline(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);
  const alpha = clamp(enemy.pingTimer / SONAR_PING_TIME, 0, 1);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#7cf5ff";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    Math.round(x - enemy.width / 2 - 5),
    Math.round(y - enemy.height / 2 - 5),
    enemy.width + 10,
    enemy.height + 10
  );
  ctx.fillStyle = "#7cf5ff";
  ctx.fillRect(x - 2, y - enemy.height / 2 - 12, 4, 8);
  ctx.restore();
}

function drawDrone(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);

  ctx.fillStyle = "#ff6b6b";
  ctx.fillRect(x - 29, y - 9, 58, 18);
  ctx.fillStyle = "#ff9b7a";
  ctx.fillRect(x - 20, y - 16, 34, 7);
  ctx.fillRect(x - 13, y + 9, 26, 7);
  ctx.fillStyle = "#ffec7a";
  ctx.fillRect(x + enemy.direction * 21 - 3, y - 3, 6, 6);
  ctx.fillStyle = "#b93046";
  ctx.fillRect(x - 40, y - 3, 11, 6);
  ctx.fillRect(x + 29, y - 3, 11, 6);
}

function drawTorpedo(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);

  ctx.fillStyle = "#f5a742";
  ctx.fillRect(x - 22, y - 6, 44, 12);
  ctx.fillStyle = "#ffec7a";
  ctx.fillRect(x + enemy.direction * 17 - 3, y - 3, 6, 6);
  ctx.fillStyle = "#8f4b24";
  ctx.fillRect(x - enemy.direction * 25 - 4, y - 8, 8, 16);
  ctx.fillRect(x - 7, y + 6, 14, 5);
}

function drawMine(enemy) {
  const x = Math.round(enemy.x - cameraX);
  const y = Math.round(enemy.y - cameraY);

  ctx.fillStyle = "#c8d36b";
  ctx.fillRect(x - 10, y - 10, 20, 20);
  ctx.fillStyle = "#ffec7a";
  ctx.fillRect(x - 5, y - 5, 10, 10);
  ctx.fillStyle = "#758044";
  ctx.fillRect(x - 2, y - 18, 4, 8);
  ctx.fillRect(x - 2, y + 10, 4, 8);
  ctx.fillRect(x - 18, y - 2, 8, 4);
  ctx.fillRect(x + 10, y - 2, 8, 4);
}

function drawEnemyBullets() {
  for (const bullet of enemyBullets) {
    if (!isObjectVisible(bullet, 40)) {
      continue;
    }

    const x = Math.round(bullet.x - cameraX);
    const y = Math.round(bullet.y - cameraY);

    ctx.fillStyle = "#ffec7a";
    ctx.fillRect(x - 3, y - 6, 6, 12);
    ctx.fillStyle = "#ff6b6b";
    ctx.fillRect(x - 2, y - 9, 4, 3);
  }
}

function drawPlayer() {
  if (player.invincibleTimer > 0 && Math.floor(player.invincibleTimer / 8) % 2 === 0) {
    return;
  }

  const x = Math.round(player.x - cameraX);
  const y = Math.round(player.y - cameraY);

  ctx.fillStyle = "#7cf5ff";
  ctx.fillRect(x - 32, y - 5, 64, 10);
  ctx.fillRect(x - 24, y + 5, 48, 7);
  ctx.fillStyle = "#c9fbff";
  ctx.fillRect(x + 26, y - 2, 12, 7);
  ctx.fillStyle = "#4bb6c5";
  ctx.fillRect(x - 39, y - 2, 10, 7);
  ctx.fillStyle = "#d8f7ff";
  ctx.fillRect(x - 8, y - 18, 22, 13);
  ctx.fillStyle = "#12394d";
  ctx.fillRect(x - 3, y - 15, 6, 5);
  ctx.fillRect(x + 6, y - 15, 6, 5);
  ctx.fillStyle = "#ffec7a";
  ctx.fillRect(x + 16, y - 26, 3, 10);
  ctx.fillRect(x + 12, y - 28, 10, 2);
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
    ctx.strokeStyle = `rgba(124, 245, 255, ${0.65 * alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, pulse.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 236, 122, ${0.35 * alpha})`;
    ctx.lineWidth = 1;
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

    ctx.fillStyle = explosion.color;
    ctx.fillRect(x - r, y - 2, r * 2, 4);
    ctx.fillRect(x - 2, y - r, 4, r * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 3, y - 3, 6, 6);
  }
}

function drawDepthOverlay() {
  // 自機の深度が深いほど、画面全体を少し暗くします。
  const deep = getDepthFactor(player.y);
  ctx.fillStyle = `rgba(0, 4, 10, ${0.08 + deep * 0.36})`;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  ctx.fillStyle = `rgba(0, 32, 46, ${deep * 0.18})`;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
}

function drawHud() {
  ctx.fillStyle = "#031018";
  ctx.fillRect(0, 0, SCREEN_WIDTH, 70);

  ctx.fillStyle = "#7cf5ff";
  ctx.font = "16px 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`SCORE ${padScore(game.score)}`, 18, 18);
  ctx.fillText(`LIVES ${game.lives}`, 188, 18);
  ctx.fillText(`AMMO ${game.ammo}/${MAX_AMMO}`, 292, 18);
  ctx.fillText(`DEPTH: ${Math.round(player.y)}m`, 420, 18);

  ctx.fillStyle = "#d8f7ff";
  ctx.fillText(`STAGE ${game.stageIndex + 1}: ${game.stageName}`, 18, 46);

  const sonarText = game.sonarCooldown <= 0
    ? "SONAR READY"
    : `SONAR CHARGING ${Math.ceil(game.sonarCooldown / 60)}`;

  ctx.fillStyle = game.sonarCooldown <= 0 ? "#6dff9b" : "#ffec7a";
  ctx.fillText(sonarText, 420, 46);

  if (game.ammo <= 0) {
    ctx.fillStyle = "#ff6b6b";
    ctx.fillText("NO DEPTH CHARGES", 615, 46);
  } else if (game.statusTimer > 0) {
    ctx.fillStyle = "#ffec7a";
    ctx.fillText(game.statusText, 615, 46);
  }
}

function drawMinimap() {
  const mapWidth = 154;
  const mapHeight = 78;
  const mapX = SCREEN_WIDTH - mapWidth - 18;
  const mapY = 84;
  const scaleX = mapWidth / WORLD_WIDTH;
  const scaleY = mapHeight / WORLD_HEIGHT;

  ctx.fillStyle = "rgba(3, 16, 24, 0.9)";
  ctx.fillRect(mapX, mapY, mapWidth, mapHeight);
  ctx.strokeStyle = "#7cf5ff";
  ctx.lineWidth = 2;
  ctx.strokeRect(mapX, mapY, mapWidth, mapHeight);

  // ステージ端はミニマップの外枠で分かるようにし、カメラ範囲も表示します。
  ctx.strokeStyle = "rgba(216, 247, 255, 0.7)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    Math.round(mapX + cameraX * scaleX),
    Math.round(mapY + cameraY * scaleY),
    Math.round(SCREEN_WIDTH * scaleX),
    Math.round(SCREEN_HEIGHT * scaleY)
  );

  // 補給ポイントは常に表示します。
  for (const supply of supplies) {
    ctx.fillStyle = "#6dff9b";
    ctx.fillRect(
      Math.round(mapX + supply.x * scaleX) - 2,
      Math.round(mapY + supply.y * scaleY) - 2,
      5,
      5
    );
  }

  // 敵は「浅い敵」または「ソナー発見済み」を優先表示します。
  // 深い未発見敵は、ほぼ見えない薄い点にします。
  for (const enemy of enemies) {
    if (!enemy.alive) {
      continue;
    }

    const mapAlpha = getEnemyMapAlpha(enemy);

    if (mapAlpha <= 0) {
      continue;
    }

    ctx.save();
    ctx.globalAlpha = mapAlpha;
    ctx.fillStyle = getEnemyMapColor(enemy.type);
    ctx.fillRect(
      Math.round(mapX + enemy.x * scaleX) - 2,
      Math.round(mapY + enemy.y * scaleY) - 2,
      4,
      4
    );
    ctx.restore();
  }

  ctx.fillStyle = "#7cf5ff";
  ctx.fillRect(
    Math.round(mapX + player.x * scaleX) - 3,
    Math.round(mapY + player.y * scaleY) - 3,
    6,
    6
  );
}

function drawControlHelp() {
  ctx.fillStyle = "rgba(3, 16, 24, 0.88)";
  ctx.fillRect(0, SCREEN_HEIGHT - 34, SCREEN_WIDTH, 34);
  ctx.fillStyle = "#d8f7ff";
  ctx.font = "14px 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("MOVE: Arrow/WASD   DEPTH CHARGE: Space   SONAR: E/Shift   RESTART: R", 18, SCREEN_HEIGHT - 17);
}

function drawScanlines() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";

  for (let y = 0; y < SCREEN_HEIGHT; y += 4) {
    ctx.fillRect(0, y, SCREEN_WIDTH, 1);
  }
}

function drawCenteredMessage(title, subtitle, prompt) {
  ctx.fillStyle = "rgba(3, 8, 13, 0.78)";
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = title === "GAME OVER" ? "#ff6b6b" : "#7cf5ff";
  ctx.font = "42px 'Courier New', monospace";
  ctx.fillText(title, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 34);

  ctx.fillStyle = "#d8f7ff";
  ctx.font = "20px 'Courier New', monospace";
  ctx.fillText(subtitle, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 22);

  if (prompt) {
    ctx.fillText(prompt, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 62);
  }

  ctx.textAlign = "left";
}

// ------------------------------------------------------------
// ステージと便利関数
// ------------------------------------------------------------

function createEnemy(layout, index) {
  const base = ENEMY_TYPES[layout.type];
  const patrolPadding = layout.type === "torpedo" ? 320 : 210;

  return {
    id: index,
    type: layout.type,
    name: base.name,
    x: layout.x,
    y: layout.y,
    width: base.width,
    height: base.height,
    health: base.health,
    maxHealth: base.health,
    speed: base.speed,
    score: base.score,
    direction: layout.direction || 1,
    alive: true,
    fireInterval: base.fireInterval + (index % 3) * 16,
    fireTimer: 50 + index * 13,
    patrolLeft: Math.max(base.width / 2, layout.patrolLeft || layout.x - patrolPadding),
    patrolRight: Math.min(WORLD_WIDTH - base.width / 2, layout.patrolRight || layout.x + patrolPadding),
    patrolTop: layout.patrolTop || 260,
    phase: index * 0.8,
    detectedTimer: layout.initiallyDetected ? SONAR_REVEAL_TIME : 0,
    pingTimer: 0,
  };
}

function loadStage(stageIndex, keepPlayerResources) {
  const stage = STAGES[stageIndex];

  game.stageIndex = stageIndex;
  game.stageName = stage.name;
  game.state = "playing";
  game.clearTimer = 0;
  game.bombCooldown = 0;
  game.sonarCooldown = 0;
  game.statusText = "";
  game.statusTimer = 0;

  if (!keepPlayerResources) {
    game.score = 0;
    game.lives = MAX_LIVES;
    game.ammo = MAX_AMMO;
  } else {
    game.ammo = MAX_AMMO;
  }

  player.x = stage.start.x;
  player.y = stage.start.y;
  player.invincibleTimer = 0;

  cameraX = clamp(player.x - SCREEN_WIDTH * 0.44, 0, WORLD_WIDTH - SCREEN_WIDTH);
  cameraY = clamp(player.y - SCREEN_HEIGHT * 0.30, 0, WORLD_HEIGHT - SCREEN_HEIGHT);

  bombs.length = 0;
  enemyBullets.length = 0;
  explosions.length = 0;
  sonarPulses.length = 0;

  enemies.length = 0;
  for (let i = 0; i < stage.enemies.length; i += 1) {
    enemies.push(createEnemy(stage.enemies[i], i));
  }

  supplies.length = 0;
  for (let i = 0; i < stage.supplies.length; i += 1) {
    supplies.push({
      x: stage.supplies[i].x,
      y: stage.supplies[i].y,
      cooldown: 0,
      flashTimer: 0,
    });
  }

  setStatus(`ENTER ${stage.name}`, 130);
}

function resetGame() {
  game.lastTime = 0;
  loadStage(0, false);
}

function getCurrentStage() {
  return STAGES[game.stageIndex];
}

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

function setStatus(text, duration) {
  game.statusText = text;
  game.statusTimer = duration;
}

function getEnemyVisibility(enemy) {
  if (enemy.detectedTimer > 0) {
    return 1;
  }

  if (enemy.pingTimer > 0) {
    return 0.78;
  }

  // Y座標が大きいほど深い海域として扱います。
  // 深いほど敵は暗くなり、ステージごとの視界補正も加えます。
  const depth = getDepthFactor(enemy.y);
  const stageBonus = getCurrentStage().visibilityBonus;
  const visibility = 1 - depth * 0.92 + stageBonus;
  return clamp(visibility, 0.12, 1);
}

function getEnemyMapAlpha(enemy) {
  if (enemy.detectedTimer > 0) {
    return 1;
  }

  if (enemy.y < 440) {
    return 0.78;
  }

  if (enemy.y < 760) {
    return 0.22;
  }

  return 0.06;
}

function getDepthFactor(worldY) {
  return clamp((worldY - 180) / 860, 0, 1);
}

function getSeafloorY(worldX) {
  return (
    WORLD_HEIGHT -
    94 +
    Math.sin(worldX * 0.006) * 18 +
    Math.sin(worldX * 0.018) * 7
  );
}

function getEnemyMapColor(type) {
  if (type === "drone") {
    return "#ff6b6b";
  }

  if (type === "torpedo") {
    return "#f5a742";
  }

  return "#ffec7a";
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
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  );
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function padScore(score) {
  return String(score).padStart(6, "0");
}

function lerpColor(from, to, amount) {
  const a = parseHexColor(from);
  const b = parseHexColor(to);
  const r = Math.round(a.r + (b.r - a.r) * amount);
  const g = Math.round(a.g + (b.g - a.g) * amount);
  const blue = Math.round(a.b + (b.b - a.b) * amount);
  return `rgb(${r}, ${g}, ${blue})`;
}

function parseHexColor(hex) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

// ブラウザ確認用の読み取り専用に近いデバッグ窓です。
// 通常のプレイには影響しません。
window.__deepSignalDebug = {
  getState() {
    return {
      stageIndex: game.stageIndex,
      stageName: game.stageName,
      state: game.state,
      score: game.score,
      lives: game.lives,
      ammo: game.ammo,
      sonarCooldown: game.sonarCooldown,
      playerX: player.x,
      playerY: player.y,
      cameraX,
      cameraY,
      bombs: bombs.length,
      enemiesAlive: enemies.filter((enemy) => enemy.alive).length,
      supplies: supplies.map((supply) => ({ x: supply.x, y: supply.y, cooldown: supply.cooldown })),
    };
  },
};

// 初期ステージを読み込んでからゲームを開始します。
loadStage(0, false);
requestAnimationFrame(gameLoop);
