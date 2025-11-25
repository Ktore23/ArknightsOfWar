import { characterDataObj } from '../../../character.js';
import { applyDamage, createDamageText, GROUND_Y } from '../../../render.js';

let shader, batcher, mvp, skeletonRenderer, assetManager;
let currentSkelPath = "assets/enemies/NourishedPredator/NourishedPredator2/enemy_1231_dsrunr_2.skel";
let currentAtlasPath = "assets/enemies/NourishedPredator/NourishedPredator2/enemy_1231_dsrunr_2.atlas";
let fixedDamageHitbox = null;

export function initNourishedPredator(webglContext) {
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
    assetManager.loadTexture("assets/enemies/NourishedPredator/NourishedPredator2/enemy_1231_dsrunr_2.png");
}

export function isNourishedPredatorLoadingComplete() {
    return assetManager && assetManager.isLoadingComplete();
}

export function loadNourishedPredatorSkeleton(initialWorldX = 250, isBot = false, GROUND_Y = 0) {
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
    skeletonBinary.scale = 0.3; // Giữ scale tương tự, có thể điều chỉnh dựa trên kích thước Nourished Predator
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
            if (event.data.name === "OnAttack" && nourishedPredatorData.isInAttackState && nourishedPredatorData) {
                let atk = characterDataObj["Nourished Predator"].atk;
                let damage;
                if (nourishedPredatorData.target && nourishedPredatorData.isAttackingEnemy) {
                    // const targetDef = characterDataObj[nourishedPredatorData.target.type]?.def || 0;
                    // damage = Math.round(Math.max(atk * 0.05, atk - targetDef));
                    // nourishedPredatorData.target.hp = Math.max(0, nourishedPredatorData.target.hp - damage);
                    const damage = applyDamage(nourishedPredatorData.target, atk, 'physical');
                    createDamageText(nourishedPredatorData.target.worldX, GROUND_Y + 300, damage);
                } else {
                    const targetTower = nourishedPredatorData.tower;
                    if (targetTower && isCollidingWithTower(nourishedPredatorData, targetTower)) {
                        // const towerDef = targetTower.def || 0;
                        // damage = Math.round(Math.max(atk * 0.05, atk - towerDef));
                        // targetTower.hp = Math.max(0, targetTower.hp - damage);
                        const damage = applyDamage(nourishedPredatorData.tower, atk, 'physical');
                        const towerCenterX = targetTower.x + targetTower.hitbox.offsetX;
                        createDamageText(towerCenterX, GROUND_Y + 200, damage);
                    }
                }
            }
        },
        complete: function (trackIndex, count) {
            const currentAnimation = animationState.getCurrent(0)?.animation?.name.toLowerCase() || "";
            if (nourishedPredatorData.isDead && currentAnimation === "die") {
                nourishedPredatorData.deathAnimationComplete = true;
            }
            if (currentAnimation === "attack" && !nourishedPredatorData.isDead) {
                const nourishedPredatorHitbox = {
                    x: isFinite(nourishedPredatorData.worldX + nourishedPredatorData.hitbox.offsetX * (nourishedPredatorData.skeleton.scaleX || 1) - nourishedPredatorData.hitbox.width / 2) ?
                        nourishedPredatorData.worldX + nourishedPredatorData.hitbox.offsetX * (nourishedPredatorData.skeleton.scaleX || 1) - nourishedPredatorData.hitbox.width / 2 :
                        nourishedPredatorData.worldX,
                    y: nourishedPredatorData.groundY + 220 + nourishedPredatorData.hitbox.offsetY - nourishedPredatorData.hitbox.height / 2,
                    width: nourishedPredatorData.hitbox.width,
                    height: nourishedPredatorData.hitbox.height
                };

                const { colliding: isCollidingWithEnemyFlag, target: closestEnemy } = isCollidingWithEnemy(nourishedPredatorData, nourishedPredatorData.enemies || []);
                nourishedPredatorData.target = closestEnemy;
                nourishedPredatorData.isAttackingEnemy = isCollidingWithEnemyFlag;

                const isCollidingTower = isCollidingWithTower(nourishedPredatorData, nourishedPredatorData.tower);

                let isBlockedByFrontAlly = false;
                const bufferDistance = 5;
                for (let ally of nourishedPredatorData.allBotUnits || []) {
                    if (ally === nourishedPredatorData || ally.hp <= 0 || ally.isDead || ally.deathAnimationComplete) continue;
                    if ((nourishedPredatorData.direction === 1 && ally.worldX > nourishedPredatorData.worldX) ||
                        (nourishedPredatorData.direction === -1 && ally.worldX < nourishedPredatorData.worldX)) {
                        const allyHitbox = {
                            x: ally.worldX + ally.hitbox.offsetX * (ally.skeleton.scaleX || 1) - ally.hitbox.width / 2,
                            y: GROUND_Y + 220 + ally.hitbox.offsetY - ally.hitbox.height / 2,
                            width: ally.hitbox.width,
                            height: ally.hitbox.height
                        };
                        const overlapX = (nourishedPredatorData.direction === 1) ?
                            (nourishedPredatorHitbox.x + nourishedPredatorHitbox.width >= allyHitbox.x - bufferDistance) :
                            (nourishedPredatorHitbox.x <= allyHitbox.x + allyHitbox.width + bufferDistance);
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
                    nourishedPredatorData.target = closestEnemy || nourishedPredatorData.tower;
                    nourishedPredatorData.isAttackingEnemy = !!closestEnemy;
                    animationState.setAnimation(0, "Attack", false);
                    nourishedPredatorData.isInAttackState = true;
                } else if (isBlockedByFrontAlly) {
                    animationState.setAnimation(0, "Idle", true);
                    nourishedPredatorData.isInAttackState = false;
                } else {
                    animationState.setAnimation(0, "Move", true);
                    nourishedPredatorData.isInAttackState = false;
                }
            }
        }
    });

    const hitbox = {
        width: isFinite(bounds.size.x) ? bounds.size.x * 0.5 : 180,
        height: isFinite(bounds.size.y) ? bounds.size.y * 0.9 : 300,
        offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 150) ? bounds.offset.x + bounds.size.x / 2  : 150,
        offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.5 + 140) ? bounds.offset.y + bounds.size.y * 0.5 + 90 : 140
    };

    fixedDamageHitbox = {
        width: 50,
        height: 117,
        offsetX: isFinite(bounds.offset.x + bounds.size.x / 2 + 280) ? bounds.offset.x + bounds.size.x / 2 + 52 : 280,
        offsetY: isFinite(bounds.offset.y + bounds.size.y * 0.2 + 140) ? bounds.offset.y + bounds.size.y * 0.2 + 129 : 140
    };

    const nourishedPredatorData = {
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
        type: "Nourished Predator",
        atk: characterDataObj["Nourished Predator"].atk,  // Giả sử có atk, def, res từ data
        def: characterDataObj["Nourished Predator"].def || 0,
        res: characterDataObj["Nourished Predator"].res || 0,
        hp: characterDataObj["Nourished Predator"].hp,  // Giả sử có HP từ data
        maxHp: characterDataObj["Nourished Predator"].hp,
        enemies: [],
        allBotUnits: [],

        receiveDamage: function(rawDamage, type) {
            // Random né: 90% chance né hoàn toàn
            if (Math.random() < 0.9) {
                console.log(`Nourished Predator né sát thương ${rawDamage} (${type})`);
                return 0;  // Né → damage = 0
            }

            // 10% chance nhận damage: tính bình thường
            let finalDamage = rawDamage;
            if (type === 'arts') {
                finalDamage = Math.round(Math.max(rawDamage * 0.05, rawDamage * (1 - this.res / 100)));
            } else if (type === 'physical') {
                finalDamage = Math.round(Math.max(rawDamage * 0.05, rawDamage - this.def));
            }

            this.hp = Math.max(0, this.hp - finalDamage);
            console.log(`Nourished Predator nhận ${finalDamage} sát thương ${type}`);
            return finalDamage;  // Return để attacker hiển thị popup đúng
        }
    };
    nourishedPredatorData.skeleton.scaleX = nourishedPredatorData.direction;
    return nourishedPredatorData;
}

function calculateSetupPoseBounds(skeleton) {
    skeleton.setToSetupPose();
    skeleton.updateWorldTransform();
    let offset = new spine.Vector2();
    let size = new spine.Vector2();
    skeleton.getBounds(offset, size, []);
    return { offset: offset, size: size };
}

function isCollidingWithTower(nourishedPredatorData, targetTower) {
    if (!nourishedPredatorData.damageHitbox || !isFinite(nourishedPredatorData.worldX) || !isFinite(nourishedPredatorData.damageHitbox.offsetX)) {
        return false;
    }

    const nourishedPredatorDamageHitbox = {
        x: nourishedPredatorData.worldX + nourishedPredatorData.damageHitbox.offsetX * nourishedPredatorData.skeleton.scaleX - nourishedPredatorData.damageHitbox.width / 2,
        y: nourishedPredatorData.groundY + 220 + nourishedPredatorData.damageHitbox.offsetY - nourishedPredatorData.damageHitbox.height / 2,
        width: nourishedPredatorData.damageHitbox.width,
        height: nourishedPredatorData.damageHitbox.height
    };

    const towerHitbox = {
        x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
        y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
        width: targetTower.hitbox.width,
        height: targetTower.hitbox.height
    };

    return nourishedPredatorDamageHitbox.x < towerHitbox.x + towerHitbox.width &&
        nourishedPredatorDamageHitbox.x + nourishedPredatorDamageHitbox.width > towerHitbox.x &&
        nourishedPredatorDamageHitbox.y < towerHitbox.y + towerHitbox.height &&
        nourishedPredatorDamageHitbox.y + nourishedPredatorDamageHitbox.height > towerHitbox.y;
}

export function isCollidingWithEnemy(nourishedPredatorData, enemies) {
    if (!nourishedPredatorData.damageHitbox || !isFinite(nourishedPredatorData.worldX) || !isFinite(nourishedPredatorData.damageHitbox.offsetX)) {
        return { colliding: false, target: null };
    }

    const nourishedPredatorDamageHitbox = {
        x: nourishedPredatorData.worldX + nourishedPredatorData.damageHitbox.offsetX * nourishedPredatorData.skeleton.scaleX - nourishedPredatorData.damageHitbox.width / 2,
        y: nourishedPredatorData.groundY + 220 + nourishedPredatorData.damageHitbox.offsetY - nourishedPredatorData.damageHitbox.height / 2,
        width: nourishedPredatorData.damageHitbox.width,
        height: nourishedPredatorData.damageHitbox.height
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

        const isColliding = nourishedPredatorDamageHitbox.x < enemyHitbox.x + enemyHitbox.width &&
            nourishedPredatorDamageHitbox.x + nourishedPredatorDamageHitbox.width > enemyHitbox.x &&
            nourishedPredatorDamageHitbox.y < enemyHitbox.y + enemyHitbox.height &&
            nourishedPredatorDamageHitbox.y + nourishedPredatorDamageHitbox.height > enemyHitbox.y;

        if (isColliding) {
            const distance = Math.abs(nourishedPredatorData.worldX - enemy.worldX);
            if (distance < minDistance) {
                minDistance = distance;
                closestEnemy = enemy;
            }
        }
    }

    return { colliding: !!closestEnemy, target: closestEnemy };
}

export function renderNourishedPredatorSkeleton(nourishedPredatorData, delta, camera, canvas, groundTileImage, WORLD_WIDTH, GROUND_Y, TOWER_POSITIONS, backgroundCtx, gl, allBotUnits, validUnits) {
    if (!nourishedPredatorData || nourishedPredatorData.deathAnimationComplete) return;

    nourishedPredatorData.enemies = validUnits;
    nourishedPredatorData.allBotUnits = allBotUnits;

    const { skeleton, state, premultipliedAlpha } = nourishedPredatorData;
    const worldX = nourishedPredatorData.worldX;
    const hitbox = nourishedPredatorData.hitbox;
    const damageHitbox = nourishedPredatorData.damageHitbox;

    let blockedFrameCount = nourishedPredatorData.blockedFrameCount || 0;
    const DEBOUNCE_THRESHOLD = 2;
    const ADJUST_THRESHOLD = 5;

    const tower = nourishedPredatorData.tower || (nourishedPredatorData.direction === 1 ? TOWER_POSITIONS[1] : TOWER_POSITIONS[0]);
    nourishedPredatorData.tower = tower;

    const towerHitbox = {
        x: tower.x + tower.hitbox.offsetX - tower.hitbox.width / 2,
        y: tower.y + tower.hitbox.offsetY - tower.hitbox.height / 2,
        width: tower.hitbox.width,
        height: tower.hitbox.height
    };

    const isColliding = isCollidingWithTower(nourishedPredatorData, tower);
    const { colliding: isCollidingWithEnemyFlag, target: closestEnemy } = isCollidingWithEnemy(nourishedPredatorData, validUnits);
    nourishedPredatorData.target = closestEnemy;
    nourishedPredatorData.isAttackingEnemy = isCollidingWithEnemyFlag;

    let isBlockedByFrontAlly = false;
    let frontAlly = null;
    for (let ally of allBotUnits) {
        if (ally === nourishedPredatorData || ally.hp <= 0 || ally.isDead || ally.deathAnimationComplete) continue;

        const allyHitbox = {
            x: isFinite(ally.worldX + ally.hitbox.offsetX * (ally.skeleton.scaleX || 1) - ally.hitbox.width / 2) ?
                ally.worldX + ally.hitbox.offsetX * (ally.skeleton.scaleX || 1) - ally.hitbox.width / 2 :
                ally.worldX,
            y: GROUND_Y + 220 + ally.hitbox.offsetY - ally.hitbox.height / 2,
            width: ally.hitbox.width,
            height: ally.hitbox.height
        };

        if ((nourishedPredatorData.direction === 1 && ally.worldX > nourishedPredatorData.worldX) ||
            (nourishedPredatorData.direction === -1 && ally.worldX < nourishedPredatorData.worldX)) {

            const thisHitbox = {
                x: isFinite(nourishedPredatorData.worldX + nourishedPredatorData.hitbox.offsetX * (nourishedPredatorData.skeleton.scaleX || 1) - nourishedPredatorData.hitbox.width / 2) ?
                    nourishedPredatorData.worldX + nourishedPredatorData.hitbox.offsetX * (nourishedPredatorData.skeleton.scaleX || 1) - nourishedPredatorData.hitbox.width / 2 :
                    nourishedPredatorData.worldX,
                y: GROUND_Y + 220 + nourishedPredatorData.hitbox.offsetY - nourishedPredatorData.hitbox.height / 2,
                width: nourishedPredatorData.hitbox.width,
                height: nourishedPredatorData.hitbox.height
            };

            const overlapX = (nourishedPredatorData.direction === 1) ?
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
    nourishedPredatorData.blockedFrameCount = blockedFrameCount;
    const isStablyBlocked = blockedFrameCount >= DEBOUNCE_THRESHOLD;

    if (nourishedPredatorData.hp <= 0 && !nourishedPredatorData.isDead) {
        nourishedPredatorData.isDead = true;
        nourishedPredatorData.deathAnimationTimer = 0;
        const dieAnimation = state.data.skeletonData.animations.find(anim => anim.name.toLowerCase() === "die")?.name;
        if (dieAnimation) {
            state.setAnimation(0, dieAnimation, false);
            console.log(`Nourished Predator tại worldX=${worldX} bắt đầu animation Die`);
        } else {
            console.error("Animation Die not found for Nourished Predator");
            nourishedPredatorData.deathAnimationComplete = true;
        }
        nourishedPredatorData.isInAttackState = false;
        return;
    }

    if (nourishedPredatorData.isDead) {
        nourishedPredatorData.deathAnimationTimer += delta;
        if (nourishedPredatorData.deathAnimationTimer >= 1.0) {
            nourishedPredatorData.deathAnimationComplete = true;
        }
    } else {
        const currentAnimation = state.getCurrent(0)?.animation?.name.toLowerCase() || "";
        if ((isCollidingWithEnemyFlag || isColliding) && !nourishedPredatorData.isInAttackState && currentAnimation !== "attack") {
            const attackAnimation = state.data.skeletonData.animations.find(anim => anim.name.toLowerCase() === "attack")?.name;
            if (attackAnimation) {
                state.setAnimation(0, attackAnimation, false);
                nourishedPredatorData.isInAttackState = true;
            }
        } else if (isStablyBlocked && !nourishedPredatorData.isInAttackState && currentAnimation !== "idle") {
            const idleAnimation = state.data.skeletonData.animations.find(anim => anim.name.toLowerCase() === "idle")?.name;
            if (idleAnimation) {
                state.setAnimation(0, idleAnimation, true);
                nourishedPredatorData.isInAttackState = false;
            }
        } else if (!isCollidingWithEnemyFlag && !isColliding && !isStablyBlocked && !nourishedPredatorData.isInAttackState && currentAnimation !== "move") {
            const moveAnimation = state.data.skeletonData.animations.find(anim => anim.name.toLowerCase() === "move")?.name;
            if (moveAnimation) {
                state.setAnimation(0, moveAnimation, true);
                nourishedPredatorData.isInAttackState = false;
            }
        }
    }

    state.update(delta);
    state.apply(skeleton);

    if (!isCollidingWithEnemyFlag && !isColliding && !isStablyBlocked && !nourishedPredatorData.isDead && !nourishedPredatorData.isInAttackState) {
        nourishedPredatorData.worldX += nourishedPredatorData.velocity * delta * nourishedPredatorData.direction;
    } else if (isStablyBlocked && !nourishedPredatorData.isDead && frontAlly) {
        const thisHitbox = {
            x: isFinite(nourishedPredatorData.worldX + nourishedPredatorData.hitbox.offsetX * (nourishedPredatorData.skeleton.scaleX || 1) - nourishedPredatorData.hitbox.width / 2) ?
                nourishedPredatorData.worldX + nourishedPredatorData.hitbox.offsetX * (nourishedPredatorData.skeleton.scaleX || 1) - nourishedPredatorData.hitbox.width / 2 :
                nourishedPredatorData.worldX,
            y: GROUND_Y + 220 + nourishedPredatorData.hitbox.offsetY - nourishedPredatorData.hitbox.height / 2,
            width: nourishedPredatorData.hitbox.width,
            height: nourishedPredatorData.hitbox.height
        };

        const otherHitbox = {
            x: frontAlly.worldX + frontAlly.hitbox.offsetX * (frontAlly.skeleton.scaleX || 1) - frontAlly.hitbox.width / 2,
            y: GROUND_Y + 220 + frontAlly.hitbox.offsetY - frontAlly.hitbox.height / 2,
            width: frontAlly.hitbox.width,
            height: frontAlly.hitbox.height
        };

        let currentDistance;
        if (nourishedPredatorData.direction === 1) {
            currentDistance = otherHitbox.x - (thisHitbox.x + thisHitbox.width);
        } else {
            currentDistance = (thisHitbox.x - otherHitbox.x - otherHitbox.width);
        }

        if (Math.abs(currentDistance) > ADJUST_THRESHOLD) {
            let newWorldX = otherHitbox.x + (nourishedPredatorData.direction === 1 ? -nourishedPredatorData.hitbox.width : otherHitbox.width)
                - nourishedPredatorData.hitbox.offsetX * (nourishedPredatorData.skeleton.scaleX || 1) + nourishedPredatorData.hitbox.width / 2;
            nourishedPredatorData.worldX = newWorldX;
        }
    }

    skeleton.x = nourishedPredatorData.worldX - camera.x;
    skeleton.y = canvas.height - (GROUND_Y + 425);
    skeleton.scaleX = nourishedPredatorData.direction;

    if (nourishedPredatorData.direction === 1 && nourishedPredatorData.worldX > towerHitbox.x - hitbox.width) {
        nourishedPredatorData.worldX = towerHitbox.x - hitbox.width;
    } else if (nourishedPredatorData.direction === -1 && nourishedPredatorData.worldX < towerHitbox.x + towerHitbox.width) {
        nourishedPredatorData.worldX = towerHitbox.x + towerHitbox.width;
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

    const nourishedPredatorHitbox = {
        x: isFinite(nourishedPredatorData.worldX + nourishedPredatorData.hitbox.offsetX * (nourishedPredatorData.skeleton.scaleX || 1) - nourishedPredatorData.hitbox.width / 2) ?
            nourishedPredatorData.worldX + nourishedPredatorData.hitbox.offsetX * (nourishedPredatorData.skeleton.scaleX || 1) - nourishedPredatorData.hitbox.width / 2 :
            nourishedPredatorData.worldX,
        y: nourishedPredatorData.groundY + 220 + nourishedPredatorData.hitbox.offsetY - nourishedPredatorData.hitbox.height / 2,
        width: nourishedPredatorData.hitbox.width,
        height: nourishedPredatorData.hitbox.height
    };

    const nourishedPredatorDamageHitbox = {
        x: nourishedPredatorData.worldX + nourishedPredatorData.damageHitbox.offsetX * nourishedPredatorData.skeleton.scaleX - nourishedPredatorData.damageHitbox.width / 2,
        y: nourishedPredatorData.groundY + 220 + nourishedPredatorData.damageHitbox.offsetY - nourishedPredatorData.damageHitbox.height / 2,
        width: nourishedPredatorData.damageHitbox.width,
        height: nourishedPredatorData.damageHitbox.height
    };

    // backgroundCtx.fillStyle = "rgba(255, 0, 0, 0.3)";
    // backgroundCtx.fillRect(
    //     nourishedPredatorHitbox.x - camera.x,
    //     nourishedPredatorHitbox.y,
    //     nourishedPredatorHitbox.width,
    //     nourishedPredatorHitbox.height
    // );

    // if (isFinite(nourishedPredatorDamageHitbox.x) && !nourishedPredatorData.isDead) {
    //     backgroundCtx.fillStyle = "rgba(255, 165, 0, 0.3)";
    //     backgroundCtx.fillRect(
    //         nourishedPredatorDamageHitbox.x - camera.x,
    //         nourishedPredatorDamageHitbox.y,
    //         nourishedPredatorDamageHitbox.width,
    //         nourishedPredatorDamageHitbox.height
    //     );
    // }
}

export function resizeNourishedPredator(canvas, camera, gl) {
    gl.viewport(0, 0, canvas.width, canvas.height);
}

export function isOverlappingWithOtherNourishedPredator(newHitbox, existingNourishedPredators, GROUND_Y) {
    for (let existing of existingNourishedPredators) {
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