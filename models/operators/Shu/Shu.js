import { characterDataObj } from '/character.js';

let shader, batcher, mvp, skeletonRenderer, assetManager;
let debugRenderer, debugShader, shapes;
let swirlEffect = new spine.SwirlEffect(0), jitterEffect = new spine.JitterEffect(20, 40), swirlTime = 0;
let velocity = 50;
let direction = 1;
let currentSkelPath = "assets/operators/shu/shunian/shu_nian.skel";
let currentAtlasPath = "assets/operators/shu/shunian/shu_nian.atlas";
let isSwitchingSkeleton = false;
let hasLoggedShuPosition = false;
let fixedDamageHitbox = null;

export function initShu(webglContext) {
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

    assetManager.loadBinary("assets/operators/shu/shunian/shu_nian.skel");
    assetManager.loadTextureAtlas("assets/operators/shu/shunian/shu_nian.atlas");
    assetManager.loadTexture("assets/operators/shu/shunian/shu_nian.png");
    assetManager.loadBinary("assets/operators/shu/shunian/shu_nian_weapon.skel");
    assetManager.loadTextureAtlas("assets/operators/shu/shunian/shu_nian_weapon.atlas");
    assetManager.loadTexture("assets/operators/shu/shunian/shu_nian_weapon.png");
}

export function isShuLoadingComplete() {
    return assetManager && assetManager.isLoadingComplete();
}

export function loadShuSkeleton(initialWorldX = 250, GROUND_Y = 0) { // Thêm tham số GROUND_Y mặc định
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
            if (event.data.name === "OnAttack" && shuData.isInAttackState && shuData) {
                let damage = characterDataObj["Shu"].atk;
                if (shuData.target && shuData.isAttackingEnemy) {
                    shuData.target.hp = Math.max(0, shuData.target.hp - damage);
                    // console.log(`Shu tại worldX=${shuData.worldX} gây ${damage} sát thương lên kẻ địch tại worldX=${shuData.target.worldX}. HP kẻ địch còn: ${shuData.target.hp}`);
                } else {
                    const targetTower = shuData.tower;
                    if (targetTower && isCollidingWithTower(shuData, targetTower, shuData.groundY)) { // Sử dụng shuData.groundY
                        targetTower.hp = Math.max(0, targetTower.hp - damage);
                        // console.log(`Sự kiện OnAttack: Shu tại worldX=${shuData.worldX} gây ${damage} sát thương lên tháp. HP tháp còn lại: ${targetTower.hp}`);
                    }
                }
            }
        },
        complete: function(trackIndex, count) {
            if (shuData.isDead && shuData.state.getCurrent(0).animation.name.toLowerCase() === "die") {
                shuData.deathAnimationComplete = true;
                // console.log(`Animation Die hoàn tất cho Shu tại worldX=${shuData.worldX}`);
            }
        }
    });

    const hitbox = {
        width: isFinite(bounds.size.x) ? bounds.size.x * 0.5 : 100,
        height: isFinite(bounds.size.y) ? bounds.size.y * 0.67 - 2 : 200,
        offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 50) ? bounds.offset.x + bounds.size.x / 2 - 35 : 50,
        offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.2 + 50) ? bounds.offset.y + bounds.size.y * 0.2 + 100 : 50
    };

    fixedDamageHitbox = {
        width: hitbox.width,
        height: hitbox.height,
        offsetX: hitbox.offsetX,
        offsetY: hitbox.offsetY
    };

    const shuData = { 
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
        groundY: GROUND_Y, // Lưu GROUND_Y vào shuData
        type: "Shu"
    };
    return shuData;
}

function calculateSetupPoseBounds(skeleton) {
    skeleton.setToSetupPose();
    skeleton.updateWorldTransform();
    let offset = new spine.Vector2();
    let size = new spine.Vector2();
    skeleton.getBounds(offset, size, []);
    return { offset: offset, size: size };
}

function switchSkeletonFile(shuData, newSkelPath, newAtlasPath, animationName, callback) {
    if (isSwitchingSkeleton) return;
    isSwitchingSkeleton = true;

    const atlas = assetManager.get(newAtlasPath);
    if (!atlas) {
        console.error(`Atlas không tồn tại tại ${newAtlasPath}`);
        isSwitchingSkeleton = false;
        callback(false);
        return;
    }

    const atlasLoader = new spine.AtlasAttachmentLoader(atlas);
    const skeletonBinary = new spine.SkeletonBinary(atlasLoader);
    skeletonBinary.scale = 0.3;
    const skeletonDataRaw = skeletonBinary.readSkeletonData(assetManager.get(newSkelPath));
    if (!skeletonDataRaw) {
        console.error(`Skeleton data không tải được từ ${newSkelPath}`);
        isSwitchingSkeleton = false;
        callback(false);
        return;
    }

    const newSkeleton = new spine.Skeleton(skeletonDataRaw);
    newSkeleton.setSkinByName("default");
    newSkeleton.x = shuData.skeleton.x;
    newSkeleton.y = shuData.skeleton.y;
    newSkeleton.scaleX = shuData.skeleton.scaleX;
    newSkeleton.scaleY = shuData.skeleton.scaleY;

    const newAnimationStateData = new spine.AnimationStateData(skeletonDataRaw);
    const newState = new spine.AnimationState(newAnimationStateData);
    const animationToUse = skeletonDataRaw.animations.find(anim => anim.name.toLowerCase() === animationName.toLowerCase())?.name || skeletonDataRaw.animations[0]?.name;
    newState.setAnimation(0, animationToUse || animationName, true);

    newState.addListener(shuData.state.listeners[0]);

    shuData.skeleton = newSkeleton;
    shuData.state = newState;
    shuData.currentSkelPath = newSkelPath;
    shuData.currentAtlasPath = newAtlasPath;

    isSwitchingSkeleton = false;
    callback(true);
}

function isCollidingWithTower(shuData, targetTower, GROUND_Y) {
    if (!shuData.damageHitbox || !isFinite(shuData.worldX) || !isFinite(shuData.damageHitbox.offsetX)) {
        console.warn("Invalid damageHitbox or worldX, skipping tower collision check");
        return false;
    }

    const shuHitbox = {
        x: isFinite(shuData.worldX + shuData.hitbox.offsetX * (shuData.skeleton.scaleX || 1) - shuData.hitbox.width / 2) ?
           shuData.worldX + shuData.hitbox.offsetX * (shuData.skeleton.scaleX || 1) - shuData.hitbox.width / 2 :
           shuData.worldX,
        y: shuData.groundY + 220 + shuData.hitbox.offsetY - shuData.hitbox.height / 2, // Sử dụng shuData.groundY
        width: shuData.hitbox.width,
        height: shuData.hitbox.height
    };

    const shuDamageHitbox = {
        x: shuHitbox.x,
        y: shuHitbox.y,
        width: shuHitbox.width,
        height: shuHitbox.height
    };

    const towerHitbox = {
        x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
        y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
        width: targetTower.hitbox.width,
        height: targetTower.hitbox.height
    };

    const isColliding = isFinite(shuDamageHitbox.x) &&
                        shuDamageHitbox.x < towerHitbox.x + towerHitbox.width &&
                        shuDamageHitbox.x + shuDamageHitbox.width > towerHitbox.x &&
                        shuDamageHitbox.y < towerHitbox.y + towerHitbox.height &&
                        shuDamageHitbox.y + shuDamageHitbox.height > towerHitbox.y;

    if (isColliding) {
        // console.log(`Shu tại worldX=${shuData.worldX} va chạm với tháp tại x=${targetTower.x}`);
    }
    return isColliding;
}

export function isCollidingWithEnemy(shuData, enemy) {
    const shuHitbox = {
        x: isFinite(shuData.worldX + shuData.hitbox.offsetX * (shuData.skeleton.scaleX || 1) - shuData.hitbox.width / 2) ?
           shuData.worldX + shuData.hitbox.offsetX * (shuData.skeleton.scaleX || 1) - shuData.hitbox.width / 2 :
           shuData.worldX,
        y: shuData.groundY + 220 + shuData.hitbox.offsetY - shuData.hitbox.height / 2, // Sử dụng shuData.groundY
        width: shuData.hitbox.width,
        height: shuData.hitbox.height
    };

    const shuDamageHitbox = {
        x: shuHitbox.x,
        y: shuHitbox.y,
        width: shuHitbox.width,
        height: shuHitbox.height
    };

    const enemyHitbox = {
        x: isFinite(enemy.worldX + enemy.hitbox.offsetX * (enemy.skeleton.scaleX || 1) - enemy.hitbox.width / 2) ?
           enemy.worldX + enemy.hitbox.offsetX * (enemy.skeleton.scaleX || 1) - enemy.hitbox.width / 2 :
           enemy.worldX,
        y: enemy.groundY + 220 + enemy.hitbox.offsetY - enemy.hitbox.height / 2,
        width: enemy.hitbox.width,
        height: enemy.hitbox.height
    };

    const isColliding = isFinite(shuDamageHitbox.x) &&
                        shuDamageHitbox.x < enemyHitbox.x + enemyHitbox.width &&
                        shuDamageHitbox.x + shuDamageHitbox.width > enemyHitbox.x &&
                        shuDamageHitbox.y < enemyHitbox.y + enemyHitbox.height &&
                        shuDamageHitbox.y + shuDamageHitbox.height > enemyHitbox.y;

    if (isColliding) {
        // console.log(`Shu tại worldX=${shuData.worldX} va chạm với kẻ địch tại worldX=${enemy.worldX}`);
    }
    return isColliding;
}

export function renderShuSkeleton(shuData, delta, camera, canvas, groundTileImage, WORLD_WIDTH, GROUND_Y, TOWER_POSITIONS, backgroundCtx, gl, allAllies, enemies) {
    if (!shuData) {
        console.error("shuData không tồn tại");
        return;
    }

    const { skeleton, state, premultipliedAlpha, bounds, worldX, hitbox, damageHitbox } = shuData;
    state.update(delta);

    if (shuData.hp <= 0 && !shuData.isDead && !isSwitchingSkeleton) {
        // console.log(`Shu tại worldX=${shuData.worldX} đã chết, chuyển sang animation Die`);
        shuData.isDead = true;
        shuData.isInAttackState = false;
        shuData.velocity = 0; // Ngừng di chuyển
        switchSkeletonFile(
            shuData,
            "assets/operators/shu/shunian/shu_nian_weapon.skel",
            "assets/operators/shu/shunian/shu_nian_weapon.atlas",
            "Die",
            (success) => {
                if (success) {
                    // console.log(`Shu tại worldX=${shuData.worldX} chuyển sang animation Die thành công`);
                } else {
                    // console.error(`Không thể chuyển sang animation Die cho Shu tại worldX=${shuData.worldX}`);
                    shuData.deathAnimationComplete = true; // Đánh dấu hoàn tất nếu lỗi
                }
            }
        );
    }

    if (shuData.isDead && !shuData.deathAnimationComplete) {
        shuData.deathAnimationTimer += delta;
        if (shuData.deathAnimationTimer >= 1.0) { // Giả sử animation Die kéo dài 1 giây
            shuData.deathAnimationComplete = true;
            // console.log(`Animation Die hoàn tất (theo timer) cho Shu tại worldX=${shuData.worldX}`);
        }
    }

    if (!shuData.deathAnimationComplete) {
        state.apply(skeleton);
        shuData.tower = shuData.direction === 1 ? TOWER_POSITIONS[1] : TOWER_POSITIONS[0];
        shuData.groundY = GROUND_Y;

        const shuHitbox = {
            x: isFinite(worldX + hitbox.offsetX * (skeleton.scaleX || 1) - hitbox.width / 2) ?
            worldX + hitbox.offsetX * (skeleton.scaleX || 1) - hitbox.width / 2 :
            worldX,
            y: shuData.groundY + 220 + hitbox.offsetY - hitbox.height / 2, // Sử dụng shuData.groundY
            width: hitbox.width,
            height: hitbox.height
        };

        const shuDamageHitbox = {
            x: shuHitbox.x,
            y: shuHitbox.y,
            width: shuHitbox.width,
            height: shuHitbox.height
        };

        const validEnemies = Array.isArray(enemies) ? enemies : [];
        let closestEnemy = null;
        let minDistance = Infinity;
        validEnemies.forEach(enemy => {
            if (enemy && enemy.hp > 0 && isCollidingWithEnemy(shuData, enemy)) { // Sử dụng shuData.groundY
                const distance = Math.abs(shuData.worldX - enemy.worldX);
                // console.log(`Kẻ địch tại worldX=${enemy.worldX}, HP=${enemy.hp}, khoảng cách=${distance}`);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestEnemy = enemy;
                }
            }
        });

        const isCollidingWithEnemyFlag = !!closestEnemy;
        shuData.target = closestEnemy ? closestEnemy : shuData.tower;
        shuData.isAttackingEnemy = !!closestEnemy;

        const targetTower = shuData.tower;
        const towerHitbox = {
            x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
            y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
            width: targetTower.hitbox.width,
            height: targetTower.hitbox.height
        };

        const isColliding = isCollidingWithTower(shuData, targetTower, shuData.groundY); // Sử dụng shuData.groundY

        const isNearTower = isFinite(shuHitbox.x) && 
            shuData.direction === 1 &&
            shuHitbox.x < towerHitbox.x + towerHitbox.width + 200 &&
            shuHitbox.x + shuHitbox.width > towerHitbox.x - 200;

        let isBlockedByFrontAlly = false;
        let frontAlly = null;
        for (let otherAlly of allAllies) {
            if (otherAlly !== shuData && 
                (shuData.direction === 1 ? otherAlly.worldX > shuData.worldX : otherAlly.worldX < shuData.worldX)) {
                const otherHitbox = {
                    x: otherAlly.worldX + otherAlly.hitbox.offsetX * (otherAlly.skeleton.scaleX || 1) - otherAlly.hitbox.width / 2,
                    y: GROUND_Y + 220 + otherAlly.hitbox.offsetY - otherAlly.hitbox.height / 2,
                    width: otherAlly.hitbox.width,
                    height: otherAlly.hitbox.height
                };
                if (shuData.direction === 1 ? 
                    shuHitbox.x + shuHitbox.width >= otherHitbox.x :
                    shuHitbox.x <= otherHitbox.x + otherHitbox.width) {
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

        if (!isCollidingWithEnemyFlag && !isColliding && !isNearTower && !isBlockedByFrontAlly && 
            shuData.currentSkelPath === "assets/operators/shu/shunian/shu_nian_weapon.skel" && 
            !shuData.isInAttackState && !isSwitchingSkeleton && !shuData.isDead) {
            // console.log(`Shu tại worldX=${shuData.worldX} không còn bị chặn, chuyển từ Idle về Move`);
            switchSkeletonFile(
                shuData,
                "assets/operators/shu/shunian/shu_nian.skel",
                "assets/operators/shu/shunian/shu_nian.atlas",
                "Move",
                (success) => {
                    if (success) {
                        shuData.isInAttackState = false;
                        console.log("Shu switched back to Move animation from Idle");
                    } else {
                        console.error("Failed to switch back to Move skeleton for Shu");
                        state.setAnimation(0, "Move", true);
                    }
                }
            );
        }

        if (isCollidingWithEnemyFlag && !isSwitchingSkeleton && isFinite(shuDamageHitbox.x) && !shuData.isDead) {
            if (!shuData.isInAttackState) {
                // console.log(`Shu tại worldX=${shuData.worldX} dừng để tấn công kẻ địch tại worldX=${closestEnemy.worldX}`);
                switchSkeletonFile(
                    shuData,
                    "assets/operators/shu/shunian/shu_nian_weapon.skel",
                    "assets/operators/shu/shunian/shu_nian_weapon.atlas",
                    "Attack",
                    (success) => {
                        if (success) {
                            shuData.isInAttackState = true;
                            console.log("Shu switched to Attack animation for enemy");
                        } else {
                            console.error("Failed to switch to Attack skeleton for Shu");
                            state.setAnimation(0, "Move", true);
                        }
                    }
                );
            }
        } else if (isColliding && !isSwitchingSkeleton && isFinite(shuDamageHitbox.x) && !shuData.isDead) {
            if (!shuData.isInAttackState) {
                // console.log("Shu tạm dừng di chuyển do va chạm với tháp");
                switchSkeletonFile(
                    shuData,
                    "assets/operators/shu/shunian/shu_nian_weapon.skel",
                    "assets/operators/shu/shunian/shu_nian_weapon.atlas",
                    "Attack",
                    (success) => {
                        if (success) {
                            shuData.isInAttackState = true;
                            console.log("Shu switched to Attack animation for tower");
                        } else {
                            console.error("Failed to switch to Attack skeleton for Shu");
                            state.setAnimation(0, "Move", true);
                        }
                    }
                );
            }
        } else if (isBlockedByFrontAlly && !isSwitchingSkeleton && !shuData.isDead) {
            if (shuData.currentSkelPath !== "assets/operators/shu/shunian/shu_nian_weapon.skel") {
                // console.log(`Shu tại worldX=${shuData.worldX} bị chặn bởi Shu phía trước tại worldX=${frontAlly.worldX}, chuyển sang Idle`);
                switchSkeletonFile(
                    shuData,
                    "assets/operators/shu/shunian/shu_nian_weapon.skel",
                    "assets/operators/shu/shunian/shu_nian_weapon.atlas",
                    "Idle",
                    (success) => {
                        if (success) {
                            shuData.isInAttackState = false;
                            console.log("Shu switched to Idle animation");
                        } else {
                            console.error("Failed to switch to Idle skeleton for Shu");
                            state.setAnimation(0, "Move", true);
                        }
                    }
                );
            }
        } else if (!isCollidingWithEnemyFlag && !isColliding && !isNearTower && !isBlockedByFrontAlly && 
                   shuData.isInAttackState && !isSwitchingSkeleton && !shuData.isDead) {
            // console.log(`Shu tại worldX=${shuData.worldX} không còn va chạm, chuyển từ Attack về Move`);
            switchSkeletonFile(
                shuData,
                "assets/operators/shu/shunian/shu_nian.skel",
                "assets/operators/shu/shunian/shu_nian.atlas",
                "Move",
                (success) => {
                    if (success) {
                        shuData.isInAttackState = false;
                        console.log("Shu switched back to Move animation from Attack");
                    } else {
                        console.error("Failed to switch back to Move skeleton for Shu");
                        state.setAnimation(0, "Move", true);
                    }
                }
            );
        }

        if (!isCollidingWithEnemyFlag && !isColliding && !isBlockedByFrontAlly && !isSwitchingSkeleton && !shuData.isDead) {
            shuData.worldX += shuData.velocity * delta * shuData.direction;
        } else if (isBlockedByFrontAlly && !isSwitchingSkeleton && !shuData.isDead) {
            if (shuData.direction === -1) {
                const scaleX = shuData.skeleton.scaleX || 1;  // Lấy scaleX của unit hiện tại
                const otherScaleX = frontAlly.skeleton.scaleX || 1;  // ScaleX của frontAlly (nên giống)
                const otherHitbox = {
                    x: frontAlly.worldX + frontAlly.hitbox.offsetX * otherScaleX - frontAlly.hitbox.width / 2,
                    y: GROUND_Y + 220 + frontAlly.hitbox.offsetY - frontAlly.hitbox.height / 2,
                    width: frontAlly.hitbox.width,
                    height: frontAlly.hitbox.height
                };
                shuData.worldX = otherHitbox.x + (shuData.direction === -1 ? otherHitbox.width : -shuData.hitbox.width) - shuData.hitbox.offsetX * scaleX + shuData.hitbox.width / 2;
                // console.log(`Shu tại worldX=${shuData.worldX} được điều chỉnh để kề sát ally phía trước tại x=${frontAlly.worldX}, direction=${shuData.direction}`);
            }
        }

        skeleton.x = shuData.worldX - camera.x;
        skeleton.y = GROUND_Y + 220;
        skeleton.scaleX = shuData.direction;

        if (shuData.direction === 1 && shuData.worldX > towerHitbox.x - hitbox.width + 100) {
            shuData.worldX = towerHitbox.x - hitbox.width + 100;
            // console.log(`Shu bị giới hạn tại worldX=${shuData.worldX} để không vượt qua tháp phải`);
        } else if (shuData.direction === -1 && shuData.worldX < towerHitbox.x + towerHitbox.width) {
            shuData.worldX = towerHitbox.x + towerHitbox.width;
            // console.log(`Shu bị giới hạn tại worldX=${shuData.worldX} để không vượt qua tháp trái`);
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
            shuHitbox.x - camera.x,
            shuHitbox.y,
            shuHitbox.width,
            shuHitbox.height
        );

        if (isFinite(shuDamageHitbox.x) && !shuData.isDead) {
            backgroundCtx.fillStyle = "rgba(255, 165, 0, 0.3)";
            backgroundCtx.fillRect(
                shuDamageHitbox.x - camera.x,
                shuDamageHitbox.y,
                shuDamageHitbox.width,
                shuDamageHitbox.height
            );
        }
    }
}

export function resizeShu(canvas, camera, gl) {
    gl.viewport(0, 0, canvas.width, canvas.height);
}

export function isOverlappingWithOtherShu(newHitbox, existingShus, GROUND_Y) {
    for (let existing of existingShus) {
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