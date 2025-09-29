import { botSelected, characterModuleNameMap, importedModules } from './render.js';  // Import từ render.js
import { characterDataObj } from './character.js';
import { isOverlappingWithOtherUnit } from './render.js';

let botUnitsByType = {};  // Object động: { "Surtr": [], "Shu": [], ... }
let botInterval;
let botDP = 20; // DP ban đầu cho bot
const MAX_DP = 50; // DP tối đa
const MAX_UNITS_PER_SIDE = 10; // Giới hạn 10 unit mỗi bên
let botLastDeployTime = {}; // Lưu thời gian thả cuối cùng cho mỗi char
const DP_REGEN_RATE = 1; // +1 DP mỗi giây

export function initBot(TOWER_POSITIONS, GROUND_Y, WORLD_WIDTH) {
  botSelected.forEach(char => {
    botUnitsByType[char] = [];
    botLastDeployTime[char] = 0; // Khởi tạo cooldown
  });

  // Regenerate DP cho bot
  setInterval(() => {
    if (botDP < MAX_DP) {
      botDP = Math.min(botDP + DP_REGEN_RATE, MAX_DP);
    }
  }, 1000);

  botInterval = setInterval(() => {
    tryAddBotUnit(TOWER_POSITIONS, GROUND_Y, WORLD_WIDTH);
  }, 8000 + Math.random() * 2000);
}

function tryAddBotUnit(TOWER_POSITIONS, GROUND_Y, WORLD_WIDTH) {
  // Random một char từ botSelected
  const randomIndex = Math.floor(Math.random() * botSelected.length);
  const characterName = botSelected[randomIndex];

  const module = importedModules[characterName];
  if (!module) {
    console.error(`Module cho ${characterName} chưa import cho bot`);
    return;
  }

  // Sử dụng map để lấy tên module sạch (e.g., "Ch'en" -> "Chen")
  const moduleName = characterModuleNameMap[characterName];
  if (!moduleName) {
    console.error(`Không tìm thấy mapping cho ${characterName}`);
    return;
  }

  const loadFunc = (x, isBot) => module[`load${moduleName}Skeleton`](x, isBot, GROUND_Y);  // Thêm isBot nếu cần, tùy module
  const isLoadingComplete = module[`is${moduleName}LoadingComplete`];

  const botArray = botUnitsByType[characterName];
  const allBots = Object.values(botUnitsByType).flat();  // Tất cả bot units để check overlap

  // Kiểm tra giới hạn unit
  if (allBots.length >= MAX_UNITS_PER_SIDE) {
    console.log(`Bot đã đạt giới hạn ${MAX_UNITS_PER_SIDE} unit!`);
    return;
  }

  // Kiểm tra DP
  const stats = characterDataObj[characterName];
  if (botDP < stats.dp) {
    console.log(`Bot không đủ DP để thả ${characterName}! Cần ${stats.dp} DP, hiện có ${botDP} DP.`);
    return;
  }

  // Kiểm tra cooldown
  const now = Date.now();
  if (botLastDeployTime[characterName] && now - botLastDeployTime[characterName] < stats.cd * 1000) {
    console.log(`Cooldown cho ${characterName} của bot chưa hết!`);
    return;
  }

  if (!isLoadingComplete()) {
    console.log(`Assets ${characterName} chưa load xong, thử lại sau...`);
    requestAnimationFrame(() => tryAddBotUnit(TOWER_POSITIONS, GROUND_Y, WORLD_WIDTH));
    return;
  }

  const DEFAULT_BOT_X = WORLD_WIDTH - 250;
  const tempUnit = loadFunc(DEFAULT_BOT_X, true);  // isBot = true
  if (!tempUnit) {
    console.error(`Không thể tải ${characterName} skeleton cho bot`);
    return;
  }
  tempUnit.direction = -1;
  tempUnit.skeleton.scaleX = -1;

  const newHitbox = {
    x: DEFAULT_BOT_X + tempUnit.hitbox.offsetX - tempUnit.hitbox.width / 2,
    y: GROUND_Y + 220 + tempUnit.hitbox.offsetY - tempUnit.hitbox.height / 2,
    width: tempUnit.hitbox.width,
    height: tempUnit.hitbox.height
  };

  let newWorldX = DEFAULT_BOT_X;
  let attempts = 0;
  const maxAttempts = 10;
  while (isOverlappingWithOtherUnit(newHitbox, allBots, GROUND_Y) && attempts < maxAttempts) {
    newWorldX += (newHitbox.width + 50);
    newHitbox.x = newWorldX + tempUnit.hitbox.offsetX - tempUnit.hitbox.width / 2;
    attempts++;
    console.log(`Vị trí bot mặc định chồng chéo, thử offset về x=${newWorldX}, attempt=${attempts}`);
    if (newWorldX > WORLD_WIDTH) {
      console.warn(`Không thể thả bot ${characterName}: không đủ không gian bên phải.`);
      return;
    }
  }

  if (attempts >= maxAttempts) {
    console.warn("Đạt giới hạn số lần thử, không thể thả bot mới.");
    return;
  }

  const newUnit = loadFunc(newWorldX, true);
  if (!newUnit) {
    console.error(`Không thể tạo ${characterName} mới cho bot`);
    return;
  }
  newUnit.direction = -1;
  newUnit.skeleton.scaleX = -1;
  // const stats = characterDataObj[characterName];
  newUnit.hp = stats.hp;
  newUnit.maxHp = stats.hp;
  newUnit.velocity = 50;
  newUnit.tower = TOWER_POSITIONS[0];

  botArray.push(newUnit);
  console.log(`Bot thả ${characterName} tại worldX=${newWorldX}, HP=${newUnit.hp}/${newUnit.maxHp}. Tổng bot: ${allBots.length + 1}`);
}

export function updateBotUnits(delta, camera, canvas, groundTileImage, WORLD_WIDTH, GROUND_Y, TOWER_POSITIONS, backgroundCtx, gl, allBotUnits, validUnits) {
  // Render động cho từng type trong botSelected
  botSelected.forEach(char => {
    const module = importedModules[char];
    if (!module) return;

    const moduleName = characterModuleNameMap[char];
    const renderFunc = module[`render${moduleName}Skeleton`];

    const bots = botUnitsByType[char] || [];
    bots.forEach(bot => {
      renderFunc(bot, delta, camera, canvas, groundTileImage, WORLD_WIDTH, GROUND_Y, TOWER_POSITIONS, backgroundCtx, gl, allBotUnits, validUnits);

      if (!bot.deathAnimationComplete) {
        const barWidth = 70;
        const barHeight = 8;
        const barX = bot.worldX - camera.x - barWidth / 2;
        const barY = GROUND_Y + 270;
        backgroundCtx.fillStyle = "red";
        backgroundCtx.fillRect(barX, barY, barWidth, barHeight);
        backgroundCtx.fillStyle = "green";
        backgroundCtx.fillRect(barX, barY, barWidth * (bot.hp / bot.maxHp), barHeight);
        backgroundCtx.strokeStyle = "black";
        backgroundCtx.strokeRect(barX, barY, barWidth, barHeight);

        backgroundCtx.fillStyle = "white";
        backgroundCtx.font = "10px Arial";
        backgroundCtx.textAlign = "center";
        backgroundCtx.textBaseline = "middle";
        const hpText = `${Math.floor(bot.hp)}/${bot.maxHp}`;
        const hpTextX = barX + barWidth / 2;
        const hpTextY = barY + barHeight / 2;
        backgroundCtx.fillText(hpText, hpTextX, hpTextY);
      }
    });

    // Filter bots đã chết
    botUnitsByType[char] = bots.filter(bot => !bot.deathAnimationComplete);
  });
}

export function getBotUnits() {
  return Object.values(botUnitsByType).flat();
}