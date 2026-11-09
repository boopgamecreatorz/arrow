const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("status");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const GRAVITY = 1500;
const MOVE_SPEED = 320;
const ACCELERATION = 1800;
const FRICTION = 1800;
const JUMP_FORCE = 600;
const BALL_RADIUS = 16;

const PLAYER_SHOT_SPEED = 780;
let PLAYER_SHOT_COOLDOWN = 0.25;
const ENEMY_SHOT_SPEED = 620;

const MOVING_PLATFORM_SPEED = 95;
const MOVING_PLATFORM_COOLDOWN = 2.2;

let currentLevelIndex = 0;
let level;
let cameraX = 0;
let cameraY = 0;
let gameWon = false;

let facing = 1;
let shootQueued = false;
let shootCooldown = 0;
let jumpQueued = false;
let platformQueued = false;
let platformCooldown = 0;

let nextPlatformId = 1;
let ridingPlatformId = null;

let dying = false;
let deathTimer = 0;

let particles = [];
let playerShots = [];
let enemyShots = [];
let movingPlatforms = [];
let enemies = [];

let currentSpikes = [];
let currentGrayPlatforms = [];

const keys = {
    left: false,
    right: false
};

const player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: BALL_RADIUS,
    grounded: false
};


// ---------------- LEVEL LOADING ----------------

function loadLevel(index) {
    if (index >= LEVELS.length) {
        gameWon = true;
        statusText.textContent =
            "YOU COMPLETED ALL 3 LEVELS! Press R to replay.";
        return;
    }

    currentLevelIndex = index;
    level = LEVELS[index];
    gameWon = false;

    dying = false;
    deathTimer = 0;

    particles = [];
    playerShots = [];
    enemyShots = [];
    movingPlatforms = [];

    ridingPlatformId = null;
    nextPlatformId = 1;
    platformCooldown = 0;

    currentSpikes = (level.spikes || []).map(p => ({ ...p }));

    currentGrayPlatforms = [];

    for (const p of (level.grayPlatforms || [])) {
        for (let x = p.x; x < p.x + p.w - 8; x += 26) {
            currentGrayPlatforms.push({
                x,
                y: p.y,
                w: Math.min(24, p.x + p.w - x),
                h: p.h
            });
        }
    }

    enemies = (level.enemies || []).map(e => ({
        ...e,
        fireRate: Math.max(0.22, e.fireRate * 0.65),
        hp: 2,
        alive: true,
        direction: Math.random() < 0.5 ? -1 : 1,
        cooldown: Math.max(0.22, e.fireRate * 0.65) *
            (0.35 + Math.random() * 0.4),
        vy: 0,
        floatTime: 0,

        // Green enemies can hover independently.
        floatBaseY: e.y,
        floatPhase: Math.random() * Math.PI * 2,
        floatAmplitude: 24
    }));

    player.x = level.start.x;
    player.y = level.start.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;

    facing = 1;

    shootCooldown = 0;
    shootQueued = false;
    jumpQueued = false;
    platformQueued = false;

    cameraX = 0;

    cameraY = Math.max(
        0,
        Math.min(level.worldHeight - HEIGHT, player.y - HEIGHT * 0.62)
    );

    statusText.textContent = level.name + " — Find the next floor!";
}

function restartLevel() {
    loadLevel(gameWon ? 0 : currentLevelIndex);
}


// ---------------- CONTROLS ----------------

window.addEventListener("keydown", e => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
    }

    if (e.key === "ArrowLeft") keys.left = true;
    if (e.key === "ArrowRight") keys.right = true;

    if (e.key === "ArrowUp" && !e.repeat) {
        jumpQueued = true;
    }

    if (e.key.toLowerCase() === "e" && !e.repeat) {
        shootQueued = true;
    }

    if (e.key.toLowerCase() === "t" && !e.repeat) {
        platformQueued = true;
    }

    if (e.key.toLowerCase() === "r" && !e.repeat) {
        restartLevel();
    }
    if (e.key === "0") PLAYER_SHOT_COOLDOWN = Math.min(1.5, PLAYER_SHOT_COOLDOWN + 0.1);
if (e.key === "1") PLAYER_SHOT_COOLDOWN = Math.max(0.05, PLAYER_SHOT_COOLDOWN - 0.1);
});

window.addEventListener("keyup", e => {
    if (e.key === "ArrowLeft") keys.left = false;
    if (e.key === "ArrowRight") keys.right = false;
});

window.addEventListener("blur", () => {
    keys.left = false;
    keys.right = false;

    jumpQueued = false;
    shootQueued = false;
    platformQueued = false;
});


// ---------------- COLLISIONS ----------------

function overlaps(a, b) {
    const w = b.w ?? b.width;
    const h = b.h ?? b.height;

    return (
        a.x < b.x + w &&
        a.x + a.w > b.x &&
        a.y < b.y + h &&
        a.y + a.h > b.y
    );
}

function getPlayerBox() {
    return {
        x: player.x - player.radius,
        y: player.y - player.radius,
        w: player.radius * 2,
        h: player.radius * 2
    };
}

function circleRect(x, y, r, p) {
    const cx = Math.max(p.x, Math.min(x, p.x + p.w));
    const cy = Math.max(p.y, Math.min(y, p.y + p.h));

    return (
        (x - cx) ** 2 +
        (y - cy) ** 2 <= r * r
    );
}

function circleCircle(a, b) {
    return (
        (a.x - b.x) ** 2 +
        (a.y - b.y) ** 2 <=
        (a.radius + b.radius) ** 2
    );
}

function handleCollisions(axis) {
    const box = getPlayerBox();

    for (const p of [...level.platforms, ...currentGrayPlatforms]) {
        if (!overlaps(box, p)) continue;

        if (axis === "x") {
            if (player.vx > 0) {
                player.x = p.x - player.radius;
            } else if (player.vx < 0) {
                player.x = p.x + p.w + player.radius;
            }

            player.vx = 0;
        } else {
            if (player.vy > 0) {
                player.y = p.y - player.radius;
                player.grounded = true;
            } else if (player.vy < 0) {
                player.y = p.y + p.h + player.radius;
            }

            player.vy = 0;
        }

        Object.assign(box, getPlayerBox());
    }
}


// ---------------- PARTICLES ----------------

function createParticles(x, y, amount = 20, color = "white") {
    for (let i = 0; i < amount; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = 100 + Math.random() * 300;
        const life = 0.55 + Math.random() * 0.4;

        particles.push({
            x,
            y,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            radius: 2 + Math.random() * 3,
            color,
            life,
            maxLife: life
        });
    }
}

function updateParticles(dt) {
    for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 350 * dt;
        p.life -= dt;
    }

    particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);

        ctx.fillStyle = p.color;
        ctx.fill();

        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "black";
        ctx.stroke();
    }

    ctx.globalAlpha = 1;
}


// ---------------- PLAYER DEATH ----------------

function triggerDeath() {
    if (dying || gameWon) return;

    dying = true;
    deathTimer = 0.85;

    createParticles(player.x, player.y, 40, "white");
}


// ---------------- PLAYER SHOOTING ----------------

function isAimingUp() {
    return !player.grounded;
}

function firePlayerShot() {
    const up = isAimingUp();

    playerShots.push({
        x: player.x + (up ? 0 : facing * (player.radius + 8)),
        y: player.y + (up ? -player.radius - 8 : 0),

        vx: up ? 0 : facing * PLAYER_SHOT_SPEED,
        vy: up ? -PLAYER_SHOT_SPEED : 0,

        radius: 5,
        dead: false
    });

    shootCooldown = PLAYER_SHOT_COOLDOWN;
}


// ---------------- T PLATFORMS ----------------

function fireMovingPlatform() {
    const up = isAimingUp();
    const w = 86;

    // Maximum of two active T platforms.
    while (movingPlatforms.length >= 2) {
        const old = movingPlatforms.shift();

        createParticles(
            old.x + old.w / 2,
            old.y + old.h / 2,
            15,
            "#d6a84b"
        );

        if (ridingPlatformId === old.id) {
            ridingPlatformId = null;
            player.grounded = false;
        }
    }

    movingPlatforms.push({
        id: nextPlatformId++,

        x: up
            ? player.x - w / 2
            : player.x + facing * 38 - (facing < 0 ? w : 0),

        y: up
            ? player.y + player.radius + 18
            : player.y + 18,

        w,
        h: 13,

        vx: up ? 0 : facing * MOVING_PLATFORM_SPEED,
        vy: up ? -MOVING_PLATFORM_SPEED : 0,

        prevX: 0,
        prevY: 0,

        life: 14,
        dead: false
    });

    platformCooldown = MOVING_PLATFORM_COOLDOWN;
}

function updateMovingPlatforms(dt) {
    for (const p of movingPlatforms) {
        p.prevX = p.x;
        p.prevY = p.y;

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        p.life -= dt;

        // Break when reaching either side wall.
        if (
            p.x <= 0 ||
            p.x + p.w >= level.worldWidth
        ) {
            p.dead = true;

            createParticles(
                Math.max(
                    0,
                    Math.min(level.worldWidth, p.x + p.w / 2)
                ),
                p.y + p.h / 2,
                22,
                "#d6a84b"
            );

            if (ridingPlatformId === p.id) {
                ridingPlatformId = null;
                player.grounded = false;
                player.vy = 0;
            }
        }
    }

    movingPlatforms = movingPlatforms.filter(p =>
        !p.dead &&
        p.life > 0 &&
        p.x + p.w > -100 &&
        p.x < level.worldWidth + 100 &&
        p.y + p.h > -100 &&
        p.y < level.worldHeight + 100
    );

    if (
        ridingPlatformId !== null &&
        !movingPlatforms.some(p => p.id === ridingPlatformId)
    ) {
        ridingPlatformId = null;
        player.grounded = false;
    }
}

function landOnMovingPlatform(previousBottom) {
    for (const p of movingPlatforms) {
        const overlapX =
            player.x + player.radius > p.x &&
            player.x - player.radius < p.x + p.w;

        const crossed =
            previousBottom <= p.prevY + 3 &&
            player.y + player.radius >= p.y;

        // Only land while falling onto the platform.
        if (overlapX && crossed && player.vy >= 0) {
            player.y = p.y - player.radius;
            player.vy = p.vy;
            player.grounded = true;
            ridingPlatformId = p.id;

            return;
        }
    }
}

function drawMovingPlatforms() {
    for (const p of movingPlatforms) {
        ctx.fillStyle = "#d6a84b";
        ctx.fillRect(p.x, p.y, p.w, p.h);

        ctx.lineWidth = 2;
        ctx.strokeStyle = "#573d12";
        ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
}


// ---------------- ENEMY PROJECTILES ----------------

function fireGreenShot(enemy) {
    const x = enemy.x + enemy.size / 2;
    const y = enemy.y + enemy.size / 2;

    const angle = Math.atan2(
        player.y - y,
        player.x - x
    );

    const speed = Math.max(
        600,
        enemy.shotSpeed || ENEMY_SHOT_SPEED
    );

    enemyShots.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 6,
        dead: false
    });
}


// ---------------- ENEMY MOVEMENT ----------------

function updateEnemies(dt) {
    for (const e of enemies) {
        if (!e.alive) continue;

        e.x += e.direction * e.speed * dt;

        if (e.x <= e.patrolMin) {
            e.x = e.patrolMin;
            e.direction = 1;
        } else if (e.x + e.size >= e.patrolMax) {
            e.x = e.patrolMax - e.size;
            e.direction = -1;
        }

        if (e.floating) {
            e.floatTime += dt;

            e.y = e.floatBaseY +
                Math.sin(e.floatTime * 2.2 + e.floatPhase) *
                e.floatAmplitude;
        } else {
            const oldBottom = e.y + e.size;

            e.vy += GRAVITY * dt;
            e.y += e.vy * dt;

            // Red enemies stand on solid platforms only.
            for (const p of level.platforms) {
                const overlapX =
                    e.x + e.size > p.x &&
                    e.x < p.x + p.w;

                if (
                    overlapX &&
                    oldBottom <= p.y + 4 &&
                    e.y + e.size >= p.y &&
                    e.vy >= 0
                ) {
                    e.y = p.y - e.size;
                    e.vy = 0;
                    break;
                }
            }
        }

        if (e.type === "green") {
            e.cooldown -= dt;

            if (e.cooldown <= 0) {
                if (
                    Math.hypot(
                        player.x - e.x,
                        player.y - e.y
                    ) < 1250
                ) {
                    fireGreenShot(e);
                }

                e.cooldown = e.fireRate;
            }
        }

        if (
            !dying &&
            overlaps(getPlayerBox(), {
                x: e.x,
                y: e.y,
                w: e.size,
                h: e.size
            })
        ) {
            triggerDeath();
            return;
        }
    }
}

function drawEnemies() {
    for (const e of enemies) {
        if (!e.alive) continue;

        ctx.fillStyle =
            e.type === "green" ? "#24b84a" : "#ed2929";

        ctx.fillRect(e.x, e.y, e.size, e.size);

        ctx.fillStyle = "white";

        for (let i = 0; i < e.hp; i++) {
            ctx.fillRect(
                e.x + 5 + i * 8,
                e.y + 5,
                4,
                4
            );
        }

        ctx.lineWidth = 2;
        ctx.strokeStyle = "black";
        ctx.strokeRect(e.x, e.y, e.size, e.size);
    }
}


// ---------------- COMBAT ----------------

function updateCombat(dt) {
    for (const s of playerShots) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
    }

    for (const s of enemyShots) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
    }

    // Red and blue bullets cancel each other.
    for (const red of playerShots) {
        if (red.dead) continue;

        for (const blue of enemyShots) {
            if (!blue.dead && circleCircle(red, blue)) {
                red.dead = true;
                blue.dead = true;

                createParticles(
                    (red.x + blue.x) / 2,
                    (red.y + blue.y) / 2,
                    18
                );

                break;
            }
        }
    }

    // Player shots damage enemies.
    for (const s of playerShots) {
        if (s.dead) continue;

        for (const e of enemies) {
            if (
                !e.alive ||
                !circleRect(
                    s.x,
                    s.y,
                    s.radius,
                    {
                        x: e.x,
                        y: e.y,
                        w: e.size,
                        h: e.size
                    }
                )
            ) {
                continue;
            }

            s.dead = true;
            e.hp--;

            if (e.hp <= 0) {
                e.alive = false;

                createParticles(
                    e.x + e.size / 2,
                    e.y + e.size / 2,
                    25,
                    e.type === "green" ? "#24b84a" : "#ed2929"
                );
            } else {
                createParticles(
                    s.x,
                    s.y,
                    8,
                    e.type === "green" ? "#24b84a" : "#ed2929"
                );
            }

            break;
        }
    }

    // Gray platforms break one individual section per hit.
    for (const s of playerShots) {
        if (s.dead) continue;

        for (let i = currentGrayPlatforms.length - 1; i >= 0; i--) {
            const p = currentGrayPlatforms[i];

            if (circleRect(s.x, s.y, s.radius, p)) {
                s.dead = true;

                currentGrayPlatforms.splice(i, 1);

                createParticles(
                    p.x + p.w / 2,
                    p.y + p.h / 2,
                    15,
                    "#aeb4bd"
                );

                break;
            }
        }
    }

    // Player shots can destroy spikes.
    for (const s of playerShots) {
        if (s.dead) continue;

        for (let i = currentSpikes.length - 1; i >= 0; i--) {
            const p = currentSpikes[i];

            if (circleRect(s.x, s.y, s.radius, p)) {
                s.dead = true;

                createParticles(
                    p.x + p.w / 2,
                    p.y + p.h / 2,
                    16
                );

                currentSpikes.splice(i, 1);
                break;
            }
        }
    }

    // Normal solid platforms stop player shots.
    for (const s of playerShots) {
        if (s.dead) continue;

        for (const p of level.platforms) {
            if (circleRect(s.x, s.y, s.radius, p)) {
                s.dead = true;
                createParticles(s.x, s.y, 7);
                break;
            }
        }
    }

    // Blue bullets hurt the player.
    for (const s of enemyShots) {
        if (s.dead) continue;

        if (
            circleCircle(
                s,
                {
                    x: player.x,
                    y: player.y,
                    radius: player.radius
                }
            )
        ) {
            s.dead = true;
            triggerDeath();
            break;
        }
    }

    // Enemy shots are stopped by solid and gray platforms.
    for (const s of enemyShots) {
        if (s.dead) continue;

        for (const p of [
            ...level.platforms,
            ...currentGrayPlatforms
        ]) {
            if (circleRect(s.x, s.y, s.radius, p)) {
                s.dead = true;
                createParticles(s.x, s.y, 7, "#2588ed");
                break;
            }
        }
    }

    playerShots = playerShots.filter(s =>
        !s.dead &&
        s.x > cameraX - 100 &&
        s.x < cameraX + WIDTH + 100 &&
        s.y > cameraY - 100 &&
        s.y < cameraY + HEIGHT + 100
    );

    enemyShots = enemyShots.filter(s =>
        !s.dead &&
        s.x > -100 &&
        s.x < level.worldWidth + 100 &&
        s.y > -100 &&
        s.y < level.worldHeight + 100
    );
}


// ---------------- SPIKES ----------------

function checkSpikes() {
    const box = getPlayerBox();

    for (const p of currentSpikes) {
        if (overlaps(box, p)) {
            triggerDeath();
            return;
        }
    }
}

function drawSpikes() {
    ctx.fillStyle = "black";

    for (const p of currentSpikes) {
        const count = Math.max(1, Math.floor(p.w / 13));
        const tw = p.w / count;

        for (let i = 0; i < count; i++) {
            const x = p.x + i * tw;

            ctx.beginPath();
            ctx.moveTo(x, p.y + p.h);
            ctx.lineTo(x + tw / 2, p.y);
            ctx.lineTo(x + tw, p.y + p.h);
            ctx.closePath();
            ctx.fill();
        }
    }
}


// ---------------- PLAYER MOVEMENT ----------------

function updatePlayer(dt) {
    shootCooldown = Math.max(0, shootCooldown - dt);
    platformCooldown = Math.max(0, platformCooldown - dt);

    if (keys.left && !keys.right) facing = -1;
    if (keys.right && !keys.left) facing = 1;

    // Ride a moving platform.
    if (ridingPlatformId !== null && !jumpQueued) {
        const ride = movingPlatforms.find(
            p => p.id === ridingPlatformId
        );

        if (ride) {
            player.x += ride.vx * dt;
            player.y = ride.y - player.radius;
            player.vy = ride.vy;
            player.grounded = true;
        } else {
            ridingPlatformId = null;
        }
    }

    if (keys.left) {
        player.vx -= ACCELERATION * dt;
    }

    if (keys.right) {
        player.vx += ACCELERATION * dt;
    }

    if (!keys.left && !keys.right) {
        if (player.vx > 0) {
            player.vx = Math.max(
                0,
                player.vx - FRICTION * dt
            );
        }

        if (player.vx < 0) {
            player.vx = Math.min(
                0,
                player.vx + FRICTION * dt
            );
        }
    }

    player.vx = Math.max(
        -MOVE_SPEED,
        Math.min(MOVE_SPEED, player.vx)
    );

    // Jumping off a T platform dissolves the other active T platform.
    if (jumpQueued && player.grounded) {
        if (ridingPlatformId !== null) {
            const jumpedOffId = ridingPlatformId;

            for (const p of movingPlatforms) {
                if (p.id !== jumpedOffId) {
                    p.dead = true;

                    createParticles(
                        p.x + p.w / 2,
                        p.y + p.h / 2,
                        18,
                        "#d6a84b"
                    );
                }
            }

            movingPlatforms = movingPlatforms.filter(
                p => !p.dead
            );

            ridingPlatformId = null;
        }

        player.vy = -JUMP_FORCE;
        player.grounded = false;
    }

    jumpQueued = false;

    if (shootQueued && shootCooldown <= 0) {
        firePlayerShot();
    }

    shootQueued = false;

    if (platformQueued && platformCooldown <= 0) {
        fireMovingPlatform();
    }

    platformQueued = false;

    const previousBottom = player.y + player.radius;

    player.vy += GRAVITY * dt;

    player.x += player.vx * dt;
    handleCollisions("x");

    player.y += player.vy * dt;
    player.grounded = false;

    handleCollisions("y");

    // One-way moving platform landing.
    // The player can pass through from underneath while rising.
    landOnMovingPlatform(previousBottom);

    if (ridingPlatformId !== null) {
        const ride = movingPlatforms.find(
            p => p.id === ridingPlatformId
        );

        if (ride) {
            if (
                player.x + player.radius > ride.x &&
                player.x - player.radius < ride.x + ride.w
            ) {
                player.y = ride.y - player.radius;
                player.vy = ride.vy;
                player.grounded = true;
            } else {
                ridingPlatformId = null;
            }
        }
    }

    // World boundaries.
    if (player.x < player.radius) {
        player.x = player.radius;
        player.vx = 0;
    }

    if (player.x > level.worldWidth - player.radius) {
        player.x = level.worldWidth - player.radius;
        player.vx = 0;
    }

    if (player.y > level.worldHeight + 100) {
        triggerDeath();
        return;
    }

    checkSpikes();
}


// ---------------- CAMERA ----------------

function updateCamera() {
    const tx = player.x - WIDTH * 0.5;
    const ty = player.y - HEIGHT * 0.58;

    cameraX += (tx - cameraX) * 0.12;
    cameraY += (ty - cameraY) * 0.12;

    cameraX = Math.max(
        0,
        Math.min(cameraX, level.worldWidth - WIDTH)
    );

    cameraY = Math.max(
        0,
        Math.min(cameraY, level.worldHeight - HEIGHT)
    );
}


// ---------------- GOAL ----------------

function checkGoal() {
    if (
        !gameWon &&
        !dying &&
        overlaps(getPlayerBox(), level.goal)
    ) {
        loadLevel(currentLevelIndex + 1);
    }
}


// ---------------- DRAWING ----------------

function drawPlayer() {
    ctx.beginPath();

    ctx.arc(
        player.x,
        player.y,
        player.radius,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = "white";
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = "black";
    ctx.stroke();

    ctx.beginPath();

    if (isAimingUp()) {
        ctx.moveTo(player.x, player.y + 7);
        ctx.lineTo(player.x, player.y - 9);

        ctx.moveTo(player.x - 5, player.y - 4);
        ctx.lineTo(player.x, player.y - 9);
        ctx.lineTo(player.x + 5, player.y - 4);
    } else {
        const tip = player.x + facing * 9;

        ctx.moveTo(
            player.x - facing * 5,
            player.y
        );

        ctx.lineTo(tip, player.y);

        ctx.moveTo(
            tip - facing * 5,
            player.y - 5
        );

        ctx.lineTo(tip, player.y);

        ctx.lineTo(
            tip - facing * 5,
            player.y + 5
        );
    }

    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "black";
    ctx.stroke();
}

function drawPlatforms() {
    ctx.fillStyle = "black";

    for (const p of level.platforms) {
        ctx.fillRect(p.x, p.y, p.w, p.h);
    }

    for (const p of currentGrayPlatforms) {
        ctx.fillStyle = "#aeb4bd";
        ctx.fillRect(p.x, p.y, p.w, p.h);

        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#555b63";
        ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
}

function drawGoal() {
    const g = level.goal;

    ctx.fillStyle = "black";
    ctx.fillRect(g.x, g.y, g.width, g.height);

    ctx.fillStyle = "white";
    ctx.fillRect(
        g.x + 8,
        g.y + 8,
        g.width - 16,
        g.height - 16
    );
}

function drawPlayerShots() {
    for (const s of playerShots) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);

        ctx.fillStyle = "#ed2929";
        ctx.fill();

        ctx.lineWidth = 2;
        ctx.strokeStyle = "black";
        ctx.stroke();
    }
}

function drawEnemyShots() {
    for (const s of enemyShots) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);

        ctx.fillStyle = "#2588ed";
        ctx.fill();

        ctx.lineWidth = 2;
        ctx.strokeStyle = "black";
        ctx.stroke();
    }
}

function drawHUD() {
    ctx.fillStyle = "black";

    ctx.font = "bold 16px Arial";
    ctx.fillText(level.name, 20, 30);

    ctx.font = "11px Arial";

    ctx.fillText(
        "ARROWS: MOVE     UP: JUMP / AIM UP     E: SHOOT     T: PLATFORM     R: RESTART",
        20,
        48
    );

    ctx.fillText(
        "RED ENEMIES: 2 HITS     GREEN ENEMIES: 2 HITS + FAST AIMED SHOTS",
        20,
        65
    );
}


// ---------------- GAME LOOP ----------------

let lastTime = 0;

function gameLoop(timestamp) {
    const dt = lastTime === 0
        ? 0
        : Math.min((timestamp - lastTime) / 1000, 0.033);

    lastTime = timestamp;

    if (!gameWon) {
        if (dying) {
            deathTimer -= dt;

            if (deathTimer <= 0) {
                restartLevel();
            }
        } else {
            updateMovingPlatforms(dt);
            updatePlayer(dt);

            if (!dying) {
                updateEnemies(dt);
                updateCombat(dt);

                if (!dying) {
                    updateCamera();
                    checkGoal();
                }
            }
        }
    }

    updateParticles(dt);

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    drawPlatforms();
    drawMovingPlatforms();
    drawSpikes();
    drawGoal();
    drawEnemies();

    if (!dying) {
        drawPlayerShots();
        drawEnemyShots();
        drawPlayer();
    }

    drawParticles();

    ctx.restore();

    drawHUD();

    requestAnimationFrame(gameLoop);
}


// ---------------- START ----------------

loadLevel(0);
requestAnimationFrame(gameLoop);