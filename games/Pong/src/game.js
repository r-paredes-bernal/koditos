const canvas = document.querySelector("#game");
const context = canvas.getContext("2d");
const leftScoreElement = document.querySelector("#left-score");
const rightScoreElement = document.querySelector("#right-score");
const statusElement = document.querySelector("#status");
const instructionsElement = document.querySelector("#instructions");
const pauseButton = document.querySelector("#pause-button");
const resetButton = document.querySelector("#reset-button");
const modeButtons = document.querySelectorAll(".mode-button[data-mode]");
const difficultyButtons = document.querySelectorAll(".difficulty-button[data-difficulty]");

const keys = new Set();
const paddleWidth = 14;
const paddleHeight = 92;
const paddleMargin = 30;
const ballSize = 14;
const winningScore = 3;
const netGap = 42;
const difficultySettings = {
  easy: {
    label: "Facil",
    aiBaseSpeed: 170,
    aiScoreBoost: 6,
    aiHorizontalFactor: 0.6,
    mistakeRange: 150,
    mistakeMinTime: 0.45,
    mistakeRandomTime: 0.65,
  },
  medium: {
    label: "Medio",
    aiBaseSpeed: 205,
    aiScoreBoost: 8,
    aiHorizontalFactor: 0.7,
    mistakeRange: 115,
    mistakeMinTime: 0.55,
    mistakeRandomTime: 0.7,
  },
  advanced: {
    label: "Avanzado",
    aiBaseSpeed: 230,
    aiScoreBoost: 10,
    aiHorizontalFactor: 0.8,
    mistakeRange: 92,
    mistakeMinTime: 0.65,
    mistakeRandomTime: 0.75,
  },
};

let mode = "single";
let difficulty = "advanced";
let gameState = "playing";
let lastTime = 0;
let leftScore = 0;
let rightScore = 0;
let lastBackWallHit = null;
let assistedWallReturn = null;
let aiMistakeTimer = 0;
let aiTargetOffset = 0;
let pointEffect = null;
let matchWinner = null;

const leftPaddle = {
  x: paddleMargin,
  y: canvas.height / 2 - paddleHeight / 2,
  speed: 420,
};

const rightPaddle = {
  x: canvas.width - paddleMargin - paddleWidth,
  y: canvas.height / 2 - paddleHeight / 2,
  speed: 420,
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

function updateHud(message) {
  leftScoreElement.textContent = leftScore;
  rightScoreElement.textContent = rightScore;
  statusElement.textContent = message;
  instructionsElement.textContent =
    mode === "single"
      ? `1 jugador: usa flechas para mover la pala derecha. Dificultad ${difficultySettings[difficulty].label}.`
      : "2 jugadores: pala izquierda W/A/S/D, pala derecha flechas.";
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
  rightPaddle.x = canvas.width - paddleMargin - paddleWidth;
  rightPaddle.y = canvas.height / 2 - paddleHeight / 2;
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
  gameState = "playing";
  resetRound();
  updateHud(mode === "single" ? "1 jugador: flechas contra la maquina." : "2 jugadores: W/S y Flechas.");
}

function setMode(nextMode) {
  mode = nextMode;
  updateModeButtons();
  newGame();
}

function setDifficulty(nextDifficulty) {
  difficulty = nextDifficulty;
  aiMistakeTimer = 0;
  aiTargetOffset = 0;
  updateDifficultyButtons();
  newGame();
}

function togglePause() {
  if (gameState !== "playing" && gameState !== "paused") {
    return;
  }

  gameState = gameState === "playing" ? "paused" : "playing";
  updateHud(gameState === "paused" ? "Pausa. Espacio para continuar." : "Partida en curso.");
}

function movePaddles(deltaTime) {
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

  leftPaddle.y = clamp(leftPaddle.y, 0, canvas.height - paddleHeight);
  rightPaddle.y = clamp(rightPaddle.y, 0, canvas.height - paddleHeight);
  leftPaddle.x = clamp(leftPaddle.x, paddleMargin, canvas.width / 2 - netGap - paddleWidth);
  rightPaddle.x = clamp(rightPaddle.x, canvas.width / 2 + netGap, canvas.width - paddleMargin - paddleWidth);
}

function overlapsPaddle(paddle) {
  return (
    ball.x < paddle.x + paddleWidth &&
    ball.x + ballSize > paddle.x &&
    ball.y < paddle.y + paddleHeight &&
    ball.y + ballSize > paddle.y
  );
}

function bounceFromPaddle(paddle, direction) {
  const paddleCenter = paddle.y + paddleHeight / 2;
  const ballCenter = ball.y + ballSize / 2;
  const hitOffset = (ballCenter - paddleCenter) / (paddleHeight / 2);

  ball.speedBoost = Math.min(ball.speedBoost + 0.08, 1.55);
  ball.vx = 330 * ball.speedBoost * direction;
  ball.vy = 330 * hitOffset;
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
    updateHud("Pared izquierda. La pelota vuelve a la otra cancha.");
  }

  if (ball.x + ballSize >= canvas.width) {
    if (assistedWallReturn === "right") {
      ball.x = canvas.width - ballSize;
      ball.vx = -Math.abs(ball.vx);
      assistedWallReturn = null;
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

  if (gameState !== "playing") {
    return;
  }

  movePaddles(deltaTime);
  updateBall(deltaTime);
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

function drawBall() {
  context.fillStyle = "#ffd447";
  context.fillRect(ball.x, ball.y, ballSize, ballSize);
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
  const message = gameState === "paused" ? "Espacio para continuar" : userWonMatch ? "Has ganado" : "Suerte para la proxima";

  context.fillText(title, canvas.width / 2, canvas.height / 2 - 34);
  context.fillStyle = "#f7f7fb";
  context.font = "18px Arial";
  context.fillText(message, canvas.width / 2, canvas.height / 2 + 8);
  context.fillText(gameState === "paused" ? "" : "Enter para reiniciar", canvas.width / 2, canvas.height / 2 + 40);
}

function draw() {
  drawCourt();
  drawPaddle(leftPaddle, "#8dffb0");
  drawPaddle(rightPaddle, "#50d8ff");
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

updateModeButtons();
updateDifficultyButtons();
newGame();
requestAnimationFrame(gameLoop);
