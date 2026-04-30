const canvas = document.querySelector("#game");
const context = canvas.getContext("2d");
const leftScoreElement = document.querySelector("#left-score");
const rightScoreElement = document.querySelector("#right-score");
const statusElement = document.querySelector("#status");
const instructionsElement = document.querySelector("#instructions");
const pauseButton = document.querySelector("#pause-button");
const resetButton = document.querySelector("#reset-button");
const modeButtons = document.querySelectorAll(".mode-button[data-mode]");

const keys = new Set();
const paddleWidth = 14;
const paddleHeight = 92;
const paddleMargin = 30;
const ballSize = 14;
const winningScore = 7;

let mode = "single";
let gameState = "playing";
let lastTime = 0;
let leftScore = 0;
let rightScore = 0;

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
      ? "1 jugador: usa flechas arriba/abajo. La maquina controla la izquierda."
      : "2 jugadores: jugador izquierdo W/S, jugador derecho flechas arriba/abajo.";
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
  ball.vx = 330 * direction;
  ball.vy = (Math.random() * 180 + 90) * (Math.random() > 0.5 ? 1 : -1);
}

function resetRound() {
  leftPaddle.y = canvas.height / 2 - paddleHeight / 2;
  rightPaddle.y = canvas.height / 2 - paddleHeight / 2;
  resetBall();
}

function newGame() {
  leftScore = 0;
  rightScore = 0;
  gameState = "playing";
  resetRound();
  updateHud(mode === "single" ? "1 jugador: flechas contra la maquina." : "2 jugadores: W/S y Flechas.");
}

function setMode(nextMode) {
  mode = nextMode;
  updateModeButtons();
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
    const target = ball.y + ballSize / 2 - paddleHeight / 2;
    const aiSpeed = 320 + Math.min(leftScore + rightScore, 6) * 18;
    leftPaddle.y += Math.sign(target - leftPaddle.y) * aiSpeed * deltaTime;

    if (keys.has("arrowup")) {
      rightPaddle.y -= rightPaddle.speed * deltaTime;
    }

    if (keys.has("arrowdown")) {
      rightPaddle.y += rightPaddle.speed * deltaTime;
    }
  } else {
    if (keys.has("w")) {
      leftPaddle.y -= leftPaddle.speed * deltaTime;
    }

    if (keys.has("s")) {
      leftPaddle.y += leftPaddle.speed * deltaTime;
    }

    if (keys.has("arrowup")) {
      rightPaddle.y -= rightPaddle.speed * deltaTime;
    }

    if (keys.has("arrowdown")) {
      rightPaddle.y += rightPaddle.speed * deltaTime;
    }
  }

  leftPaddle.y = clamp(leftPaddle.y, 0, canvas.height - paddleHeight);
  rightPaddle.y = clamp(rightPaddle.y, 0, canvas.height - paddleHeight);
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
}

function scorePoint(side) {
  if (side === "left") {
    leftScore += 1;
    resetBall(1);
  } else {
    rightScore += 1;
    resetBall(-1);
  }

  if (leftScore >= winningScore || rightScore >= winningScore) {
    gameState = "gameOver";
    updateHud(leftScore > rightScore ? "Gana jugador 1. Enter para reiniciar." : "Gana jugador 2. Enter para reiniciar.");
    return;
  }

  updateHud("Punto. Sigue jugando.");
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

  if (ball.x + ballSize < 0) {
    scorePoint("right");
  }

  if (ball.x > canvas.width) {
    scorePoint("left");
  }
}

function update(deltaTime) {
  if (gameState !== "playing") {
    return;
  }

  movePaddles(deltaTime);
  updateBall(deltaTime);
}

function drawCourt() {
  context.fillStyle = "#02040a";
  context.fillRect(0, 0, canvas.width, canvas.height);

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
  context.fillStyle = color;
  context.fillRect(paddle.x, paddle.y, paddleWidth, paddleHeight);
}

function drawBall() {
  context.fillStyle = "#ffd447";
  context.fillRect(ball.x, ball.y, ballSize, ballSize);
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
  context.fillText(gameState === "paused" ? "PAUSA" : "FIN", canvas.width / 2, canvas.height / 2 - 8);
  context.fillStyle = "#f7f7fb";
  context.font = "18px Arial";
  context.fillText(gameState === "paused" ? "Espacio para continuar" : "Enter para reiniciar", canvas.width / 2, canvas.height / 2 + 30);
}

function draw() {
  drawCourt();
  drawPaddle(leftPaddle, "#8dffb0");
  drawPaddle(rightPaddle, "#50d8ff");
  drawBall();
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

  if (["w", "s", "arrowup", "arrowdown"].includes(key)) {
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

updateModeButtons();
newGame();
requestAnimationFrame(gameLoop);
