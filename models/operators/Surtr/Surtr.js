import { characterDataObj } from '../../../character.js';
import { createDamageText, GROUND_Y } from '../../../render.js';

let shader, batcher, mvp, skeletonRenderer, assetManager;
let currentSkelPath = "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel";
let currentAtlasPath = "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas";
let isSwitchingSkeleton = false;
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
    if (!atlas) {
        console.error(`Atlas không tồn tại tại ${currentAtlasPath}`);
        return null;
    }

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
            if (event.data.name !== "OnAttack") return;
            if (!(surtrData.isInAttackState || surtrData.isInSkill3State)) return;

            const atk = surtrData.atk;

            // SAU 10s: AOE toàn bộ trong tầm
            if (surtrData.isSkill3Active) {
                const enemies = Array.isArray(surtrData.enemies) ? surtrData.enemies : [];
                enemies.forEach(enemy => {
                    if (enemy && enemy.hp > 0 && isCollidingWithEnemy(surtrData, enemy)) {
                        const res = characterDataObj[enemy.type]?.res || 0;
                        const damage = Math.round(Math.max(0, atk * (1 - res / 100)));
                        enemy.hp = Math.max(0, enemy.hp - damage);
                        createDamageText(enemy.worldX, GROUND_Y + 300, damage, 'purple');
                    }
                });

                // Đánh tháp nếu trong tầm
                const tower = surtrData.tower;
                if (tower && isCollidingWithTower(surtrData, tower)) {
                    const res = tower.res || 0;
                    const damage = Math.round(Math.max(0, atk * (1 - res / 100)));
                    tower.hp = Math.max(0, tower.hp - damage);
                    createDamageText(tower.x + tower.hitbox.offsetX, GROUND_Y + 200, damage, 'purple');
                }
            }
            // TRƯỚC 10s: đánh đơn như cũ
            else {
                if (surtrData.target && surtrData.isAttackingEnemy) {
                    const res = characterDataObj[surtrData.target.type]?.res || 0;
                    const damage = (Math.max(0, atk * (1 - res / 100)));
                    surtrData.target.hp = Math.max(0, surtrData.target.hp - damage);
                    createDamageText(surtrData.target.worldX, GROUND_Y + 300, damage, 'purple');
                    if (surtrData.target.hp <= 0) surtrData.target = null;
                } else {
                    const tower = surtrData.tower;
                    if (tower && isCollidingWithTower(surtrData, tower)) {
                        const res = tower.res || 0;
                        const damage = (Math.max(0, atk * (1 - res / 100)));
                        tower.hp = Math.max(0, tower.hp - damage);
                        createDamageText(tower.x + tower.hitbox.offsetX, GROUND_Y + 200, damage, 'purple');
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
                            surtrData.currentAnimation = "move";
                        } else {
                            console.error("Failed to switch to Move skeleton for Surtr");
                            surtrData.state.setAnimation(0, "Move", true);
                            surtrData.currentAnimation = "move";
                        }
                    }
                );
            }
            if (surtrData.isDead && currentAnimation === "die") {
                surtrData.deathAnimationComplete = true;
            }
            if (currentAnimation === "attack" && !surtrData.isDead && !surtrData.isHitboxScaled) {
                const surtrHitbox = {
                    x: isFinite(surtrData.worldX + surtrData.hitbox.offsetX * (surtrData.skeleton.scaleX || 1) - surtrData.hitbox.width / 2) ?
                        surtrData.worldX + surtrData.hitbox.offsetX * (surtrData.skeleton.scaleX || 1) - surtrData.hitbox.width / 2 :
                        surtrData.worldX,
                    y: GROUND_Y + 220 + surtrData.hitbox.offsetY - surtrData.hitbox.height / 2,
                    width: surtrData.hitbox.width,
                    height: surtrData.hitbox.height
                };

                const validEnemies = Array.isArray(surtrData.enemies) ? surtrData.enemies : [];
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
                const isCollidingTower = isCollidingWithTower(surtrData, surtrData.tower);
                let isBlockedByFrontAlly = false;
                const bufferDistance = 5;
                for (let otherAlly of surtrData.allAllies || []) {
                    if (otherAlly !== surtrData &&
                        (surtrData.direction === 1 ? otherAlly.worldX > surtrData.worldX : otherAlly.worldX < surtrData.worldX)) {
                        const otherHitbox = {
                            x: otherAlly.worldX + otherAlly.hitbox.offsetX * (otherAlly.skeleton.scaleX || 1) - otherAlly.hitbox.width / 2,
                            y: GROUND_Y + 220 + otherAlly.hitbox.offsetY - otherAlly.hitbox.height / 2,
                            width: otherAlly.hitbox.width,
                            height: otherAlly.hitbox.height
                        };
                        if (surtrData.direction === 1 ?
                            surtrHitbox.x + surtrHitbox.width >= otherHitbox.x - bufferDistance :
                            surtrHitbox.x <= otherHitbox.x + otherHitbox.width + bufferDistance) {
                            const frontAnimation = otherAlly.state.getCurrent(0)?.animation?.name.toLowerCase() || "";
                            if (frontAnimation === "attack" || frontAnimation === "idle" || frontAnimation === "skill_3_loop" || frontAnimation === "skill_3_idle" || otherAlly.isInAttackState || otherAlly.isInSkill3State) {
                                isBlockedByFrontAlly = true;
                                break;
                            }
                        }
                    }
                }

                if (isCollidingWithEnemyFlag || isCollidingTower) {
                    surtrData.target = closestEnemy ? closestEnemy : surtrData.tower;
                    surtrData.isAttackingEnemy = !!closestEnemy;
                    animationState.setAnimation(0, "Attack", false);
                    surtrData.currentAnimation = "attack";
                } else if (isBlockedByFrontAlly) {
                    switchSkeletonFile(
                        surtrData,
                        "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel",
                        "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas",
                        "Idle",
                        (success) => {
                            if (success) {
                                surtrData.isInAttackState = false;
                                surtrData.currentAnimation = "idle";
                                console.log("Surtr switched to Idle animation");
                            } else {
                                console.error("Failed to switch to Idle skeleton for Surtr");
                                animationState.setAnimation(0, "Move", true);
                                surtrData.currentAnimation = "move";
                            }
                        }
                    );
                } else {
                    switchSkeletonFile(
                        surtrData,
                        "assets/operators/Surtr/SurtrSummer/surtr_summer.skel",
                        "assets/operators/Surtr/SurtrSummer/surtr_summer.atlas",
                        "Move",
                        (success) => {
                            if (success) {
                                surtrData.isInAttackState = false;
                                surtrData.currentAnimation = "move";
                                surtrData.velocity = 50;
                                console.log("Surtr switched to Move animation from Attack");
                            } else {
                                console.error("Failed to switch to Move skeleton for Surtr");
                                animationState.setAnimation(0, "Move", true);
                                surtrData.currentAnimation = "move";
                            }
                        }
                    );
                }
            }
            if (currentAnimation === "skill_3_begin" && !surtrData.isDead) {
                const validEnemies = Array.isArray(surtrData.enemies) ? surtrData.enemies : [];
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
                const isCollidingTower = isCollidingWithTower(surtrData, surtrData.tower);
                if (isCollidingWithEnemyFlag || isCollidingTower) {
                    surtrData.target = closestEnemy ? closestEnemy : surtrData.tower;
                    surtrData.isAttackingEnemy = !!closestEnemy;
                    animationState.setAnimation(0, "Skill_3_Loop", true);
                    surtrData.currentAnimation = "skill_3_loop";
                } else {
                    switchSkeletonFile(
                        surtrData,
                        "assets/operators/Surtr/SurtrSummer/surtr_summer.skel",
                        "assets/operators/Surtr/SurtrSummer/surtr_summer.atlas",
                        "Move",
                        (success) => {
                            if (success) {
                                surtrData.isInSkill3State = false;
                                surtrData.currentAnimation = "move";
                                surtrData.velocity = 50;
                            } else {
                                console.error("Failed to switch to Move skeleton for Surtr");
                                animationState.setAnimation(0, "Move", true);
                                surtrData.currentAnimation = "move";
                            }
                        }
                    );
                }
            }
            if (currentAnimation === "skill_3_loop" && !surtrData.isDead) {
                const surtrHitbox = {
                    x: isFinite(surtrData.worldX + surtrData.hitbox.offsetX * (surtrData.skeleton.scaleX || 1) - surtrData.hitbox.width / 2) ?
                        surtrData.worldX + surtrData.hitbox.offsetX * (surtrData.skeleton.scaleX || 1) - surtrData.hitbox.width / 2 :
                        surtrData.worldX,
                    y: GROUND_Y + 220 + surtrData.hitbox.offsetY - surtrData.hitbox.height / 2,
                    width: surtrData.hitbox.width,
                    height: surtrData.hitbox.height
                };

                const validEnemies = Array.isArray(surtrData.enemies) ? surtrData.enemies : [];
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
                const isCollidingTower = isCollidingWithTower(surtrData, surtrData.tower);
                let isBlockedByFrontAlly = false;
                const bufferDistance = 5;
                for (let otherAlly of surtrData.allAllies || []) {
                    if (otherAlly !== surtrData &&
                        (surtrData.direction === 1 ? otherAlly.worldX > surtrData.worldX : otherAlly.worldX < surtrData.worldX)) {
                        const otherHitbox = {
                            x: otherAlly.worldX + otherAlly.hitbox.offsetX * (otherAlly.skeleton.scaleX || 1) - otherAlly.hitbox.width / 2,
                            y: GROUND_Y + 220 + otherAlly.hitbox.offsetY - otherAlly.hitbox.height / 2,
                            width: otherAlly.hitbox.width,
                            height: otherAlly.hitbox.height
                        };
                        if (surtrData.direction === 1 ?
                            surtrHitbox.x + surtrHitbox.width >= otherHitbox.x - bufferDistance :
                            surtrHitbox.x <= otherHitbox.x + otherHitbox.width + bufferDistance) {
                            const frontAnimation = otherAlly.state.getCurrent(0)?.animation?.name.toLowerCase() || "";
                            if (frontAnimation === "attack" || frontAnimation === "idle" || frontAnimation === "skill_3_loop" || frontAnimation === "skill_3_idle" || otherAlly.isInAttackState || otherAlly.isInSkill3State) {
                                isBlockedByFrontAlly = true;
                                break;
                            }
                        }
                    }
                }

                if (isCollidingWithEnemyFlag || isCollidingTower) {
                    surtrData.target = closestEnemy ? closestEnemy : surtrData.tower;
                    surtrData.isAttackingEnemy = !!closestEnemy;
                    animationState.setAnimation(0, "Skill_3_Loop", true);
                    surtrData.currentAnimation = "skill_3_loop";
                } else if (isBlockedByFrontAlly) {
                    switchSkeletonFile(
                        surtrData,
                        "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel",
                        "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas",
                        "Idle",
                        (success) => {
                            if (success) {
                                surtrData.isInSkill3State = false;
                                surtrData.currentAnimation = "idle";
                                console.log("Surtr switched to Idle animation");
                            } else {
                                console.error("Failed to switch to Idle skeleton for Surtr");
                                animationState.setAnimation(0, "Move", true);
                                surtrData.currentAnimation = "move";
                            }
                        }
                    );
                } else {
                    switchSkeletonFile(
                        surtrData,
                        "assets/operators/Surtr/SurtrSummer/surtr_summer.skel",
                        "assets/operators/Surtr/SurtrSummer/surtr_summer.atlas",
                        "Move",
                        (success) => {
                            if (success) {
                                surtrData.isInSkill3State = false;
                                surtrData.currentAnimation = "move";
                                surtrData.velocity = 50;
                            } else {
                                console.error("Failed to switch to Move skeleton for Surtr");
                                animationState.setAnimation(0, "Move", true);
                                surtrData.currentAnimation = "move";
                            }
                        }
                    );
                }
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
        damageHitbox: fixedDamageHitbox,
        tower: null,
        isInAttackState: false,
        isInSkill3State: false,
        isInStartAnimation: true,
        currentSkelPath: "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel",
        currentAtlasPath: "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas",
        direction: 1,
        velocity: 0,
        target: null,
        isAttackingEnemy: false,
        isDead: false,
        deathAnimationTimer: 0,
        deathAnimationComplete: false,
        groundY: GROUND_Y,
        type: "Surtr",
        enemies: [],
        allAllies: [],
        currentAnimation: "start",
        hitboxTimer: 0,
        isHitboxScaled: false,
        isSkill3Active: false,
        skill3Timer: 60,
        atk: characterDataObj["Surtr"].atk,
        maxHp: characterDataObj["Surtr"].hp,
        hp: characterDataObj["Surtr"].hp
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
            const isLoop = (initialAnimation.toLowerCase() !== "die" && initialAnimation.toLowerCase() !== "attack" && initialAnimation.toLowerCase() !== "start" && initialAnimation.toLowerCase() !== "skill_3_begin");
            surtrData.state.setAnimation(0, animationToUse, isLoop);
            surtrData.currentAnimation = animationToUse.toLowerCase();
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
                const isLoop = (initialAnimation.toLowerCase() !== "die" && initialAnimation.toLowerCase() !== "attack" && initialAnimation.toLowerCase() !== "start" && initialAnimation.toLowerCase() !== "skill_3_begin");
                animationState.setAnimation(0, animationToUse, isLoop);
                surtrData.currentAnimation = animationToUse.toLowerCase();

                animationState.addListener({
                    event: function (trackIndex, event) {
                        if (event.data.name !== "OnAttack") return;
                        if (!(surtrData.isInAttackState || surtrData.isInSkill3State)) return;

                        const atk = surtrData.atk;

                        // SAU 10s: AOE toàn bộ trong tầm
                        if (surtrData.isSkill3Active) {
                            const enemies = Array.isArray(surtrData.enemies) ? surtrData.enemies : [];
                            enemies.forEach(enemy => {
                                if (enemy && enemy.hp > 0 && isCollidingWithEnemy(surtrData, enemy)) {
                                    const res = characterDataObj[enemy.type]?.res || 0;
                                    const damage = Math.round(Math.max(0, atk * (1 - res / 100)));
                                    enemy.hp = Math.max(0, enemy.hp - damage);
                                    createDamageText(enemy.worldX, GROUND_Y + 300, damage, 'purple');
                                }
                            });

                            // Đánh tháp nếu trong tầm
                            const tower = surtrData.tower;
                            if (tower && isCollidingWithTower(surtrData, tower)) {
                                const res = tower.res || 0;
                                const damage = Math.round(Math.max(0, atk * (1 - res / 100)));
                                tower.hp = Math.max(0, tower.hp - damage);
                                createDamageText(tower.x + tower.hitbox.offsetX, GROUND_Y + 200, damage, 'purple');
                            }
                        }
                        // TRƯỚC 10s: đánh đơn như cũ
                        else {
                            if (surtrData.target && surtrData.isAttackingEnemy) {
                                const res = characterDataObj[surtrData.target.type]?.res || 0;
                                const damage = (Math.max(0, atk * (1 - res / 100)));
                                surtrData.target.hp = Math.max(0, surtrData.target.hp - damage);
                                createDamageText(surtrData.target.worldX, GROUND_Y + 300, damage, 'purple');
                                if (surtrData.target.hp <= 0) surtrData.target = null;
                            } else {
                                const tower = surtrData.tower;
                                if (tower && isCollidingWithTower(surtrData, tower)) {
                                    const res = tower.res || 0;
                                    const damage = (Math.max(0, atk * (1 - res / 100)));
                                    tower.hp = Math.max(0, tower.hp - damage);
                                    createDamageText(tower.x + tower.hitbox.offsetX, GROUND_Y + 200, damage, 'purple');
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
                                        surtrData.currentAnimation = "move";
                                    } else {
                                        console.error("Failed to switch to Move skeleton for Surtr");
                                        surtrData.state.setAnimation(0, "Move", true);
                                        surtrData.currentAnimation = "move";
                                    }
                                }
                            );
                        }
                        if (surtrData.isDead && currentAnimation === "die") {
                            surtrData.deathAnimationComplete = true;
                        }
                        if (currentAnimation === "attack" && !surtrData.isDead && !surtrData.isHitboxScaled) {
                            const surtrHitbox = {
                                x: isFinite(surtrData.worldX + surtrData.hitbox.offsetX * (surtrData.skeleton.scaleX || 1) - surtrData.hitbox.width / 2) ?
                                    surtrData.worldX + surtrData.hitbox.offsetX * (surtrData.skeleton.scaleX || 1) - surtrData.hitbox.width / 2 :
                                    surtrData.worldX,
                                y: GROUND_Y + 220 + surtrData.hitbox.offsetY - surtrData.hitbox.height / 2,
                                width: surtrData.hitbox.width,
                                height: surtrData.hitbox.height
                            };

                            const validEnemies = Array.isArray(surtrData.enemies) ? surtrData.enemies : [];
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
                            const isCollidingTower = isCollidingWithTower(surtrData, surtrData.tower);
                            let isBlockedByFrontAlly = false;
                            const bufferDistance = 5;
                            for (let otherAlly of surtrData.allAllies || []) {
                                if (otherAlly !== surtrData &&
                                    (surtrData.direction === 1 ? otherAlly.worldX > surtrData.worldX : otherAlly.worldX < surtrData.worldX)) {
                                    const otherHitbox = {
                                        x: otherAlly.worldX + otherAlly.hitbox.offsetX * (otherAlly.skeleton.scaleX || 1) - otherAlly.hitbox.width / 2,
                                        y: GROUND_Y + 220 + otherAlly.hitbox.offsetY - otherAlly.hitbox.height / 2,
                                        width: otherAlly.hitbox.width,
                                        height: otherAlly.hitbox.height
                                    };
                                    if (surtrData.direction === 1 ?
                                        surtrHitbox.x + surtrHitbox.width >= otherHitbox.x - bufferDistance :
                                        surtrHitbox.x <= otherHitbox.x + otherHitbox.width + bufferDistance) {
                                        const frontAnimation = otherAlly.state.getCurrent(0)?.animation?.name.toLowerCase() || "";
                                        if (frontAnimation === "attack" || frontAnimation === "idle" || frontAnimation === "skill_3_loop" || frontAnimation === "skill_3_idle" || otherAlly.isInAttackState || otherAlly.isInSkill3State) {
                                            isBlockedByFrontAlly = true;
                                            break;
                                        }
                                    }
                                }
                            }

                            if (isCollidingWithEnemyFlag || isCollidingTower) {
                                surtrData.target = closestEnemy ? closestEnemy : surtrData.tower;
                                surtrData.isAttackingEnemy = !!closestEnemy;
                                animationState.setAnimation(0, "Attack", false);
                                surtrData.currentAnimation = "attack";
                            } else if (isBlockedByFrontAlly) {
                                switchSkeletonFile(
                                    surtrData,
                                    "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel",
                                    "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas",
                                    "Idle",
                                    (success) => {
                                        if (success) {
                                            surtrData.isInAttackState = false;
                                            surtrData.currentAnimation = "idle";
                                            console.log("Surtr switched to Idle animation");
                                        } else {
                                            console.error("Failed to switch to Idle skeleton for Surtr");
                                            animationState.setAnimation(0, "Move", true);
                                            surtrData.currentAnimation = "move";
                                        }
                                    }
                                );
                            } else {
                                switchSkeletonFile(
                                    surtrData,
                                    "assets/operators/Surtr/SurtrSummer/surtr_summer.skel",
                                    "assets/operators/Surtr/SurtrSummer/surtr_summer.atlas",
                                    "Move",
                                    (success) => {
                                        if (success) {
                                            surtrData.isInAttackState = false;
                                            surtrData.currentAnimation = "move";
                                            surtrData.velocity = 50;
                                        } else {
                                            console.error("Failed to switch to Move skeleton for Surtr");
                                            animationState.setAnimation(0, "Move", true);
                                            surtrData.currentAnimation = "move";
                                        }
                                    }
                                );
                            }
                        }
                        if (currentAnimation === "skill_3_begin" && !surtrData.isDead) {
                            const validEnemies = Array.isArray(surtrData.enemies) ? surtrData.enemies : [];
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
                            const isCollidingTower = isCollidingWithTower(surtrData, surtrData.tower);
                            if (isCollidingWithEnemyFlag || isCollidingTower) {
                                surtrData.target = closestEnemy ? closestEnemy : surtrData.tower;
                                surtrData.isAttackingEnemy = !!closestEnemy;
                                animationState.setAnimation(0, "Skill_3_Loop", true);
                                surtrData.currentAnimation = "skill_3_loop";
                            } else {
                                switchSkeletonFile(
                                    surtrData,
                                    "assets/operators/Surtr/SurtrSummer/surtr_summer.skel",
                                    "assets/operators/Surtr/SurtrSummer/surtr_summer.atlas",
                                    "Move",
                                    (success) => {
                                        if (success) {
                                            surtrData.isInSkill3State = false;
                                            surtrData.currentAnimation = "move";
                                            surtrData.velocity = 50;
                                        } else {
                                            console.error("Failed to switch to Move skeleton for Surtr");
                                            animationState.setAnimation(0, "Move", true);
                                            surtrData.currentAnimation = "move";
                                        }
                                    }
                                );
                            }
                        }
                        if (currentAnimation === "skill_3_loop" && !surtrData.isDead) {
                            const surtrHitbox = {
                                x: isFinite(surtrData.worldX + surtrData.hitbox.offsetX * (surtrData.skeleton.scaleX || 1) - surtrData.hitbox.width / 2) ?
                                    surtrData.worldX + surtrData.hitbox.offsetX * (surtrData.skeleton.scaleX || 1) - surtrData.hitbox.width / 2 :
                                    surtrData.worldX,
                                y: GROUND_Y + 220 + surtrData.hitbox.offsetY - surtrData.hitbox.height / 2,
                                width: surtrData.hitbox.width,
                                height: surtrData.hitbox.height
                            };

                            const validEnemies = Array.isArray(surtrData.enemies) ? surtrData.enemies : [];
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
                            const isCollidingTower = isCollidingWithTower(surtrData, surtrData.tower);
                            let isBlockedByFrontAlly = false;
                            const bufferDistance = 5;
                            for (let otherAlly of surtrData.allAllies || []) {
                                if (otherAlly !== surtrData &&
                                    (surtrData.direction === 1 ? otherAlly.worldX > surtrData.worldX : otherAlly.worldX < surtrData.worldX)) {
                                    const otherHitbox = {
                                        x: otherAlly.worldX + otherAlly.hitbox.offsetX * (otherAlly.skeleton.scaleX || 1) - otherAlly.hitbox.width / 2,
                                        y: GROUND_Y + 220 + otherAlly.hitbox.offsetY - otherAlly.hitbox.height / 2,
                                        width: otherAlly.hitbox.width,
                                        height: otherAlly.hitbox.height
                                    };
                                    if (surtrData.direction === 1 ?
                                        surtrHitbox.x + surtrHitbox.width >= otherHitbox.x - bufferDistance :
                                        surtrHitbox.x <= otherHitbox.x + otherHitbox.width + bufferDistance) {
                                        const frontAnimation = otherAlly.state.getCurrent(0)?.animation?.name.toLowerCase() || "";
                                        if (frontAnimation === "attack" || frontAnimation === "idle" || frontAnimation === "skill_3_loop" || frontAnimation === "skill_3_idle" || otherAlly.isInAttackState || otherAlly.isInSkill3State) {
                                            isBlockedByFrontAlly = true;
                                            break;
                                        }
                                    }
                                }
                            }

                            if (isCollidingWithEnemyFlag || isCollidingTower) {
                                surtrData.target = closestEnemy ? closestEnemy : surtrData.tower;
                                surtrData.isAttackingEnemy = !!closestEnemy;
                                animationState.setAnimation(0, "Skill_3_Loop", true);
                                surtrData.currentAnimation = "skill_3_loop";
                            } else if (isBlockedByFrontAlly) {
                                switchSkeletonFile(
                                    surtrData,
                                    "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel",
                                    "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas",
                                    "Idle",
                                    (success) => {
                                        if (success) {
                                            surtrData.isInSkill3State = false;
                                            surtrData.currentAnimation = "idle";
                                            console.log("Surtr switched to Idle animation");
                                        } else {
                                            console.error("Failed to switch to Idle skeleton for Surtr");
                                            animationState.setAnimation(0, "Move", true);
                                            surtrData.currentAnimation = "move";
                                        }
                                    }
                                );
                            } else {
                                switchSkeletonFile(
                                    surtrData,
                                    "assets/operators/Surtr/SurtrSummer/surtr_summer.skel",
                                    "assets/operators/Surtr/SurtrSummer/surtr_summer.atlas",
                                    "Move",
                                    (success) => {
                                        if (success) {
                                            surtrData.isInSkill3State = false;
                                            surtrData.currentAnimation = "move";
                                            surtrData.velocity = 50;
                                        } else {
                                            console.error("Failed to switch to Move skeleton for Surtr");
                                            animationState.setAnimation(0, "Move", true);
                                            surtrData.currentAnimation = "move";
                                        }
                                    }
                                );
                            }
                        }
                    }
                });

                const newBounds = calculateSetupPoseBounds(newSkeleton);
                surtrData.skeleton = newSkeleton;
                surtrData.state = animationState;
                surtrData.bounds = newBounds;
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

    surtrData.enemies = enemies;
    surtrData.allAllies = allAllies;

    const { skeleton, state, premultipliedAlpha, bounds, worldX, hitbox, damageHitbox } = surtrData;
    state.update(delta);

    // Cập nhật timer cho hitbox và tăng chỉ số
    if (!surtrData.isHitboxScaled && !surtrData.isDead) {
        surtrData.hitboxTimer += delta;
        if (surtrData.hitboxTimer >= surtrData.skill3Timer) {
            surtrData.damageHitbox.width *= 3; // Tăng chiều rộng hitbox cam gấp 3 lần
            surtrData.isHitboxScaled = true;
            surtrData.isSkill3Active = true;

            // Hồi máu và tăng chỉ số
            surtrData.hp = surtrData.maxHp;
            surtrData.atk = Math.round(surtrData.atk + surtrData.atk * 3.3);
            surtrData.maxHp += 5000;
            surtrData.hp += 5000;
            console.log(`Surtr tại worldX=${surtrData.worldX}: Hồi máu đầy (${surtrData.hp}/${surtrData.maxHp}), tăng atk lên ${surtrData.atk}, tăng maxHp lên ${surtrData.maxHp}`);

            // Tìm mục tiêu gần nhất
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
            surtrData.tower = surtrData.direction === 1 ? TOWER_POSITIONS[1] : TOWER_POSITIONS[0];
            const isCollidingTower = isCollidingWithTower(surtrData, surtrData.tower);
            const hasTarget = isCollidingWithEnemyFlag || isCollidingTower;

            // Xác định animation cần chuyển
            let targetAnimation = null;
            let newSkelPath = "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel";
            let newAtlasPath = "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas";

            if (surtrData.currentAnimation === "attack" && hasTarget) {
                targetAnimation = "Skill_3_Begin";
                surtrData.isInAttackState = false;
                surtrData.isInSkill3State = true;
                surtrData.velocity = 0;
            }
            else if (surtrData.currentAnimation === "idle") {
                targetAnimation = "Skill_3_Idle"; // Chuyển sang Idle của Skill 3
                surtrData.isInAttackState = false;
                surtrData.isInSkill3State = true;
                surtrData.velocity = 0;
            }

            // Chỉ chuyển nếu có animation hợp lệ
            if (targetAnimation) {
                surtrData.target = closestEnemy ? closestEnemy : (isCollidingTower ? surtrData.tower : null);
                surtrData.isAttackingEnemy = !!closestEnemy;

                switchSkeletonFile(
                    surtrData,
                    newSkelPath,
                    newAtlasPath,
                    targetAnimation,
                    (success) => {
                        if (success) {
                            surtrData.currentAnimation = targetAnimation.toLowerCase();
                            console.log(`Surtr chuyển sang ${targetAnimation} sau khi kích hoạt Skill 3`);
                        } else {
                            console.error(`Không thể chuyển sang ${targetAnimation} cho Surtr tại worldX=${surtrData.worldX}`);
                            // Fallback: giữ nguyên trạng thái hoặc về Move
                            surtrData.state.setAnimation(0, "Move", true);
                            surtrData.currentAnimation = "move";
                            surtrData.velocity = 50;
                        }
                    }
                );
            }
        }
    }

    // Kiểm tra va chạm để xác định mục tiêu
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
    surtrData.tower = surtrData.direction === 1 ? TOWER_POSITIONS[1] : TOWER_POSITIONS[0];
    const isCollidingTower = isCollidingWithTower(surtrData, surtrData.tower);
    surtrData.target = closestEnemy ? closestEnemy : (isCollidingTower ? surtrData.tower : null);
    surtrData.isAttackingEnemy = !!closestEnemy;

    // Kiểm tra trạng thái chết
    if (surtrData.hp <= 0 && !surtrData.isDead && !isSwitchingSkeleton) {
        console.log(`Surtr tại worldX=${surtrData.worldX} đã chết, chuyển sang animation Die`);
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
                    surtrData.currentAnimation = "die";
                } else {
                    console.error(`Không thể chuyển sang animation Die cho Surtr tại worldX=${surtrData.worldX}`);
                    surtrData.deathAnimationComplete = true;
                }
            }
        );
        return; // Thoát sớm nếu chết
    }

    if (!surtrData.deathAnimationComplete) {
        state.apply(skeleton);
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

        const targetTower = surtrData.tower;
        const towerHitbox = {
            x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
            y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
            width: targetTower.hitbox.width,
            height: targetTower.hitbox.height
        };

        // Kiểm tra đồng minh phía trước
        let isBlockedByFrontAlly = false;
        let frontAlly = null;
        const bufferDistance = 5;
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
                    surtrHitbox.x + surtrHitbox.width >= otherHitbox.x - bufferDistance :
                    surtrHitbox.x <= otherHitbox.x + otherHitbox.width + bufferDistance) {
                    const frontAnimation = otherAlly.state.getCurrent(0)?.animation?.name.toLowerCase() || "";
                    if (frontAnimation === "attack" || frontAnimation === "idle" || frontAnimation === "skill_3_loop" || frontAnimation === "skill_3_idle" || otherAlly.isInAttackState || otherAlly.isInSkill3State) {
                        isBlockedByFrontAlly = true;
                        break;
                    }
                }
            }
        }

        // Logic chuyển đổi trạng thái
        if (!surtrData.isInStartAnimation && !surtrData.isDead && !isSwitchingSkeleton) {
            if ((isCollidingWithEnemyFlag || isCollidingTower) && !surtrData.isInAttackState && !surtrData.isInSkill3State) {
                const targetAnimation = surtrData.isHitboxScaled ? "Skill_3_Begin" : "Attack";
                const targetState = surtrData.isHitboxScaled ? "isInSkill3State" : "isInAttackState";
                switchSkeletonFile(
                    surtrData,
                    "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel",
                    "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas",
                    targetAnimation,
                    (success) => {
                        if (success) {
                            surtrData[targetState] = true;
                            surtrData.isInAttackState = !surtrData.isHitboxScaled;
                            surtrData.isInSkill3State = surtrData.isHitboxScaled;
                            surtrData.currentAnimation = targetAnimation.toLowerCase();
                            surtrData.velocity = 0; // Dừng di chuyển khi tấn công
                        } else {
                            console.error(`Failed to switch to ${targetAnimation} skeleton for Surtr`);
                            state.setAnimation(0, "Move", true);
                            surtrData.currentAnimation = "move";
                        }
                    }
                );
            } else if (isBlockedByFrontAlly && !surtrData.isInAttackState && !surtrData.isInSkill3State) {
                const targetIdleAnim = surtrData.isSkill3Active ? "Skill_3_Idle" : "Idle";
                if (surtrData.currentAnimation !== targetIdleAnim.toLowerCase()) {
                    switchSkeletonFile(
                        surtrData,
                        "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.skel",
                        "assets/operators/Surtr/SurtrSummer/surtr_summer_weapon.atlas",
                        targetIdleAnim,
                        (success) => {
                            if (success) {
                                surtrData.currentAnimation = targetIdleAnim.toLowerCase();
                            } else {
                                console.error(`Failed to switch to ${targetIdleAnim} for Surtr`);
                                state.setAnimation(0, "Move", true);
                                surtrData.currentAnimation = "move";
                            }
                        }
                    );
                }
                if (frontAlly) {
                    const otherHitbox = {
                        x: frontAlly.worldX + frontAlly.hitbox.offsetX * (frontAlly.skeleton.scaleX || 1) - frontAlly.hitbox.width / 2,
                        y: GROUND_Y + 220 + frontAlly.hitbox.offsetY - frontAlly.hitbox.height / 2,
                        width: frontAlly.hitbox.width,
                        height: frontAlly.hitbox.height
                    };
                    if (surtrData.direction === 1) {
                        surtrData.worldX = otherHitbox.x - surtrData.hitbox.width / 2 - surtrData.hitbox.offsetX * (surtrData.skeleton.scaleX || 1);
                    } else {
                        surtrData.worldX = otherHitbox.x + otherHitbox.width + surtrData.hitbox.width / 2 - surtrData.hitbox.offsetX * (surtrData.skeleton.scaleX || 1);
                    }
                }
            } else if (!isCollidingWithEnemyFlag && !isCollidingTower && !isBlockedByFrontAlly && !surtrData.isInAttackState && !surtrData.isInSkill3State) {
                if (surtrData.currentAnimation !== "move") {
                    let canMove = true;
                    for (let otherAlly of allAllies) {
                        if (otherAlly !== surtrData &&
                            (surtrData.direction === 1 ? otherAlly.worldX > surtrData.worldX : otherAlly.worldX < surtrData.worldX)) {
                            const otherHitbox = {
                                x: otherAlly.worldX + otherAlly.hitbox.offsetX * (otherAlly.skeleton.scaleX || 1) - otherAlly.hitbox.width / 2,
                                y: GROUND_Y + 220 + otherAlly.hitbox.offsetY - otherAlly.hitbox.height / 2,
                                width: otherAlly.hitbox.width,
                                height: otherAlly.hitbox.height
                            };
                            const distanceToAlly = surtrData.direction === 1 ?
                                otherHitbox.x - (surtrHitbox.x + surtrHitbox.width) :
                                (surtrHitbox.x - (otherHitbox.x + otherHitbox.width));
                            if (distanceToAlly < bufferDistance * 2) {
                                canMove = false;
                                break;
                            }
                        }
                    }
                    if (canMove) {
                        switchSkeletonFile(
                            surtrData,
                            "assets/operators/Surtr/SurtrSummer/surtr_summer.skel",
                            "assets/operators/Surtr/SurtrSummer/surtr_summer.atlas",
                            "Move",
                            (success) => {
                                if (success) {
                                    surtrData.currentAnimation = "move";
                                    surtrData.velocity = 50;
                                    console.log("Surtr switched to Move animation");
                                } else {
                                    console.error("Failed to switch to Move skeleton for Surtr");
                                    state.setAnimation(0, "Move", true);
                                    surtrData.currentAnimation = "move";
                                }
                            }
                        );
                    }
                }
                if (surtrData.currentAnimation === "move") {
                    surtrData.worldX += surtrData.velocity * delta * surtrData.direction;
                }
            } else if (surtrData.currentAnimation === "skill_3_idle" &&
                !isBlockedByFrontAlly && !isCollidingWithEnemyFlag && !isCollidingTower) {

                surtrData.isInSkill3State = false; // Cho phép di chuyển lại
                switchSkeletonFile(
                    surtrData,
                    "assets/operators/Surtr/SurtrSummer/surtr_summer.skel",
                    "assets/operators/Surtr/SurtrSummer/surtr_summer.atlas",
                    "Move",
                    (success) => {
                        if (success) {
                            surtrData.currentAnimation = "move";
                            surtrData.velocity = 50;
                            console.log("Surtr thoát khỏi Skill_3_Idle và chuyển sang Move");
                        } else {
                            console.error("Không thể chuyển từ Skill_3_Idle sang Move");
                        }
                    }
                );
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