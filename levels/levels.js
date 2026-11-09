// Winding, multi-floor platformer levels.
// Each floor is a long corridor. At each end, alternating wall ledges
// let the player climb to the next floor and reverse direction.

function buildLevel(config) {
    const platforms = [];
    const spikes = [];
    const enemies = [];

    const { name, worldWidth, floorYs, startSide, goalSide, difficulty } = config;
    const floorCount = floorYs.length;

    // Long floor corridors with small gaps and raised sections.
    floorYs.forEach((y, floorIndex) => {
        const gap = difficulty.gap;
        const segmentCount = 5 + floorIndex;
        const segmentWidth = (worldWidth - gap * (segmentCount - 1)) / segmentCount;

        for (let i = 0; i < segmentCount; i++) {
            const x = i * (segmentWidth + gap);
            platforms.push({ x, y, w: segmentWidth, h: 28 });
        }

        // Raised ledges along the corridor.
        const raisedCount = 1 + Math.floor((difficulty.obstacles + floorIndex) / 2);

        for (let j = 0; j < raisedCount; j++) {
            const x = 260 + j * ((worldWidth - 560) / Math.max(1, raisedCount));

            platforms.push({
                x,
                y: y - (j % 2 === 0 ? 42 : 58),
                w: 90,
                h: 18
            });
        }

        // Spikes.
        const spikeCount = Math.min(1 + floorIndex + difficulty.spikes, 5);

        for (let s = 0; s < spikeCount; s++) {
            const x = 190 + s * ((worldWidth - 430) / Math.max(1, spikeCount));

            spikes.push({
                x,
                y: y - 25,
                w: 34 + (s % 2) * 10,
                h: 25
            });
        }

        // Enemy placements. Both types take two hits.
        const enemyCount = difficulty.enemies + Math.floor(floorIndex / 2);

        for (let e = 0; e < enemyCount; e++) {
            const x = 330 + e * ((worldWidth - 660) / Math.max(1, enemyCount));
            const special = ((e + floorIndex + difficulty.specialOffset) % 3 === 0);

            enemies.push({
                type: special ? "green" : "red",
                x,
                y: y - 24,
                size: 24,
                patrolMin: Math.max(40, x - 95),
                patrolMax: Math.min(worldWidth - 40, x + 95),
                speed: (special ? 75 : 90) + difficulty.enemySpeed + floorIndex * 5,
                fireRate: Math.max(0.72, 1.18 - difficulty.fireBoost - floorIndex * 0.04),
                shotSpeed: 390,
                burstCount: 3
            });
        }
    });

    // Alternating climbing ledges at the ends of floors.
    for (let floor = 0; floor < floorCount - 1; floor++) {
        const lowerY = floorYs[floor];
        const upperY = floorYs[floor + 1];
        const climbRight = (floor % 2 === 0);
        const steps = Math.ceil((lowerY - upperY) / 74);
        const ledgeWidth = 150;

        for (let step = 1; step <= steps; step++) {
            const y = lowerY - step * ((lowerY - upperY) / (steps + 1));
            let x;

            if (climbRight) {
                x = step % 2 === 1
                    ? worldWidth - 190
                    : worldWidth - 355;
            } else {
                x = step % 2 === 1 ? 40 : 205;
            }

            platforms.push({ x, y, w: ledgeWidth, h: 18 });
        }
    }

    const finalY = floorYs[floorCount - 1];
    const goalX = goalSide === "right" ? worldWidth - 72 : 24;

    return {
        name,
        worldWidth,
        worldHeight: config.worldHeight,

        start: {
            x: startSide === "left" ? 65 : worldWidth - 65,
            y: floorYs[0] - 18
        },

        goal: {
            x: goalX,
            y: finalY - 92,
            width: 38,
            height: 92
        },

        platforms,
        spikes,
        enemies
    };
}

const LEVELS = [
    buildLevel({
        name: "LEVEL 1 — THE LOWER TOWER",
        worldWidth: 1500,
        worldHeight: 1450,
        floorYs: [1260, 800, 340],
        startSide: "left",
        goalSide: "right",

        difficulty: {
            gap: 34,
            obstacles: 1,
            spikes: 0,
            enemies: 1,
            enemySpeed: 0,
            fireBoost: 0,
            specialOffset: 1
        }
    }),

    buildLevel({
        name: "LEVEL 2 — THE CROSSING",
        worldWidth: 1750,
        worldHeight: 1650,
        floorYs: [1460, 990, 520],
        startSide: "left",
        goalSide: "right",

        difficulty: {
            gap: 42,
            obstacles: 3,
            spikes: 1,
            enemies: 2,
            enemySpeed: 15,
            fireBoost: 0.18,
            specialOffset: 0
        }
    }),

    buildLevel({
        name: "LEVEL 3 — THE HIGH TOWER",
        worldWidth: 1900,
        worldHeight: 2100,
        floorYs: [1880, 1410, 940, 470],
        startSide: "left",
        goalSide: "right",

        difficulty: {
            gap: 48,
            obstacles: 4,
            spikes: 2,
            enemies: 3,
            enemySpeed: 28,
            fireBoost: 0.32,
            specialOffset: 2
        }
    })
];