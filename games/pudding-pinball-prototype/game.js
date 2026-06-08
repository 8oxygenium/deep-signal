const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  score: document.getElementById("scoreValue"),
  balls: document.getElementById("ballsValue"),
  status: document.getElementById("statusValue"),
  message: document.getElementById("messageText"),
  left: document.getElementById("leftButton"),
  right: document.getElementById("rightButton"),
  reset: document.getElementById("resetButton")
};

const CONFIG = {
  width: 720,
  height: 920,
  gravity: 0.22,
  friction: 0.998,
  wallBounce: 0.86,
  bumperBounce: 1.08,
  flipperKick: 9.0,
  flipperLift: 6.0,
  ballRadius: 14,
  startBalls: 3,
  launchSpeedY: -7.4,
  minActiveSpeed: 2.2
};

const state = {
  mode: "playing",
  score: 0,
  balls: CONFIG.startBalls,
  ball: null,
  leftFlipper: false,
  rightFlipper: false,
  frame: 0,
  messageTimer: 0
};

const bumpers = [
  { x: 230, y: 210, r: 42, kind: "pudding", score: 100 },
  { x: 485, y: 250, r: 30, kind: "cherry", score: 150 },
  { x: 360, y: 390, r: 36, kind: "spoon", score: 120 },
  { x: 165, y: 470, r: 30, kind: "cherry", score: 150 },
  { x: 545, y: 510, r: 44, kind: "pudding", score: 100 }
];

const leftFlipper = { x1: 186, y1: 762, x2: 348, y2: 812 };
const rightFlipper = { x1: 534, y1: 762, x2: 372, y2: 812 };
// アウトレーン封鎖壁: 外壁からフリッパーの軸まで斜めにつなぎ、
// 横の隙間からボールがすり抜けて理不尽に落ちるのを防ぐ。
// これでドレイン(落下口)は中央のフリッパー2本の間だけになる。
const guideRails = [
  { x1: 42, y1: 672, x2: 188, y2: 770, side: "left" },
  { x1: 678, y1: 672, x2: 532, y2: 770, side: "right" }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setMessage(text, frames = 90) {
  ui.message.textContent = text;
  state.messageTimer = frames;
}

function resetBall() {
  state.ball = {
    x: 560,
    y: 690,
    vx: -2.6,
    vy: CONFIG.launchSpeedY,
    r: CONFIG.ballRadius
  };
}

function resetGame() {
  state.mode = "playing";
  state.score = 0;
  state.balls = CONFIG.startBalls;
  state.leftFlipper = false;
  state.rightFlipper = false;
  resetBall();
  setMessage("v0.1.2 横の隙間をふさぎました。落ちるのは中央だけ！左右でフリッパー。", 160);
  updateHud();
}

function updateHud() {
  ui.score.textContent = String(state.score);
  ui.balls.textContent = String(state.balls);
  ui.status.textContent = state.mode === "gameOver" ? "GAME OVER" : "PLAY";
  ui.left.classList.toggle("is-pressed", state.leftFlipper);
  ui.right.classList.toggle("is-pressed", state.rightFlipper);
}

function addScore(points) {
  state.score += points;
  setMessage(`HIT! +${points} / カラメル玉がはねた！`, 70);
}

function loseBall() {
  state.balls -= 1;
  if (state.balls <= 0) {
    state.mode = "gameOver";
    state.ball = null;
    setMessage("GAME OVER! もう一回でリセット。", 9999);
  } else {
    resetBall();
    setMessage("MISS! 次のカラメル玉いきます。", 100);
  }
  updateHud();
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function reflectCircle(bumper) {
  const ball = state.ball;
  const dx = ball.x - bumper.x;
  const dy = ball.y - bumper.y;
  const d = Math.max(1, Math.hypot(dx, dy));
  const minDist = ball.r + bumper.r;

  if (d >= minDist) {
    return;
  }

  const nx = dx / d;
  const ny = dy / d;
  const dot = ball.vx * nx + ball.vy * ny;
  ball.x = bumper.x + nx * minDist;
  ball.y = bumper.y + ny * minDist;
  ball.vx = (ball.vx - 2 * dot * nx) * CONFIG.bumperBounce;
  ball.vy = (ball.vy - 2 * dot * ny) * CONFIG.bumperBounce - 0.6;
  addScore(bumper.score);
}

function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / abLenSq, 0, 1);
  const x = ax + abx * t;
  const y = ay + aby * t;
  return { distance: Math.hypot(px - x, py - y), x, y, t };
}

function getFlipperLine(base, pressed, isLeft) {
  const lift = pressed ? 58 : 0;
  if (isLeft) {
    return { x1: base.x1, y1: base.y1, x2: base.x2, y2: base.y2 - lift };
  }
  return { x1: base.x1, y1: base.y1, x2: base.x2, y2: base.y2 - lift };
}

function collideFlipper(base, pressed, isLeft) {
  const ball = state.ball;
  const flipper = getFlipperLine(base, pressed, isLeft);
  const hit = pointToSegmentDistance(ball.x, ball.y, flipper.x1, flipper.y1, flipper.x2, flipper.y2);

  // フリップ直後に上へ速く飛んでいる時だけ再衝突を無視する
  if (hit.distance > ball.r + 10 || ball.vy < -13) {
    return;
  }
  // 内側チップ(t>0.94)：押していない時はボールを捕まえず中央ドレインへ落とす。
  // 押している時はチップでも受けて確実に救う。
  if (!pressed && hit.t > 0.94) {
    return;
  }

  let dx = ball.x - hit.x;
  let dy = ball.y - hit.y;
  let len = Math.max(1, Math.hypot(dx, dy));
  let nx = dx / len;
  let ny = dy / len;
  // 法線は必ずフリッパーの上面(上向き)にそろえる
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  ball.x = hit.x + nx * (ball.r + 10);
  ball.y = hit.y + ny * (ball.r + 10);

  if (pressed) {
    // 押した時だけ強く上＋中央へ弾き上げる
    ball.vx = ball.vx * 0.5 + (isLeft ? 3.4 : -3.4);
    ball.vy = -CONFIG.flipperKick - CONFIG.flipperLift;
    setMessage("SPOON FLIP!", 45);
  } else {
    // 置いたフリッパーは「坂」: 上には弾かず、めり込みだけ止めて
    // 重力で中央のチップ方向へゆっくり転がり落ちる
    const dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) {
      ball.vx -= dot * nx * 1.1;
      ball.vy -= dot * ny * 1.1;
    }
    // 中央(落下口)方向へやさしく転がす
    ball.vx += isLeft ? 0.45 : -0.45;
  }
}

function collideGuideRail(rail) {
  // アウトレーン封鎖壁との衝突。常に有効な「壁」として扱い、
  // ボールは大きく跳ね返らず、壁に沿ってフリッパー方向へ転がり落ちる。
  const ball = state.ball;
  const hit = pointToSegmentDistance(ball.x, ball.y, rail.x1, rail.y1, rail.x2, rail.y2);

  if (hit.distance > ball.r + 8) {
    return;
  }

  let dx = ball.x - hit.x;
  let dy = ball.y - hit.y;
  let len = Math.hypot(dx, dy);
  if (len < 0.001) {
    // ちょうど壁の上に重なった場合は、内側(上向き)を法線とみなす
    dx = rail.side === "left" ? 1 : -1;
    dy = -1;
    len = Math.hypot(dx, dy);
  }
  const nx = dx / len;
  const ny = dy / len;
  // 壁の外へ押し出す
  ball.x = hit.x + nx * (ball.r + 8);
  ball.y = hit.y + ny * (ball.r + 8);
  // 壁にめり込む速度成分だけを抑える(ほぼ滑らせる)。横には弾き返さない。
  const dot = ball.vx * nx + ball.vy * ny;
  if (dot < 0) {
    ball.vx -= dot * nx * 1.2;
    ball.vy -= dot * ny * 1.2;
  }
  // フリッパー側(中央寄り)へ少しだけ転がす
  ball.vx += rail.side === "left" ? 0.55 : -0.55;
}

function updateBall() {
  const ball = state.ball;
  if (!ball || state.mode !== "playing") {
    return;
  }

  ball.vy += CONFIG.gravity;
  ball.vx *= CONFIG.friction;
  ball.vy *= CONFIG.friction;
  ball.x += ball.vx;
  ball.y += ball.vy;

  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed < CONFIG.minActiveSpeed && ball.y < 600) {
    const boost = CONFIG.minActiveSpeed / Math.max(0.1, speed);
    ball.vx *= boost;
    ball.vy = Math.max(ball.vy * boost, 0.8);
  }

  if (ball.x < 42 + ball.r) {
    ball.x = 42 + ball.r;
    ball.vx = Math.abs(ball.vx) * CONFIG.wallBounce;
  }
  if (ball.x > CONFIG.width - 42 - ball.r) {
    ball.x = CONFIG.width - 42 - ball.r;
    ball.vx = -Math.abs(ball.vx) * CONFIG.wallBounce;
  }
  if (ball.y < 46 + ball.r) {
    ball.y = 46 + ball.r;
    ball.vy = Math.abs(ball.vy) * CONFIG.wallBounce;
  }

  for (const bumper of bumpers) {
    reflectCircle(bumper);
  }

  guideRails.forEach(collideGuideRail);
  collideFlipper(leftFlipper, state.leftFlipper, true);
  collideFlipper(rightFlipper, state.rightFlipper, false);

  if (ball.y > CONFIG.height + 50) {
    loseBall();
  }
}

function drawRoundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawTable() {
  ctx.fillStyle = "#fff1bf";
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

  ctx.fillStyle = "#43261c";
  ctx.fillRect(24, 30, 18, CONFIG.height - 110);
  ctx.fillRect(CONFIG.width - 42, 30, 18, CONFIG.height - 110);
  ctx.fillRect(42, 30, CONFIG.width - 84, 18);

  ctx.strokeStyle = "#8f4a20";
  ctx.lineWidth = 6;
  ctx.strokeRect(42, 48, CONFIG.width - 84, CONFIG.height - 130);

  ctx.fillStyle = "#ffd86b";
  drawRoundedRect(88, 72, 544, 82, 28);
  ctx.fill();
  ctx.strokeStyle = "#43261c";
  ctx.stroke();

  ctx.fillStyle = "#43261c";
  ctx.font = "700 28px 'Courier New', 'MS Gothic', monospace";
  ctx.textAlign = "center";
  ctx.fillText("プリンピンボール", CONFIG.width / 2, 110);
  ctx.font = "700 18px 'Courier New', monospace";
  ctx.fillText("Pudding Pinball v0.1.2 prototype", CONFIG.width / 2, 138);

  ctx.fillStyle = "rgba(216, 59, 45, 0.12)";
  ctx.fillRect(0, 0, CONFIG.width / 2, CONFIG.height);
  ctx.fillStyle = "rgba(76, 122, 70, 0.1)";
  ctx.fillRect(CONFIG.width / 2, 0, CONFIG.width / 2, CONFIG.height);
  ctx.fillStyle = "rgba(67, 38, 28, 0.34)";
  ctx.font = "700 22px 'Courier New', monospace";
  ctx.fillText("LEFT", 145, CONFIG.height - 28);
  ctx.fillText("RIGHT", CONFIG.width - 145, CONFIG.height - 28);

  ctx.fillStyle = "rgba(216, 59, 45, 0.18)";
  drawRoundedRect(CONFIG.width / 2 - 64, CONFIG.height - 88, 128, 48, 18);
  ctx.fill();
  ctx.fillStyle = "#43261c";
  ctx.font = "700 16px 'Courier New', monospace";
  ctx.fillText("DRAIN", CONFIG.width / 2, CONFIG.height - 57);
}

function drawBumper(bumper) {
  ctx.save();
  ctx.translate(bumper.x, bumper.y);

  if (bumper.kind === "cherry") {
    ctx.fillStyle = "#d83b2d";
    ctx.beginPath();
    ctx.arc(0, 0, bumper.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#43261c";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = "#4c7a46";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(2, -bumper.r);
    ctx.quadraticCurveTo(24, -bumper.r - 34, 8, -bumper.r - 48);
    ctx.stroke();
  } else if (bumper.kind === "spoon") {
    ctx.fillStyle = "#fff9df";
    ctx.strokeStyle = "#43261c";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, -8, bumper.r * 0.72, bumper.r, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#43261c";
    ctx.fillRect(-5, 18, 10, 58);
  } else {
    ctx.fillStyle = "#ffd86b";
    ctx.strokeStyle = "#43261c";
    ctx.lineWidth = 5;
    drawRoundedRect(-bumper.r, -bumper.r * 0.55, bumper.r * 2, bumper.r * 1.12, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#8f4a20";
    drawRoundedRect(-bumper.r * 0.62, -bumper.r * 0.5, bumper.r * 1.24, 14, 8);
    ctx.fill();
  }

  ctx.restore();
}

function drawFlipper(base, pressed, isLeft) {
  const flipper = getFlipperLine(base, pressed, isLeft);
  ctx.save();
  ctx.strokeStyle = pressed ? "#d83b2d" : "#8f4a20";
  ctx.lineWidth = 22;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(flipper.x1, flipper.y1);
  ctx.lineTo(flipper.x2, flipper.y2);
  ctx.stroke();
  ctx.strokeStyle = "#43261c";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function drawGuideRail(rail) {
  ctx.save();
  ctx.strokeStyle = "#8f4a20";
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(rail.x1, rail.y1);
  ctx.lineTo(rail.x2, rail.y2);
  ctx.stroke();
  ctx.strokeStyle = "#43261c";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function drawBall() {
  const ball = state.ball;
  if (!ball) {
    return;
  }

  ctx.fillStyle = "#8f4a20";
  ctx.strokeStyle = "#43261c";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 249, 223, 0.68)";
  ctx.beginPath();
  ctx.arc(ball.x - 5, ball.y - 6, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawOverlay() {
  ctx.fillStyle = "#43261c";
  ctx.font = "700 22px 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.fillText(`SCORE ${state.score}`, 56, 190);
  ctx.fillText(`BALL ${state.balls}`, 56, 220);

  if (state.mode !== "gameOver") {
    return;
  }

  ctx.fillStyle = "rgba(67, 38, 28, 0.64)";
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  ctx.fillStyle = "#fff9df";
  ctx.strokeStyle = "#d83b2d";
  ctx.lineWidth = 6;
  ctx.fillRect(130, 350, 460, 180);
  ctx.strokeRect(130, 350, 460, 180);
  ctx.fillStyle = "#d83b2d";
  ctx.font = "700 54px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", CONFIG.width / 2, 425);
  ctx.fillStyle = "#43261c";
  ctx.font = "700 24px 'Courier New', 'MS Gothic', monospace";
  ctx.fillText("もう一回でリセット", CONFIG.width / 2, 475);
}

function draw() {
  drawTable();
  bumpers.forEach(drawBumper);
  guideRails.forEach(drawGuideRail);
  drawFlipper(leftFlipper, state.leftFlipper, true);
  drawFlipper(rightFlipper, state.rightFlipper, false);
  drawBall();
  drawOverlay();
}

function loop() {
  state.frame += 1;
  if (state.messageTimer > 0) {
    state.messageTimer -= 1;
  }
  updateBall();
  updateHud();
  draw();
  requestAnimationFrame(loop);
}

function setFlipper(side, pressed) {
  if (side === "left") {
    state.leftFlipper = pressed;
  } else {
    state.rightFlipper = pressed;
  }
}

function handlePointerDown(event) {
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const leftSide = x < rect.width / 2;
  state.leftFlipper = leftSide;
  state.rightFlipper = !leftSide;
}

function handlePointerUp(event) {
  event.preventDefault();
  state.leftFlipper = false;
  state.rightFlipper = false;
}

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", (event) => {
  if (event.buttons <= 0) {
    return;
  }
  handlePointerDown(event);
});
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);
canvas.addEventListener("pointerleave", handlePointerUp);

ui.left.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  setFlipper("left", true);
});
ui.right.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  setFlipper("right", true);
});
ui.left.addEventListener("pointerup", () => setFlipper("left", false));
ui.right.addEventListener("pointerup", () => setFlipper("right", false));
ui.left.addEventListener("pointercancel", () => setFlipper("left", false));
ui.right.addEventListener("pointercancel", () => setFlipper("right", false));
ui.reset.addEventListener("click", resetGame);

window.addEventListener("pointerup", () => {
  state.leftFlipper = false;
  state.rightFlipper = false;
});

window.addEventListener("pointercancel", () => {
  state.leftFlipper = false;
  state.rightFlipper = false;
});

window.addEventListener("keydown", (event) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    state.leftFlipper = true;
    event.preventDefault();
  }
  if (event.code === "ArrowRight" || event.code === "KeyD") {
    state.rightFlipper = true;
    event.preventDefault();
  }
  if (event.code === "KeyR") {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    state.leftFlipper = false;
  }
  if (event.code === "ArrowRight" || event.code === "KeyD") {
    state.rightFlipper = false;
  }
});

resetGame();
requestAnimationFrame(loop);
