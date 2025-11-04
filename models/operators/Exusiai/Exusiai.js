import { characterDataObj } from '../../../character.js';
import { createDamageText, GROUND_Y } from '../../../render.js';

let shader, batcher, mvp, skeletonRenderer, assetManager;
let currentSkelPath = "assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.skel";
let currentAtlasPath = "assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.atlas";
let isSwitchingSkeleton = false;
let hasLoggedExusiaiPosition = false;
let fixedDamageHitbox = null;
let projectileImages = [];

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

    assetManager.loadBinary("assets/operators/Exusiai/ExusiaiSale/build_char_103_angel_sale8.skel");
    assetManager.loadTextureAtlas("assets/operators/Exusiai/ExusiaiSale/build_char_103_angel_sale8.atlas");
    assetManager.loadTexture("assets/operators/Exusiai/ExusiaiSale/build_char_103_angel_sale8.png");
    assetManager.loadBinary("assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.skel");
    assetManager.loadTextureAtlas("assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.atlas");
    assetManager.loadTexture("assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.png");

    projectileImages = [];
    const bulletSrc = "assets/operators/Exusiai/ExusiaiSale/bullet.png";
    const img = new Image();
    img.src = bulletSrc;
    img.onload = () => console.log(`Hình ảnh đạn Exusiai đã tải: ${bulletSrc}`);
    img.onerror = () => console.error(`Lỗi tải ảnh đạn: ${bulletSrc}`);
    projectileImages.push(img);
}

export function isExusiaiLoadingComplete() {
    return assetManager && assetManager.isLoadingComplete() &&
        projectileImages.length > 0 && projectileImages[0].complete;
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

    const initialAnimation = "Start";
    const animationToUse = skeletonDataRaw.animations.find(anim => anim.name.toLowerCase() === initialAnimation.toLowerCase())?.name || skeletonDataRaw.animations[0]?.name;
    if (!animationToUse) {
        console.error(`Initial animation ${initialAnimation} not found in ${currentSkelPath}. Available animations: ${skeletonDataRaw.animations.map(a => a.name).join(", ")}`);
    }
    animationState.setAnimation(0, animationToUse || "Idle", false);

    const hitbox = {
        width: isFinite(bounds.size.x) ? bounds.size.x * 0.25 : 100,
        height: isFinite(bounds.size.y) ? bounds.size.y * 0.9 : 200,
        offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 120) ? bounds.offset.x + bounds.size.x / 2 - 55 : 120,
        offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.2 + 120) ? bounds.offset.y + bounds.size.y * 0.2 + 120 : 120
    };

    fixedDamageHitbox = {
        width: 250,
        height: 300,
        offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 220) ? bounds.offset.x + bounds.size.x / 2 + 220 : 220,
        offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.2 + 120) ? bounds.offset.y + bounds.size.y * 0.2 + 71 : 120
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
        isInStartAnimation: true,
        currentSkelPath,
        currentAtlasPath,
        direction: 1,
        velocity: 50,
        target: null,
        isAttackingEnemy: false,
        isDead: false,
        deathAnimationTimer: 0,
        deathAnimationComplete: false,
        groundY: GROUND_Y,
        type: "Exusiai",
        projectiles: [],
        attackCount: 0
    };

    animationState.addListener({
        complete: function (trackIndex, count) {
            const currentAnimation = animationState.getCurrent(0)?.animation?.name.toLowerCase();

            if (currentAnimation === "start" && !exusiaiData.isDead) {
                exusiaiData.isInStartAnimation = false;
                switchSkeletonFile(
                    exusiaiData,
                    "assets/operators/Exusiai/ExusiaiSale/build_char_103_angel_sale8.skel",
                    "assets/operators/Exusiai/ExusiaiSale/build_char_103_angel_sale8.atlas",
                    "Move",
                    (success) => {
                        if (success) {
                            exusiaiData.velocity = 50;
                            console.log("Exusiai switched to Move animation after Start");
                        } else {
                            console.error("Failed to switch to Move skeleton for Exusiai");
                            exusiaiData.state.setAnimation(0, "Idle", true);
                        }
                    }
                );
            }

            if (currentAnimation === "attack" && !exusiaiData.isDead) {
                const target = exusiaiData.target;
                const stillHasTarget = target && target.hp > 0 &&
                    (exusiaiData.isAttackingEnemy
                        ? isCollidingWithEnemy(exusiaiData, target)
                        : isCollidingWithTower(exusiaiData, exusiaiData.tower));

                if (stillHasTarget) {
                    exusiaiData.state.setAnimation(0, "Attack", false);
                } else {
                    exusiaiData.isInAttackState = false;
                    exusiaiData.target = null;
                    exusiaiData.isAttackingEnemy = false;

                    switchSkeletonFile(
                        exusiaiData,
                        "assets/operators/Exusiai/ExusiaiSale/build_char_103_angel_sale8.skel",
                        "assets/operators/Exusiai/ExusiaiSale/build_char_103_angel_sale8.atlas",
                        "Move",
                        (success) => {
                            if (success) {
                                exusiaiData.velocity = 50;
                                console.log("Exusiai switched to Move animation after Attack finished");
                            } else {
                                exusiaiData.state.setAnimation(0, "Idle", true);
                            }
                        }
                    );
                }
            }

            if (exusiaiData.isDead && currentAnimation === "die") {
                exusiaiData.deathAnimationComplete = true;
            }
        },
        event: function (trackIndex, event) {
            if (event.data.name === "OnAttack" && exusiaiData.isInAttackState && exusiaiData) {
                exusiaiData.attackCount++;
                let baseDamage = characterDataObj["Exusiai"].atk;
                let damage1 = 0, damage2 = 0, damage3 = 0, totalDamage = 0;

                let targetDef = 0;
                if (exusiaiData.target && exusiaiData.isAttackingEnemy) {
                    targetDef = characterDataObj[exusiaiData.target.type]?.def || 0;
                } else {
                    const targetTower = exusiaiData.tower;
                    targetDef = targetTower.def || 0;
                }

                if (exusiaiData.attackCount === 5) {
                    const burst = Math.max(baseDamage * 1.45 * 0.05, baseDamage * 1.45 - targetDef);
                    damage1 = damage2 = damage3 = Math.round(burst);
                    totalDamage = damage1 + damage2 + damage3;
                    exusiaiData.attackCount = 0;
                } else {
                    damage1 = Math.round(Math.max(baseDamage * 0.05, baseDamage - targetDef));
                    totalDamage = damage1;
                }

                let targetHitbox, targetCenterX, targetCenterY;
                if (exusiaiData.target && exusiaiData.isAttackingEnemy) {
                    targetHitbox = {
                        x: exusiaiData.target.worldX + exusiaiData.target.hitbox.offsetX * (exusiaiData.target.skeleton.scaleX || 1) - exusiaiData.target.hitbox.width / 2,
                        y: exusiaiData.target.groundY + 220 + exusiaiData.target.hitbox.offsetY - exusiaiData.target.hitbox.height / 2,
                        width: exusiaiData.target.hitbox.width,
                        height: exusiaiData.target.hitbox.height
                    };
                } else {
                    const targetTower = exusiaiData.tower;
                    targetHitbox = {
                        x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
                        y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
                        width: targetTower.hitbox.width,
                        height: targetTower.hitbox.height
                    };
                }
                targetCenterX = targetHitbox.x + targetHitbox.width / 2;
                targetCenterY = targetHitbox.y + targetHitbox.height / 2;

                const exusiaiHitbox = {
                    x: exusiaiData.worldX + exusiaiData.hitbox.offsetX * (exusiaiData.skeleton.scaleX || 1) - exusiaiData.hitbox.width / 2,
                    y: exusiaiData.groundY + 220 + exusiaiData.hitbox.offsetY - exusiaiData.hitbox.height / 2,
                    width: exusiaiData.hitbox.width,
                    height: exusiaiData.hitbox.height
                };

                const projectileX = exusiaiData.direction === 1 ? exusiaiHitbox.x + exusiaiHitbox.width : exusiaiHitbox.x;
                const projectileY = exusiaiHitbox.y + exusiaiHitbox.height / 2 + 5;

                const dx = targetCenterX - projectileX;
                const dy = targetCenterY - projectileY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const speed = 500;

                const projectile = {
                    worldX: projectileX,
                    y: projectileY,
                    velocityX: distance > 0 ? (dx / distance) * speed : 0,
                    velocityY: distance > 0 ? (dy / distance) * speed : 0,
                    active: true,
                    damage1, damage2, damage3,
                    totalDamage,
                    target: exusiaiData.target,
                    targetCenterX, targetCenterY,
                    image: projectileImages[0]
                };
                exusiaiData.projectiles.push(projectile);

                console.log(`Exusiai bắn đạn: ${totalDamage} dmg (1:${damage1}, 2:${damage2}, 3:${damage3})`);
            }
        }
    });

    return exusiaiData;
}

function isCollidingWithTower(exusiaiData, targetTower) {
    if (!exusiaiData.damageHitbox || !isFinite(exusiaiData.worldX) || !isFinite(exusiaiData.damageHitbox.offsetX)) {
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
            exusiaiHitbox.x - (exusiaiData.damageHitbox.width) :
            exusiaiHitbox.x + exusiaiHitbox.width,
        y: exusiaiData.groundY + exusiaiData.damageHitbox.offsetY - exusiaiData.damageHitbox.height / 2 + 258,
        width: exusiaiData.damageHitbox.width,
        height: exusiaiData.damageHitbox.height - 75
    };

    const towerHitbox = {
        x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
        y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
        width: targetTower.hitbox.width,
        height: targetTower.hitbox.height
    };

    return isFinite(exusiaiDamageHitbox.x) &&
        exusiaiDamageHitbox.x < towerHitbox.x + towerHitbox.width &&
        exusiaiDamageHitbox.x + exusiaiDamageHitbox.width > towerHitbox.x &&
        exusiaiDamageHitbox.y < towerHitbox.y + towerHitbox.height &&
        exusiaiDamageHitbox.y + exusiaiDamageHitbox.height > towerHitbox.y;
}

export function isCollidingWithEnemy(exusiaiData, enemyExusiai) {
    if (!exusiaiData.damageHitbox || !enemyExusiai.hitbox || !isFinite(exusiaiData.worldX) || !isFinite(enemyExusiai.worldX)) {
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
            exusiaiHitbox.x - (exusiaiData.damageHitbox.width) :
            exusiaiHitbox.x + exusiaiHitbox.width,
        y: exusiaiData.groundY + exusiaiData.damageHitbox.offsetY - exusiaiData.damageHitbox.height / 2 + 258,
        width: exusiaiData.damageHitbox.width,
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

    return exusiaiDamageHitbox.x < enemyHitbox.x + enemyHitbox.width &&
        exusiaiDamageHitbox.x + exusiaiDamageHitbox.width > enemyHitbox.x &&
        exusiaiDamageHitbox.y < enemyHitbox.y + enemyHitbox.height &&
        exusiaiDamageHitbox.y + exusiaiDamageHitbox.height > enemyHitbox.y;
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
        if (callback) callback(false);
        return false;
    }

    if (exusiaiData.currentSkelPath === newSkelPath && exusiaiData.currentAtlasPath === newAtlasPath) {
        const animationToUse = exusiaiData.skeleton.data.animations.find(anim => anim.name.toLowerCase() === initialAnimation.toLowerCase())?.name;
        if (animationToUse) {
            exusiaiData.state.setAnimation(0, animationToUse, initialAnimation.toLowerCase() === "die" ? false : true);
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
                            exusiaiData.attackCount++;
                            let baseDamage = characterDataObj["Exusiai"].atk;
                            let damage1 = 0, damage2 = 0, damage3 = 0, totalDamage = 0;

                            let targetDef = 0;
                            if (exusiaiData.target && exusiaiData.isAttackingEnemy) {
                                targetDef = characterDataObj[exusiaiData.target.type]?.def || 0;
                            } else {
                                const targetTower = exusiaiData.tower;
                                targetDef = targetTower.def || 0;
                            }

                            if (exusiaiData.attackCount === 5) {
                                const burst = Math.max(baseDamage * 1.45 * 0.05, baseDamage * 1.45 - targetDef);
                                damage1 = damage2 = damage3 = Math.round(burst);
                                totalDamage = damage1 + damage2 + damage3;
                                exusiaiData.attackCount = 0;
                            } else {
                                damage1 = Math.round(Math.max(baseDamage * 0.05, baseDamage - targetDef));
                                totalDamage = damage1;
                            }

                            let targetHitbox, targetCenterX, targetCenterY;
                            if (exusiaiData.target && exusiaiData.isAttackingEnemy) {
                                targetHitbox = {
                                    x: exusiaiData.target.worldX + exusiaiData.target.hitbox.offsetX * (exusiaiData.target.skeleton.scaleX || 1) - exusiaiData.target.hitbox.width / 2,
                                    y: exusiaiData.target.groundY + 220 + exusiaiData.target.hitbox.offsetY - exusiaiData.target.hitbox.height / 2,
                                    width: exusiaiData.target.hitbox.width,
                                    height: exusiaiData.target.hitbox.height
                                };
                            } else {
                                const targetTower = exusiaiData.tower;
                                targetHitbox = {
                                    x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
                                    y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
                                    width: targetTower.hitbox.width,
                                    height: targetTower.hitbox.height
                                };
                            }
                            targetCenterX = targetHitbox.x + targetHitbox.width / 2;
                            targetCenterY = targetHitbox.y + targetHitbox.height / 2;

                            const exusiaiHitbox = {
                                x: exusiaiData.worldX + exusiaiData.hitbox.offsetX * (exusiaiData.skeleton.scaleX || 1) - exusiaiData.hitbox.width / 2,
                                y: exusiaiData.groundY + 220 + exusiaiData.hitbox.offsetY - exusiaiData.hitbox.height / 2,
                                width: exusiaiData.hitbox.width,
                                height: exusiaiData.hitbox.height
                            };

                            const projectileX = exusiaiData.direction === 1 ? exusiaiHitbox.x + exusiaiHitbox.width : exusiaiHitbox.x;
                            const projectileY = exusiaiHitbox.y + exusiaiHitbox.height / 2 + 5;

                            const dx = targetCenterX - projectileX;
                            const dy = targetCenterY - projectileY;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            const speed = 500;

                            const projectile = {
                                worldX: projectileX,
                                y: projectileY,
                                velocityX: distance > 0 ? (dx / distance) * speed : 0,
                                velocityY: distance > 0 ? (dy / distance) * speed : 0,
                                active: true,
                                damage1, damage2, damage3,
                                totalDamage,
                                target: exusiaiData.target,
                                targetCenterX, targetCenterY,
                                image: projectileImages[0]
                            };
                            exusiaiData.projectiles.push(projectile);

                            // console.log(`Exusiai bắn đạn: ${totalDamage} dmg (1:${damage1}, 2:${damage2}, 3:${damage3})`);
                        }
                    },
                    complete: function (trackIndex, count) {
                        if (exusiaiData.isDead && animationState.getCurrent(0).animation.name.toLowerCase() === "die") {
                            exusiaiData.deathAnimationComplete = true;
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
                if (callback) callback(true);
            } catch (e) {
                console.error("Lỗi khi chuyển skeleton:", e);
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

export function renderExusiaiSkeleton(exusiaiData, delta, camera, canvas, groundTileImage, WORLD_WIDTH, GROUND_Y, TOWER_POSITIONS, backgroundCtx, gl, allAllies, enemies) {
    if (!exusiaiData) {
        console.error("exusiaiData không tồn tại");
        return;
    }

    const { skeleton, state, premultipliedAlpha, bounds, worldX, hitbox, damageHitbox } = exusiaiData;
    state.update(delta);

    if (exusiaiData.hp <= 0 && !exusiaiData.isDead && !isSwitchingSkeleton) {
        exusiaiData.isDead = true;
        exusiaiData.isInAttackState = false;
        exusiaiData.velocity = 0;
        switchSkeletonFile(
            exusiaiData,
            "assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.skel",
            "assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.atlas",
            "Die",
            (success) => {
                if (success) {
                    console.log(`Exusiai tại worldX=${exusiaiData.worldX} chuyển sang animation Die thành công`);
                } else {
                    exusiaiData.deathAnimationComplete = true;
                }
            }
        );
    }

    if (exusiaiData.isDead && !exusiaiData.deathAnimationComplete) {
        exusiaiData.deathAnimationTimer += delta;
        if (exusiaiData.deathAnimationTimer >= 1.0) {
            exusiaiData.deathAnimationComplete = true;
        }
    }

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
                    exusiaiHitbox.x - (damageHitbox.width) :
                    exusiaiHitbox.x + exusiaiHitbox.width) : worldX,
            y: damageHitbox ? GROUND_Y + damageHitbox.offsetY - damageHitbox.height / 2 + 258 : GROUND_Y + 258,
            width: damageHitbox ? damageHitbox.width : 50,
            height: damageHitbox ? damageHitbox.height - 75 : 125
        };

        if (!hasLoggedExusiaiPosition) {
            hasLoggedExusiaiPosition = true;
        }

        const validEnemies = Array.isArray(enemies) ? enemies : [];
        let closestEnemy = null;
        let minDistance = Infinity;
        validEnemies.forEach(enemy => {
            if (enemy && enemy.hp > 0 && isCollidingWithEnemy(exusiaiData, enemy)) {
                const distance = Math.abs(exusiaiData.worldX - enemy.worldX);
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
                    const frontAnimation = otherAlly.state.getCurrent(0)?.animation?.name.toLowerCase() || "";
                    if (frontAnimation === "attack" || frontAnimation === "idle" || otherAlly.isInAttackState) {
                        isBlockedByFrontAlly = true;
                        frontAlly = otherAlly;
                        break;
                    }
                }
            }
        }

        if (!exusiaiData.isInStartAnimation && !isCollidingWithEnemyFlag && !isColliding && !isBlockedByFrontAlly &&
            exusiaiData.currentSkelPath === "assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.skel" &&
            !exusiaiData.isInAttackState && !isSwitchingSkeleton && !exusiaiData.isDead) {
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
                        exusiaiData.state.setAnimation(0, "Idle", true);
                    }
                }
            );
        }

        if (isCollidingWithEnemyFlag && !isSwitchingSkeleton && isFinite(exusiaiDamageHitbox.x) && !exusiaiData.isDead) {
            if (!exusiaiData.isInAttackState) {
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
                            exusiaiData.state.setAnimation(0, "Idle", true);
                        }
                    }
                );
            }
        } else if (isColliding && !isSwitchingSkeleton && isFinite(exusiaiDamageHitbox.x) && !exusiaiData.isDead) {
            if (!exusiaiData.isInAttackState) {
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
                            exusiaiData.state.setAnimation(0, "Idle", true);
                        }
                    }
                );
            }
        } else if (isBlockedByFrontAlly && !isSwitchingSkeleton && !exusiaiData.isDead) {
            if (exusiaiData.currentSkelPath !== "assets/operators/Exusiai/ExusiaiSale/char_103_angel_sale_8.skel") {
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
                            exusiaiData.state.setAnimation(0, "Idle", true);
                        }
                    }
                );
            }
        } else if (!isCollidingWithEnemyFlag && !isColliding && !isBlockedByFrontAlly &&
            exusiaiData.isInAttackState && !isSwitchingSkeleton && !exusiaiData.isDead) {
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
                        exusiaiData.state.setAnimation(0, "Idle", true);
                    }
                }
            );
        }

        if (!exusiaiData.isInStartAnimation && !isCollidingWithEnemyFlag && !isColliding && !isBlockedByFrontAlly && !isSwitchingSkeleton && !exusiaiData.isDead) {
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
            }
        }

        skeleton.x = exusiaiData.worldX - camera.x;
        skeleton.y = canvas.height - (GROUND_Y + 425);
        skeleton.scaleX = exusiaiData.direction;

        if (exusiaiData.direction === 1 && exusiaiData.worldX > towerHitbox.x - hitbox.width) {
            exusiaiData.worldX = towerHitbox.x - hitbox.width;
        } else if (exusiaiData.direction === -1 && exusiaiData.worldX < towerHitbox.x + towerHitbox.width) {
            exusiaiData.worldX = towerHitbox.x + towerHitbox.width;
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

        // backgroundCtx.fillStyle = "blue";
        // const dotRadius = 5;
        // const dotX = exusiaiData.direction === 1
        //     ? exusiaiHitbox.x + exusiaiHitbox.width - camera.x
        //     : exusiaiHitbox.x - camera.x;
        // const dotY = exusiaiHitbox.y + exusiaiHitbox.height / 2 + 5;
        // backgroundCtx.beginPath();
        // backgroundCtx.arc(dotX, dotY, dotRadius, 0, 2 * Math.PI);
        // backgroundCtx.fill();

        if (projectileImages.length > 0 && projectileImages[0].complete) {
            exusiaiData.projectiles = exusiaiData.projectiles.filter(p => p.active);

            exusiaiData.projectiles.forEach(projectile => {
                projectile.worldX += projectile.velocityX * delta;
                projectile.y += projectile.velocityY * delta;

                if (exusiaiData.isDead || (projectile.target && projectile.target.hp <= 0)) {
                    projectile.active = false;
                    return;
                }

                const dx = projectile.worldX - projectile.targetCenterX;
                const dy = projectile.y - projectile.targetCenterY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 8) {
                    const isTower = projectile.target === exusiaiData.tower;
                    const baseY = isTower ? GROUND_Y + 200 : GROUND_Y + 300;

                    if (projectile.damage1 > 0) createDamageText(projectile.targetCenterX, baseY, projectile.damage1);
                    if (projectile.damage2 > 0) createDamageText(projectile.targetCenterX, baseY + 20, projectile.damage2);
                    if (projectile.damage3 > 0) createDamageText(projectile.targetCenterX, baseY + 40, projectile.damage3);

                    projectile.active = false;
                }

                if (projectile.active) {
                    const scale = 0.3;
                    const w = projectile.image.width * scale;
                    const h = projectile.image.height * scale;
                    backgroundCtx.drawImage(projectile.image, projectile.worldX - camera.x - w / 2, projectile.y - h / 2, w, h);
                }
            });
        }
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