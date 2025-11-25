import { characterDataObj } from '../../../character.js';
import { applyDamage, createDamageText, GROUND_Y } from '../../../render.js';

let shader, batcher, mvp, skeletonRenderer, assetManager;

export function initReid(webglContext) {
    if (!webglContext) {
        console.error("WebGL context is not provided");
        return;
    }
    shader = spine.webgl.Shader.newTwoColoredTextured(webglContext);
    batcher = new spine.webgl.PolygonBatcher(webglContext);
    mvp = new spine.webgl.Matrix4();
    skeletonRenderer = new spine.webgl.SkeletonRenderer(webglContext);
    assetManager = new spine.webgl.AssetManager(webglContext);

    assetManager.loadBinary("assets/enemies/HatefulAvenger/HatefulAvenger/reid.skel");
    assetManager.loadTextureAtlas("assets/enemies/HatefulAvenger/HatefulAvenger/reid.atlas");
    assetManager.loadTexture("assets/enemies/HatefulAvenger/HatefulAvenger/reid.png");
}

export function isReidLoadingComplete() {
    return assetManager && assetManager.isLoadingComplete();
}

export function loadReidSkeleton(initialWorldX = 250, GROUND_Y = 0) {
    if (!assetManager) {
        console.error("assetManager chưa được khởi tạo!");
        return null;
    }

    const atlas = assetManager.get("assets/enemies/HatefulAvenger/HatefulAvenger/reid.atlas");
    if (!atlas) {
        console.error("Atlas không tồn tại tại assets/enemies/HatefulAvenger/HatefulAvenger/reid.atlas");
        return null;
    }

    const atlasLoader = new spine.AtlasAttachmentLoader(atlas);
    const skeletonBinary = new spine.SkeletonBinary(atlasLoader);
    skeletonBinary.scale = 0.3;
    const skeletonDataRaw = skeletonBinary.readSkeletonData(assetManager.get("assets/enemies/HatefulAvenger/HatefulAvenger/reid.skel"));
    if (!skeletonDataRaw) {
        console.error("Skeleton data không tải được từ reid.skel");
        return null;
    }

    const skeleton = new spine.Skeleton(skeletonDataRaw);
    skeleton.setSkinByName("default");

    const bounds = calculateSetupPoseBounds(skeleton);
    const animationStateData = new spine.AnimationStateData(skeletonDataRaw);
    const animationState = new spine.AnimationState(animationStateData);
    const initialAnimation = "move";
    const animationToUse = skeletonDataRaw.animations.find(anim => anim.name.toLowerCase() === initialAnimation.toLowerCase())?.name || skeletonDataRaw.animations[0]?.name;
    if (!animationToUse) {
        console.error(`Initial animation ${initialAnimation} not found in reid.skel. Available animations: ${skeletonDataRaw.animations.map(a => a.name).join(", ")}`);
    }
    animationState.setAnimation(0, animationToUse || "Move", true);

    animationState.addListener({
        event: function (trackIndex, event) {
            if (event.data.name !== "OnAttack") return;
            if (!reidData.isInAttackState) return;

            const atk = reidData.atk;

            if (reidData.target && reidData.isAttackingEnemy) {
                // const def = characterDataObj[reidData.target.type]?.def || 0;
                // const damage = Math.round(Math.max(atk * 0.05, atk - def));
                // reidData.target.hp = Math.max(0, reidData.target.hp - damage);
                const damage = applyDamage(reidData.target, atk, 'physical');
                createDamageText(reidData.target.worldX, GROUND_Y + 300, damage, 'red');
                if (reidData.target.hp <= 0) reidData.target = null;
            } else {
                const tower = reidData.tower;
                if (tower && isCollidingWithTower(reidData, tower)) {
                    // const def = tower.def || 0;
                    // const damage = Math.round(Math.max(atk * 0.05, atk - def));
                    // tower.hp = Math.max(0, tower.hp - damage);
                    const damage = applyDamage(tower, atk, 'physical');
                    createDamageText(tower.x + tower.hitbox.offsetX, GROUND_Y + 200, damage, 'red');
                }
            }
        },
        complete: function (trackIndex, count) {
            const currentAnimation = animationState.getCurrent(0)?.animation?.name.toLowerCase();
            if (reidData.isDead && currentAnimation === "die") {
                reidData.deathAnimationComplete = true;
            }
            if (currentAnimation === "attack" && !reidData.isDead) {
                const reidHitbox = {
                    x: isFinite(reidData.worldX + reidData.hitbox.offsetX * (reidData.skeleton.scaleX || 1) - reidData.hitbox.width / 2) ?
                        reidData.worldX + reidData.hitbox.offsetX * (reidData.skeleton.scaleX || 1) - reidData.hitbox.width / 2 :
                        reidData.worldX,
                    y: GROUND_Y + 220 + reidData.hitbox.offsetY - reidData.hitbox.height / 2,
                    width: reidData.hitbox.width,
                    height: reidData.hitbox.height
                };

                const validEnemies = Array.isArray(reidData.enemies) ? reidData.enemies : [];
                let closestEnemy = null;
                let minDistance = Infinity;
                validEnemies.forEach(enemy => {
                    if (enemy && enemy.hp > 0 && isCollidingWithEnemy(reidData, enemy)) {
                        const distance = Math.abs(reidData.worldX - enemy.worldX);
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestEnemy = enemy;
                        }
                    }
                });
                const isCollidingWithEnemyFlag = !!closestEnemy;
                const isCollidingTower = isCollidingWithTower(reidData, reidData.tower);
                let isBlockedByFrontAlly = false;
                const bufferDistance = 5;
                for (let otherAlly of reidData.allAllies || []) {
                    if (otherAlly !== reidData &&
                        (reidData.direction === 1 ? otherAlly.worldX > reidData.worldX : otherAlly.worldX < reidData.worldX)) {
                        const otherHitbox = {
                            x: otherAlly.worldX + otherAlly.hitbox.offsetX * (otherAlly.skeleton.scaleX || 1) - otherAlly.hitbox.width / 2,
                            y: GROUND_Y + 220 + otherAlly.hitbox.offsetY - otherAlly.hitbox.height / 2,
                            width: otherAlly.hitbox.width,
                            height: otherAlly.hitbox.height
                        };
                        if (reidData.direction === 1 ?
                            reidHitbox.x + reidHitbox.width >= otherHitbox.x - bufferDistance :
                            reidHitbox.x <= otherHitbox.x + otherHitbox.width + bufferDistance) {
                            const frontAnimation = otherAlly.state.getCurrent(0)?.animation?.name.toLowerCase() || "";
                            if (frontAnimation === "attack" || frontAnimation === "idle") {
                                isBlockedByFrontAlly = true;
                                break;
                            }
                        }
                    }
                }

                if (isCollidingWithEnemyFlag || isCollidingTower) {
                    reidData.target = closestEnemy ? closestEnemy : reidData.tower;
                    reidData.isAttackingEnemy = !!closestEnemy;
                    animationState.setAnimation(0, "Attack", false);
                    reidData.currentAnimation = "attack";
                } else if (isBlockedByFrontAlly) {
                    animationState.setAnimation(0, "idle", true);
                    reidData.isInAttackState = false;
                    reidData.currentAnimation = "idle";
                    console.log("Reid switched to Idle animation");
                } else {
                    animationState.setAnimation(0, "Move", true);
                    reidData.isInAttackState = false;
                    reidData.currentAnimation = "move";
                    reidData.velocity = 50;
                    console.log("Reid switched to Move animation");
                }
            }
        }
    });

    const hitbox = {
        width: isFinite(bounds.size.x) ? bounds.size.x * 0.5 : 100,
        height: isFinite(bounds.size.y) ? bounds.size.y * 1.05 : 200,
        offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 95) ? bounds.offset.x + bounds.size.x / 2 + 15 : 120,
        offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.2 + 145) ? bounds.offset.y + bounds.size.y * 0.2 + 130 : 120
    };

    const damageHitbox = {
        width: 50,
        height: 200,
        offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 220) ? bounds.offset.x + bounds.size.x / 2 + 220 : 220,
        offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.2 + 145) ? bounds.offset.y + bounds.size.y * 0.2 + 130 : 120
    };

    const reidData = {
        skeleton,
        state: animationState,
        bounds,
        premultipliedAlpha: true,
        worldX: initialWorldX,
        hitbox,
        damageHitbox,
        tower: null,
        isInAttackState: false,
        currentAnimation: "move",
        direction: 1,
        velocity: 50,
        target: null,
        isAttackingEnemy: false,
        isDead: false,
        deathAnimationComplete: false,
        groundY: GROUND_Y,
        type: "Reid",
        enemies: [],
        allAllies: [],
        atk: characterDataObj["Reid"]?.atk || 100,
        maxHp: characterDataObj["Reid"]?.hp || 1000,
        hp: characterDataObj["Reid"]?.hp || 1000
    };
    return reidData;
}

function isCollidingWithTower(reidData, targetTower) {
    if (!reidData.damageHitbox || !isFinite(reidData.worldX) || !isFinite(reidData.damageHitbox.offsetX)) {
        return false;
    }

    const reidHitbox = {
        x: isFinite(reidData.worldX + reidData.hitbox.offsetX * (reidData.skeleton.scaleX || 1) - reidData.hitbox.width / 2) ?
            reidData.worldX + reidData.hitbox.offsetX * (reidData.skeleton.scaleX || 1) - reidData.hitbox.width / 2 :
            reidData.worldX,
        y: reidData.groundY + 220 + reidData.hitbox.offsetY - reidData.hitbox.height / 2,
        width: reidData.hitbox.width,
        height: reidData.hitbox.height
    };

    const reidDamageHitbox = {
        x: reidData.direction === -1 ?
            reidHitbox.x - (reidData.damageHitbox.width) :
            reidHitbox.x + reidHitbox.width,
        y: reidData.groundY + reidData.damageHitbox.offsetY - reidData.damageHitbox.height / 2 + 258,
        width: reidData.damageHitbox.width,
        height: reidData.damageHitbox.height - 75
    };

    const towerHitbox = {
        x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
        y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
        width: targetTower.hitbox.width,
        height: targetTower.hitbox.height
    };

    const isColliding = isFinite(reidDamageHitbox.x) &&
        reidDamageHitbox.x < towerHitbox.x + towerHitbox.width &&
        reidDamageHitbox.x + reidDamageHitbox.width > towerHitbox.x &&
        reidDamageHitbox.y < towerHitbox.y + towerHitbox.height &&
        reidDamageHitbox.y + reidDamageHitbox.height > towerHitbox.y;

    return isColliding;
}

export function isCollidingWithEnemy(reidData, enemy) {
    if (!reidData.damageHitbox || !enemy.hitbox || !isFinite(reidData.worldX) || !isFinite(enemy.worldX)) {
        return false;
    }

    const reidHitbox = {
        x: isFinite(reidData.worldX + reidData.hitbox.offsetX * (reidData.skeleton.scaleX || 1) - reidData.hitbox.width / 2) ?
            reidData.worldX + reidData.hitbox.offsetX * (reidData.skeleton.scaleX || 1) - reidData.hitbox.width / 2 :
            reidData.worldX,
        y: reidData.groundY + 220 + reidData.hitbox.offsetY - reidData.hitbox.height / 2,
        width: reidData.hitbox.width,
        height: reidData.hitbox.height
    };

    const reidDamageHitbox = {
        x: reidData.direction === -1 ?
            reidHitbox.x - (reidData.damageHitbox.width) :
            reidHitbox.x + reidHitbox.width,
        y: reidData.groundY + reidData.damageHitbox.offsetY - reidData.damageHitbox.height / 2 + 258,
        width: reidData.damageHitbox.width,
        height: reidData.damageHitbox.height - 75
    };

    const enemyHitbox = {
        x: isFinite(enemy.worldX + enemy.hitbox.offsetX * (enemy.skeleton.scaleX || 1) - enemy.hitbox.width / 2) ?
            enemy.worldX + enemy.hitbox.offsetX * (enemy.skeleton.scaleX || 1) - enemy.hitbox.width / 2 :
            enemy.worldX,
        y: enemy.groundY + 220 + enemy.hitbox.offsetY - enemy.hitbox.height / 2,
        width: enemy.hitbox.width,
        height: enemy.hitbox.height
    };

    const isColliding = reidDamageHitbox.x < enemyHitbox.x + enemyHitbox.width &&
        reidDamageHitbox.x + reidDamageHitbox.width > enemyHitbox.x &&
        reidDamageHitbox.y < enemyHitbox.y + enemyHitbox.height &&
        reidDamageHitbox.y + reidDamageHitbox.height > enemyHitbox.y;

    return isColliding;
}

function calculateSetupPoseBounds(skeleton) {
    skeleton.setToSetupPose();
    skeleton.updateWorldTransform();
    const offset = new spine.Vector2(), size = new spine.Vector2();
    skeleton.getBounds(offset, size, []);
    return { offset, size };
}

export function renderReidSkeleton(reidData, delta, camera, canvas, groundTileImage, WORLD_WIDTH, GROUND_Y, TOWER_POSITIONS, backgroundCtx, gl, allAllies, enemies) {
    if (!reidData) {
        console.error("reidData không tồn tại");
        return;
    }

    reidData.enemies = enemies;
    reidData.allAllies = allAllies;

    const { skeleton, state, premultipliedAlpha, bounds, worldX, hitbox, damageHitbox } = reidData;
    state.update(delta);

    // Kiểm tra trạng thái chết
    if (reidData.hp <= 0 && !reidData.isDead) {
        console.log(`Reid tại worldX=${reidData.worldX} đã chết, chuyển sang animation Die`);
        reidData.isDead = true;
        reidData.isInAttackState = false;
        reidData.velocity = 0;
        state.setAnimation(0, "Die", false);
        reidData.currentAnimation = "die";
        return;
    }

    if (!reidData.deathAnimationComplete) {
        state.apply(skeleton);
        reidData.groundY = GROUND_Y;

        const reidHitbox = {
            x: isFinite(worldX + hitbox.offsetX * (skeleton.scaleX || 1) - hitbox.width / 2) ?
                worldX + hitbox.offsetX * (skeleton.scaleX || 1) - hitbox.width / 2 : worldX,
            y: GROUND_Y + 220 + hitbox.offsetY - hitbox.height / 2,
            width: hitbox.width,
            height: hitbox.height
        };

        const reidDamageHitbox = {
            x: isFinite(worldX) && damageHitbox && isFinite(damageHitbox.offsetX) ?
                (reidData.direction === -1 ?
                    reidHitbox.x - (damageHitbox.width) :
                    reidHitbox.x + reidHitbox.width) : worldX,
            y: damageHitbox ? GROUND_Y + damageHitbox.offsetY - damageHitbox.height / 2 + 258 : GROUND_Y + 258,
            width: damageHitbox ? damageHitbox.width : 50,
            height: damageHitbox ? damageHitbox.height - 75 : 125
        };

        const targetTower = reidData.tower = reidData.direction === 1 ? TOWER_POSITIONS[1] : TOWER_POSITIONS[0];
        const towerHitbox = {
            x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
            y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
            width: targetTower.hitbox.width,
            height: targetTower.hitbox.height
        };

        // Kiểm tra va chạm để xác định mục tiêu
        const validEnemies = Array.isArray(enemies) ? enemies : [];
        let closestEnemy = null;
        let minDistance = Infinity;
        validEnemies.forEach(enemy => {
            if (enemy && enemy.hp > 0 && isCollidingWithEnemy(reidData, enemy)) {
                const distance = Math.abs(reidData.worldX - enemy.worldX);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestEnemy = enemy;
                }
            }
        });
        const isCollidingWithEnemyFlag = !!closestEnemy;
        const isCollidingTower = isCollidingWithTower(reidData, reidData.tower);
        reidData.target = closestEnemy ? closestEnemy : (isCollidingTower ? reidData.tower : null);
        reidData.isAttackingEnemy = !!closestEnemy;

        // Kiểm tra đồng minh phía trước
        let isBlockedByFrontAlly = false;
        const bufferDistance = 5;
        for (let otherAlly of allAllies) {
            if (otherAlly !== reidData &&
                (reidData.direction === 1 ? otherAlly.worldX > reidData.worldX : otherAlly.worldX < reidData.worldX)) {
                const otherHitbox = {
                    x: otherAlly.worldX + otherAlly.hitbox.offsetX * (otherAlly.skeleton.scaleX || 1) - otherAlly.hitbox.width / 2,
                    y: GROUND_Y + 220 + otherAlly.hitbox.offsetY - otherAlly.hitbox.height / 2,
                    width: otherAlly.hitbox.width,
                    height: otherAlly.hitbox.height
                };
                if (reidData.direction === 1 ?
                    reidHitbox.x + reidHitbox.width >= otherHitbox.x - bufferDistance :
                    reidHitbox.x <= otherHitbox.x + otherHitbox.width + bufferDistance) {
                    const frontAnimation = otherAlly.state.getCurrent(0)?.animation?.name.toLowerCase() || "";
                    // Thêm check cho skill 3
                    if (frontAnimation === "attack" || frontAnimation === "idle" ||
                        frontAnimation === "skill_3_loop" || frontAnimation === "skill_3_idle" ||  // <--- Thêm
                        otherAlly.isInAttackState || otherAlly.isInSkill3State) {  // <--- Thêm isInSkill3State
                        isBlockedByFrontAlly = true;
                        break;
                    }
                }
            }
        }

        // Logic chuyển đổi trạng thái
        if (!reidData.isDead) {
            if ((isCollidingWithEnemyFlag || isCollidingTower) && !reidData.isInAttackState) {
                state.setAnimation(0, "Attack", false);
                reidData.isInAttackState = true;
                reidData.currentAnimation = "attack";
                reidData.velocity = 0;
            } else if (isBlockedByFrontAlly && !reidData.isInAttackState) {
                if (reidData.currentAnimation !== "idle") {
                    state.setAnimation(0, "Idle", true);
                    reidData.currentAnimation = "idle";
                    reidData.velocity = 0;
                }
            } else if (!isCollidingWithEnemyFlag && !isCollidingTower && !isBlockedByFrontAlly && !reidData.isInAttackState) {
                if (reidData.currentAnimation !== "move") {
                    state.setAnimation(0, "Move", true);
                    reidData.currentAnimation = "move";
                    reidData.velocity = 50;
                }
                reidData.worldX += reidData.velocity * delta * reidData.direction;
            }
        }

        skeleton.x = reidData.worldX - camera.x;
        skeleton.y = canvas.height - (GROUND_Y + 425);
        skeleton.scaleX = reidData.direction;

        if (reidData.direction === 1 && reidData.worldX > towerHitbox.x - hitbox.width) {
            reidData.worldX = towerHitbox.x - hitbox.width;
        } else if (reidData.direction === -1 && reidData.worldX < towerHitbox.x + towerHitbox.width) {
            reidData.worldX = towerHitbox.x + towerHitbox.width;
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
        //     reidHitbox.x - camera.x,
        //     reidHitbox.y,
        //     reidHitbox.width,
        //     reidHitbox.height
        // );

        // if (isFinite(reidDamageHitbox.x) && !reidData.isDead) {
        //     backgroundCtx.fillStyle = "rgba(255, 165, 0, 0.3)";
        //     backgroundCtx.fillRect(
        //         reidDamageHitbox.x - camera.x,
        //         reidDamageHitbox.y,
        //         reidDamageHitbox.width,
        //         reidDamageHitbox.height
        //     );
        // }
    }
}

export function resizeReid(canvas, camera, gl) {
    gl.viewport(0, 0, canvas.width, canvas.height);
}

export function isOverlappingWithOtherReid(newHitbox, existingReids, GROUND_Y) {
    for (let existing of existingReids) {
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