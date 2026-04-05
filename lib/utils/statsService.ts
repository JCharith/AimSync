import { db } from '../firebase';
import { getCurrentUserId } from '../auth';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { GameResult } from "../game/types";

// --- Types (Maintained from your original) ---
export type LifetimeStats = {
    totalSessionsPlayed: number;
    totalHits: number;
    totalMisses: number;
    totalScore: number;
    totalPlaytime: number;
};

export type ModeStats = {
    mode: string;
    sessionsPlayed: number;
    bestScore: number;
    bestAccuracy: number;
    bestAverageReactionTime?: number;
    bestTargetsPerSecond?: number;
    totalHits: number;
    totalMisses: number;
    totalScore: number;
    totalPlaytime: number;
};

export type StoredStats = {
    modes: Record<string, ModeStats>;
    lifetime: LifetimeStats;
};

// ─── LOGIC HELPERS ───────────────────────────────────────────

const createEmptyLifetimeStats = (): LifetimeStats => ({
    totalSessionsPlayed: 0,
    totalHits: 0,
    totalMisses: 0,
    totalScore: 0,
    totalPlaytime: 0,
});

const getUpdatedModeStats = (existing: ModeStats | undefined, result: GameResult): ModeStats => {
    const previous: ModeStats = existing ?? {
        mode: result.modeId,
        sessionsPlayed: 0,
        bestScore: 0,
        bestAccuracy: 0,
        totalHits: 0,
        totalMisses: 0,
        totalScore: 0,
        totalPlaytime: 0,
    };

    // Calculate Reaction Time (keeping your logic)
    const updatedAvgReaction = result.averageReactionTime === undefined
        ? previous.bestAverageReactionTime
        : previous.bestAverageReactionTime === undefined
            ? result.averageReactionTime
            : Math.min(previous.bestAverageReactionTime, result.averageReactionTime);

    // Calculate TPS (keeping your logic)
    const currentTPS = result.durationSeconds > 0 ? Number((result.hits / result.durationSeconds).toFixed(2)) : undefined;
    const updatedTPS = currentTPS === undefined
        ? previous.bestTargetsPerSecond
        : previous.bestTargetsPerSecond === undefined
            ? currentTPS
            : Math.max(previous.bestTargetsPerSecond, currentTPS);

    return {
        mode: result.modeId,
        sessionsPlayed: previous.sessionsPlayed + 1,
        bestScore: Math.max(previous.bestScore, result.score),
        bestAccuracy: Math.max(previous.bestAccuracy, result.accuracy),
        bestAverageReactionTime: updatedAvgReaction,
        bestTargetsPerSecond: updatedTPS,
        totalHits: previous.totalHits + result.hits,
        totalMisses: previous.totalMisses + result.misses,
        totalScore: previous.totalScore + result.score,
        totalPlaytime: previous.totalPlaytime + result.durationSeconds,
    };
};

// ─── CORE ASYNC SERVICES ──────────────────────────────────────

export const updateStatsWithResult = async (result: GameResult): Promise<void> => {
    const userId = getCurrentUserId();
    if (!userId) return;

    try {
        // 1. Log the individual session in the sub-collection (Telemetry)
        // Path: /users/{userId}/scores/{autoId}
        const sessionRef = collection(db, 'users', userId, 'scores');
        await addDoc(sessionRef, {
            ...result,
            createdAt: serverTimestamp(), // Use server time for accurate sorting
        });

        // 2. Fetch current aggregate stats
        // Path: /users/{userId}
        const userDocRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userDocRef);

        let currentStats: StoredStats = userSnap.exists()
            ? (userSnap.data() as StoredStats)
            : { modes: {}, lifetime: createEmptyLifetimeStats() };

        // 3. Run your calculation logic
        const updatedModeStats = getUpdatedModeStats(currentStats.modes[result.modeId], result);

        const updatedLifetime: LifetimeStats = {
            totalSessionsPlayed: (currentStats.lifetime?.totalSessionsPlayed || 0) + 1,
            totalHits: (currentStats.lifetime?.totalHits || 0) + result.hits,
            totalMisses: (currentStats.lifetime?.totalMisses || 0) + result.misses,
            totalScore: (currentStats.lifetime?.totalScore || 0) + result.score,
            totalPlaytime: (currentStats.lifetime?.totalPlaytime || 0) + result.durationSeconds,
        };

        // 4. Save aggregates back to the root user document
        await setDoc(userDocRef, {
            modes: {
                ...currentStats.modes,
                [result.modeId]: updatedModeStats
            },
            lifetime: updatedLifetime,
            lastPlayed: serverTimestamp(),
            displayName: result.userName || 'Agent' // Keep profile updated
        }, { merge: true });

    } catch (error) {
        console.error("Critical: Failed to sync game telemetry:", error);
        throw error; // Let ResultsScreen handle the error state
    }
};