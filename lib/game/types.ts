export type Difficulty = "eco" | "bonus" | "force-buy" | "full-buy";

// ── Target shapes ──────────────────────────────────────────────
export interface BaseTarget {
    id: string;
    x: number;
    y: number;
    radius: number;
    spawnedAt: number; // performance.now() timestamp
    timeToLive?: number; // Time-To-Live duration in ms (e.g., 800ms)
}

export interface MovingTarget extends BaseTarget {
    vx: number; // velocity x (px/frame)
    vy: number; // velocity y (px/frame)
}

export interface SwitchTarget extends BaseTarget {
    isCorrect: boolean;
}


// 1. The Raw Event (Generated after every drill)
export interface GameResult {
    id: string; // UUID
    modeId: string; // e.g., "micro-adjust", "static-flick"
    difficulty: Difficulty;
    score: number;
    hits: number;
    misses: number;
    accuracy: number; // Percentage 0-100
    reactionTimes: number[]; // Array of ms for deep analytics
    averageReactionTime: number; // ms
    bestReactionTime: number; // ms
    durationSeconds: number;
    createdAt: string; // ISO 8601 Timestamp for graph plotting
    extraStats?: Record<string, string | number>; // Flexible field for mode-specific data
    isBenchmark?: boolean; // true = official, unmodified benchmark run
    taskId?: string; // Optional: Links back to Dashboard Operation task ID
    ghostTelemetry?: string; // Compressed JSON representation of ghost run
    username?: string; // User name (for leaderboard submission)
    missQuadrants?: {
        topLeft: number;
        topRight: number;
        bottomLeft: number;
        bottomRight: number;
    };
}

// 2. The Aggregated Profile (For the Dashboard)
export interface ModeStats {
    gamesPlayed: number;
    timePlayedSeconds: number;
    highScore: number;
    averageScore: number;
    averageAccuracy: number;
    bestReactionTime: number;
}

export interface UserStats {
    userId: string; // Ready for future authentication
    totalGamesPlayed: number;
    globalAccuracy: number;
    timePlayedSeconds: number;
    lastPlayedAt: string | null;
    modes: Record<string, ModeStats>; // Maps modeId -> ModeStats
    completedTasks?: string[];
    xp?: number;
    level?: number;
    xpFactors?: {
        flickingXp: number;
        trackingXp: number;
        speedXp: number;
        precisionXp: number;
        perceptionXp: number;
        cognitionXp: number;
    };
    missQuadrants?: {
        topLeft: number;
        topRight: number;
        bottomLeft: number;
        bottomRight: number;
    };
}
// 3. The Custom Training System
export interface RoutineStep {
    id: string;
    modeId: string;
    difficulty: string; // drillConfig Difficulty key: "easy" | "medium" | "hard" | "extreme"
    durationSeconds: number;
    targetScore?: number; // Optional goal to "pass" the step
}

export interface Routine {
    id: string;
    name: string;
    description: string;
    authorId: string;
    createdAt: string;
    drills: RoutineStep[];
}

export interface PlaylistTask {
    mode: string;
    difficulty: string;
    timeLimit: number; // e.g., 60 seconds
}

export interface CustomPlaylist {
    id: string;
    name: string;
    description: string;
    tasks: PlaylistTask[];
    createdAt: number;
}

// Add this to your existing UserStats interface:
export interface UserStats {
    // ... your existing stats (globalAccuracy, etc.)
    playlists?: CustomPlaylist[];
}