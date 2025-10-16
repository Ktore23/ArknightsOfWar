import { characterDataObj } from '../../../character.js';
import { createDamageText, GROUND_Y } from '../../../render.js';

let shader, batcher, mvp, skeletonRenderer, assetManager;
let currentSkelPath = "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel";
let currentAtlasPath = "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas";
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
    const atlasLoader = new spine.AtlasAttachmentLoader(atlas);
    const skeletonBinary = new spine.SkeletonBinary(atlasLoader);
    skeletonBinary.scale = 0.3;
    const skeletonDataRaw = skeletonBinary.readSkeletonData(assetManager.get("assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel"));
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
    animationState.setAnimation(0, animationToUse || "Move", false);

    animationState.addListener({
        event: function (trackIndex, event) {
            if (event.data.name === "OnAttack" && surtrData.isInAttackState && surtrData) {
                let atk = surtrData.atk;
                surtrData.collidingTargets.forEach(target => {
                    if (target.hp > 0) {
                        let damage;
                        let targetRes = 0;
                        let damageTextX = 0;

                        if (target.type) {
                            targetRes = characterDataObj[target.type]?.res || 0;
                            damageTextX = target.worldX;
                        } else {
                            targetRes = target.res || 0;
                            damageTextX = target.x + target.hitbox.offsetX;
                        }

                        damage = Math.round(Math.max(0, atk * (1 - (targetRes / 100))));
                        target.hp = Math.max(0, target.hp - damage);
                        createDamageText(damageTextX, GROUND_Y + (target.type ? 300 : 200), damage, 'purple');
                    }
                });
            }
        },
        complete: function (trackIndex, count) {
            const currentAnimation = animationState.getCurrent(0)?.animation?.name.toLowerCase();
            if (surtrData.isInStartAnimation && !surtrData.isDead) {
                surtrData.isInStartAnimation = false;
                switchSkeletonFile(
                    surtrData,
                    "assets/operators/Surtr/SurtrSummer/surtr_summer.skel",
                    "assets/operators/Surtr/SurtrSummer/surtr_summer.atlas",
                    "Move",
                    (success) => {
                        if (success) {
                            console.log("Surtr switched to Move animation from Start");
                        } else {
                            console.error("Failed to switch to Move skeleton for Surtr");
                            surtrData.state.setAnimation(0, "Move", true);
                        }
                    }
                );
            }
            if (currentAnimation === "skill_3_begin" && !surtrData.isDead && surtrData.isInSkill3State) {
                surtrData.state.setAnimation(0, "Skill_3_Loop", true);
                console.log(`Surtr tại worldX=${surtrData.worldX} switched to Skill_3_Loop after Skill_3_Begin`);
            }
            if (surtrData.isDead && currentAnimation === "die") {
                surtrData.deathAnimationComplete = true;
            }
            if (currentAnimation === "attack" || currentAnimation === "skill_3_loop") {
                surtrData.isInAttackState = false;
                if (currentAnimation === "skill_3_loop") {
                    surtrData.isInSkill3State = false;
                    surtrData.justCompletedSkillLoop = true;
                }
                console.log(`Surtr tại worldX=${surtrData.worldX} reset states after ${currentAnimation} cycle complete`);
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
        width: 50,
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
        damageHitbox: { ...fixedDamageHitbox },
        tower: null,
        isInAttackState: false,
        isInStartAnimation: true,
        isInSkill3State: false,
        isSwitchingSkeleton: false,
        currentSkelPath: "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel",
        currentAtlasPath: "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas",
        direction: 1,
        velocity: 0,
        target: null,
        isDead: false,
        deathAnimationComplete: false,
        groundY: GROUND_Y,
        type: "Surtr",
        deployTime: 0,
        hasExpandedHitbox: false,
        hasLoggedPosition: false,
        collidingTargets: [],
        atk: characterDataObj["Surtr"].atk,
        maxHp: characterDataObj["Surtr"].hp,
        hp: characterDataObj["Surtr"].hp,
        justCompletedSkillLoop: false
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
            surtrHitbox.x - (surtrData.damageHitbox.width) :
            surtrHitbox.x + surtrHitbox.width,
        y: surtrData.groundY + surtrData.damageHitbox.offsetY - surtrData.damageHitbox.height / 2 + 258,
        width: surtrData.damageHitbox.width,
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
            surtrHitbox.x - (surtrData.damageHitbox.width) :
            surtrHitbox.x + surtrHitbox.width,
        y: surtrData.groundY + surtrData.damageHitbox.offsetY - surtrData.damageHitbox.height / 2 + 258,
        width: surtrData.damageHitbox.width,
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
        surtrDamageHitbox.y + surtrData.damageHitbox.height > enemyHitbox.y;

    return isColliding;
}

function getAllCollidingEnemies(surtrData, enemies) {
    if (!surtrData.damageHitbox || !isFinite(surtrData.worldX)) {
        return [];
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
            surtrHitbox.x - (surtrData.damageHitbox.width) :
            surtrHitbox.x + surtrHitbox.width,
        y: surtrData.groundY + surtrData.damageHitbox.offsetY - surtrData.damageHitbox.height / 2 + 258,
        width: surtrData.damageHitbox.width,
        height: surtrData.damageHitbox.height - 75
    };

    const collidingEnemies = [];
    enemies.forEach(enemy => {
        if (enemy && enemy.hp > 0) {
            const enemyHitbox = {
                x: isFinite(enemy.worldX + enemy.hitbox.offsetX * (enemy.skeleton.scaleX || 1) - enemy.hitbox.width / 2) ?
                    enemy.worldX + enemy.hitbox.offsetX * (enemy.skeleton.scaleX || 1) - enemy.hitbox.width / 2 :
                    enemy.worldX,
                y: enemy.groundY + 220 + enemy.hitbox.offsetY - enemy.hitbox.height / 2,
                width: enemy.hitbox.width,
                height: enemy.hitbox.height
            };

            const isColliding = surtrDamageHitbox.x < enemyHitbox.x + enemyHitbox.width &&
                surtrDamageHitbox.x + surtrDamageHitbox.width > enemyHitbox.x &&
                surtrDamageHitbox.y < enemyHitbox.y + enemyHitbox.height &&
                surtrDamageHitbox.y + surtrData.damageHitbox.height > enemyHitbox.y;

            if (isColliding) {
                collidingEnemies.push(enemy);
            }
        }
    });

    return collidingEnemies;
}

function calculateSetupPoseBounds(skeleton) {
    skeleton.setToSetupPose();
    skeleton.updateWorldTransform();
    const offset = new spine.Vector2(), size = new spine.Vector2();
    skeleton.getBounds(offset, size, []);
    return { offset, size };
}

function switchSkeletonFile(surtrData, newSkelPath, newAtlasPath, initialAnimation, callback) {
    if (surtrData.isSwitchingSkeleton) {
        // console.log(`Surtr tại worldX=${surtrData.worldX} đang switching, bỏ qua yêu cầu chuyển sang ${initialAnimation}`);
        if (callback) callback(false);
        return false;
    }

    if (surtrData.currentSkelPath === newSkelPath && surtrData.currentAtlasPath === newAtlasPath) {
        const animationToUse = surtrData.skeleton.data.animations.find(anim => anim.name.toLowerCase() === initialAnimation.toLowerCase())?.name;
        if (animationToUse) {
            // console.log(`Surtr tại worldX=${surtrData.worldX}: Skeleton đã khớp, chuyển sang animation ${animationToUse}`);
            surtrData.state.setAnimation(0, animationToUse, initialAnimation.toLowerCase() === "die" || initialAnimation.toLowerCase() === "skill_3_begin" ? false : true);
            if (callback) callback(true);
            return true;
        } else {
            // console.error(`Surtr tại worldX=${surtrData.worldX}: Animation ${initialAnimation} không tồn tại trong ${newSkelPath}. Available: ${surtrData.skeleton.data.animations.map(a => a.name).join(", ")}`);
            if (callback) callback(false);
            return false;
        }
    }

    surtrData.isSwitchingSkeleton = true;
    // console.log(`Surtr tại worldX=${surtrData.worldX}: Bắt đầu chuyển skeleton sang ${initialAnimation} với skelPath=${newSkelPath}`);

    let skelData = assetManager.get(newSkelPath);
    let atlasData = assetManager.get(newAtlasPath);

    let retryCount = 0;
    const maxRetries = 10;
    function attemptSwitch() {
        if (retryCount >= maxRetries) {
            // console.error(`Surtr tại worldX=${surtrData.worldX}: Không thể chuyển skeleton sau ${maxRetries} lần thử cho ${initialAnimation}`);
            surtrData.isSwitchingSkeleton = false;
            if (callback) callback(false);
            return;
        }

        skelData = assetManager.get(newSkelPath);
        atlasData = assetManager.get(newAtlasPath);
        if (skelData && atlasData && assetManager.isLoadingComplete()) {
            try {
                const atlas = atlasData;
                if (!atlas) {
                    // console.error(`Surtr tại worldX=${surtrData.worldX}: Atlas không tồn tại tại ${newAtlasPath}`);
                    surtrData.isSwitchingSkeleton = false;
                    if (callback) callback(false);
                    return;
                }
                const atlasLoader = new spine.AtlasAttachmentLoader(atlas);
                const skeletonBinary = new spine.SkeletonBinary(atlasLoader);
                skeletonBinary.scale = 0.3;

                const binaryData = skelData;
                if (!binaryData) {
                    // console.error(`Surtr tại worldX=${surtrData.worldX}: Skeleton data không tồn tại tại ${newSkelPath}`);
                    surtrData.isSwitchingSkeleton = false;
                    if (callback) callback(false);
                    return;
                }
                const newSkeletonData = skeletonBinary.readSkeletonData(binaryData);
                if (!newSkeletonData) {
                    // console.error(`Surtr tại worldX=${surtrData.worldX}: Không thể đọc skeleton data từ ${newSkelPath}`);
                    surtrData.isSwitchingSkeleton = false;
                    if (callback) callback(false);
                    return;
                }

                const animationToUse = newSkeletonData.animations.find(anim => anim.name.toLowerCase() === initialAnimation.toLowerCase())?.name;
                if (!animationToUse) {
                    // console.error(`Surtr tại worldX=${surtrData.worldX}: Animation ${initialAnimation} không tìm thấy trong ${newSkelPath}. Available: ${newSkeletonData.animations.map(a => a.name).join(", ")}`);
                    surtrData.isSwitchingSkeleton = false;
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
                animationState.setAnimation(0, animationToUse, initialAnimation.toLowerCase() === "die" || initialAnimation.toLowerCase() === "skill_3_begin" ? false : true);

                animationState.addListener({
                    event: function (trackIndex, event) {
                        if (event.data.name === "OnAttack" && surtrData.isInAttackState && surtrData) {
                            let atk = surtrData.atk;
                            surtrData.collidingTargets.forEach(target => {
                                if (target.hp > 0) {
                                    let damage;
                                    let targetRes = 0;
                                    let damageTextX = 0;

                                    if (target.type) {
                                        targetRes = characterDataObj[target.type]?.res || 0;
                                        damageTextX = target.worldX;
                                    } else {
                                        targetRes = target.res || 0;
                                        damageTextX = target.x + target.hitbox.offsetX;
                                    }

                                    damage = Math.round(Math.max(0, atk * (1 - (targetRes / 100))));
                                    target.hp = Math.max(0, target.hp - damage);
                                    createDamageText(damageTextX, GROUND_Y + (target.type ? 300 : 200), damage, 'purple');
                                }
                            });
                        }
                    },
                    complete: function (trackIndex, count) {
                        const currentAnimation = animationState.getCurrent(0)?.animation?.name.toLowerCase();
                        if (surtrData.isInStartAnimation && !surtrData.isDead) {
                            surtrData.isInStartAnimation = false;
                            switchSkeletonFile(
                                surtrData,
                                "assets/operators/Surtr/SurtrSummer/surtr_summer.skel",
                                "assets/operators/Surtr/SurtrSummer/surtr_summer.atlas",
                                "Move",
                                (success) => {
                                    if (success) {
                                        console.log("Surtr switched to Move animation from Start");
                                    } else {
                                        console.error("Failed to switch to Move skeleton for Surtr");
                                        surtrData.state.setAnimation(0, "Move", true);
                                    }
                                }
                            );
                        }
                        if (currentAnimation === "skill_3_begin" && !surtrData.isDead && surtrData.isInSkill3State) {
                            surtrData.state.setAnimation(0, "Skill_3_Loop", true);
                            // console.log(`Surtr tại worldX=${surtrData.worldX} switched to Skill_3_Loop after Skill_3_Begin`);
                        }
                        if (surtrData.isDead && currentAnimation === "die") {
                            surtrData.deathAnimationComplete = true;
                        }
                        if (currentAnimation === "attack" || currentAnimation === "skill_3_loop") {
                            surtrData.isInAttackState = false;
                            if (currentAnimation === "skill_3_loop") {
                                surtrData.isInSkill3State = false;
                                surtrData.justCompletedSkillLoop = true;
                            }
                            // console.log(`Surtr tại worldX=${surtrData.worldX} reset states after ${currentAnimation} cycle complete`);
                        }
                    }
                });

                const newBounds = calculateSetupPoseBounds(newSkeleton);
                surtrData.skeleton = newSkeleton;
                surtrData.state = animationState;
                surtrData.bounds = newBounds;
                if (!surtrData.damageHitbox) {
                    surtrData.damageHitbox = { ...fixedDamageHitbox };
                }
                surtrData.currentSkelPath = newSkelPath;
                surtrData.currentAtlasPath = newAtlasPath;
                surtrData.isSwitchingSkeleton = false;
                // console.log(`Surtr tại worldX=${surtrData.worldX}: Chuyển skeleton thành công sang ${initialAnimation}`);
                if (callback) callback(true);
            } catch (e) {
                // console.error(`Surtr tại worldX=${surtrData.worldX}: Lỗi khi chuyển skeleton sang ${initialAnimation}: ${e.message}`);
                surtrData.isSwitchingSkeleton = false;
                if (callback) callback(false);
            }
        } else {
            retryCount++;
            // console.log(`Surtr tại worldX=${surtrData.worldX}: Thử lại lần ${retryCount}/${maxRetries} để chuyển skeleton sang ${initialAnimation}`);
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

    if (!surtrData.isDead) {
        surtrData.deployTime += delta;
        if (surtrData.deployTime >= 10 && !surtrData.hasExpandedHitbox) {
            surtrData.damageHitbox.width *= 3;
            surtrData.hasExpandedHitbox = true;
            // console.log(`Surtr tại worldX=${surtrData.worldX} đã mở rộng damageHitbox gấp 3 sau ${surtrData.deployTime.toFixed(2)} giây`);

            surtrData.hp = surtrData.maxHp;
            surtrData.atk = Math.round(surtrData.atk + surtrData.atk * 3.3);
            surtrData.maxHp += 5000;
            surtrData.hp += 5000;
            console.log(`Surtr tại worldX=${surtrData.worldX} đã buff: atk=${surtrData.atk}, maxHp=${surtrData.maxHp}, hp=${surtrData.hp}`);

            // Thêm: Force switch sang skill nếu đang attack mà chưa ở skill state
            if (surtrData.isInAttackState && !surtrData.isInSkill3State && !surtrData.isSwitchingSkeleton) {
                // console.log(`Surtr tại worldX=${surtrData.worldX} force chuyển từ Attack sang Skill_3_Begin sau 10s`);
                // Force end current animation loop để tránh chờ complete
                const currentTrack = surtrData.state.getCurrent(0);
                if (currentTrack) {
                    currentTrack.loop = false;  // Dừng loop để trigger complete ngay cycle này
                }
                // Switch ngay sang Skill_3_Begin
                switchSkeletonFile(
                    surtrData,
                    "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel",
                    "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas",
                    "Skill_3_Begin",
                    (success) => {
                        if (success) {
                            surtrData.isInAttackState = true;
                            surtrData.isInSkill3State = true;
                            surtrData.justCompletedSkillLoop = false;
                        } else {
                            // console.error(`Failed to force switch to Skill_3_Begin for Surtr`);
                        }
                    }
                );
            }
        }
    }

    if (surtrData.hp <= 0 && !surtrData.isDead && !surtrData.isSwitchingSkeleton) {
        // console.log(`Surtr tại worldX=${surtrData.worldX} đã chết, chuyển sang animation Die`);
        surtrData.isDead = true;
        surtrData.isInAttackState = false;
        surtrData.isInSkill3State = false;
        surtrData.isInStartAnimation = false;
        surtrData.velocity = 0;
        switchSkeletonFile(
            surtrData,
            "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel",
            "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas",
            "Die",
            (success) => {
                if (success) {
                    // console.log(`Surtr tại worldX=${surtrData.worldX} chuyển sang animation Die thành công`);
                } else {
                    // console.error(`Không thể chuyển sang animation Die cho Surtr tại worldX=${surtrData.worldX}`);
                    surtrData.deathAnimationComplete = true;
                }
            }
        );
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
                    surtrHitbox.x - (damageHitbox.width) :
                    surtrHitbox.x + surtrHitbox.width) : worldX,
            y: damageHitbox ? GROUND_Y + damageHitbox.offsetY - damageHitbox.height / 2 + 258 : GROUND_Y + 258,
            width: damageHitbox ? damageHitbox.width : 50,
            height: damageHitbox ? damageHitbox.height - 75 : 125
        };

        if (!surtrData.hasLoggedPosition) {
            // console.log(`Vị trí Surtr: worldX=${worldX}, y=${skeleton.y}, direction=${surtrData.direction}`);
            surtrData.hasLoggedPosition = true;
        }

        const validEnemies = Array.isArray(enemies) ? enemies.filter(e => e && e.hp > 0) : [];

        const collidingEnemies = getAllCollidingEnemies(surtrData, validEnemies);
        const isCollidingWithEnemyFlag = collidingEnemies.length > 0;

        surtrData.collidingTargets = [...collidingEnemies];

        const targetTower = surtrData.tower;
        if (isCollidingWithTower(surtrData, targetTower)) {
            surtrData.collidingTargets.push(targetTower);
        }

        const towerHitbox = {
            x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
            y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
            width: targetTower.hitbox.width,
            height: targetTower.hitbox.height
        };

        const isColliding = isCollidingWithTower(surtrData, targetTower);

        let isBlockedByFrontAlly = false;
        let frontAlly = null;
        let closestFrontDistance = Infinity;

        for (let otherAlly of allAllies) {
            if (otherAlly !== surtrData && !otherAlly.isDead) {
                const isInFront = surtrData.direction === 1 ?
                    otherAlly.worldX > surtrData.worldX :
                    otherAlly.worldX < surtrData.worldX;

                if (isInFront) {
                    const otherHitbox = {
                        x: otherAlly.worldX + otherAlly.hitbox.offsetX * (otherAlly.skeleton.scaleX || 1) - otherAlly.hitbox.width / 2,
                        y: GROUND_Y + 220 + otherAlly.hitbox.offsetY - otherAlly.hitbox.height / 2,
                        width: otherAlly.hitbox.width,
                        height: otherAlly.hitbox.height
                    };

                    const isTouchingFront = surtrData.direction === 1 ?
                        surtrHitbox.x + surtrHitbox.width >= otherHitbox.x :
                        surtrHitbox.x <= otherHitbox.x + otherHitbox.width;

                    if (isTouchingFront) {
                        const frontAnimation = otherAlly.state.getCurrent(0)?.animation?.name.toLowerCase() || "";
                        const isFrontAttackingOrIdle = frontAnimation.includes("attack") ||
                            frontAnimation.includes("idle") ||
                            frontAnimation.includes("skill") ||
                            otherAlly.isInAttackState ||
                            otherAlly.isInSkill3State;

                        if (isFrontAttackingOrIdle) {
                            const distance = Math.abs(surtrData.worldX - otherAlly.worldX);
                            if (distance < closestFrontDistance) {
                                closestFrontDistance = distance;
                                isBlockedByFrontAlly = true;
                                frontAlly = otherAlly;
                            }
                        }
                    }
                }
            }
        }

        if (!surtrData.isInStartAnimation && !surtrData.isDead && !surtrData.isSwitchingSkeleton) {
            const currentSkelIsWeapon = surtrData.currentSkelPath.includes("weapon");
            const shouldAttack = isCollidingWithEnemyFlag || isColliding;
            const shouldMove = !shouldAttack && !isBlockedByFrontAlly;
            const shouldIdle = !shouldAttack && isBlockedByFrontAlly;

            if (shouldAttack && !surtrData.isInAttackState && !surtrData.isInSkill3State) {
                const canUseSkill3 = surtrData.deployTime >= 10;
                let attackAnimation = canUseSkill3 ? "Skill_3_Begin" : "Attack";
                if (canUseSkill3 && surtrData.justCompletedSkillLoop) {
                    attackAnimation = "Skill_3_Loop";
                    surtrData.justCompletedSkillLoop = false;
                }
                // console.log(`Surtr tại worldX=${surtrData.worldX} tấn công ${isCollidingWithEnemyFlag ? 'enemy' : 'tower'}, dùng ${attackAnimation}`);

                switchSkeletonFile(
                    surtrData,
                    "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel",
                    "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas",
                    attackAnimation,
                    (success) => {
                        if (success) {
                            surtrData.isInAttackState = true;
                            surtrData.isInSkill3State = canUseSkill3;
                            surtrData.velocity = 0;
                            surtrData.justCompletedSkillLoop = false;
                        }
                    }
                );
            } else if (!surtrData.isInAttackState && !surtrData.isInSkill3State) {
                if (shouldIdle) {
                    // console.log(`Surtr tại worldX=${surtrData.worldX} bị chặn bởi ally phía trước, chuyển Idle`);
                    switchSkeletonFile(
                        surtrData,
                        "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel",
                        "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas",
                        "Idle",
                        (success) => {
                            if (success) {
                                surtrData.isInAttackState = false;
                                surtrData.isInSkill3State = false;
                                surtrData.velocity = 0;
                                // console.log(`Surtr tại worldX=${surtrData.worldX} reset states sang Idle`);
                            }
                        }
                    );
                } else if (shouldMove && currentSkelIsWeapon) {
                    // console.log(`Surtr tại worldX=${surtrData.worldX} có thể di chuyển, chuyển về Move`);
                    switchSkeletonFile(
                        surtrData,
                        "assets/operators/Surtr/SurtrSummer/surtr_summer.skel",
                        "assets/operators/Surtr/SurtrSummer/surtr_summer.atlas",
                        "Move",
                        (success) => {
                            if (success) {
                                surtrData.isInAttackState = false;
                                surtrData.isInSkill3State = false;
                                surtrData.velocity = 50;
                            }
                        }
                    );
                }
            } else if (!shouldAttack && (surtrData.isInAttackState || surtrData.isInSkill3State)) {
                const currentTrack = surtrData.state.getCurrent(0);
                if (currentTrack) {
                    currentTrack.loop = false;
                }
                // console.log(`Force end current attack anim because !shouldAttack`);
            }
        }

        if (!surtrData.isInStartAnimation && !surtrData.isDead) {
            if (!isCollidingWithEnemyFlag && !isColliding && !isBlockedByFrontAlly && !surtrData.isSwitchingSkeleton && !surtrData.isInAttackState && !surtrData.isInSkill3State) {
                surtrData.worldX += surtrData.velocity * delta * surtrData.direction;
            } else if (isBlockedByFrontAlly && frontAlly) {
                const otherHitbox = {
                    x: frontAlly.worldX + frontAlly.hitbox.offsetX * (frontAlly.skeleton.scaleX || 1) - frontAlly.hitbox.width / 2,
                    y: GROUND_Y + 220 + frontAlly.hitbox.offsetY - frontAlly.hitbox.height / 2,
                    width: frontAlly.hitbox.width,
                    height: frontAlly.hitbox.height
                };

                if (surtrData.direction === 1) {
                    const targetX = otherHitbox.x - surtrData.hitbox.width / 2 - hitbox.offsetX * (skeleton.scaleX || 1);
                    surtrData.worldX = Math.max(surtrData.worldX, targetX);
                } else {
                    const targetX = otherHitbox.x + otherHitbox.width + surtrData.hitbox.width / 2 - surtrData.hitbox.offsetX * (surtrData.skeleton.scaleX || 1);
                    surtrData.worldX = Math.min(surtrData.worldX, targetX);
                }
            }
        }

        if (surtrData.direction === 1 && surtrData.worldX > towerHitbox.x - hitbox.width) {
            surtrData.worldX = towerHitbox.x - hitbox.width;
        } else if (surtrData.direction === -1 && surtrData.worldX < towerHitbox.x + towerHitbox.width) {
            surtrData.worldX = towerHitbox.x + towerHitbox.width;
        }

        skeleton.x = surtrData.worldX - camera.x;
        skeleton.y = canvas.height - (GROUND_Y + 425);
        skeleton.scaleX = surtrData.direction;
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
        if (existing.isDead) continue;
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