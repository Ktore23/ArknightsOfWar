import { characterDataObj } from '../../../character.js';
import { createDamageText, GROUND_Y } from '../../../render.js';

let shader, batcher, mvp, skeletonRenderer, assetManager;
let debugRenderer, debugShader, shapes;
let swirlEffect = new spine.SwirlEffect(0), jitterEffect = new spine.JitterEffect(20, 40), swirlTime = 0;
let velocity = 50;
let direction = 1;
let currentSkelPath = "assets/enemies/FrostNova/FrostNova2/frstar2.skel";
let currentAtlasPath = "assets/enemies/FrostNova/FrostNova2/frstar2.atlas";
let isSwitchingSkeleton = false;
let hasLoggedFrostNovaPosition = false;
let fixedDamageHitbox = null;

export function initFrostNova(webglContext) {
    if (!webglContext) {
        console.error("WebGL context is not provided");
        return;
    }
    shader = spine.webgl.Shader.newTwoColoredTextured(webglContext);
    batcher = new spine.webgl.PolygonBatcher(webglContext);
    mvp = new spine.webgl.Matrix4();
    skeletonRenderer = new spine.webgl.SkeletonRenderer(webglContext);
    assetManager = new spine.webgl.AssetManager(webglContext);

    debugRenderer = new spine.webgl.SkeletonDebugRenderer(webglContext);
    debugRenderer.drawRegionAttachments = debugRenderer.drawBoundingBoxes = debugRenderer.drawMeshHull = debugRenderer.drawMeshTriangles = debugRenderer.drawPaths = true;
    debugShader = spine.webgl.Shader.newColored(webglContext);
    shapes = new spine.webgl.ShapeRenderer(webglContext);

    assetManager.loadBinary(currentSkelPath);
    assetManager.loadTextureAtlas(currentAtlasPath);
    assetManager.loadTexture("assets/enemies/FrostNova/FrostNova2/frstar2.png");
}

export function isFrostNovaLoadingComplete() {
    return assetManager && assetManager.isLoadingComplete();
}

export function loadFrostNovaSkeleton(initialWorldX = 250, isBot = false, GROUND_Y = 0) {
    if (!assetManager) {
        console.error("assetManager chưa được khởi tạo!");
        return null;
    }

    const atlas = assetManager.get(currentAtlasPath);
    if (!atlas) {
        console.error(`Atlas không tồn tại tại ${currentAtlasPath}`);
        return null;
    }

    const atlasLoader = new spine.AtlasAttachmentLoader(atlas);
    const skeletonBinary = new spine.SkeletonBinary(atlasLoader);
    skeletonBinary.scale = 0.3;
    const skeletonDataRaw = skeletonBinary.readSkeletonData(assetManager.get(currentSkelPath));
    if (!skeletonDataRaw) {
        console.error(`Skeleton data không tải được từ ${currentSkelPath}`);
        return null;
    }

    const skeleton = new spine.Skeleton(skeletonDataRaw);
    skeleton.setSkinByName("default");

    const bounds = calculateSetupPoseBounds(skeleton);
    const animationStateData = new spine.AnimationStateData(skeletonDataRaw);
    const animationState = new spine.AnimationState(animationStateData);
    const initialAnimation = "Move";
    const animationToUse = skeletonDataRaw.animations.find(anim => anim.name.toLowerCase() === initialAnimation.toLowerCase())?.name || skeletonDataRaw.animations[0]?.name;
    if (!animationToUse) {
        console.error(`Initial animation ${initialAnimation} not found in ${currentSkelPath}. Available animations: ${skeletonDataRaw.animations.map(a => a.name).join(", ")}`);
    }
    animationState.setAnimation(0, animationToUse || "Move", true);

    animationState.addListener({
        event: function(trackIndex, event) {
            if (event.data.name === "OnAttack" && frostNovaData.isInAttackState && frostNovaData) {
                let damage = characterDataObj["Frost Nova"].atk;
                if (frostNovaData.target && frostNovaData.isAttackingEnemy) {
                    frostNovaData.target.hp = Math.max(0, frostNovaData.target.hp - damage);
                    createDamageText(frostNovaData.target.worldX, GROUND_Y + 300, damage);
                    // console.log(`Frost Nova tại worldX=${frostNovaData.worldX} gây ${damage} sát thương lên kẻ địch tại worldX=${frostNovaData.target.worldX}. HP kẻ địch còn: ${frostNovaData.target.hp}`);
                } else {
                    const targetTower = frostNovaData.tower;
                    if (targetTower && isCollidingWithTower(frostNovaData, targetTower)) {
                        targetTower.hp = Math.max(0, targetTower.hp - damage);
                        createDamageText(targetTower.x + targetTower.hitbox.width / 2, GROUND_Y + 200, damage);
                        // console.log(`Sự kiện OnAttack: Frost Nova tại worldX=${frostNovaData.worldX} gây ${damage} sát thương lên tháp. HP tháp còn lại: ${targetTower.hp}`);
                    }
                }
            }
        },
        complete: function(trackIndex, count) {
            if (frostNovaData.isDead && frostNovaData.state.getCurrent(0).animation.name.toLowerCase() === "die") {
                frostNovaData.deathAnimationComplete = true; // Đánh dấu animation Die đã hoàn tất
                // console.log(`Animation Die hoàn tất cho Frost Nova tại worldX=${frostNovaData.worldX}`);
            }
        }
    });

    const hitbox = {
        width: isFinite(bounds.size.x) ? bounds.size.x * 0.5 : 100,
        height: isFinite(bounds.size.y) ? bounds.size.y * 1.1 : 200,
        offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 120) ? bounds.offset.x + bounds.size.x / 2 + 5 : 120,
        offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.5 + 120) ? bounds.offset.y + bounds.size.y * 0.5 + 65 : 120
    };

    fixedDamageHitbox = {
        width: 55,
        height: 150,
        offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 220) ? bounds.offset.x + bounds.size.x / 2 + 68 : 220,
        offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.2 + 120) ? bounds.offset.y + bounds.size.y * 0.2 + 105 : 120
    };

    const frostNovaData = { 
        skeleton, 
        state: animationState, 
        bounds, 
        premultipliedAlpha: true, 
        worldX: initialWorldX, 
        hitbox, 
        damageHitbox: fixedDamageHitbox, 
        tower: null, 
        isInAttackState: false,
        currentSkelPath,
        currentAtlasPath,
        direction: isBot ? -1 : 1,
        velocity: 50,
        target: null,
        isAttackingEnemy: false,
        isDead: false, // Thêm trạng thái chết
        deathAnimationTimer: 0, // Timer để theo dõi thời gian animation Die
        deathAnimationComplete: false, // Trạng thái hoàn tất animation Die
        groundY: GROUND_Y,
        blockedFrameCount: 0,  // THÊM: Khởi tạo debounce counter cho blocked
        type: "Frost Nova"
    };
    frostNovaData.skeleton.scaleX = frostNovaData.direction;
    return frostNovaData;
}

function calculateSetupPoseBounds(skeleton) {
    skeleton.setToSetupPose();
    skeleton.updateWorldTransform();
    let offset = new spine.Vector2();
    let size = new spine.Vector2();
    skeleton.getBounds(offset, size, []);
    return { offset: offset, size: size };
}

function isCollidingWithTower(frostNovaData, targetTower) {
    if (!frostNovaData.damageHitbox || !isFinite(frostNovaData.worldX) || !isFinite(frostNovaData.damageHitbox.offsetX)) {
        // console.warn("Invalid damageHitbox or worldX, skipping tower collision check");
        return false;
    }

    const frostNovaHitbox = {
        x: isFinite(frostNovaData.worldX + frostNovaData.hitbox.offsetX * (frostNovaData.skeleton.scaleX || 1) - frostNovaData.hitbox.width / 2) ?
            frostNovaData.worldX + frostNovaData.hitbox.offsetX * (frostNovaData.skeleton.scaleX || 1) - frostNovaData.hitbox.width / 2 :
            frostNovaData.worldX,
        y: frostNovaData.groundY + 220 + frostNovaData.hitbox.offsetY - frostNovaData.hitbox.height / 2,  // Sử dụng groundY (đã set trước)
        width: frostNovaData.hitbox.width,
        height: frostNovaData.hitbox.height
    };

    const frostNovaDamageHitbox = {
        x: frostNovaData.worldX + frostNovaData.damageHitbox.offsetX * frostNovaData.skeleton.scaleX - frostNovaData.damageHitbox.width / 2,  // Sửa: dùng * scaleX - width/2 (đồng nhất với render)
        y: frostNovaData.groundY + 220 + frostNovaData.damageHitbox.offsetY - frostNovaData.damageHitbox.height / 2,
        width: frostNovaData.damageHitbox.width,
        height: frostNovaData.damageHitbox.height
    };

    const towerHitbox = {
        x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
        y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
        width: targetTower.hitbox.width,
        height: targetTower.hitbox.height
    };

    const isColliding = frostNovaDamageHitbox.x < towerHitbox.x + towerHitbox.width &&
                        frostNovaDamageHitbox.x + frostNovaDamageHitbox.width > towerHitbox.x &&
                        frostNovaDamageHitbox.y < towerHitbox.y + towerHitbox.height &&
                        frostNovaDamageHitbox.y + frostNovaDamageHitbox.height > towerHitbox.y;

    if (isColliding) {
        // console.log(`FrostNova tại worldX=${frostNovaData.worldX} va chạm với tháp tại x=${targetTower.x}`);
    }
    return isColliding;
}

export function isCollidingWithEnemy(frostNovaData, enemies) {
    if (!frostNovaData.damageHitbox || !isFinite(frostNovaData.worldX) || !isFinite(frostNovaData.damageHitbox.offsetX)) {
        // console.warn("Invalid damageHitbox or worldX, skipping enemy collision check");
        return { colliding: false, target: null };
    }

    const frostNovaDamageHitbox = {
        x: frostNovaData.worldX + frostNovaData.damageHitbox.offsetX * frostNovaData.skeleton.scaleX - frostNovaData.damageHitbox.width / 2,  // Sửa: dùng * scaleX - width/2 (đồng nhất với render)
        y: frostNovaData.groundY + 220 + frostNovaData.damageHitbox.offsetY - frostNovaData.damageHitbox.height / 2,  // Giữ, nhưng có thể dùng frostNovaData.groundY nếu cần
        width: frostNovaData.damageHitbox.width,
        height: frostNovaData.damageHitbox.height
    };

    let closestEnemy = null;
    let minDistance = Infinity;

    for (let enemy of enemies) {
        if (enemy.hp <= 0 || enemy.isDead || enemy.deathAnimationComplete) continue;

        const enemyHitbox = {
            x: isFinite(enemy.worldX + enemy.hitbox.offsetX * (enemy.skeleton.scaleX || 1) - enemy.hitbox.width / 2) ?
               enemy.worldX + enemy.hitbox.offsetX * (enemy.skeleton.scaleX || 1) - enemy.hitbox.width / 2 :
               enemy.worldX,
            y: enemy.groundY + 220 + enemy.hitbox.offsetY - enemy.hitbox.height / 2,
            width: enemy.hitbox.width,
            height: enemy.hitbox.height
        };

        const isColliding = frostNovaDamageHitbox.x < enemyHitbox.x + enemyHitbox.width &&
                            frostNovaDamageHitbox.x + frostNovaDamageHitbox.width > enemyHitbox.x &&
                            frostNovaDamageHitbox.y < enemyHitbox.y + enemyHitbox.height &&
                            frostNovaDamageHitbox.y + frostNovaDamageHitbox.height > enemyHitbox.y;

        if (isColliding) {
            const distance = Math.abs(frostNovaData.worldX - enemy.worldX);
            if (distance < minDistance) {
                minDistance = distance;
                closestEnemy = enemy;
            }
        }
    }

    return { colliding: !!closestEnemy, target: closestEnemy };
}

export function renderFrostNovaSkeleton(frostNovaData, delta, camera, canvas, groundTileImage, WORLD_WIDTH, GROUND_Y, TOWER_POSITIONS, backgroundCtx, gl, allBotUnits, validUnits) {
    if (!frostNovaData || frostNovaData.deathAnimationComplete) return;

    const { skeleton, state, premultipliedAlpha } = frostNovaData;
    const worldX = frostNovaData.worldX;
    const hitbox = frostNovaData.hitbox;
    const damageHitbox = frostNovaData.damageHitbox;

    // Các hằng số debounce và threshold
    let blockedFrameCount = frostNovaData.blockedFrameCount || 0;
    const DEBOUNCE_THRESHOLD = 2;  // Chỉ chuyển animation sau 2 frames blocked liên tục
    const ADJUST_THRESHOLD = 5;    // Chỉ adjust vị trí nếu khoảng cách > 5 pixels

    // Xác định tower mục tiêu
    const tower = frostNovaData.tower || (frostNovaData.direction === 1 ? TOWER_POSITIONS[1] : TOWER_POSITIONS[0]);
    frostNovaData.tower = tower;

    const towerHitbox = {
        x: tower.x + tower.hitbox.offsetX - tower.hitbox.width / 2,
        y: tower.y + tower.hitbox.offsetY - tower.hitbox.height / 2,
        width: tower.hitbox.width,
        height: tower.hitbox.height
    };

    // Kiểm tra va chạm với tower
    const isColliding = isCollidingWithTower(frostNovaData, tower);

    // Kiểm tra va chạm với enemy
    const { colliding: isCollidingWithEnemyFlag, target: closestEnemy } = isCollidingWithEnemy(frostNovaData, validUnits);
    frostNovaData.target = closestEnemy;
    frostNovaData.isAttackingEnemy = isCollidingWithEnemyFlag;

    // Kiểm tra blocked by front ally (bỏ SAFE_OFFSET để hitbox chạm vừa khít)
    let isBlockedByFrontAlly = false;
    let frontAlly = null;
    for (let ally of allBotUnits) {
        if (ally === frostNovaData || ally.hp <= 0 || ally.isDead || ally.deathAnimationComplete) continue;

        const allyHitbox = {
            x: isFinite(ally.worldX + ally.hitbox.offsetX * (ally.skeleton.scaleX || 1) - ally.hitbox.width / 2) ?
               ally.worldX + ally.hitbox.offsetX * (ally.skeleton.scaleX || 1) - ally.hitbox.width / 2 :
               ally.worldX,
            y: GROUND_Y + 220 + ally.hitbox.offsetY - ally.hitbox.height / 2,
            width: ally.hitbox.width,
            height: ally.hitbox.height
        };

        // Kiểm tra ally ở phía trước đúng hướng
        if ((frostNovaData.direction === 1 && ally.worldX > frostNovaData.worldX) ||
            (frostNovaData.direction === -1 && ally.worldX < frostNovaData.worldX)) {
            
            const thisHitbox = {
                x: isFinite(frostNovaData.worldX + frostNovaData.hitbox.offsetX * (frostNovaData.skeleton.scaleX || 1) - frostNovaData.hitbox.width / 2) ?
                   frostNovaData.worldX + frostNovaData.hitbox.offsetX * (frostNovaData.skeleton.scaleX || 1) - frostNovaData.hitbox.width / 2 :
                   frostNovaData.worldX,
                y: GROUND_Y + 220 + frostNovaData.hitbox.offsetY - frostNovaData.hitbox.height / 2,
                width: frostNovaData.hitbox.width,
                height: frostNovaData.hitbox.height
            };

            // Kiểm tra overlap (bỏ SAFE_OFFSET để chạm vừa khít)
            const overlapX = (frostNovaData.direction === 1) ? 
                             (thisHitbox.x + thisHitbox.width >= allyHitbox.x) :
                             (thisHitbox.x <= allyHitbox.x + allyHitbox.width);
            
            if (overlapX) {
                const frontAnimation = ally.state.getCurrent(0)?.animation?.name.toLowerCase() || "";
                if (frontAnimation === "attack" || frontAnimation === "idle" || ally.isInAttackState) {
                    isBlockedByFrontAlly = true;
                    frontAlly = ally;
                    break;
                }
            }
        }
    }

    // Cập nhật counter debounce
    if (isBlockedByFrontAlly) {
        blockedFrameCount++;
    } else {
        blockedFrameCount = 0;
    }
    frostNovaData.blockedFrameCount = blockedFrameCount;

    // Khai báo isStablyBlocked
    const isStablyBlocked = blockedFrameCount >= DEBOUNCE_THRESHOLD;

    // Xử lý death
    if (frostNovaData.hp <= 0 && !frostNovaData.isDead) {
        frostNovaData.isDead = true;
        frostNovaData.deathAnimationTimer = 0;
        const dieAnimation = state.data.skeletonData.animations.find(anim => anim.name.toLowerCase() === "die")?.name;
        if (dieAnimation) {
            state.setAnimation(0, dieAnimation, false);
            console.log(`Frost Nova tại worldX=${worldX} bắt đầu animation Die`);
        } else {
            console.error("Animation Die not found for Frost Nova");
            frostNovaData.deathAnimationComplete = true;
        }
    }

    if (frostNovaData.isDead) {
        frostNovaData.deathAnimationTimer += delta;
        if (frostNovaData.deathAnimationTimer >= 1.0) {
            frostNovaData.deathAnimationComplete = true;
        }
    } else {
        // Chuyển animation với debounce
        const currentAnimation = state.getCurrent(0)?.animation?.name.toLowerCase() || "";
        if (isCollidingWithEnemyFlag && currentAnimation !== "attack") {
            const attackAnimation = state.data.skeletonData.animations.find(anim => anim.name.toLowerCase() === "attack")?.name;
            if (attackAnimation) {
                state.setAnimation(0, attackAnimation, true);
                frostNovaData.isInAttackState = true;
                // console.log("Frost Nova switched to Attack animation for enemy");
            }
        } else if (isColliding && currentAnimation !== "attack") {
            const attackAnimation = state.data.skeletonData.animations.find(anim => anim.name.toLowerCase() === "attack")?.name;
            if (attackAnimation) {
                state.setAnimation(0, attackAnimation, true);
                frostNovaData.isInAttackState = true;
                console.log("Frost Nova switched to Attack animation for tower");
            }
        } else if (isStablyBlocked && currentAnimation !== "idle") {
            const idleAnimation = state.data.skeletonData.animations.find(anim => anim.name.toLowerCase() === "idle")?.name;
            if (idleAnimation) {
                state.setAnimation(0, idleAnimation, true);
                frostNovaData.isInAttackState = false;
                console.log(`Frost Nova switched to Idle (stable block: ${blockedFrameCount} frames)`);
            }
        } else if (!isCollidingWithEnemyFlag && !isColliding && !isStablyBlocked && currentAnimation !== "move") {
            const moveAnimation = state.data.skeletonData.animations.find(anim => anim.name.toLowerCase() === "move")?.name;
            if (moveAnimation) {
                state.setAnimation(0, moveAnimation, true);
                frostNovaData.isInAttackState = false;
                console.log("Frost Nova switched back to Move (no stable block)");
            }
        }
    }

    state.update(delta);
    state.apply(skeleton);

    // Update vị trí với threshold cho adjust
    if (!isCollidingWithEnemyFlag && !isColliding && !isStablyBlocked && !frostNovaData.isDead) {
        frostNovaData.worldX += frostNovaData.velocity * delta * frostNovaData.direction;
    } else if (isStablyBlocked && !frostNovaData.isDead && frontAlly) {
        const thisHitbox = {
            x: isFinite(frostNovaData.worldX + frostNovaData.hitbox.offsetX * (frostNovaData.skeleton.scaleX || 1) - frostNovaData.hitbox.width / 2) ?
               frostNovaData.worldX + frostNovaData.hitbox.offsetX * (frostNovaData.skeleton.scaleX || 1) - frostNovaData.hitbox.width / 2 :
               frostNovaData.worldX,
            y: GROUND_Y + 220 + frostNovaData.hitbox.offsetY - frostNovaData.hitbox.height / 2,
            width: frostNovaData.hitbox.width,
            height: frostNovaData.hitbox.height
        };

        const otherHitbox = {
            x: frontAlly.worldX + frontAlly.hitbox.offsetX * (frontAlly.skeleton.scaleX || 1) - frontAlly.hitbox.width / 2,
            y: GROUND_Y + 220 + frontAlly.hitbox.offsetY - frontAlly.hitbox.height / 2,
            width: frontAlly.hitbox.width,
            height: frontAlly.hitbox.height
        };
        
        let currentDistance;
        if (frostNovaData.direction === 1) {
            currentDistance = otherHitbox.x - (thisHitbox.x + thisHitbox.width);
        } else {
            currentDistance = (thisHitbox.x - otherHitbox.x - otherHitbox.width);
        }
        
        if (Math.abs(currentDistance) > ADJUST_THRESHOLD) {
            let newWorldX = otherHitbox.x + (frostNovaData.direction === 1 ? -frostNovaData.hitbox.width : otherHitbox.width) 
                            - frostNovaData.hitbox.offsetX * (frostNovaData.skeleton.scaleX || 1) + frostNovaData.hitbox.width / 2;
            frostNovaData.worldX = newWorldX;
            console.log(`Frost Nova adjusted position to ${frostNovaData.worldX} (distance was ${currentDistance}, threshold ${ADJUST_THRESHOLD})`);
        } else {
            // console.log(`Frost Nova already close enough (distance ${currentDistance}), no adjust`);
        }
    }

    skeleton.x = frostNovaData.worldX - camera.x;
    skeleton.y = canvas.height - (GROUND_Y + 425);
    skeleton.scaleX = frostNovaData.direction;

    if (frostNovaData.direction === 1 && frostNovaData.worldX > towerHitbox.x - hitbox.width) {
        frostNovaData.worldX = towerHitbox.x - hitbox.width;
        // console.log(`Frost Nova bị giới hạn tại worldX=${frostNovaData.worldX} để không vượt qua tháp phải`);
    } else if (frostNovaData.direction === -1 && frostNovaData.worldX < towerHitbox.x + towerHitbox.width) {
        frostNovaData.worldX = towerHitbox.x + towerHitbox.width;
        // console.log(`Frost Nova bị giới hạn tại worldX=${frostNovaData.worldX} để không vượt qua tháp trái`);
    }

    skeleton.updateWorldTransform();

    mvp.ortho2d(0, 0, canvas.width, canvas.height);
    shader.bind();
    shader.setUniformi(spine.webgl.Shader.SAMPLER, 0);
    shader.setUniform4x4f(spine.webgl.Shader.MVP_MATRIX, mvp.values);
    batcher.begin(shader);

    skeletonRenderer.premultipliedAlpha = premultipliedAlpha;
    skeletonRenderer.draw(batcher, skeleton);
    batcher.end();
    shader.unbind();

    const frostNovaHitbox = {
        x: isFinite(frostNovaData.worldX + frostNovaData.hitbox.offsetX * (frostNovaData.skeleton.scaleX || 1) - frostNovaData.hitbox.width / 2) ?
           frostNovaData.worldX + frostNovaData.hitbox.offsetX * (frostNovaData.skeleton.scaleX || 1) - frostNovaData.hitbox.width / 2 :
           frostNovaData.worldX,
        y: frostNovaData.groundY + 220 + frostNovaData.hitbox.offsetY - frostNovaData.hitbox.height / 2,
        width: frostNovaData.hitbox.width,
        height: frostNovaData.hitbox.height
    };

    const frostNovaDamageHitbox = {
        x: frostNovaData.worldX + frostNovaData.damageHitbox.offsetX * frostNovaData.skeleton.scaleX - frostNovaData.damageHitbox.width / 2,
        y: frostNovaData.groundY + 220 + frostNovaData.damageHitbox.offsetY - frostNovaData.damageHitbox.height / 2,
        width: frostNovaData.damageHitbox.width,
        height: frostNovaData.damageHitbox.height
    };

    // backgroundCtx.fillStyle = "rgba(255, 0, 0, 0.3)";
    // backgroundCtx.fillRect(
    //     frostNovaHitbox.x - camera.x,
    //     frostNovaHitbox.y,
    //     frostNovaHitbox.width,
    //     frostNovaHitbox.height
    // );

    // if (isFinite(frostNovaDamageHitbox.x) && !frostNovaData.isDead) {
    //     backgroundCtx.fillStyle = "rgba(255, 165, 0, 0.3)";
    //     backgroundCtx.fillRect(
    //         frostNovaDamageHitbox.x - camera.x,
    //         frostNovaDamageHitbox.y,
    //         frostNovaDamageHitbox.width,
    //         frostNovaDamageHitbox.height
    //     );
    // }
}

export function resizeFrostNova(canvas, camera, gl) {
    gl.viewport(0, 0, canvas.width, canvas.height);
}

export function isOverlappingWithOtherFrostNova(newHitbox, existingFrostNovas, GROUND_Y) {
    for (let existing of existingFrostNovas) {
        const existingHitbox = {
            x: isFinite(existing.worldX + existing.hitbox.offsetX * (existing.skeleton.scaleX || 1) - existing.hitbox.width / 2) ?
               existing.worldX + existing.hitbox.offsetX * (existing.skeleton.scaleX || 1) - existing.hitbox.width / 2 :
               existing.worldX,
            y: GROUND_Y + 220 + existing.hitbox.offsetY - existing.hitbox.height / 2,
            width: existing.hitbox.width,
            height: existing.hitbox.height
        };
        if (newHitbox.x < existingHitbox.x + existingHitbox.width &&
            newHitbox.x + newHitbox.width > existingHitbox.x &&
            newHitbox.y < existingHitbox.y + existingHitbox.height &&
            newHitbox.y + newHitbox.height > existingHitbox.y) {
            return true;
        }
    }
    return false;
}