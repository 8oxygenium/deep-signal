const GAME_SECONDS = 30;
const MAX_POWER = 100;
const POWER_DRAIN_PER_SECOND = 5.2;
const PRESS_RECOVERY = 13;

const TROUBLES = [
  { name: "STEAM BURST!", damage: 8, message: "湯気がブワッ。フタがすこし浮いた！" },
  { name: "NOODLE WIGGLE!", damage: 7, message: "麺が暴れている。まだ早い！" },
  { name: "TOPPING ATTACK!", damage: 10, message: "具材が飛び出そうだ！" },
  { name: "HOT WATER WAVE!", damage: 15, message: "お湯の波がきた。これは熱い！" }
];

const state = {
  mode: "ready",
  timeLeft: GAME_SECONDS,
  lidPower: MAX_POWER,
  score: 0,
  elapsed: 0,
  nextTroubleAt: 3.5,
  lastTime: 0
};

const elements = {
  stage: document.getElementById("stage"),
  cup: document.getElementById("cup"),
  timeValue: document.getElementById("timeValue"),
  powerValue: document.getElementById("powerValue"),
  scoreValue: document.getElementById("scoreValue"),
  statusValue: document.getElementById("statusValue"),
  powerBar: document.getElementById("powerBar"),
  eventText: document.getElementById("eventText"),
  titleText: document.getElementById("titleText"),
  pressButton: document.getElementById("pressButton"),
  resetButton: document.getElementById("resetButton")
};

function resetGame() {
  state.mode = "playing";
  state.timeLeft = GAME_SECONDS;
  state.lidPower = MAX_POWER;
  state.score = 0;
  state.elapsed = 0;
  state.nextTroubleAt = randomTroubleDelay();
  state.lastTime = performance.now();
  elements.eventText.textContent = "HOLD THE LID! 30 SEC SURVIVAL";
  elements.titleText.textContent = "Space / PRESSでフタを守れ。";
  elements.stage.classList.remove("shake");
  elements.cup.classList.remove("game-over", "complete");
  updateUi();
}

function randomTroubleDelay() {
  return 2.4 + Math.random() * 3.4;
}

function pressLid() {
  if (state.mode === "gameOver" || state.mode === "complete") {
    return;
  }
  if (state.mode === "ready") {
    resetGame();
  }
  state.lidPower = clamp(state.lidPower + PRESS_RECOVERY, 0, MAX_POWER);
  elements.eventText.textContent = "PUSH! フタを押さえた。";
  elements.cup.classList.remove("loose");
  updateUi();
}

function update(timestamp) {
  if (!state.lastTime) {
    state.lastTime = timestamp;
  }
  const delta = Math.min(0.08, (timestamp - state.lastTime) / 1000);
  state.lastTime = timestamp;

  if (state.mode === "playing") {
    state.elapsed += delta;
    state.timeLeft = Math.max(0, GAME_SECONDS - state.elapsed);
    state.lidPower = clamp(state.lidPower - POWER_DRAIN_PER_SECOND * delta, 0, MAX_POWER);
    state.score += delta * 10 + (state.lidPower / MAX_POWER) * delta * 5;

    if (state.elapsed >= state.nextTroubleAt) {
      triggerTrouble();
      state.nextTroubleAt = state.elapsed + randomTroubleDelay();
    }

    if (state.lidPower <= 0) {
      gameOver();
    } else if (state.timeLeft <= 0) {
      completeGame();
    }

    updateUi();
  }

  requestAnimationFrame(update);
}

function triggerTrouble() {
  const trouble = TROUBLES[Math.floor(Math.random() * TROUBLES.length)];
  state.lidPower = clamp(state.lidPower - trouble.damage, 0, MAX_POWER);
  elements.eventText.textContent = trouble.name;
  elements.titleText.textContent = trouble.message;
  elements.stage.classList.remove("shake");
  void elements.stage.offsetWidth;
  elements.stage.classList.add("shake");
}

function gameOver() {
  state.mode = "gameOver";
  state.lidPower = 0;
  elements.cup.classList.remove("complete", "loose");
  elements.cup.classList.add("game-over");
  elements.stage.classList.remove("shake");
  void elements.stage.offsetWidth;
  elements.stage.classList.add("shake");
  elements.eventText.textContent = "フタがとんだ！";
  elements.titleText.textContent = "こぼれた！ RESETでやりなおし。";
  updateUi();
}

function completeGame() {
  state.mode = "complete";
  state.timeLeft = 0;
  state.score += state.lidPower * 4;
  elements.cup.classList.remove("game-over", "loose");
  elements.cup.classList.add("complete");
  elements.eventText.textContent = "COMPLETE!";
  elements.titleText.textContent = `${getTitle()} フタを守りきった！`;
  updateUi();
}

function getTitle() {
  if (state.lidPower >= 90) {
    return "PERFECT NOODLE!";
  }
  if (state.lidPower >= 65) {
    return "SOUP GUARDIAN!";
  }
  if (state.lidPower >= 35) {
    return "NICE CUP!";
  }
  return "A LITTLE SOFT...";
}

function updateUi() {
  elements.timeValue.textContent = state.timeLeft.toFixed(1);
  elements.powerValue.textContent = String(Math.round(state.lidPower));
  elements.scoreValue.textContent = String(Math.floor(state.score));
  elements.statusValue.textContent = state.mode === "gameOver" ? "GAME OVER" : state.mode.toUpperCase();
  elements.powerBar.style.width = `${state.lidPower}%`;
  elements.cup.classList.toggle("loose", state.lidPower < 45 && state.mode === "playing");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function handleKeydown(event) {
  if (event.code === "Space") {
    event.preventDefault();
    pressLid();
  } else if (event.key.toLowerCase() === "r") {
    resetGame();
  }
}

elements.pressButton.addEventListener("click", pressLid);
elements.pressButton.addEventListener("touchstart", (event) => {
  event.preventDefault();
  pressLid();
}, { passive: false });
elements.resetButton.addEventListener("click", resetGame);
elements.resetButton.addEventListener("touchstart", (event) => {
  event.preventDefault();
  resetGame();
}, { passive: false });
window.addEventListener("keydown", handleKeydown);

resetGame();
requestAnimationFrame(update);
