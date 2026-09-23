// We define Difficulty here directly to avoid needing a separate types file for one line.
export type Difficulty = "easy" | "medium" | "hard" | "extreme";

export type DifficultySettings = {
    targetRadius: number;
    targetLifetimeMs: number;
    scorePerHit: number;
    missPenalty: number;
    targetScale: number;
    speedMultiplier: number;
};

export const difficultyLabels: Record<Difficulty, string> = {
    easy: "eco",
    medium: "bonus",
    hard: "force buy",
    extreme: "full buy",
};

export const difficultyConfig: Record<Difficulty, DifficultySettings> = {
    easy: {
        targetRadius: 44,
        targetLifetimeMs: 2000,
        scorePerHit: 100,
        missPenalty: 30,
        targetScale: 1.1,
        speedMultiplier: 0.85,
    },
    medium: {
        targetRadius: 34,
        targetLifetimeMs: 1500,
        scorePerHit: 115,
        missPenalty: 35,
        targetScale: 0.85,
        speedMultiplier: 1.0,
    },
    hard: {
        targetRadius: 26,
        targetLifetimeMs: 1100,
        scorePerHit: 130,
        missPenalty: 40,
        targetScale: 0.65,
        speedMultiplier: 1.25,
    },
    extreme: {
        targetRadius: 18,
        targetLifetimeMs: 800,
        scorePerHit: 150,
        missPenalty: 45,
        targetScale: 0.45,
        speedMultiplier: 1.5,
    },
};

// ─────────────────────────────────────────────────────────────
//  Dynamic Target Scaling
//  Targets shrink linearly from 100% → (100 - maxReduction)%
//  over the full session duration.
//
//  Max reductions by difficulty:
//    easy    (eco)       → 40%
//    medium  (bonus)     → 50%
//    hard    (force-buy) → 60%
//    extreme (full-buy)  → 70%
// ─────────────────────────────────────────────────────────────
const MAX_REDUCTION: Record<Difficulty, number> = {
    easy:    0.40,
    medium:  0.50,
    hard:    0.60,
    extreme: 0.70,
};

/**
 * Returns the radius that should be used for the *next* target spawn,
 * scaled down based on how far through the session we are.
 *
 * @param baseRadius   - The full-size radius for this difficulty (px).
 * @param difficulty   - Current difficulty key.
 * @param elapsedSec   - Seconds elapsed since the session started.
 * @param durationSec  - Total session duration in seconds.
 * @param minRadius    - Hard floor so targets never become invisible (default 6px).
 */
export const getScaledRadius = (
    baseRadius: number,
    difficulty: Difficulty,
    elapsedSec: number,
    durationSec: number,
    minRadius = 6,
): number => {
    if (durationSec <= 0) return baseRadius;
    const progress = Math.min(1, Math.max(0, elapsedSec / durationSec));
    const scaleFactor = 1 - MAX_REDUCTION[difficulty] * progress;
    return Math.max(minRadius, Math.round(baseRadius * scaleFactor));
};