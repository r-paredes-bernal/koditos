const canvas = document.querySelector("#game");
const context = canvas.getContext("2d");
const titleElement = document.querySelector(".hud h1");
const leftScoreElement = document.querySelector("#left-score");
const rightScoreElement = document.querySelector("#right-score");
const statusElement = document.querySelector("#status");
const instructionsElement = document.querySelector("#instructions");
const pauseButton = document.querySelector("#pause-button");
const resetButton = document.querySelector("#reset-button");
const powerHitButton = document.querySelector("#power-hit-button");
const modeButtons = document.querySelectorAll(".mode-button[data-mode]");
const difficultyButtons = document.querySelectorAll(".difficulty-button[data-difficulty]");

const GAME_CONFIG = {
  title: "Padel Arcade",
  defaultMode: "single",
  defaultDifficulty: "easy",
  winningScore: 3,
  court: {
    paddleWidth: 14,
    paddleHeight: 92,
    paddleMargin: 30,
    netGap: 42,
  },
  ball: {
    size: 14,
    baseVelocityX: 330,
    minVelocityY: 90,
    randomVelocityY: 180,
    maxSpeed: 760,
    speedBoostStep: 0.08,
    maxSpeedBoost: 1.55,
  },
  paddles: {
    speed: 420,
    leftColor: "#8dffb0",
    rightColor: "#50d8ff",
  },
  powerHit: {
    maxPowerBoost: 0.42,
    duration: 0.45,
    cooldownDuration: 1.15,
    boost: 0.36,
  },
  directionShift: {
    duration: 0.45,
    initialSpawnTime: 2.5,
    size: 28,
    minRespawnTime: 7,
    randomRespawnTime: 4,
    spawnRangeX: 180,
    spawnRangeY: 220,
    color: "#b96cff",
  },
  difficulties: {
    easy: {
      label: "Facil",
      aiBaseSpeed: 170,
      aiScoreBoost: 6,
      aiHorizontalFactor: 0.6,
      mistakeRange: 150,
      mistakeMinTime: 0.45,
      mistakeRandomTime: 0.65,
      aiPowerHitChance: 0,
    },
    medium: {
      label: "Medio",
      aiBaseSpeed: 205,
      aiScoreBoost: 8,
      aiHorizontalFactor: 0.7,
      mistakeRange: 115,
      mistakeMinTime: 0.55,
      mistakeRandomTime: 0.7,
      aiPowerHitChance: 0.35,
    },
    advanced: {
      label: "Avanzado",
      aiBaseSpeed: 230,
      aiScoreBoost: 10,
      aiHorizontalFactor: 0.8,
      mistakeRange: 92,
      mistakeMinTime: 0.65,
      mistakeRandomTime: 0.75,
      aiPowerHitChance: 0.65,
    },
  },
  modes: {
    single: {
      label: "1 jugador",
      instructions: "1 jugador: flechas o dedo para mover, Shift o boton para pegar con fuerza. Dificultad {difficulty}.",
      startMessage: "1 jugador: flechas y Shift contra la maquina.",
    },
    two: {
      label: "2 jugadores",
      instructions: "2 jugadores: izquierda W/A/S/D + Q para pegar fuerte, derecha flechas + Shift para pegar fuerte.",
      startMessage: "2 jugadores: W/A/S/D + Q y Flechas + Shift.",
    },
  },
  colors: {
    courtBackground: "#02040a",
    sideZone: "rgba(80, 216, 255, 0.12)",
    courtLine: "rgba(47, 156, 255, 0.5)",
    netLine: "rgba(247, 247, 251, 0.5)",
    paddleStroke: "#f7f7fb",
    paddleCutout: "#02040a",
    powerGlow: "#ffd447",
    ball: "#ffd447",
    userPoint: "#8dffb0",
    rivalPoint: "#ff4b67",
    overlay: "rgba(0, 0, 0, 0.62)",
    overlayTitle: "#ffd447",
    overlayText: "#f7f7fb",
  },
  messages: {
    paused: "Pausa. Espacio para continuar.",
    playing: "Partida en curso.",
    powerHit: "Golpe fuerte!",
    leftWins: "Gana jugador 1. Enter para reiniciar.",
    rightWins: "Gana jugador 2. Enter para reiniciar.",
    point: "Punto. Sigue jugando.",
    directionShift: "Cambio de direccion!",
    leftWallReturn: "Devolucion con pared izquierda.",
    rightWallReturn: "Devolucion con pared derecha.",
    leftWall: "Pared izquierda. La pelota vuelve a la otra cancha.",
    rightWall: "Pared derecha. La pelota vuelve a la otra cancha.",
    leftNetMiss: "Cruzo la red sin respuesta del lado izquierdo.",
    rightNetMiss: "Cruzo la red sin respuesta del lado derecho.",
    pointUser: "PUNTO!",
    pointRival: "PUNTO RIVAL",
    pointPlayerOne: "PUNTO J1",
    pointPlayerTwo: "PUNTO J2",
    overlayPaused: "PAUSA",
    overlayGameOver: "GAME OVER",
    overlayPauseHint: "Espacio para continuar",
    overlayWin: "¡Has ganado!",
    overlayLose: "Suerte para la proxima",
    overlayRestartHint: "Enter para reiniciar",
  },
};

const keys = new Set();
const paddleWidth = GAME_CONFIG.court.paddleWidth;
const paddleHeight = GAME_CONFIG.court.paddleHeight;
const paddleMargin = GAME_CONFIG.court.paddleMargin;
const ballSize = GAME_CONFIG.ball.size;
const winningScore = GAME_CONFIG.winningScore;
const netGap = GAME_CONFIG.court.netGap;
const maxPowerBoost = GAME_CONFIG.powerHit.maxPowerBoost;
const maxBallSpeed = GAME_CONFIG.ball.maxSpeed;
const powerHitDuration = GAME_CONFIG.powerHit.duration;
const powerHitCooldownDuration = GAME_CONFIG.powerHit.cooldownDuration;
const powerHitBoost = GAME_CONFIG.powerHit.boost;
const directionShiftDuration = GAME_CONFIG.directionShift.duration;
const difficultySettings = GAME_CONFIG.difficulties;

let mode = GAME_CONFIG.defaultMode;
let difficulty = GAME_CONFIG.defaultDifficulty;
let gameState = "playing";
let lastTime = 0;
let leftScore = 0;
let rightScore = 0;
let lastBackWallHit = null;
let assistedWallReturn = null;
let aiMistakeTimer = 0;
let aiTargetOffset = 0;
let aiPowerHitDecisionTimer = 0;
let pointEffect = null;
let matchWinner = null;
let directionShiftTimer = 0;
let powerUpSpawnTimer = GAME_CONFIG.directionShift.initialSpawnTime;
let dashEffects = [];
let touchControl = null;

function applyGameConfig() {
  document.title = `${GAME_CONFIG.title} | IXMAIA Arcade`;
  titleElement.textContent = GAME_CONFIG.title;

  difficultyButtons.forEach((button) => {
    const settings = difficultySettings[button.dataset.difficulty];

    if (!settings) {
      return;
    }

    button.textContent = settings.label;
  });

  modeButtons.forEach((button) => {
    const settings = GAME_CONFIG.modes[button.dataset.mode];

    if (!settings) {
      return;
    }

    button.textContent = settings.label;
  });
}

const dashCooldowns = {
  left: 0,
  right: 0,
};

const dashRequests = {
  left: false,
  right: false,
};

const directionPowerUp = {
  active: false,
  x: canvas.width / 2 - GAME_CONFIG.directionShift.size / 2,
  y: canvas.height / 2 - GAME_CONFIG.directionShift.size / 2,
  size: GAME_CONFIG.directionShift.size,
};

const leftPaddle = {
  x: paddleMargin,
  y: canvas.height / 2 - paddleHeight / 2,
  speed: GAME_CONFIG.paddles.speed,
  vx: 0,
  vy: 0,
  powerHitTimer: 0,
};

const rightPaddle = {
  x: canvas.width - paddleMargin - paddleWidth,
  y: canvas.height / 2 - paddleHeight / 2,
  speed: GAME_CONFIG.paddles.speed,
  vx: 0,
  vy: 0,
  powerHitTimer: 0,
};

const ball = {
  x: canvas.width / 2 - ballSize / 2,
  y: canvas.height / 2 - ballSize / 2,
  vx: GAME_CONFIG.ball.baseVelocityX,
  vy: GAME_CONFIG.ball.minVelocityY + 100,
  speedBoost: 1,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateHud(message) {
  leftScoreElement.textContent = leftScore;
  rightScoreElement.textContent = rightScore;
  statusElement.textContent = message;
  instructionsElement.textContent =
    mode === "single"
      ? GAME_CONFIG.modes.single.instructions.replace("{difficulty}", difficultySettings[difficulty].label)
      : GAME_CONFIG.modes.two.instructions;
  pauseButton.textContent = gameState === "paused" ? "Continuar" : "Pausar";
}

function updateModeButtons() {
  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === mode;
    button.classList.toggle("mode-button--active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function resetBall(direction = Math.random() > 0.5 ? 1 : -1) {
  ball.x = canvas.width / 2 - ballSize / 2;
  ball.y = canvas.height / 2 - ballSize / 2;
  ball.speedBoost = 1;
  lastBackWallHit = null;
  assistedWallReturn = null;
  ball.vx = GAME_CONFIG.ball.baseVelocityX * direction;
  ball.vy =
    (Math.random() * GAME_CONFIG.ball.randomVelocityY + GAME_CONFIG.ball.minVelocityY) *
    (Math.random() > 0.5 ? 1 : -1);
}

function resetRound() {
  leftPaddle.x = paddleMargin;
  leftPaddle.y = canvas.height / 2 - paddleHeight / 2;
  leftPaddle.vx = 0;
  leftPaddle.vy = 0;
  leftPaddle.powerHitTimer = 0;
  rightPaddle.x = canvas.width - paddleMargin - paddleWidth;
  rightPaddle.y = canvas.height / 2 - paddleHeight / 2;
  rightPaddle.vx = 0;
  rightPaddle.vy = 0;
  rightPaddle.powerHitTimer = 0;
  resetBall();
}

function updateDifficultyButtons() {
  difficultyButtons.forEach((button) => {
    const isActive = button.dataset.difficulty === difficulty;
    button.classList.toggle("difficulty-button--active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function newGame() {
  leftScore = 0;
  rightScore = 0;
  matchWinner = null;
  directionShiftTimer = 0;
  powerUpSpawnTimer = GAME_CONFIG.directionShift.initialSpawnTime;
  directionPowerUp.active = false;
  dashCooldowns.left = 0;
  dashCooldowns.right = 0;
  dashRequests.left = false;
  dashRequests.right = false;
  dashEffects = [];
  aiPowerHitDecisionTimer = 0;
  gameState = "playing";
  resetRound();
  updateHud(GAME_CONFIG.modes[mode].startMessage);
}

function setMode(nextMode) {
  mode = nextMode;
  updateModeButtons();
  newGame();
}

function limitBallSpeed() {
  const speed = Math.hypot(ball.vx, ball.vy);

  if (speed <= maxBallSpeed) {
    return;
  }

  const ratio = maxBallSpeed / speed;
  ball.vx *= ratio;
  ball.vy *= ratio;
}

function setDifficulty(nextDifficulty) {
  difficulty = nextDifficulty;
  aiMistakeTimer = 0;
  aiTargetOffset = 0;
  aiPowerHitDecisionTimer = 0;
  updateDifficultyButtons();
  newGame();
}

function togglePause() {
  if (gameState !== "playing" && gameState !== "paused") {
    return;
  }

  gameState = gameState === "playing" ? "paused" : "playing";
  updateHud(gameState === "paused" ? GAME_CONFIG.messages.paused : GAME_CONFIG.messages.playing);
}

function movePaddles(deltaTime) {
  const leftStartX = leftPaddle.x;
  const leftStartY = leftPaddle.y;
  const rightStartX = rightPaddle.x;
  const rightStartY = rightPaddle.y;

  if (mode === "single") {
    const aiSettings = difficultySettings[difficulty];

    aiMistakeTimer -= deltaTime;

    if (aiMistakeTimer <= 0) {
      aiMistakeTimer = aiSettings.mistakeMinTime + Math.random() * aiSettings.mistakeRandomTime;
      aiTargetOffset = (Math.random() - 0.5) * aiSettings.mistakeRange;
    }

    const target = ball.y + ballSize / 2 - paddleHeight / 2 + aiTargetOffset;
    const targetX = ball.vx < 0 ? clamp(ball.x - 64, paddleMargin, canvas.width / 2 - netGap - paddleWidth) : paddleMargin;
    const aiSpeed = aiSettings.aiBaseSpeed + Math.min(leftScore + rightScore, 6) * aiSettings.aiScoreBoost;
    const distance = target - leftPaddle.y;
    const step = Math.sign(distance) * Math.min(Math.abs(distance), aiSpeed * deltaTime);
    const distanceX = targetX - leftPaddle.x;
    const stepX = Math.sign(distanceX) * Math.min(Math.abs(distanceX), aiSpeed * aiSettings.aiHorizontalFactor * deltaTime);
    leftPaddle.y += step;
    leftPaddle.x += stepX;
    aiPowerHitDecisionTimer = Math.max(0, aiPowerHitDecisionTimer - deltaTime);

    if (shouldAiUsePowerHit(aiSettings)) {
      requestDash("left");
      aiPowerHitDecisionTimer = 0.65;
    }

    if (keys.has("arrowup")) {
      rightPaddle.y -= rightPaddle.speed * deltaTime;
    }

    if (keys.has("arrowdown")) {
      rightPaddle.y += rightPaddle.speed * deltaTime;
    }

    if (keys.has("arrowleft")) {
      rightPaddle.x -= rightPaddle.speed * deltaTime;
    }

    if (keys.has("arrowright")) {
      rightPaddle.x += rightPaddle.speed * deltaTime;
    }

    if (touchControl) {
      rightPaddle.x = touchControl.x - paddleWidth / 2;
      rightPaddle.y = touchControl.y - paddleHeight / 2;
    }
  } else {
    if (keys.has("w")) {
      leftPaddle.y -= leftPaddle.speed * deltaTime;
    }

    if (keys.has("s")) {
      leftPaddle.y += leftPaddle.speed * deltaTime;
    }

    if (keys.has("a")) {
      leftPaddle.x -= leftPaddle.speed * deltaTime;
    }

    if (keys.has("d")) {
      leftPaddle.x += leftPaddle.speed * deltaTime;
    }

    if (keys.has("arrowup")) {
      rightPaddle.y -= rightPaddle.speed * deltaTime;
    }

    if (keys.has("arrowdown")) {
      rightPaddle.y += rightPaddle.speed * deltaTime;
    }

    if (keys.has("arrowleft")) {
      rightPaddle.x -= rightPaddle.speed * deltaTime;
    }

    if (keys.has("arrowright")) {
      rightPaddle.x += rightPaddle.speed * deltaTime;
    }
  }

  applyDashRequest(leftPaddle, "left");
  applyDashRequest(rightPaddle, "right");

  leftPaddle.y = clamp(leftPaddle.y, 0, canvas.height - paddleHeight);
  rightPaddle.y = clamp(rightPaddle.y, 0, canvas.height - paddleHeight);
  leftPaddle.x = clamp(leftPaddle.x, paddleMargin, canvas.width / 2 - netGap - paddleWidth);
  rightPaddle.x = clamp(rightPaddle.x, canvas.width / 2 + netGap, canvas.width - paddleMargin - paddleWidth);

  const safeDeltaTime = Math.max(deltaTime, 0.001);
  leftPaddle.vx = (leftPaddle.x - leftStartX) / safeDeltaTime;
  leftPaddle.vy = (leftPaddle.y - leftStartY) / safeDeltaTime;
  rightPaddle.vx = (rightPaddle.x - rightStartX) / safeDeltaTime;
  rightPaddle.vy = (rightPaddle.y - rightStartY) / safeDeltaTime;
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function updateTouchControl(event) {
  if (mode !== "single") {
    return;
  }

  const point = getCanvasPoint(event);
  touchControl = {
    x: clamp(point.x, canvas.width / 2 + netGap, canvas.width - paddleMargin),
    y: clamp(point.y, paddleHeight / 2, canvas.height - paddleHeight / 2),
  };
}

function shouldAiUsePowerHit(aiSettings) {
  if (
    aiSettings.aiPowerHitChance <= 0 ||
    dashCooldowns.left > 0 ||
    leftPaddle.powerHitTimer > 0 ||
    aiPowerHitDecisionTimer > 0 ||
    ball.vx >= 0
  ) {
    return false;
  }

  const paddleCenter = leftPaddle.y + paddleHeight / 2;
  const ballCenter = ball.y + ballSize / 2;
  const isCloseToAi = ball.x < canvas.width * 0.42;
  const isAligned = Math.abs(ballCenter - paddleCenter) < paddleHeight * 0.58;

  if (!isCloseToAi || !isAligned) {
    return false;
  }

  aiPowerHitDecisionTimer = 0.35;

  return Math.random() < aiSettings.aiPowerHitChance;
}

function requestDash(side) {
  if (gameState !== "playing" || dashCooldowns[side] > 0) {
    return;
  }

  dashRequests[side] = true;
}

function applyDashRequest(paddle, side) {
  if (!dashRequests[side] || dashCooldowns[side] > 0) {
    dashRequests[side] = false;
    return;
  }

  paddle.powerHitTimer = powerHitDuration;
  dashCooldowns[side] = powerHitCooldownDuration;
  dashRequests[side] = false;
  dashEffects.push({
    side,
    age: 0,
    duration: powerHitDuration,
  });
}

function updateDash(deltaTime) {
  dashCooldowns.left = Math.max(0, dashCooldowns.left - deltaTime);
  dashCooldowns.right = Math.max(0, dashCooldowns.right - deltaTime);
  leftPaddle.powerHitTimer = Math.max(0, leftPaddle.powerHitTimer - deltaTime);
  rightPaddle.powerHitTimer = Math.max(0, rightPaddle.powerHitTimer - deltaTime);

  dashEffects = dashEffects
    .map((effect) => ({
      ...effect,
      age: effect.age + deltaTime,
    }))
    .filter((effect) => effect.age < effect.duration);
}

function overlapsPaddle(paddle) {
  return (
    ball.x < paddle.x + paddleWidth &&
    ball.x + ballSize > paddle.x &&
    ball.y < paddle.y + paddleHeight &&
    ball.y + ballSize > paddle.y
  );
}

function bounceFromPaddle(paddle, direction, usePower = true) {
  const paddleCenter = paddle.y + paddleHeight / 2;
  const ballCenter = ball.y + ballSize / 2;
  const hitOffset = (ballCenter - paddleCenter) / (paddleHeight / 2);
  const forwardVelocity = Math.max(0, paddle.vx * direction);
  const verticalVelocity = Math.min(Math.abs(paddle.vy), paddle.speed);
  let powerBoost = usePower ? Math.min(maxPowerBoost, forwardVelocity / 650 + verticalVelocity / 1600) : 0;

  if (usePower && paddle.powerHitTimer > 0) {
    powerBoost += powerHitBoost;
    paddle.powerHitTimer = 0;
    updateHud(GAME_CONFIG.messages.powerHit);
  }

  const outgoingSpeed = GAME_CONFIG.ball.baseVelocityX * (ball.speedBoost + powerBoost);

  ball.speedBoost = Math.min(ball.speedBoost + GAME_CONFIG.ball.speedBoostStep, GAME_CONFIG.ball.maxSpeedBoost);
  ball.vx = outgoingSpeed * direction;
  ball.vy = GAME_CONFIG.ball.baseVelocityX * hitOffset + paddle.vy * 0.18;
  limitBallSpeed();
  ball.x = direction > 0 ? paddle.x + paddleWidth : paddle.x - ballSize;
  lastBackWallHit = null;
  assistedWallReturn = null;
}

function scorePoint(side) {
  if (side === "left") {
    leftScore += 1;
    resetBall(1);
  } else {
    rightScore += 1;
    resetBall(-1);
  }

  spawnPointEffect(side);

  if (leftScore >= winningScore || rightScore >= winningScore) {
    gameState = "gameOver";
    matchWinner = leftScore > rightScore ? "left" : "right";
    updateHud(matchWinner === "left" ? GAME_CONFIG.messages.leftWins : GAME_CONFIG.messages.rightWins);
    return;
  }

  updateHud(GAME_CONFIG.messages.point);
}

function spawnPointEffect(side) {
  const userWonPoint = mode === "single" ? side === "right" : side === "left";
  const label =
    mode === "single"
      ? userWonPoint
        ? GAME_CONFIG.messages.pointUser
        : GAME_CONFIG.messages.pointRival
      : side === "left"
        ? GAME_CONFIG.messages.pointPlayerOne
        : GAME_CONFIG.messages.pointPlayerTwo;

  pointEffect = {
    age: 0,
    duration: 0.9,
    color: userWonPoint ? GAME_CONFIG.colors.userPoint : GAME_CONFIG.colors.rivalPoint,
    label,
  };
}

function updatePointEffect(deltaTime) {
  if (!pointEffect) {
    return;
  }

  pointEffect.age += deltaTime;

  if (pointEffect.age >= pointEffect.duration) {
    pointEffect = null;
  }
}

function spawnDirectionPowerUp() {
  directionPowerUp.x =
    canvas.width / 2 - directionPowerUp.size / 2 + (Math.random() - 0.5) * GAME_CONFIG.directionShift.spawnRangeX;
  directionPowerUp.y =
    canvas.height / 2 - directionPowerUp.size / 2 + (Math.random() - 0.5) * GAME_CONFIG.directionShift.spawnRangeY;
  directionPowerUp.active = true;
}

function ballOverlapsDirectionPowerUp() {
  return (
    directionPowerUp.active &&
    ball.x < directionPowerUp.x + directionPowerUp.size &&
    ball.x + ballSize > directionPowerUp.x &&
    ball.y < directionPowerUp.y + directionPowerUp.size &&
    ball.y + ballSize > directionPowerUp.y
  );
}

function activateDirectionShift() {
  const speed = Math.hypot(ball.vx, ball.vy);
  const horizontalDirection = ball.vx >= 0 ? 1 : -1;
  const verticalDirection = Math.random() > 0.5 ? 1 : -1;
  const angle = 0.35 + Math.random() * 0.52;

  directionShiftTimer = directionShiftDuration;
  directionPowerUp.active = false;
  powerUpSpawnTimer = GAME_CONFIG.directionShift.minRespawnTime + Math.random() * GAME_CONFIG.directionShift.randomRespawnTime;
  ball.vx = Math.cos(angle) * speed * horizontalDirection;
  ball.vy = Math.sin(angle) * speed * verticalDirection;
  limitBallSpeed();
  updateHud(GAME_CONFIG.messages.directionShift);
}

function updatePowerUps(deltaTime) {
  if (directionShiftTimer > 0) {
    directionShiftTimer = Math.max(0, directionShiftTimer - deltaTime);
  }

  if (!directionPowerUp.active) {
    powerUpSpawnTimer -= deltaTime;

    if (powerUpSpawnTimer <= 0) {
      spawnDirectionPowerUp();
    }
  }

  if (ballOverlapsDirectionPowerUp()) {
    activateDirectionShift();
  }
}

function updateBall(deltaTime) {
  ball.x += ball.vx * deltaTime;
  ball.y += ball.vy * deltaTime;

  if (ball.y <= 0) {
    ball.y = 0;
    ball.vy *= -1;
  }

  if (ball.y + ballSize >= canvas.height) {
    ball.y = canvas.height - ballSize;
    ball.vy *= -1;
  }

  if (ball.vx < 0 && overlapsPaddle(leftPaddle)) {
    bounceFromPaddle(leftPaddle, 1);
  }

  if (ball.vx > 0 && overlapsPaddle(rightPaddle)) {
    bounceFromPaddle(rightPaddle, -1);
  }

  if (lastBackWallHit === "left" && ball.vx > 0 && overlapsPaddle(leftPaddle)) {
    bounceFromPaddle(leftPaddle, -1);
    assistedWallReturn = "left";
    lastBackWallHit = null;
  }

  if (lastBackWallHit === "right" && ball.vx < 0 && overlapsPaddle(rightPaddle)) {
    bounceFromPaddle(rightPaddle, 1);
    assistedWallReturn = "right";
    lastBackWallHit = null;
  }

  if (ball.x <= 0) {
    if (assistedWallReturn === "left") {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      assistedWallReturn = null;
      updateHud(GAME_CONFIG.messages.leftWallReturn);
      return;
    }

    if (lastBackWallHit === "left") {
      scorePoint("right");
      return;
    }

    ball.x = 0;
    ball.vx = Math.abs(ball.vx);
    lastBackWallHit = "left";
    updateHud(GAME_CONFIG.messages.leftWall);
  }

  if (ball.x + ballSize >= canvas.width) {
    if (assistedWallReturn === "right") {
      ball.x = canvas.width - ballSize;
      ball.vx = -Math.abs(ball.vx);
      assistedWallReturn = null;
      updateHud(GAME_CONFIG.messages.rightWallReturn);
      return;
    }

    if (lastBackWallHit === "right") {
      scorePoint("left");
      return;
    }

    ball.x = canvas.width - ballSize;
    ball.vx = -Math.abs(ball.vx);
    lastBackWallHit = "right";
    updateHud(GAME_CONFIG.messages.rightWall);
  }

  // After a back-wall bounce, the ball may cross the net only if the player answered with the paddle.
  if (lastBackWallHit === "left" && ball.vx > 0 && ball.x > canvas.width / 2) {
    updateHud(GAME_CONFIG.messages.leftNetMiss);
    scorePoint("right");
  }

  if (lastBackWallHit === "right" && ball.vx < 0 && ball.x + ballSize < canvas.width / 2) {
    updateHud(GAME_CONFIG.messages.rightNetMiss);
    scorePoint("left");
  }
}

function update(deltaTime) {
  updatePointEffect(deltaTime);
  updateDash(deltaTime);

  if (gameState !== "playing") {
    return;
  }

  movePaddles(deltaTime);
  updateBall(deltaTime);
  updatePowerUps(deltaTime);
}

function drawCourt() {
  const colors = GAME_CONFIG.colors;

  context.fillStyle = colors.courtBackground;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = colors.sideZone;
  context.fillRect(12, 12, 28, canvas.height - 24);
  context.fillRect(canvas.width - 40, 12, 28, canvas.height - 24);

  context.strokeStyle = colors.courtLine;
  context.lineWidth = 4;
  context.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

  context.setLineDash([12, 14]);
  context.beginPath();
  context.moveTo(canvas.width / 2, 22);
  context.lineTo(canvas.width / 2, canvas.height - 22);
  context.strokeStyle = colors.netLine;
  context.stroke();
  context.setLineDash([]);
}

function drawPaddle(paddle, color) {
  const drawX = Math.round(paddle.x);
  const drawY = Math.round(paddle.y);
  const centerX = drawX + paddleWidth / 2;
  const headHeight = 66;
  const headWidth = 34;
  const headX = centerX - headWidth / 2;
  const headY = drawY + 3;
  const handleY = headY + headHeight - 2;

  context.save();
  if (paddle.powerHitTimer > 0) {
    context.shadowColor = GAME_CONFIG.colors.powerGlow;
    context.shadowBlur = 18;
  }

  context.fillStyle = color;
  context.strokeStyle = GAME_CONFIG.colors.paddleStroke;
  context.lineWidth = 2;

  context.beginPath();
  context.ellipse(centerX, headY + headHeight / 2, headWidth / 2, headHeight / 2, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = GAME_CONFIG.colors.paddleCutout;
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      context.beginPath();
      context.arc(headX + 12 + col * 10, headY + 22 + row * 13, 2.4, 0, Math.PI * 2);
      context.fill();
    }
  }

  context.fillStyle = GAME_CONFIG.colors.paddleStroke;
  context.fillRect(centerX - 4, handleY, 8, 28);
  context.fillStyle = color;
  context.fillRect(centerX - 7, handleY + 20, 14, 12);

  context.restore();
}

function drawDashEffects() {
  dashEffects.forEach((effect) => {
    const paddle = effect.side === "left" ? leftPaddle : rightPaddle;
    const progress = effect.age / effect.duration;
    const alpha = 1 - progress;
    const centerX = paddle.x + paddleWidth / 2;
    const centerY = paddle.y + paddleHeight / 2;

    context.save();
    context.globalAlpha = alpha * 0.75;
    context.strokeStyle = effect.side === "left" ? GAME_CONFIG.paddles.leftColor : GAME_CONFIG.paddles.rightColor;
    context.lineWidth = 3;
    context.beginPath();
    context.ellipse(centerX, centerY, 30 + progress * 28, 54 + progress * 28, 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  });
}

function drawBall() {
  context.fillStyle = directionShiftTimer > 0 ? GAME_CONFIG.directionShift.color : GAME_CONFIG.colors.ball;
  context.fillRect(ball.x, ball.y, ballSize, ballSize);
}

function drawDirectionShiftTrail() {
  if (directionShiftTimer <= 0) {
    return;
  }

  const speed = Math.hypot(ball.vx, ball.vy) || 1;
  const directionX = ball.vx / speed;
  const directionY = ball.vy / speed;

  context.save();
  context.globalAlpha = 0.55;
  context.fillStyle = GAME_CONFIG.directionShift.color;

  for (let index = 1; index <= 4; index += 1) {
    const fade = 1 - index * 0.18;
    context.globalAlpha = fade * 0.45;
    context.fillRect(
      ball.x - directionX * index * 12,
      ball.y - directionY * index * 12,
      ballSize * fade,
      ballSize * fade
    );
  }

  context.restore();
}

function drawDirectionPowerUp() {
  if (!directionPowerUp.active) {
    return;
  }

  const centerX = directionPowerUp.x + directionPowerUp.size / 2;
  const centerY = directionPowerUp.y + directionPowerUp.size / 2;

  context.save();
  context.shadowColor = GAME_CONFIG.directionShift.color;
  context.shadowBlur = 14;
  context.fillStyle = GAME_CONFIG.directionShift.color;
  context.beginPath();
  context.arc(centerX, centerY, directionPowerUp.size / 2, 0, Math.PI * 2);
  context.fill();

  context.shadowBlur = 0;
  context.fillStyle = GAME_CONFIG.colors.paddleCutout;
  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? 10 : 4;
    const angle = -Math.PI / 2 + point * (Math.PI / 5);
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    if (point === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
  context.fill();
  context.restore();
}

function drawPointEffect() {
  if (!pointEffect) {
    return;
  }

  const progress = pointEffect.age / pointEffect.duration;
  const alpha = 1 - progress;

  context.save();
  context.globalAlpha = alpha * 0.38;
  context.fillStyle = pointEffect.color;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.globalAlpha = alpha;
  context.textAlign = "center";
  context.fillStyle = pointEffect.color;
  context.font = "bold 44px Arial";
  context.fillText(pointEffect.label, canvas.width / 2, canvas.height / 2 - 18);

  context.strokeStyle = pointEffect.color;
  context.lineWidth = 5;
  context.strokeRect(20 + progress * 28, 20 + progress * 18, canvas.width - 40 - progress * 56, canvas.height - 40 - progress * 36);
  context.restore();
}

function drawOverlay() {
  if (gameState === "playing") {
    return;
  }

  context.fillStyle = GAME_CONFIG.colors.overlay;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = GAME_CONFIG.colors.overlayTitle;
  context.textAlign = "center";
  context.font = "bold 42px Arial";

  const userWonMatch = mode === "single" ? matchWinner === "right" : matchWinner === "left";
  const title = gameState === "paused" ? GAME_CONFIG.messages.overlayPaused : GAME_CONFIG.messages.overlayGameOver;
  const resultColor = userWonMatch ? GAME_CONFIG.colors.userPoint : GAME_CONFIG.colors.rivalPoint;
  const message =
    gameState === "paused"
      ? GAME_CONFIG.messages.overlayPauseHint
      : userWonMatch
        ? GAME_CONFIG.messages.overlayWin
        : GAME_CONFIG.messages.overlayLose;

  context.fillText(title, canvas.width / 2, canvas.height / 2 - 34);

  if (gameState === "paused") {
    context.fillStyle = GAME_CONFIG.colors.overlayText;
    context.font = "20px Arial";
    context.fillText(message, canvas.width / 2, canvas.height / 2 + 8);
    return;
  }

  context.fillStyle = resultColor;
  context.font = "bold 34px Arial";
  context.fillText(message, canvas.width / 2, canvas.height / 2 + 12);

  context.fillStyle = GAME_CONFIG.colors.overlayText;
  context.font = "18px Arial";
  context.fillText(GAME_CONFIG.messages.overlayRestartHint, canvas.width / 2, canvas.height / 2 + 48);
}

function draw() {
  drawCourt();
  drawDashEffects();
  drawPaddle(leftPaddle, GAME_CONFIG.paddles.leftColor);
  drawPaddle(rightPaddle, GAME_CONFIG.paddles.rightColor);
  drawDirectionPowerUp();
  drawDirectionShiftTrail();
  drawBall();
  drawPointEffect();
  drawOverlay();
}

function gameLoop(currentTime) {
  const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.05);
  lastTime = currentTime;

  update(deltaTime);
  draw();
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
    event.preventDefault();
    keys.add(key);
  }

  if (event.code === "Space") {
    event.preventDefault();
    togglePause();
  }

  if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
    event.preventDefault();
    requestDash("right");
  }

  if (key === "q" && mode !== "single") {
    event.preventDefault();
    requestDash("left");
  }

  if (event.key === "Enter" && gameState === "gameOver") {
    event.preventDefault();
    newGame();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

pauseButton.addEventListener("click", togglePause);
resetButton.addEventListener("click", newGame);
powerHitButton.addEventListener("click", () => {
  requestDash("right");
});

canvas.addEventListener("pointerdown", (event) => {
  if (mode !== "single") {
    return;
  }

  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  updateTouchControl(event);
});

canvas.addEventListener("pointermove", (event) => {
  if (!canvas.hasPointerCapture(event.pointerId)) {
    return;
  }

  event.preventDefault();
  updateTouchControl(event);
});

canvas.addEventListener("pointerup", (event) => {
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  touchControl = null;
});

canvas.addEventListener("pointercancel", (event) => {
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  touchControl = null;
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setMode(button.dataset.mode);
  });
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setDifficulty(button.dataset.difficulty);
  });
});

applyGameConfig();
updateModeButtons();
updateDifficultyButtons();
newGame();
requestAnimationFrame(gameLoop);
