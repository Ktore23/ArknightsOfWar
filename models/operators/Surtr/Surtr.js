import { characterDataObj } from '../../../character.js';
import { createDamageText, GROUND_Y } from '../../../render.js';

let shader, batcher, mvp, skeletonRenderer, assetManager;
let debugRenderer, debugShader, shapes;
let swirlEffect = new spine.SwirlEffect(0), jitterEffect = new spine.JitterEffect(20, 40), swirlTime = 0;
let velocity = 50;
let direction = 1;
let currentSkelPath = "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel"; // Khai báo ban đầu là weapon.skel
let currentAtlasPath = "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas"; // Khai báo ban đầu là weapon.atlas
let isSwitchingSkeleton = false;
let hasLoggedSurtrPosition = false;
let fixedDamageHitbox = null;

export function initSurtr(webglContext) {
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

    assetManager.loadBinary("assets/operators/Surtr/SurtrSummer/surtr_summer.skel");
    assetManager.loadTextureAtlas("assets/operators/Surtr/SurtrSummer/surtr_summer.atlas");
    assetManager.loadTexture("assets/operators/Surtr/SurtrSummer/surtr_summer.png");
    assetManager.loadBinary("assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel");
    assetManager.loadTextureAtlas("assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas");
    assetManager.loadTexture("assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.png");
}

export function isSurtrLoadingComplete() {
    return assetManager && assetManager.isLoadingComplete();
}

export function loadSurtrSkeleton(initialWorldX = 250, GROUND_Y = 0) {
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
    const skeletonDataRaw = skeletonBinary.readSkeletonData(assetManager.get("assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel")); // Sử dụng weapon.skel để có animation Start
    if (!skeletonDataRaw) {
        console.error(`Skeleton data không tải được từ surtr_summer_weapon.skel`);
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
        console.error(`Initial animation ${initialAnimation} not found in surtr_summer_weapon.skel. Available animations: ${skeletonDataRaw.animations.map(a => a.name).join(", ")}`);
    }
    animationState.setAnimation(0, animationToUse || "Move", false); // Non-looping cho Start

    animationState.addListener({
        event: function (trackIndex, event) {
            if (event.data.name === "OnAttack" && surtrData.isInAttackState && surtrData) {
                let atk = characterDataObj["Surtr"].atk;
                let damage;
                if (surtrData.target && surtrData.isAttackingEnemy) {
                    const targetRes = characterDataObj[surtrData.target.type]?.res || 0;
                    damage = Math.round(Math.max(0, atk * (1 - (targetRes / 100))));
                    surtrData.target.hp = Math.max(0, surtrData.target.hp - damage);
                    createDamageText(surtrData.target.worldX, GROUND_Y + 300, damage, 'purple');
                } else {
                    const targetTower = surtrData.tower;
                    if (targetTower && isCollidingWithTower(surtrData, targetTower)) {
                        const towerRes = targetTower.res || 0;
                        damage = Math.round(Math.max(0, atk * (1 - (towerRes / 100))));
                        targetTower.hp = Math.max(0, targetTower.hp - damage);
                        const towerCenterX = targetTower.x + targetTower.hitbox.offsetX;
                        createDamageText(towerCenterX, GROUND_Y + 200, damage, 'purple');
                    }
                }
            }
        },
        complete: function (trackIndex, count) {
            const currentAnimation = animationState.getCurrent(0)?.animation?.name.toLowerCase();
            if (currentAnimation === "start" && !surtrData.isDead) {
                surtrData.isInStartAnimation = false;
                switchSkeletonFile(
                    surtrData,
                    "assets/operators/Surtr/SurtrSummer/surtr_summer.skel",
                    "assets/operators/Surtr/SurtrSummer/surtr_summer.atlas",
                    "Move",
                    (success) => {
                        if (success) {
                            surtrData.velocity = 50;
                            console.log("Surtr switched to Move animation from Start");
                        } else {
                            console.error("Failed to switch to Move skeleton for Surtr");
                            surtrData.state.setAnimation(0, "Move", true);
                        }
                    }
                );
            }
            if (surtrData.isDead && currentAnimation === "die") {
                surtrData.deathAnimationComplete = true;
            }
        }
    });

    const hitbox = {
        width: isFinite(bounds.size.x) ? bounds.size.x * 0.17 : 100,
        height: isFinite(bounds.size.y) ? bounds.size.y * 0.6 : 200,
        offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 120) ? bounds.offset.x + bounds.size.x / 2 + 95 : 120,
        offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.2 + 120) ? bounds.offset.y + bounds.size.y * 0.2 + 145 : 120
    };

    fixedDamageHitbox = {
        width: 100,
        height: 200,
        offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 220) ? bounds.offset.x + bounds.size.x / 2 + 220 : 220,
        offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.2 + 120) ? bounds.offset.y + bounds.size.y * 0.2 + 145 : 120
    };

    const surtrData = {
        skeleton,
        state: animationState,
        bounds,
        premultipliedAlpha: true,
        worldX: initialWorldX,
        hitbox,
        damageHitbox: fixedDamageHitbox,
        tower: null,
        isInAttackState: false,
        isInStartAnimation: true, // Thêm trạng thái Start
        currentSkelPath: "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel", // Khởi tạo với weapon.skel
        currentAtlasPath: "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas",
        direction: 1,
        velocity: 0, // Không di chuyển khi đang ở animation Start
        target: null,
        isAttackingEnemy: false,
        isDead: false,
        deathAnimationTimer: 0,
        deathAnimationComplete: false,
        groundY: GROUND_Y,
        type: "Surtr"
    };
    return surtrData;
}

function isCollidingWithTower(surtrData, targetTower) {
    if (!surtrData.damageHitbox || !isFinite(surtrData.worldX) || !isFinite(surtrData.damageHitbox.offsetX)) {
        return false;
    }

    const surtrHitbox = {
        x: isFinite(surtrData.worldX + surtrData.hitbox.offsetX * (surtrData.skeleton.scaleX || 1) - surtrData.hitbox.width / 2) ?
            surtrData.worldX + surtrData.hitbox.offsetX * (surtrData.skeleton.scaleX || 1) - surtrData.hitbox.width / 2 :
            surtrData.worldX,
        y: surtrData.groundY + 220 + surtrData.hitbox.offsetY - surtrData.hitbox.height / 2,
        width: surtrData.hitbox.width,
        height: surtrData.hitbox.height
    };

    const surtrDamageHitbox = {
        x: surtrData.direction === -1 ?
            surtrHitbox.x - (surtrData.damageHitbox.width - 50) :
            surtrHitbox.x + surtrHitbox.width,
        y: surtrData.groundY + surtrData.damageHitbox.offsetY - surtrData.damageHitbox.height / 2 + 258,
        width: surtrData.damageHitbox.width - 50,
        height: surtrData.damageHitbox.height - 75
    };

    const towerHitbox = {
        x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
        y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
        width: targetTower.hitbox.width,
        height: targetTower.hitbox.height
    };

    const isColliding = isFinite(surtrDamageHitbox.x) &&
        surtrDamageHitbox.x < towerHitbox.x + towerHitbox.width &&
        surtrDamageHitbox.x + surtrDamageHitbox.width > towerHitbox.x &&
        surtrDamageHitbox.y < towerHitbox.y + towerHitbox.height &&
        surtrDamageHitbox.y + surtrDamageHitbox.height > towerHitbox.y;

    return isColliding;
}

export function isCollidingWithEnemy(surtrData, enemySurtr) {
    if (!surtrData.damageHitbox || !enemySurtr.hitbox || !isFinite(surtrData.worldX) || !isFinite(enemySurtr.worldX)) {
        return false;
    }

    const surtrHitbox = {
        x: isFinite(surtrData.worldX + surtrData.hitbox.offsetX * (surtrData.skeleton.scaleX || 1) - surtrData.hitbox.width / 2) ?
            surtrData.worldX + surtrData.hitbox.offsetX * (surtrData.skeleton.scaleX || 1) - surtrData.hitbox.width / 2 :
            surtrData.worldX,
        y: surtrData.groundY + 220 + surtrData.hitbox.offsetY - surtrData.hitbox.height / 2,
        width: surtrData.hitbox.width,
        height: surtrData.hitbox.height
    };

    const surtrDamageHitbox = {
        x: surtrData.direction === -1 ?
            surtrHitbox.x - (surtrData.damageHitbox.width - 50) :
            surtrHitbox.x + surtrHitbox.width,
        y: surtrData.groundY + surtrData.damageHitbox.offsetY - surtrData.damageHitbox.height / 2 + 258,
        width: surtrData.damageHitbox.width - 50,
        height: surtrData.damageHitbox.height - 75
    };

    const enemyHitbox = {
        x: isFinite(enemySurtr.worldX + enemySurtr.hitbox.offsetX * (enemySurtr.skeleton.scaleX || 1) - enemySurtr.hitbox.width / 2) ?
            enemySurtr.worldX + enemySurtr.hitbox.offsetX * (enemySurtr.skeleton.scaleX || 1) - enemySurtr.hitbox.width / 2 :
            enemySurtr.worldX,
        y: enemySurtr.groundY + 220 + enemySurtr.hitbox.offsetY - enemySurtr.hitbox.height / 2,
        width: enemySurtr.hitbox.width,
        height: enemySurtr.hitbox.height
    };

    const isColliding = surtrDamageHitbox.x < enemyHitbox.x + enemyHitbox.width &&
        surtrDamageHitbox.x + surtrDamageHitbox.width > enemyHitbox.x &&
        surtrDamageHitbox.y < enemyHitbox.y + enemyHitbox.height &&
        surtrDamageHitbox.y + surtrDamageHitbox.height > enemyHitbox.y;

    return isColliding;
}

function calculateSetupPoseBounds(skeleton) {
    skeleton.setToSetupPose();
    skeleton.updateWorldTransform();
    const offset = new spine.Vector2(), size = new spine.Vector2();
    skeleton.getBounds(offset, size, []);
    return { offset, size };
}

function switchSkeletonFile(surtrData, newSkelPath, newAtlasPath, initialAnimation, callback) {
    if (isSwitchingSkeleton) {
        if (callback) callback(false);
        return false;
    }

    if (surtrData.currentSkelPath === newSkelPath && surtrData.currentAtlasPath === newAtlasPath) {
        const animationToUse = surtrData.skeleton.data.animations.find(anim => anim.name.toLowerCase() === initialAnimation.toLowerCase())?.name;
        if (animationToUse) {
            surtrData.state.setAnimation(0, animationToUse, initialAnimation.toLowerCase() === "die" ? false : true);
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
                    isSwitchingSkeleton = false;
                    if (callback) callback(false);
                    return;
                }
                const atlasLoader = new spine.AtlasAttachmentLoader(atlas);
                const skeletonBinary = new spine.SkeletonBinary(atlasLoader);
                skeletonBinary.scale = 0.3;

                const binaryData = skelData;
                if (!binaryData) {
                    isSwitchingSkeleton = false;
                    if (callback) callback(false);
                    return;
                }
                const newSkeletonData = skeletonBinary.readSkeletonData(binaryData);
                if (!newSkeletonData) {
                    isSwitchingSkeleton = false;
                    if (callback) callback(false);
                    return;
                }

                const animationToUse = newSkeletonData.animations.find(anim => anim.name.toLowerCase() === initialAnimation.toLowerCase())?.name;
                if (!animationToUse) {
                    console.error(`Animation ${initialAnimation} not found in ${newSkelPath}. Available animations: ${newSkeletonData.animations.map(a => a.name).join(", ")}`);
                    isSwitchingSkeleton = false;
                    if (callback) callback(false);
                    return;
                }

                const oldSkeleton = surtrData.skeleton;
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
                        if (event.data.name === "OnAttack" && surtrData.isInAttackState && surtrData) {
                            let atk = characterDataObj["Surtr"].atk;
                            let damage;
                            if (surtrData.target && surtrData.isAttackingEnemy) {
                                const targetRes = characterDataObj[surtrData.target.type]?.res || 0;
                                damage = Math.round(Math.max(0, atk * (1 - (targetRes / 100))));
                                surtrData.target.hp = Math.max(0, surtrData.target.hp - damage);
                                createDamageText(surtrData.target.worldX, GROUND_Y + 300, damage, 'purple');
                            } else {
                                const targetTower = surtrData.tower;
                                if (targetTower && isCollidingWithTower(surtrData, targetTower)) {
                                    const towerRes = targetTower.res || 0;
                                    damage = Math.round(Math.max(0, atk * (1 - (towerRes / 100))));
                                    targetTower.hp = Math.max(0, targetTower.hp - damage);
                                    const towerCenterX = targetTower.x + targetTower.hitbox.offsetX;
                                    createDamageText(towerCenterX, GROUND_Y + 200, damage, 'purple');
                                }
                            }
                        }
                    },
                    complete: function (trackIndex, count) {
                        const currentAnimation = animationState.getCurrent(0)?.animation?.name.toLowerCase();
                        if (currentAnimation === "start" && !surtrData.isDead) {
                            surtrData.isInStartAnimation = false;
                            switchSkeletonFile(
                                surtrData,
                                "assets/operators/Surtr/SurtrSummer/surtr_summer.skel",
                                "assets/operators/Surtr/SurtrSummer/surtr_summer.atlas",
                                "Move",
                                (success) => {
                                    if (success) {
                                        surtrData.velocity = 50;
                                        console.log("Surtr switched to Move animation from Start");
                                    } else {
                                        console.error("Failed to switch to Move skeleton for Surtr");
                                        surtrData.state.setAnimation(0, "Move", true);
                                    }
                                }
                            );
                        }
                        if (surtrData.isDead && currentAnimation === "die") {
                            surtrData.deathAnimationComplete = true;
                        }
                    }
                });

                const newBounds = calculateSetupPoseBounds(newSkeleton);
                surtrData.skeleton = newSkeleton;
                surtrData.state = animationState;
                surtrData.bounds = newBounds;
                surtrData.damageHitbox = fixedDamageHitbox;
                surtrData.currentSkelPath = newSkelPath;
                surtrData.currentAtlasPath = newAtlasPath;
                isSwitchingSkeleton = false;
                if (callback) callback(true);
            } catch (e) {
                isSwitchingSkeleton = false;
                if (callback) callback(false);
            }
        } else {
            retryCount++;
            requestAnimationFrame(attemptSwitch);
        }
    }

    attemptSwitch();
    return true;
}

export function renderSurtrSkeleton(surtrData, delta, camera, canvas, groundTileImage, WORLD_WIDTH, GROUND_Y, TOWER_POSITIONS, backgroundCtx, gl, allAllies, enemies) {
    if (!surtrData) {
        console.error("surtrData không tồn tại");
        return;
    }

    const { skeleton, state, premultipliedAlpha, bounds, worldX, hitbox, damageHitbox } = surtrData;
    state.update(delta);

    if (surtrData.hp <= 0 && !surtrData.isDead && !isSwitchingSkeleton) {
        console.log(`Surtr tại worldX=${surtrData.worldX} đã chết, chuyển sang animation Die`);
        surtrData.isDead = true;
        surtrData.isInAttackState = false;
        surtrData.isInStartAnimation = false;
        surtrData.velocity = 0;
        switchSkeletonFile(
            surtrData,
            "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel",
            "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas",
            "Die",
            (success) => {
                if (success) {
                    console.log(`Surtr tại worldX=${surtrData.worldX} chuyển sang animation Die thành công`);
                } else {
                    console.error(`Không thể chuyển sang animation Die cho Surtr tại worldX=${surtrData.worldX}`);
                    surtrData.deathAnimationComplete = true;
                }
            }
        );
    }

    if (surtrData.isDead && !surtrData.deathAnimationComplete) {
        surtrData.deathAnimationTimer += delta;
        if (surtrData.deathAnimationTimer >= 1.0) {
            surtrData.deathAnimationComplete = true;
            console.log(`Animation Die hoàn tất (theo timer) cho Surtr tại worldX=${surtrData.worldX}`);
        }
    }

    if (!surtrData.deathAnimationComplete) {
        state.apply(skeleton);
        surtrData.tower = surtrData.direction === 1 ? TOWER_POSITIONS[1] : TOWER_POSITIONS[0];
        surtrData.groundY = GROUND_Y;

        const surtrHitbox = {
            x: isFinite(worldX + hitbox.offsetX * (skeleton.scaleX || 1) - hitbox.width / 2) ?
                worldX + hitbox.offsetX * (skeleton.scaleX || 1) - hitbox.width / 2 : worldX,
            y: GROUND_Y + 220 + hitbox.offsetY - hitbox.height / 2,
            width: hitbox.width,
            height: hitbox.height
        };

        const surtrDamageHitbox = {
            x: isFinite(worldX) && damageHitbox && isFinite(damageHitbox.offsetX) ?
                (surtrData.direction === -1 ?
                    surtrHitbox.x - (damageHitbox.width - 50) :
                    surtrHitbox.x + surtrHitbox.width) : worldX,
            y: damageHitbox ? GROUND_Y + damageHitbox.offsetY - damageHitbox.height / 2 + 258 : GROUND_Y + 258,
            width: damageHitbox ? damageHitbox.width - 50 : 50,
            height: damageHitbox ? damageHitbox.height - 75 : 125
        };

        if (!hasLoggedSurtrPosition) {
            console.log(`Vị trí Surtr: worldX=${worldX}, y=${skeleton.y}, direction=${surtrData.direction}`);
            hasLoggedSurtrPosition = true;
        }

        const validEnemies = Array.isArray(enemies) ? enemies : [];

        let closestEnemy = null;
        let minDistance = Infinity;
        validEnemies.forEach(enemy => {
            if (enemy && enemy.hp > 0 && isCollidingWithEnemy(surtrData, enemy)) {
                const distance = Math.abs(surtrData.worldX - enemy.worldX);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestEnemy = enemy;
                }
            }
        });

        const isCollidingWithEnemyFlag = !!closestEnemy;
        surtrData.target = closestEnemy ? closestEnemy : surtrData.tower;
        surtrData.isAttackingEnemy = !!closestEnemy;

        const targetTower = surtrData.tower;
        const towerHitbox = {
            x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
            y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
            width: targetTower.hitbox.width,
            height: targetTower.hitbox.height
        };

        const isColliding = isCollidingWithTower(surtrData, targetTower);

        let isBlockedByFrontAlly = false;
        let frontAlly = null;
        for (let otherAlly of allAllies) {
            if (otherAlly !== surtrData &&
                (surtrData.direction === 1 ? otherAlly.worldX > surtrData.worldX : otherAlly.worldX < surtrData.worldX)) {
                const otherHitbox = {
                    x: otherAlly.worldX + otherAlly.hitbox.offsetX * (otherAlly.skeleton.scaleX || 1) - otherAlly.hitbox.width / 2,
                    y: GROUND_Y + 220 + otherAlly.hitbox.offsetY - otherAlly.hitbox.height / 2,
                    width: otherAlly.hitbox.width,
                    height: otherAlly.hitbox.height
                };
                if (surtrData.direction === 1 ?
                    surtrHitbox.x + surtrHitbox.width >= otherHitbox.x :
                    surtrHitbox.x <= otherHitbox.x + otherHitbox.width) {
                    const frontAnimation = otherAlly.state.getCurrent(0)?.animation?.name.toLowerCase() || "";
                    if (frontAnimation === "attack" || frontAnimation === "idle" || otherAlly.isInAttackState) {
                        isBlockedByFrontAlly = true;
                        frontAlly = otherAlly;
                        break;
                    }
                }
            }
        }

        if (!surtrData.isInStartAnimation && !surtrData.isDead && !isSwitchingSkeleton) {
            if (!isCollidingWithEnemyFlag && !isColliding && !isBlockedByFrontAlly &&
                surtrData.currentSkelPath === "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel" &&
                !surtrData.isInAttackState) {
                console.log(`Surtr tại worldX=${surtrData.worldX} không còn bị chặn, chuyển từ Idle về Move`);
                switchSkeletonFile(
                    surtrData,
                    "assets/operators/Surtr/SurtrSummer/surtr_summer.skel",
                    "assets/operators/Surtr/SurtrSummer/surtr_summer.atlas",
                    "Move",
                    (success) => {
                        if (success) {
                            surtrData.isInAttackState = false;
                            console.log("Surtr switched back to Move animation from Idle");
                        } else {
                            console.error("Failed to switch back to Move skeleton for Surtr");
                            state.setAnimation(0, "Move", true);
                        }
                    }
                );
            }

            if (isCollidingWithEnemyFlag && isFinite(surtrDamageHitbox.x)) {
                if (!surtrData.isInAttackState) {
                    console.log(`Surtr tại worldX=${surtrData.worldX} dừng để tấn công kẻ địch tại worldX=${closestEnemy.worldX}`);
                    switchSkeletonFile(
                        surtrData,
                        "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel",
                        "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas",
                        "Attack",
                        (success) => {
                            if (success) {
                                surtrData.isInAttackState = true;
                                console.log("Surtr switched to Attack animation for enemy");
                            } else {
                                console.error("Failed to switch to Attack skeleton for Surtr");
                                state.setAnimation(0, "Move", true);
                            }
                        }
                    );
                }
            } else if (isColliding && isFinite(surtrDamageHitbox.x)) {
                if (!surtrData.isInAttackState) {
                    console.log("Surtr tạm dừng di chuyển do va chạm với tháp");
                    switchSkeletonFile(
                        surtrData,
                        "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel",
                        "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas",
                        "Attack",
                        (success) => {
                            if (success) {
                                surtrData.isInAttackState = true;
                                console.log("Surtr switched to Attack animation for tower");
                            } else {
                                console.error("Failed to switch to Attack skeleton for Surtr");
                                state.setAnimation(0, "Move", true);
                            }
                        }
                    );
                }
            } else if (isBlockedByFrontAlly && surtrData.currentSkelPath !== "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel") {
                console.log(`Surtr tại worldX=${surtrData.worldX} bị chặn bởi Surtr phía trước tại worldX=${frontAlly.worldX}, chuyển sang Idle`);
                switchSkeletonFile(
                    surtrData,
                    "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel",
                    "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas",
                    "Idle",
                    (success) => {
                        if (success) {
                            surtrData.isInAttackState = false;
                            console.log("Surtr switched to Idle animation");
                        } else {
                            console.error("Failed to switch to Idle skeleton for Surtr");
                            state.setAnimation(0, "Move", true);
                        }
                    }
                );
            } else if (!isCollidingWithEnemyFlag && !isColliding && !isBlockedByFrontAlly && surtrData.isInAttackState) {
                console.log(`Surtr tại worldX=${surtrData.worldX} không còn va chạm, chuyển từ Attack về Move`);
                switchSkeletonFile(
                    surtrData,
                    "assets/operators/Surtr/SurtrSummer/surtr_summer.skel",
                    "assets/operators/Surtr/SurtrSummer/surtr_summer.atlas",
                    "Move",
                    (success) => {
                        if (success) {
                            surtrData.isInAttackState = false;
                            console.log("Surtr switched back to Move animation from Attack");
                        } else {
                            console.error("Failed to switch back to Move skeleton for Surtr");
                            state.setAnimation(0, "Move", true);
                        }
                    }
                );
            }
        }

        if (!surtrData.isInStartAnimation && !surtrData.isDead && !isSwitchingSkeleton &&
            !isCollidingWithEnemyFlag && !isColliding && !isBlockedByFrontAlly) {
            surtrData.worldX += surtrData.velocity * delta * surtrData.direction;
        } else if (isBlockedByFrontAlly && !surtrData.isDead && !isSwitchingSkeleton) {
            if (surtrData.direction === -1) {
                const otherHitbox = {
                    x: frontAlly.worldX + frontAlly.hitbox.offsetX * (frontAlly.skeleton.scaleX || 1) - frontAlly.hitbox.width / 2,
                    y: GROUND_Y + 220 + frontAlly.hitbox.offsetY - frontAlly.hitbox.height / 2,
                    width: frontAlly.hitbox.width,
                    height: frontAlly.hitbox.height
                };
                surtrData.worldX = otherHitbox.x + otherHitbox.width + surtrData.hitbox.width / 2 - surtrData.hitbox.offsetX * (surtrData.skeleton.scaleX || 1);
            }
        }

        skeleton.x = surtrData.worldX - camera.x;
        skeleton.y = canvas.height - (GROUND_Y + 425);
        skeleton.scaleX = surtrData.direction;

        if (surtrData.direction === 1 && surtrData.worldX > towerHitbox.x - hitbox.width) {
            surtrData.worldX = towerHitbox.x - hitbox.width;
        } else if (surtrData.direction === -1 && surtrData.worldX < towerHitbox.x + towerHitbox.width) {
            surtrData.worldX = towerHitbox.x + towerHitbox.width;
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
        //     surtrHitbox.x - camera.x,
        //     surtrHitbox.y,
        //     surtrHitbox.width,
        //     surtrHitbox.height
        // );

        // if (isFinite(surtrDamageHitbox.x) && !surtrData.isDead) {
        //     backgroundCtx.fillStyle = "rgba(255, 165, 0, 0.3)";
        //     backgroundCtx.fillRect(
        //         surtrDamageHitbox.x - camera.x,
        //         surtrDamageHitbox.y,
        //         surtrDamageHitbox.width,
        //         surtrDamageHitbox.height
        //     );
        // }
    }
}

export function resizeSurtr(canvas, camera, gl) {
    gl.viewport(0, 0, canvas.width, canvas.height);
}

export function isOverlappingWithOtherSurtr(newHitbox, existingSurtrs, GROUND_Y) {
    for (let existing of existingSurtrs) {
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