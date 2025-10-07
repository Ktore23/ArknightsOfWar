import { characterDataObj } from './character.js'; // Import data nhân vật

let canvas, backgroundCanvas, backgroundCtx;
let gl;
let importedModules = {}; // Lưu module dynamic
const characterModuleNameMap = {
  "Kroos": "Kroos"
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
  "Kroos": './models/operators/Kroos/Kroos.js'
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

// Hàm để render Kroos bot ở trạng thái idle
function addKroosBotForTesting() {
  const char = "Kroos";
  const module = importedModules[char];
  if (!module) {
    console.error(`Module cho ${char} không tồn tại`);
    return;
  }

  const moduleName = characterModuleNameMap[char];
  const loadFunc = module[`load${moduleName}Skeleton`];
  const isLoadingComplete = module[`is${moduleName}LoadingComplete`];

  if (!isLoadingComplete()) {
    console.error(`Assets ${char} chưa load xong`);
    return;
  }

  // Tìm unit Kroos được thả gần nhất
  let botWorldX = 1500;

  const newHitbox = {
    x: botWorldX + 0 - 100 / 2,
    y: GROUND_Y + 0 - 200 / 2,
    width: 100,
    height: 200
  };

  // Kiểm tra overlap
  if (isOverlappingWithOtherUnit(newHitbox, playerUnits)) {
    console.log(`Vị trí bot chồng chéo, thử offset...`);
    botWorldX += newHitbox.width + 50;
    newHitbox.x = botWorldX + 0 - 100 / 2;
  }

  const botUnit = loadFunc(botWorldX, true); // isBot = true
  if (!botUnit) {
    console.error(`Không thể tạo bot ${char}`);
    return;
  }

  // Gán thuộc tính cho bot
  botUnit.type = char;
  botUnit.worldX = botWorldX;
  botUnit.x = botWorldX;
  botUnit.hp = 1000000;
  botUnit.maxHp = characterDataObj[char].hp;
  botUnit.direction = -1;
  botUnit.skeleton.scaleX = -1;
  botUnit.skeleton.scaleY = 1;
  botUnit.velocity = 0;
  botUnit.tower = TOWER_POSITIONS[0];
  botUnit.isBot = true; // Thêm thuộc tính để xác định bot

  // Set animation Idle và khóa trạng thái
  try {
    if (!botUnit.skeleton || (!botUnit.state && !botUnit.skeleton.state)) {
      throw new Error("Skeleton hoặc state không được khởi tạo cho bot");
    }
    // Sử dụng botUnit.state nếu tồn tại (cho module thực tế), fallback skeleton.state nếu không
    const animState = botUnit.state || botUnit.skeleton.state;
    animState.setAnimation(0, "Idle", true);
    animState.isLockedIdle = true;
    console.log(`Đã set animation Idle cho Kroos bot`);
  } catch (error) {
    console.error(`Lỗi khi set animation Idle cho bot:`, error);
    // Fallback: Không set animation, bot vẫn hiển thị với render fallback
  }

  playerUnits.push(botUnit);
  // console.log(`Đã thêm Kroos bot tại x=${botWorldX}. Hitbox:`, newHitbox);
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

  // Load module cho Kroos
  const char = "Kroos";
  try {
    const modulePath = characterModules[char];
    const module = await import(modulePath);
    importedModules[char] = module;
    if (typeof module.initKroos === 'function') {
      module.initKroos(gl); // Init assets
      console.log(`Đã load và init cho demo`);
    } else {
      console.error(`init không tồn tại trong module ${char}`);
    }
  } catch (error) {
    console.error(`Lỗi load:`, error);
    // Fallback
    importedModules[char] = {
      loadSurtrSkeleton: (x, isBot) => ({
        worldX: x,
        x: x,
        skeleton: { scaleX: isBot ? -1 : 1, scaleY: 1, state: { setAnimation: () => { } } },
        hitbox: { offsetX: 0, offsetY: 0, width: 100, height: 200 },
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
    console.log(`Dùng fallback cho để test hitbox`);
  }

  // Đợi tài nguyên Kroos load xong rồi thêm bot
  const waitForKroosAssets = setInterval(() => {
    const module = importedModules[char];
    if (module && module.isKroosLoadingComplete && module.isKroosLoadingComplete()) {
      clearInterval(waitForKroosAssets); // Dừng interval khi load xong
      addKroosBotForTesting(); // Thêm bot
    } else {
      console.log(`Đang đợi tài nguyên Kroos load...`);
    }
  }, 100); // Kiểm tra mỗi 100ms

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
  let newWorldX = window.innerWidth / 2;
  const tempUnit = loadFunc(newWorldX, false);
  if (!tempUnit) {
    console.error(`Không thể load ${char} skeleton`);
    return;
  }

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
  newUnit.skeleton.scaleY = 1;
  newUnit.velocity = 50;
  newUnit.tower = TOWER_POSITIONS[1];

  playerUnits.push(newUnit);
  playerDP -= stats.dp;
  lastDeployTime[char] = Date.now();
  updateDPDisplay();
}

function updateDPDisplay() {
  document.getElementById('dpDisplay').textContent = `${playerDP}/${MAX_DP}`;
  document.getElementById('unitDisplay').textContent = `${playerUnits.length}/${MAX_UNITS_PER_SIDE}`;
}

function render(now) {
  const delta = (now - lastFrameTime) / 1000 || 0;
  lastFrameTime = now;

  // Tạo danh sách enemyUnits (bot)
  const enemyUnits = playerUnits.filter(unit => unit.isBot);

  // Cập nhật camera để hiển thị bot
  const bot = playerUnits.find(unit => unit.type === "Kroos" && unit.direction === -1);
  if (bot) {
    camera.x = Math.max(0, Math.min(bot.worldX - window.innerWidth / 2, WORLD_WIDTH - window.innerWidth));
    // console.log(`Camera di chuyển đến bot: x=${camera.x}`);
  }

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
    // console.log(`Rendering unit:`, unit, `Skeleton scale:`, { scaleX: unit.skeleton.scaleX, scaleY: unit.skeleton.scaleY });

    // Render nhân vật
    try {
      renderFunc(unit, delta, camera, canvas, groundTileImage, WORLD_WIDTH, GROUND_Y, TOWER_POSITIONS, backgroundCtx, gl, playerUnits, enemyUnits);
    } catch (error) {
      console.error(`Lỗi render ${char}:`, error);
      backgroundCtx.fillStyle = "blue";
      backgroundCtx.fillRect(unit.worldX - camera.x - 50, GROUND_Y - 100, 100, 200);
    }

    // Vẽ hitbox
    const hitboxX = unit.worldX - camera.x + unit.hitbox.offsetX - unit.hitbox.width / 2;
    const hitboxY = GROUND_Y + unit.hitbox.offsetY - unit.hitbox.height / 2;
    backgroundCtx.strokeStyle = "red";
    backgroundCtx.lineWidth = 2;
    backgroundCtx.strokeRect(hitboxX, hitboxY, unit.hitbox.width, unit.hitbox.height);

    // Hiển thị kích thước hitbox
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