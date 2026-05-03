const canvas = document.querySelector("#game");
const context = canvas.getContext("2d");
const titleElement = document.querySelector(".hud h1");
const scoreElement = document.querySelector("#score");
const livesElement = document.querySelector("#lives");
const statusElement = document.querySelector("#status");
const pauseButton = document.querySelector("#pause-button");
const touchButtons = document.querySelectorAll(".touch-control[data-direction]");

// === ASSISTANT_EDITABLE_CONFIG_START ===
const GAME_CONFIG = {
  title: "Robo Chip",
  tileSize: 32,
  droneSpeed: 104,
  droneCount: 3,
  player: {
    start: { x: 1, y: 1 },
    lives: 3,
    defaultSpeed: 150,
  },
  drones: [
    { x: 12, y: 13, color: "#ff4b67", scatter: { x: 12, y: 1 } },
    { x: 12, y: 1, color: "#50d8ff", scatter: { x: 1, y: 13 } },
    { x: 1, y: 13, color: "#ff9f43", scatter: { x: 12, y: 13 } },
    { x: 1, y: 3, color: "#c77dff", scatter: { x: 1, y: 1 } },
  ],
  map: [
    "##############",
    "#o....##....o#",
    "#.##..##..##.#",
    "#o..........o#",
    "###.##..##.###",
    "#...#....#...#",
    "#.###.##.###.#",
    "#......#.....#",
    "#.###.##.###.#",
    "#...#....#...#",
    "###.##..##.###",
    "#............#",
    "#.##..##..##.#",
    "#o....##....o#",
    "##############",
  ],
  colors: {
    boardBackground: "#020806",
    grid: "rgba(84, 255, 159, 0.12)",
    pathStroke: "rgba(84, 255, 159, 0.26)",
    pathNode: "rgba(141, 255, 176, 0.18)",
    wallFill: "#10261d",
    wallStroke: "#54ff9f",
    wallDetail: "rgba(220, 231, 255, 0.28)",
    pellet: "#ffe7a3",
    powerPellet: "#50d8ff",
    playerAntenna: "#9bd8ff",
    playerSignal: "#ffd447",
    playerHead: "#8bd3ff",
    playerFace: "#101014",
    playerBody: "#d7dde8",
    playerBodyStroke: "#8fa3c8",
    droneFrame: "#9aa6bd",
    droneBody: "#151823",
    droneLight: "#9dffcb",
    frightenedDrone: "#273dff",
    frightenedLight: "#f7f7fb",
    impactSpark: "#ffd447",
    overlay: "rgba(0, 0, 0, 0.62)",
    overlayTitle: "#ffd447",
    overlayText: "#f7f7fb",
  },
  messages: {
    ready: "Flechas o dedo para moverte.",
    paused: "Pausa. Espacio o boton para continuar.",
    powerActive: "Poder activo: puedes destruir drones.",
    droneDestroyed: "Drone destruido. Sigue asi.",
    gameOver: "Game over. Presiona Enter para reiniciar.",
    lifeLost: "Perdiste una vida. Sigue jugando.",
    won: "Ganaste. Presiona Enter para jugar otra vez.",
    overlayPaused: "PAUSA",
    overlayWon: "GANASTE",
    overlayGameOver: "GAME OVER",
    overlayPauseHint: "Espacio o boton para continuar",
    overlayRestartHint: "Presiona Enter para reiniciar",
  },
};
// === ASSISTANT_EDITABLE_CONFIG_END ===

const tileSize = GAME_CONFIG.tileSize;

const directions = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

const oppositeDirections = new Map([
  ["0,-1", "0,1"],
  ["0,1", "0,-1"],
  ["-1,0", "1,0"],
  ["1,0", "-1,0"],
]);

const startPlayer = GAME_CONFIG.player.start;
const startGhosts = GAME_CONFIG.drones;

let score = 0;
let lives = GAME_CONFIG.player.lives;
let pellets = new Set();
let powerPellets = new Set();
let frightenedUntil = 0;
let gameState = "ready";
let lastTime = 0;
let animationTick = 0;
let shakeTime = 0;
let audioContext = null;
let touchStart = null;
const impactEffects = [];

const player = {
  col: startPlayer.x,
  row: startPlayer.y,
  x: startPlayer.x * tileSize,
  y: startPlayer.y * tileSize,
  direction: { x: 0, y: 0 },
  nextDirection: { x: 0, y: 0 },
  speed: GAME_CONFIG.player.defaultSpeed,
};

let ghosts = [];

function applyGameConfig() {
  document.title = `${GAME_CONFIG.title} | IXMAIA Arcade`;
  titleElement.textContent = GAME_CONFIG.title;
  livesElement.textContent = GAME_CONFIG.player.lives;
}

function createDrone(ghost) {
  return {
    col: ghost.x,
    row: ghost.y,
    x: ghost.x * tileSize,
    y: ghost.y * tileSize,
    direction: { x: 0, y: -1 },
    color: ghost.color,
    scatter: ghost.scatter,
    speed: GAME_CONFIG.droneSpeed,
  };
}

function buildDrones() {
  ghosts = startGhosts.slice(0, GAME_CONFIG.droneCount).map(createDrone);
}

function resetPellets() {
  const map = getCurrentMap();

  pellets = new Set();
  powerPellets = new Set();

  for (let row = 0; row < map.length; row += 1) {
    for (let col = 0; col < map[row].length; col += 1) {
      if (map[row][col] === ".") {
        pellets.add(`${col},${row}`);
      }

      if (map[row][col] === "o") {
        powerPellets.add(`${col},${row}`);
      }
    }
  }
}

function resetPositions() {
  player.col = startPlayer.x;
  player.row = startPlayer.y;
  player.x = startPlayer.x * tileSize;
  player.y = startPlayer.y * tileSize;
  player.direction = { x: 0, y: 0 };
  player.nextDirection = { x: 0, y: 0 };
  player.speed = GAME_CONFIG.player.defaultSpeed;

  ghosts.forEach((ghost, index) => {
    ghost.col = startGhosts[index].x;
    ghost.row = startGhosts[index].y;
    ghost.x = startGhosts[index].x * tileSize;
    ghost.y = startGhosts[index].y * tileSize;
    ghost.direction = { x: 0, y: -1 };
    ghost.speed = GAME_CONFIG.droneSpeed;
  });
}

function newGame() {
  score = 0;
  lives = GAME_CONFIG.player.lives;
  frightenedUntil = 0;
  shakeTime = 0;
  impactEffects.length = 0;
  gameState = "playing";
  resetPellets();
  buildDrones();
  resetPositions();
  updateHud(GAME_CONFIG.messages.ready);
}

function updateHud(message) {
  scoreElement.textContent = score;
  livesElement.textContent = lives;
  statusElement.textContent = message;
  updatePauseButton();
}

function updatePauseButton() {
  if (gameState === "paused") {
    pauseButton.textContent = "Continuar";
    return;
  }

  if (gameState === "gameOver" || gameState === "won") {
    pauseButton.textContent = "Reiniciar";
    return;
  }

  pauseButton.textContent = "Pausar";
}

function ensureAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
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
  gain.connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

function playSound(name) {
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;

  if (name === "pellet") {
    playTone(740, now, 0.045, "square", 0.04);
  }

  if (name === "power") {
    playTone(392, now, 0.08, "sawtooth", 0.06);
    playTone(784, now + 0.08, 0.12, "sawtooth", 0.07);
  }

  if (name === "hit") {
    playTone(170, now, 0.12, "sawtooth", 0.09);
    playTone(95, now + 0.06, 0.18, "square", 0.08);
  }

  if (name === "drone") {
    playTone(880, now, 0.07, "triangle", 0.07);
    playTone(1175, now + 0.07, 0.09, "triangle", 0.06);
  }

  if (name === "win") {
    [523, 659, 784, 1047].forEach((frequency, index) => {
      playTone(frequency, now + index * 0.08, 0.12, "square", 0.06);
    });
  }

  if (name === "lose") {
    [330, 247, 196, 123].forEach((frequency, index) => {
      playTone(frequency, now + index * 0.1, 0.14, "sawtooth", 0.07);
    });
  }

  if (name === "pause") {
    playTone(440, now, 0.06, "triangle", 0.05);
  }
}

function togglePause() {
  if (gameState !== "playing" && gameState !== "paused") {
    return;
  }

  gameState = gameState === "playing" ? "paused" : "playing";
  playSound("pause");
  updateHud(gameState === "paused" ? GAME_CONFIG.messages.paused : GAME_CONFIG.messages.ready);
}

function setPlayerDirection(direction) {
  if (!direction) {
    return;
  }

  if (gameState === "paused") {
    return;
  }

  if (gameState === "ready" || gameState === "gameOver" || gameState === "won") {
    newGame();
  }

  player.nextDirection = direction;
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function setDirectionFromSwipe(start, end) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;

  if (Math.hypot(deltaX, deltaY) < 18) {
    return;
  }

  setPlayerDirection(
    Math.abs(deltaX) > Math.abs(deltaY)
      ? deltaX > 0 ? directions.ArrowRight : directions.ArrowLeft
      : deltaY > 0 ? directions.ArrowDown : directions.ArrowUp
  );
}

function getCurrentMap() {
  return GAME_CONFIG.map;
}

function tileKey(col, row) {
  return `${col},${row}`;
}

function isWall(col, row) {
  const tile = getCurrentMap()[row]?.[col];
  return tile === "#" || tile === "x" || tile === undefined;
}

function isCentered(entity) {
  return entity.x === entity.col * tileSize && entity.y === entity.row * tileSize;
}

function canMoveFrom(entity, direction) {
  return !isWall(entity.col + direction.x, entity.row + direction.y);
}

function moveEntity(entity, deltaTime) {
  if (entity.direction.x === 0 && entity.direction.y === 0) {
    return;
  }

  const step = entity.speed * deltaTime;

  if (entity.direction.x !== 0) {
    const nextCol = entity.direction.x > 0 ? entity.col + 1 : entity.col - 1;
    const nextX = nextCol * tileSize;

    if (isWall(nextCol, entity.row)) {
      entity.x = entity.col * tileSize;
      entity.direction = { x: 0, y: 0 };
    } else {
      entity.x += entity.direction.x * step;

      if ((entity.direction.x > 0 && entity.x >= nextX) || (entity.direction.x < 0 && entity.x <= nextX)) {
        entity.x = nextX;
        entity.col = nextCol;
      }
    }
  }

  if (entity.direction.y !== 0) {
    const nextRow = entity.direction.y > 0 ? entity.row + 1 : entity.row - 1;
    const nextY = nextRow * tileSize;

    if (isWall(entity.col, nextRow)) {
      entity.y = entity.row * tileSize;
      entity.direction = { x: 0, y: 0 };
    } else {
      entity.y += entity.direction.y * step;

      if ((entity.direction.y > 0 && entity.y >= nextY) || (entity.direction.y < 0 && entity.y <= nextY)) {
        entity.y = nextY;
        entity.row = nextRow;
      }
    }
  }
}

function chooseGhostDirection(ghost) {
  const options = Object.values(directions).filter((direction) => canMoveFrom(ghost, direction));
  const reverse = oppositeDirections.get(`${ghost.direction.x},${ghost.direction.y}`);
  const filtered = options.length > 1 ? options.filter((direction) => `${direction.x},${direction.y}` !== reverse) : options;
  const frightened = Date.now() < frightenedUntil;

  if (frightened) {
    return filtered[Math.floor(Math.random() * filtered.length)] ?? ghost.direction;
  }

  const target = score % 120 < 80 ? player : ghost.scatter;
  return filtered.reduce((best, direction) => {
    const nextCol = ghost.col + direction.x;
    const nextRow = ghost.row + direction.y;
    const distance = Math.abs(target.col - nextCol) + Math.abs(target.row - nextRow);

    return distance < best.distance ? { direction, distance } : best;
  }, { direction: filtered[0] ?? ghost.direction, distance: Number.POSITIVE_INFINITY }).direction;
}

function updatePlayer(deltaTime) {
  if (isCentered(player)) {
    player.x = player.col * tileSize;
    player.y = player.row * tileSize;

    if (canMoveFrom(player, player.nextDirection)) {
      player.direction = player.nextDirection;
    }

    if (!canMoveFrom(player, player.direction)) {
      player.direction = { x: 0, y: 0 };
    }
  }

  moveEntity(player, deltaTime);

  const key = tileKey(player.col, player.row);

  if (pellets.delete(key)) {
    score += 10;
    playSound("pellet");
  }

  if (powerPellets.delete(key)) {
    score += 50;
    frightenedUntil = Date.now() + 7000;
    playSound("power");
    updateHud(GAME_CONFIG.messages.powerActive);
  }
}

function updateGhosts(deltaTime) {
  ghosts.forEach((ghost) => {
    if (isCentered(ghost)) {
      ghost.x = ghost.col * tileSize;
      ghost.y = ghost.row * tileSize;
      ghost.direction = chooseGhostDirection(ghost);
    }

    moveEntity(ghost, deltaTime);
  });
}

function distanceBetween(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function spawnImpactEffect(x, y, color) {
  impactEffects.push({
    x,
    y,
    color,
    age: 0,
    duration: 0.45,
  });
  shakeTime = 0.22;
}

function updateImpactEffects(deltaTime) {
  shakeTime = Math.max(0, shakeTime - deltaTime);

  for (let index = impactEffects.length - 1; index >= 0; index -= 1) {
    impactEffects[index].age += deltaTime;

    if (impactEffects[index].age >= impactEffects[index].duration) {
      impactEffects.splice(index, 1);
    }
  }
}

function handleCollisions() {
  const frightened = Date.now() < frightenedUntil;
  let collisionHandled = false;

  ghosts.forEach((ghost, index) => {
    if (collisionHandled || distanceBetween(player, ghost) > 22) {
      return;
    }

    collisionHandled = true;
    spawnImpactEffect(
      player.x + tileSize / 2,
      player.y + tileSize / 2,
      frightened ? GAME_CONFIG.colors.playerAntenna : ghost.color
    );

    if (frightened) {
      score += 200;
      playSound("drone");
      const startGhost = startGhosts[index];
      ghost.col = startGhost.x;
      ghost.row = startGhost.y;
      ghost.x = ghost.col * tileSize;
      ghost.y = ghost.row * tileSize;
      updateHud(GAME_CONFIG.messages.droneDestroyed);
      return;
    }

    lives -= 1;
    playSound("hit");

    if (lives <= 0) {
      gameState = "gameOver";
      playSound("lose");
      updateHud(GAME_CONFIG.messages.gameOver);
      return;
    }

    resetPositions();
    updateHud(GAME_CONFIG.messages.lifeLost);
  });
}

function checkWin() {
  if (pellets.size === 0 && powerPellets.size === 0) {
    gameState = "won";
    playSound("win");
    updateHud(GAME_CONFIG.messages.won);
  }
}

function update(deltaTime) {
  animationTick += deltaTime;
  updateImpactEffects(deltaTime);

  if (gameState !== "playing") {
    return;
  }

  updatePlayer(deltaTime);
  updateGhosts(deltaTime);
  handleCollisions();
  checkWin();
  updateHud(statusElement.textContent);
}

function drawMap() {
  const map = getCurrentMap();
  const colors = GAME_CONFIG.colors;

  context.fillStyle = colors.boardBackground;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = colors.grid;
  context.lineWidth = 1;
  for (let x = tileSize / 2; x < canvas.width; x += tileSize) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }

  for (let y = tileSize / 2; y < canvas.height; y += tileSize) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }

  for (let row = 0; row < map.length; row += 1) {
    for (let col = 0; col < map[row].length; col += 1) {
      const x = col * tileSize;
      const y = row * tileSize;
      const tile = map[row][col];

      if (tile === "x") {
        continue;
      }

      if (tile !== "#") {
        context.strokeStyle = colors.pathStroke;
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(x + tileSize / 2, y + 4);
        context.lineTo(x + tileSize / 2, y + tileSize - 4);
        context.moveTo(x + 4, y + tileSize / 2);
        context.lineTo(x + tileSize - 4, y + tileSize / 2);
        context.stroke();

        context.fillStyle = colors.pathNode;
        context.fillRect(x + tileSize / 2 - 2, y + tileSize / 2 - 2, 4, 4);
        continue;
      }

      context.fillStyle = colors.wallFill;
      context.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
      context.strokeStyle = colors.wallStroke;
      context.strokeRect(x + 4, y + 4, tileSize - 8, tileSize - 8);

      context.strokeStyle = colors.wallDetail;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x + 8, y + 9);
      context.lineTo(x + tileSize - 8, y + 9);
      context.moveTo(x + 8, y + tileSize - 9);
      context.lineTo(x + tileSize - 8, y + tileSize - 9);
      context.stroke();
    }
  }
}

function drawPellets() {
  context.fillStyle = GAME_CONFIG.colors.pellet;

  for (const pellet of pellets) {
    const [col, row] = pellet.split(",").map(Number);
    context.beginPath();
    context.arc(col * tileSize + tileSize / 2, row * tileSize + tileSize / 2, 4, 0, Math.PI * 2);
    context.fill();
  }

  for (const pellet of powerPellets) {
    const [col, row] = pellet.split(",").map(Number);
    context.fillStyle = GAME_CONFIG.colors.powerPellet;
    context.beginPath();
    context.arc(col * tileSize + tileSize / 2, row * tileSize + tileSize / 2, 8, 0, Math.PI * 2);
    context.fill();
  }
}

function roundedRectangle(x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function drawPlayer() {
  const colors = GAME_CONFIG.colors;
  const centerX = player.x + tileSize / 2;
  const centerY = player.y + tileSize / 2;
  const bob = Math.sin(animationTick * 12) * 1.5;
  const eyeOffsetX = player.direction.x * 2;
  const eyeOffsetY = player.direction.y * 2;

  context.save();
  context.translate(centerX, centerY + bob);

  context.strokeStyle = colors.playerAntenna;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, -13);
  context.lineTo(0, -18);
  context.stroke();

  context.fillStyle = colors.playerSignal;
  context.beginPath();
  context.arc(0, -20, 3, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = colors.playerHead;
  context.strokeStyle = colors.overlayText;
  context.lineWidth = 2;
  roundedRectangle(-11, -13, 22, 18, 5);
  context.fill();
  context.stroke();

  context.fillStyle = colors.playerFace;
  context.beginPath();
  context.arc(-5 + eyeOffsetX, -5 + eyeOffsetY, 2.4, 0, Math.PI * 2);
  context.arc(5 + eyeOffsetX, -5 + eyeOffsetY, 2.4, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = colors.overlayText;
  context.fillRect(-5, 1, 10, 2);

  context.fillStyle = colors.playerBody;
  context.strokeStyle = colors.playerBodyStroke;
  context.lineWidth = 2;
  roundedRectangle(-9, 6, 18, 14, 4);
  context.fill();
  context.stroke();

  context.strokeStyle = colors.playerHead;
  context.beginPath();
  context.moveTo(-12, 9);
  context.lineTo(-16, 15);
  context.moveTo(12, 9);
  context.lineTo(16, 15);
  context.stroke();

  context.fillStyle = colors.playerSignal;
  context.beginPath();
  context.arc(-6, 22, 4, 0, Math.PI * 2);
  context.arc(6, 22, 4, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

function drawDrone(ghost) {
  const colors = GAME_CONFIG.colors;
  const frightened = Date.now() < frightenedUntil;
  const x = ghost.x + tileSize / 2;
  const y = ghost.y + tileSize / 2;
  const rotorPulse = Math.abs(Math.sin(animationTick * 18)) * 2;
  const bodyColor = frightened ? colors.frightenedDrone : ghost.color;
  const lightColor = frightened ? colors.frightenedLight : colors.droneLight;

  context.save();
  context.translate(x, y);

  context.strokeStyle = colors.droneFrame;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-9, -5);
  context.lineTo(-17, -13);
  context.moveTo(9, -5);
  context.lineTo(17, -13);
  context.moveTo(-9, 6);
  context.lineTo(-17, 14);
  context.moveTo(9, 6);
  context.lineTo(17, 14);
  context.stroke();

  context.strokeStyle = frightened ? colors.playerAntenna : colors.overlayText;
  context.lineWidth = 2;
  [
    [-18, -14],
    [18, -14],
    [-18, 14],
    [18, 14],
  ].forEach(([rotorX, rotorY]) => {
    context.beginPath();
    context.ellipse(rotorX, rotorY, 8 + rotorPulse, 3, 0, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.ellipse(rotorX, rotorY, 3, 8 + rotorPulse, 0, 0, Math.PI * 2);
    context.stroke();
  });

  context.fillStyle = colors.droneBody;
  roundedRectangle(-12, -9, 24, 18, 5);
  context.fill();
  context.strokeStyle = bodyColor;
  context.lineWidth = 3;
  context.stroke();

  context.fillStyle = bodyColor;
  roundedRectangle(-7, -5, 14, 10, 3);
  context.fill();

  context.fillStyle = lightColor;
  context.beginPath();
  context.arc(-4, -1, 2, 0, Math.PI * 2);
  context.arc(4, -1, 2, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

function drawImpactEffects() {
  impactEffects.forEach((effect) => {
    const progress = effect.age / effect.duration;
    const alpha = 1 - progress;
    const radius = 8 + progress * 28;

    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = effect.color;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
    context.stroke();

    context.fillStyle = GAME_CONFIG.colors.impactSpark;
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8 + progress * 1.2;
      const sparkDistance = 10 + progress * 22;
      const sparkX = effect.x + Math.cos(angle) * sparkDistance;
      const sparkY = effect.y + Math.sin(angle) * sparkDistance;
      context.beginPath();
      context.arc(sparkX, sparkY, 2.5 * alpha, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  });
}

function drawOverlay() {
  if (gameState === "playing") {
    return;
  }

  context.fillStyle = GAME_CONFIG.colors.overlay;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = GAME_CONFIG.colors.overlayTitle;
  context.textAlign = "center";
  context.font = "bold 34px Arial";

  const text =
    gameState === "paused"
      ? GAME_CONFIG.messages.overlayPaused
      : gameState === "won"
        ? GAME_CONFIG.messages.overlayWon
        : GAME_CONFIG.messages.overlayGameOver;
  const hint = gameState === "paused" ? GAME_CONFIG.messages.overlayPauseHint : GAME_CONFIG.messages.overlayRestartHint;

  context.fillText(text, canvas.width / 2, canvas.height / 2 - 8);

  context.fillStyle = GAME_CONFIG.colors.overlayText;
  context.font = "16px Arial";
  context.fillText(hint, canvas.width / 2, canvas.height / 2 + 26);
}

function draw() {
  const shake = shakeTime > 0 ? Math.sin(animationTick * 80) * shakeTime * 16 : 0;

  context.save();
  context.translate(shake, -shake * 0.6);
  drawMap();
  drawPellets();
  ghosts.forEach(drawDrone);
  drawPlayer();
  drawImpactEffects();
  context.restore();

  drawOverlay();
}

function gameLoop(currentTime) {
  const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.05);
  lastTime = currentTime;

  update(deltaTime);
  draw();
  requestAnimationFrame(gameLoop);
}

function isTypingInEditableField(event) {
  const target = event.target;

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable
  );
}

window.addEventListener("keydown", (event) => {
  if (isTypingInEditableField(event)) {
    return;
  }

  ensureAudio();

  const requestedDirection = directions[event.key];

  if (requestedDirection) {
    event.preventDefault();
    setPlayerDirection(requestedDirection);
  }

  if (event.code === "Space" && (gameState === "playing" || gameState === "paused")) {
    event.preventDefault();
    togglePause();
  }

  if (event.key === "Enter" && gameState !== "playing") {
    event.preventDefault();
    newGame();
  }
});

pauseButton.addEventListener("click", () => {
  ensureAudio();

  if (gameState === "gameOver" || gameState === "won") {
    newGame();
    return;
  }

  togglePause();
});

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  ensureAudio();
  canvas.setPointerCapture(event.pointerId);
  touchStart = getCanvasPoint(event);
});

canvas.addEventListener("pointermove", (event) => {
  if (!touchStart || !canvas.hasPointerCapture(event.pointerId)) {
    return;
  }

  event.preventDefault();
  const point = getCanvasPoint(event);
  setDirectionFromSwipe(touchStart, point);
});

canvas.addEventListener("pointerup", (event) => {
  if (touchStart) {
    setDirectionFromSwipe(touchStart, getCanvasPoint(event));
  }

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  touchStart = null;
});

canvas.addEventListener("pointercancel", (event) => {
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  touchStart = null;
});

touchButtons.forEach((button) => {
  const direction = directions[button.dataset.direction];

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    ensureAudio();
    setPlayerDirection(direction);
  });

  button.addEventListener("click", (event) => {
    event.preventDefault();
    ensureAudio();
    setPlayerDirection(direction);
  });
});

applyGameConfig();
newGame();
requestAnimationFrame(gameLoop);
