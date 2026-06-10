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
  fallSpeed: 1.25,
  fastDropSpeed: 28,
  safeOffset: 58,
  plateSafeLeft: 170,
  plateSafeRight: 550,
  minPlateOverlap: 18,
  minPuddingOverlap: 16,
  spawnMinX: 170,
  spawnMaxX: 550,
  spawnOffsetStart: 24,
  spawnOffsetMax: 48,
  autoSwayStart: 2.8,
  autoSwayMax: 9.5
};

const PUDDING_TYPES = [
  {
    kind: "normal",
    label: "ノーマル",
    width: 112,
    height: 38,
    bodyColor: "#ffd86b",
    caramelColor: "#8f4a20",
    score: 100,
    unlockStack: 0,
    weight: 6,
    squish: 1,
    swayBonus: 0
  },
  {
    kind: "pucchin",
    label: "プッチン",
    width: 84,
    height: 31,
    bodyColor: "#ffef91",
    caramelColor: "#b45a28",
    score: 120,
    unlockStack: 1,
    weight: 4,
    squish: 0.96,
    swayBonus: 1.1
  },
  {
    kind: "baked",
    label: "焼きプリン",
    width: 140,
    height: 42,
    bodyColor: "#e4a94f",
    caramelColor: "#4f2412",
    score: 160,
    unlockStack: 3,
    weight: 3,
    squish: 1.02,
    swayBonus: 0.4
  },
  {
    kind: "big",
    label: "でかプリン",
    width: 168,
    height: 52,
    bodyColor: "#ffc94a",
    caramelColor: "#6c2f17",
    score: 240,
    unlockStack: 5,
    weight: 1,
    squish: 1.06,
    swayBonus: 0.1
  }
];

const state = {
  mode: "playing",
  activePudding: null,
  stack: [],
  collapsePieces: [],
  keys: new Set(),
  touch: null,
  frame: 0,
  lastTime: 0
};

function resetGame() {
  state.mode = "playing";
  state.stack = [];
  state.collapsePieces = [];
  state.keys.clear();
  state.touch = null;
  state.lastTime = performance.now();
  spawnNewPudding(canvas.width / 2, true);
  ui.message.textContent = "v0.2.4 起動中。お皿の上ならどこでもセーフ。下のプリンやお皿の上にちゃんと乗ります。";
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

function getPuddingHeight(pudding) {
  return pudding?.height || CONFIG.puddingHeight;
}

function getPuddingWidth(pudding) {
  return pudding?.width || CONFIG.puddingWidth;
}

function getStackHeight() {
  return state.stack.reduce((total, pudding) => total + getPuddingHeight(pudding) - 6, 0);
}

function landingYForPudding(pudding) {
  // v0.2.4: 着地する高さは「このプリンの真下にある面」で決める。
  //   - X範囲が重なる既存プリンがあれば、その一番高い上端に乗る（積み上げ）。
  //   - 何も無ければお皿の上に乗る（横に並べてもOK）。
  // ※横（重心がお皿の上か）のセーフ判定は landActivePudding 側で別途。ここは縦の置き場所だけ。
  const half = getPuddingWidth(pudding) / 2;
  const left = pudding.x - half;
  const right = pudding.x + half;

  let surfaceTop = CONFIG.plateY; // お皿の面（y）。何にも乗らなければここ。
  let onPudding = false;
  for (const p of state.stack) {
    const pHalf = getPuddingWidth(p) / 2;
    const overlap = Math.min(right, p.x + pHalf) - Math.max(left, p.x - pHalf);
    if (overlap > 0) {
      const pTop = p.y - getPuddingHeight(p) / 2; // その下プリンの上端
      if (pTop < surfaceTop) {
        surfaceTop = pTop;
        onPudding = true;
      }
    }
  }

  const sink = onPudding ? 6 : 0; // 重ねたときだけ少しめり込ませてくっついて見せる
  return surfaceTop - getPuddingHeight(pudding) / 2 + sink;
}

function landingYForNextPudding() {
  return landingYForPudding(state.activePudding || { height: CONFIG.puddingHeight });
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function nextSpawnX(baseX, isFirst = false) {
  if (isFirst) {
    return clamp(canvas.width / 2 + randomRange(-18, 18), CONFIG.spawnMinX, CONFIG.spawnMaxX);
  }

  const progress = clamp(state.stack.length / CONFIG.goal, 0, 1);
  const offsetRange = CONFIG.spawnOffsetStart + (CONFIG.spawnOffsetMax - CONFIG.spawnOffsetStart) * progress;
  let candidate = baseX + randomRange(-offsetRange, offsetRange);

  // あまりに同じ位置だと「置くだけ」になってしまうので、最低限のずれを作ります。
  if (Math.abs(candidate - baseX) < 12) {
    candidate += Math.random() > 0.5 ? 16 : -16;
  }

  return clamp(candidate, CONFIG.spawnMinX, CONFIG.spawnMaxX);
}

function choosePuddingType(isFirst = false) {
  if (isFirst) {
    return PUDDING_TYPES[0];
  }

  const available = PUDDING_TYPES.filter((type) => state.stack.length >= type.unlockStack);
  const totalWeight = available.reduce((total, type) => total + type.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const type of available) {
    roll -= type.weight;
    if (roll <= 0) {
      return type;
    }
  }

  return available[0] || PUDDING_TYPES[0];
}

function spawnNewPudding(x, isFirst = false) {
  const type = choosePuddingType(isFirst);
  const spawnX = nextSpawnX(x, isFirst);
  const progress = clamp(state.stack.length / CONFIG.goal, 0, 1);
  state.activePudding = {
    kind: type.kind,
    label: type.label,
    width: type.width,
    height: type.height,
    bodyColor: type.bodyColor,
    caramelColor: type.caramelColor,
    score: type.score,
    squish: type.squish,
    x: spawnX,
    centerX: spawnX,
    y: CONFIG.startY,
    vy: CONFIG.fallSpeed,
    isFastDrop: false,
    phase: Math.random() * Math.PI * 2,
    swayAmplitude: CONFIG.autoSwayStart + (CONFIG.autoSwayMax - CONFIG.autoSwayStart) * progress + type.swayBonus,
    swaySpeed: randomRange(0.024, 0.038),
    tilt: 0
  };
}

function moveActivePudding(frameScale = 1) {
  if (state.mode !== "playing" || !state.activePudding) {
    return;
  }

  let direction = 0;
  if (state.keys.has("ArrowLeft") || state.keys.has("KeyA") || state.keys.has("TouchLeft")) {
    direction -= 1;
  }
  if (state.keys.has("ArrowRight") || state.keys.has("KeyD") || state.keys.has("TouchRight")) {
    direction += 1;
  }

  if (direction !== 0) {
    state.activePudding.centerX = clamp(
      state.activePudding.centerX + direction * CONFIG.moveSpeed * frameScale,
      CONFIG.minX,
      CONFIG.maxX
    );
  }

  const sway = Math.sin(state.frame * state.activePudding.swaySpeed + state.activePudding.phase) * state.activePudding.swayAmplitude;
  state.activePudding.x = clamp(state.activePudding.centerX + sway, CONFIG.minX, CONFIG.maxX);
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

function updateFallingPudding(frameScale = 1) {
  // v0.2.0: 自動落下は一番単純に、playing中は毎フレーム必ずyを増やします。
  // START待ちやready状態で止まって見える事故を避けるため、activePuddingがなければ即生成します。
  if (state.mode === "playing" && !state.activePudding) {
    spawnNewPudding(canvas.width / 2, state.stack.length === 0);
  }

  if (state.mode !== "playing" || !state.activePudding) {
    return;
  }

  state.activePudding.y += state.activePudding.vy * frameScale;
  if (state.activePudding.y >= landingYForNextPudding()) {
    state.activePudding.y = landingYForNextPudding();
    landActivePudding();
  }
}

function landingSafeOffset(current, previous) {
  if (!previous) {
    return CONFIG.safeOffset;
  }

  const narrowWidth = Math.min(getPuddingWidth(current), getPuddingWidth(previous));
  return clamp(narrowWidth * 0.6, 54, 82);
}

function isOnPlate(pudding) {
  return getPlateOverlap(pudding) >= CONFIG.minPlateOverlap;
}

function getPlateOverlap(pudding) {
  const left = pudding.x - getPuddingWidth(pudding) / 2;
  const right = pudding.x + getPuddingWidth(pudding) / 2;
  return Math.max(0, Math.min(right, CONFIG.plateSafeRight) - Math.max(left, CONFIG.plateSafeLeft));
}

function getPuddingOverlap(current, previous) {
  const currentLeft = current.x - getPuddingWidth(current) / 2;
  const currentRight = current.x + getPuddingWidth(current) / 2;
  const previousLeft = previous.x - getPuddingWidth(previous) / 2;
  const previousRight = previous.x + getPuddingWidth(previous) / 2;
  return Math.max(0, Math.min(currentRight, previousRight) - Math.max(currentLeft, previousLeft));
}

function getSupportSpan() {
  // v0.2.3: 全段「お皿」を支持面とする。段数で変えない。
  return { left: CONFIG.plateSafeLeft, right: CONFIG.plateSafeRight };
}

function landActivePudding() {
  const pudding = state.activePudding;
  if (!pudding) {
    return;
  }

  const support = getSupportSpan();
  const supportCenter = (support.left + support.right) / 2;
  const supportHalf = Math.max(1, (support.right - support.left) / 2);

  // ★v0.2.2の核心：判定は「重心X（＝プリンの中心 pudding.x）が支持面の上にあるか」の1本だけ。
  //   - 重心が支持面の内側 → 傾きつきでセーフ（端ほど大きく傾くが、即アウトにしない）
  //   - 重心が支持面の外   → 滑り落ちてアウト
  // 「半分以上乗っていればセーフ」＝「中心が支持面の内側」と数学的に一致するので、これ1本で合格条件1〜4を満たす。
  const gravX = pudding.x;
  if (gravX < support.left || gravX > support.right) {
    triggerGameOver(pudding);
    return;
  }

  // 端に寄るほど大きく傾ける（重心が中なら留まる）。着地時に1回だけ確定＝永久ぷるぷる無し。
  const edgeRatio = clamp((gravX - supportCenter) / supportHalf, -1, 1);
  const tilt = edgeRatio * 1.2;

  state.stack.push({
    kind: pudding.kind,
    label: pudding.label,
    width: pudding.width,
    height: pudding.height,
    bodyColor: pudding.bodyColor,
    caramelColor: pudding.caramelColor,
    score: pudding.score,
    squish: pudding.squish,
    x: pudding.x,
    y: pudding.y,
    phase: pudding.phase,
    tilt
  });

  state.activePudding = null;

  if (state.stack.length >= CONFIG.goal) {
    state.mode = "clear";
    ui.message.textContent = "10段プリン完成！ Level 1 CLEAR!";
    updateHud();
    return;
  }

  spawnNewPudding(pudding.x);
  if (Math.abs(edgeRatio) > 0.7) {
    ui.message.textContent = `ぐらぐら！でも乗ってる、セーフ！次は${state.activePudding.label}です。`;
  } else {
    ui.message.textContent = `のせられた！次は${state.activePudding.label}です。`;
  }
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
    kind: failedPudding.kind,
    label: failedPudding.label,
    width: failedPudding.width,
    height: failedPudding.height,
    bodyColor: failedPudding.bodyColor,
    caramelColor: failedPudding.caramelColor,
    score: failedPudding.score,
    squish: failedPudding.squish,
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

  ctx.strokeStyle = "rgba(76, 122, 70, 0.76)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(CONFIG.plateSafeLeft - canvas.width / 2, -3);
  ctx.lineTo(CONFIG.plateSafeRight - canvas.width / 2, -3);
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
  const width = (getPuddingWidth(pudding) + wobble) * (pudding.squish || 1);
  const height = getPuddingHeight(pudding) / (pudding.squish || 1);
  const tilt = (pudding.tilt || 0) * 0.22 + wobble * 0.002;
  const x = pudding.x - width / 2;
  const y = pudding.y - height / 2;

  ctx.save();
  ctx.translate(pudding.x, pudding.y);
  ctx.rotate(tilt);
  ctx.translate(-pudding.x, -pudding.y);

  ctx.fillStyle = pudding.bodyColor || "#ffd86b";
  ctx.strokeStyle = "#43261c";
  ctx.lineWidth = 4;
  roundRect(x, y, width, height, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = pudding.caramelColor || "#8f4a20";
  roundRect(x + 15, y + 3, Math.max(20, width - 30), Math.max(9, height * 0.32), 8);
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

function drawTouchGuide() {
  if (state.mode !== "playing") {
    return;
  }

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#fff9df";
  ctx.fillRect(0, 0, canvas.width / 3, canvas.height);
  ctx.fillRect((canvas.width / 3) * 2, 0, canvas.width / 3, canvas.height);
  ctx.fillStyle = "#d83b2d";
  ctx.fillRect(canvas.width / 3, 0, canvas.width / 3, canvas.height);
  ctx.globalAlpha = 0.62;
  ctx.fillStyle = "#43261c";
  ctx.font = "700 22px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText("LEFT", canvas.width / 6, 38);
  ctx.fillText("DROP", canvas.width / 2, 38);
  ctx.fillText("RIGHT", (canvas.width / 6) * 5, 38);
  ctx.restore();
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

function drawVersion() {
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#43261c";
  ctx.font = "700 18px 'Courier New', monospace";
  ctx.textAlign = "right";
  ctx.fillText("v0.2.4", canvas.width - 12, canvas.height - 12);
  ctx.restore();
}

function draw() {
  drawBackground();
  drawTouchGuide();
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
  drawVersion();
}

function loop(timestamp) {
  if (!state.lastTime) {
    state.lastTime = timestamp;
  }

  // スマホで一時的にフレームが遅れても、時間差分に合わせて落下を進めます。
  // これで「何もしないと落ちてこない」ように見える状態を避けます。
  const elapsed = Math.max(0, timestamp - state.lastTime);
  const frameScale = clamp(elapsed / (1000 / 60), 0.5, 2.4);
  state.lastTime = timestamp;

  state.frame += frameScale;
  moveActivePudding(frameScale);
  updateFallingPudding(frameScale);
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

function clearTouchMovement() {
  state.keys.delete("TouchLeft");
  state.keys.delete("TouchRight");
}

function getTouchZone(clientX) {
  const rect = canvas.getBoundingClientRect();
  const localX = clientX - rect.left;
  if (localX < rect.width / 3) {
    return "left";
  }
  if (localX > (rect.width / 3) * 2) {
    return "right";
  }
  return "center";
}

function startCanvasTouch(event) {
  event.preventDefault();
  const zone = getTouchZone(event.clientX);
  state.touch = {
    pointerId: event.pointerId,
    zone,
    startX: event.clientX,
    startY: event.clientY,
    dropped: false
  };
  canvas.setPointerCapture(event.pointerId);
  clearTouchMovement();

  if (zone === "left") {
    setHeld("TouchLeft", true);
  } else if (zone === "right") {
    setHeld("TouchRight", true);
  }
}

function moveCanvasTouch(event) {
  if (!state.touch || state.touch.pointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  if (state.touch.zone !== "center") {
    return;
  }

  const deltaY = event.clientY - state.touch.startY;
  const deltaX = Math.abs(event.clientX - state.touch.startX);
  if (!state.touch.dropped && deltaY > 42 && deltaY > deltaX * 1.2) {
    state.touch.dropped = true;
    fastDrop();
  }
}

function endCanvasTouch(event) {
  if (state.touch && state.touch.pointerId === event.pointerId) {
    event.preventDefault();
    clearTouchMovement();
    state.touch = null;
  }
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
canvas.addEventListener("pointerdown", startCanvasTouch);
canvas.addEventListener("pointermove", moveCanvasTouch);
canvas.addEventListener("pointerup", endCanvasTouch);
canvas.addEventListener("pointercancel", endCanvasTouch);
canvas.addEventListener("pointerleave", endCanvasTouch);

resetGame();
requestAnimationFrame(loop);
