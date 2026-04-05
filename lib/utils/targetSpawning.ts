import type { Difficulty } from "./drillConfig";
import type { BaseTarget, MovingTarget, SwitchTarget } from "../game/types";

type Position = {
    x: number;
    y: number;
};

const createTargetId = (): string => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `target-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

// The Updated Full-Canvas Spawner with Micro-Zone Bias
export const getRandomTargetPosition = (canvasWidth: number, canvasHeight: number, radius: number): Position => {
    const isMicroZone = Math.random() < 0.55;

    let xMin, xMax, yMin, yMax;

    if (isMicroZone) {
        // User Requested Micro Zone: W * 0.104, H * 0.148, centered
        const microWidth = canvasWidth * 0.104;
        const microHeight = canvasHeight * 0.148;
        xMin = (canvasWidth / 2) - (microWidth / 2);
        xMax = (canvasWidth / 2) + (microWidth / 2);
        yMin = (canvasHeight / 2) - (microHeight / 2);
        yMax = (canvasHeight / 2) + (microHeight / 2);
    } else {
        // Standard safe zone for remaining ~45% of targets
        const paddingX = radius + 12;
        const topSafeZone = canvasHeight * 0.15;
        const bottomSafeZone = canvasHeight * 0.05;
        xMin = paddingX;
        xMax = canvasWidth - paddingX;
        yMin = topSafeZone + radius;
        yMax = canvasHeight - bottomSafeZone - radius;
    }

    // Clamp absolute extremes to radius to prevent half-clipping targets
    xMin = Math.max(xMin, radius);
    xMax = Math.min(xMax, canvasWidth - radius);
    yMin = Math.max(yMin, radius);
    yMax = Math.min(yMax, canvasHeight - radius);

    const x = Math.random() * (xMax - xMin) + xMin;
    const y = Math.random() * (yMax - yMin) + yMin;
    
    return { x, y };
};

// 2. The Missing Export that caused the crash
export const createStaticTarget = (canvasWidth: number, canvasHeight: number, radius: number): BaseTarget => {
    const { x, y } = getRandomTargetPosition(canvasWidth, canvasHeight, radius);
    return {
        id: createTargetId(),
        x,
        y,
        radius,
        spawnedAt: performance.now(),
    };
};

export function createMicroAdjustTarget(
    canvasWidth: number,
    canvasHeight: number,
    targetRadius: number,
    lastX?: number | null,
    lastY?: number | null
): BaseTarget {
    // Define what "Micro" actually means mathematically.
    // Minimum distance ensures it doesn't overlap the old target.
    // Maximum distance ensures it doesn't turn into a wide flick.
    const MIN_DISTANCE = targetRadius * 3;
    const MAX_DISTANCE = targetRadius * 8;

    let x = canvasWidth / 2;
    let y = canvasHeight / 2;

    // If we have a previous target, spawn relative to it
    if (lastX != null && lastY != null) {
        let validSpawn = false;
        let attempts = 0;

        // Try to find a valid spot that doesn't clip off the screen
        while (!validSpawn && attempts < 50) {
            const angle = Math.random() * Math.PI * 2;
            const distance = MIN_DISTANCE + Math.random() * (MAX_DISTANCE - MIN_DISTANCE);

            x = lastX + Math.cos(angle) * distance;
            y = lastY + Math.sin(angle) * distance;

            // Enforce horizontal margins and vertical safe zones
            const marginX = targetRadius + 20;
            const topSafe = canvasHeight * 0.15 + targetRadius;
            const bottomSafe = canvasHeight - canvasHeight * 0.05 - targetRadius;
            if (x >= marginX && x <= canvasWidth - marginX && y >= topSafe && y <= bottomSafe) {
                validSpawn = true;
            }
            attempts++;
        }

        // Failsafe: If the target gets trapped in a literal corner and can't find a valid angle after 50 tries, reset to center.
        if (!validSpawn) {
            x = canvasWidth / 2;
            y = canvasHeight / 2;
        }
    }

    return {
        id: crypto.randomUUID(), // Assuming you use UUIDs, or use Date.now().toString()
        x,
        y,
        radius: targetRadius,
        spawnedAt: performance.now(),
    };
}

export const getTargetSwitchCount = (difficulty: Difficulty): number => {
    switch (difficulty) {
        case "easy": return 2;
        case "medium": return 3;
        case "hard": return 4;
        case "extreme": return 5;
        default: return 3;
    }
};

export const createTargetSwitchWave = (difficulty: Difficulty, canvasWidth: number, canvasHeight: number, radius: number): SwitchTarget[] => {
    const count = getTargetSwitchCount(difficulty);
    const targets: SwitchTarget[] = Array.from({ length: count }, () => {
        const { x, y } = getRandomTargetPosition(canvasWidth, canvasHeight, radius);
        return {
            id: createTargetId(),
            x,
            y,
            radius,
            spawnedAt: performance.now(),
            isCorrect: false,
        };
    });
    const correctIndex = Math.floor(Math.random() * targets.length);
    targets[correctIndex].isCorrect = true;
    return targets;
};

export const getTrackingSpeed = (difficulty: Difficulty): number => {
    switch (difficulty) {
        case "easy": return 2.2;
        case "medium": return 3.2;
        case "hard": return 4.3;
        case "extreme": return 5.4;
        default: return 3;
    }
};

export const createTrackingTarget = (difficulty: Difficulty, canvasWidth: number, canvasHeight: number, radius: number): MovingTarget => {
    const { x, y } = getRandomTargetPosition(canvasWidth, canvasHeight, radius);
    const speed = getTrackingSpeed(difficulty);
    const angle = Math.random() * Math.PI * 2;
    return {
        id: createTargetId(),
        x,
        y,
        radius,
        spawnedAt: performance.now(),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
    };
};

export const updateTrackingTargetPosition = (target: MovingTarget, canvasWidth: number, canvasHeight: number): MovingTarget => {
    let nextX = target.x + target.vx;
    let nextY = target.y + target.vy;
    let nextVx = target.vx;
    let nextVy = target.vy;

    if (nextX - target.radius <= 0 || nextX + target.radius >= canvasWidth) {
        nextVx *= -1;
        nextX = target.x + nextVx;
    }
    if (nextY - target.radius <= 0 || nextY + target.radius >= canvasHeight) {
        nextVy *= -1;
        nextY = target.y + nextVy;
    }
    return { ...target, x: nextX, y: nextY, vx: nextVx, vy: nextVy };
};

export const getBurstSize = (difficulty: Difficulty): number => {
    switch (difficulty) {
        case "easy": return 3;
        case "medium": return 4;
        case "hard": return 5;
        case "extreme": return 6;
        default: return 4;
    }
};

export const createBurstTarget = (canvasWidth: number, canvasHeight: number, radius: number): BaseTarget => {
    return createStaticTarget(canvasWidth, canvasHeight, radius);
};

export const getReactionSpawnDelay = (difficulty: Difficulty): number => {
    switch (difficulty) {
        case "easy": return 1100 + Math.random() * 1000;
        case "medium": return 850 + Math.random() * 900;
        case "hard": return 650 + Math.random() * 750;
        case "extreme": return 450 + Math.random() * 650;
        default: return 1000;
    }
};

export const getReactionScoreBonus = (reaction: number): number => {
    if (reaction <= 220) return 45;
    if (reaction <= 300) return 35;
    if (reaction <= 400) return 28;
    return 20;
};