import { characterDataObj } from '/character.js';

let shader, batcher, mvp, skeletonRenderer, assetManager;
let debugRenderer, debugShader, shapes;
let swirlEffect = new spine.SwirlEffect(0), jitterEffect = new spine.JitterEffect(20, 40), swirlTime = 0;
let velocity = 50;
let direction = 1;
let currentSkelPath = "assets/operators/chen/chennian/chen_nian.skel";
let currentAtlasPath = "assets/operators/chen/chennian/chen_nian.atlas";
let isSwitchingSkeleton = false;
let hasLoggedChenPosition = false;
let fixedDamageHitbox = null;

export function initChen(webglContext) {
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

    assetManager.loadBinary("assets/operators/chen/chennian/chen_nian.skel");
    assetManager.loadTextureAtlas("assets/operators/chen/chennian/chen_nian.atlas");
    assetManager.loadTexture("assets/operators/chen/chennian/chen_nian.png");
    assetManager.loadBinary("assets/operators/chen/chennian/chen_nian_weapon.skel");
    assetManager.loadTextureAtlas("assets/operators/chen/chennian/chen_nian_weapon.atlas");
    assetManager.loadTexture("assets/operators/chen/chennian/chen_nian_weapon.png");
}

export function isChenLoadingComplete() {
    return assetManager && assetManager.isLoadingComplete();
}

export function loadChenSkeleton(initialWorldX = 250, GROUND_Y = 0) {
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
            if (event.data.name === "OnAttack" && chenData.isInAttackState && chenData) {
                let damage = characterDataObj["Ch'en"].atk;
                if (chenData.target && chenData.isAttackingEnemy) {
                    chenData.target.hp = Math.max(0, chenData.target.hp - damage);
                    console.log(`Chen tại worldX=${chenData.worldX} gây ${damage} sát thương lên kẻ địch tại worldX=${chenData.target.worldX}. HP kẻ địch còn: ${chenData.target.hp}`);
                } else {
                    const targetTower = chenData.tower;
                    if (targetTower && isCollidingWithTower(chenData, targetTower)) {
                        targetTower.hp = Math.max(0, targetTower.hp - damage);
                        console.log(`Sự kiện OnAttack: Chen tại worldX=${chenData.worldX} gây ${damage} sát thương lên tháp. HP tháp còn lại: ${targetTower.hp}`);
                    }
                }
            }
        },
        complete: function(trackIndex, count) {
            if (chenData.isDead && chenData.state.getCurrent(0).animation.name.toLowerCase() === "die") {
                chenData.deathAnimationComplete = true;
                console.log(`Animation Die hoàn tất cho Chen tại worldX=${chenData.worldX}`);
            }
        }
    });

    const hitbox = {
        width: isFinite(bounds.size.x) ? bounds.size.x * 0.5 : 100,
        height: isFinite(bounds.size.y) ? bounds.size.y * 0.75 : 200,
        offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 120) ? bounds.offset.x + bounds.size.x / 2 - 10 : 120,
        offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.2 + 120) ? bounds.offset.y + bounds.size.y * 0.2 + 110 : 120
    };

    fixedDamageHitbox = {
        width: 100,
        height: 205,
        offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 220) ? bounds.offset.x + bounds.size.x / 2 + 220 : 220,
        offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.2 + 120) ? bounds.offset.y + bounds.size.y * 0.2 + 110 : 120
    };

    const chenData = { 
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
        direction: 1,
        velocity: 50,
        target: null,
        isAttackingEnemy: false,
        isDead: false,
        deathAnimationTimer: 0,
        deathAnimationComplete: false,
        groundY: GROUND_Y
    };
    return chenData;
}

function isCollidingWithTower(chenData, targetTower) {
    if (!chenData.damageHitbox || !isFinite(chenData.worldX) || !isFinite(chenData.damageHitbox.offsetX)) {
        console.warn("Invalid damageHitbox or worldX, skipping tower collision check");
        return false;
    }

    const chenHitbox = {
        x: isFinite(chenData.worldX + chenData.hitbox.offsetX * (chenData.skeleton.scaleX || 1) - chenData.hitbox.width / 2) ?
            chenData.worldX + chenData.hitbox.offsetX * (chenData.skeleton.scaleX || 1) - chenData.hitbox.width / 2 :
            chenData.worldX,
        y: chenData.groundY + 220 + chenData.hitbox.offsetY - chenData.hitbox.height / 2,
        width: chenData.hitbox.width,
        height: chenData.hitbox.height
    };

    const chenDamageHitbox = {
        x: chenData.direction === -1 ?
           chenHitbox.x - (chenData.damageHitbox.width - 50) :
           chenHitbox.x + chenHitbox.width,
        y: chenData.groundY + chenData.damageHitbox.offsetY - chenData.damageHitbox.height / 2 + 258,
        width: chenData.damageHitbox.width - 50,
        height: chenData.damageHitbox.height - 75
    };

    const towerHitbox = {
        x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
        y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
        width: targetTower.hitbox.width,
        height: targetTower.hitbox.height
    };

    const isColliding = isFinite(chenDamageHitbox.x) &&
                        chenDamageHitbox.x < towerHitbox.x + towerHitbox.width &&
                        chenDamageHitbox.x + chenDamageHitbox.width > towerHitbox.x &&
                        chenDamageHitbox.y < towerHitbox.y + towerHitbox.height &&
                        chenDamageHitbox.y + chenDamageHitbox.height > towerHitbox.y;

    if (isColliding) {
        console.log(`Chen tại worldX=${chenData.worldX} va chạm với tháp tại x=${targetTower.x}`);
    }
    return isColliding;
}

export function isCollidingWithEnemy(chenData, enemyChen) {
    if (!chenData.damageHitbox || !enemyChen.hitbox || !isFinite(chenData.worldX) || !isFinite(enemyChen.worldX)) {
        console.warn("Invalid hitbox or worldX, skipping enemy collision check");
        return false;
    }

    const chenHitbox = {
        x: isFinite(chenData.worldX + chenData.hitbox.offsetX * (chenData.skeleton.scaleX || 1) - chenData.hitbox.width / 2) ?
            chenData.worldX + chenData.hitbox.offsetX * (chenData.skeleton.scaleX || 1) - chenData.hitbox.width / 2 :
            chenData.worldX,
        y: chenData.groundY + 220 + chenData.hitbox.offsetY - chenData.hitbox.height / 2,
        width: chenData.hitbox.width,
        height: chenData.hitbox.height
    };

    const chenDamageHitbox = {
        x: chenData.direction === -1 ?
           chenHitbox.x - (chenData.damageHitbox.width - 50) :
           chenHitbox.x + chenHitbox.width,
        y: chenData.groundY + chenData.damageHitbox.offsetY - chenData.damageHitbox.height / 2 + 258,
        width: chenData.damageHitbox.width - 50,
        height: chenData.damageHitbox.height - 75
    };

    const enemyHitbox = {
        x: isFinite(enemyChen.worldX + enemyChen.hitbox.offsetX * (enemyChen.skeleton.scaleX || 1) - enemyChen.hitbox.width / 2) ?
           enemyChen.worldX + enemyChen.hitbox.offsetX * (enemyChen.skeleton.scaleX || 1) - enemyChen.hitbox.width / 2 :
           enemyChen.worldX,
        y: enemyChen.groundY + 220 + enemyChen.hitbox.offsetY - enemyChen.hitbox.height / 2,
        width: enemyChen.hitbox.width,
        height: enemyChen.hitbox.height
    };

    const isColliding = chenDamageHitbox.x < enemyHitbox.x + enemyHitbox.width &&
                        chenDamageHitbox.x + chenDamageHitbox.width > enemyHitbox.x &&
                        chenDamageHitbox.y < enemyHitbox.y + enemyHitbox.height &&
                        chenDamageHitbox.y + chenDamageHitbox.height > enemyHitbox.y;

    if (isColliding) {
        console.log(`Chen tại worldX=${chenData.worldX} va chạm với kẻ địch tại worldX=${enemyChen.worldX}`);
        console.log(`Chen damageHitbox: x=${chenDamageHitbox.x}, width=${chenDamageHitbox.width}, y=${chenDamageHitbox.y}, height=${chenDamageHitbox.height}`);
        console.log(`Enemy hitbox: x=${enemyHitbox.x}, width=${enemyHitbox.width}, y=${enemyHitbox.y}, height=${enemyHitbox.height}`);
    }
    return isColliding;
}

function calculateSetupPoseBounds(skeleton) {
    skeleton.setToSetupPose();
    skeleton.updateWorldTransform();
    const offset = new spine.Vector2(), size = new spine.Vector2();
    skeleton.getBounds(offset, size, []);
    return { offset, size };
}

function switchSkeletonFile(chenData, newSkelPath, newAtlasPath, initialAnimation, callback) {
    if (isSwitchingSkeleton) {
        console.log(`Switching skeleton in progress for ${newSkelPath}, skipping`);
        if (callback) callback(false);
        return false;
    }

    if (chenData.currentSkelPath === newSkelPath && chenData.currentAtlasPath === newAtlasPath) {
        console.log(`Already using skeleton ${newSkelPath}, skipping switch`);
        const animationToUse = chenData.skeleton.data.animations.find(anim => anim.name.toLowerCase() === initialAnimation.toLowerCase())?.name;
        if (animationToUse) {
            chenData.state.setAnimation(0, animationToUse, initialAnimation.toLowerCase() === "die" ? false : true);
            console.log(`Reapplied animation ${animationToUse} for ${newSkelPath}`);
        }
        if (callback) callback(true);
        return true;
    }

    isSwitchingSkeleton = true;
    let skelData = assetManager.get(newSkelPath);
    let atlasData = assetManager.get(newAtlasPath);

    let retryCount = 0;
    const maxRetries = 10;
    function attemptSwitch() {
        if (retryCount >= maxRetries) {
            console.error(`Failed to load assets for ${newSkelPath} after ${maxRetries} retries`);
            isSwitchingSkeleton = false;
            if (callback) callback(false);
            return;
        }

        skelData = assetManager.get(newSkelPath);
        atlasData = assetManager.get(newAtlasPath);
        if (skelData && atlasData && assetManager.isLoadingComplete()) {
            try {
                const atlas = atlasData;
                if (!atlas) {
                    console.error(`Atlas not loaded for ${newAtlasPath}`);
                    isSwitchingSkeleton = false;
                    if (callback) callback(false);
                    return;
                }
                const atlasLoader = new spine.AtlasAttachmentLoader(atlas);
                const skeletonBinary = new spine.SkeletonBinary(atlasLoader);
                skeletonBinary.scale = 0.3;

                const binaryData = skelData;
                if (!binaryData) {
                    console.error(`Skeleton binary not loaded for ${newSkelPath}`);
                    isSwitchingSkeleton = false;
                    if (callback) callback(false);
                    return;
                }
                const newSkeletonData = skeletonBinary.readSkeletonData(binaryData);
                if (!newSkeletonData) {
                    console.error(`Failed to parse skeleton from ${newSkelPath}`);
                    isSwitchingSkeleton = false;
                    if (callback) callback(false);
                    return;
                }

                console.log(`Animations in ${newSkelPath}: ${newSkeletonData.animations.map(a => a.name).join(", ")}`);
                const animationToUse = newSkeletonData.animations.find(anim => anim.name.toLowerCase() === initialAnimation.toLowerCase())?.name;
                if (!animationToUse) {
                    console.error(`Animation ${initialAnimation} not found in ${newSkelPath}. Available animations: ${newSkeletonData.animations.map(a => a.name).join(", ")}`);
                    isSwitchingSkeleton = false;
                    if (callback) callback(false);
                    return;
                }

                const oldSkeleton = chenData.skeleton;
                const oldX = oldSkeleton.x;
                const oldY = oldSkeleton.y;
                const oldScaleX = oldSkeleton.scaleX;
                const oldScaleY = oldSkeleton.scaleY;

                const newSkeleton = new spine.Skeleton(newSkeletonData);
                newSkeleton.setSkinByName("default");
                newSkeleton.x = oldX;
                newSkeleton.y = oldY;
                newSkeleton.scaleX = oldScaleX;
                newSkeleton.scaleY = oldScaleY;
                newSkeleton.setToSetupPose();
                newSkeleton.updateWorldTransform();

                const newAnimationStateData = new spine.AnimationStateData(newSkeletonData);
                const animationState = new spine.AnimationState(newAnimationStateData);
                animationState.setAnimation(0, animationToUse, initialAnimation.toLowerCase() === "die" ? false : true);

                animationState.addListener({
                    event: function(trackIndex, event) {
                        if (event.data.name === "OnAttack" && chenData.isInAttackState && chenData) {
                            let damage = characterDataObj["Ch'en"].atk;
                            if (chenData.target && chenData.isAttackingEnemy) {
                                chenData.target.hp = Math.max(0, chenData.target.hp - damage);
                                console.log(`Chen tại worldX=${chenData.worldX} gây ${damage} sát thương lên kẻ địch tại worldX=${chenData.target.worldX}. HP kẻ địch còn: ${chenData.target.hp}`);
                            } else {
                                const targetTower = chenData.tower;
                                if (targetTower && isCollidingWithTower(chenData, targetTower)) {
                                    targetTower.hp = Math.max(0, targetTower.hp - damage);
                                    console.log(`Sự kiện OnAttack: Chen tại worldX=${chenData.worldX} gây ${damage} sát thương lên tháp. HP tháp còn lại: ${targetTower.hp}`);
                                }
                            }
                        }
                    },
                    complete: function(trackIndex, count) {
                        if (chenData.isDead && animationState.getCurrent(0).animation.name.toLowerCase() === "die") {
                            chenData.deathAnimationComplete = true;
                            console.log(`Animation Die hoàn tất cho Chen tại worldX=${chenData.worldX}`);
                        }
                    }
                });

                const newBounds = calculateSetupPoseBounds(newSkeleton);
                chenData.skeleton = newSkeleton;
                chenData.state = animationState;
                chenData.bounds = newBounds;
                chenData.damageHitbox = fixedDamageHitbox;
                chenData.currentSkelPath = newSkelPath;
                chenData.currentAtlasPath = newAtlasPath;
                isSwitchingSkeleton = false;
                console.log(`Successfully switched to ${newSkelPath} with animation ${animationToUse}`);
                if (callback) callback(true);
            } catch (e) {
                console.error(`Error switching skeleton file: ${e.message}`);
                isSwitchingSkeleton = false;
                if (callback) callback(false);
            }
        } else {
            console.warn(`Assets for ${newSkelPath} not yet loaded, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
            retryCount++;
            requestAnimationFrame(attemptSwitch);
        }
    }

    attemptSwitch();
    return true;
}

export function renderChenSkeleton(chenData, delta, camera, canvas, groundTileImage, WORLD_WIDTH, GROUND_Y, TOWER_POSITIONS, backgroundCtx, gl, allAllies, enemies) {
    if (!chenData) {
        console.error("chenData không tồn tại");
        return;
    }

    const { skeleton, state, premultipliedAlpha, bounds, worldX, hitbox, damageHitbox } = chenData;
    state.update(delta);

    if (chenData.hp <= 0 && !chenData.isDead && !isSwitchingSkeleton) {
        console.log(`Chen tại worldX=${chenData.worldX} đã chết, chuyển sang animation Die`);
        chenData.isDead = true;
        chenData.isInAttackState = false;
        chenData.velocity = 0;
        switchSkeletonFile(
            chenData,
            "assets/operators/chen/chennian/chen_nian_weapon.skel",
            "assets/operators/chen/chennian/chen_nian_weapon.atlas",
            "Die",
            (success) => {
                if (success) {
                    console.log(`Chen tại worldX=${chenData.worldX} chuyển sang animation Die thành công`);
                } else {
                    console.error(`Không thể chuyển sang animation Die cho Chen tại worldX=${chenData.worldX}`);
                    chenData.deathAnimationComplete = true;
                }
            }
        );
    }

    if (chenData.isDead && !chenData.deathAnimationComplete) {
        chenData.deathAnimationTimer += delta;
        if (chenData.deathAnimationTimer >= 1.0) {
            chenData.deathAnimationComplete = true;
            console.log(`Animation Die hoàn tất (theo timer) cho Chen tại worldX=${chenData.worldX}`);
        }
    }

    if (!chenData.deathAnimationComplete) {
        state.apply(skeleton);
        chenData.tower = chenData.direction === 1 ? TOWER_POSITIONS[1] : TOWER_POSITIONS[0];
        chenData.groundY = GROUND_Y;

        const chenHitbox = {
            x: isFinite(worldX + hitbox.offsetX * (skeleton.scaleX || 1) - hitbox.width / 2) ? 
                worldX + hitbox.offsetX * (skeleton.scaleX || 1) - hitbox.width / 2 : worldX,
            y: GROUND_Y + 220 + hitbox.offsetY - hitbox.height / 2,
            width: hitbox.width,
            height: hitbox.height
        };

        const chenDamageHitbox = {
            x: isFinite(worldX) && damageHitbox && isFinite(damageHitbox.offsetX) ? 
               (chenData.direction === -1 ? 
                  chenHitbox.x - (damageHitbox.width - 50) : 
                  chenHitbox.x + chenHitbox.width) : worldX,
            y: damageHitbox ? GROUND_Y + damageHitbox.offsetY - damageHitbox.height / 2 + 258 : GROUND_Y + 258,
            width: damageHitbox ? damageHitbox.width - 50 : 50,
            height: damageHitbox ? damageHitbox.height - 75 : 125
        };

        if (!hasLoggedChenPosition) {
            console.log(`Vị trí Chen: worldX=${worldX}, y=${skeleton.y}, direction=${chenData.direction}`);
            hasLoggedChenPosition = true;
        }

        const validEnemies = Array.isArray(enemies) ? enemies : [];
        
        let closestEnemy = null;
        let minDistance = Infinity;
        validEnemies.forEach(enemy => {
            if (enemy && enemy.hp > 0 && isCollidingWithEnemy(chenData, enemy)) {
                const distance = Math.abs(chenData.worldX - enemy.worldX);
                console.log(`Kẻ địch tại worldX=${enemy.worldX}, HP=${enemy.hp}, khoảng cách=${distance}`);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestEnemy = enemy;
                }
            }
        });

        const isCollidingWithEnemyFlag = !!closestEnemy;
        chenData.target = closestEnemy ? closestEnemy : chenData.tower;
        chenData.isAttackingEnemy = !!closestEnemy;

        const targetTower = chenData.tower;
        const towerHitbox = {
            x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
            y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
            width: targetTower.hitbox.width,
            height: targetTower.hitbox.height
        };

        const isColliding = isCollidingWithTower(chenData, targetTower);

        const isNearTower = isFinite(chenHitbox.x) && 
            chenData.direction === 1 &&
            chenHitbox.x < towerHitbox.x + towerHitbox.width + 200 &&
            chenHitbox.x + chenHitbox.width > towerHitbox.x - 200;

        let isBlockedByFrontAlly = false;
        let frontAlly = null;
        for (let otherAlly of allAllies) {
            if (otherAlly !== chenData && 
                (chenData.direction === 1 ? otherAlly.worldX > chenData.worldX : otherAlly.worldX < chenData.worldX)) {
                const otherHitbox = {
                    x: otherAlly.worldX + otherAlly.hitbox.offsetX * (otherAlly.skeleton.scaleX || 1) - otherAlly.hitbox.width / 2,
                    y: GROUND_Y + 220 + otherAlly.hitbox.offsetY - otherAlly.hitbox.height / 2,
                    width: otherAlly.hitbox.width,
                    height: otherAlly.hitbox.height
                };
                if (chenData.direction === 1 ? 
                    chenHitbox.x + chenHitbox.width >= otherHitbox.x :
                    chenHitbox.x <= otherHitbox.x + otherHitbox.width) {
                    const frontAnimation = otherAlly.state.getCurrent(0)?.animation?.name.toLowerCase() || "";
                    if (frontAnimation === "attack" || frontAnimation === "idle" || otherAlly.isInAttackState) {
                        isBlockedByFrontAlly = true;
                        frontAlly = otherAlly;
                        break;
                    }
                }
            }
        }

        if (!isCollidingWithEnemyFlag && !isColliding && !isNearTower && !isBlockedByFrontAlly && 
            chenData.currentSkelPath === "assets/operators/chen/chennian/chen_nian_weapon.skel" && 
            !chenData.isInAttackState && !isSwitchingSkeleton && !chenData.isDead) {
            console.log(`Chen tại worldX=${chenData.worldX} không còn bị chặn, chuyển từ Idle về Move`);
            switchSkeletonFile(
                chenData,
                "assets/operators/chen/chennian/chen_nian.skel",
                "assets/operators/chen/chennian/chen_nian.atlas",
                "Move",
                (success) => {
                    if (success) {
                        chenData.isInAttackState = false;
                        console.log("Chen switched back to Move animation from Idle");
                    } else {
                        console.error("Failed to switch back to Move skeleton for Chen");
                        state.setAnimation(0, "Move", true);
                    }
                }
            );
        }

        if (isCollidingWithEnemyFlag && !isSwitchingSkeleton && isFinite(chenDamageHitbox.x) && !chenData.isDead) {
            if (!chenData.isInAttackState) {
                console.log(`Chen tại worldX=${chenData.worldX} dừng để tấn công kẻ địch tại worldX=${closestEnemy.worldX}`);
                switchSkeletonFile(
                    chenData,
                    "assets/operators/chen/chennian/chen_nian_weapon.skel",
                    "assets/operators/chen/chennian/chen_nian_weapon.atlas",
                    "Attack",
                    (success) => {
                        if (success) {
                            chenData.isInAttackState = true;
                            console.log("Chen switched to Attack animation for enemy");
                        } else {
                            console.error("Failed to switch to Attack skeleton for Chen");
                            state.setAnimation(0, "Move", true);
                        }
                    }
                );
            }
        } else if (isColliding && !isSwitchingSkeleton && isFinite(chenDamageHitbox.x) && !chenData.isDead) {
            if (!chenData.isInAttackState) {
                console.log("Chen tạm dừng di chuyển do va chạm với tháp");
                switchSkeletonFile(
                    chenData,
                    "assets/operators/chen/chennian/chen_nian_weapon.skel",
                    "assets/operators/chen/chennian/chen_nian_weapon.atlas",
                    "Attack",
                    (success) => {
                        if (success) {
                            chenData.isInAttackState = true;
                            console.log("Chen switched to Attack animation for tower");
                        } else {
                            console.error("Failed to switch to Attack skeleton for Chen");
                            state.setAnimation(0, "Move", true);
                        }
                    }
                );
            }
        } else if (isBlockedByFrontAlly && !isSwitchingSkeleton && !chenData.isDead) {
            if (chenData.currentSkelPath !== "assets/operators/chen/chennian/chen_nian_weapon.skel") {
                console.log(`Chen tại worldX=${chenData.worldX} bị chặn bởi Chen phía trước tại worldX=${frontAlly.worldX}, chuyển sang Idle`);
                switchSkeletonFile(
                    chenData,
                    "assets/operators/chen/chennian/chen_nian_weapon.skel",
                    "assets/operators/chen/chennian/chen_nian_weapon.atlas",
                    "Idle",
                    (success) => {
                        if (success) {
                            chenData.isInAttackState = false;
                            console.log("Chen switched to Idle animation");
                        } else {
                            console.error("Failed to switch to Idle skeleton for Chen");
                            state.setAnimation(0, "Move", true);
                        }
                    }
                );
            }
        } else if (!isCollidingWithEnemyFlag && !isColliding && !isNearTower && !isBlockedByFrontAlly && 
                   chenData.isInAttackState && !isSwitchingSkeleton && !chenData.isDead) {
            console.log(`Chen tại worldX=${chenData.worldX} không còn va chạm, chuyển từ Attack về Move`);
            switchSkeletonFile(
                chenData,
                "assets/operators/chen/chennian/chen_nian.skel",
                "assets/operators/chen/chennian/chen_nian.atlas",
                "Move",
                (success) => {
                    if (success) {
                        chenData.isInAttackState = false;
                        console.log("Chen switched back to Move animation from Attack");
                    } else {
                        console.error("Failed to switch back to Move skeleton for Chen");
                        state.setAnimation(0, "Move", true);
                    }
                }
            );
        }

        if (!isCollidingWithEnemyFlag && !isColliding && !isBlockedByFrontAlly && !isSwitchingSkeleton && !chenData.isDead) {
            chenData.worldX += chenData.velocity * delta * chenData.direction;
        } else if (isBlockedByFrontAlly && !isSwitchingSkeleton && !chenData.isDead) {
            if (chenData.direction === -1) {
                const otherHitbox = {
                    x: frontAlly.worldX + frontAlly.hitbox.offsetX * (frontAlly.skeleton.scaleX || 1) - frontAlly.hitbox.width / 2,
                    y: GROUND_Y + 220 + frontAlly.hitbox.offsetY - frontAlly.hitbox.height / 2,
                    width: frontAlly.hitbox.width,
                    height: frontAlly.hitbox.height
                };
                chenData.worldX = otherHitbox.x + otherHitbox.width + chenData.hitbox.width / 2 - chenData.hitbox.offsetX * (chenData.skeleton.scaleX || 1);
                console.log(`Chen bot tại worldX=${chenData.worldX} được điều chỉnh để kề sát Chen phía trước tại x=${frontAlly.worldX}`);
            }
        }

        skeleton.x = chenData.worldX - camera.x;
        skeleton.y = GROUND_Y + 220;
        skeleton.scaleX = chenData.direction;

        if (chenData.direction === 1 && chenData.worldX > towerHitbox.x - hitbox.width) {
            chenData.worldX = towerHitbox.x - hitbox.width;
            console.log(`Chen bị giới hạn tại worldX=${chenData.worldX} để không vượt qua tháp phải`);
        } else if (chenData.direction === -1 && chenData.worldX < towerHitbox.x + towerHitbox.width) {
            chenData.worldX = towerHitbox.x + towerHitbox.width;
            console.log(`Chen bị giới hạn tại worldX=${chenData.worldX} để không vượt qua tháp trái`);
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

        backgroundCtx.fillStyle = "rgba(255, 0, 0, 0.3)";
        backgroundCtx.fillRect(
            chenHitbox.x - camera.x,
            chenHitbox.y,
            chenHitbox.width,
            chenHitbox.height
        );

        if (isFinite(chenDamageHitbox.x) && !chenData.isDead) {
            backgroundCtx.fillStyle = "rgba(255, 165, 0, 0.3)";
            backgroundCtx.fillRect(
                chenDamageHitbox.x - camera.x,
                chenDamageHitbox.y,
                chenDamageHitbox.width,
                chenDamageHitbox.height
            );
        }
    }
}

export function resizeChen(canvas, camera, gl) {
    gl.viewport(0, 0, canvas.width, canvas.height);
}

export function isOverlappingWithOtherChen(newHitbox, existingChens, GROUND_Y) {
    for (let existing of existingChens) {
        const existingHitbox = {
            x: existing.worldX + existing.hitbox.offsetX - existing.hitbox.width / 2,
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