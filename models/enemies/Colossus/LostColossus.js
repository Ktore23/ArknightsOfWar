import { characterDataObj } from '../../../character.js';
import { applyDamage, createDamageText, GROUND_Y } from '../../../render.js';

let shader, batcher, mvp, skeletonRenderer, assetManager;
let currentSkelPath = "assets/enemies/Colossus/LostColossus/rockman.skel";
let currentAtlasPath = "assets/enemies/Colossus/LostColossus/rockman.atlas";
let fixedDamageHitbox = null;

export function initLostColossus(webglContext) {
    if (!webglContext) {
        console.error("WebGL context is not provided");
        return;
    }
    shader = spine.webgl.Shader.newTwoColoredTextured(webglContext);
    batcher = new spine.webgl.PolygonBatcher(webglContext);
    mvp = new spine.webgl.Matrix4();
    skeletonRenderer = new spine.webgl.SkeletonRenderer(webglContext);
    assetManager = new spine.webgl.AssetManager(webglContext);

    assetManager.loadBinary(currentSkelPath);
    assetManager.loadTextureAtlas(currentAtlasPath);
    assetManager.loadTexture("assets/enemies/Colossus/LostColossus/rockman.png");
}

export function isLostColossusLoadingComplete() {
    return assetManager && assetManager.isLoadingComplete();
}

export function loadLostColossusSkeleton(initialWorldX = 250, isBot = false, GROUND_Y = 0) {
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
    skeletonBinary.scale = 0.3; // Tăng scale vì Lost Colossus to hơn Frost Nova
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
        event: function (trackIndex, event) {
            if (event.data.name === "OnAttack" && lostColossusData.isInAttackState && lostColossusData) {
                let atk = characterDataObj["Lost Colossus"].atk;
                let damage;
                if (lostColossusData.target && lostColossusData.isAttackingEnemy) {
                    // const targetDef = characterDataObj[lostColossusData.target.type]?.def || 0;
                    // damage = Math.round(Math.max(atk * 0.05, atk - targetDef));
                    // lostColossusData.target.hp = Math.max(0, lostColossusData.target.hp - damage);
                    damage = applyDamage(lostColossusData.target, atk, "physical");
                    createDamageText(lostColossusData.target.worldX, GROUND_Y + 300, damage);
                } else {
                    const targetTower = lostColossusData.tower;
                    if (targetTower && isCollidingWithTower(lostColossusData, targetTower)) {
                        // const towerDef = targetTower.def || 0;
                        // damage = Math.round(Math.max(atk * 0.05, atk - towerDef));
                        // targetTower.hp = Math.max(0, targetTower.hp - damage);
                        damage = applyDamage(targetTower, atk, "physical");
                        const towerCenterX = targetTower.x + targetTower.hitbox.offsetX;
                        createDamageText(towerCenterX, GROUND_Y + 200, damage);
                    }
                }
            }
        },
        complete: function (trackIndex, count) {
            const currentAnimation = animationState.getCurrent(0)?.animation?.name.toLowerCase() || "";
            if (lostColossusData.isDead && currentAnimation === "die") {
                lostColossusData.deathAnimationComplete = true;
            }
            if (currentAnimation === "attack" && !lostColossusData.isDead) {
                const lostColossusHitbox = {
                    x: isFinite(lostColossusData.worldX + lostColossusData.hitbox.offsetX * (lostColossusData.skeleton.scaleX || 1) - lostColossusData.hitbox.width / 2) ?
                        lostColossusData.worldX + lostColossusData.hitbox.offsetX * (lostColossusData.skeleton.scaleX || 1) - lostColossusData.hitbox.width / 2 :
                        lostColossusData.worldX,
                    y: lostColossusData.groundY + 220 + lostColossusData.hitbox.offsetY - lostColossusData.hitbox.height / 2,
                    width: lostColossusData.hitbox.width,
                    height: lostColossusData.hitbox.height
                };

                const { colliding: isCollidingWithEnemyFlag, target: closestEnemy } = isCollidingWithEnemy(lostColossusData, lostColossusData.enemies || []);
                lostColossusData.target = closestEnemy;
                lostColossusData.isAttackingEnemy = isCollidingWithEnemyFlag;

                const isCollidingTower = isCollidingWithTower(lostColossusData, lostColossusData.tower);

                let isBlockedByFrontAlly = false;
                const bufferDistance = 5;
                for (let ally of lostColossusData.allBotUnits || []) {
                    if (ally === lostColossusData || ally.hp <= 0 || ally.isDead || ally.deathAnimationComplete) continue;
                    if ((lostColossusData.direction === 1 && ally.worldX > lostColossusData.worldX) ||
                        (lostColossusData.direction === -1 && ally.worldX < lostColossusData.worldX)) {
                        const allyHitbox = {
                            x: ally.worldX + ally.hitbox.offsetX * (ally.skeleton.scaleX || 1) - ally.hitbox.width / 2,
                            y: GROUND_Y + 220 + ally.hitbox.offsetY - ally.hitbox.height / 2,
                            width: ally.hitbox.width,
                            height: ally.hitbox.height
                        };
                        const overlapX = (lostColossusData.direction === 1) ?
                            (lostColossusHitbox.x + lostColossusHitbox.width >= allyHitbox.x - bufferDistance) :
                            (lostColossusHitbox.x <= allyHitbox.x + allyHitbox.width + bufferDistance);
                        if (overlapX) {
                            const frontAnimation = ally.state.getCurrent(0)?.animation?.name.toLowerCase() || "";
                            // Thêm check cho skill 3
                            if (frontAnimation === "attack" || frontAnimation === "idle" ||
                                frontAnimation === "skill_3_loop" || frontAnimation === "skill_3_idle" ||  // <--- Thêm
                                ally.isInAttackState || ally.isInSkill3State) {  // <--- Thêm isInSkill3State
                                isBlockedByFrontAlly = true;
                                break;
                            }
                        }
                    }
                }

                if (isCollidingWithEnemyFlag || isCollidingTower) {
                    lostColossusData.target = closestEnemy || lostColossusData.tower;
                    lostColossusData.isAttackingEnemy = !!closestEnemy;
                    animationState.setAnimation(0, "Attack", false);
                    lostColossusData.isInAttackState = true;
                } else if (isBlockedByFrontAlly) {
                    animationState.setAnimation(0, "Idle", true);
                    lostColossusData.isInAttackState = false;
                } else {
                    animationState.setAnimation(0, "Move", true);
                    lostColossusData.isInAttackState = false;
                }
            }
        }
    });

    const hitbox = {
        width: isFinite(bounds.size.x) ? bounds.size.x * 0.4 : 180,
        height: isFinite(bounds.size.y) ? bounds.size.y * 1.2 : 300,
        offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 150) ? bounds.offset.x + bounds.size.x / 2 - 60 : 150,
        offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.5 + 140) ? bounds.offset.y + bounds.size.y * 0.5 + 90 : 140
    };

    fixedDamageHitbox = {
        width: 50,
        height: 145,
        offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 280) ? bounds.offset.x + bounds.size.x / 2 + 13 : 280,
        offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.2 + 140) ? bounds.offset.y + bounds.size.y * 0.2 + 125 : 140
    };

    const lostColossusData = {
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
        isDead: false,
        deathAnimationTimer: 0,
        deathAnimationComplete: false,
        groundY: GROUND_Y,
        blockedFrameCount: 0,
        type: "Lost Colossus",
        enemies: [],
        allBotUnits: []
    };
    lostColossusData.skeleton.scaleX = lostColossusData.direction;
    return lostColossusData;
}

function calculateSetupPoseBounds(skeleton) {
    skeleton.setToSetupPose();
    skeleton.updateWorldTransform();
    let offset = new spine.Vector2();
    let size = new spine.Vector2();
    skeleton.getBounds(offset, size, []);
    return { offset: offset, size: size };
}

function isCollidingWithTower(lostColossusData, targetTower) {
    if (!lostColossusData.damageHitbox || !isFinite(lostColossusData.worldX) || !isFinite(lostColossusData.damageHitbox.offsetX)) {
        return false;
    }

    const lostColossusDamageHitbox = {
        x: lostColossusData.worldX + lostColossusData.damageHitbox.offsetX * lostColossusData.skeleton.scaleX - lostColossusData.damageHitbox.width / 2,
        y: lostColossusData.groundY + 220 + lostColossusData.damageHitbox.offsetY - lostColossusData.damageHitbox.height / 2,
        width: lostColossusData.damageHitbox.width,
        height: lostColossusData.damageHitbox.height
    };

    const towerHitbox = {
        x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
        y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
        width: targetTower.hitbox.width,
        height: targetTower.hitbox.height
    };

    return lostColossusDamageHitbox.x < towerHitbox.x + towerHitbox.width &&
        lostColossusDamageHitbox.x + lostColossusDamageHitbox.width > towerHitbox.x &&
        lostColossusDamageHitbox.y < towerHitbox.y + towerHitbox.height &&
        lostColossusDamageHitbox.y + lostColossusDamageHitbox.height > towerHitbox.y;
}

export function isCollidingWithEnemy(lostColossusData, enemies) {
    if (!lostColossusData.damageHitbox || !isFinite(lostColossusData.worldX) || !isFinite(lostColossusData.damageHitbox.offsetX)) {
        return { colliding: false, target: null };
    }

    const lostColossusDamageHitbox = {
        x: lostColossusData.worldX + lostColossusData.damageHitbox.offsetX * lostColossusData.skeleton.scaleX - lostColossusData.damageHitbox.width / 2,
        y: lostColossusData.groundY + 220 + lostColossusData.damageHitbox.offsetY - lostColossusData.damageHitbox.height / 2,
        width: lostColossusData.damageHitbox.width,
        height: lostColossusData.damageHitbox.height
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

        const isColliding = lostColossusDamageHitbox.x < enemyHitbox.x + enemyHitbox.width &&
            lostColossusDamageHitbox.x + lostColossusDamageHitbox.width > enemyHitbox.x &&
            lostColossusDamageHitbox.y < enemyHitbox.y + enemyHitbox.height &&
            lostColossusDamageHitbox.y + lostColossusDamageHitbox.height > enemyHitbox.y;

        if (isColliding) {
            const distance = Math.abs(lostColossusData.worldX - enemy.worldX);
            if (distance < minDistance) {
                minDistance = distance;
                closestEnemy = enemy;
            }
        }
    }

    return { colliding: !!closestEnemy, target: closestEnemy };
}

export function renderLostColossusSkeleton(lostColossusData, delta, camera, canvas, groundTileImage, WORLD_WIDTH, GROUND_Y, TOWER_POSITIONS, backgroundCtx, gl, allBotUnits, validUnits) {
    if (!lostColossusData || lostColossusData.deathAnimationComplete) return;

    lostColossusData.enemies = validUnits;
    lostColossusData.allBotUnits = allBotUnits;

    const { skeleton, state, premultipliedAlpha } = lostColossusData;
    const worldX = lostColossusData.worldX;
    const hitbox = lostColossusData.hitbox;
    const damageHitbox = lostColossusData.damageHitbox;

    let blockedFrameCount = lostColossusData.blockedFrameCount || 0;
    const DEBOUNCE_THRESHOLD = 2;
    const ADJUST_THRESHOLD = 5;

    const tower = lostColossusData.tower || (lostColossusData.direction === 1 ? TOWER_POSITIONS[1] : TOWER_POSITIONS[0]);
    lostColossusData.tower = tower;

    const towerHitbox = {
        x: tower.x + tower.hitbox.offsetX - tower.hitbox.width / 2,
        y: tower.y + tower.hitbox.offsetY - tower.hitbox.height / 2,
        width: tower.hitbox.width,
        height: tower.hitbox.height
    };

    const isColliding = isCollidingWithTower(lostColossusData, tower);
    const { colliding: isCollidingWithEnemyFlag, target: closestEnemy } = isCollidingWithEnemy(lostColossusData, validUnits);
    lostColossusData.target = closestEnemy;
    lostColossusData.isAttackingEnemy = isCollidingWithEnemyFlag;

    let isBlockedByFrontAlly = false;
    let frontAlly = null;
    for (let ally of allBotUnits) {
        if (ally === lostColossusData || ally.hp <= 0 || ally.isDead || ally.deathAnimationComplete) continue;

        const allyHitbox = {
            x: isFinite(ally.worldX + ally.hitbox.offsetX * (ally.skeleton.scaleX || 1) - ally.hitbox.width / 2) ?
                ally.worldX + ally.hitbox.offsetX * (ally.skeleton.scaleX || 1) - ally.hitbox.width / 2 :
                ally.worldX,
            y: GROUND_Y + 220 + ally.hitbox.offsetY - ally.hitbox.height / 2,
            width: ally.hitbox.width,
            height: ally.hitbox.height
        };

        if ((lostColossusData.direction === 1 && ally.worldX > lostColossusData.worldX) ||
            (lostColossusData.direction === -1 && ally.worldX < lostColossusData.worldX)) {

            const thisHitbox = {
                x: isFinite(lostColossusData.worldX + lostColossusData.hitbox.offsetX * (lostColossusData.skeleton.scaleX || 1) - lostColossusData.hitbox.width / 2) ?
                    lostColossusData.worldX + lostColossusData.hitbox.offsetX * (lostColossusData.skeleton.scaleX || 1) - lostColossusData.hitbox.width / 2 :
                    lostColossusData.worldX,
                y: GROUND_Y + 220 + lostColossusData.hitbox.offsetY - lostColossusData.hitbox.height / 2,
                width: lostColossusData.hitbox.width,
                height: lostColossusData.hitbox.height
            };

            const overlapX = (lostColossusData.direction === 1) ?
                (thisHitbox.x + thisHitbox.width >= allyHitbox.x) :
                (thisHitbox.x <= allyHitbox.x + allyHitbox.width);

            if (overlapX) {
                const frontAnimation = ally.state.getCurrent(0)?.animation?.name.toLowerCase() || "";
                if (frontAnimation === "attack" || frontAnimation === "idle" || frontAnimation === "skill_3_loop" || frontAnimation === "skill_3_idle" || ally.isInAttackState || ally.isInSkill3State) {
                    isBlockedByFrontAlly = true;
                    frontAlly = ally;
                    break;
                }
            }
        }
    }

    if (isBlockedByFrontAlly) {
        blockedFrameCount++;
    } else {
        blockedFrameCount = 0;
    }
    lostColossusData.blockedFrameCount = blockedFrameCount;
    const isStablyBlocked = blockedFrameCount >= DEBOUNCE_THRESHOLD;

    if (lostColossusData.hp <= 0 && !lostColossusData.isDead) {
        lostColossusData.isDead = true;
        lostColossusData.deathAnimationTimer = 0;
        const dieAnimation = state.data.skeletonData.animations.find(anim => anim.name.toLowerCase() === "die")?.name;
        if (dieAnimation) {
            state.setAnimation(0, dieAnimation, false);
            console.log(`Lost Colossus tại worldX=${worldX} bắt đầu animation Die`);
        } else {
            console.error("Animation Die not found for Lost Colossus");
            lostColossusData.deathAnimationComplete = true;
        }
        lostColossusData.isInAttackState = false;
        return;
    }

    if (lostColossusData.isDead) {
        lostColossusData.deathAnimationTimer += delta;
        if (lostColossusData.deathAnimationTimer >= 1.0) {
            lostColossusData.deathAnimationComplete = true;
        }
    } else {
        const currentAnimation = state.getCurrent(0)?.animation?.name.toLowerCase() || "";
        if ((isCollidingWithEnemyFlag || isColliding) && !lostColossusData.isInAttackState && currentAnimation !== "attack") {
            const attackAnimation = state.data.skeletonData.animations.find(anim => anim.name.toLowerCase() === "attack")?.name;
            if (attackAnimation) {
                state.setAnimation(0, attackAnimation, false);
                lostColossusData.isInAttackState = true;
            }
        } else if (isStablyBlocked && !lostColossusData.isInAttackState && currentAnimation !== "idle") {
            const idleAnimation = state.data.skeletonData.animations.find(anim => anim.name.toLowerCase() === "idle")?.name;
            if (idleAnimation) {
                state.setAnimation(0, idleAnimation, true);
                lostColossusData.isInAttackState = false;
            }
        } else if (!isCollidingWithEnemyFlag && !isColliding && !isStablyBlocked && !lostColossusData.isInAttackState && currentAnimation !== "move") {
            const moveAnimation = state.data.skeletonData.animations.find(anim => anim.name.toLowerCase() === "move")?.name;
            if (moveAnimation) {
                state.setAnimation(0, moveAnimation, true);
                lostColossusData.isInAttackState = false;
            }
        }
    }

    state.update(delta);
    state.apply(skeleton);

    if (!isCollidingWithEnemyFlag && !isColliding && !isStablyBlocked && !lostColossusData.isDead && !lostColossusData.isInAttackState) {
        lostColossusData.worldX += lostColossusData.velocity * delta * lostColossusData.direction;
    } else if (isStablyBlocked && !lostColossusData.isDead && frontAlly) {
        const thisHitbox = {
            x: isFinite(lostColossusData.worldX + lostColossusData.hitbox.offsetX * (lostColossusData.skeleton.scaleX || 1) - lostColossusData.hitbox.width / 2) ?
                lostColossusData.worldX + lostColossusData.hitbox.offsetX * (lostColossusData.skeleton.scaleX || 1) - lostColossusData.hitbox.width / 2 :
                lostColossusData.worldX,
            y: GROUND_Y + 220 + lostColossusData.hitbox.offsetY - lostColossusData.hitbox.height / 2,
            width: lostColossusData.hitbox.width,
            height: lostColossusData.hitbox.height
        };

        const otherHitbox = {
            x: frontAlly.worldX + frontAlly.hitbox.offsetX * (frontAlly.skeleton.scaleX || 1) - frontAlly.hitbox.width / 2,
            y: GROUND_Y + 220 + frontAlly.hitbox.offsetY - frontAlly.hitbox.height / 2,
            width: frontAlly.hitbox.width,
            height: frontAlly.hitbox.height
        };

        let currentDistance;
        if (lostColossusData.direction === 1) {
            currentDistance = otherHitbox.x - (thisHitbox.x + thisHitbox.width);
        } else {
            currentDistance = (thisHitbox.x - otherHitbox.x - otherHitbox.width);
        }

        if (Math.abs(currentDistance) > ADJUST_THRESHOLD) {
            let newWorldX = otherHitbox.x + (lostColossusData.direction === 1 ? -lostColossusData.hitbox.width : otherHitbox.width)
                - lostColossusData.hitbox.offsetX * (lostColossusData.skeleton.scaleX || 1) + lostColossusData.hitbox.width / 2;
            lostColossusData.worldX = newWorldX;
        }
    }

    skeleton.x = lostColossusData.worldX - camera.x;
    skeleton.y = canvas.height - (GROUND_Y + 425);
    skeleton.scaleX = lostColossusData.direction;

    if (lostColossusData.direction === 1 && lostColossusData.worldX > towerHitbox.x - hitbox.width) {
        lostColossusData.worldX = towerHitbox.x - hitbox.width;
    } else if (lostColossusData.direction === -1 && lostColossusData.worldX < towerHitbox.x + towerHitbox.width) {
        lostColossusData.worldX = towerHitbox.x + towerHitbox.width;
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

    const lostColossusHitbox = {
        x: isFinite(lostColossusData.worldX + lostColossusData.hitbox.offsetX * (lostColossusData.skeleton.scaleX || 1) - lostColossusData.hitbox.width / 2) ?
            lostColossusData.worldX + lostColossusData.hitbox.offsetX * (lostColossusData.skeleton.scaleX || 1) - lostColossusData.hitbox.width / 2 :
            lostColossusData.worldX,
        y: lostColossusData.groundY + 220 + lostColossusData.hitbox.offsetY - lostColossusData.hitbox.height / 2,
        width: lostColossusData.hitbox.width,
        height: lostColossusData.hitbox.height
    };

    const lostColossusDamageHitbox = {
        x: lostColossusData.worldX + lostColossusData.damageHitbox.offsetX * lostColossusData.skeleton.scaleX - lostColossusData.damageHitbox.width / 2,
        y: lostColossusData.groundY + 220 + lostColossusData.damageHitbox.offsetY - lostColossusData.damageHitbox.height / 2,
        width: lostColossusData.damageHitbox.width,
        height: lostColossusData.damageHitbox.height
    };

    // backgroundCtx.fillStyle = "rgba(255, 0, 0, 0.3)";
    // backgroundCtx.fillRect(
    //     lostColossusHitbox.x - camera.x,
    //     lostColossusHitbox.y,
    //     lostColossusHitbox.width,
    //     lostColossusHitbox.height
    // );

    // if (isFinite(lostColossusDamageHitbox.x) && !lostColossusData.isDead) {
    //     backgroundCtx.fillStyle = "rgba(255, 165, 0, 0.3)";
    //     backgroundCtx.fillRect(
    //         lostColossusDamageHitbox.x - camera.x,
    //         lostColossusDamageHitbox.y,
    //         lostColossusDamageHitbox.width,
    //         lostColossusDamageHitbox.height
    //     );
    // }
}

export function resizeLostColossus(canvas, camera, gl) {
    gl.viewport(0, 0, canvas.width, canvas.height);
}

export function isOverlappingWithOtherLostColossus(newHitbox, existingLostColossuses, GROUND_Y) {
    for (let existing of existingLostColossuses) {
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