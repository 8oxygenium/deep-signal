const canvas = document.getElementById("omuriceCanvas");
const ctx = canvas.getContext("2d");
const messageEl = document.getElementById("message");
const ketchupCountEl = document.getElementById("ketchupCount");
const finishButton = document.getElementById("finishButton");
const resetButton = document.getElementById("resetButton");

const state = {
  drawing: false,
  strokes: [],
  currentStroke: null,
  ketchupPoints: 0,
  finished: false
};

const omurice = {
  x: canvas.width / 2,
  y: 270,
  radiusX: 245,
  radiusY: 132
};

function drawScene() {
  drawTable();
  drawPlate();
  drawOmurice();
  drawKetchup();
  drawSparkles();
}

function drawTable() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffeab0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(93, 62, 36, 0.12)";
  ctx.lineWidth = 2;
  for (let x = 0; x < canvas.width; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawPlate() {
  ctx.save();
  ctx.fillStyle = "#fff9df";
  ctx.strokeStyle = "#6b4a2f";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, 292, 310, 158, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#d7b768";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, 292, 280, 132, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawOmurice() {
  ctx.save();
  ctx.fillStyle = "#ffd75b";
  ctx.strokeStyle = "#7a4b21";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(omurice.x, omurice.y, omurice.radiusX, omurice.radiusY, -0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 248, 180, 0.5)";
  ctx.beginPath();
  ctx.ellipse(omurice.x - 70, omurice.y - 42, 92, 28, -0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(188, 113, 38, 0.45)";
  ctx.lineWidth = 3;
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(omurice.x - 150, omurice.y + i * 24);
    ctx.quadraticCurveTo(omurice.x, omurice.y - 24 + i * 12, omurice.x + 150, omurice.y + i * 18);
    ctx.stroke();
  }
  ctx.restore();
}

function drawKetchup() {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#c7352b";
  ctx.lineWidth = 14;
  ctx.shadowColor = "rgba(110, 28, 24, 0.35)";
  ctx.shadowBlur = 2;
  for (const stroke of state.strokes) {
    drawStroke(stroke);
  }
  if (state.currentStroke) {
    drawStroke(state.currentStroke);
  }
  ctx.restore();
}

function drawStroke(stroke) {
  if (!stroke || stroke.length < 1) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(stroke[0].x, stroke[0].y);
  for (let i = 1; i < stroke.length; i += 1) {
    ctx.lineTo(stroke[i].x, stroke[i].y);
  }
  ctx.stroke();
}

function drawSparkles() {
  ctx.save();
  ctx.fillStyle = "rgba(66, 108, 69, 0.5)";
  const sparkleCount = Math.min(8, Math.floor(state.ketchupPoints / 18));
  for (let i = 0; i < sparkleCount; i += 1) {
    const x = 95 + i * 78;
    const y = 80 + (i % 2) * 28;
    ctx.fillRect(x, y, 8, 8);
    ctx.fillRect(x + 3, y - 5, 2, 18);
    ctx.fillRect(x - 5, y + 3, 18, 2);
  }
  ctx.restore();
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const pointer = event.touches ? event.touches[0] : event;
  return {
    x: ((pointer.clientX - rect.left) / rect.width) * canvas.width,
    y: ((pointer.clientY - rect.top) / rect.height) * canvas.height
  };
}

function isOnOmurice(point) {
  const dx = (point.x - omurice.x) / omurice.radiusX;
  const dy = (point.y - omurice.y) / omurice.radiusY;
  return dx * dx + dy * dy <= 1;
}

function startDrawing(event) {
  const point = getCanvasPoint(event);
  if (!isOnOmurice(point)) {
    return;
  }
  event.preventDefault();
  state.finished = false;
  state.drawing = true;
  state.currentStroke = [point];
  messageEl.textContent = "いいね、そのままケチャップをのばしてみよう。";
  drawScene();
}

function continueDrawing(event) {
  if (!state.drawing || !state.currentStroke) {
    return;
  }
  const point = getCanvasPoint(event);
  event.preventDefault();
  if (!isOnOmurice(point)) {
    return;
  }
  const previous = state.currentStroke[state.currentStroke.length - 1];
  const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
  if (distance < 4) {
    return;
  }
  state.currentStroke.push(point);
  state.ketchupPoints += Math.min(8, distance / 8);
  updateMeter();
  drawScene();
}

function stopDrawing() {
  if (!state.drawing) {
    return;
  }
  state.drawing = false;
  if (state.currentStroke && state.currentStroke.length > 1) {
    state.strokes.push(state.currentStroke);
  }
  state.currentStroke = null;
  drawScene();
}

function updateMeter() {
  ketchupCountEl.textContent = String(Math.round(state.ketchupPoints));
}

function finishOmurice() {
  state.finished = true;
  const amount = state.ketchupPoints;
  const lines = state.strokes.length + (state.currentStroke ? 1 : 0);
  if (amount < 18) {
    messageEl.textContent = "ちょっとひかえめオムライス！もう少し描いてもおいしそう。";
  } else if (amount < 55 || lines < 2) {
    messageEl.textContent = "いい感じのケチャップライン！洋食屋さんの気配です。";
  } else if (amount < 105) {
    messageEl.textContent = "しあわせ満点オムライス！お皿の上がにこにこです。";
  } else {
    messageEl.textContent = "ケチャップの信号を受信しました！HAPOMUスペシャル完成。";
  }
  drawScene();
}

function resetGame() {
  state.drawing = false;
  state.strokes = [];
  state.currentStroke = null;
  state.ketchupPoints = 0;
  state.finished = false;
  messageEl.textContent = "オムライスの上にケチャップを描いてね。";
  updateMeter();
  drawScene();
}

canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", continueDrawing);
window.addEventListener("mouseup", stopDrawing);

canvas.addEventListener("touchstart", startDrawing, { passive: false });
canvas.addEventListener("touchmove", continueDrawing, { passive: false });
canvas.addEventListener("touchend", stopDrawing);
canvas.addEventListener("touchcancel", stopDrawing);

finishButton.addEventListener("click", finishOmurice);
resetButton.addEventListener("click", resetGame);

drawScene();
