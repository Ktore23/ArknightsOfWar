import { characterDataObj } from '../../../character.js';
import { createDamageText, GROUND_Y } from '../../../render.js';

let shader, batcher, mvp, skeletonRenderer, assetManager;
let debugRenderer, debugShader, shapes;
let swirlEffect = new spine.SwirlEffect(0), jitterEffect = new spine.JitterEffect(20, 40), swirlTime = 0;
let velocity = 50;
let direction = 1;
let currentSkelPath = "assets/operators/Exusiai/ExusiaiSale/build_char_103_angel_sale8.skel";
let currentAtlasPath = "assets/operators/Exusiai/ExusiaiSale/build_char_103_angel_sale8.atlas";
let isSwitchingSkeleton = false;
let hasLoggedExusiaiPosition = false;
let fixedDamageHitbox = null;

export function initExusiai(webglContext) {
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

    assetManager.loadBinary("assets/operators/Exusiai/ExusiaiSale/build_char_103_angel_sale8.skel");
    assetManager.loadTextureAtlas("assets/operators/Exusiai/ExusiaiSale/build_char_103_angel_sale8.atlas");
    assetManager.loadTexture("assets/operators/Exusiai/ExusiaiSale/build_char_103_angel_sale8.png");
    assetManager.loadBinary("assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.skel");
    assetManager.loadTextureAtlas("assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.atlas");
    assetManager.loadTexture("assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.png");
}

export function isExusiaiLoadingComplete() {
    return assetManager && assetManager.isLoadingComplete();
}

export function loadExusiaiSkeleton(initialWorldX = 250, GROUND_Y = 0) {
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
        // console.error(`Initial animation ${initialAnimation} not found in ${currentSkelPath}. Available animations: ${skeletonDataRaw.animations.map(a => a.name).join(", ")}`);
    }
    animationState.setAnimation(0, animationToUse || "Move", true);

    animationState.addListener({
        event: function (trackIndex, event) {
            if (event.data.name === "OnAttack" && exusiaiData.isInAttackState && exusiaiData) {
                let baseDamage = characterDataObj["Exusiai"].atk;
                let finalDamage;
                if (exusiaiData.target && exusiaiData.isAttackingEnemy) {
                    // Áp dụng công thức: damage = atk - def, tối thiểu 20% atk
                    const targetDef = characterDataObj[exusiaiData.target.type]?.def || 0;
                    finalDamage = Math.round(Math.max(baseDamage * 0.2, baseDamage - targetDef));
                    exusiaiData.target.hp = Math.max(0, exusiaiData.target.hp - finalDamage);
                    createDamageText(exusiaiData.target.worldX, GROUND_Y + 300, finalDamage);
                    // console.log(`Exusiai tại worldX=${exusiaiData.worldX} gây ${finalDamage} sát thương lên kẻ địch tại worldX=${exusiaiData.target.worldX}. HP kẻ địch còn: ${exusiaiData.target.hp}`);
                } else {
                    const targetTower = exusiaiData.tower;
                    if (targetTower && isCollidingWithTower(exusiaiData, targetTower)) {
                        // Áp dụng công thức cho tháp: damage = atk - def, tối thiểu 20% atk
                        let towerDef = targetTower.def || 0;
                        finalDamage = Math.round(Math.max(baseDamage * 0.2, baseDamage - towerDef));
                        targetTower.hp = Math.max(0, targetTower.hp - finalDamage);
                        const towerCenterX = targetTower.x + targetTower.hitbox.offsetX;
                        createDamageText(towerCenterX, GROUND_Y + 200, finalDamage);
                        // console.log(`Sự kiện OnAttack: Exusiai tại worldX=${exusiaiData.worldX} gây ${finalDamage} sát thương lên tháp. HP tháp còn lại: ${targetTower.hp}`);
                    }
                }
            }
        },
        complete: function (trackIndex, count) {
            if (exusiaiData.isDead && exusiaiData.state.getCurrent(0).animation.name.toLowerCase() === "die") {
                exusiaiData.deathAnimationComplete = true; // Đánh dấu animation Die đã hoàn tất
                // console.log(`Animation Die hoàn tất cho Exusiai tại worldX=${exusiaiData.worldX}`);
            }
        }
    });

    const hitbox = {
        width: isFinite(bounds.size.x) ? bounds.size.x * 0.03 : 100,
        height: isFinite(bounds.size.y) ? bounds.size.y * 0.2 : 200,
        offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 120) ? bounds.offset.x + bounds.size.x / 2 - 485 : 120,
        offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.2 + 120) ? bounds.offset.y + bounds.size.y * 0.2 + 525 : 120
    };

    fixedDamageHitbox = {
        width: 300,
        height: 300,
        offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 220) ? bounds.offset.x + bounds.size.x / 2 + 220 : 220,
        offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.2 + 120) ? bounds.offset.y + bounds.size.y * 0.2 + 477 : 120
    };

    const exusiaiData = {
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
        isDead: false, // Thêm trạng thái chết
        deathAnimationTimer: 0, // Timer để theo dõi thời gian animation Die
        deathAnimationComplete: false, // Trạng thái hoàn tất animation Die
        groundY: GROUND_Y,
        type: "Exusiai"
    };
    return exusiaiData;
}

function isCollidingWithTower(exusiaiData, targetTower) {
    if (!exusiaiData.damageHitbox || !isFinite(exusiaiData.worldX) || !isFinite(exusiaiData.damageHitbox.offsetX)) {
        // console.warn("Invalid damageHitbox or worldX, skipping tower collision check");
        return false;
    }

    const exusiaiHitbox = {
        x: isFinite(exusiaiData.worldX + exusiaiData.hitbox.offsetX * (exusiaiData.skeleton.scaleX || 1) - exusiaiData.hitbox.width / 2) ?
            exusiaiData.worldX + exusiaiData.hitbox.offsetX * (exusiaiData.skeleton.scaleX || 1) - exusiaiData.hitbox.width / 2 :
            exusiaiData.worldX,
        y: exusiaiData.groundY + 220 + exusiaiData.hitbox.offsetY - exusiaiData.hitbox.height / 2,
        width: exusiaiData.hitbox.width,
        height: exusiaiData.hitbox.height
    };

    const exusiaiDamageHitbox = {
        x: exusiaiData.direction === -1 ?
            exusiaiHitbox.x - (exusiaiData.damageHitbox.width - 50) :
            exusiaiHitbox.x + exusiaiHitbox.width,
        y: exusiaiData.groundY + exusiaiData.damageHitbox.offsetY - exusiaiData.damageHitbox.height / 2 + 258,
        width: exusiaiData.damageHitbox.width - 50,
        height: exusiaiData.damageHitbox.height - 75
    };

    const towerHitbox = {
        x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
        y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
        width: targetTower.hitbox.width,
        height: targetTower.hitbox.height
    };

    const isColliding = isFinite(exusiaiDamageHitbox.x) &&
        exusiaiDamageHitbox.x < towerHitbox.x + towerHitbox.width &&
        exusiaiDamageHitbox.x + exusiaiDamageHitbox.width > towerHitbox.x &&
        exusiaiDamageHitbox.y < towerHitbox.y + towerHitbox.height &&
        exusiaiDamageHitbox.y + exusiaiDamageHitbox.height > towerHitbox.y;

    if (isColliding) {
        // console.log(`Exusiai tại worldX=${exusiaiData.worldX} va chạm với tháp tại x=${targetTower.x}`);
    }
    return isColliding;
}

export function isCollidingWithEnemy(exusiaiData, enemyExusiai) {
    if (!exusiaiData.damageHitbox || !enemyExusiai.hitbox || !isFinite(exusiaiData.worldX) || !isFinite(enemyExusiai.worldX)) {
        // console.warn("Invalid hitbox or worldX, skipping enemy collision check");
        return false;
    }

    const exusiaiHitbox = {
        x: isFinite(exusiaiData.worldX + exusiaiData.hitbox.offsetX * (exusiaiData.skeleton.scaleX || 1) - exusiaiData.hitbox.width / 2) ?
            exusiaiData.worldX + exusiaiData.hitbox.offsetX * (exusiaiData.skeleton.scaleX || 1) - exusiaiData.hitbox.width / 2 :
            exusiaiData.worldX,
        y: exusiaiData.groundY + 220 + exusiaiData.hitbox.offsetY - exusiaiData.hitbox.height / 2,
        width: exusiaiData.hitbox.width,
        height: exusiaiData.hitbox.height
    };

    const exusiaiDamageHitbox = {
        x: exusiaiData.direction === -1 ?
            exusiaiHitbox.x - (exusiaiData.damageHitbox.width - 50) :
            exusiaiHitbox.x + exusiaiHitbox.width,
        y: exusiaiData.groundY + exusiaiData.damageHitbox.offsetY - exusiaiData.damageHitbox.height / 2 + 258,
        width: exusiaiData.damageHitbox.width - 50,
        height: exusiaiData.damageHitbox.height - 75
    };

    const enemyHitbox = {
        x: isFinite(enemyExusiai.worldX + enemyExusiai.hitbox.offsetX * (enemyExusiai.skeleton.scaleX || 1) - enemyExusiai.hitbox.width / 2) ?
            enemyExusiai.worldX + enemyExusiai.hitbox.offsetX * (enemyExusiai.skeleton.scaleX || 1) - enemyExusiai.hitbox.width / 2 :
            enemyExusiai.worldX,
        y: enemyExusiai.groundY + 220 + enemyExusiai.hitbox.offsetY - enemyExusiai.hitbox.height / 2,
        width: enemyExusiai.hitbox.width,
        height: enemyExusiai.hitbox.height
    };

    const isColliding = exusiaiDamageHitbox.x < enemyHitbox.x + enemyHitbox.width &&
        exusiaiDamageHitbox.x + exusiaiDamageHitbox.width > enemyHitbox.x &&
        exusiaiDamageHitbox.y < enemyHitbox.y + enemyHitbox.height &&
        exusiaiDamageHitbox.y + exusiaiDamageHitbox.height > enemyHitbox.y;

    if (isColliding) {
        // console.log(`Exusiai tại worldX=${exusiaiData.worldX} va chạm với kẻ địch tại worldX=${enemyExusiai.worldX}`);
        // console.log(`Exusiai damageHitbox: x=${exusiaiDamageHitbox.x}, width=${exusiaiDamageHitbox.width}, y=${exusiaiDamageHitbox.y}, height=${exusiaiDamageHitbox.height}`);
        // console.log(`Enemy hitbox: x=${enemyHitbox.x}, width=${enemyHitbox.width}, y=${enemyHitbox.y}, height=${enemyHitbox.height}`);
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

function switchSkeletonFile(exusiaiData, newSkelPath, newAtlasPath, initialAnimation, callback) {
    if (isSwitchingSkeleton) {
        // console.log(`Switching skeleton in progress for ${newSkelPath}, skipping`);
        if (callback) callback(false);
        return false;
    }

    if (exusiaiData.currentSkelPath === newSkelPath && exusiaiData.currentAtlasPath === newAtlasPath) {
        // console.log(`Already using skeleton ${newSkelPath}, skipping switch`);
        const animationToUse = exusiaiData.skeleton.data.animations.find(anim => anim.name.toLowerCase() === initialAnimation.toLowerCase())?.name;
        if (animationToUse) {
            exusiaiData.state.setAnimation(0, animationToUse, initialAnimation.toLowerCase() === "die" ? false : true);
            // console.log(`Reapplied animation ${animationToUse} for ${newSkelPath}`);
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
            // console.error(`Failed to load assets for ${newSkelPath} after ${maxRetries} retries`);
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
                    // console.error(`Atlas not loaded for ${newAtlasPath}`);
                    isSwitchingSkeleton = false;
                    if (callback) callback(false);
                    return;
                }
                const atlasLoader = new spine.AtlasAttachmentLoader(atlas);
                const skeletonBinary = new spine.SkeletonBinary(atlasLoader);
                skeletonBinary.scale = 0.3;

                const binaryData = skelData;
                if (!binaryData) {
                    // console.error(`Skeleton binary not loaded for ${newSkelPath}`);
                    isSwitchingSkeleton = false;
                    if (callback) callback(false);
                    return;
                }
                const newSkeletonData = skeletonBinary.readSkeletonData(binaryData);
                if (!newSkeletonData) {
                    // console.error(`Failed to parse skeleton from ${newSkelPath}`);
                    isSwitchingSkeleton = false;
                    if (callback) callback(false);
                    return;
                }

                // console.log(`Animations in ${newSkelPath}: ${newSkeletonData.animations.map(a => a.name).join(", ")}`);
                const animationToUse = newSkeletonData.animations.find(anim => anim.name.toLowerCase() === initialAnimation.toLowerCase())?.name;
                if (!animationToUse) {
                    console.error(`Animation ${initialAnimation} not found in ${newSkelPath}. Available animations: ${newSkeletonData.animations.map(a => a.name).join(", ")}`);
                    isSwitchingSkeleton = false;
                    if (callback) callback(false);
                    return;
                }

                const oldSkeleton = exusiaiData.skeleton;
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
                    event: function (trackIndex, event) {
                        if (event.data.name === "OnAttack" && exusiaiData.isInAttackState && exusiaiData) {
                            let damage = characterDataObj["Exusiai"].atk;
                            if (exusiaiData.target && exusiaiData.isAttackingEnemy) {
                                exusiaiData.target.hp = Math.max(0, exusiaiData.target.hp - damage);
                                createDamageText(exusiaiData.target.worldX, GROUND_Y + 300, damage);
                                // console.log(`Exusiai tại worldX=${exusiaiData.worldX} gây ${damage} sát thương lên kẻ địch tại worldX=${exusiaiData.target.worldX}. HP kẻ địch còn: ${exusiaiData.target.hp}`);
                            } else {
                                const targetTower = exusiaiData.tower;
                                if (targetTower && isCollidingWithTower(exusiaiData, targetTower)) {
                                    targetTower.hp = Math.max(0, targetTower.hp - damage);
                                    const towerCenterX = targetTower.x + targetTower.hitbox.offsetX;
                                    createDamageText(towerCenterX, GROUND_Y + 200, damage);
                                    // console.log(`Sự kiện OnAttack: Exusiai tại worldX=${exusiaiData.worldX} gây ${damage} sát thương lên tháp. HP tháp còn lại: ${targetTower.hp}`);
                                }
                            }
                        }
                    },
                    complete: function (trackIndex, count) {
                        if (exusiaiData.isDead && animationState.getCurrent(0).animation.name.toLowerCase() === "die") {
                            exusiaiData.deathAnimationComplete = true;
                            // console.log(`Animation Die hoàn tất cho Exusiai tại worldX=${exusiaiData.worldX}`);
                        }
                    }
                });

                const newBounds = calculateSetupPoseBounds(newSkeleton);
                exusiaiData.skeleton = newSkeleton;
                exusiaiData.state = animationState;
                exusiaiData.bounds = newBounds;
                exusiaiData.damageHitbox = fixedDamageHitbox;
                exusiaiData.currentSkelPath = newSkelPath;
                exusiaiData.currentAtlasPath = newAtlasPath;
                isSwitchingSkeleton = false;
                // console.log(`Successfully switched to ${newSkelPath} with animation ${animationToUse}`);
                if (callback) callback(true);
            } catch (e) {
                // console.error(`Error switching skeleton file: ${e.message}`);
                isSwitchingSkeleton = false;
                if (callback) callback(false);
            }
        } else {
            // console.warn(`Assets for ${newSkelPath} not yet loaded, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
            retryCount++;
            requestAnimationFrame(attemptSwitch);
        }
    }

    attemptSwitch();
    return true;
}

export function renderExusiaiSkeleton(exusiaiData, delta, camera, canvas, groundTileImage, WORLD_WIDTH, GROUND_Y, TOWER_POSITIONS, backgroundCtx, gl, allAllies, enemies) {
    if (!exusiaiData) {
        console.error("exusiaiData không tồn tại");
        return;
    }

    const { skeleton, state, premultipliedAlpha, bounds, worldX, hitbox, damageHitbox } = exusiaiData;
    state.update(delta);

    // Kiểm tra trạng thái chết
    if (exusiaiData.hp <= 0 && !exusiaiData.isDead && !isSwitchingSkeleton) {
        // console.log(`Exusiai tại worldX=${exusiaiData.worldX} đã chết, chuyển sang animation Die`);
        exusiaiData.isDead = true;
        exusiaiData.isInAttackState = false;
        exusiaiData.velocity = 0; // Ngừng di chuyển
        switchSkeletonFile(
            exusiaiData,
            "assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.skel",
            "assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.atlas",
            "Die",
            (success) => {
                if (success) {
                    console.log(`Exusiai tại worldX=${exusiaiData.worldX} chuyển sang animation Die thành công`);
                } else {
                    // console.error(`Không thể chuyển sang animation Die cho Exusiai tại worldX=${exusiaiData.worldX}`);
                    exusiaiData.deathAnimationComplete = true; // Đánh dấu hoàn tất để xóa ngay nếu lỗi
                }
            }
        );
    }

    // Cập nhật timer cho animation Die
    if (exusiaiData.isDead && !exusiaiData.deathAnimationComplete) {
        exusiaiData.deathAnimationTimer += delta;
        if (exusiaiData.deathAnimationTimer >= 1.0) { // Giả sử animation Die kéo dài 1 giây
            exusiaiData.deathAnimationComplete = true;
            // console.log(`Animation Die hoàn tất (theo timer) cho Exusiai tại worldX=${exusiaiData.worldX}`);
        }
    }

    // Tiếp tục render nếu chưa hoàn tất animation Die
    if (!exusiaiData.deathAnimationComplete) {
        state.apply(skeleton);
        exusiaiData.tower = exusiaiData.direction === 1 ? TOWER_POSITIONS[1] : TOWER_POSITIONS[0];
        exusiaiData.groundY = GROUND_Y;

        const exusiaiHitbox = {
            x: isFinite(worldX + hitbox.offsetX * (skeleton.scaleX || 1) - hitbox.width / 2) ?
                worldX + hitbox.offsetX * (skeleton.scaleX || 1) - hitbox.width / 2 : worldX,
            y: GROUND_Y + 220 + hitbox.offsetY - hitbox.height / 2,
            width: hitbox.width,
            height: hitbox.height
        };

        const exusiaiDamageHitbox = {
            x: isFinite(worldX) && damageHitbox && isFinite(damageHitbox.offsetX) ?
                (exusiaiData.direction === -1 ?
                    exusiaiHitbox.x - (damageHitbox.width - 50) :
                    exusiaiHitbox.x + exusiaiHitbox.width) : worldX,
            y: damageHitbox ? GROUND_Y + damageHitbox.offsetY - damageHitbox.height / 2 + 258 : GROUND_Y + 258,
            width: damageHitbox ? damageHitbox.width - 50 : 50,
            height: damageHitbox ? damageHitbox.height - 75 : 125
        };

        if (!hasLoggedExusiaiPosition) {
            // console.log(`Vị trí Exusiai: worldX=${worldX}, y=${skeleton.y}, direction=${exusiaiData.direction}`);
            hasLoggedExusiaiPosition = true;
        }

        const validEnemies = Array.isArray(enemies) ? enemies : [];
        // console.log(`Kiểm tra va chạm kẻ địch cho Exusiai tại worldX=${exusiaiData.worldX}, direction=${exusiaiData.direction}, số lượng kẻ địch: ${validEnemies.length}`);

        let closestEnemy = null;
        let minDistance = Infinity;
        validEnemies.forEach(enemy => {
            if (enemy && enemy.hp > 0 && isCollidingWithEnemy(exusiaiData, enemy)) {
                const distance = Math.abs(exusiaiData.worldX - enemy.worldX);
                // console.log(`Kẻ địch tại worldX=${enemy.worldX}, HP=${enemy.hp}, khoảng cách=${distance}`);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestEnemy = enemy;
                }
            }
        });

        const isCollidingWithEnemyFlag = !!closestEnemy;
        exusiaiData.target = closestEnemy ? closestEnemy : exusiaiData.tower;
        exusiaiData.isAttackingEnemy = !!closestEnemy;

        const targetTower = exusiaiData.tower;
        const towerHitbox = {
            x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
            y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
            width: targetTower.hitbox.width,
            height: targetTower.hitbox.height
        };

        const isColliding = isCollidingWithTower(exusiaiData, targetTower);

        let isBlockedByFrontAlly = false;
        let frontAlly = null;
        for (let otherAlly of allAllies) {
            if (otherAlly !== exusiaiData &&
                (exusiaiData.direction === 1 ? otherAlly.worldX > exusiaiData.worldX : otherAlly.worldX < exusiaiData.worldX)) {
                const otherHitbox = {
                    x: otherAlly.worldX + otherAlly.hitbox.offsetX * (otherAlly.skeleton.scaleX || 1) - otherAlly.hitbox.width / 2,
                    y: GROUND_Y + 220 + otherAlly.hitbox.offsetY - otherAlly.hitbox.height / 2,
                    width: otherAlly.hitbox.width,
                    height: otherAlly.hitbox.height
                };
                if (exusiaiData.direction === 1 ?
                    exusiaiHitbox.x + exusiaiHitbox.width >= otherHitbox.x :
                    exusiaiHitbox.x <= otherHitbox.x + otherHitbox.width) {
                    // Thay vì check weapon.skel, check state chung: nếu front đang attack hoặc idle
                    const frontAnimation = otherAlly.state.getCurrent(0)?.animation?.name.toLowerCase() || "";
                    if (frontAnimation === "attack" || frontAnimation === "idle" || otherAlly.isInAttackState) {
                        isBlockedByFrontAlly = true;
                        frontAlly = otherAlly;
                        break;
                    }
                }
            }
        }

        if (!isCollidingWithEnemyFlag && !isColliding && !isBlockedByFrontAlly &&
            exusiaiData.currentSkelPath === "assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.skel" &&
            !exusiaiData.isInAttackState && !isSwitchingSkeleton && !exusiaiData.isDead) {
            // console.log(`Exusiai tại worldX=${exusiaiData.worldX} không còn bị chặn, chuyển từ Idle về Move`);
            switchSkeletonFile(
                exusiaiData,
                "assets/operators/Exusiai/ExusiaiSale/build_char_103_angel_sale8.skel",
                "assets/operators/Exusiai/ExusiaiSale/build_char_103_angel_sale8.atlas",
                "Move",
                (success) => {
                    if (success) {
                        exusiaiData.isInAttackState = false;
                        console.log("Exusiai switched back to Move animation from Idle");
                    } else {
                        console.error("Failed to switch back to Move skeleton for Exusiai");
                        state.setAnimation(0, "Move", true);
                    }
                }
            );
        }

        if (isCollidingWithEnemyFlag && !isSwitchingSkeleton && isFinite(exusiaiDamageHitbox.x) && !exusiaiData.isDead) {
            if (!exusiaiData.isInAttackState) {
                // console.log(`Exusiai tại worldX=${exusiaiData.worldX} dừng để tấn công kẻ địch tại worldX=${closestEnemy.worldX}`);
                switchSkeletonFile(
                    exusiaiData,
                    "assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.skel",
                    "assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.atlas",
                    "Attack",
                    (success) => {
                        if (success) {
                            exusiaiData.isInAttackState = true;
                            console.log("Exusiai switched to Attack animation for enemy");
                        } else {
                            console.error("Failed to switch to Attack skeleton for Exusiai");
                            state.setAnimation(0, "Move", true);
                        }
                    }
                );
            }
        } else if (isColliding && !isSwitchingSkeleton && isFinite(exusiaiDamageHitbox.x) && !exusiaiData.isDead) {
            if (!exusiaiData.isInAttackState) {
                // console.log("Exusiai tạm dừng di chuyển do va chạm với tháp");
                switchSkeletonFile(
                    exusiaiData,
                    "assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.skel",
                    "assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.atlas",
                    "Attack",
                    (success) => {
                        if (success) {
                            exusiaiData.isInAttackState = true;
                            console.log("Exusiai switched to Attack animation for tower");
                        } else {
                            console.error("Failed to switch to Attack skeleton for Exusiai");
                            state.setAnimation(0, "Move", true);
                        }
                    }
                );
            }
        } else if (isBlockedByFrontAlly && !isSwitchingSkeleton && !exusiaiData.isDead) {
            if (exusiaiData.currentSkelPath !== "assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.skel") {
                // console.log(`Exusiai tại worldX=${exusiaiData.worldX} bị chặn bởi Exusiai phía trước tại worldX=${frontAlly.worldX}, chuyển sang Idle`);
                switchSkeletonFile(
                    exusiaiData,
                    "assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.skel",
                    "assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.atlas",
                    "Idle",
                    (success) => {
                        if (success) {
                            exusiaiData.isInAttackState = false;
                            console.log("Exusiai switched to Idle animation");
                        } else {
                            console.error("Failed to switch to Idle skeleton for Exusiai");
                            state.setAnimation(0, "Move", true);
                        }
                    }
                );
            }
        } else if (!isCollidingWithEnemyFlag && !isColliding && !isBlockedByFrontAlly &&
            exusiaiData.isInAttackState && !isSwitchingSkeleton && !exusiaiData.isDead) {
            // console.log(`Exusiai tại worldX=${exusiaiData.worldX} không còn va chạm, chuyển từ Attack về Move`);
            switchSkeletonFile(
                exusiaiData,
                "assets/operators/Exusiai/ExusiaiSale/build_char_103_angel_sale8.skel",
                "assets/operators/Exusiai/ExusiaiSale/build_char_103_angel_sale8.atlas",
                "Move",
                (success) => {
                    if (success) {
                        exusiaiData.isInAttackState = false;
                        console.log("Exusiai switched back to Move animation from Attack");
                    } else {
                        console.error("Failed to switch back to Move skeleton for Exusiai");
                        state.setAnimation(0, "Move", true);
                    }
                }
            );
        }

        if (!isCollidingWithEnemyFlag && !isColliding && !isBlockedByFrontAlly && !isSwitchingSkeleton && !exusiaiData.isDead) {
            exusiaiData.worldX += exusiaiData.velocity * delta * exusiaiData.direction;
        } else if (isBlockedByFrontAlly && !isSwitchingSkeleton && !exusiaiData.isDead) {
            if (exusiaiData.direction === -1) {
                const otherHitbox = {
                    x: frontAlly.worldX + frontAlly.hitbox.offsetX * (frontAlly.skeleton.scaleX || 1) - frontAlly.hitbox.width / 2,
                    y: GROUND_Y + 220 + frontAlly.hitbox.offsetY - frontAlly.hitbox.height / 2,
                    width: frontAlly.hitbox.width,
                    height: frontAlly.hitbox.height
                };
                exusiaiData.worldX = otherHitbox.x + otherHitbox.width + exusiaiData.hitbox.width / 2 - exusiaiData.hitbox.offsetX * (exusiaiData.skeleton.scaleX || 1);
                // console.log(`Exusiai bot tại worldX=${exusiaiData.worldX} được điều chỉnh để kề sát Exusiai phía trước tại x=${frontAlly.worldX}`);
            }
        }

        skeleton.x = exusiaiData.worldX - camera.x;
        skeleton.y = canvas.height - (GROUND_Y + 425);
        skeleton.scaleX = exusiaiData.direction;

        if (exusiaiData.direction === 1 && exusiaiData.worldX > towerHitbox.x - hitbox.width) {
            exusiaiData.worldX = towerHitbox.x - hitbox.width;
            // console.log(`Exusiai bị giới hạn tại worldX=${exusiaiData.worldX} để không vượt qua tháp phải`);
        } else if (exusiaiData.direction === -1 && exusiaiData.worldX < towerHitbox.x + towerHitbox.width) {
            exusiaiData.worldX = towerHitbox.x + towerHitbox.width;
            // console.log(`Exusiai bị giới hạn tại worldX=${exusiaiData.worldX} để không vượt qua tháp trái`);
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

        // backgroundCtx.fillStyle = "rgba(255, 0, 0, 0.3)";
        // backgroundCtx.fillRect(
        //     exusiaiHitbox.x - camera.x,
        //     exusiaiHitbox.y,
        //     exusiaiHitbox.width,
        //     exusiaiHitbox.height
        // );

        // if (isFinite(exusiaiDamageHitbox.x) && !exusiaiData.isDead) {
        //     backgroundCtx.fillStyle = "rgba(255, 165, 0, 0.3)";
        //     backgroundCtx.fillRect(
        //         exusiaiDamageHitbox.x - camera.x,
        //         exusiaiDamageHitbox.y,
        //         exusiaiDamageHitbox.width,
        //         exusiaiDamageHitbox.height
        //     );
        // }
    }
}

export function resizeExusiai(canvas, camera, gl) {
    gl.viewport(0, 0, canvas.width, canvas.height);
}

export function isOverlappingWithOtherExusiai(newHitbox, existingExusiais, GROUND_Y) {
    for (let existing of existingExusiais) {
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