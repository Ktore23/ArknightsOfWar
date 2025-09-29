import { characterDataObj } from './character.js';
import { initBot, updateBotUnits, getBotUnits } from './bot.js';

let canvas, backgroundCanvas, backgroundCtx;
let backgroundImage = new Image(), isBackgroundLoaded = false;
let towerImage = new Image(), isTowerLoaded = false;
let groundTileImage = new Image(), isGroundTileLoaded = false;
let mouseX = 0, camera = { x: 0 };
let lastFrameTime;
let hasLoggedRightTower = false;
let gl;
// let surtrs = [];
// let shus = [];
// let chens = [];
// let frostNovas = [];
let playerUnits = []; // Mảng duy nhất lưu tất cả units của người chơi
let isGameOver = false;
export let importedModules = {}; // Object lưu module dynamic: { "Surtr": { initSurtr, loadSurtrSkeleton, ... }, ... }
let selectedCharacters = []; // Sẽ đọc từ localStorage
export let botSelected = [];  // Export để bot.js dùng
// Thêm biến mới
let playerDP = 20; // DP ban đầu cho người chơi
const MAX_DP = 50; // DP tối đa
const MAX_UNITS_PER_SIDE = 10; // Giới hạn 10 unit mỗi bên
let lastDeployTime = {}; // Lưu thời gian thả cuối cùng cho mỗi char
const DP_REGEN_RATE = 1; // +1 DP mỗi giây

const WORLD_WIDTH = 4000;
const CAMERA_SPEED = 1000;
const EDGE_THRESHOLD = 0.01;
const GROUND_Y = 0;
const TILE_SCALE = 3;
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
const LINE_Y = GROUND_Y + 420;
const LINE_COLOR = "red";
const LINE_WIDTH = 2;
const DEFAULT_SURTR_X = 250;
const SAFE_OFFSET = 100; // Tăng từ 50 lên 100 để đảm bảo khoảng cách an toàn

backgroundImage.src = "assets/images/background.png";
backgroundImage.onload = () => { isBackgroundLoaded = true; console.log("Background loaded"); };
backgroundImage.onerror = () => { console.error("Failed to load background"); };

towerImage.src = "assets/images/tower.png";
towerImage.onload = () => { isTowerLoaded = true; console.log("Tower loaded"); };
towerImage.onerror = () => { console.error("Failed to load tower"); };

groundTileImage.src = "assets/images/battlefield_ground.png";
groundTileImage.onload = () => { isGroundTileLoaded = true; console.log("Ground tile loaded"); };
groundTileImage.onerror = () => { console.error("Failed to load ground tile"); };

// Map path module cho từng nhân vật (thêm khi có nhân vật mới)
const characterModules = {
  "Surtr": '/models/operators/Surtr/Surtr.js',
  "Shu": '/models/operators/Shu/Shu.js',
  "Ch'en": '/models/operators/Chen/Chen.js', // Lưu ý: "Ch'en" trong data, nhưng dùng "Chen" cho module
  "Frost Nova": '/models/enemies/FrostNova/FrostNova.js' // Nếu có space trong name, dùng như vậy
};

// Hàm helper để get array units theo type
// function getUnitsArray(type) {
//   switch (type) {
//     case "Surtr": return surtrs;
//     case "Shu": return shus;
//     case "Ch'en": return chens;
//     case "Frost Nova": return frostNovas;
//     default: return [];
//   }
// }

// // Hàm helper để set units array sau filter
// function setUnitsArray(type, updatedArray) {
//   switch (type) {
//     case "Surtr": surtrs = updatedArray; break;
//     case "Shu": shus = updatedArray; break;
//     case "Ch'en": chens = updatedArray; break;
//     case "Frost Nova": frostNovas = updatedArray; break;
//   }
// }

// THÊM MỚI: Map để xử lý tên nhân vật có dấu/special char (như "Ch'en" -> "Chen") để gọi hàm đúng
export const characterModuleNameMap = {
  "Surtr": "Surtr",
  "Shu": "Shu",
  "Ch'en": "Chen",
  "Frost Nova": "FrostNova"
  // Thêm nhân vật mới nếu cần, ví dụ: "Some'Char": "SomeChar"
};

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
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

  // Đọc selected từ localStorage
  const storedSelected = localStorage.getItem('selectedCharacters');
  if (storedSelected) {
    selectedCharacters = JSON.parse(storedSelected);
    localStorage.removeItem('selectedCharacters'); // Xóa sau khi đọc để tránh reuse
  } else {
    console.error('Không có nhân vật được chọn! Quay lại index.html.');
    return;
  }

  // Bot tự chọn ngẫu nhiên 3 nhân vật từ characterModules (có thể khác player)
  const allAvailableChars = Object.keys(characterModules);  // ['Surtr', 'Shu', "Ch'en", 'Frost Nova']
  botSelected = allAvailableChars.sort(() => 0.5 - Math.random()).slice(0, 3);  // Chọn random 3, không lặp
  console.log(`Bot đã chọn: ${botSelected.join(', ')}`);

  // Dynamic import và init chỉ cho botSelected (tương tự player)
  for (let char of botSelected) {
    try {
      const modulePath = characterModules[char];
      if (!modulePath) continue;
      const module = await import(modulePath);
      importedModules[char] = module;  // Lưu chung với player, vì importedModules là global

      // Init assets cho bot char
      const moduleName = characterModuleNameMap[char];
      const initFunc = module[`init${moduleName}`];
      if (initFunc) initFunc(gl);
      console.log(`Đã import và init ${char} cho bot`);
    } catch (error) {
      console.error(`Lỗi import ${char} cho bot:`, error);
    }
  }

  // Dynamic import và init chỉ cho selected
  for (let char of selectedCharacters) {
    try {
      const modulePath = characterModules[char];
      if (!modulePath) {
        console.error(`Không tìm thấy module cho ${char}`);
        continue;
      }
      const module = await import(modulePath); // Dynamic import
      importedModules[char] = module;

      // Init assets cho char
      switch (char) {
        case "Surtr": module.initSurtr(gl); break;
        case "Shu": module.initShu(gl); break;
        case "Ch'en": module.initChen(gl); break;
        case "Frost Nova": module.initFrostNova(gl); break;
      }
      console.log(`Đã import và init ${char}`);
    } catch (error) {
      console.error(`Lỗi import ${char}:`, error);
    }
  }

  initBot(TOWER_POSITIONS, GROUND_Y, WORLD_WIDTH);

  // Thêm UI hiển thị DP
  const controls = document.querySelector('.controls');
  const dpDisplay = document.createElement('div');
  dpDisplay.id = 'dpDisplay';
  dpDisplay.style.color = 'white';
  dpDisplay.style.marginTop = '10px';
  dpDisplay.style.fontSize = '50px'; // Tăng kích thước chữ lên 20px (từ mặc định ~16px)
  dpDisplay.style.fontWeight = 'bold'; // Làm chữ đậm để dễ đọc
  dpDisplay.style.padding = '5px'; // Thêm padding cho đẹp
  dpDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'; // Nền tối hơn một chút
  dpDisplay.style.borderRadius = '5px'; // Bo góc cho đẹp
  dpDisplay.textContent = `DP: ${playerDP}/${MAX_DP}`;
  controls.appendChild(dpDisplay);

  // Thêm UI hiển thị số lượng unit
  const unitDisplay = document.createElement('div');
  unitDisplay.id = 'unitDisplay';
  unitDisplay.style.color = 'white';
  unitDisplay.style.marginTop = '5px';
  unitDisplay.style.fontSize = '50px';
  unitDisplay.style.fontWeight = 'bold';
  unitDisplay.style.padding = '5px';
  unitDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  unitDisplay.style.borderRadius = '5px';
  unitDisplay.textContent = `Units: ${playerUnits.length}/${MAX_UNITS_PER_SIDE}`;
  controls.appendChild(unitDisplay);

  // Regenerate DP mỗi giây
  setInterval(() => {
    if (playerDP < MAX_DP) {
      playerDP = Math.min(playerDP + DP_REGEN_RATE, MAX_DP);
      dpDisplay.textContent = `DP: ${playerDP}/${MAX_DP}`;
    }
  }, 1000);

  // Khởi tạo lastDeployTime và thêm UI hiển thị CD cho mỗi avatar
  selectedCharacters.forEach(char => {
    lastDeployTime[char] = 0;
    const avatarContainer = document.createElement('div');
    avatarContainer.style.position = 'relative';
    avatarContainer.style.display = 'inline-block';
    avatarContainer.style.marginRight = '10px';

    const avatar = document.createElement('img');
    avatar.src = characterDataObj[char].image.replace('50', '50');
    avatar.alt = char;
    avatar.classList.add('avatar');
    avatar.dataset.char = char;
    avatar.draggable = false;
    avatar.ondragstart = () => false;
    avatarContainer.appendChild(avatar);

    const cdDisplay = document.createElement('div');
    cdDisplay.id = `cdDisplay-${char}`;
    cdDisplay.style.position = 'absolute';
    cdDisplay.style.top = '50%'; // Căn giữa theo chiều dọc
    cdDisplay.style.left = '50%'; // Căn giữa theo chiều ngang
    cdDisplay.style.transform = 'translate(-50%, -50%)'; // Dịch chuyển để căn giữa chính xác
    cdDisplay.style.width = '100%';
    cdDisplay.style.textAlign = 'center';
    cdDisplay.style.color = 'white';
    cdDisplay.style.fontSize = '50px';
    cdDisplay.style.fontWeight = 'bold';
    cdDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    cdDisplay.style.borderRadius = '3px';
    cdDisplay.style.padding = '2px';
    cdDisplay.style.lineHeight = 'normal'; // Đảm bảo text căn giữa dọc
    cdDisplay.style.opacity = '0';
    avatarContainer.appendChild(cdDisplay);

    avatarContainer.avatar = avatar; // Lưu avatar để truy cập trong render
    avatar.addEventListener('click', () => tryAddNewUnit(char));
    controls.appendChild(avatarContainer);
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
  });

  lastFrameTime = Date.now() / 1000;
  requestAnimationFrame(render);
}

export function isOverlappingWithOtherUnit(newHitbox, existingUnits, GROUND_Y) {
  for (let existing of existingUnits) {
    const existingHitbox = {
      x: isFinite(existing.worldX + existing.hitbox.offsetX * (existing.skeleton.scaleX || 1) - existing.hitbox.width / 2) ?
        existing.worldX + existing.hitbox.offsetX * (existing.skeleton.scaleX || 1) - existing.hitbox.width / 2 :
        existing.worldX,
      y: GROUND_Y + 220 + existing.hitbox.offsetY - existing.hitbox.height / 2,
      width: existing.hitbox.width,
      height: existing.hitbox.height
    };
    if (newHitbox.x < existingHitbox.x + existingHitbox.width + SAFE_OFFSET && // Thêm SAFE_OFFSET vào kiểm tra
      newHitbox.x + newHitbox.width > existingHitbox.x - SAFE_OFFSET &&
      newHitbox.y < existingHitbox.y + existingHitbox.height &&
      newHitbox.y + newHitbox.height > existingHitbox.y) {
      console.log(`Chồng chéo phát hiện tại newHitbox.x=${newHitbox.x}, existingHitbox.x=${existingHitbox.x}`);
      return true;
    }
  }
  return false;
}

// Hàm tryAddNewUnit để thêm unit mới cho nhân vật bất kỳ
function tryAddNewUnit(char) {
  if (isGameOver) {
    console.log("Trò chơi đã kết thúc, không thể thả unit mới.");
    return;
  }

  const module = importedModules[char];
  if (!module) {
    console.error(`Module cho ${char} chưa import!`);
    return;
  }

  // SỬA: Sử dụng map để lấy tên module sạch (xử lý "Ch'en" -> "Chen")
  const moduleName = characterModuleNameMap[char];
  if (!moduleName) {
    console.error(`Không tìm thấy mapping module cho ${char}`);
    return;
  }

  const isLoadingComplete = module[`is${moduleName}LoadingComplete`]; // e.g., isChenLoadingComplete
  if (!isLoadingComplete || !isLoadingComplete()) {
    console.log(`Assets ${char} chưa load xong, thử lại sau...`);
    requestAnimationFrame(() => tryAddNewUnit(char));
    return;
  }

  const stats = characterDataObj[char];
  // Kiểm tra DP
  if (playerDP < stats.dp) {
    console.log(`Không đủ DP để thả ${char}! Cần ${stats.dp} DP, hiện có ${playerDP} DP.`);
    return;
  }

  // Kiểm tra cooldown
  const now = Date.now();
  if (lastDeployTime[char] && now - lastDeployTime[char] < stats.cd * 1000) {
    console.log(`Cooldown cho ${char} chưa hết! Cần chờ thêm ${((stats.cd * 1000 - (now - lastDeployTime[char])) / 1000).toFixed(1)} giây.`);
    return;
  }

  // Kiểm tra giới hạn unit
  // const playerUnits = [...surtrs, ...shus, ...chens, ...frostNovas];
  if (playerUnits.length >= MAX_UNITS_PER_SIDE) {
    console.log(`Đã đạt giới hạn ${MAX_UNITS_PER_SIDE} unit cho người chơi!`);
    return;
  }

  const loadFunc = module[`load${moduleName}Skeleton`]; // e.g., loadChenSkeleton
  // const units = getUnitsArray(char);
  // const allPlayerUnits = [...surtrs, ...shus, ...chens, ...frostNovas]; // Để check overlapping

  const tempUnit = loadFunc(DEFAULT_SURTR_X);
  if (!tempUnit) {
    console.error(`Không thể tải ${char} skeleton`);
    return;
  }

  // Thêm type cho tempUnit
  tempUnit.type = char;

  const newHitbox = {
    x: DEFAULT_SURTR_X + tempUnit.hitbox.offsetX - tempUnit.hitbox.width / 2,
    y: GROUND_Y + 220 + tempUnit.hitbox.offsetY - tempUnit.hitbox.height / 2,
    width: tempUnit.hitbox.width,
    height: tempUnit.hitbox.height
  };

  let newWorldX = DEFAULT_SURTR_X;
  let attempts = 0;
  const maxAttempts = 10;
  while (isOverlappingWithOtherUnit(newHitbox, playerUnits, GROUND_Y) && attempts < maxAttempts) {
    let closestUnit = null;
    let maxX = -Infinity;
    playerUnits.forEach(unit => {
      if (unit.worldX > maxX && unit.worldX < newWorldX) {
        maxX = unit.worldX;
        closestUnit = unit;
      }
    });
    if (closestUnit) {
      const closestHitbox = {
        x: closestUnit.worldX + closestUnit.hitbox.offsetX * (closestUnit.skeleton.scaleX || 1) - closestUnit.hitbox.width / 2,
        y: GROUND_Y + 220 + closestUnit.hitbox.offsetY - closestUnit.hitbox.height / 2,
        width: closestUnit.hitbox.width,
        height: closestUnit.hitbox.height
      };
      newWorldX = closestHitbox.x - (newHitbox.width / 2 + closestHitbox.width / 2 + SAFE_OFFSET);
    } else {
      newWorldX -= (newHitbox.width + SAFE_OFFSET);
    }
    newHitbox.x = newWorldX + tempUnit.hitbox.offsetX - tempUnit.hitbox.width / 2;
    attempts++;
    if (newWorldX < 0) {
      console.warn(`Không thể thả ${char}: không đủ không gian bên trái.`);
      return;
    }
  }

  if (attempts >= maxAttempts) {
    console.warn(`Đạt giới hạn số lần thử, không thể thả ${char} mới.`);
    return;
  }

  const newUnit = loadFunc(newWorldX);
  if (!newUnit) {
    console.error(`Không thể tạo ${char} mới`);
    return;
  }

  // const stats = characterDataObj[char];
  newUnit.type = char; // Thêm type
  newUnit.hp = stats.hp;
  newUnit.maxHp = stats.hp;
  newUnit.velocity = 50; // Giá trị mặc định, có thể lấy từ stats nếu có
  newUnit.direction = 1; // Di chuyển sang phải
  newUnit.skeleton.scaleX = 1; // Hướng mặc định

  // Trừ DP và cập nhật thời gian thả
  playerDP -= stats.dp;
  lastDeployTime[char] = now;
  document.getElementById('dpDisplay').textContent = `DP: ${playerDP}/${MAX_DP}`;
  document.getElementById('unitDisplay').textContent = `Units: ${playerUnits.length + 1}/${MAX_UNITS_PER_SIDE}`;

  playerUnits.push(newUnit);
  console.log(`Thả ${char} tại worldX=${DEFAULT_SURTR_X}, HP=${newUnit.hp}/${newUnit.maxHp}. Tổng unit người chơi: ${playerUnits.length + 1}`);
}

function showGameOverMessage(winner) {
  const gameOverDiv = document.createElement("div");
  gameOverDiv.id = "gameOverMessage";
  gameOverDiv.style.position = "absolute";
  gameOverDiv.style.top = "50%";
  gameOverDiv.style.left = "50%";
  gameOverDiv.style.transform = "translate(-50%, -50%)";
  gameOverDiv.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
  gameOverDiv.style.color = "white";
  gameOverDiv.style.padding = "20px 40px";
  gameOverDiv.style.borderRadius = "10px";
  gameOverDiv.style.fontSize = "24px";
  gameOverDiv.style.fontFamily = "Arial, sans-serif";
  gameOverDiv.style.textAlign = "center";
  gameOverDiv.style.zIndex = "4";
  gameOverDiv.innerHTML = winner === "player" ?
    "Chiến thắng! Tháp phải đã bị phá hủy!<br>Quay về màn hình chính sau 3 giây..." :
    "Bạn đã thua! Tháp trái đã bị phá hủy!<br>Quay về màn hình chính sau 3 giây...";
  document.body.appendChild(gameOverDiv);

  setTimeout(() => {
    window.location.href = "index.html";
  }, 3000);
}

// Hàm render để vẽ tất cả units của nhân vật đã chọn
function render() {
  const currentTime = Date.now() / 1000;
  const delta = currentTime - lastFrameTime;
  lastFrameTime = currentTime;

  backgroundCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);

  // Cập nhật camera
  if (mouseX < canvas.width * EDGE_THRESHOLD && camera.x > 0) {
    camera.x -= CAMERA_SPEED * delta;
    if (camera.x < 0) camera.x = 0;
  } else if (mouseX > canvas.width * (1 - EDGE_THRESHOLD) && camera.x < WORLD_WIDTH - canvas.width) {
    camera.x += CAMERA_SPEED * delta;
    if (camera.x > WORLD_WIDTH - canvas.width) camera.x = WORLD_WIDTH - canvas.width;
  }

  resize();

  backgroundCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
  if (isBackgroundLoaded) {
    const bgHeight = canvas.height;
    const bgWidth = WORLD_WIDTH;
    backgroundCtx.drawImage(backgroundImage, -camera.x, 0, bgWidth, bgHeight);
  } else {
    backgroundCtx.fillStyle = "rgba(100, 100, 100, 1)";
    backgroundCtx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
  }

  if (isGroundTileLoaded) {
    const tileWidth = groundTileImage.width * TILE_SCALE;
    const tileHeight = groundTileImage.height * TILE_SCALE;
    const tilesCount = Math.ceil(WORLD_WIDTH / tileWidth);
    for (let i = 0; i < tilesCount; i++) {
      backgroundCtx.drawImage(
        groundTileImage,
        i * tileWidth - camera.x,
        GROUND_Y,
        tileWidth,
        tileHeight
      );
    }
  } else {
    backgroundCtx.fillStyle = "rgba(139, 69, 19, 1)";
    backgroundCtx.fillRect(-camera.x, GROUND_Y, WORLD_WIDTH, groundTileImage.height * TILE_SCALE || 100);
  }

  if (isTowerLoaded) {
    TOWER_POSITIONS.forEach((tower, index) => {
      const drawX = tower.x - camera.x;
      const drawY = tower.y;
      const width = 500;
      const height = 500;

      backgroundCtx.save();

      const hitboxX = drawX + tower.hitbox.offsetX - tower.hitbox.width / 2;
      const hitboxY = drawY + tower.hitbox.offsetY - tower.hitbox.height / 2;
      backgroundCtx.fillStyle = "rgba(255, 0, 0, 0.3)";
      backgroundCtx.fillRect(hitboxX, hitboxY, tower.hitbox.width, tower.hitbox.height);

      if (index === 0) {
        backgroundCtx.translate(drawX + width / 2, drawY + height / 2);
        backgroundCtx.scale(-1, 1);
        backgroundCtx.drawImage(towerImage, -width / 2, -height / 2, width, height);
      } else {
        backgroundCtx.drawImage(towerImage, drawX, drawY, width, height);
      }

      const barWidth = 200;
      const barHeight = 10;
      let barX, barY;
      if (index === 0) {
        barX = drawX + (width - barWidth) / 2 - 150;
        barY = drawY - 20;
        if (!hasLoggedRightTower) {
          console.log(`Tháp trái (index ${index}): barX=${barX}, barY=${barY}, width=${barWidth}, height=${barHeight}`);
        }
      } else {
        barX = drawX + (width - barWidth) / 2 - 2634 + camera.x;
        barY = drawY + 195;
        if (!hasLoggedRightTower) {
          console.log(`Tháp phải (index ${index}): barX=${barX}, barY=${barY}, width=${barWidth}, height=${barHeight}`);
          hasLoggedRightTower = true;
        }
      }
      backgroundCtx.fillStyle = "red";
      backgroundCtx.fillRect(barX, barY, barWidth, barHeight);
      backgroundCtx.fillStyle = "green";
      backgroundCtx.fillRect(barX, barY, barWidth * (tower.hp / tower.maxHp), barHeight);
      backgroundCtx.strokeStyle = "black";
      backgroundCtx.strokeRect(barX, barY, barWidth, barHeight);

      backgroundCtx.fillStyle = "white";
      backgroundCtx.font = "12px Arial";
      backgroundCtx.textAlign = "center";
      backgroundCtx.textBaseline = "middle";
      const hpText = `${Math.floor(tower.hp)}/${tower.maxHp}`;
      const hpTextX = barX + barWidth / 2;
      const hpTextY = barY + barHeight / 2;
      if (index === 0) {
        backgroundCtx.save();
        backgroundCtx.translate(hpTextX, hpTextY);
        backgroundCtx.scale(-1, 1);
        backgroundCtx.fillText(hpText, 0, 0);
        backgroundCtx.restore();
      } else {
        backgroundCtx.fillText(hpText, hpTextX, hpTextY);
      }

      backgroundCtx.fillStyle = "red";
      backgroundCtx.font = "16px Arial";
      backgroundCtx.textAlign = "center";
      backgroundCtx.textBaseline = "middle";
      let textX = barX + barWidth / 2;
      const textY = barY + barHeight / 2 - 15;
      if (index === 0) {
        backgroundCtx.save();
        backgroundCtx.translate(textX, textY);
        backgroundCtx.scale(-1, 1);
        backgroundCtx.fillText("Tháp trái", 0, 0);
        backgroundCtx.restore();
      } else {
        backgroundCtx.fillText("Tháp phải", textX, textY);
      }

      backgroundCtx.restore();
    });
  }

  // Vẽ line
  backgroundCtx.beginPath();
  backgroundCtx.moveTo(0, LINE_Y);
  backgroundCtx.lineTo(canvas.width, LINE_Y);
  backgroundCtx.strokeStyle = LINE_COLOR;
  backgroundCtx.lineWidth = LINE_WIDTH;
  backgroundCtx.stroke();

  // const playerUnits = [...surtrs, ...shus, ...chens, ...frostNovas];
  const botUnits = getBotUnits();

  // Cập nhật hiển thị CD và opacity cho mỗi avatar
  const now = Date.now();
  selectedCharacters.forEach(char => {
    const cdDisplay = document.getElementById(`cdDisplay-${char}`);
    const avatarContainer = cdDisplay.parentElement;
    const avatar = avatarContainer.avatar;
    const stats = characterDataObj[char];
    const cdRemaining = lastDeployTime[char] ? Math.max(0, stats.cd - (now - lastDeployTime[char]) / 1000) : 0;
    if (cdRemaining > 0) {
      cdDisplay.textContent = `${cdRemaining.toFixed(1)}s`;
      cdDisplay.style.opacity = '1';
      avatar.style.opacity = '0.5'; // Làm mờ avatar khi đang CD
    } else {
      cdDisplay.textContent = '';
      cdDisplay.style.opacity = '0';
      avatar.style.opacity = '1'; // Khôi phục opacity khi CD hết
    }
  });

  // Render player units chỉ cho selected
  // for (let char of selectedCharacters) {
  //   const module = importedModules[char];
  //   // SỬA: Sử dụng map để lấy tên module sạch (xử lý "Ch'en" -> "Chen")
  //   const moduleName = characterModuleNameMap[char];
  //   if (!moduleName) {
  //     console.error(`Không tìm thấy mapping module cho ${char}`);
  //     continue;
  //   }

  //   const renderFunc = module[`render${moduleName}Skeleton`]; // e.g., renderChenSkeleton
  //   const units = getUnitsArray(char);

  //   units.forEach(unit => {
  //     renderFunc(unit, delta, camera, canvas, groundTileImage, WORLD_WIDTH, GROUND_Y, TOWER_POSITIONS, backgroundCtx, gl, playerUnits, botUnits);

  //     if (!unit.deathAnimationComplete) {
  //       const barWidth = 70;
  //       const barHeight = 8;
  //       const barX = unit.worldX - camera.x - barWidth / 2;
  //       const barY = GROUND_Y + 270;
  //       backgroundCtx.fillStyle = "red";
  //       backgroundCtx.fillRect(barX, barY, barWidth, barHeight);
  //       backgroundCtx.fillStyle = "green";
  //       backgroundCtx.fillRect(barX, barY, barWidth * (unit.hp / unit.maxHp), barHeight);
  //       backgroundCtx.strokeStyle = "black";
  //       backgroundCtx.strokeRect(barX, barY, barWidth, barHeight);

  //       backgroundCtx.fillStyle = "white";
  //       backgroundCtx.font = "10px Arial";
  //       backgroundCtx.textAlign = "center";
  //       backgroundCtx.textBaseline = "middle";
  //       const hpText = `${Math.floor(unit.hp)}/${unit.maxHp}`;
  //       const hpTextX = barX + barWidth / 2;
  //       const hpTextY = barY + barHeight / 2;
  //       backgroundCtx.fillText(hpText, hpTextX, hpTextY);
  //     }
  //   });

  //   // Filter units đã chết
  //   const filtered = units.filter(unit => !unit.deathAnimationComplete);
  //   setUnitsArray(char, filtered);
  // }

  // // Cập nhật UI số lượng unit sau khi filter
  // const updatedPlayerUnits = [...surtrs, ...shus, ...chens, ...frostNovas];
  // document.getElementById('unitDisplay').textContent = `Units: ${updatedPlayerUnits.length}/${MAX_UNITS_PER_SIDE}`;

  playerUnits.forEach(unit => {
    const char = unit.type;
    const module = importedModules[char];
    const moduleName = characterModuleNameMap[char];
    if (!module || !moduleName) {
      console.error(`Không tìm thấy module hoặc mapping cho ${char}`);
      return;
    }
    const renderFunc = module[`render${moduleName}Skeleton`];
    if (renderFunc) {
      renderFunc(unit, delta, camera, canvas, groundTileImage, WORLD_WIDTH, GROUND_Y, TOWER_POSITIONS, backgroundCtx, gl, playerUnits, botUnits);
      if (!unit.deathAnimationComplete) {
        const barWidth = 70;
        const barHeight = 8;
        const barX = unit.worldX - camera.x - barWidth / 2;
        const barY = GROUND_Y + 270;
        backgroundCtx.fillStyle = "red";
        backgroundCtx.fillRect(barX, barY, barWidth, barHeight);
        backgroundCtx.fillStyle = "green";
        backgroundCtx.fillRect(barX, barY, barWidth * (unit.hp / unit.maxHp), barHeight);
        backgroundCtx.strokeStyle = "black";
        backgroundCtx.strokeRect(barX, barY, barWidth, barHeight);

        backgroundCtx.fillStyle = "white";
        backgroundCtx.font = "10px Arial";
        backgroundCtx.textAlign = "center";
        backgroundCtx.textBaseline = "middle";
        const hpText = `${Math.floor(unit.hp)}/${unit.maxHp}`;
        const hpTextX = barX + barWidth / 2;
        const hpTextY = barY + barHeight / 2;
        backgroundCtx.fillText(hpText, hpTextX, hpTextY);
      }
    } else {
      console.error(`Không tìm thấy render function cho ${char}`);
    }
  });

  playerUnits = playerUnits.filter(unit => !unit.deathAnimationComplete);
  document.getElementById('unitDisplay').textContent = `Units: ${playerUnits.length}/${MAX_UNITS_PER_SIDE}`;

  // Update bot units
  updateBotUnits(delta, camera, canvas, groundTileImage, WORLD_WIDTH, GROUND_Y, TOWER_POSITIONS, backgroundCtx, gl, botUnits, playerUnits);

  // Check game over
  if (TOWER_POSITIONS[1].hp <= 0 && !isGameOver) {
    isGameOver = true;
    console.log("Tháp phải đã bị phá hủy! Người chơi thắng!");
    showGameOverMessage("player");
  } else if (TOWER_POSITIONS[0].hp <= 0 && !isGameOver) {
    isGameOver = true;
    console.log("Tháp trái đã bị phá hủy! Bạn thua!");
    showGameOverMessage("bot");
  }

  if (!isGameOver) {
    requestAnimationFrame(render);
  }
}

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = backgroundCanvas.width = w;
    canvas.height = backgroundCanvas.height = h;
  }

  // Gọi resize động cho selectedCharacters
  for (let char of selectedCharacters) {
    const module = importedModules[char];
    if (module) {
      // SỬA: Sử dụng map để lấy tên module sạch (xử lý "Ch'en" -> "Chen")
      const moduleName = characterModuleNameMap[char];
      if (!moduleName) {
        console.warn(`Không tìm thấy ánh xạ mô-đun cho ${char}`);
        continue;
      }
      const resizeFunc = module[`resize${moduleName}`];
      if (resizeFunc) {
        resizeFunc(canvas, camera, gl);
      } else {
        console.warn(`Không tìm thấy resize function cho ${char} (module: ${moduleName})`);
      }
    } else {
      console.warn(`Module cho ${char} chưa được import`);
    }
  }
}

init();