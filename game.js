// ============================================================
// DEEP SIGNAL
// レトロPC風 2Dシューティングの探索型プロトタイプです。
// 画像素材は使わず、canvas の図形描画だけで作っています。
// ============================================================

// canvas と描画用コンテキストを取得します。
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// canvas の表示範囲です。画面サイズは仕様どおり 800 x 600 のままです。
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

// ゲーム内の広い海域です。画面はこの一部だけをカメラで表示します。
const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1200;

// requestAnimationFrame は環境によって少し速度が変わるため、
// 60fps を基準にした倍率に直してから移動量へ使います。
const BASE_FRAME_MS = 1000 / 60;

// 押されているキーを記録します。
// 例: keys.ArrowLeft が true なら左キーが押されています。
const keys = {};

// カメラ位置です。world座標のどこを画面左上として表示するかを表します。
// ユーザーが改造しやすいよう、cameraX / cameraY という名前で分けています。
let cameraX = 0;
let cameraY = 0;

// ゲーム全体の状態です。
const game = {
  score: 0,
  lives: 3,
  stageName: "ABYSSAL GRID",
  state: "playing", // "playing", "clear", "gameover"
  bombCooldown: 0,
  lastTime: 0,
};

// プレイヤーの調査船です。x, y はワールド座標の中心位置です。
// 水上艦のイメージを保つため、縦方向はワールドの上部〜中段寄りに制限します。
const player = {
  x: 180,
  y: 120,
  width: 66,
  height: 22,
  speed: 4.4,
  invincibleTimer: 0,
};

// 敵の種類ごとの基本設定です。
// 数値を変えると、敵の大きさ・速さ・得点を簡単に調整できます。
const ENEMY_TYPES = {
  drone: {
    name: "潜水ドローン",
    width: 58,
    height: 24,
    health: 2,
    speed: 1.25,
    score: 100,
    fireInterval: 115,
  },
  torpedo: {
    name: "高速魚雷艇",
    width: 46,
    height: 16,
    health: 1,
    speed: 4.15,
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

// ステージに置く敵です。2400x1200 のワールド内に散らしてあります。
// patrolLeft / patrolRight は左右移動する敵の移動範囲です。
const STAGE_ENEMY_LAYOUT = [
  { type: "drone", x: 430, y: 520, direction: 1, patrolLeft: 280, patrolRight: 690 },
  { type: "torpedo", x: 760, y: 720, direction: -1, patrolLeft: 430, patrolRight: 1080 },
  { type: "mine", x: 350, y: 1030, patrolTop: 640 },
  { type: "drone", x: 1040, y: 430, direction: -1, patrolLeft: 860, patrolRight: 1240 },
  { type: "mine", x: 1250, y: 980, patrolTop: 590 },
  { type: "torpedo", x: 1450, y: 850, direction: 1, patrolLeft: 1160, patrolRight: 1740 },
  { type: "drone", x: 1680, y: 610, direction: 1, patrolLeft: 1460, patrolRight: 1910 },
  { type: "torpedo", x: 2020, y: 460, direction: -1, patrolLeft: 1780, patrolRight: 2260 },
  { type: "mine", x: 2130, y: 1040, patrolTop: 690 },
  { type: "drone", x: 2210, y: 770, direction: -1, patrolLeft: 1950, patrolRight: 2320 },
];

// 背景の目印です。広い海域を移動している感じを出すための小さな固定物です。
const BACKGROUND_MARKERS = [
  { x: 520, y: 340, label: "SIG-01" },
  { x: 980, y: 760, label: "NODE-A" },
  { x: 1520, y: 520, label: "PING" },
  { x: 1960, y: 930, label: "RELAY" },
  { x: 2260, y: 300, label: "SIG-02" },
];

// 爆雷、敵弾、爆発エフェクト、敵本体は配列で管理します。
const bombs = [];
const enemyBullets = [];
const explosions = [];
const enemies = [];

// ------------------------------------------------------------
// キーボード入力
// ------------------------------------------------------------

document.addEventListener("keydown", (event) => {
  // ブラウザのスクロールを防ぎ、ゲーム操作を優先します。
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

  if (event.code === "Enter" && game.state !== "playing") {
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
    code === "Space" ||
    code === "Enter"
  );
}

// ------------------------------------------------------------
// メインループ
// ------------------------------------------------------------

function gameLoop(timestamp) {
  // 初回だけ lastTime を現在時刻に合わせます。
  if (!game.lastTime) {
    game.lastTime = timestamp;
  }

  // frameScale は「60fps の何フレーム分進んだか」です。
  // タブ復帰直後などに大きく飛ばないよう、最大値を制限します。
  const elapsed = Math.min(timestamp - game.lastTime, 48);
  const frameScale = elapsed / BASE_FRAME_MS;
  game.lastTime = timestamp;

  if (game.state === "playing") {
    update(frameScale);
  } else {
    updateExplosions(frameScale);
  }

  draw();
  requestAnimationFrame(gameLoop);
}

// ------------------------------------------------------------
// 更新処理
// ------------------------------------------------------------

function update(frameScale) {
  updatePlayer(frameScale);
  updateCamera(frameScale);
  updateBombs(frameScale);
  updateEnemies(frameScale);
  updateEnemyBullets(frameScale);
  updateExplosions(frameScale);
  checkCollisions();

  // 爆雷を連打しすぎないようにするための短い待ち時間です。
  if (game.bombCooldown > 0) {
    game.bombCooldown -= frameScale;
  }

  if (player.invincibleTimer > 0) {
    player.invincibleTimer -= frameScale;
  }
}

function updatePlayer(frameScale) {
  // 左右移動。矢印キーと A/D キーの両方に対応しています。
  if (keys.ArrowLeft || keys.KeyA) {
    player.x -= player.speed * frameScale;
  }

  if (keys.ArrowRight || keys.KeyD) {
    player.x += player.speed * frameScale;
  }

  // 上下移動。水上艦らしく、ワールドの上部〜中段を主な移動範囲にしています。
  if (keys.ArrowUp || keys.KeyW) {
    player.y -= player.speed * frameScale;
  }

  if (keys.ArrowDown || keys.KeyS) {
    player.y += player.speed * frameScale;
  }

  // ワールド外に出ないように中心座標を制限します。
  const halfWidth = player.width / 2;
  const halfHeight = player.height / 2;
  player.x = clamp(player.x, halfWidth + 20, WORLD_WIDTH - halfWidth - 20);
  player.y = clamp(player.y, halfHeight + 56, WORLD_HEIGHT - 220);
}

function updateCamera(frameScale) {
  // 画面中央より少し上に自機が見えるように追従させます。
  // 下方向の海域が多めに見えるため、爆雷を落とすゲームに向いています。
  const targetX = player.x - SCREEN_WIDTH * 0.44;
  const targetY = player.y - SCREEN_HEIGHT * 0.30;

  // 少しだけ滑らかに追従します。係数を 1 に近づけると硬い追従になります。
  const followRate = Math.min(1, 0.14 * frameScale);
  cameraX += (targetX - cameraX) * followRate;
  cameraY += (targetY - cameraY) * followRate;

  // カメラはワールド外を映さないように制限します。
  cameraX = clamp(cameraX, 0, WORLD_WIDTH - SCREEN_WIDTH);
  cameraY = clamp(cameraY, 0, WORLD_HEIGHT - SCREEN_HEIGHT);
}

function dropBomb() {
  // 広いステージでは少し多めに投下できるよう、同時に5個までにしています。
  if (game.bombCooldown > 0 || bombs.length >= 5) {
    return;
  }

  bombs.push({
    x: player.x,
    y: player.y + player.height / 2 + 6,
    width: 8,
    height: 14,
    speed: 2.15,
  });

  game.bombCooldown = 16;
}

function updateBombs(frameScale) {
  for (const bomb of bombs) {
    // 爆雷はワールド座標で下方向に落下します。
    // 画面外でもワールド内にある間はこのまま判定が続きます。
    bomb.y += bomb.speed * frameScale;
  }

  // ワールド下端を越えた爆雷だけを取り除きます。
  removeWhere(bombs, (bomb) => bomb.y > WORLD_HEIGHT + 30);
}

function updateEnemies(frameScale) {
  for (const enemy of enemies) {
    if (!enemy.alive) {
      continue;
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

  // ドローンは自機がある程度近いときだけ上方向に弾を撃ちます。
  // 遠くの画面外から弾が飛びすぎないようにするためです。
  enemy.fireTimer -= frameScale;

  if (enemy.fireTimer <= 0) {
    if (Math.abs(player.x - enemy.x) < 560 && player.y < enemy.y + 80) {
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
  // 浮上機雷はゆっくり上に移動し、少しだけ左右に揺れます。
  enemy.phase += 0.045 * frameScale;
  enemy.y -= enemy.speed * frameScale;
  enemy.x += Math.sin(enemy.phase) * 0.18 * frameScale;

  // 上がり切ったらその深度で漂わせます。
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

  // ワールド上端を越えた敵弾は配列から取り除きます。
  removeWhere(enemyBullets, (bullet) => bullet.y < -30);
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
  // 被弾後の点滅中は無敵です。
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
  // 被弾後の無敵時間中は、機雷にも当たらないようにします。
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
  }
}

function checkStageClear() {
  if (game.state !== "playing") {
    return;
  }

  const remainingEnemies = enemies.some((enemy) => enemy.alive);

  if (!remainingEnemies) {
    game.state = "clear";
    enemyBullets.length = 0;
  }
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

// ------------------------------------------------------------
// 描画処理
// ------------------------------------------------------------

function draw() {
  // ドット風に見せるため、座標はなるべく整数へ丸めて描画します。
  ctx.imageSmoothingEnabled = false;
  drawBackground();
  drawBombs();
  drawEnemies();
  drawEnemyBullets();
  drawPlayer();
  drawExplosions();
  drawHud();
  drawMinimap();
  drawScanlines();

  if (game.state === "gameover") {
    drawGameOver();
  }

  if (game.state === "clear") {
    drawStageClear();
  }
}

function drawBackground() {
  ctx.fillStyle = "#061725";
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  // ワールド上部に近いときだけ、海面のゆらぎを横線で表示します。
  drawSurfaceLines();

  // 広い海域に見えるよう、ワールド座標に固定されたグリッドを描きます。
  drawSeaGrid();

  // 深度ラインはワールドY座標に合わせて表示します。
  drawDepthLines();

  // 探索用の小さな背景目印です。ゲーム判定には使いません。
  drawBackgroundMarkers();

  // 海底ラインはワールド下部に固定されています。
  drawSeafloor();

  // ワールド端が見えたときに、探索範囲の境界が分かるようにします。
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
  ctx.strokeStyle = "rgba(82, 205, 225, 0.14)";
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
  ctx.fillStyle = "rgba(216, 247, 255, 0.62)";
  ctx.strokeStyle = "rgba(216, 247, 255, 0.22)";
  ctx.lineWidth = 1;

  const lineStep = 160;
  const startY = Math.ceil(cameraY / lineStep) * lineStep;

  for (let worldY = startY; worldY <= cameraY + SCREEN_HEIGHT; worldY += lineStep) {
    const screenY = Math.round(worldY - cameraY);
    ctx.beginPath();
    ctx.moveTo(0, screenY);
    ctx.lineTo(SCREEN_WIDTH, screenY);
    ctx.stroke();
    ctx.fillText(`DEPTH ${String(worldY).padStart(4, "0")}m`, 14, screenY - 10);
  }
}

function drawBackgroundMarkers() {
  ctx.font = "12px 'Courier New', monospace";
  ctx.textBaseline = "top";

  for (const marker of BACKGROUND_MARKERS) {
    if (!isPointVisible(marker.x, marker.y, 40)) {
      continue;
    }

    const x = Math.round(marker.x - cameraX);
    const y = Math.round(marker.y - cameraY);

    ctx.fillStyle = "rgba(124, 245, 255, 0.24)";
    ctx.fillRect(x - 12, y, 24, 2);
    ctx.fillRect(x, y - 12, 2, 24);
    ctx.fillStyle = "rgba(124, 245, 255, 0.54)";
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

function drawHud() {
  ctx.fillStyle = "#031018";
  ctx.fillRect(0, 0, SCREEN_WIDTH, 44);

  ctx.fillStyle = "#7cf5ff";
  ctx.font = "18px 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`SCORE ${padScore(game.score)}`, 24, 23);
  ctx.fillText(`LIVES ${game.lives}`, 270, 23);
  ctx.fillText(`STAGE ${game.stageName}`, 430, 23);
}

function drawPlayer() {
  // 被弾後は点滅させます。無敵時間が分かりやすくなります。
  if (player.invincibleTimer > 0 && Math.floor(player.invincibleTimer / 8) % 2 === 0) {
    return;
  }

  const x = Math.round(player.x - cameraX);
  const y = Math.round(player.y - cameraY);

  // 船体。以前より少し小さくして、広い海域に見えるようにしています。
  ctx.fillStyle = "#7cf5ff";
  ctx.fillRect(x - 32, y - 5, 64, 10);
  ctx.fillRect(x - 24, y + 5, 48, 7);

  // 船首と船尾
  ctx.fillStyle = "#c9fbff";
  ctx.fillRect(x + 26, y - 2, 12, 7);
  ctx.fillStyle = "#4bb6c5";
  ctx.fillRect(x - 39, y - 2, 10, 7);

  // ブリッジ
  ctx.fillStyle = "#d8f7ff";
  ctx.fillRect(x - 8, y - 18, 22, 13);
  ctx.fillStyle = "#12394d";
  ctx.fillRect(x - 3, y - 15, 6, 5);
  ctx.fillRect(x + 6, y - 15, 6, 5);

  // アンテナ
  ctx.fillStyle = "#ffec7a";
  ctx.fillRect(x + 16, y - 26, 3, 10);
  ctx.fillRect(x + 12, y - 28, 10, 2);
}

function drawEnemies() {
  for (const enemy of enemies) {
    if (!enemy.alive || !isObjectVisible(enemy, 80)) {
      continue;
    }

    if (enemy.type === "drone") {
      drawDrone(enemy);
    }

    if (enemy.type === "torpedo") {
      drawTorpedo(enemy);
    }

    if (enemy.type === "mine") {
      drawMine(enemy);
    }
  }
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

function drawMinimap() {
  const mapWidth = 150;
  const mapHeight = 75;
  const mapX = SCREEN_WIDTH - mapWidth - 20;
  const mapY = 58;
  const scaleX = mapWidth / WORLD_WIDTH;
  const scaleY = mapHeight / WORLD_HEIGHT;

  ctx.fillStyle = "rgba(3, 16, 24, 0.88)";
  ctx.fillRect(mapX, mapY, mapWidth, mapHeight);
  ctx.strokeStyle = "#7cf5ff";
  ctx.lineWidth = 2;
  ctx.strokeRect(mapX, mapY, mapWidth, mapHeight);

  // カメラが見ている範囲をミニマップ上の枠で表示します。
  ctx.strokeStyle = "rgba(216, 247, 255, 0.72)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    Math.round(mapX + cameraX * scaleX),
    Math.round(mapY + cameraY * scaleY),
    Math.round(SCREEN_WIDTH * scaleX),
    Math.round(SCREEN_HEIGHT * scaleY)
  );

  // 敵位置。タイプごとに点の色を変えています。
  for (const enemy of enemies) {
    if (!enemy.alive) {
      continue;
    }

    ctx.fillStyle = getEnemyMapColor(enemy.type);
    ctx.fillRect(
      Math.round(mapX + enemy.x * scaleX) - 2,
      Math.round(mapY + enemy.y * scaleY) - 2,
      4,
      4
    );
  }

  // 自機位置はシアンの少し大きい点です。
  ctx.fillStyle = "#7cf5ff";
  ctx.fillRect(
    Math.round(mapX + player.x * scaleX) - 3,
    Math.round(mapY + player.y * scaleY) - 3,
    6,
    6
  );
}

function drawScanlines() {
  // CRT風の走査線です。薄く重ねるだけなので処理は軽いです。
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";

  for (let y = 0; y < SCREEN_HEIGHT; y += 4) {
    ctx.fillRect(0, y, SCREEN_WIDTH, 1);
  }
}

function drawGameOver() {
  drawCenteredMessage("GAME OVER", `FINAL SCORE ${padScore(game.score)}`);
}

function drawStageClear() {
  drawCenteredMessage("STAGE CLEAR", `SCORE ${padScore(game.score)}`);
}

function drawCenteredMessage(title, subtitle) {
  ctx.fillStyle = "rgba(3, 8, 13, 0.76)";
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = title === "STAGE CLEAR" ? "#7cf5ff" : "#ff6b6b";
  ctx.font = "42px 'Courier New', monospace";
  ctx.fillText(title, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 26);

  ctx.fillStyle = "#d8f7ff";
  ctx.font = "20px 'Courier New', monospace";
  ctx.fillText(subtitle, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 28);
  ctx.fillText("PRESS ENTER", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 66);
  ctx.textAlign = "left";
}

// ------------------------------------------------------------
// 便利関数
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
  };
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

function resetGame() {
  game.score = 0;
  game.lives = 3;
  game.state = "playing";
  game.bombCooldown = 0;
  game.lastTime = 0;

  player.x = 180;
  player.y = 120;
  player.invincibleTimer = 0;

  cameraX = 0;
  cameraY = 0;

  bombs.length = 0;
  enemyBullets.length = 0;
  explosions.length = 0;

  enemies.length = 0;
  for (let i = 0; i < STAGE_ENEMY_LAYOUT.length; i += 1) {
    enemies.push(createEnemy(STAGE_ENEMY_LAYOUT[i], i));
  }
}

function removeWhere(array, shouldRemove) {
  for (let i = array.length - 1; i >= 0; i -= 1) {
    if (shouldRemove(array[i])) {
      array.splice(i, 1);
    }
  }
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function padScore(score) {
  return String(score).padStart(6, "0");
}

// 初期状態を作ってからゲームを開始します。
resetGame();
requestAnimationFrame(gameLoop);
