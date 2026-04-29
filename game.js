const TILE = 36;
const GRID_COLS = 21;
const GRID_ROWS = 21;
const CANVAS_SIZE = TILE * GRID_COLS;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const levelEl = document.getElementById("level");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");

const MAP_TEMPLATES = [
  [
    "#####################",
    "#.........#.........#",
    "#.###.###.#.###.###.#",
    "#o###.###.#.###.###o#",
    "#...................#",
    "#.###.#.#####.#.###.#",
    "#.....#...#...#.....#",
    "#####.### # ###.#####",
    "    #.#       #.#    ",
    "#####.# ## ## #.#####",
    "     .  #G#  .       ",
    "#####.# ##### #.#####",
    "    #.#       #.#    ",
    "#####.# ##### #.#####",
    "#.........#.........#",
    "#.###.###.#.###.###.#",
    "#o..#.....P.....#..o#",
    "###.#.#.#####.#.#.###",
    "#.....#...#...#.....#",
    "#.#########.#######.#",
    "#...................#"
  ],
  [
    "#####################",
    "#...#...........#...#",
    "#.#.#.###.#.###.#.#.#",
    "#o#.....#.#.#.....#o#",
    "#.#.###.#.#.#.###.#.#",
    "#...................#",
    "#.###.#####.#####.###",
    "#.....#...#.#...#...#",
    "###.#.#.# # #.#.#.#.#",
    "#...#...#   #...#...#",
    "#.#####.# G #.#####.#",
    "#.......#####.......#",
    "#.###.#.......#.###.#",
    "#o..#.#.#####.#.#..o#",
    "###.#.#...#...#.#.###",
    "#...#...#.#.#...#...#",
    "#.#####.#P#.#.#####.#",
    "#.......#...#.......#",
    "#.###.###.#.###.###.#",
    "#...................#",
    "#####################"
  ],
  [
    "#####################",
    "#.........#.........#",
    "#.###.###.#.###.###.#",
    "#.#.....#.#.#.....#.#",
    "#.#.###.#.#.#.###.#.#",
    "#o..#...#...#...#..o#",
    "###.#.#### ####.#.###",
    "#...#.#       #.#...#",
    "#.###.# ##### #.###.#",
    "#.....# #G G# #.....#",
    "#####.# ##### #.#####",
    "#.....#       #.....#",
    "#.###.#### ####.###.#",
    "#o..#...#...#...#..o#",
    "###.#.#.#.#.#.#.#.###",
    "#...#.#.#P#.#.#.#...#",
    "#.###.#.#.#.#.#.###.#",
    "#.....#...#...#.....#",
    "#.###############.###",
    "#...................#",
    "#####################"
  ]
];

const LEVELS = Array.from({ length: 10 }, (_, idx) => {
  const n = idx + 1;
  return {
    number: n,
    templateIndex: idx % MAP_TEMPLATES.length,
    ghostCount: Math.min(2 + Math.floor((n - 1) / 2), 6),
    ghostSpeed: 1.4 + idx * 0.14,
    playerSpeed: 2.4 + idx * 0.04,
    frightTime: Math.max(3.8 - idx * 0.2, 1.8)
  };
});

const state = {
  running: false,
  gameOver: false,
  win: false,
  levelIndex: 0,
  score: 0,
  lives: 3,
  pelletsLeft: 0,
  walls: [],
  pellets: new Map(),
  player: null,
  ghosts: [],
  keys: { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false },
  lastTime: 0,
  powerTimer: 0
};

function scaleCanvasForDpi() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = CANVAS_SIZE * ratio;
  canvas.height = CANVAS_SIZE * ratio;
  canvas.style.width = `${CANVAS_SIZE}px`;
  canvas.style.height = `${CANVAS_SIZE}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function tileKey(x, y) {
  return `${x},${y}`;
}

function parseLevel(config) {
  const rows = MAP_TEMPLATES[config.templateIndex];
  state.walls = [];
  state.pellets.clear();
  state.ghosts = [];
  state.pelletsLeft = 0;
  state.powerTimer = 0;

  let playerSpawn = { x: 1, y: 1 };
  const ghostSpawns = [];

  for (let y = 0; y < GRID_ROWS; y += 1) {
    const row = rows[y];
    for (let x = 0; x < GRID_COLS; x += 1) {
      const cell = row[x] || " ";
      if (cell === "#") {
        state.walls.push({ x, y });
      }
      if (cell === ".") {
        state.pellets.set(tileKey(x, y), { x, y, power: false });
        state.pelletsLeft += 1;
      }
      if (cell === "o") {
        state.pellets.set(tileKey(x, y), { x, y, power: true });
        state.pelletsLeft += 1;
      }
      if (cell === "P") {
        playerSpawn = { x, y };
      }
      if (cell === "G") {
        ghostSpawns.push({ x, y });
      }
      if (cell === " ") {
        const openCenter = x > 2 && y > 2 && x < GRID_COLS - 3 && y < GRID_ROWS - 3;
        if (openCenter && Math.random() < 0.02 + config.number * 0.004) {
          state.pellets.set(tileKey(x, y), { x, y, power: false });
          state.pelletsLeft += 1;
        }
      }
    }
  }

  state.player = {
    x: playerSpawn.x * TILE + TILE / 2,
    y: playerSpawn.y * TILE + TILE / 2,
    dirX: 0,
    dirY: 0,
    nextX: 0,
    nextY: 0,
    speed: config.playerSpeed,
    radius: TILE * 0.36,
    mouth: 0,
    mouthDir: 1
  };

  const palette = ["#ff3d81", "#44f1ff", "#9dff4f", "#ff9f3d", "#ffc93d", "#ff5fd7"];

  for (let i = 0; i < config.ghostCount; i += 1) {
    const spawn = ghostSpawns[i % Math.max(ghostSpawns.length, 1)] || { x: 10, y: 10 };
    state.ghosts.push({
      x: spawn.x * TILE + TILE / 2 + (i % 2) * 3,
      y: spawn.y * TILE + TILE / 2 + (i % 3) * 2,
      dirX: [1, -1, 0, 0][i % 4],
      dirY: [0, 0, 1, -1][i % 4],
      speed: config.ghostSpeed + (i % 2) * 0.08,
      radius: TILE * 0.33,
      color: palette[i % palette.length],
      frightened: false,
      deadUntil: 0
    });
  }
}

function isWallTile(x, y) {
  return state.walls.some((w) => w.x === x && w.y === y);
}

function canMoveTo(px, py, radius) {
  const left = Math.floor((px - radius) / TILE);
  const right = Math.floor((px + radius) / TILE);
  const top = Math.floor((py - radius) / TILE);
  const bottom = Math.floor((py + radius) / TILE);

  if (left < 0 || top < 0 || right >= GRID_COLS || bottom >= GRID_ROWS) {
    return false;
  }

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (isWallTile(x, y)) {
        return false;
      }
    }
  }
  return true;
}

function desiredDirection() {
  if (state.keys.ArrowUp) return { x: 0, y: -1 };
  if (state.keys.ArrowDown) return { x: 0, y: 1 };
  if (state.keys.ArrowLeft) return { x: -1, y: 0 };
  if (state.keys.ArrowRight) return { x: 1, y: 0 };
  return null;
}

function updatePlayer(delta) {
  const p = state.player;
  const wish = desiredDirection();

  if (wish) {
    p.nextX = wish.x;
    p.nextY = wish.y;
  }

  if (p.nextX !== 0 || p.nextY !== 0) {
    const testX = p.x + p.nextX * p.speed;
    const testY = p.y + p.nextY * p.speed;
    if (canMoveTo(testX, testY, p.radius)) {
      p.dirX = p.nextX;
      p.dirY = p.nextY;
    }
  }

  const nx = p.x + p.dirX * p.speed;
  const ny = p.y + p.dirY * p.speed;

  if (canMoveTo(nx, ny, p.radius)) {
    p.x = nx;
    p.y = ny;
  }

  if (p.x < 0) p.x = CANVAS_SIZE;
  if (p.x > CANVAS_SIZE) p.x = 0;

  p.mouth += p.mouthDir * 9 * delta;
  if (p.mouth > 1 || p.mouth < 0.08) {
    p.mouthDir *= -1;
  }

  const tx = Math.floor(p.x / TILE);
  const ty = Math.floor(p.y / TILE);
  const key = tileKey(tx, ty);
  if (state.pellets.has(key)) {
    const pellet = state.pellets.get(key);
    state.pellets.delete(key);
    state.pelletsLeft -= 1;
    state.score += pellet.power ? 80 : 10;

    if (pellet.power) {
      const fright = LEVELS[state.levelIndex].frightTime;
      state.powerTimer = fright;
      state.ghosts.forEach((g) => {
        g.frightened = true;
      });
    }

    if (state.pelletsLeft <= 0) {
      nextLevel();
    }
  }
}

function ghostChoices(ghost) {
  const options = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];

  return options.filter((dir) => {
    const opposite = dir.x === -ghost.dirX && dir.y === -ghost.dirY;
    if (opposite) return false;
    const nx = ghost.x + dir.x * ghost.speed;
    const ny = ghost.y + dir.y * ghost.speed;
    return canMoveTo(nx, ny, ghost.radius);
  });
}

function updateGhosts(delta) {
  const now = performance.now();
  const p = state.player;

  if (state.powerTimer > 0) {
    state.powerTimer -= delta;
    if (state.powerTimer <= 0) {
      state.ghosts.forEach((g) => {
        g.frightened = false;
      });
    }
  }

  for (const ghost of state.ghosts) {
    if (ghost.deadUntil > now) {
      continue;
    }

    const centerOffsetX = Math.abs((ghost.x % TILE) - TILE / 2);
    const centerOffsetY = Math.abs((ghost.y % TILE) - TILE / 2);
    const atCenter = centerOffsetX < 2.4 && centerOffsetY < 2.4;

    if (atCenter) {
      const choices = ghostChoices(ghost);
      if (choices.length > 0) {
        const chaseBias = state.levelIndex > 2 ? 0.7 : 0.55;
        if (Math.random() < chaseBias && !ghost.frightened) {
          choices.sort((a, b) => {
            const da = Math.hypot((ghost.x + a.x * TILE) - p.x, (ghost.y + a.y * TILE) - p.y);
            const db = Math.hypot((ghost.x + b.x * TILE) - p.x, (ghost.y + b.y * TILE) - p.y);
            return da - db;
          });
          ghost.dirX = choices[0].x;
          ghost.dirY = choices[0].y;
        } else {
          const pick = choices[Math.floor(Math.random() * choices.length)];
          ghost.dirX = pick.x;
          ghost.dirY = pick.y;
        }
      } else {
        ghost.dirX *= -1;
        ghost.dirY *= -1;
      }
    }

    const speedFactor = ghost.frightened ? 0.64 : 1;
    const nx = ghost.x + ghost.dirX * ghost.speed * speedFactor;
    const ny = ghost.y + ghost.dirY * ghost.speed * speedFactor;

    if (canMoveTo(nx, ny, ghost.radius)) {
      ghost.x = nx;
      ghost.y = ny;
    } else {
      ghost.dirX *= -1;
      ghost.dirY *= -1;
    }

    const d = Math.hypot(ghost.x - p.x, ghost.y - p.y);
    if (d < ghost.radius + p.radius - 2) {
      if (ghost.frightened) {
        state.score += 220;
        ghost.deadUntil = now + 2500;
        ghost.x = 10 * TILE + TILE / 2;
        ghost.y = 10 * TILE + TILE / 2;
        ghost.frightened = false;
      } else {
        loseLife();
        return;
      }
    }
  }
}

function loseLife() {
  state.lives -= 1;
  if (state.lives <= 0) {
    state.gameOver = true;
    state.running = false;
    showOverlay("Fim de jogo. Pressione iniciar para jogar novamente.", "Jogar novamente");
    return;
  }

  const cfg = LEVELS[state.levelIndex];
  parseLevel(cfg);
}

function nextLevel() {
  if (state.levelIndex >= LEVELS.length - 1) {
    state.running = false;
    state.win = true;
    showOverlay("Voce venceu as 10 fases no neon!", "Reiniciar");
    return;
  }

  state.levelIndex += 1;
  parseLevel(LEVELS[state.levelIndex]);
}

function drawBoard() {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLS; x += 1) {
      ctx.strokeStyle = "rgba(30, 230, 255, 0.06)";
      ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE, TILE);
    }
  }

  state.walls.forEach((w) => {
    const x = w.x * TILE;
    const y = w.y * TILE;
    ctx.fillStyle = "rgba(7, 26, 36, 0.95)";
    ctx.fillRect(x, y, TILE, TILE);

    ctx.strokeStyle = "#2ee6ff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#2ee6ff";
    ctx.shadowBlur = 10;
    ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.shadowBlur = 0;
  });

  for (const pellet of state.pellets.values()) {
    const cx = pellet.x * TILE + TILE / 2;
    const cy = pellet.y * TILE + TILE / 2;
    const r = pellet.power ? 6 : 3;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = pellet.power ? "#ff5fd7" : "#ffe66d";
    ctx.shadowColor = pellet.power ? "#ff5fd7" : "#ffe66d";
    ctx.shadowBlur = pellet.power ? 12 : 6;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawPlayer() {
  const p = state.player;
  const angle = Math.atan2(p.dirY || 0.00001, p.dirX || 1);
  const mouth = 0.18 + 0.22 * Math.abs(p.mouth);

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, p.radius, mouth, Math.PI * 2 - mouth);
  ctx.closePath();

  ctx.fillStyle = "#ff2020";
  ctx.shadowColor = "#ff2020";
  ctx.shadowBlur = 18;
  ctx.fill();

  ctx.restore();
  ctx.shadowBlur = 0;
}

function drawGhost(ghost) {
  const bodyW = ghost.radius * 1.9;
  const bodyH = ghost.radius * 1.95;

  ctx.save();
  ctx.translate(ghost.x, ghost.y);

  const color = ghost.frightened ? "#6da6ff" : ghost.color;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;

  ctx.beginPath();
  ctx.moveTo(-bodyW / 2, bodyH / 2);
  ctx.lineTo(-bodyW / 2, 0);
  ctx.arc(0, 0, bodyW / 2, Math.PI, 0, false);
  ctx.lineTo(bodyW / 2, bodyH / 2);

  const waveCount = 4;
  const waveW = bodyW / waveCount;
  for (let i = waveCount; i > 0; i -= 1) {
    const px = -bodyW / 2 + (i - 1) * waveW;
    ctx.quadraticCurveTo(px + waveW / 2, bodyH / 2 - 7, px, bodyH / 2);
  }

  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-ghost.radius * 0.32, -ghost.radius * 0.12, ghost.radius * 0.25, 0, Math.PI * 2);
  ctx.arc(ghost.radius * 0.32, -ghost.radius * 0.12, ghost.radius * 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#09101c";
  ctx.beginPath();
  ctx.arc(-ghost.radius * 0.28, -ghost.radius * 0.08, ghost.radius * 0.12, 0, Math.PI * 2);
  ctx.arc(ghost.radius * 0.28, -ghost.radius * 0.08, ghost.radius * 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.shadowBlur = 0;
}

function drawEntities() {
  drawPlayer();
  state.ghosts.forEach((ghost) => {
    if (ghost.deadUntil <= performance.now()) {
      drawGhost(ghost);
    }
  });
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  livesEl.textContent = String(state.lives);
  levelEl.textContent = `${state.levelIndex + 1}/10`;
}

function showOverlay(text, btnText) {
  overlayText.textContent = text;
  startBtn.textContent = btnText;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function gameLoop(ts) {
  if (!state.running) {
    drawBoard();
    drawEntities();
    updateHud();
    return;
  }

  const delta = Math.min((ts - state.lastTime) / 1000, 0.04);
  state.lastTime = ts;

  updatePlayer(delta);
  updateGhosts(delta);

  drawBoard();
  drawEntities();
  updateHud();

  requestAnimationFrame(gameLoop);
}

const bgMusic = new Audio("deltax-music-burst-286988.mp3");
bgMusic.loop = true;

function newGame() {
  state.running = true;
  state.gameOver = false;
  state.win = false;
  state.score = 0;
  state.lives = 3;
  state.levelIndex = 0;
  parseLevel(LEVELS[state.levelIndex]);
  state.lastTime = performance.now();
  hideOverlay();
  bgMusic.currentTime = 0;
  bgMusic.play();
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  if (event.key in state.keys) {
    state.keys[event.key] = true;
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key in state.keys) {
    state.keys[event.key] = false;
    event.preventDefault();
  }
});

startBtn.addEventListener("click", () => {
  if (!state.running) {
    newGame();
  }
});

window.addEventListener("resize", scaleCanvasForDpi);

scaleCanvasForDpi();
parseLevel(LEVELS[state.levelIndex]);
showOverlay("Use as setas para controlar. Complete 10 fases com dificuldade crescente.", "Iniciar");
drawBoard();
drawEntities();
updateHud();
