const HANDS = ["GUU", "CHOKI", "PAA"];
const RIVALS = [
  "OMURICE-SAN",
  "CUP RAMEN KUN",
  "KETCHUP BOTTLE",
  "TAMAGO-CHAN",
  "EBI FRY MASTER",
  "SIGNAL CORE"
];
const COMMENTS = {
  win: ["OMU COIN GET!", "KITCHEN WIN!", "HOT PLATE VICTORY!"],
  lose: ["THE LID IS STRONG!", "TRY AGAIN!", "COIN SLOT IS HUNGRY!"],
  draw: ["DRAW! ONE MORE PON!", "AIKO DE PON!", "SAME HAND DETECTED!"],
  signal: ["SIGNAL JANKEN DETECTED!"]
};

const state = {
  life: 3,
  omuCoin: 0,
  streak: 0,
  mode: "ready",
  rival: "INSERT COIN",
  rouletteTimer: null,
  rouletteIndex: 0
};

const elements = {
  playerHand: document.getElementById("playerHand"),
  cpuHand: document.getElementById("cpuHand"),
  playerIcon: document.getElementById("playerIcon"),
  cpuIcon: document.getElementById("cpuIcon"),
  rivalName: document.getElementById("rivalName"),
  resultText: document.getElementById("resultText"),
  commentText: document.getElementById("commentText"),
  coinValue: document.getElementById("coinValue"),
  lifeValue: document.getElementById("lifeValue"),
  streakValue: document.getElementById("streakValue"),
  resetButton: document.getElementById("resetButton"),
  handButtons: Array.from(document.querySelectorAll(".hand-button")),
  lamps: {
    JAN: document.getElementById("lampJan"),
    KEN: document.getElementById("lampKen"),
    PON: document.getElementById("lampPon")
  }
};

function resetGame() {
  stopCpuRoulette();
  state.life = 3;
  state.omuCoin = 0;
  state.streak = 0;
  state.mode = "ready";
  state.rival = pickRival();
  clearLamps();
  setHandDisplay("player", null, "READY");
  setHandDisplay("cpu", null, "???");
  setResultState("");
  elements.resultText.textContent = "INSERT COIN";
  elements.commentText.textContent = "じゃん・けん・ぽんでCPUが止まるよ";
  updateUi();
}

function pickRival() {
  return RIVALS[Math.floor(Math.random() * RIVALS.length)];
}

function setButtonsEnabled(enabled) {
  for (const button of elements.handButtons) {
    button.disabled = !enabled;
  }
}

function clearLamps() {
  Object.values(elements.lamps).forEach((lamp) => lamp.classList.remove("active"));
}

function lightLamp(name) {
  clearLamps();
  elements.lamps[name].classList.add("active");
  elements.resultText.textContent = name === "PON" ? "PON!" : `${name}...`;
}

function setResultState(result) {
  elements.resultText.classList.remove("win", "lose", "draw");
  if (result) {
    elements.resultText.classList.add(result);
  }
}

function setHandDisplay(side, hand, label) {
  const textEl = side === "player" ? elements.playerHand : elements.cpuHand;
  const iconEl = side === "player" ? elements.playerIcon : elements.cpuIcon;
  textEl.textContent = label || hand || "???";
  iconEl.className = "hand-icon";
  if (!hand) {
    iconEl.classList.add("hidden");
    return;
  }
  iconEl.classList.add(hand.toLowerCase());
}

function flashHands() {
  for (const icon of [elements.playerIcon.parentElement, elements.cpuIcon.parentElement]) {
    icon.classList.remove("flash");
    void icon.offsetWidth;
    icon.classList.add("flash");
  }
}

function updateUi() {
  elements.coinValue.textContent = String(state.omuCoin);
  elements.lifeValue.textContent = String(state.life);
  elements.streakValue.textContent = String(state.streak);
  elements.rivalName.textContent = state.rival;
  setButtonsEnabled(state.mode !== "playing" && state.mode !== "gameOver");
}

function chooseHand(playerHand) {
  if (state.mode === "playing" || state.mode === "gameOver") {
    return;
  }
  state.mode = "playing";
  state.rival = state.rival === "INSERT COIN" ? pickRival() : state.rival;
  setResultState("");
  setHandDisplay("player", playerHand);
  setHandDisplay("cpu", null, "???");
  elements.commentText.textContent = "";
  updateUi();

  runJankenSequence(playerHand);
}

function runJankenSequence(playerHand) {
  const finalCpuHand = HANDS[Math.floor(Math.random() * HANDS.length)];
  setTimeout(() => {
    lightLamp("JAN");
    startCpuRoulette();
  }, 120);
  setTimeout(() => lightLamp("KEN"), 680);
  setTimeout(() => {
    lightLamp("PON");
    stopCpuRoulette();
    setHandDisplay("cpu", finalCpuHand);
    flashHands();
  }, 1380);
  setTimeout(() => resolveRound(playerHand, finalCpuHand), 1580);
}

function startCpuRoulette() {
  stopCpuRoulette();
  state.rouletteIndex = 0;
  state.rouletteTimer = setInterval(() => {
    const hand = HANDS[state.rouletteIndex % HANDS.length];
    state.rouletteIndex += 1;
    setHandDisplay("cpu", hand);
    elements.cpuIcon.parentElement.classList.toggle("roulette-flash");
  }, 95);
}

function stopCpuRoulette() {
  if (state.rouletteTimer) {
    clearInterval(state.rouletteTimer);
    state.rouletteTimer = null;
  }
  elements.cpuIcon.parentElement.classList.remove("roulette-flash");
}

function resolveRound(playerHand, fixedCpuHand) {
  stopCpuRoulette();
  const cpuHand = fixedCpuHand || HANDS[Math.floor(Math.random() * HANDS.length)];
  const result = judge(playerHand, cpuHand);
  setHandDisplay("player", playerHand);
  setHandDisplay("cpu", cpuHand);
  setResultState(result);
  flashHands();

  if (result === "win") {
    state.omuCoin += 1;
    state.streak += 1;
    elements.resultText.textContent = "YOU WIN!";
    elements.commentText.textContent = pickComment("win");
    if (state.streak > 0 && state.streak % 3 === 0) {
      state.omuCoin += 2;
      elements.commentText.textContent = "STREAK BONUS! OMU COIN +2";
    }
  } else if (result === "lose") {
    state.life -= 1;
    state.streak = 0;
    elements.resultText.textContent = state.life <= 0 ? "GAME OVER" : "YOU LOSE!";
    elements.commentText.textContent = pickLoseComment();
  } else {
    elements.resultText.textContent = "DRAW!";
    elements.commentText.textContent = pickComment("draw");
  }

  state.mode = state.life <= 0 ? "gameOver" : "ready";
  updateUi();
}

function judge(player, cpu) {
  if (player === cpu) {
    return "draw";
  }
  if (
    (player === "GUU" && cpu === "CHOKI") ||
    (player === "CHOKI" && cpu === "PAA") ||
    (player === "PAA" && cpu === "GUU")
  ) {
    return "win";
  }
  return "lose";
}

function pickComment(kind) {
  const list = COMMENTS[kind];
  return list[Math.floor(Math.random() * list.length)];
}

function pickLoseComment() {
  if (state.rival === "SIGNAL CORE") {
    return COMMENTS.signal[0];
  }
  return pickComment("lose");
}

function handleKeydown(event) {
  if (event.key === "1") {
    chooseHand("GUU");
  } else if (event.key === "2") {
    chooseHand("CHOKI");
  } else if (event.key === "3") {
    chooseHand("PAA");
  } else if (event.key.toLowerCase() === "r") {
    resetGame();
  }
}

for (const button of elements.handButtons) {
  button.addEventListener("click", () => chooseHand(button.dataset.hand));
  button.addEventListener("touchstart", (event) => {
    event.preventDefault();
    chooseHand(button.dataset.hand);
  }, { passive: false });
}

elements.resetButton.addEventListener("click", resetGame);
elements.resetButton.addEventListener("touchstart", (event) => {
  event.preventDefault();
  resetGame();
}, { passive: false });
window.addEventListener("keydown", handleKeydown);

resetGame();
