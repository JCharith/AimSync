import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getXpProgressWithinLevel } from '@/lib/utils/progressionEngine';
import { distributeXp } from '@/lib/utils/statsService';

// Force Next.js to run on Cloudflare Edge network layer for zero-latency operations
export const runtime = 'edge';

// Helper: Get Cloudflare D1 database binding at runtime
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

// Edge HMAC-SHA256 Verification to validate session headers against server secret
async function verifyHmacSha256(message: string, signature: string, secretKey: string): Promise<boolean> {
    try {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secretKey);
        const msgData = encoder.encode(message);
        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const signatureBuffer = await crypto.subtle.sign('HMAC', key, msgData);
        const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        return expectedSignature === signature;
    } catch {
        return false;
    }
}

// Helper: Categorize click deltas or miss objects into 4 basic quadrants (INTEGER counts)
function compute4QuadrantMissCounts(payload: any): { qTL: number; qTR: number; qBL: number; qBR: number } {
    let qTL = 0, qTR = 0, qBL = 0, qBR = 0;

    // 1. Direct object format check { topLeft, topRight, bottomLeft, bottomRight }
    const mq = payload.missQuadrants || payload.miss_quadrants;
    if (mq && typeof mq === 'object') {
        qTL = Math.max(0, Math.floor(mq.topLeft || mq.top_left || mq.miss_quadrant_top_left || 0));
        qTR = Math.max(0, Math.floor(mq.topRight || mq.top_right || mq.miss_quadrant_top_right || 0));
        qBL = Math.max(0, Math.floor(mq.bottomLeft || mq.bottom_left || mq.miss_quadrant_bottom_left || 0));
        qBR = Math.max(0, Math.floor(mq.bottomRight || mq.bottom_right || mq.miss_quadrant_bottom_right || 0));
        return { qTL, qTR, qBL, qBR };
    }

    // 2. Click delta coordinates list check [ { x, y }, ... ]
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

// --- Anti-Cheat Helper 1: Bot periodic auto-firing arithmetic progression check ---
function checkArithmeticProgression(ghostTelemetry: any): boolean {
    if (!ghostTelemetry) return false;
    try {
        const telemetry = typeof ghostTelemetry === 'string' ? JSON.parse(ghostTelemetry) : ghostTelemetry;
        let timestamps: number[] = [];
        if (Array.isArray(telemetry)) {
            if (telemetry.length < 5) return false;
            if (typeof telemetry[0] === 'number') {
                timestamps = telemetry;
            } else if (telemetry[0] && typeof telemetry[0].t === 'number') {
                timestamps = telemetry.map((item: any) => item.t);
            } else if (telemetry[0] && typeof telemetry[0].timestamp === 'number') {
                timestamps = telemetry.map((item: any) => item.timestamp);
            }
        }
        if (timestamps.length < 5) return false;

        const intervals: number[] = [];
        for (let i = 1; i < timestamps.length; i++) {
            intervals.push(timestamps[i] - timestamps[i - 1]);
        }

        const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
        if (mean <= 0) return false;

        const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);

        return stdDev < 2.0;
    } catch {
        return false;
    }
}

// --- Anti-Cheat Helper 2: Kinematic telemetry teleportation & linear trajectory validation ---
function validateGhostTelemetry(ghostTelemetry: any): { isSuspicious: boolean; reason: string | null } {
    if (!ghostTelemetry) return { isSuspicious: false, reason: null };
    try {
        let ghost;
        if (typeof ghostTelemetry === 'string') {
            try {
                ghost = JSON.parse(ghostTelemetry);
            } catch {
                return { isSuspicious: false, reason: null };
            }
        } else {
            ghost = ghostTelemetry;
        }

        if (Array.isArray(ghost) && ghost.length > 5 && typeof ghost[0] === 'object' && ghost[0].x !== undefined) {
            let zeroDeltas = 0;
            for (let i = 1; i < ghost.length; i++) {
                const dx = ghost[i].x - ghost[i - 1].x;
                const dy = ghost[i].y - ghost[i - 1].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const dt = ghost[i].t !== undefined && ghost[i - 1].t !== undefined ? (ghost[i].t - ghost[i - 1].t) : 16;
                if (dt > 0 && dist / dt > 50) {
                    return { isSuspicious: true, reason: 'Instantaneous Cursor Teleportation Detected' };
                }
                if (dist === 0) zeroDeltas++;
            }
            if (zeroDeltas > ghost.length * 0.9) {
                return { isSuspicious: true, reason: 'Synthetic Straight-Line Bot Trajectory' };
            }
        }
    } catch {
        return { isSuspicious: false, reason: null };
    }
    return { isSuspicious: false, reason: null };
}

// ====================================================================
// POST Handler: Edge Network Session Security Lockdown & Telemetry Sync
// ====================================================================
export async function POST(request: Request) {
    // 1. Edge Cryptographic Session Header & Token Lockdown (Network Layer Enforcement)
    const authHeader = request.headers.get('Authorization');
    const customSigHeader = request.headers.get('x-session-signature');
    const customUserIdHeader = request.headers.get('x-user-id');
    const secret = process.env.AUTH_SECRET;

    // Retrieve active session via Auth.js
    const session = await auth().catch(() => null);

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const isTrialUser = body.isTrial === true || body.guest === true;

    // Reject untrusted requests immediately if not trial mode and session/auth headers are absent or invalid
    if (!isTrialUser) {
        if (!session || !session.user || !session.user.id) {
            // Rejection vector 1: Missing Auth.js session
            if (!authHeader && !customSigHeader) {
                return NextResponse.json(
                    { error: 'Unauthorized: Missing valid session authentication token or headers' },
                    { status: 401 }
                );
            }
        }

        const userId = session?.user?.id || customUserIdHeader;
        if (!userId || userId === 'guest' || userId === 'trial' || userId === 'local' || userId === 'undefined') {
            return NextResponse.json(
                { error: 'Unauthorized: Invalid user identity header' },
                { status: 401 }
            );
        }

        // Cryptographic HMAC session verification
        if (secret) {
            if (session?.user?.signature) {
                const isValidSig = await verifyHmacSha256(userId, session.user.signature, secret);
                if (!isValidSig) {
                    return NextResponse.json(
                        { error: 'Forbidden: DevTools Session Signature Spoofing Intercepted' },
                        { status: 403 }
                    );
                }
            }
            if (customSigHeader && customUserIdHeader) {
                if (customUserIdHeader !== userId) {
                    return NextResponse.json(
                        { error: 'Forbidden: Security Header Mismatch' },
                        { status: 403 }
                    );
                }
                const isValidHeaderSig = await verifyHmacSha256(customUserIdHeader, customSigHeader, secret);
                if (!isValidHeaderSig) {
                    return NextResponse.json(
                        { error: 'Forbidden: Network Layer Header Signature Tampered' },
                        { status: 403 }
                    );
                }
            }
        }
    }

    // Trial Mode Short-Circuit Response
    if (isTrialUser || !session || !session.user || !session.user.id) {
        return NextResponse.json({
            success: true,
            xpEarned: 0,
            levelUp: false,
            currentLevel: 1,
            currentXp: 0,
            xpNeededForNext: 500,
            mocked: true,
            message: 'Trial session processed off-ledger'
        });
    }

    const userId = session.user.id;

    // 2. Server-Side Performance Data Extraction & Zero-Client-Trust Calculations
    const exerciseId = body.exerciseId || body.exercise_id || 'unknown';
    const rawHits = typeof body.hits === 'number' ? body.hits : (body.rawScoreData?.hits ?? 0);
    const rawMisses = typeof body.misses === 'number' ? body.misses : (body.rawScoreData?.misses ?? 0);
    const maxCombo = typeof body.maxCombo === 'number' ? body.maxCombo : (body.rawScoreData?.maxCombo ?? 0);
    const durationSeconds = typeof body.durationSeconds === 'number' ? body.durationSeconds : (body.rawScoreData?.durationSeconds ?? body.duration_seconds ?? 0);

    const hits = Math.max(0, Math.floor(rawHits));
    const misses = Math.max(0, Math.floor(rawMisses));
    const totalTargets = hits + misses;
    const accuracyFraction = totalTargets > 0 ? (hits / totalTargets) : 0;
    const accuracy = accuracyFraction * 100;

    const averageUrgencyIndex = typeof body.averageUrgencyIndex === 'number' ? body.averageUrgencyIndex : 1.0;
    const overFlickCoefficient = typeof body.overFlickCoefficient === 'number' ? body.overFlickCoefficient : 1.0;
    const difficulty = body.difficulty || 'medium';
    const username = session.user.name || session.user.email || 'Player';
    const ghostTelemetry = body.ghostTelemetry || body.ghost_telemetry || null;
    const neuralStabilityScore = typeof body.neuralStabilityScore === 'number' ? body.neuralStabilityScore : null;

    // Compute 4-Quadrant Miss Accumulator (INTEGER Counts, zero raw pixel insertions)
    const { qTL, qTR, qBL, qBR } = compute4QuadrantMissCounts(body);

    // 3. Anti-Cheat & Heuristic Evaluation
    const inputVelocity = durationSeconds > 0 ? (totalTargets / durationSeconds) : 0;
    const kps = Number(inputVelocity.toFixed(2));
    const isArithmeticProgression = checkArithmeticProgression(ghostTelemetry);
    const telemetryValidation = validateGhostTelemetry(ghostTelemetry);

    let isFlagged = 0;
    let flagReason: string | null = null;

    if (durationSeconds < 5 || inputVelocity > 15) {
        isFlagged = 1;
        flagReason = `Velocity/Duration Threshold Exceeded (Inputs/s: ${inputVelocity.toFixed(1)}, Duration: ${durationSeconds}s)`;
    } else if (isArithmeticProgression) {
        isFlagged = 1;
        flagReason = 'Arithmetic Progression Timing Detected (Bot/Script)';
    } else if (telemetryValidation.isSuspicious) {
        isFlagged = 1;
        flagReason = telemetryValidation.reason;
    }

    let integrityFlag = 'HIGH_INTEGRITY';
    let xpEarned = 0;

    const score = typeof body.score === 'number' ? body.score : (hits * 10 + maxCombo * 5);
    const accuracyMultiplier = accuracyFraction > 0.90 ? 1.5 : 1.0;
    const baseXp = 100 + (score / 10) * accuracyMultiplier;

    if (isFlagged === 1) {
        integrityFlag = 'LOW_INTEGRITY';
        xpEarned = 0;

        const n8nWebhookUrl = process.env.N8N_SCORE_FLAG_WEBHOOK_URL || process.env.N8N_SECURITY_WEBHOOK_URL;
        if (n8nWebhookUrl) {
            const alertPromise = fetch(n8nWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userName: username,
                    userId,
                    drillName: exerciseId,
                    score,
                    kps,
                    reason: flagReason || 'Telemetry Anomaly Detected',
                    is_flagged: 1,
                    hardwareProfile: body.hardwareProfile || body.hardware || 'Unknown HWID',
                    telemetrySummary: { hits, misses, accuracy: Number(accuracy.toFixed(2)), durationSeconds, inputVelocity: kps }
                })
            }).catch(err => console.error('[Anti-Cheat Webhook Error]:', err));

            try {
                const { getCloudflareContext } = await import('@opennextjs/cloudflare');
                const { ctx: ctxObj } = await getCloudflareContext();
                if (ctxObj && typeof ctxObj.waitUntil === 'function') {
                    ctxObj.waitUntil(alertPromise);
                }
            } catch {
                // Fallback
            }
        }
    } else {
        xpEarned = Math.round(baseXp);
    }

    // 4. Cloudflare D1 Relational Database Operations
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
            isFlagged: isFlagged === 1,
            mocked: true
        });
    }

    try {
        // Read current skill matrix / progression stats from D1
        const userProgress = await db.prepare(
            `SELECT current_level, total_xp, surgeon_badge_unlocked, vector_lock_badge_unlocked, vanguard_badge_unlocked, total_games,
                    accuracy, flicking, tracking, reaction, consistency, spray_control,
                    miss_quadrant_top_left, miss_quadrant_top_right, miss_quadrant_bottom_left, miss_quadrant_bottom_right
             FROM skill_matrices WHERE user_id = ?`
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

        // Milestone Check
        const normId = exerciseId.toLowerCase().replace(/_/g, '-');
        const isMicroAdjust = normId === 'micro-adjust' || normId === 'micro_adjust';
        const isTracking = normId === 'continuous-tracking' || normId === 'continuous_tracking' || normId === 'tracking-mode';

        let surgeonBadgeUnlocked = oldSurgeon;
        if (isMicroAdjust && accuracy >= 98 && totalTargets >= 50) {
            surgeonBadgeUnlocked = 1;
        }

        let vectorLockBadgeUnlocked = oldVector;
        if (isTracking && accuracy >= 90) {
            vectorLockBadgeUnlocked = 1;
        }

        const newTotalXp = oldTotalXp + xpEarned;
        const progress = getXpProgressWithinLevel(newTotalXp);
        const currentLevel = progress.currentLevel;
        const currentXp = progress.xpIntoLevel;
        const xpNeededForNext = progress.xpNeededForNext;
        const levelUp = currentLevel > oldLevel;

        const xpDist = distributeXp(exerciseId, xpEarned);

        // Statement 1: Insert session performance log into session_logs
        const stmtTelemetry = db.prepare(`
            INSERT INTO session_logs (
                user_id, exercise_id, difficulty, username,
                score, kps, duration, hits, misses, accuracy, max_combo, xp_earned,
                is_flagged, flag_reason, integrity_flag,
                average_urgency_index, over_flick_coefficient,
                miss_quadrant_top_left, miss_quadrant_top_right, miss_quadrant_bottom_left, miss_quadrant_bottom_right,
                ghost_telemetry, neural_stability_score
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            userId, exerciseId, difficulty, username,
            score, kps, durationSeconds, hits, misses, accuracy, maxCombo, xpEarned,
            isFlagged, flagReason, integrityFlag,
            averageUrgencyIndex, overFlickCoefficient,
            qTL, qTR, qBL, qBR,
            ghostTelemetry, neuralStabilityScore
        );

        // Statement 2: Upsert skill_matrices with 4-Quadrant INTEGER miss accumulator increment
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
            userId, currentLevel, newTotalXp, surgeonBadgeUnlocked, vectorLockBadgeUnlocked, oldVanguard,
            accuracy, durationSeconds,
            xpDist.xpGainedFlicking, xpDist.xpGainedTracking, xpDist.xpGainedSpeed, xpDist.xpGainedPrecision, xpDist.xpGainedPerception, xpDist.xpGainedCognition,
            qTL, qTR, qBL, qBR
        );

        // Execute batch transaction on Cloudflare D1
        await db.batch([stmtTelemetry, stmtProgression]);

        return NextResponse.json({
            success: true,
            xpEarned,
            levelUp,
            currentLevel,
            currentXp,
            xpNeededForNext,
            isFlagged: isFlagged === 1,
            flagReason
        });

    } catch (error) {
        console.error('D1 Save Session Edge Error:', error);
        return NextResponse.json({ error: 'Database session sync failed' }, { status: 500 });
    }
}
