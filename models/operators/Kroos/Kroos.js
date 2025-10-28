import { characterDataObj } from '../../../character.js';
import { createDamageText, GROUND_Y } from '../../../render.js';

let shader, batcher, mvp, skeletonRenderer, assetManager;
let currentSkelPath = "assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.skel";
let currentAtlasPath = "assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.atlas";
let isSwitchingSkeleton = false;
let hasLoggedKroosPosition = false;
let fixedDamageHitbox = null;
let projectileImages = [];
// Lưu thông tin animation Attack
let attackAnimationInfo = null;

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

    assetManager.loadBinary("assets/operators/Kroos/KroosWitch/build_char_124_kroos_witch1.skel");
    assetManager.loadTextureAtlas("assets/operators/Kroos/KroosWitch/build_char_124_kroos_witch1.atlas");
    assetManager.loadTexture("assets/operators/Kroos/KroosWitch/build_char_124_kroos_witch1.png");
    assetManager.loadBinary("assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.skel");
    assetManager.loadTextureAtlas("assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.atlas");
    assetManager.loadTexture("assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.png");

    const projectileSources = [
        "assets/operators/Kroos/KroosWitch/C_Sugar_1.png",
        "assets/operators/Kroos/KroosWitch/C_Sugar_2.png",
        "assets/operators/Kroos/KroosWitch/C_Sugar_3.png"
    ];
    projectileImages = projectileSources.map(src => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            console.log(`Hình ảnh ${src} đã được tải thành công`);
        };
        img.onerror = () => {
            console.error(`Không thể tải hình ảnh ${src}`);
        };
        return img;
    });
}

export function isKroosLoadingComplete() {
    return assetManager && assetManager.isLoadingComplete() && projectileImages.every(img => img && img.complete);
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

    // Lấy thông tin animation Attack
    const attackAnim = skeletonDataRaw.animations.find(anim => anim.name === "Attack");
    if (attackAnim) {
        const onAttackEvent = attackAnim.events?.find(e => e.data.name === "OnAttack");
        attackAnimationInfo = {
            duration: attackAnim.duration,
            onAttackTime: onAttackEvent ? onAttackEvent.time : 0
        };
        console.log(`Animation Attack: Duration=${attackAnimationInfo.duration} giây, OnAttack tại=${attackAnimationInfo.onAttackTime} giây`);
    } else {
        console.warn("Animation Attack không tìm thấy, sử dụng giá trị mặc định");
        attackAnimationInfo = { duration: 1.8, onAttackTime: 0.5 }; // Giá trị dự phòng
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
        isInStartAnimation: true,
        currentSkelPath,
        currentAtlasPath,
        direction: 1,
        velocity: 0,
        target: null,
        isAttackingEnemy: false,
        isDead: false,
        deathAnimationTimer: 0,
        deathAnimationComplete: false,
        groundY: GROUND_Y,
        type: "Kroos",
        projectiles: []
    };

    animationState.addListener({
        complete: function (trackIndex, count) {
            const currentAnimation = animationState.getCurrent(0)?.animation?.name.toLowerCase();
            if (currentAnimation === "start" && !kroosData.isDead) {
                kroosData.isInStartAnimation = false;
                switchSkeletonFile(
                    kroosData,
                    "assets/operators/Kroos/KroosWitch/build_char_124_kroos_witch1.skel",
                    "assets/operators/Kroos/KroosWitch/build_char_124_kroos_witch1.atlas",
                    "Move",
                    (success) => {
                        if (success) {
                            kroosData.velocity = 50;
                            console.log("Kroos switched to Move animation");
                        } else {
                            console.error("Failed to switch to Move skeleton for Kroos");
                            kroosData.state.setAnimation(0, "Idle", true);
                        }
                    }
                );
            }

            if (kroosData.isDead && currentAnimation === "die") {
                kroosData.deathAnimationComplete = true;
            }

            if (currentAnimation === "attack" && !kroosData.isDead) {
                const target = kroosData.target;

                // Kiểm tra nếu target vẫn còn sống và trong tầm
                const stillHasTarget = target && target.hp > 0 &&
                    (kroosData.isAttackingEnemy
                        ? isCollidingWithEnemy(kroosData, target)
                        : isCollidingWithTower(kroosData, kroosData.tower));

                if (stillHasTarget) {
                    // Tấn công tiếp
                    kroosData.state.setAnimation(0, "Attack", false);
                    kroosData.currentAnimation = "attack";
                } else {
                    // Hết mục tiêu: chuyển về Move/Idle
                    kroosData.isInAttackState = false;
                    kroosData.target = null;
                    kroosData.isAttackingEnemy = false;

                    switchSkeletonFile(
                        kroosData,
                        "assets/operators/Kroos/KroosWitch/build_char_124_kroos_witch1.skel",
                        "assets/operators/Kroos/KroosWitch/build_char_124_kroos_witch1.atlas",
                        "Move",
                        (success) => {
                            if (success) {
                                kroosData.velocity = 50;
                                kroosData.currentAnimation = "move";
                                console.log("Kroos switched to Move animation after Attack finished");
                            } else {
                                kroosData.state.setAnimation(0, "Idle", true);
                                kroosData.currentAnimation = "idle";
                            }
                        }
                    );
                }
            }
        },
        event: function (trackIndex, event) {
            if (event.data.name === "OnAttack" && kroosData.isInAttackState && kroosData) {
                kroosData.attackCount++;
                let baseDamage = characterDataObj["Kroos"].atk;
                let damage1, damage2, totalDamage;

                // Tính sát thương dựa trên mục tiêu
                if (kroosData.target && kroosData.isAttackingEnemy) {
                    // Mục tiêu là kẻ địch
                    const targetDef = characterDataObj[kroosData.target.type]?.def || 0;
                    if (kroosData.attackCount === 5) {
                        damage1 = Math.round(Math.max(baseDamage * 0.2 * 1.4, baseDamage * 1.4 - targetDef));
                        damage2 = Math.round(Math.max(baseDamage * 0.2 * 1.4, baseDamage * 1.4 - targetDef));
                        totalDamage = damage1 + damage2;
                        kroosData.attackCount = 0;
                    } else {
                        damage1 = Math.round(Math.max(baseDamage * 0.2, baseDamage - targetDef));
                        damage2 = 0;
                        totalDamage = damage1;
                    }
                } else {
                    // Mục tiêu là tháp
                    const targetTower = kroosData.tower;
                    const towerDef = targetTower.def || 0; // Giả sử tháp có def = 0 nếu không có dữ liệu
                    if (kroosData.attackCount === 5) {
                        damage1 = Math.round(Math.max(baseDamage * 0.2 * 1.4, baseDamage * 1.4 - towerDef));
                        damage2 = Math.round(Math.max(baseDamage * 0.2 * 1.4, baseDamage * 1.4 - towerDef));
                        totalDamage = damage1 + damage2;
                        kroosData.attackCount = 0;
                    } else {
                        damage1 = Math.round(Math.max(baseDamage * 0.2, baseDamage - towerDef));
                        damage2 = 0;
                        totalDamage = damage1;
                    }
                }

                let targetHitbox;
                let targetCenterX, targetCenterY;
                if (kroosData.target && kroosData.isAttackingEnemy) {
                    targetHitbox = {
                        x: isFinite(kroosData.target.worldX + kroosData.target.hitbox.offsetX * (kroosData.target.skeleton.scaleX || 1) - kroosData.target.hitbox.width / 2) ?
                            kroosData.target.worldX + kroosData.target.hitbox.offsetX * (kroosData.target.skeleton.scaleX || 1) - kroosData.target.hitbox.width / 2 :
                            kroosData.target.worldX,
                        y: kroosData.target.groundY + 220 + kroosData.target.hitbox.offsetY - kroosData.target.hitbox.height / 2,
                        width: kroosData.target.hitbox.width,
                        height: kroosData.target.hitbox.height
                    };
                } else {
                    const targetTower = kroosData.tower;
                    targetHitbox = {
                        x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
                        y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
                        width: targetTower.hitbox.width,
                        height: targetTower.hitbox.height
                    };
                }
                targetCenterX = targetHitbox.x + targetHitbox.width / 2;
                targetCenterY = targetHitbox.y + targetHitbox.height / 2;

                const kroosHitbox = {
                    x: isFinite(kroosData.worldX + kroosData.hitbox.offsetX * (kroosData.skeleton.scaleX || 1) - kroosData.hitbox.width / 2) ?
                        kroosData.worldX + kroosData.hitbox.offsetX * (kroosData.skeleton.scaleX || 1) - kroosData.hitbox.width / 2 :
                        kroosData.worldX,
                    y: kroosData.groundY + 220 + kroosData.hitbox.offsetY - kroosData.hitbox.height / 2,
                    width: kroosData.hitbox.width,
                    height: kroosData.hitbox.height
                };
                const projectileX = kroosData.direction === 1 ?
                    kroosHitbox.x + kroosHitbox.width : kroosHitbox.x;
                const projectileY = kroosHitbox.y + kroosHitbox.height / 2 - 15;
                const dx = targetCenterX - projectileX;
                const dy = targetCenterY - projectileY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const speed = 500; // Tốc độ cố định 500 pixel/giây
                const randomImage = projectileImages[Math.floor(Math.random() * projectileImages.length)];
                const projectile = {
                    worldX: projectileX,
                    y: projectileY,
                    velocityX: distance > 0 ? (dx / distance) * speed : 0,
                    velocityY: distance > 0 ? (dy / distance) * speed : 0,
                    active: true,
                    damage: totalDamage,
                    damage1: damage1, // Lưu sát thương riêng cho lần 1
                    damage2: damage2, // Lưu sát thương riêng cho lần 2
                    target: kroosData.target,
                    targetCenterX: targetCenterX,
                    targetCenterY: targetCenterY,
                    image: randomImage
                };
                kroosData.projectiles.push(projectile);
                console.log(`Projectile bắn ra từ Kroos tại (${projectileX}, ${projectileY}) hướng đến (${targetCenterX}, ${targetCenterY}) với tốc độ ${speed} pixel/giây, tổng sát thương ${totalDamage} (damage1: ${damage1}, damage2: ${damage2})`);
            }
        }
    });

    fixedDamageHitbox = kroosData.damageHitbox;
    return kroosData;
}

function isCollidingWithTower(kroosData, targetTower) {
    if (!kroosData.damageHitbox || !isFinite(kroosData.worldX) || !isFinite(kroosData.damageHitbox.offsetX)) {
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
        if (callback) callback(false);
        return false;
    }

    if (kroosData.currentSkelPath === newSkelPath && kroosData.currentAtlasPath === newAtlasPath) {
        const animationToUse = kroosData.skeleton.data.animations.find(anim => anim.name.toLowerCase() === initialAnimation.toLowerCase())?.name;
        if (animationToUse) {
            kroosData.state.setAnimation(0, animationToUse, initialAnimation.toLowerCase() === "Die" ? false : true);
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

                // Lấy thông tin animation Attack cho skeleton mới
                if (newSkelPath === "assets/operators/Kroos/KroosWitch/char_124_kroos_witch1.skel") {
                    const attackAnim = newSkeletonData.animations.find(anim => anim.name === "Attack");
                    if (attackAnim) {
                        const onAttackEvent = attackAnim.events?.find(e => e.data.name === "OnAttack");
                        attackAnimationInfo = {
                            duration: attackAnim.duration,
                            onAttackTime: onAttackEvent ? onAttackEvent.time : 0
                        };
                        console.log(`Animation Attack (new skeleton): Duration=${attackAnimationInfo.duration} giây, OnAttack tại=${attackAnimationInfo.onAttackTime} giây`);
                    } else {
                        console.warn("Animation Attack không tìm thấy trong skeleton mới, giữ giá trị hiện tại");
                    }
                }

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
                            kroosData.attackCount++;
                            let baseDamage = characterDataObj["Kroos"].atk;
                            let damage1, damage2, totalDamage;

                            // Tính sát thương dựa trên mục tiêu
                            if (kroosData.target && kroosData.isAttackingEnemy) {
                                // Mục tiêu là kẻ địch
                                const targetDef = characterDataObj[kroosData.target.type]?.def || 0;
                                if (kroosData.attackCount === 5) {
                                    damage1 = Math.round(Math.max(baseDamage * 0.2 * 1.4, baseDamage * 1.4 - targetDef));
                                    damage2 = Math.round(Math.max(baseDamage * 0.2 * 1.4, baseDamage * 1.4 - targetDef));
                                    totalDamage = damage1 + damage2;
                                    kroosData.attackCount = 0;
                                } else {
                                    damage1 = Math.round(Math.max(baseDamage * 0.2, baseDamage - targetDef));
                                    damage2 = 0;
                                    totalDamage = damage1;
                                }
                            } else {
                                // Mục tiêu là tháp
                                const targetTower = kroosData.tower;
                                const towerDef = targetTower.def || 0; // Giả sử tháp có def = 0 nếu không có dữ liệu
                                if (kroosData.attackCount === 5) {
                                    damage1 = Math.round(Math.max(baseDamage * 0.2 * 1.4, baseDamage * 1.4 - towerDef));
                                    damage2 = Math.round(Math.max(baseDamage * 0.2 * 1.4, baseDamage * 1.4 - towerDef));
                                    totalDamage = damage1 + damage2;
                                    kroosData.attackCount = 0;
                                } else {
                                    damage1 = Math.round(Math.max(baseDamage * 0.2, baseDamage - towerDef));
                                    damage2 = 0;
                                    totalDamage = damage1;
                                }
                            }

                            let targetHitbox;
                            let targetCenterX, targetCenterY;
                            if (kroosData.target && kroosData.isAttackingEnemy) {
                                targetHitbox = {
                                    x: isFinite(kroosData.target.worldX + kroosData.target.hitbox.offsetX * (kroosData.target.skeleton.scaleX || 1) - kroosData.target.hitbox.width / 2) ?
                                        kroosData.target.worldX + kroosData.target.hitbox.offsetX * (kroosData.target.skeleton.scaleX || 1) - kroosData.target.hitbox.width / 2 :
                                        kroosData.target.worldX,
                                    y: kroosData.target.groundY + 220 + kroosData.target.hitbox.offsetY - kroosData.target.hitbox.height / 2,
                                    width: kroosData.target.hitbox.width,
                                    height: kroosData.target.hitbox.height
                                };
                            } else {
                                const targetTower = kroosData.tower;
                                targetHitbox = {
                                    x: targetTower.x + targetTower.hitbox.offsetX - targetTower.hitbox.width / 2,
                                    y: targetTower.y + targetTower.hitbox.offsetY - targetTower.hitbox.height / 2,
                                    width: targetTower.hitbox.width,
                                    height: targetTower.hitbox.height
                                };
                            }
                            targetCenterX = targetHitbox.x + targetHitbox.width / 2;
                            targetCenterY = targetHitbox.y + targetHitbox.height / 2;

                            const kroosHitbox = {
                                x: isFinite(kroosData.worldX + kroosData.hitbox.offsetX * (kroosData.skeleton.scaleX || 1) - kroosData.hitbox.width / 2) ?
                                    kroosData.worldX + kroosData.hitbox.offsetX * (kroosData.skeleton.scaleX || 1) - kroosData.hitbox.width / 2 :
                                    kroosData.worldX,
                                y: kroosData.groundY + 220 + kroosData.hitbox.offsetY - kroosData.hitbox.height / 2,
                                width: kroosData.hitbox.width,
                                height: kroosData.hitbox.height
                            };
                            const projectileX = kroosData.direction === 1 ?
                                kroosHitbox.x + kroosHitbox.width : kroosHitbox.x;
                            const projectileY = kroosHitbox.y + kroosHitbox.height / 2 - 15;
                            const dx = targetCenterX - projectileX;
                            const dy = targetCenterY - projectileY;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            const speed = 500; // Tốc độ cố định 500 pixel/giây
                            const randomImage = projectileImages[Math.floor(Math.random() * projectileImages.length)];
                            const projectile = {
                                worldX: projectileX,
                                y: projectileY,
                                velocityX: distance > 0 ? (dx / distance) * speed : 0,
                                velocityY: distance > 0 ? (dy / distance) * speed : 0,
                                active: true,
                                damage: totalDamage,
                                damage1: damage1,
                                damage2: damage2,
                                target: kroosData.target,
                                targetCenterX: targetCenterX,
                                targetCenterY: targetCenterY,
                                image: randomImage
                            };
                            kroosData.projectiles.push(projectile);
                            console.log(`Projectile bắn ra từ Kroos tại (${projectileX}, ${projectileY}) hướng đến (${targetCenterX}, ${targetCenterY}) với tốc độ ${speed} pixel/giây, tổng sát thương ${totalDamage} (damage1: ${damage1}, damage2: ${damage2})`);
                        }
                    },
                    complete: function (trackIndex, count) {
                        if (kroosData.isDead && animationState.getCurrent(0).animation.name.toLowerCase() === "Die") {
                            kroosData.deathAnimationComplete = true;
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

export function renderKroosSkeleton(kroosData, delta, camera, canvas, groundTileImage, WORLD_WIDTH, GROUND_Y, TOWER_POSITIONS, backgroundCtx, gl, allAllies, enemies) {
    if (!kroosData) {
        console.error("kroosData không tồn tại");
        return;
    }

    const { skeleton, state, premultipliedAlpha, bounds, worldX, hitbox, damageHitbox } = kroosData;
    state.update(delta);

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

    if (kroosData.isDead && !kroosData.deathAnimationComplete) {
        kroosData.deathAnimationTimer += delta;
        if (kroosData.deathAnimationTimer >= 1.0) {
            kroosData.deathAnimationComplete = true;
            console.log(`Animation Die hoàn tất (theo timer) cho Kroos tại worldX=${kroosData.worldX}`);
        }
    }

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

        let closestEnemy = null;
        let minDistance = Infinity;
        validEnemies.forEach(enemy => {
            if (enemy && enemy.hp > 0 && isCollidingWithEnemy(kroosData, enemy)) {
                const distance = Math.abs(kroosData.worldX - enemy.worldX);
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

        // backgroundCtx.fillStyle = "blue";
        // const dotRadius = 5;
        // const dotX = kroosData.direction === 1 ? 
        //     kroosHitbox.x + kroosHitbox.width - camera.x : kroosHitbox.x - camera.x;
        // const dotY = kroosHitbox.y + kroosHitbox.height / 2 - 15;
        // backgroundCtx.beginPath();
        // backgroundCtx.arc(dotX, dotY, dotRadius, 0, 2 * Math.PI);
        // backgroundCtx.fill();

        // if (isFinite(kroosDamageHitbox.x) && !kroosData.isDead) {
        //     backgroundCtx.fillStyle = "rgba(255, 165, 0, 0.3)";
        //     backgroundCtx.fillRect(
        //         kroosDamageHitbox.x - camera.x,
        //         kroosDamageHitbox.y,
        //         kroosDamageHitbox.width,
        //         kroosDamageHitbox.height
        //     );
        // }

        if (projectileImages.every(img => img && img.complete)) {
            kroosData.projectiles = kroosData.projectiles.filter(projectile => projectile.active);
            kroosData.projectiles.forEach(projectile => {
                projectile.worldX += projectile.velocityX * delta;
                projectile.y += projectile.velocityY * delta;

                // Kiểm tra nếu mục tiêu đã chết
                if (kroosData.isDead || (projectile.target && projectile.target.hp <= 0)) {
                    projectile.active = false;
                    console.log("Projectile bị xóa vì Kroos hoặc mục tiêu đã chết");
                    return;
                } else if (projectile.target && projectile.target.hp > 0) {
                    // Kiểm tra nếu đạn chạm mục tiêu
                    const dx = projectile.worldX - projectile.targetCenterX;
                    const dy = projectile.y - projectile.targetCenterY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const threshold = 5;
                    if (distance < threshold) {
                        projectile.target.hp = Math.max(0, projectile.target.hp - projectile.damage);

                        // Phân chia logic hiển thị damage text cho bot và tháp
                        if (projectile.target !== kroosData.tower) {
                            // Mục tiêu là tháp
                            createDamageText(
                                projectile.targetCenterX,
                                GROUND_Y + 300, // Đồng bộ độ cao với Surtr
                                projectile.damage1,
                            );
                            if (projectile.damage2 > 0) {
                                createDamageText(
                                    projectile.targetCenterX,
                                    GROUND_Y + 320, // Offset nhẹ cho damage2
                                    projectile.damage2,
                                );
                            }
                            console.log(`Projectile chạm tháp tại (${projectile.targetCenterX}, ${GROUND_Y + 200}), gây tổng sát thương ${projectile.damage} (damage1: ${projectile.damage1}, damage2: ${projectile.damage2})`);
                        } else {
                            // Mục tiêu là bot
                            createDamageText(
                                projectile.targetCenterX,
                                GROUND_Y + 200, // Giữ độ cao như logic gốc
                                projectile.damage1,
                            );
                            if (projectile.damage2 > 0) {
                                createDamageText(
                                    projectile.targetCenterX,
                                    GROUND_Y + 220, // Offset nhẹ cho damage2
                                    projectile.damage2,
                                );
                            }
                            console.log(`Projectile chạm bot tại (${projectile.targetCenterX}, ${GROUND_Y + 300}), gây tổng sát thương ${projectile.damage} (damage1: ${projectile.damage1}, damage2: ${projectile.damage2})`);
                        }
                        projectile.active = false;
                    }
                }

                // Vẽ đạn nếu vẫn hoạt động
                if (projectile.active) {
                    const scaledWidth = projectile.image.width * 0.5;
                    const scaledHeight = projectile.image.height * 0.5;
                    backgroundCtx.drawImage(projectile.image, projectile.worldX - camera.x, projectile.y, scaledWidth, scaledHeight);
                }
            });
        } else {
            console.warn("Một hoặc nhiều hình ảnh projectile chưa tải hoàn tất, bỏ qua vẽ projectile");
        }
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