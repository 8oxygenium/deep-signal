const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  level: document.getElementById("levelValue"),
  stack: document.getElementById("stackValue"),
  goal: document.getElementById("goalValue"),
  status: document.getElementById("statusValue"),
  message: document.getElementById("messageText"),
  left: document.getElementById("leftButton"),
  right: document.getElementById("rightButton"),
  drop: document.getElementById("dropButton"),
  reset: document.getElementById("resetButton")
};

const CONFIG = {
  level: 1,
  goal: 10,
  puddingWidth: 112,
  puddingHeight: 38,
  plateY: 430,
  startY: 72,
  minX: 92,
  maxX: 628,
  moveSpeed: 4.2,
  fallSpeed: 8.5,
  safeOffset: 58
};

const state = {
  mode: "ready",
  aimX: canvas.width / 2,
  falling: null,
  stack: [],
  keys: new Set(),
  frame: 0
};

function resetGame() {
  state.mode = "ready";
  state.aimX = canvas.width / 2;
  state.falling = null;
  state.stack = [];
  state.keys.clear();
  ui.message.textContent = "左右で位置を決めて、DROPでプリンを落とそう。";
  updateHud();
}

function updateHud() {
  ui.level.textContent = String(CONFIG.level);
  ui.stack.textContent = String(state.stack.length);
  ui.goal.textContent = String(CONFIG.goal);
  if (state.mode === "clear") {
    ui.status.textContent = "CLEAR";
  } else if (state.mode === "gameOver") {
    ui.status.textContent = "GAME OVER";
  } else if (state.mode === "falling") {
    ui.status.textContent = "DROP";
  } else {
    ui.status.textContent = "READY";
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function targetYForNextPudding() {
  return CONFIG.plateY - 22 - (state.stack.length * (CONFIG.puddingHeight - 6));
}

function moveAim() {
  if (state.mode === "clear" || state.mode === "gameOver" || state.mode === "falling") {
    return;
  }

  let direction = 0;
  if (state.keys.has("ArrowLeft") || state.keys.has("KeyA")) {
    direction -= 1;
  }
  if (state.keys.has("ArrowRight") || state.keys.has("KeyD")) {
    direction += 1;
  }

  state.aimX = clamp(state.aimX + direction * CONFIG.moveSpeed, CONFIG.minX, CONFIG.maxX);
}

function dropPudding() {
  if (state.mode === "clear" || state.mode === "gameOver" || state.mode === "falling") {
    return;
  }

  state.mode = "falling";
  state.falling = {
    x: state.aimX,
    y: CONFIG.startY,
    phase: Math.random() * Math.PI * 2
  };
  ui.message.textContent = "ぷるぷる落下中...";
  updateHud();
}

function landPudding() {
  if (!state.falling) {
    return;
  }

  const baseX = state.stack.length === 0 ? canvas.width / 2 : state.stack[state.stack.length - 1].x;
  const offset = Math.abs(state.falling.x - baseX);

  if (state.stack.length > 0 && offset > CONFIG.safeOffset) {
    state.mode = "gameOver";
    ui.message.textContent = "くずれた！ RESETで再挑戦。到達Levelは下がりません。";
    state.falling = null;
    updateHud();
    return;
  }

  state.stack.push({
    x: state.falling.x,
    y: targetYForNextPudding(),
    phase: state.falling.phase,
    tilt: clamp((state.falling.x - baseX) / CONFIG.safeOffset, -1, 1)
  });

  state.falling = null;

  if (state.stack.length >= CONFIG.goal) {
    state.mode = "clear";
    ui.message.textContent = "10段プリン完成！ Level 1 CLEAR!";
  } else {
    state.mode = "ready";
    ui.message.textContent = "いい感じ！ 次のプリンをのせよう。";
  }

  updateHud();
}

function updateFalling() {
  if (!state.falling) {
    return;
  }

  state.falling.y += CONFIG.fallSpeed;
  if (state.falling.y >= targetYForNextPudding()) {
    landPudding();
  }
}

function drawBackground() {
  ctx.fillStyle = "#fff1bf";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(67, 38, 28, 0.08)";
  for (let x = 0; x < canvas.width; x += 24) {
    ctx.fillRect(x, 0, 2, canvas.height);
  }
  for (let y = 0; y < canvas.height; y += 24) {
    ctx.fillRect(0, y, canvas.width, 2);
  }

  ctx.fillStyle = "#f0b65c";
  ctx.fillRect(0, CONFIG.plateY + 34, canvas.width, canvas.height - CONFIG.plateY);
}

function drawPlate() {
  ctx.save();
  ctx.translate(canvas.width / 2, CONFIG.plateY + 18);
  ctx.fillStyle = "#fff9df";
  ctx.strokeStyle = "#43261c";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 190, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#8f4a20";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 130, 15, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function roundRect(x, y, width, height, radius) {
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

function drawPudding(pudding, index, isPreview) {
  const wobble = Math.sin((state.frame * 0.09) + pudding.phase + index) * (isPreview ? 5 : 2.4);
  const tilt = (pudding.tilt || 0) * 0.08 + wobble * 0.002;
  const width = CONFIG.puddingWidth + wobble;
  const height = CONFIG.puddingHeight;
  const x = pudding.x - width / 2;
  const y = pudding.y - height / 2;

  ctx.save();
  ctx.translate(pudding.x, pudding.y);
  ctx.rotate(tilt);
  ctx.translate(-pudding.x, -pudding.y);

  ctx.fillStyle = "#ffd86b";
  ctx.strokeStyle = "#43261c";
  ctx.lineWidth = 4;
  roundRect(x, y, width, height, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#8f4a20";
  roundRect(x + 15, y + 3, width - 30, 12, 8);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 249, 223, 0.8)";
  ctx.fillRect(x + 20, y + 21, width - 40, 4);
  ctx.restore();
}

function drawAim() {
  if (state.mode === "clear" || state.mode === "gameOver" || state.mode === "falling") {
    return;
  }

  drawPudding({ x: state.aimX, y: CONFIG.startY, phase: 0, tilt: 0 }, 0, true);

  ctx.strokeStyle = "#d83b2d";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(state.aimX, CONFIG.startY + 28);
  ctx.lineTo(state.aimX, targetYForNextPudding() - 24);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawOverlay() {
  if (state.mode !== "clear" && state.mode !== "gameOver") {
    return;
  }

  ctx.fillStyle = "rgba(67, 38, 28, 0.68)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff9df";
  ctx.strokeStyle = "#ffd86b";
  ctx.lineWidth = 4;
  ctx.strokeRect(150, 166, 420, 138);
  ctx.fillRect(150, 166, 420, 138);
  ctx.fillStyle = state.mode === "clear" ? "#4c7a46" : "#d83b2d";
  ctx.font = "700 40px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText(state.mode === "clear" ? "CLEAR!" : "GAME OVER", canvas.width / 2, 218);
  ctx.fillStyle = "#43261c";
  ctx.font = "700 22px 'Courier New', monospace";
  ctx.fillText(state.mode === "clear" ? "10段プリン完成!" : "くずれた!", canvas.width / 2, 256);
  ctx.fillText("R / RESETで再挑戦", canvas.width / 2, 284);
}

function draw() {
  drawBackground();
  drawPlate();

  state.stack.forEach((pudding, index) => {
    drawPudding(pudding, index, false);
  });

  if (state.falling) {
    drawPudding(state.falling, state.stack.length, true);
  }

  drawAim();
  drawOverlay();
}

function loop() {
  state.frame += 1;
  moveAim();
  updateFalling();
  draw();
  requestAnimationFrame(loop);
}

function setHeld(code, isHeld) {
  if (isHeld) {
    state.keys.add(code);
  } else {
    state.keys.delete(code);
  }
}

function bindHoldButton(button, code) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    setHeld(code, true);
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener("pointerup", () => setHeld(code, false));
  button.addEventListener("pointercancel", () => setHeld(code, false));
  button.addEventListener("pointerleave", () => setHeld(code, false));
}

document.addEventListener("keydown", (event) => {
  if (event.code === "ArrowLeft" || event.code === "ArrowRight" || event.code === "KeyA" || event.code === "KeyD") {
    event.preventDefault();
    setHeld(event.code, true);
  } else if (event.code === "Space") {
    event.preventDefault();
    dropPudding();
  } else if (event.code === "KeyR") {
    resetGame();
  }
});

document.addEventListener("keyup", (event) => {
  setHeld(event.code, false);
});

bindHoldButton(ui.left, "ArrowLeft");
bindHoldButton(ui.right, "ArrowRight");
ui.drop.addEventListener("click", dropPudding);
ui.reset.addEventListener("click", resetGame);

resetGame();
loop();
