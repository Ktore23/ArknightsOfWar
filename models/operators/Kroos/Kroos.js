import { characterDataObj } from '../../../character.js';

let shader, batcher, mvp, skeletonRenderer, assetManager;
let debugRenderer, debugShader, shapes;
let swirlEffect = new spine.SwirlEffect(0), jitterEffect = new spine.JitterEffect(20, 40), swirlTime = 0;
let velocity = 50;
let direction = 1;
let currentSkelPath = "assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.skel"; // Bắt đầu với file chứa "Start"
let currentAtlasPath = "assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.atlas";
let isSwitchingSkeleton = false;
let hasLoggedKroosPosition = false;
let fixedDamageHitbox = null;

export function initKroos(webglContext) {
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

    assetManager.loadBinary("assets/operators/Kroos/KroosWitch/build_char_124_kroos_witch1.skel");
    assetManager.loadTextureAtlas("assets/operators/Kroos/KroosWitch/build_char_124_kroos_witch1.atlas");
    assetManager.loadTexture("assets/operators/Kroos/KroosWitch/build_char_124_kroos_witch1.png");
    assetManager.loadBinary("assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.skel");
    assetManager.loadTextureAtlas("assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.atlas");
    assetManager.loadTexture("assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.png");
}

export function isKroosLoadingComplete() {
    return assetManager && assetManager.isLoadingComplete();
}

export function loadKroosSkeleton(initialWorldX = 250, GROUND_Y = 0) {
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
    const initialAnimation = "Start";
    const animationToUse = skeletonDataRaw.animations.find(anim => anim.name.toLowerCase() === initialAnimation.toLowerCase())?.name || skeletonDataRaw.animations[0]?.name;
    if (!animationToUse) {
        console.error(`Initial animation ${initialAnimation} not found in ${currentSkelPath}. Available animations: ${skeletonDataRaw.animations.map(a => a.name).join(", ")}`);
    }
    animationState.setAnimation(0, animationToUse || "Idle", false); // Chạy "Start" không lặp, fallback sang "Idle" nếu không có

    const kroosData = {
        skeleton,
        state: animationState,
        bounds,
        premultipliedAlpha: true,
        worldX: initialWorldX,
        hitbox: {
            width: isFinite(bounds.size.x) ? bounds.size.x * 0.2 : 100,
            height: isFinite(bounds.size.y) ? bounds.size.y * 0.9 : 200,
            offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 120) ? bounds.offset.x + bounds.size.x / 2 + 70 : 120,
            offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.2 + 120) ? bounds.offset.y + bounds.size.y * 0.3 + 120 : 120
        },
        damageHitbox: {
            width: 300,
            height: 300,
            offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 220) ? bounds.offset.x + bounds.size.x / 2 + 220 : 220,
            offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.2 + 120) ? bounds.offset.y + bounds.size.y * 0.3 + 82 : 120
        },
        attackCount: 0,
        tower: null,
        isInAttackState: false,
        isInStartAnimation: true, // Theo dõi trạng thái animation Start
        currentSkelPath,
        currentAtlasPath,
        direction: 1,
        velocity: 0, // Tạm dừng di chuyển khi bắt đầu
        target: null,
        isAttackingEnemy: false,
        isDead: false,
        deathAnimationTimer: 0,
        deathAnimationComplete: false,
        groundY: GROUND_Y,
        type: "Kroos"
    };

    animationState.addListener({
        complete: function (trackIndex, count) {
            const currentAnimation = animationState.getCurrent(0)?.animation?.name.toLowerCase();
            if (currentAnimation === "start" && !kroosData.isDead) {
                // console.log(`Animation Start hoàn tất, chuyển sang skeleton build_char_124_kroos_witch1.skel và animation Move cho Kroos tại worldX=${kroosData.worldX}`);
                kroosData.isInStartAnimation = false;
                // Chuyển skeleton sang file chứa "Move"
                switchSkeletonFile(
                    kroosData,
                    "assets/operators/Kroos/KroosWitch/build_char_124_kroos_witch1.skel",
                    "assets/operators/Kroos/KroosWitch/build_char_124_kroos_witch1.atlas",
                    "Move",
                    (success) => {
                        if (success) {
                            kroosData.velocity = 50; // Khôi phục vận tốc
                            console.log("Kroos switched to Move animation");
                        } else {
                            console.error("Failed to switch to Move skeleton for Kroos");
                            kroosData.state.setAnimation(0, "Idle", true); // Fallback sang Idle
                        }
                    }
                );
            }
            if (kroosData.isDead && currentAnimation === "die") {
                kroosData.deathAnimationComplete = true;
                // console.log(`Animation Die hoàn tất cho Kroos tại worldX=${kroosData.worldX}`);
            }
        },
        event: function (trackIndex, event) {
            if (event.data.name === "OnAttack" && kroosData.isInAttackState && kroosData) {
                kroosData.attackCount++;  // Tăng bộ đếm mỗi lần OnAttack
                let damage = characterDataObj["Kroos"].atk;
                if (kroosData.attackCount === 4) {  // Đòn thứ 4: gấp đôi sát thương
                    damage *= 2;
                    kroosData.attackCount = 0;  // Reset bộ đếm
                    // console.log(`Kroos tại worldX=${kroosData.worldX} gây sát thương gấp đôi (${damage}) ở đòn thứ 4!`);
                } else {
                    // console.log(`Kroos tại worldX=${kroosData.worldX} gây sát thương bình thường (${damage}) ở đòn thứ ${kroosData.attackCount}`);
                }
                if (kroosData.target && kroosData.isAttackingEnemy) {
                    kroosData.target.hp = Math.max(0, kroosData.target.hp - damage);
                    // console.log(`Kroos tại worldX=${kroosData.worldX} gây ${damage} sát thương lên kẻ địch tại worldX=${kroosData.target.worldX}. HP kẻ địch còn: ${kroosData.target.hp}`);
                } else {
                    const targetTower = kroosData.tower;
                    if (targetTower && isCollidingWithTower(kroosData, targetTower)) {
                        targetTower.hp = Math.max(0, targetTower.hp - damage);
                        // console.log(`Sự kiện OnAttack: Kroos tại worldX=${kroosData.worldX} gây ${damage} sát thương lên tháp. HP tháp còn lại: ${targetTower.hp}`);
                    }
                }
            }
        }
    });

    fixedDamageHitbox = kroosData.damageHitbox;
    return kroosData;
}

function isCollidingWithTower(kroosData, targetTower) {
    if (!kroosData.damageHitbox || !isFinite(kroosData.worldX) || !isFinite(kroosData.damageHitbox.offsetX)) {
        // console.warn("Invalid damageHitbox or worldX, skipping tower collision check");
        return false;
    }

    const kroosHitbox = {
        x: isFinite(kroosData.worldX + kroosData.hitbox.offsetX * (kroosData.skeleton.scaleX || 1) - kroosData.hitbox.width / 2) ?
            kroosData.worldX + kroosData.hitbox.offsetX * (kroosData.skeleton.scaleX || 1) - kroosData.hitbox.width / 2 :
            kroosData.worldX,
        y: kroosData.groundY + 220 + kroosData.hitbox.offsetY - kroosData.hitbox.height / 2,
        width: kroosData.hitbox.width,
        height: kroosData.hitbox.height
    };

    const kroosDamageHitbox = {
        x: kroosData.direction === -1 ?
            kroosHitbox.x - (kroosData.damageHitbox.width - 50) :
            kroosHitbox.x + kroosHitbox.width,
        y: kroosData.groundY + kroosData.damageHitbox.offsetY - kroosData.damageHitbox.height / 2 + 258,
        width: kroosData.damageHitbox.width - 50,
        height: kroosData.damageHitbox.height - 75
    };

    const towerHitbox = {
        x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
        y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
        width: targetTower.hitbox.width,
        height: targetTower.hitbox.height
    };

    const isColliding = isFinite(kroosDamageHitbox.x) &&
        kroosDamageHitbox.x < towerHitbox.x + towerHitbox.width &&
        kroosDamageHitbox.x + kroosDamageHitbox.width > towerHitbox.x &&
        kroosDamageHitbox.y < towerHitbox.y + towerHitbox.height &&
        kroosDamageHitbox.y + kroosDamageHitbox.height > towerHitbox.y;

    if (isColliding) {
        // console.log(`Kroos tại worldX=${kroosData.worldX} va chạm với tháp tại x=${targetTower.x}`);
    }
    return isColliding;
}

export function isCollidingWithEnemy(kroosData, enemyKroos) {
    if (!kroosData.damageHitbox || !enemyKroos.hitbox || !isFinite(kroosData.worldX) || !isFinite(enemyKroos.worldX)) {
        // console.warn("Invalid hitbox or worldX, skipping enemy collision check");
        return false;
    }

    const kroosHitbox = {
        x: isFinite(kroosData.worldX + kroosData.hitbox.offsetX * (kroosData.skeleton.scaleX || 1) - kroosData.hitbox.width / 2) ?
            kroosData.worldX + kroosData.hitbox.offsetX * (kroosData.skeleton.scaleX || 1) - kroosData.hitbox.width / 2 :
            kroosData.worldX,
        y: kroosData.groundY + 220 + kroosData.hitbox.offsetY - kroosData.hitbox.height / 2,
        width: kroosData.hitbox.width,
        height: kroosData.hitbox.height
    };

    const kroosDamageHitbox = {
        x: kroosData.direction === -1 ?
            kroosHitbox.x - (kroosData.damageHitbox.width - 50) :
            kroosHitbox.x + kroosHitbox.width,
        y: kroosData.groundY + kroosData.damageHitbox.offsetY - kroosData.damageHitbox.height / 2 + 258,
        width: kroosData.damageHitbox.width - 50,
        height: kroosData.damageHitbox.height - 75
    };

    const enemyHitbox = {
        x: isFinite(enemyKroos.worldX + enemyKroos.hitbox.offsetX * (enemyKroos.skeleton.scaleX || 1) - enemyKroos.hitbox.width / 2) ?
            enemyKroos.worldX + enemyKroos.hitbox.offsetX * (enemyKroos.skeleton.scaleX || 1) - enemyKroos.hitbox.width / 2 :
            enemyKroos.worldX,
        y: enemyKroos.groundY + 220 + enemyKroos.hitbox.offsetY - enemyKroos.hitbox.height / 2,
        width: enemyKroos.hitbox.width,
        height: enemyKroos.hitbox.height
    };

    const isColliding = kroosDamageHitbox.x < enemyHitbox.x + enemyHitbox.width &&
        kroosDamageHitbox.x + kroosDamageHitbox.width > enemyHitbox.x &&
        kroosDamageHitbox.y < enemyHitbox.y + enemyHitbox.height &&
        kroosDamageHitbox.y + kroosDamageHitbox.height > enemyHitbox.y;

    if (isColliding) {
        // console.log(`Kroos tại worldX=${kroosData.worldX} va chạm với kẻ địch tại worldX=${enemyKroos.worldX}`);
        // console.log(`Kroos damageHitbox: x=${kroosDamageHitbox.x}, width=${kroosDamageHitbox.width}, y=${kroosDamageHitbox.y}, height=${kroosDamageHitbox.height}`);
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

function switchSkeletonFile(kroosData, newSkelPath, newAtlasPath, initialAnimation, callback) {
    if (isSwitchingSkeleton) {
        // console.log(`Switching skeleton in progress for ${newSkelPath}, skipping`);
        if (callback) callback(false);
        return false;
    }

    if (kroosData.currentSkelPath === newSkelPath && kroosData.currentAtlasPath === newAtlasPath) {
        // console.log(`Already using skeleton ${newSkelPath}, skipping switch`);
        const animationToUse = kroosData.skeleton.data.animations.find(anim => anim.name.toLowerCase() === initialAnimation.toLowerCase())?.name;
        if (animationToUse) {
            kroosData.state.setAnimation(0, animationToUse, initialAnimation.toLowerCase() === "die" ? false : true);
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

                const oldSkeleton = kroosData.skeleton;
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
                        if (event.data.name === "OnAttack" && kroosData.isInAttackState && kroosData) {
                            kroosData.attackCount++;  // Tăng bộ đếm mỗi lần OnAttack
                            let damage = characterDataObj["Kroos"].atk;
                            if (kroosData.attackCount === 4) {  // Đòn thứ 4: gấp đôi sát thương
                                damage *= 2;
                                kroosData.attackCount = 0;  // Reset bộ đếm
                                // console.log(`Kroos tại worldX=${kroosData.worldX} gây sát thương gấp đôi (${damage}) ở đòn thứ 4!`);
                            } else {
                                // console.log(`Kroos tại worldX=${kroosData.worldX} gây sát thương bình thường (${damage}) ở đòn thứ ${kroosData.attackCount}`);
                            }
                            if (kroosData.target && kroosData.isAttackingEnemy) {
                                kroosData.target.hp = Math.max(0, kroosData.target.hp - damage);
                                // console.log(`Kroos tại worldX=${kroosData.worldX} gây ${damage} sát thương lên kẻ địch tại worldX=${kroosData.target.worldX}. HP kẻ địch còn: ${kroosData.target.hp}`);
                            } else {
                                const targetTower = kroosData.tower;
                                if (targetTower && isCollidingWithTower(kroosData, targetTower)) {
                                    targetTower.hp = Math.max(0, targetTower.hp - damage);
                                    // console.log(`Sự kiện OnAttack: Kroos tại worldX=${kroosData.worldX} gây ${damage} sát thương lên tháp. HP tháp còn lại: ${targetTower.hp}`);
                                }
                            }
                        }
                    },
                    complete: function (trackIndex, count) {
                        if (kroosData.isDead && animationState.getCurrent(0).animation.name.toLowerCase() === "die") {
                            kroosData.deathAnimationComplete = true;
                            // console.log(`Animation Die hoàn tất cho Kroos tại worldX=${kroosData.worldX}`);
                        }
                    }
                });

                const newBounds = calculateSetupPoseBounds(newSkeleton);
                kroosData.skeleton = newSkeleton;
                kroosData.state = animationState;
                kroosData.bounds = newBounds;
                kroosData.damageHitbox = fixedDamageHitbox;
                kroosData.currentSkelPath = newSkelPath;
                kroosData.currentAtlasPath = newAtlasPath;
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

export function renderKroosSkeleton(kroosData, delta, camera, canvas, groundTileImage, WORLD_WIDTH, GROUND_Y, TOWER_POSITIONS, backgroundCtx, gl, allAllies, enemies) {
    if (!kroosData) {
        console.error("kroosData không tồn tại");
        return;
    }

    const { skeleton, state, premultipliedAlpha, bounds, worldX, hitbox, damageHitbox } = kroosData;
    state.update(delta);

    // Kiểm tra trạng thái chết
    if (kroosData.hp <= 0 && !kroosData.isDead && !isSwitchingSkeleton) {
        console.log(`Kroos tại worldX=${kroosData.worldX} đã chết, chuyển sang animation Die`);
        kroosData.isDead = true;
        kroosData.isInAttackState = false;
        kroosData.isInStartAnimation = false;
        kroosData.velocity = 0;
        switchSkeletonFile(
            kroosData,
            "assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.skel",
            "assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.atlas",
            "Die",
            (success) => {
                if (success) {
                    console.log(`Kroos tại worldX=${kroosData.worldX} chuyển sang animation Die thành công`);
                } else {
                    console.error(`Không thể chuyển sang animation Die cho Kroos tại worldX=${kroosData.worldX}`);
                    kroosData.deathAnimationComplete = true;
                }
            }
        );
    }

    // Cập nhật timer cho animation Die
    if (kroosData.isDead && !kroosData.deathAnimationComplete) {
        kroosData.deathAnimationTimer += delta;
        if (kroosData.deathAnimationTimer >= 1.0) {
            kroosData.deathAnimationComplete = true;
            console.log(`Animation Die hoàn tất (theo timer) cho Kroos tại worldX=${kroosData.worldX}`);
        }
    }

    // Tiếp tục render nếu chưa hoàn tất animation Die
    if (!kroosData.deathAnimationComplete) {
        state.apply(skeleton);
        kroosData.tower = kroosData.direction === 1 ? TOWER_POSITIONS[1] : TOWER_POSITIONS[0];
        kroosData.groundY = GROUND_Y;

        const kroosHitbox = {
            x: isFinite(worldX + hitbox.offsetX * (skeleton.scaleX || 1) - hitbox.width / 2) ?
                worldX + hitbox.offsetX * (skeleton.scaleX || 1) - hitbox.width / 2 : worldX,
            y: GROUND_Y + 220 + hitbox.offsetY - hitbox.height / 2,
            width: hitbox.width,
            height: hitbox.height
        };

        const kroosDamageHitbox = {
            x: isFinite(worldX) && damageHitbox && isFinite(damageHitbox.offsetX) ?
                (kroosData.direction === -1 ?
                    kroosHitbox.x - (damageHitbox.width - 50) :
                    kroosHitbox.x + kroosHitbox.width) : worldX,
            y: damageHitbox ? GROUND_Y + damageHitbox.offsetY - damageHitbox.height / 2 + 258 : GROUND_Y + 258,
            width: damageHitbox ? damageHitbox.width - 50 : 50,
            height: damageHitbox ? damageHitbox.height - 75 : 125
        };

        if (!hasLoggedKroosPosition) {
            console.log(`Vị trí Kroos: worldX=${worldX}, y=${skeleton.y}, direction=${kroosData.direction}`);
            hasLoggedKroosPosition = true;
        }

        const validEnemies = Array.isArray(enemies) ? enemies : [];
        // console.log(`Kiểm tra va chạm kẻ địch cho Kroos tại worldX=${kroosData.worldX}, direction=${kroosData.direction}, số lượng kẻ địch: ${validEnemies.length}`);

        let closestEnemy = null;
        let minDistance = Infinity;
        validEnemies.forEach(enemy => {
            if (enemy && enemy.hp > 0 && isCollidingWithEnemy(kroosData, enemy)) {
                const distance = Math.abs(kroosData.worldX - enemy.worldX);
                // console.log(`Kẻ địch tại worldX=${enemy.worldX}, HP=${enemy.hp}, khoảng cách=${distance}`);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestEnemy = enemy;
                }
            }
        });

        const isCollidingWithEnemyFlag = !!closestEnemy;
        kroosData.target = closestEnemy ? closestEnemy : kroosData.tower;
        kroosData.isAttackingEnemy = !!closestEnemy;

        const targetTower = kroosData.tower;
        const towerHitbox = {
            x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
            y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
            width: targetTower.hitbox.width,
            height: targetTower.hitbox.height
        };

        const isColliding = isCollidingWithTower(kroosData, targetTower);

        let isBlockedByFrontAlly = false;
        let frontAlly = null;
        for (let otherAlly of allAllies) {
            if (otherAlly !== kroosData &&
                (kroosData.direction === 1 ? otherAlly.worldX > kroosData.worldX : otherAlly.worldX < kroosData.worldX)) {
                const otherHitbox = {
                    x: otherAlly.worldX + otherAlly.hitbox.offsetX * (otherAlly.skeleton.scaleX || 1) - otherAlly.hitbox.width / 2,
                    y: GROUND_Y + 220 + otherAlly.hitbox.offsetY - otherAlly.hitbox.height / 2,
                    width: otherAlly.hitbox.width,
                    height: otherAlly.hitbox.height
                };
                if (kroosData.direction === 1 ?
                    kroosHitbox.x + kroosHitbox.width >= otherHitbox.x :
                    kroosHitbox.x <= otherHitbox.x + otherHitbox.width) {
                    const frontAnimation = otherAlly.state.getCurrent(0)?.animation?.name.toLowerCase() || "";
                    if (frontAnimation === "attack" || frontAnimation === "idle" || otherAlly.isInAttackState) {
                        isBlockedByFrontAlly = true;
                        frontAlly = otherAlly;
                        break;
                    }
                }
            }
        }

        // Chỉ xử lý các trạng thái khác nếu không trong animation Start
        if (!kroosData.isInStartAnimation && !kroosData.isDead && !isSwitchingSkeleton) {
            if (!isCollidingWithEnemyFlag && !isColliding && !isBlockedByFrontAlly &&
                kroosData.currentSkelPath === "assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.skel" &&
                !kroosData.isInAttackState) {
                console.log(`Kroos tại worldX=${kroosData.worldX} không còn bị chặn, chuyển từ Idle về Move`);
                switchSkeletonFile(
                    kroosData,
                    "assets/operators/Kroos/KroosWitch/build_char_124_kroos_witch1.skel",
                    "assets/operators/Kroos/KroosWitch/build_char_124_kroos_witch1.atlas",
                    "Move",
                    (success) => {
                        if (success) {
                            kroosData.isInAttackState = false;
                            console.log("Kroos switched back to Move animation from Idle");
                        } else {
                            console.error("Failed to switch back to Move skeleton for Kroos");
                            state.setAnimation(0, "Idle", true);
                        }
                    }
                );
            }

            if (isCollidingWithEnemyFlag && isFinite(kroosDamageHitbox.x)) {
                if (!kroosData.isInAttackState) {
                    console.log(`Kroos tại worldX=${kroosData.worldX} dừng để tấn công kẻ địch tại worldX=${closestEnemy.worldX}`);
                    switchSkeletonFile(
                        kroosData,
                        "assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.skel",
                        "assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.atlas",
                        "Attack",
                        (success) => {
                            if (success) {
                                kroosData.isInAttackState = true;
                                console.log("Kroos switched to Attack animation for enemy");
                            } else {
                                console.error("Failed to switch to Attack skeleton for Kroos");
                                state.setAnimation(0, "Idle", true);
                            }
                        }
                    );
                }
            } else if (isColliding && isFinite(kroosDamageHitbox.x)) {
                if (!kroosData.isInAttackState) {
                    console.log("Kroos tạm dừng di chuyển do va chạm với tháp");
                    switchSkeletonFile(
                        kroosData,
                        "assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.skel",
                        "assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.atlas",
                        "Attack",
                        (success) => {
                            if (success) {
                                kroosData.isInAttackState = true;
                                console.log("Kroos switched to Attack animation for tower");
                            } else {
                                console.error("Failed to switch to Attack skeleton for Kroos");
                                state.setAnimation(0, "Idle", true);
                            }
                        }
                    );
                }
            } else if (isBlockedByFrontAlly && kroosData.currentSkelPath !== "assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.skel") {
                console.log(`Kroos tại worldX=${kroosData.worldX} bị chặn bởi Kroos phía trước tại worldX=${frontAlly.worldX}, chuyển sang Idle`);
                switchSkeletonFile(
                    kroosData,
                    "assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.skel",
                    "assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.atlas",
                    "Idle",
                    (success) => {
                        if (success) {
                            kroosData.isInAttackState = false;
                            console.log("Kroos switched to Idle animation");
                        } else {
                            console.error("Failed to switch to Idle skeleton for Kroos");
                            state.setAnimation(0, "Idle", true);
                        }
                    }
                );
            } else if (!isCollidingWithEnemyFlag && !isColliding && !isBlockedByFrontAlly && kroosData.isInAttackState) {
                console.log(`Kroos tại worldX=${kroosData.worldX} không còn va chạm, chuyển từ Attack về Move`);
                switchSkeletonFile(
                    kroosData,
                    "assets/operators/Kroos/KroosWitch/build_char_124_kroos_witch1.skel",
                    "assets/operators/Kroos/KroosWitch/build_char_124_kroos_witch1.atlas",
                    "Move",
                    (success) => {
                        if (success) {
                            kroosData.isInAttackState = false;
                            console.log("Kroos switched back to Move animation from Attack");
                        } else {
                            console.error("Failed to switch back to Move skeleton for Kroos");
                            state.setAnimation(0, "Idle", true);
                        }
                    }
                );
            }
        }

        // Chỉ di chuyển nếu không trong animation Start và không bị chặn
        if (!kroosData.isInStartAnimation && !kroosData.isDead && !isSwitchingSkeleton &&
            !isCollidingWithEnemyFlag && !isColliding && !isBlockedByFrontAlly) {
            kroosData.worldX += kroosData.velocity * delta * kroosData.direction;
        } else if (isBlockedByFrontAlly && !kroosData.isDead && !isSwitchingSkeleton) {
            if (kroosData.direction === -1) {
                const otherHitbox = {
                    x: frontAlly.worldX + frontAlly.hitbox.offsetX * (frontAlly.skeleton.scaleX || 1) - frontAlly.hitbox.width / 2,
                    y: GROUND_Y + 220 + frontAlly.hitbox.offsetY - frontAlly.hitbox.height / 2,
                    width: frontAlly.hitbox.width,
                    height: frontAlly.hitbox.height
                };
                kroosData.worldX = otherHitbox.x + otherHitbox.width + kroosData.hitbox.width / 2 - kroosData.hitbox.offsetX * (kroosData.skeleton.scaleX || 1);
                console.log(`Kroos bot tại worldX=${kroosData.worldX} được điều chỉnh để kề sát Kroos phía trước tại x=${frontAlly.worldX}`);
            }
        }

        skeleton.x = kroosData.worldX - camera.x;
        skeleton.y = canvas.height - (GROUND_Y + 425);
        skeleton.scaleX = kroosData.direction;

        if (kroosData.direction === 1 && kroosData.worldX > towerHitbox.x - hitbox.width) {
            kroosData.worldX = towerHitbox.x - hitbox.width;
            console.log(`Kroos bị giới hạn tại worldX=${kroosData.worldX} để không vượt qua tháp phải`);
        } else if (kroosData.direction === -1 && kroosData.worldX < towerHitbox.x + towerHitbox.width) {
            kroosData.worldX = towerHitbox.x + towerHitbox.width;
            console.log(`Kroos bị giới hạn tại worldX=${kroosData.worldX} để không vượt qua tháp trái`);
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
        //     kroosHitbox.x - camera.x,
        //     kroosHitbox.y,
        //     kroosHitbox.width,
        //     kroosHitbox.height
        // );

        // if (isFinite(kroosDamageHitbox.x) && !kroosData.isDead) {
        //     backgroundCtx.fillStyle = "rgba(255, 165, 0, 0.3)";
        //     backgroundCtx.fillRect(
        //         kroosDamageHitbox.x - camera.x,
        //         kroosDamageHitbox.y,
        //         kroosDamageHitbox.width,
        //         kroosDamageHitbox.height
        //     );
        // }
    }
}

export function resizeKroos(canvas, camera, gl) {
    gl.viewport(0, 0, canvas.width, canvas.height);
}

export function isOverlappingWithOtherKroos(newHitbox, existingKroos, GROUND_Y) {
    for (let existing of existingKroos) {
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