import { characterDataObj } from './character.js'; // Import data nhân vật

let canvas, backgroundCanvas, backgroundCtx;
let gl;
let importedModules = {}; // Lưu module dynamic
const characterModuleNameMap = {
  "Exusiai": "Exusiai"
};
const GROUND_Y = 0;
const WORLD_WIDTH = 2000;
const MAX_UNITS_PER_SIDE = 10;
let playerUnits = [];
let playerDP = 200;
const MAX_DP = 500;
const DP_REGEN_RATE = 1;
let lastDeployTime = {};
let camera = { x: 0 };
let lastFrameTime;
let groundTileImage = new Image();
let isGroundTileLoaded = false;

// Định nghĩa TOWER_POSITIONS (giống render.js)
const TOWER_POSITIONS = [
  {
    x: -100,
    y: GROUND_Y - 35,
    hitbox: { width: 200, height: 400, offsetX: 250, offsetY: 250 },
    hp: 10000,
    maxHp: 10000
  },
  {
    x: WORLD_WIDTH - 400,
    y: GROUND_Y - 35,
    hitbox: { width: 200, height: 400, offsetX: 250, offsetY: 250 },
    hp: 10000,
    maxHp: 10000
  }
];

// Module path cho nhân vật test
const characterModules = {
  "Exusiai": './models/operators/Exusiai/Exusiai.js'
};

// Load groundTileImage
groundTileImage.src = "assets/images/battlefield_ground.png";
groundTileImage.onload = () => { isGroundTileLoaded = true; console.log("Ground tile loaded"); };
groundTileImage.onerror = () => { console.error("Failed to load ground tile"); };

// Hàm kiểm tra overlap
function isOverlappingWithOtherUnit(newHitbox, existingUnits) {
  return existingUnits.some(unit => {
    const unitHitbox = {
      x: unit.worldX + unit.hitbox.offsetX - unit.hitbox.width / 2,
      y: GROUND_Y + unit.hitbox.offsetY - unit.hitbox.height / 2,
      width: unit.hitbox.width,
      height: unit.hitbox.height
    };
    return !(newHitbox.x + newHitbox.width <= unitHitbox.x ||
             newHitbox.x >= unitHitbox.x + unitHitbox.width ||
             newHitbox.y + newHitbox.height <= unitHitbox.y ||
             newHitbox.y >= unitHitbox.y + unitHitbox.height);
  });
}

async function init() {
  canvas = document.getElementById("canvas");
  backgroundCanvas = document.getElementById("backgroundCanvas");
  backgroundCtx = backgroundCanvas.getContext("2d");

  canvas.width = backgroundCanvas.width = window.innerWidth;
  canvas.height = backgroundCanvas.height = window.innerHeight;

  const config = { alpha: true };
  gl = canvas.getContext("webgl", config) || canvas.getContext("experimental-webgl", config);
  if (!gl) {
    alert('WebGL unavailable');
    return;
  }

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Load module cho Surtr
  const char = "Exusiai";
  try {
    const modulePath = characterModules[char];
    const module = await import(modulePath);
    importedModules[char] = module;
    if (typeof module.initExusiai === 'function') {
      module.initExusiai(gl); // Init assets
      console.log(`Đã load và init Surtr cho demo`);
    } else {
      console.error(`initSurtr không tồn tại trong module ${char}`);
    }
  } catch (error) {
    console.error(`Lỗi load Surtr:`, error);
    // Fallback
    importedModules[char] = {
      loadSurtrSkeleton: (x, isBot) => ({
        worldX: x,
        x: x,
        skeleton: { scaleX: isBot ? -1 : 1, scaleY: 1, state: { setAnimation: () => {} } },
        hitbox: { offsetX: 0, offsetY: 0, width: 100, height: 200 }, // Kích thước giả lập
        direction: isBot ? -1 : 1,
        velocity: 50,
        tower: TOWER_POSITIONS[1]
      }),
      isSurtrLoadingComplete: () => true,
      renderSurtrSkeleton: (unit) => {
        backgroundCtx.fillStyle = "blue";
        backgroundCtx.fillRect(unit.worldX - camera.x - 50, GROUND_Y - 100, 100, 200);
      }
    };
    console.log(`Dùng fallback cho Surtr để test hitbox`);
  }

  // Regenerate DP
  setInterval(() => {
    if (playerDP < MAX_DP) {
      playerDP = Math.min(playerDP + DP_REGEN_RATE, MAX_DP);
      updateDPDisplay();
    }
  }, 1000);

  // Event thả nhân vật test
  document.getElementById('deployButton').addEventListener('click', () => tryAddUnit(char));

  // Hiển thị danh sách animation
  const module = importedModules[char];
  if (module && module.isSurtrLoadingComplete && module.isSurtrLoadingComplete()) {
    const tempUnit = module.loadSurtrSkeleton(0, false);
    if (tempUnit && tempUnit.skeleton && tempUnit.skeleton.data && tempUnit.skeleton.data.animations) {
      const animations = tempUnit.skeleton.data.animations.map(anim => anim.name);
      const select = document.getElementById('animationSelect');
      animations.forEach(anim => {
        const option = document.createElement('option');
        option.value = anim;
        option.textContent = anim;
        select.appendChild(option);
      });
      select.addEventListener('change', (e) => {
        const selectedAnim = e.target.value;
        playerUnits.forEach(unit => {
          if (unit.skeleton && unit.skeleton.state) {
            try {
              unit.skeleton.state.setAnimation(0, selectedAnim, true);
            } catch (error) {
              console.error(`Lỗi khi set animation ${selectedAnim}:`, error);
            }
          }
        });
      });
    } else {
      console.warn(`Không tìm thấy animations cho Surtr, hoặc skeleton không hợp lệ`);
    }
  }

  requestAnimationFrame(render);
}

function tryAddUnit(char) {
  const module = importedModules[char];
  if (!module) {
    console.error(`Module cho ${char} không tồn tại`);
    return;
  }

  const moduleName = characterModuleNameMap[char];
  const loadFunc = module[`load${moduleName}Skeleton`];
  const isLoadingComplete = module[`is${moduleName}LoadingComplete`];

  if (!isLoadingComplete()) {
    console.log(`Assets ${char} chưa load xong`);
    return;
  }

  if (playerUnits.length >= MAX_UNITS_PER_SIDE) {
    console.log(`Đạt giới hạn ${MAX_UNITS_PER_SIDE} unit!`);
    return;
  }

  const stats = characterDataObj[char];
  if (!stats) {
    console.error(`Không tìm thấy stats cho ${char}`);
    return;
  }

  if (playerDP < stats.dp) {
    console.log(`Không đủ DP! Cần ${stats.dp}, hiện có ${playerDP}`);
    return;
  }

  // Thả ở giữa màn hình
  let newWorldX = window.innerWidth / 2 - 500;
  const tempUnit = loadFunc(newWorldX, false);
  if (!tempUnit) {
    console.error(`Không thể load ${char} skeleton`);
    return;
  }

  // Log kích thước skeleton và hitbox
  console.log(`TempUnit skeleton:`, tempUnit.skeleton, `Hitbox:`, tempUnit.hitbox);

  const newHitbox = {
    x: newWorldX + tempUnit.hitbox.offsetX - tempUnit.hitbox.width / 2,
    y: GROUND_Y + tempUnit.hitbox.offsetY - tempUnit.hitbox.height / 2,
    width: tempUnit.hitbox.width,
    height: tempUnit.hitbox.height
  };

  // Kiểm tra overlap
  if (isOverlappingWithOtherUnit(newHitbox, playerUnits)) {
    console.log(`Vị trí chồng chéo, thử offset...`);
    newWorldX += newHitbox.width + 50;
  }

  const newUnit = loadFunc(newWorldX, false);
  if (!newUnit) {
    console.error(`Không thể tạo unit ${char}`);
    return;
  }

  // Gán đầy đủ thuộc tính
  newUnit.type = char;
  newUnit.worldX = newWorldX;
  newUnit.x = newWorldX;
  newUnit.hp = stats.hp;
  newUnit.maxHp = stats.hp;
  newUnit.direction = 1;
  newUnit.skeleton.scaleX = 1;
  newUnit.skeleton.scaleY = 1; // Thêm scaleY để đồng bộ
  newUnit.velocity = 50;
  newUnit.tower = TOWER_POSITIONS[1];

  playerUnits.push(newUnit);
  playerDP -= stats.dp;
  lastDeployTime[char] = now;
  updateDPDisplay();
  console.log(`Thả ${char} tại x=${newWorldX}. Hitbox:`, newHitbox, `Unit:`, newUnit);
}

function updateDPDisplay() {
  document.getElementById('dpDisplay').textContent = `${playerDP}/${MAX_DP}`;
  document.getElementById('unitDisplay').textContent = `${playerUnits.length}/${MAX_UNITS_PER_SIDE}`;
}

function render(now) {
  const delta = (now - lastFrameTime) / 1000 || 0;
  lastFrameTime = now;

  backgroundCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Render units và vẽ hitbox
  playerUnits.forEach(unit => {
    const char = unit.type;
    const module = importedModules[char];
    if (!module) {
      console.error(`Không tìm thấy module cho ${char}`);
      return;
    }

    const moduleName = characterModuleNameMap[char];
    const renderFunc = module[`render${moduleName}Skeleton`];

    // Log unit để debug
    console.log(`Rendering unit:`, unit, `Skeleton scale:`, { scaleX: unit.skeleton.scaleX, scaleY: unit.skeleton.scaleY });

    // Render nhân vật
    try {
      renderFunc(unit, delta, camera, canvas, groundTileImage, WORLD_WIDTH, GROUND_Y, TOWER_POSITIONS, backgroundCtx, gl, playerUnits, []);
    } catch (error) {
      console.error(`Lỗi render ${char}:`, error);
      // Fallback render
      backgroundCtx.fillStyle = "blue";
      backgroundCtx.fillRect(unit.worldX - camera.x - 50, GROUND_Y - 100, 100, 200);
    }

    // Vẽ hitbox
    const hitboxX = unit.worldX - camera.x + unit.hitbox.offsetX - unit.hitbox.width / 2;
    const hitboxY = GROUND_Y + unit.hitbox.offsetY - unit.hitbox.height / 2;
    backgroundCtx.strokeStyle = "red";
    backgroundCtx.lineWidth = 2;
    backgroundCtx.strokeRect(hitboxX, hitboxY, unit.hitbox.width, unit.hitbox.height);

    // Hiển thị kích thước hitbox trên canvas
    backgroundCtx.fillStyle = "black";
    backgroundCtx.font = "12px Arial";
    backgroundCtx.textAlign = "center";
    backgroundCtx.fillText(`Hitbox: ${unit.hitbox.width.toFixed(2)}x${unit.hitbox.height.toFixed(2)}`, hitboxX + unit.hitbox.width / 2, hitboxY - 10);
  });

  requestAnimationFrame(render);
}

window.addEventListener('resize', () => {
  canvas.width = backgroundCanvas.width = window.innerWidth;
  canvas.height = backgroundCanvas.height = window.innerHeight;
});

init();