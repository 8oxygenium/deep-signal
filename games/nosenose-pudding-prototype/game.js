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
  moveSpeed: 4.4,
  fallSpeed: 2.45,
  fastDropSpeed: 18,
  safeOffset: 58
};

const state = {
  mode: "playing",
  activePudding: null,
  stack: [],
  collapsePieces: [],
  keys: new Set(),
  frame: 0
};

function resetGame() {
  state.mode = "playing";
  state.stack = [];
  state.collapsePieces = [];
  state.keys.clear();
  spawnNewPudding(canvas.width / 2);
  ui.message.textContent = "プリンは自動で落ちます。左右で動かして、DROPで一気に落とそう。";
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
  } else if (state.activePudding && state.activePudding.isFastDrop) {
    ui.status.textContent = "FAST DROP";
  } else {
    ui.status.textContent = "FALLING";
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function landingYForNextPudding() {
  return CONFIG.plateY - 22 - (state.stack.length * (CONFIG.puddingHeight - 6));
}

function spawnNewPudding(x) {
  state.activePudding = {
    x: clamp(x, CONFIG.minX, CONFIG.maxX),
    y: CONFIG.startY,
    vy: CONFIG.fallSpeed,
    isFastDrop: false,
    phase: Math.random() * Math.PI * 2,
    tilt: 0
  };
}

function moveActivePudding() {
  if (state.mode !== "playing" || !state.activePudding) {
    return;
  }

  let direction = 0;
  if (state.keys.has("ArrowLeft") || state.keys.has("KeyA")) {
    direction -= 1;
  }
  if (state.keys.has("ArrowRight") || state.keys.has("KeyD")) {
    direction += 1;
  }

  if (direction !== 0) {
    state.activePudding.x = clamp(
      state.activePudding.x + direction * CONFIG.moveSpeed,
      CONFIG.minX,
      CONFIG.maxX
    );
  }
}

function fastDrop() {
  if (state.mode !== "playing" || !state.activePudding) {
    return;
  }

  state.activePudding.isFastDrop = true;
  state.activePudding.vy = CONFIG.fastDropSpeed;
  ui.message.textContent = "一気に落下！";
  updateHud();
}

function updateFallingPudding() {
  if (state.mode !== "playing" || !state.activePudding) {
    return;
  }

  state.activePudding.y += state.activePudding.vy;
  if (state.activePudding.y >= landingYForNextPudding()) {
    state.activePudding.y = landingYForNextPudding();
    landActivePudding();
  }
}

function landActivePudding() {
  const pudding = state.activePudding;
  if (!pudding) {
    return;
  }

  const baseX = state.stack.length === 0 ? canvas.width / 2 : state.stack[state.stack.length - 1].x;
  const offset = Math.abs(pudding.x - baseX);

  if (state.stack.length > 0 && offset > CONFIG.safeOffset) {
    triggerGameOver(pudding);
    return;
  }

  state.stack.push({
    x: pudding.x,
    y: pudding.y,
    phase: pudding.phase,
    tilt: clamp((pudding.x - baseX) / CONFIG.safeOffset, -1, 1)
  });

  state.activePudding = null;

  if (state.stack.length >= CONFIG.goal) {
    state.mode = "clear";
    ui.message.textContent = "10段プリン完成！ Level 1 CLEAR!";
    updateHud();
    return;
  }

  ui.message.textContent = "のせられた！ 次のプリンも自動で落ちます。";
  spawnNewPudding(pudding.x);
  updateHud();
}

function triggerGameOver(failedPudding) {
  state.mode = "gameOver";
  state.collapsePieces = createCollapsePieces(failedPudding);
  state.activePudding = null;
  ui.message.textContent = "くずれた！ RESETで再挑戦。到達Levelは下がりません。";
  updateHud();
}

function createCollapsePieces(failedPudding) {
  const allPuddings = state.stack.concat([{
    x: failedPudding.x,
    y: failedPudding.y,
    phase: failedPudding.phase,
    tilt: 1
  }]);

  const center = canvas.width / 2;
  return allPuddings.map((pudding, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const spread = 52 + index * 16;
    const lowRows = Math.min(index * 9, 88);
    return {
      x: clamp(pudding.x + side * spread + Math.sin(index * 1.7) * 18, 60, canvas.width - 60),
      y: clamp(CONFIG.plateY - 18 - lowRows + Math.cos(index * 1.2) * 14, 230, CONFIG.plateY + 28),
      phase: pudding.phase + index,
      tilt: side * (0.35 + index * 0.08),
      fallen: true,
      squish: index % 3 === 0 ? 1.16 : 1
    };
  }).concat([
    {
      x: clamp(center - 170, 60, canvas.width - 60),
      y: CONFIG.plateY + 22,
      phase: 0.4,
      tilt: -0.95,
      fallen: true,
      squish: 1.1
    },
    {
      x: clamp(center + 172, 60, canvas.width - 60),
      y: CONFIG.plateY + 10,
      phase: 1.7,
      tilt: 0.82,
      fallen: true,
      squish: 1.08
    }
  ]);
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

function drawPudding(pudding, index, isActive) {
  const wobble = Math.sin((state.frame * 0.1) + pudding.phase + index) * (isActive ? 5 : 2.4);
  const width = (CONFIG.puddingWidth + wobble) * (pudding.squish || 1);
  const height = CONFIG.puddingHeight / (pudding.squish || 1);
  const tilt = (pudding.tilt || 0) * 0.16 + wobble * 0.002;
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
  ctx.fillRect(x + 20, y + height * 0.56, width - 40, 4);
  ctx.restore();
}

function drawDropGuide() {
  if (state.mode !== "playing" || !state.activePudding) {
    return;
  }

  ctx.strokeStyle = "rgba(216, 59, 45, 0.55)";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(state.activePudding.x, state.activePudding.y + 28);
  ctx.lineTo(state.activePudding.x, landingYForNextPudding() - 24);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawOverlay() {
  if (state.mode !== "clear" && state.mode !== "gameOver") {
    return;
  }

  ctx.fillStyle = "rgba(67, 38, 28, 0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff9df";
  ctx.strokeStyle = state.mode === "clear" ? "#4c7a46" : "#d83b2d";
  ctx.lineWidth = 5;
  ctx.strokeRect(150, 150, 420, 150);
  ctx.fillRect(150, 150, 420, 150);
  ctx.fillStyle = state.mode === "clear" ? "#4c7a46" : "#d83b2d";
  ctx.font = "700 40px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText(state.mode === "clear" ? "CLEAR!" : "GAME OVER", canvas.width / 2, 204);
  ctx.fillStyle = "#43261c";
  ctx.font = "700 22px 'Courier New', monospace";
  ctx.fillText(state.mode === "clear" ? "10段プリン完成!" : "くずれた!", canvas.width / 2, 244);
  ctx.fillText("R / RESETで再挑戦", canvas.width / 2, 276);
}

function draw() {
  drawBackground();
  drawPlate();

  if (state.mode === "gameOver" && state.collapsePieces.length > 0) {
    state.collapsePieces.forEach((piece, index) => drawPudding(piece, index, false));
  } else {
    state.stack.forEach((pudding, index) => drawPudding(pudding, index, false));
  }

  if (state.activePudding) {
    drawDropGuide();
    drawPudding(state.activePudding, state.stack.length, true);
  }

  drawOverlay();
}

function loop() {
  state.frame += 1;
  moveActivePudding();
  updateFallingPudding();
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
    fastDrop();
  } else if (event.code === "KeyR") {
    resetGame();
  }
});

document.addEventListener("keyup", (event) => {
  setHeld(event.code, false);
});

bindHoldButton(ui.left, "ArrowLeft");
bindHoldButton(ui.right, "ArrowRight");
ui.drop.addEventListener("click", fastDrop);
ui.reset.addEventListener("click", resetGame);

resetGame();
loop();
