(() => {
  "use strict";

  const VERSION = "v0.1.0";
  const VIEW_W = 960;
  const VIEW_H = 540;
  const MAP_SIZE = 300;
  const directions = [
    { x: 0, y: -1, name: "北", arrow: "↑" },
    { x: 1, y: 0, name: "東", arrow: "→" },
    { x: 0, y: 1, name: "南", arrow: "↓" },
    { x: -1, y: 0, name: "西", arrow: "←" }
  ];

  const mapRows = [
    "########",
    "#S..h..#",
    "#.##.#.#",
    "#..d.#.#",
    "##.#a#.#",
    "#n.c.#>#",
    "#......#",
    "########"
  ];

  const strongRoute = [
    { x: 6, y: 2 },
    { x: 6, y: 3 },
    { x: 6, y: 4 },
    { x: 6, y: 3 }
  ];

  const partyTemplate = [
    {
      name: "オムロウ",
      job: "はぽたま守り",
      role: "前衛 / 防御役",
      maxHp: 48,
      maxMp: 8,
      atk: 6
    },
    {
      name: "プニメディ",
      job: "ぷりん手当係",
      role: "回復 / 打たれ弱い",
      maxHp: 28,
      maxMp: 14,
      atk: 3
    },
    {
      name: "ケチャペン",
      job: "赤だれ書記",
      role: "攻撃 / MP少なめ",
      maxHp: 26,
      maxMp: 9,
      atk: 4
    }
  ];

  const els = {
    viewCanvas: document.getElementById("viewCanvas"),
    mapCanvas: document.getElementById("mapCanvas"),
    modeBadge: document.getElementById("modeBadge"),
    floorInfo: document.getElementById("floorInfo"),
    facingInfo: document.getElementById("facingInfo"),
    partyStatus: document.getElementById("partyStatus"),
    enemyStatus: document.getElementById("enemyStatus"),
    messageLog: document.getElementById("messageLog"),
    overlay: document.getElementById("overlay"),
    overlayKicker: document.getElementById("overlayKicker"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayBody: document.getElementById("overlayBody"),
    overlayPrimary: document.getElementById("overlayPrimary"),
    overlaySecondary: document.getElementById("overlaySecondary")
  };

  const viewCtx = els.viewCanvas.getContext("2d");
  const mapCtx = els.mapCanvas.getContext("2d");

  const state = {
    mode: "title",
    x: 1,
    y: 1,
    dir: 1,
    party: [],
    battle: null,
    visited: new Set(),
    memos: new Set(),
    revealedTraps: new Set(),
    defeatedEnemies: new Set(),
    doorOpen: false,
    chestOpen: false,
    trapSprung: false,
    strongDefeated: false,
    strongIndex: 0,
    steps: 0,
    log: []
  };

  function keyOf(x, y) {
    return `${x},${y}`;
  }

  function freshParty() {
    return partyTemplate.map((member) => ({
      ...member,
      hp: member.maxHp,
      mp: member.maxMp
    }));
  }

  function rawCell(x, y) {
    if (y < 0 || y >= mapRows.length || x < 0 || x >= mapRows[0].length) {
      return "#";
    }
    return mapRows[y][x];
  }

  function visibleCell(x, y) {
    const raw = rawCell(x, y);
    if (raw === "S") return ".";
    if (raw === "d" && state.doorOpen) return ".";
    return raw;
  }

  function isClosedDoor(x, y) {
    return rawCell(x, y) === "d" && !state.doorOpen;
  }

  function isWall(x, y) {
    return visibleCell(x, y) === "#";
  }

  function isWalkable(x, y) {
    const cell = visibleCell(x, y);
    return cell !== "#";
  }

  function addLog(message) {
    state.log.unshift(message);
    state.log = state.log.slice(0, 9);
  }

  function livingMembers() {
    return state.party.filter((member) => member.hp > 0);
  }

  function isPartyDown() {
    return livingMembers().length === 0;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function directionRight(dir) {
    return directions[(dir + 1) % directions.length];
  }

  function cellRelative(depth, side) {
    const forward = directions[state.dir];
    const right = directionRight(state.dir);
    return {
      x: state.x + forward.x * depth + right.x * side,
      y: state.y + forward.y * depth + right.y * side
    };
  }

  function currentStrongPosition() {
    if (state.strongDefeated) {
      return null;
    }
    return strongRoute[state.strongIndex];
  }

  function isStrongAt(x, y) {
    const strong = currentStrongPosition();
    return Boolean(strong && strong.x === x && strong.y === y);
  }

  function showOverlay(kicker, title, bodyHtml, primaryLabel, secondaryLabel) {
    els.overlayKicker.textContent = kicker;
    els.overlayTitle.textContent = title;
    els.overlayBody.innerHTML = bodyHtml;
    els.overlayPrimary.textContent = primaryLabel;
    els.overlaySecondary.textContent = secondaryLabel;
    els.overlaySecondary.classList.toggle("hidden", !secondaryLabel);
    els.overlay.classList.add("is-visible");
  }

  function hideOverlay() {
    els.overlay.classList.remove("is-visible");
  }

  function showTitle() {
    state.mode = "title";
    showOverlay(
      `${VERSION} prototype`,
      "はぽむギルドと給食樹の迷宮",
      `<p>きみたちは、前に進んでもいい。<br>でも、床の色くらいは見たほうがいい。</p>
       <p>1マスずつ進む一人称ダンジョンRPG風MVPです。固定1階層、手描きマップ、罠、強敵、ターン制戦闘があります。</p>`,
      "入部届を書く",
      ""
    );
    render();
  }

  function showPartyCreate() {
    state.mode = "party";
    const members = partyTemplate.map((member) => (
      `<article>
        <h3>${member.name}</h3>
        <p>${member.job}</p>
        <p>HP ${member.maxHp} / MP ${member.maxMp}</p>
        <p>${member.role}</p>
      </article>`
    )).join("");
    showOverlay(
      "party create",
      "固定3人で出発する",
      `<p>v0.1.0では、はじめての給食樹調査隊として3人だけ登録済みです。</p>
       <div class="party-preview">${members}</div>
       <p>通常攻撃だけでは、たぶん給食に負けます。防御、回復、MPを使い切る順番を考えてください。</p>`,
      "この3人で入る",
      "タイトルへ戻る"
    );
    render();
  }

  function startNewRun() {
    state.mode = "explore";
    state.x = 1;
    state.y = 1;
    state.dir = 1;
    state.party = freshParty();
    state.battle = null;
    state.visited = new Set([keyOf(1, 1)]);
    state.memos = new Set();
    state.revealedTraps = new Set();
    state.defeatedEnemies = new Set();
    state.doorOpen = false;
    state.chestOpen = false;
    state.trapSprung = false;
    state.strongDefeated = false;
    state.strongIndex = 0;
    state.steps = 0;
    state.log = [];
    hideOverlay();
    addLog("給食樹の1階。入口は、まだ帰り道のふりをしている。");
    addLog("右の小窓に、歩いた床だけが記録される。");
    render();
  }

  function retryRun() {
    startNewRun();
  }

  function showGameOver(reason) {
    state.mode = "gameover";
    showOverlay(
      "total wipe",
      "全滅",
      `<p>${reason}</p>
       <p>何が起きたか分かったなら、次は少しだけ強い。分からないなら、看板を読むところからです。</p>`,
      "リトライ",
      ""
    );
    render();
  }

  function showClear() {
    state.mode = "clear";
    showOverlay(
      "1F clear",
      "1階クリア",
      `<p>おめでとう。</p>
       <p>きみたちは1階で、ようやく迷子になれる資格を得た。</p>
       <p>v0.1.0の範囲はここまでです。</p>`,
      "もう一度入る",
      ""
    );
    render();
  }

  function advancePatrol() {
    if (state.strongDefeated || state.mode !== "explore") {
      return;
    }
    const nextIndex = (state.strongIndex + 1) % strongRoute.length;
    const next = strongRoute[nextIndex];
    if (next.x === state.x && next.y === state.y) {
      addLog("おひるね番長が鼻を鳴らした。きみのマスだけ、今は踏まないらしい。");
      return;
    }
    state.strongIndex = nextIndex;
  }

  function move(delta) {
    if (state.mode !== "explore") {
      addLog("いまは足を動かす場面ではない。");
      render();
      return;
    }

    const dir = directions[state.dir];
    const target = {
      x: state.x + dir.x * delta,
      y: state.y + dir.y * delta
    };

    if (isClosedDoor(target.x, target.y)) {
      addLog("丸い扉が、こちらの勇気だけを通してくれない。調べれば開くかもしれない。");
      render();
      return;
    }

    if (!isWalkable(target.x, target.y)) {
      addLog("壁だ。給食樹は、廊下と壁の区別だけは正確だ。");
      render();
      return;
    }

    if (isStrongAt(target.x, target.y)) {
      startBattle("strong");
      return;
    }

    state.x = target.x;
    state.y = target.y;
    state.steps += 1;
    state.visited.add(keyOf(state.x, state.y));

    const resolved = resolveCurrentCell();
    if (!resolved && state.mode === "explore") {
      advancePatrol();
    }
    render();
  }

  function turn(amount) {
    if (state.mode !== "explore") {
      addLog("いま向きを変えても、状況はあまり変わらない。");
      render();
      return;
    }
    state.dir = (state.dir + amount + directions.length) % directions.length;
    addLog(`${directions[state.dir].name}を向いた。`);
    advancePatrol();
    render();
  }

  function resolveCurrentCell() {
    const raw = rawCell(state.x, state.y);

    if (raw === "a" && !state.trapSprung) {
      state.trapSprung = true;
      state.revealedTraps.add(keyOf(state.x, state.y));
      addLog("足元のカラメルが沈んだ。");
      addLog("君たちは、あまさにだまされた。");
      state.party.forEach((member) => {
        if (member.hp > 0) {
          member.hp = Math.max(0, member.hp - 34);
        }
      });
      if (isPartyDown()) {
        showGameOver("あまい床は、やさしい床ではなかった。");
      }
      return true;
    }

    if (raw === "n" && !state.defeatedEnemies.has(keyOf(state.x, state.y))) {
      startBattle("normal");
      return true;
    }

    if (raw === ">") {
      showClear();
      return true;
    }

    if (raw === "c" && !state.chestOpen) {
      addLog("小さな宝箱がある。勝手に開くほど、親切ではない。");
    }

    if (raw === "h") {
      addLog("看板がある。読むか読まないかで、床の意味が変わる。");
    }

    return false;
  }

  function inspect() {
    if (state.mode === "battle") {
      addLog(`${state.battle.enemy.name}の予告: ${state.battle.enemy.intentText}`);
      render();
      return;
    }
    if (state.mode !== "explore") {
      activateOverlayPrimary();
      return;
    }

    const here = rawCell(state.x, state.y);
    const front = cellRelative(1, 0);
    const frontRaw = rawCell(front.x, front.y);

    if (here === "h" || frontRaw === "h") {
      addLog("看板: あまい床は、やさしい床とは限らない。");
      addLog("看板: 右の通路の番長は、きみが動くたび上下する。見てから進め。");
      advancePatrol();
      render();
      return;
    }

    if (isClosedDoor(front.x, front.y)) {
      state.doorOpen = true;
      addLog("丸い扉を押すと、給食当番の名札みたいな音で開いた。");
      advancePatrol();
      render();
      return;
    }

    if ((here === "c" || frontRaw === "c") && !state.chestOpen) {
      state.chestOpen = true;
      state.party.forEach((member) => {
        if (member.hp > 0) {
          member.hp = clamp(member.hp + 10, 0, member.maxHp);
          member.mp = clamp(member.mp + 2, 0, member.maxMp);
        }
      });
      addLog("宝箱にはミルク包帯が入っていた。HPとMPが少し戻った。");
      advancePatrol();
      render();
      return;
    }

    if (frontRaw === "a") {
      state.revealedTraps.add(keyOf(front.x, front.y));
      addLog("前の床は、やけにかわいい。かわいさは安全証明ではない。");
      advancePatrol();
      render();
      return;
    }

    if (isStrongAt(front.x, front.y)) {
      addLog("おひるね番長がいる。眠っている顔で、通路を取り締まっている。");
      addLog("近づくなら、マップ上の位置を見てからにしなさい。");
      advancePatrol();
      render();
      return;
    }

    if (frontRaw === ">") {
      addLog("出口だ。出られるときに出るのは、かなり高度な判断である。");
      advancePatrol();
      render();
      return;
    }

    addLog("調べた。すごい発見はない。すごくない発見は、たくさんある。");
    advancePatrol();
    render();
  }

  function toggleMemo() {
    if (state.mode !== "explore") {
      addLog("メモは迷宮でだけ増える。机の上では増えない。");
      render();
      return;
    }
    const key = keyOf(state.x, state.y);
    if (state.memos.has(key)) {
      state.memos.delete(key);
      addLog("このマスのメモを消した。忘れることも技術だ。");
    } else {
      state.memos.add(key);
      addLog("このマスにメモを書いた。字は少し曲がっている。");
    }
    advancePatrol();
    render();
  }

  function startBattle(kind) {
    const enemy = createEnemy(kind);
    state.mode = "battle";
    state.battle = {
      enemy,
      fixedKey: kind === "normal" ? keyOf(state.x, state.y) : "",
      partyDefending: false
    };
    addLog(`${enemy.name}が現れた。${enemy.opening}`);
    addLog(`予告: ${enemy.intentText}`);
    render();
  }

  function createEnemy(kind) {
    if (kind === "strong") {
      return {
        kind,
        name: "おひるね番長",
        maxHp: 96,
        hp: 96,
        turn: 0,
        weakness: "red",
        opening: "序盤の敵ではない顔をしている。",
        intent: "roll",
        intentText: "大きく寝返りをうつ"
      };
    }
    return {
      kind,
      name: "こげめパンケーキ",
      maxHp: 52,
      hp: 52,
      turn: 0,
      weakness: "red",
      opening: "焦げ目が、こちらを見ている。",
      intent: "poke",
      intentText: "前衛をつつく"
    };
  }

  function setEnemyIntent(enemy) {
    if (enemy.kind === "strong") {
      const cycle = enemy.turn % 3;
      if (cycle === 0) {
        enemy.intent = "roll";
        enemy.intentText = "大きく寝返りをうつ";
      } else if (cycle === 1) {
        enemy.intent = "snore";
        enemy.intentText = "いびきで全員をゆらす";
      } else {
        enemy.intent = "healer";
        enemy.intentText = "手当係をまくらで狙う";
      }
      return;
    }

    const cycle = enemy.turn % 3;
    if (cycle === 0) {
      enemy.intent = "poke";
      enemy.intentText = "前衛をつつく";
    } else if (cycle === 1) {
      enemy.intent = "burn";
      enemy.intentText = "焦げ目を濃くして全体攻撃";
    } else {
      enemy.intent = "healer";
      enemy.intentText = "手当係を狙う";
    }
  }

  function handleBattleCommand(action) {
    if (state.mode !== "battle") {
      addLog("いまは戦う相手がいない。空振りは、床に失礼だ。");
      render();
      return;
    }

    const battle = state.battle;
    const enemy = battle.enemy;
    battle.partyDefending = false;

    if (action === "flee") {
      const chance = enemy.kind === "strong" ? 0.42 : 0.68;
      if (Math.random() < chance) {
        addLog("逃げた。勝利ではないが、日記には書ける。");
        state.mode = "explore";
        state.battle = null;
        render();
        return;
      }
      addLog("逃げそこねた。足が、給食袋みたいに重い。");
      enemyAct();
      finishBattleTurn();
      return;
    }

    if (action === "attack") {
      let total = 0;
      livingMembers().forEach((member) => {
        total += member.atk;
      });
      total += Math.floor(Math.random() * 3);
      enemy.hp = Math.max(0, enemy.hp - total);
      addLog(`全員で攻撃。${enemy.name}に${total}ダメージ。`);
    } else if (action === "defend") {
      battle.partyDefending = true;
      addLog("全員で身を丸めた。痛い予定を、少しだけ先送りする。");
    } else if (action === "skill") {
      usePartySkill(enemy);
    } else if (action === "heal") {
      useHeal();
    } else {
      addLog("その命令は、戦闘メモには書いていない。");
    }

    if (enemy.hp <= 0) {
      winBattle();
      return;
    }

    enemyAct();
    finishBattleTurn();
  }

  function usePartySkill(enemy) {
    const guard = state.party[0];
    const mage = state.party[2];
    let acted = false;

    if (guard.hp > 0 && guard.mp >= 2) {
      guard.mp -= 2;
      state.battle.partyDefending = true;
      acted = true;
      addLog("オムロウは、ふっくら壁を作った。全体防御。");
    }

    if (mage.hp > 0 && mage.mp >= 3) {
      mage.mp -= 3;
      const damage = enemy.weakness === "red" ? 24 : 14;
      enemy.hp = Math.max(0, enemy.hp - damage);
      acted = true;
      addLog(`ケチャペンの赤だれ線。弱点に${damage}ダメージ。`);
    }

    if (!acted) {
      addLog("MPが足りない。気合いは、消費MPの代わりにならない。");
    }
  }

  function useHeal() {
    const healer = state.party[1];
    if (healer.hp <= 0) {
      addLog("プニメディは倒れている。守るべき理由が、床に書いてある。");
      return;
    }
    if (healer.mp < 4) {
      addLog("回復MPが足りない。甘いだけでは治らない。");
      return;
    }
    const target = livingMembers().sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
    healer.mp -= 4;
    const amount = 18;
    target.hp = clamp(target.hp + amount, 0, target.maxHp);
    addLog(`プニメディが${target.name}を手当。HPが${amount}戻った。`);
  }

  function enemyAct() {
    const battle = state.battle;
    const enemy = battle.enemy;
    const guarded = battle.partyDefending;

    if (enemy.intent === "poke") {
      damageMember(state.party[0], guarded ? 4 : 8, `${enemy.name}が前衛をつついた。`);
    } else if (enemy.intent === "burn") {
      addLog(`${enemy.name}の焦げ目がはじけた。`);
      state.party.forEach((member) => damageMember(member, guarded ? 6 : 16, ""));
    } else if (enemy.intent === "healer") {
      const healer = state.party[1].hp > 0 ? state.party[1] : livingMembers()[0];
      damageMember(healer, guarded ? 5 : 15, `${enemy.name}は手当係を狙った。`);
    } else if (enemy.intent === "roll") {
      addLog("おひるね番長の寝返り。廊下の幅いっぱい。");
      state.party.forEach((member) => damageMember(member, guarded ? 9 : 24, ""));
    } else if (enemy.intent === "snore") {
      addLog("おひるね番長のいびき。かわいい音ではない。");
      state.party.forEach((member) => damageMember(member, guarded ? 5 : 12, ""));
    }
  }

  function damageMember(member, amount, leadMessage) {
    if (!member || member.hp <= 0) {
      return;
    }
    if (leadMessage) {
      addLog(leadMessage);
    }
    member.hp = Math.max(0, member.hp - amount);
    if (member.hp === 0) {
      addLog(`${member.name}は倒れた。`);
    }
  }

  function finishBattleTurn() {
    if (isPartyDown()) {
      const reason = state.battle.enemy.kind === "strong"
        ? "おひるね番長は、まだ昼休みではなかった。"
        : "給食の小さな敵に、手順を教えられた。";
      showGameOver(reason);
      return;
    }
    state.battle.enemy.turn += 1;
    setEnemyIntent(state.battle.enemy);
    addLog(`予告: ${state.battle.enemy.intentText}`);
    render();
  }

  function winBattle() {
    const enemy = state.battle.enemy;
    addLog(`${enemy.name}を倒した。勝ったのではなく、手順を守った。`);
    if (enemy.kind === "strong") {
      state.strongDefeated = true;
      addLog("番長が寝直した。今日のところは通れる。");
    } else if (state.battle.fixedKey) {
      state.defeatedEnemies.add(state.battle.fixedKey);
    }
    state.mode = "explore";
    state.battle = null;
    render();
  }

  function activateOverlayPrimary() {
    if (state.mode === "title") {
      showPartyCreate();
    } else if (state.mode === "party") {
      startNewRun();
    } else if (state.mode === "gameover" || state.mode === "clear") {
      retryRun();
    }
  }

  function handleAction(action) {
    if (action === "forward") {
      move(1);
    } else if (action === "backward") {
      move(-1);
    } else if (action === "turnLeft") {
      turn(-1);
    } else if (action === "turnRight") {
      turn(1);
    } else if (action === "inspect") {
      inspect();
    } else if (action === "memo") {
      toggleMemo();
    } else if (["attack", "defend", "skill", "heal", "flee"].includes(action)) {
      handleBattleCommand(action);
    }
  }

  function render() {
    drawView();
    drawMap();
    renderStatus();
    renderLog();
    els.modeBadge.textContent = `${state.mode.toUpperCase()} / ${VERSION}`;
    els.floorInfo.textContent = `1F x${state.x + 1} y${state.y + 1}`;
    els.facingInfo.textContent = `${directions[state.dir].name}向き ${directions[state.dir].arrow}`;
  }

  function renderStatus() {
    els.partyStatus.innerHTML = state.party.map((member) => {
      const hpPercent = member.maxHp > 0 ? Math.round((member.hp / member.maxHp) * 100) : 0;
      const mpPercent = member.maxMp > 0 ? Math.round((member.mp / member.maxMp) * 100) : 0;
      return `<article class="member ${member.hp <= 0 ? "is-down" : ""}">
        <div class="member-head"><span>${member.name}</span><span class="role">${member.job}</span></div>
        <div class="bar hp"><span style="width:${hpPercent}%"></span></div>
        <div class="bar mp"><span style="width:${mpPercent}%"></span></div>
        <div class="numbers"><span>HP ${member.hp}/${member.maxHp}</span><span>MP ${member.mp}/${member.maxMp}</span></div>
      </article>`;
    }).join("");

    if (state.mode === "battle" && state.battle) {
      const enemy = state.battle.enemy;
      els.enemyStatus.innerHTML = `${enemy.name}<br>HP ${enemy.hp}/${enemy.maxHp}<br>予告: ${enemy.intentText}<br>弱点: 赤だれ系`;
    } else {
      const strong = currentStrongPosition();
      const strongText = strong ? `番長: x${strong.x + 1} y${strong.y + 1}` : "番長: 寝直し中";
      els.enemyStatus.textContent = `${strongText} / 歩いた床だけ記録中`;
    }
  }

  function renderLog() {
    els.messageLog.innerHTML = state.log.map((message) => `<li>${message}</li>`).join("");
  }

  function drawView() {
    viewCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    if (state.mode === "battle" && state.battle) {
      drawBattleView();
      return;
    }
    drawDungeonView();
  }

  function drawDungeonView() {
    const ctx = viewCtx;
    ctx.fillStyle = "#fff6cc";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#f0c06a";
    ctx.fillRect(0, VIEW_H * 0.52, VIEW_W, VIEW_H * 0.48);
    ctx.fillStyle = "#b96b34";
    ctx.fillRect(0, VIEW_H * 0.5 - 6, VIEW_W, 12);

    ctx.strokeStyle = "rgba(74, 42, 28, 0.25)";
    ctx.lineWidth = 2;
    for (let x = 0; x < VIEW_W; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, VIEW_H * 0.52);
      ctx.lineTo(x - 120, VIEW_H);
      ctx.stroke();
    }

    drawCorridor();
    drawVisibleObjects();
    drawCompass();
  }

  function rectForDepth(depth) {
    const rects = [
      { x: 18, y: 20, w: 924, h: 500 },
      { x: 150, y: 76, w: 660, h: 388 },
      { x: 302, y: 142, w: 356, h: 262 },
      { x: 410, y: 190, w: 140, h: 166 },
      { x: 466, y: 226, w: 28, h: 86 }
    ];
    return rects[depth];
  }

  function drawCorridor() {
    const ctx = viewCtx;
    for (let depth = 1; depth <= 3; depth += 1) {
      const outer = rectForDepth(depth - 1);
      const inner = rectForDepth(depth);
      const left = cellRelative(depth, -1);
      const right = cellRelative(depth, 1);
      const center = cellRelative(depth, 0);

      if (isWall(left.x, left.y)) {
        drawWallPoly([
          [outer.x, outer.y],
          [inner.x, inner.y],
          [inner.x, inner.y + inner.h],
          [outer.x, outer.y + outer.h]
        ], depth);
      }
      if (isWall(right.x, right.y)) {
        drawWallPoly([
          [outer.x + outer.w, outer.y],
          [inner.x + inner.w, inner.y],
          [inner.x + inner.w, inner.y + inner.h],
          [outer.x + outer.w, outer.y + outer.h]
        ], depth);
      }

      ctx.strokeStyle = "rgba(74, 42, 28, 0.38)";
      ctx.lineWidth = 3;
      ctx.strokeRect(inner.x, inner.y, inner.w, inner.h);

      if (isClosedDoor(center.x, center.y)) {
        drawDoor(depth);
        return;
      }

      if (isWall(center.x, center.y)) {
        drawFrontWall(depth);
        return;
      }
    }
  }

  function drawWallPoly(points, depth) {
    const ctx = viewCtx;
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point[0], point[1]);
      } else {
        ctx.lineTo(point[0], point[1]);
      }
    });
    ctx.closePath();
    ctx.fillStyle = depth % 2 === 0 ? "#d39a56" : "#e6ad62";
    ctx.fill();
    ctx.strokeStyle = "#4a2a1c";
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  function drawFrontWall(depth) {
    const ctx = viewCtx;
    const rect = rectForDepth(depth);
    ctx.fillStyle = "#d39a56";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = "#4a2a1c";
    ctx.lineWidth = 5;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    drawCrayonLines(rect.x, rect.y, rect.w, rect.h);
  }

  function drawCrayonLines(x, y, w, h) {
    const ctx = viewCtx;
    ctx.strokeStyle = "rgba(74, 42, 28, 0.22)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + 16 + i * 30, y + 10);
      ctx.lineTo(x + w - 24, y + 24 + i * 34);
      ctx.stroke();
    }
  }

  function drawDoor(depth) {
    const ctx = viewCtx;
    const rect = rectForDepth(depth);
    const padX = rect.w * 0.18;
    const padY = rect.h * 0.12;
    ctx.fillStyle = "#8f4a20";
    ctx.fillRect(rect.x + padX, rect.y + padY, rect.w - padX * 2, rect.h - padY);
    ctx.strokeStyle = "#2b1813";
    ctx.lineWidth = 5;
    ctx.strokeRect(rect.x + padX, rect.y + padY, rect.w - padX * 2, rect.h - padY);
    ctx.fillStyle = "#ffd86b";
    ctx.beginPath();
    ctx.arc(rect.x + rect.w * 0.67, rect.y + rect.h * 0.52, Math.max(5, 15 / depth), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff9df";
    ctx.font = `${Math.max(18, 42 / depth)}px Courier New`;
    ctx.textAlign = "center";
    ctx.fillText("まるい扉", rect.x + rect.w / 2, rect.y + rect.h * 0.28);
  }

  function drawVisibleObjects() {
    for (let depth = 3; depth >= 1; depth -= 1) {
      const center = cellRelative(depth, 0);
      if (isWall(center.x, center.y) || isClosedDoor(center.x, center.y)) {
        continue;
      }
      const raw = rawCell(center.x, center.y);
      if (isStrongAt(center.x, center.y)) {
        drawStrong(depth);
      } else if (raw === "h") {
        drawSign(depth);
      } else if (raw === "c" && !state.chestOpen) {
        drawChest(depth);
      } else if (raw === "a") {
        drawSweetFloor(depth);
      } else if (raw === "n" && !state.defeatedEnemies.has(keyOf(center.x, center.y))) {
        drawEnemy(depth);
      } else if (raw === ">") {
        drawExit(depth);
      }
    }
  }

  function objectAnchor(depth) {
    const rect = rectForDepth(depth);
    return {
      cx: rect.x + rect.w / 2,
      floor: rect.y + rect.h,
      scale: 1 / depth,
      rect
    };
  }

  function drawSign(depth) {
    const ctx = viewCtx;
    const anchor = objectAnchor(depth);
    const w = 150 * anchor.scale;
    const h = 76 * anchor.scale;
    const x = anchor.cx - w / 2;
    const y = anchor.floor - h - 36 * anchor.scale;
    ctx.fillStyle = "#3f7a4b";
    ctx.fillRect(anchor.cx - 8 * anchor.scale, y + h, 16 * anchor.scale, 44 * anchor.scale);
    ctx.fillStyle = "#fff9df";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#2b1813";
    ctx.lineWidth = Math.max(2, 4 * anchor.scale);
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "#9c2a20";
    ctx.font = `${Math.max(12, 24 * anchor.scale)}px Courier New`;
    ctx.textAlign = "center";
    ctx.fillText("よむ?", anchor.cx, y + h * 0.58);
  }

  function drawChest(depth) {
    const ctx = viewCtx;
    const anchor = objectAnchor(depth);
    const w = 150 * anchor.scale;
    const h = 82 * anchor.scale;
    const x = anchor.cx - w / 2;
    const y = anchor.floor - h - 20 * anchor.scale;
    ctx.fillStyle = "#8f4a20";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#ffd86b";
    ctx.fillRect(x, y, w, h * 0.35);
    ctx.strokeStyle = "#2b1813";
    ctx.lineWidth = Math.max(2, 4 * anchor.scale);
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "#d83b2d";
    ctx.fillRect(anchor.cx - 10 * anchor.scale, y + h * 0.42, 20 * anchor.scale, 20 * anchor.scale);
  }

  function drawSweetFloor(depth) {
    const ctx = viewCtx;
    const rect = rectForDepth(depth);
    ctx.fillStyle = "rgba(216, 59, 45, 0.18)";
    ctx.beginPath();
    ctx.ellipse(rect.x + rect.w / 2, rect.y + rect.h * 0.88, rect.w * 0.32, rect.h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d83b2d";
    ctx.lineWidth = Math.max(2, 5 / depth);
    ctx.stroke();
    ctx.fillStyle = "#8f4a20";
    ctx.font = `${Math.max(13, 26 / depth)}px Courier New`;
    ctx.textAlign = "center";
    ctx.fillText("あまい", rect.x + rect.w / 2, rect.y + rect.h * 0.88);
  }

  function drawEnemy(depth) {
    const ctx = viewCtx;
    const anchor = objectAnchor(depth);
    const r = 64 * anchor.scale;
    const y = anchor.floor - r - 26 * anchor.scale;
    ctx.fillStyle = "#f4be5a";
    ctx.beginPath();
    ctx.arc(anchor.cx, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2b1813";
    ctx.lineWidth = Math.max(2, 5 * anchor.scale);
    ctx.stroke();
    ctx.fillStyle = "#8f4a20";
    ctx.beginPath();
    ctx.arc(anchor.cx - r * 0.28, y - r * 0.12, r * 0.08, 0, Math.PI * 2);
    ctx.arc(anchor.cx + r * 0.28, y - r * 0.12, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d83b2d";
    ctx.beginPath();
    ctx.arc(anchor.cx, y + r * 0.1, r * 0.36, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }

  function drawStrong(depth) {
    const ctx = viewCtx;
    const anchor = objectAnchor(depth);
    const w = 170 * anchor.scale;
    const h = 120 * anchor.scale;
    const x = anchor.cx - w / 2;
    const y = anchor.floor - h - 20 * anchor.scale;
    ctx.fillStyle = "#8f4a20";
    ctx.beginPath();
    roundRect(ctx, x, y, w, h, 22 * anchor.scale);
    ctx.fill();
    ctx.strokeStyle = "#2b1813";
    ctx.lineWidth = Math.max(2, 5 * anchor.scale);
    ctx.stroke();
    ctx.fillStyle = "#fff1bf";
    ctx.beginPath();
    ctx.arc(anchor.cx - w * 0.2, y + h * 0.45, 8 * anchor.scale, 0, Math.PI * 2);
    ctx.arc(anchor.cx + w * 0.2, y + h * 0.45, 8 * anchor.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd86b";
    ctx.font = `${Math.max(12, 25 * anchor.scale)}px Courier New`;
    ctx.textAlign = "center";
    ctx.fillText("Zzz", anchor.cx, y + h * 0.22);
  }

  function drawExit(depth) {
    const ctx = viewCtx;
    const rect = rectForDepth(depth);
    ctx.fillStyle = "#3f7a4b";
    ctx.fillRect(rect.x + rect.w * 0.24, rect.y + rect.h * 0.14, rect.w * 0.52, rect.h * 0.7);
    ctx.strokeStyle = "#2b1813";
    ctx.lineWidth = Math.max(2, 5 / depth);
    ctx.strokeRect(rect.x + rect.w * 0.24, rect.y + rect.h * 0.14, rect.w * 0.52, rect.h * 0.7);
    ctx.fillStyle = "#fff9df";
    ctx.font = `${Math.max(16, 42 / depth)}px Courier New`;
    ctx.textAlign = "center";
    ctx.fillText("出口", rect.x + rect.w / 2, rect.y + rect.h * 0.52);
  }

  function drawCompass() {
    const ctx = viewCtx;
    ctx.fillStyle = "rgba(255, 249, 223, 0.9)";
    ctx.strokeStyle = "#2b1813";
    ctx.lineWidth = 3;
    roundRect(ctx, VIEW_W - 152, 18, 132, 54, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#4a2a1c";
    ctx.font = "700 24px Courier New";
    ctx.textAlign = "center";
    ctx.fillText(`${directions[state.dir].name} ${directions[state.dir].arrow}`, VIEW_W - 86, 53);
  }

  function drawBattleView() {
    const ctx = viewCtx;
    const enemy = state.battle.enemy;
    ctx.fillStyle = "#fff1bf";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#f0c06a";
    ctx.fillRect(0, VIEW_H * 0.57, VIEW_W, VIEW_H * 0.43);
    ctx.fillStyle = "rgba(216, 59, 45, 0.14)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (enemy.kind === "strong") {
      drawStrongBattle(enemy);
    } else {
      drawNormalBattle(enemy);
    }

    ctx.fillStyle = "rgba(255, 249, 223, 0.94)";
    ctx.strokeStyle = "#2b1813";
    ctx.lineWidth = 4;
    roundRect(ctx, 80, 34, 800, 86, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#4a2a1c";
    ctx.font = "700 28px Courier New";
    ctx.textAlign = "center";
    ctx.fillText(`${enemy.name}  HP ${enemy.hp}/${enemy.maxHp}`, VIEW_W / 2, 70);
    ctx.fillStyle = "#9c2a20";
    ctx.font = "700 22px Courier New";
    ctx.fillText(`予告: ${enemy.intentText}`, VIEW_W / 2, 102);
  }

  function drawNormalBattle(enemy) {
    drawEnemy(1);
    viewCtx.fillStyle = "#4a2a1c";
    viewCtx.font = "700 18px Courier New";
    viewCtx.textAlign = "center";
    viewCtx.fillText(enemy.name, VIEW_W / 2, 412);
  }

  function drawStrongBattle(enemy) {
    drawStrong(1);
    viewCtx.fillStyle = "#4a2a1c";
    viewCtx.font = "700 18px Courier New";
    viewCtx.textAlign = "center";
    viewCtx.fillText(enemy.name, VIEW_W / 2, 426);
  }

  function drawMap() {
    const ctx = mapCtx;
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    ctx.fillStyle = "#fff9df";
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    const cols = mapRows[0].length;
    const rows = mapRows.length;
    const cell = Math.floor((MAP_SIZE - 28) / cols);
    const ox = Math.floor((MAP_SIZE - cell * cols) / 2);
    const oy = Math.floor((MAP_SIZE - cell * rows) / 2);

    ctx.strokeStyle = "rgba(74, 42, 28, 0.18)";
    ctx.lineWidth = 1;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        ctx.strokeRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    }

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const key = keyOf(x, y);
        if (!state.visited.has(key)) {
          continue;
        }
        const raw = rawCell(x, y);
        const px = ox + x * cell;
        const py = oy + y * cell;
        ctx.fillStyle = raw === "a" ? "#ffd2b5" : "#fffdf0";
        ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
        ctx.strokeStyle = "#4a2a1c";
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 2, py + 2, cell - 4, cell - 4);

        let mark = "";
        if (raw === "h") mark = "看";
        if (raw === "d") mark = state.doorOpen ? "開" : "扉";
        if (raw === "c") mark = state.chestOpen ? "済" : "箱";
        if (raw === "a" && (state.trapSprung || state.revealedTraps.has(key))) mark = "甘";
        if (raw === "n" && !state.defeatedEnemies.has(key)) mark = "敵";
        if (raw === ">") mark = "出";
        if (mark) {
          drawMapText(mark, px + cell / 2, py + cell / 2 + 5, cell * 0.4, "#8f4a20");
        }
      }
    }

    state.memos.forEach((memoKey) => {
      const [x, y] = memoKey.split(",").map(Number);
      const px = ox + x * cell;
      const py = oy + y * cell;
      drawMapText("メ", px + cell / 2, py + cell / 2 + 5, cell * 0.42, "#3f7a4b");
    });

    const strong = currentStrongPosition();
    if (strong) {
      const sx = ox + strong.x * cell;
      const sy = oy + strong.y * cell;
      ctx.fillStyle = "#d83b2d";
      ctx.beginPath();
      ctx.arc(sx + cell / 2, sy + cell / 2, cell * 0.36, 0, Math.PI * 2);
      ctx.fill();
      drawMapText("番", sx + cell / 2, sy + cell / 2 + 5, cell * 0.38, "#fff9df");
    }

    const px = ox + state.x * cell;
    const py = oy + state.y * cell;
    ctx.fillStyle = "#3f7a4b";
    ctx.beginPath();
    if (state.dir === 0) {
      ctx.moveTo(px + cell / 2, py + 4);
      ctx.lineTo(px + cell - 5, py + cell - 5);
      ctx.lineTo(px + 5, py + cell - 5);
    } else if (state.dir === 1) {
      ctx.moveTo(px + cell - 4, py + cell / 2);
      ctx.lineTo(px + 5, py + 5);
      ctx.lineTo(px + 5, py + cell - 5);
    } else if (state.dir === 2) {
      ctx.moveTo(px + cell / 2, py + cell - 4);
      ctx.lineTo(px + cell - 5, py + 5);
      ctx.lineTo(px + 5, py + 5);
    } else {
      ctx.moveTo(px + 4, py + cell / 2);
      ctx.lineTo(px + cell - 5, py + 5);
      ctx.lineTo(px + cell - 5, py + cell - 5);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#2b1813";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawMapText(text, x, y, size, color) {
    mapCtx.fillStyle = color;
    mapCtx.font = `700 ${Math.max(12, size)}px Courier New`;
    mapCtx.textAlign = "center";
    mapCtx.fillText(text, x, y);
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  document.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action));
    button.addEventListener("pointerdown", () => button.classList.add("is-pressed"));
    button.addEventListener("pointerup", () => button.classList.remove("is-pressed"));
    button.addEventListener("pointerleave", () => button.classList.remove("is-pressed"));
    button.addEventListener("pointercancel", () => button.classList.remove("is-pressed"));
  });

  els.overlayPrimary.addEventListener("click", activateOverlayPrimary);
  els.overlaySecondary.addEventListener("click", () => {
    if (state.mode === "party") {
      showTitle();
    } else {
      retryRun();
    }
  });

  window.addEventListener("keydown", (event) => {
    const key = event.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Enter"].includes(key)) {
      event.preventDefault();
    }
    if (key === "w" || key === "W" || key === "ArrowUp") {
      handleAction("forward");
    } else if (key === "s" || key === "S" || key === "ArrowDown") {
      handleAction("backward");
    } else if (key === "a" || key === "A" || key === "ArrowLeft") {
      handleAction("turnLeft");
    } else if (key === "d" || key === "D" || key === "ArrowRight") {
      handleAction("turnRight");
    } else if (key === " " || key === "Enter") {
      if (state.mode === "battle") {
        handleBattleCommand("attack");
      } else {
        inspect();
      }
    } else if (key === "m" || key === "M") {
      toggleMemo();
    } else if (key === "r" || key === "R") {
      retryRun();
    }
  });

  state.party = freshParty();
  showTitle();
})();
