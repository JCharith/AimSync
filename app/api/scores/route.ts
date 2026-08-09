import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getLevelFromXp, getXpProgressWithinLevel } from '@/lib/utils/progressionEngine';
import { distributeXp } from '@/lib/utils/statsService';

// Force Next.js to use Cloudflare's Edge network for zero-latency database calls
export const runtime = 'edge';

// Helper: get D1 binding at runtime (checks process.env and fallback to getRequestContext)
async function getDb(): Promise<any> {
    try {
        const db = (process.env as any).DB;
        if (db) return db;
        const { getCloudflareContext } = await import('@opennextjs/cloudflare');
        const { env } = await getCloudflareContext();
        return env.DB;
    } catch {
        return null;
    }
}

// Helper: Compute 4-Quadrant Miss Counts (INTEGER Counts)
function compute4QuadrantMissCounts(payload: any): { qTL: number; qTR: number; qBL: number; qBR: number } {
    let qTL = 0, qTR = 0, qBL = 0, qBR = 0;

    const mq = payload.missQuadrants || payload.miss_quadrants;
    if (mq && typeof mq === 'object') {
        qTL = Math.max(0, Math.floor(mq.topLeft || mq.top_left || mq.miss_quadrant_top_left || 0));
        qTR = Math.max(0, Math.floor(mq.topRight || mq.top_right || mq.miss_quadrant_top_right || 0));
        qBL = Math.max(0, Math.floor(mq.bottomLeft || mq.bottom_left || mq.miss_quadrant_bottom_left || 0));
        qBR = Math.max(0, Math.floor(mq.bottomRight || mq.bottom_right || mq.miss_quadrant_bottom_right || 0));
        return { qTL, qTR, qBL, qBR };
    }

    const clickDeltas = payload.clickDeltas || payload.missLocations || payload.miss_locations;
    if (Array.isArray(clickDeltas)) {
        for (const point of clickDeltas) {
            const x = typeof point.x === 'number' ? point.x : (point[0] ?? 0);
            const y = typeof point.y === 'number' ? point.y : (point[1] ?? 0);
            if (x < 0 && y < 0) qTL++;
            else if (x >= 0 && y < 0) qTR++;
            else if (x < 0 && y >= 0) qBL++;
            else qBR++;
        }
    }

    return { qTL, qTR, qBL, qBR };
}

// --- GET: Fetch player stats from Cloudflare D1 ---
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const history = searchParams.get('history') === 'true';

    if (!userId || userId === 'undefined' || userId === 'local' || userId === 'null') {
        return NextResponse.json(history ? [] : {
            total_games: 0,
            time_played: 0,
            accuracy: 0,
            modes_data: '{}',
            playlists: '[]',
            last_played_at: new Date().toISOString()
        });
    }

    const db = await getDb();
    if (!db) {
        return NextResponse.json(history ? [] : {
            total_games: 0,
            time_played: 0,
            accuracy: 0,
            modes_data: '{}',
            playlists: '[]',
            last_played_at: new Date().toISOString()
        });
    }

    try {
        if (history) {
            const result = await db
                .prepare('SELECT accuracy FROM session_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
                .bind(userId)
                .all();
            return NextResponse.json(result.results || []);
        }

        const result = await db
            .prepare('SELECT * FROM skill_matrices WHERE user_id = ?')
            .bind(userId)
            .first();

        if (!result) {
            return NextResponse.json({ error: 'No data found' }, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('D1 GET Error:', error);
        return NextResponse.json({ error: 'Database fetch failed' }, { status: 500 });
    }
}

// --- POST: Save telemetry, process level-up, milestone check and atomic write to Cloudflare D1 ---
export async function POST(request: Request) {
    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const session = await auth().catch(() => null);
    const isTrialUser = body.isTrial === true || !session || !session.user || !session.user.id || session.user.id === 'guest' || session.user.id === 'trial' || session.user.id === 'local';

    if (isTrialUser || !session || !session.user || !session.user.id) {
        return NextResponse.json({
            success: true,
            xpEarned: 0,
            levelUp: false,
            currentLevel: 1,
            currentXp: 0,
            xpNeededForNext: 500,
            mocked: true
        });
    }

    const userId = session.user.id;

    if (body.stats) {
        const db = await getDb();
        if (!db) {
            return NextResponse.json({ success: true, mocked: true });
        }
        try {
            const { qTL, qTR, qBL, qBR } = compute4QuadrantMissCounts(body.stats);
            await db.prepare(`
                INSERT INTO skill_matrices (
                    user_id, accuracy, total_games, time_played, 
                    modes_data, playlists, 
                    total_xp, current_level,
                    xp_flicking, xp_tracking, xp_speed, xp_precision, xp_perception, xp_cognition,
                    miss_quadrant_top_left, miss_quadrant_top_right, miss_quadrant_bottom_left, miss_quadrant_bottom_right,
                    last_played_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET
                    accuracy = excluded.accuracy,
                    total_games = excluded.total_games,
                    time_played = excluded.time_played,
                    modes_data = excluded.modes_data,
                    playlists = excluded.playlists,
                    total_xp = excluded.total_xp,
                    current_level = excluded.current_level,
                    xp_flicking = excluded.xp_flicking,
                    xp_tracking = excluded.xp_tracking,
                    xp_speed = excluded.xp_speed,
                    xp_precision = excluded.xp_precision,
                    xp_perception = excluded.xp_perception,
                    xp_cognition = excluded.xp_cognition,
                    miss_quadrant_top_left = miss_quadrant_top_left + excluded.miss_quadrant_top_left,
                    miss_quadrant_top_right = miss_quadrant_top_right + excluded.miss_quadrant_top_right,
                    miss_quadrant_bottom_left = miss_quadrant_bottom_left + excluded.miss_quadrant_bottom_left,
                    miss_quadrant_bottom_right = miss_quadrant_bottom_right + excluded.miss_quadrant_bottom_right,
                    last_played_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
            `).bind(
                userId,
                body.stats.globalAccuracy || body.stats.accuracy || 0,
                body.stats.totalGamesPlayed || body.stats.total_games || 0,
                body.stats.timePlayedSeconds || body.stats.time_played || 0,
                JSON.stringify(body.stats.modes || {}),
                JSON.stringify(body.stats.playlists || []),
                body.stats.xp || body.stats.total_xp || 0,
                body.stats.level || body.stats.current_level || 1,
                body.stats.xpFactors?.flickingXp || 0,
                body.stats.xpFactors?.trackingXp || 0,
                body.stats.xpFactors?.speedXp || 0,
                body.stats.xpFactors?.precisionXp || 0,
                body.stats.xpFactors?.perceptionXp || 0,
                body.stats.xpFactors?.cognitionXp || 0,
                qTL, qTR, qBL, qBR
            ).run();
            return NextResponse.json({ success: true });
        } catch (error) {
            console.error('D1 sync stats error:', error);
            return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
        }
    }

    const exerciseId = body.exerciseId || body.exercise_id || 'unknown';
    const hits = typeof body.hits === 'number' ? body.hits : (body.rawScoreData?.hits ?? 0);
    const misses = typeof body.misses === 'number' ? body.misses : (body.rawScoreData?.misses ?? 0);
    const maxCombo = typeof body.maxCombo === 'number' ? body.maxCombo : (body.rawScoreData?.maxCombo ?? 0);
    const durationSeconds = typeof body.durationSeconds === 'number' ? body.durationSeconds : (body.rawScoreData?.durationSeconds ?? body.duration_seconds ?? 0);
    const averageUrgencyIndex   = typeof body.averageUrgencyIndex   === 'number' ? body.averageUrgencyIndex   : 1.0;
    const overFlickCoefficient  = typeof body.overFlickCoefficient  === 'number' ? body.overFlickCoefficient  : 1.0;
    const difficulty            = body.difficulty || "medium";
    const username              = session.user.name || session.user.email || "Player";
    const ghostTelemetry        = body.ghostTelemetry || body.ghost_telemetry || null;
    const neuralStabilityScore  = typeof body.neuralStabilityScore === 'number' ? body.neuralStabilityScore : null;

    const totalTargets = hits + misses;
    const accuracyFraction = totalTargets > 0 ? (hits / totalTargets) : 0;
    const accuracy = accuracyFraction * 100;
    const inputVelocity = durationSeconds > 0 ? (totalTargets / durationSeconds) : 0;
    const kps = Number(inputVelocity.toFixed(2));
    const score = typeof body.score === 'number' ? body.score : (body.rawScoreData?.score ?? (hits * 10 + maxCombo * 5));

    const { qTL, qTR, qBL, qBR } = compute4QuadrantMissCounts(body);

    let isFlagged = 0;
    let flagReason: string | null = null;

    if (durationSeconds < 5 || inputVelocity > 15) {
        isFlagged = 1;
        flagReason = 'Velocity/Duration Threshold Exceeded';
    }
    
    let integrityFlag = isFlagged === 1 ? 'LOW_INTEGRITY' : 'HIGH_INTEGRITY';
    const accuracyMultiplier = accuracyFraction > 0.90 ? 1.5 : 1.0;
    const baseXp = 100 + (score / 10) * accuracyMultiplier;
    const xpEarned = isFlagged === 1 ? 0 : Math.round(baseXp);

    const db = await getDb();

    if (!db) {
        const progress = getXpProgressWithinLevel(xpEarned);
        return NextResponse.json({
            success: true,
            xpEarned,
            levelUp: false,
            currentLevel: progress.currentLevel,
            currentXp: progress.xpIntoLevel,
            xpNeededForNext: progress.xpNeededForNext,
            mocked: true
        });
    }

    try {
        const userProgress = await db.prepare(
            "SELECT current_level, total_xp, surgeon_badge_unlocked, vector_lock_badge_unlocked, vanguard_badge_unlocked, total_games FROM skill_matrices WHERE user_id = ?"
        ).bind(userId).first();

        let oldLevel = 1;
        let oldTotalXp = 0;
        let oldSurgeon = 0;
        let oldVector = 0;
        let oldVanguard = 0;

        if (userProgress) {
            oldLevel = Number(userProgress.current_level) || 1;
            oldTotalXp = Number(userProgress.total_xp) || 0;
            oldSurgeon = Number(userProgress.surgeon_badge_unlocked) || 0;
            oldVector = Number(userProgress.vector_lock_badge_unlocked) || 0;
            oldVanguard = Number(userProgress.vanguard_badge_unlocked) || 0;
        }

        const newTotalXp = oldTotalXp + xpEarned;
        const progress = getXpProgressWithinLevel(newTotalXp);
        const currentLevel = progress.currentLevel;
        const currentXp = progress.xpIntoLevel;
        const xpNeededForNext = progress.xpNeededForNext;
        const levelUp = currentLevel > oldLevel;

        const xpDist = distributeXp(exerciseId, xpEarned);

        const stmtTelemetry = db.prepare(`
            INSERT INTO session_logs
                (user_id, exercise_id, difficulty, username, ghost_telemetry, score, kps, duration, hits, misses, accuracy, max_combo,
                 xp_earned, integrity_flag, is_flagged, flag_reason, average_urgency_index, over_flick_coefficient,
                 miss_quadrant_top_left, miss_quadrant_top_right, miss_quadrant_bottom_left, miss_quadrant_bottom_right, neural_stability_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            userId, exerciseId, difficulty, username, ghostTelemetry, score, kps, durationSeconds, hits, misses, accuracy, maxCombo,
            xpEarned, integrityFlag, isFlagged, flagReason, averageUrgencyIndex, overFlickCoefficient,
            qTL, qTR, qBL, qBR, neuralStabilityScore
        );

        const stmtProgression = db.prepare(`
            INSERT INTO skill_matrices (
                user_id, current_level, total_xp, surgeon_badge_unlocked, vector_lock_badge_unlocked, vanguard_badge_unlocked,
                accuracy, total_games, time_played,
                xp_flicking, xp_tracking, xp_speed, xp_precision, xp_perception, xp_cognition,
                miss_quadrant_top_left, miss_quadrant_top_right, miss_quadrant_bottom_left, miss_quadrant_bottom_right,
                last_played_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                current_level = excluded.current_level,
                total_xp = excluded.total_xp,
                surgeon_badge_unlocked = excluded.surgeon_badge_unlocked,
                vector_lock_badge_unlocked = excluded.vector_lock_badge_unlocked,
                vanguard_badge_unlocked = excluded.vanguard_badge_unlocked,
                accuracy = (accuracy * total_games + excluded.accuracy) / (total_games + 1),
                time_played = time_played + excluded.time_played,
                xp_flicking = xp_flicking + excluded.xp_flicking,
                xp_tracking = xp_tracking + excluded.xp_tracking,
                xp_speed = xp_speed + excluded.xp_speed,
                xp_precision = xp_precision + excluded.xp_precision,
                xp_perception = xp_perception + excluded.xp_perception,
                xp_cognition = xp_cognition + excluded.xp_cognition,
                miss_quadrant_top_left = miss_quadrant_top_left + excluded.miss_quadrant_top_left,
                miss_quadrant_top_right = miss_quadrant_top_right + excluded.miss_quadrant_top_right,
                miss_quadrant_bottom_left = miss_quadrant_bottom_left + excluded.miss_quadrant_bottom_left,
                miss_quadrant_bottom_right = miss_quadrant_bottom_right + excluded.miss_quadrant_bottom_right,
                total_games = total_games + 1,
                last_played_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
        `).bind(
            userId, currentLevel, newTotalXp, oldSurgeon, oldVector, oldVanguard,
            accuracy, durationSeconds,
            xpDist.xpGainedFlicking, xpDist.xpGainedTracking, xpDist.xpGainedSpeed, xpDist.xpGainedPrecision, xpDist.xpGainedPerception, xpDist.xpGainedCognition,
            qTL, qTR, qBL, qBR
        );

        await db.batch([stmtTelemetry, stmtProgression]);

        return NextResponse.json({
            success: true,
            xpEarned,
            levelUp,
            currentLevel,
            currentXp,
            xpNeededForNext
        });

    } catch (error) {
        console.error('D1 POST Telemetry/Progression Error:', error);
        return NextResponse.json({ error: 'Database operations failed' }, { status: 500 });
    }
}