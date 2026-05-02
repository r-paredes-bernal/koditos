const canvas = document.querySelector("#game");
const context = canvas.getContext("2d");
const leftScoreElement = document.querySelector("#left-score");
const rightScoreElement = document.querySelector("#right-score");
const statusElement = document.querySelector("#status");
const instructionsElement = document.querySelector("#instructions");
const pauseButton = document.querySelector("#pause-button");
const resetButton = document.querySelector("#reset-button");
const powerHitButton = document.querySelector("#power-hit-button");
const modeButtons = document.querySelectorAll(".mode-button[data-mode]");
const difficultyButtons = document.querySelectorAll(".difficulty-button[data-difficulty]");

const keys = new Set();
const paddleWidth = 14;
const paddleHeight = 92;
const paddleMargin = 30;
const ballSize = 14;
const winningScore = 3;
const netGap = 42;
const maxPowerBoost = 0.42;
const maxBallSpeed = 760;
const powerHitDuration = 0.45;
const powerHitCooldownDuration = 1.15;
const powerHitBoost = 0.36;
const directionShiftDuration = 0.45;
const difficultySettings = {
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
};

let mode = "single";
let difficulty = "easy";
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
let powerUpSpawnTimer = 2.5;
let dashEffects = [];
let touchControl = null;
let audioContext = null;
let masterGain = null;

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
  x: canvas.width / 2 - 14,
  y: canvas.height / 2 - 14,
  size: 28,
};

const leftPaddle = {
  x: paddleMargin,
  y: canvas.height / 2 - paddleHeight / 2,
  speed: 420,
  vx: 0,
  vy: 0,
  powerHitTimer: 0,
};

const rightPaddle = {
  x: canvas.width - paddleMargin - paddleWidth,
  y: canvas.height / 2 - paddleHeight / 2,
  speed: 420,
  vx: 0,
  vy: 0,
  powerHitTimer: 0,
};

const ball = {
  x: canvas.width / 2 - ballSize / 2,
  y: canvas.height / 2 - ballSize / 2,
  vx: 330,
  vy: 190,
  speedBoost: 1,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ensureAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.58;
    masterGain.connect(audioContext.destination);
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playTone(frequency, startTime, duration, type = "square", volume = 0.08) {
  if (!audioContext) {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(masterGain);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

function playSound(name) {
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;

  if (name === "paddle") {
    playTone(520, now, 0.055, "square", 0.08);
    playTone(780, now + 0.025, 0.06, "triangle", 0.05);
  }

  if (name === "powerHit") {
    playTone(240, now, 0.08, "sawtooth", 0.1);
    playTone(920, now + 0.05, 0.11, "square", 0.08);
  }

  if (name === "wall") {
    playTone(280, now, 0.045, "triangle", 0.06);
  }

  if (name === "point") {
    playTone(440, now, 0.08, "square", 0.08);
    playTone(660, now + 0.08, 0.1, "square", 0.08);
  }

  if (name === "powerUp") {
    playTone(720, now, 0.08, "triangle", 0.08);
    playTone(1080, now + 0.06, 0.12, "triangle", 0.08);
  }

  if (name === "pause") {
    playTone(360, now, 0.07, "triangle", 0.07);
  }

  if (name === "gameOver") {
    [520, 390, 260].forEach((frequency, index) => {
      playTone(frequency, now + index * 0.1, 0.13, "sawtooth", 0.08);
    });
  }
}

function updateHud(message) {
  leftScoreElement.textContent = leftScore;
  rightScoreElement.textContent = rightScore;
  statusElement.textContent = message;
  instructionsElement.textContent =
    mode === "single"
      ? `1 jugador: flechas o dedo para mover, Shift o boton para pegar con fuerza. Dificultad ${difficultySettings[difficulty].label}.`
      : "2 jugadores: izquierda W/A/S/D + Q para pegar fuerte, derecha flechas + Shift para pegar fuerte.";
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
  ball.vx = 330 * direction;
  ball.vy = (Math.random() * 180 + 90) * (Math.random() > 0.5 ? 1 : -1);
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
  powerUpSpawnTimer = 2.5;
  directionPowerUp.active = false;
  dashCooldowns.left = 0;
  dashCooldowns.right = 0;
  dashRequests.left = false;
  dashRequests.right = false;
  dashEffects = [];
  aiPowerHitDecisionTimer = 0;
  gameState = "playing";
  resetRound();
  updateHud(mode === "single" ? "1 jugador: flechas y Shift contra la maquina." : "2 jugadores: W/A/S/D + Q y Flechas + Shift.");
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
  playSound("pause");
  updateHud(gameState === "paused" ? "Pausa. Espacio para continuar." : "Partida en curso.");
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
    playSound("powerHit");
    updateHud("Golpe fuerte!");
  } else {
    playSound("paddle");
  }

  const outgoingSpeed = 330 * (ball.speedBoost + powerBoost);

  ball.speedBoost = Math.min(ball.speedBoost + 0.08, 1.55);
  ball.vx = outgoingSpeed * direction;
  ball.vy = 330 * hitOffset + paddle.vy * 0.18;
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
  playSound("point");

  if (leftScore >= winningScore || rightScore >= winningScore) {
    gameState = "gameOver";
    matchWinner = leftScore > rightScore ? "left" : "right";
    playSound("gameOver");
    updateHud(matchWinner === "left" ? "Gana jugador 1. Enter para reiniciar." : "Gana jugador 2. Enter para reiniciar.");
    return;
  }

  updateHud("Punto. Sigue jugando.");
}

function spawnPointEffect(side) {
  const userWonPoint = mode === "single" ? side === "right" : side === "left";
  const label = mode === "single" ? (userWonPoint ? "PUNTO!" : "PUNTO RIVAL") : side === "left" ? "PUNTO J1" : "PUNTO J2";

  pointEffect = {
    age: 0,
    duration: 0.9,
    color: userWonPoint ? "#8dffb0" : "#ff4b67",
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
  directionPowerUp.x = canvas.width / 2 - directionPowerUp.size / 2 + (Math.random() - 0.5) * 180;
  directionPowerUp.y = canvas.height / 2 - directionPowerUp.size / 2 + (Math.random() - 0.5) * 220;
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
  powerUpSpawnTimer = 7 + Math.random() * 4;
  ball.vx = Math.cos(angle) * speed * horizontalDirection;
  ball.vy = Math.sin(angle) * speed * verticalDirection;
  limitBallSpeed();
  playSound("powerUp");
  updateHud("Cambio de direccion!");
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
    playSound("wall");
  }

  if (ball.y + ballSize >= canvas.height) {
    ball.y = canvas.height - ballSize;
    ball.vy *= -1;
    playSound("wall");
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
      playSound("wall");
      updateHud("Devolucion con pared izquierda.");
      return;
    }

    if (lastBackWallHit === "left") {
      scorePoint("right");
      return;
    }

    ball.x = 0;
    ball.vx = Math.abs(ball.vx);
    lastBackWallHit = "left";
    playSound("wall");
    updateHud("Pared izquierda. La pelota vuelve a la otra cancha.");
  }

  if (ball.x + ballSize >= canvas.width) {
    if (assistedWallReturn === "right") {
      ball.x = canvas.width - ballSize;
      ball.vx = -Math.abs(ball.vx);
      assistedWallReturn = null;
      playSound("wall");
      updateHud("Devolucion con pared derecha.");
      return;
    }

    if (lastBackWallHit === "right") {
      scorePoint("left");
      return;
    }

    ball.x = canvas.width - ballSize;
    ball.vx = -Math.abs(ball.vx);
    lastBackWallHit = "right";
    playSound("wall");
    updateHud("Pared derecha. La pelota vuelve a la otra cancha.");
  }

  // After a back-wall bounce, the ball may cross the net only if the player answered with the paddle.
  if (lastBackWallHit === "left" && ball.vx > 0 && ball.x > canvas.width / 2) {
    updateHud("Cruzo la red sin respuesta del lado izquierdo.");
    scorePoint("right");
  }

  if (lastBackWallHit === "right" && ball.vx < 0 && ball.x + ballSize < canvas.width / 2) {
    updateHud("Cruzo la red sin respuesta del lado derecho.");
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
  context.fillStyle = "#02040a";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "rgba(80, 216, 255, 0.12)";
  context.fillRect(12, 12, 28, canvas.height - 24);
  context.fillRect(canvas.width - 40, 12, 28, canvas.height - 24);

  context.strokeStyle = "rgba(47, 156, 255, 0.5)";
  context.lineWidth = 4;
  context.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

  context.setLineDash([12, 14]);
  context.beginPath();
  context.moveTo(canvas.width / 2, 22);
  context.lineTo(canvas.width / 2, canvas.height - 22);
  context.strokeStyle = "rgba(247, 247, 251, 0.5)";
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
    context.shadowColor = "#ffd447";
    context.shadowBlur = 18;
  }

  context.fillStyle = color;
  context.strokeStyle = "#f7f7fb";
  context.lineWidth = 2;

  context.beginPath();
  context.ellipse(centerX, headY + headHeight / 2, headWidth / 2, headHeight / 2, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = "#02040a";
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      context.beginPath();
      context.arc(headX + 12 + col * 10, headY + 22 + row * 13, 2.4, 0, Math.PI * 2);
      context.fill();
    }
  }

  context.fillStyle = "#f7f7fb";
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
    context.strokeStyle = effect.side === "left" ? "#8dffb0" : "#50d8ff";
    context.lineWidth = 3;
    context.beginPath();
    context.ellipse(centerX, centerY, 30 + progress * 28, 54 + progress * 28, 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  });
}

function drawBall() {
  context.fillStyle = directionShiftTimer > 0 ? "#b96cff" : "#ffd447";
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
  context.fillStyle = "#b96cff";

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
  context.shadowColor = "#b96cff";
  context.shadowBlur = 14;
  context.fillStyle = "#b96cff";
  context.beginPath();
  context.arc(centerX, centerY, directionPowerUp.size / 2, 0, Math.PI * 2);
  context.fill();

  context.shadowBlur = 0;
  context.fillStyle = "#02040a";
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

  context.fillStyle = "rgba(0, 0, 0, 0.62)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffd447";
  context.textAlign = "center";
  context.font = "bold 42px Arial";

  const userWonMatch = mode === "single" ? matchWinner === "right" : matchWinner === "left";
  const title = gameState === "paused" ? "PAUSA" : "GAME OVER";
  const resultColor = userWonMatch ? "#8dffb0" : "#ff4b67";
  const message = gameState === "paused" ? "Espacio para continuar" : userWonMatch ? "Has ganado!" : "Suerte para la proxima";

  context.fillText(title, canvas.width / 2, canvas.height / 2 - 34);

  if (gameState === "paused") {
    context.fillStyle = "#f7f7fb";
    context.font = "20px Arial";
    context.fillText(message, canvas.width / 2, canvas.height / 2 + 8);
    return;
  }

  context.fillStyle = resultColor;
  context.font = "bold 34px Arial";
  context.fillText(message, canvas.width / 2, canvas.height / 2 + 12);

  context.fillStyle = "#f7f7fb";
  context.font = "18px Arial";
  context.fillText("Enter para reiniciar", canvas.width / 2, canvas.height / 2 + 48);
}

function draw() {
  drawCourt();
  drawDashEffects();
  drawPaddle(leftPaddle, "#8dffb0");
  drawPaddle(rightPaddle, "#50d8ff");
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
  ensureAudio();

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

pauseButton.addEventListener("click", () => {
  ensureAudio();
  togglePause();
});

resetButton.addEventListener("click", () => {
  ensureAudio();
  newGame();
});

powerHitButton.addEventListener("click", () => {
  ensureAudio();
  requestDash("right");
});

canvas.addEventListener("pointerdown", (event) => {
  if (mode !== "single") {
    return;
  }

  event.preventDefault();
  ensureAudio();
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
    ensureAudio();
    setMode(button.dataset.mode);
  });
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    ensureAudio();
    setDifficulty(button.dataset.difficulty);
  });
});

updateModeButtons();
updateDifficultyButtons();
newGame();
requestAnimationFrame(gameLoop);
