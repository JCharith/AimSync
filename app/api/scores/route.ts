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
        const { getRequestContext } = await import('@cloudflare/next-on-pages');
        return getRequestContext().env.DB;
    } catch {
        return null;
    }
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
            global_accuracy: 0,
            modes_data: '{}',
            playlists: '[]',
            last_played_at: new Date().toISOString()
        });
    }

    const db = await getDb();
    if (!db) {
        // Not running on Cloudflare edge (local Next.js dev server).
        // Return a clean 200 with default mock/empty structure to keep the developer console silent.
        return NextResponse.json(history ? [] : {
            total_games: 0,
            time_played: 0,
            global_accuracy: 0,
            modes_data: '{}',
            playlists: '[]',
            last_played_at: new Date().toISOString()
        });
    }

    try {
        if (history) {
            const result = await db
                .prepare('SELECT accuracy FROM scores_telemetry WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
                .bind(userId)
                .all();
            return NextResponse.json(result.results || []);
        }

        const result = await db
            .prepare('SELECT * FROM user_progression WHERE user_id = ?')
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
    // Parse and normalize the incoming payload
    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // 1. Session Guarding: Ensure user is logged in (and not a trial guest)
    const session = await auth();
    const isTrialUser = body.isTrial === true || !session || !session.user || !session.user.id || session.user.id === 'guest' || session.user.id === 'trial' || session.user.id === 'local';

    if (isTrialUser || !session || !session.user || !session.user.id) {
        // Return a mock response, short-circuiting database execution and leveling triggers
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
            await db.prepare(`
                INSERT INTO user_progression (
                    user_id, global_accuracy, total_games, time_played, 
                    modes_data, playlists, miss_quadrants, 
                    total_xp, current_level,
                    xp_flicking, xp_tracking, xp_speed, xp_precision, xp_perception, xp_cognition,
                    last_played_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET
                    global_accuracy = excluded.global_accuracy,
                    total_games = excluded.total_games,
                    time_played = excluded.time_played,
                    modes_data = excluded.modes_data,
                    playlists = excluded.playlists,
                    miss_quadrants = excluded.miss_quadrants,
                    total_xp = excluded.total_xp,
                    current_level = excluded.current_level,
                    xp_flicking = excluded.xp_flicking,
                    xp_tracking = excluded.xp_tracking,
                    xp_speed = excluded.xp_speed,
                    xp_precision = excluded.xp_precision,
                    xp_perception = excluded.xp_perception,
                    xp_cognition = excluded.xp_cognition,
                    last_played_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
            `).bind(
                userId,
                body.stats.globalAccuracy || 0,
                body.stats.totalGamesPlayed || 0,
                body.stats.timePlayedSeconds || 0,
                JSON.stringify(body.stats.modes || {}),
                JSON.stringify(body.stats.playlists || []),
                JSON.stringify(body.stats.missQuadrants || {}),
                body.stats.xp || 0,
                body.stats.level || 1,
                body.stats.xpFactors?.flickingXp || 0,
                body.stats.xpFactors?.trackingXp || 0,
                body.stats.xpFactors?.speedXp || 0,
                body.stats.xpFactors?.precisionXp || 0,
                body.stats.xpFactors?.perceptionXp || 0,
                body.stats.xpFactors?.cognitionXp || 0
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
    // Advanced kinematic telemetry (StaticFlick / FlickBenchmark only; defaults to 1.0 for other modes)
    const averageUrgencyIndex   = typeof body.averageUrgencyIndex   === 'number' ? body.averageUrgencyIndex   : 1.0;
    const overFlickCoefficient  = typeof body.overFlickCoefficient  === 'number' ? body.overFlickCoefficient  : 1.0;
    const difficulty            = body.difficulty || "medium";
    const username              = session.user.name || session.user.email || "Player";
    const ghostTelemetry        = body.ghostTelemetry || body.ghost_telemetry || null;
    const missQuadrants         = body.missQuadrants || body.miss_quadrants || null;
    const neuralStabilityScore  = typeof body.neuralStabilityScore === 'number' ? body.neuralStabilityScore : null;

    const totalTargets = hits + misses;
    const accuracyFraction = totalTargets > 0 ? (hits / totalTargets) : 0;
    const accuracy = accuracyFraction * 100;

    // 2. Input Anti-Cheat & Telemetry Progression Validation
    const inputVelocity = durationSeconds > 0 ? (totalTargets / durationSeconds) : 0;
    const isArithmeticProgression = checkArithmeticProgression(ghostTelemetry);
    const telemetryValidation = validateGhostTelemetry(ghostTelemetry);
    const score = typeof body.score === 'number' ? body.score : (body.rawScoreData?.score ?? (hits * 10 + maxCombo * 5));

    // Calculate multiplier anomaly ratio based on target velocity or abnormal score scaling
    const anomalyRatioNumber = inputVelocity > 15 ? (inputVelocity / 15) : (totalTargets > 0 && score > totalTargets * 25 ? (score / (totalTargets * 10)) : 1.0);
    const anomalyMultiplier = `${anomalyRatioNumber.toFixed(2)}x norm`;
    
    let isFlagged = 0;
    let flagReason: string | null = null;

    if (durationSeconds < 5 || inputVelocity > 15) {
        isFlagged = 1;
        flagReason = 'Velocity/Duration Threshold Exceeded';
    } else if (isArithmeticProgression) {
        isFlagged = 1;
        flagReason = 'Arithmetic Progression Timing (Bot/Script)';
    } else if (telemetryValidation.isSuspicious) {
        isFlagged = 1;
        flagReason = telemetryValidation.reason;
    } else if (anomalyRatioNumber > 1.5) {
        isFlagged = 1;
        flagReason = `Abnormal Score Multiplier (${anomalyMultiplier})`;
    }
    
    let integrityFlag = 'HIGH_INTEGRITY';
    let xpEarned = 0;
    
    // XP Delta = Base Run Fee (100) + (Score / 10) * (Accuracy > 0.90 ? 1.5 : 1.0)
    const accuracyMultiplier = accuracyFraction > 0.90 ? 1.5 : 1.0;
    const baseXp = 100 + (score / 10) * accuracyMultiplier;

    if (isFlagged === 1) {
        integrityFlag = 'LOW_INTEGRITY';
        xpEarned = 0;

        // Fast, non-blocking alert fetch directly to Discord Admin Webhook
        const discordAdminWebhookUrl = process.env.DISCORD_ADMIN_WEBHOOK_URL || (process.env as any).DISCORD_ADMIN_WEBHOOK_URL || process.env.N8N_SECURITY_WEBHOOK_URL;
        if (discordAdminWebhookUrl) {
            const hardwareProfile = body.hardwareProfile || body.hardware || 'Unknown Hardware ID';
            const timestamp = new Date().toISOString();

            const discordPayload = {
                embeds: [
                    {
                        title: '🚨 AEGIS-SENTINEL: CHEATING ANOMALY DETECTED',
                        description: 'An anomalous game state progression and timing pattern was intercepted by the AimSync Edge scores telemetry pipeline.',
                        color: 15158332,
                        fields: [
                            {
                                name: '👤 Player ID / Username',
                                value: `\`${username}\` (ID: \`${userId}\`)`,
                                inline: true
                            },
                            {
                                name: '🎮 Captured Score & Drill',
                                value: `**${score.toLocaleString()}** (Drill: \`${exerciseId}\`)`,
                                inline: true
                            },
                            {
                                name: '⚡ Score Multiplier Anomaly',
                                value: `\`${anomalyMultiplier}\``,
                                inline: true
                            },
                            {
                                name: '🛡️ Detection Trigger',
                                value: `\`${flagReason || 'Telemetry Anomaly'}\``
                            },
                            {
                                name: '💻 Hardware Profile',
                                value: `\`\`\`\n${hardwareProfile}\n\`\`\``
                            },
                            {
                                name: '📊 Telemetry Diagnostics',
                                value: `• **Accuracy:** ${accuracy.toFixed(2)}%\n• **Hits/Misses:** ${hits} Hits / ${misses} Misses\n• **Run Duration:** ${durationSeconds}s\n• **Target Velocity:** ${inputVelocity.toFixed(2)} targets/sec`
                            }
                        ],
                        footer: {
                            text: 'AimSync Aegis Security Guard • #admin-alerts'
                        },
                        timestamp
                    }
                ]
            };

            const alertPromise = fetch(discordAdminWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(discordPayload)
            }).catch(err => console.error('[Anti-Cheat Discord Webhook Error]:', err));

            // Offload HTTP request so it doesn't block score response latency
            try {
                import('@cloudflare/next-on-pages').then(({ getRequestContext }) => {
                    const ctxObj = getRequestContext().ctx;
                    if (ctxObj && typeof ctxObj.waitUntil === 'function') {
                        ctxObj.waitUntil(alertPromise);
                    }
                }).catch(() => {});
            } catch {
                // Fallback for non-Cloudflare environments
            }
        }
    } else {
        xpEarned = Math.round(baseXp);
    }

    const db = await getDb();

    // Local dev mock fallback if database is not bound
    if (!db) {
        const mockTotalXpBefore = 0;
        const mockLevelBefore = 1;
        const newTotalXp = mockTotalXpBefore + xpEarned;

        const progress = getXpProgressWithinLevel(newTotalXp);
        const currentLevel = progress.currentLevel;
        const currentXp = progress.xpIntoLevel;
        const xpNeededForNext = progress.xpNeededForNext;
        const levelUp = currentLevel > mockLevelBefore;

        return NextResponse.json({
            success: true,
            xpEarned,
            levelUp,
            currentLevel,
            currentXp,
            xpNeededForNext,
            mocked: true
        });
    }

    try {
        // Read current stats from D1
        const userProgress = await db.prepare(
            "SELECT current_level, total_xp, surgeon_badge_unlocked, vector_lock_badge_unlocked, vanguard_badge_unlocked, total_games FROM user_progression WHERE user_id = ?"
        ).bind(userId).first();

        let oldLevel = 1;
        let oldTotalXp = 0;
        let oldSurgeon = 0;
        let oldVector = 0;
        let oldVanguard = 0;
        let gamesPlayed = 0;

        if (userProgress) {
            oldLevel = Number(userProgress.current_level) || 1;
            oldTotalXp = Number(userProgress.total_xp) || 0;
            oldSurgeon = Number(userProgress.surgeon_badge_unlocked) || 0;
            oldVector = Number(userProgress.vector_lock_badge_unlocked) || 0;
            oldVanguard = Number(userProgress.vanguard_badge_unlocked) || 0;
            gamesPlayed = Number(userProgress.total_games) || 0;
        }

        // Milestone Badge Checklist
        const normId = exerciseId.toLowerCase().replace(/_/g, '-');
        const isMicroAdjust = normId === 'micro-adjust' || normId === 'micro_adjust';
        const isTracking = normId === 'continuous-tracking' || normId === 'continuous_tracking' || normId === 'tracking-mode' || normId === 'tracking_mode' || normId === 'tracking-protocol';

        let surgeonBadgeUnlocked = oldSurgeon;
        if (isMicroAdjust && accuracy >= 98 && totalTargets >= 50) {
            surgeonBadgeUnlocked = 1;
        }

        let vectorLockBadgeUnlocked = oldVector;
        if (isTracking && accuracy >= 90) {
            vectorLockBadgeUnlocked = 1;
        }

        // Quadratic Level Math Engine
        const newTotalXp = oldTotalXp + xpEarned;
        const progress = getXpProgressWithinLevel(newTotalXp);
        
        const currentLevel = progress.currentLevel;
        const currentXp = progress.xpIntoLevel;
        const xpNeededForNext = progress.xpNeededForNext;
        const levelUp = currentLevel > oldLevel;

        // XP Factor Distribution
        const xpDist = distributeXp(exerciseId, xpEarned);

        // Quadrant Processing
        let qTL = 0, qTR = 0, qBL = 0, qBR = 0;
        if (missQuadrants) {
            const total = (missQuadrants.topLeft || 0) + (missQuadrants.topRight || 0) + (missQuadrants.bottomLeft || 0) + (missQuadrants.bottomRight || 0);
            if (total > 0) {
                qTL = (missQuadrants.topLeft || 0) / total;
                qTR = (missQuadrants.topRight || 0) / total;
                qBL = (missQuadrants.bottomLeft || 0) / total;
                qBR = (missQuadrants.bottomRight || 0) / total;
            }
        }

        // Atomic D1 Execution
        const missQuadrantsStr = missQuadrants ? JSON.stringify(missQuadrants) : null;
        const stmtTelemetry = db.prepare(`
            INSERT INTO scores_telemetry
                (user_id, exercise_id, difficulty, username, ghost_telemetry, hits, misses, accuracy, max_combo, duration_seconds,
                 xp_earned, integrity_flag, average_urgency_index, over_flick_coefficient, miss_quadrants, neural_stability_score, flagged, flag_reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            userId, exerciseId, difficulty, username, ghostTelemetry, hits, misses, accuracy, maxCombo, durationSeconds,
            xpEarned, integrityFlag, averageUrgencyIndex, overFlickCoefficient, missQuadrantsStr, neuralStabilityScore,
            isFlagged === 1 ? 1 : 0, flagReason
        );

        const stmtProgression = db.prepare(`
            INSERT INTO user_progression (
                user_id, current_level, total_xp, surgeon_badge_unlocked, vector_lock_badge_unlocked, vanguard_badge_unlocked,
                xp_flicking, xp_tracking, xp_speed, xp_precision, xp_perception, xp_cognition,
                quadrant_top_left, quadrant_top_right, quadrant_bottom_left, quadrant_bottom_right,
                total_games, last_played_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                current_level = excluded.current_level,
                total_xp = excluded.total_xp,
                surgeon_badge_unlocked = excluded.surgeon_badge_unlocked,
                vector_lock_badge_unlocked = excluded.vector_lock_badge_unlocked,
                vanguard_badge_unlocked = excluded.vanguard_badge_unlocked,
                xp_flicking = xp_flicking + excluded.xp_flicking,
                xp_tracking = xp_tracking + excluded.xp_tracking,
                xp_speed = xp_speed + excluded.xp_speed,
                xp_precision = xp_precision + excluded.xp_precision,
                xp_perception = xp_perception + excluded.xp_perception,
                xp_cognition = xp_cognition + excluded.xp_cognition,
                quadrant_top_left = CASE WHEN total_games = 0 THEN excluded.quadrant_top_left ELSE (quadrant_top_left * 0.8 + excluded.quadrant_top_left * 0.2) END,
                quadrant_top_right = CASE WHEN total_games = 0 THEN excluded.quadrant_top_right ELSE (quadrant_top_right * 0.8 + excluded.quadrant_top_right * 0.2) END,
                quadrant_bottom_left = CASE WHEN total_games = 0 THEN excluded.quadrant_bottom_left ELSE (quadrant_bottom_left * 0.8 + excluded.quadrant_bottom_left * 0.2) END,
                quadrant_bottom_right = CASE WHEN total_games = 0 THEN excluded.quadrant_bottom_right ELSE (quadrant_bottom_right * 0.8 + excluded.quadrant_bottom_right * 0.2) END,
                total_games = total_games + 1,
                last_played_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
        `).bind(
            userId, currentLevel, newTotalXp, surgeonBadgeUnlocked, vectorLockBadgeUnlocked, oldVanguard,
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

// --- Helper: Check for bot-like periodic hits forming a perfect arithmetic progression ---
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

        // Standard deviation < 2ms with consistent rate indicates auto-firing scripts
        if (stdDev < 2.0) {
            return true;
        }
    } catch {
        // Fail-safe to avoid false positives or crashes on corrupt client inputs
    }
    return false;
}

// --- Helper: Validate ghost telemetry for perfectly straight lines and instant teleportation ---
function validateGhostTelemetry(ghostTelemetry: any): { isSuspicious: boolean, reason: string | null } {
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

        const path = ghost.path || ghost.p; // Depending on if it's compressed or decompressed format
        if (!path || !Array.isArray(path) || path.length < 5) return { isSuspicious: false, reason: null };

        // Configuration Thresholds for Anti-Cheat
        const MAX_STRAIGHT_LINE_DURATION_MS = 500; // 500ms moving in a perfectly straight line is physically implausible
        const MAX_TELEPORT_DISTANCE_PER_MS = 50; // max normalized units per ms

        let currentStraightLineStartIdx = 0;
        
        for (let i = 1; i < path.length; i++) {
            const p1 = path[i-1];
            const p2 = path[i];
            
            // p[0] is x, p[1] is y, p[2] is t
            const dx = p2[0] - p1[0];
            const dy = p2[1] - p1[1];
            const dt = p2[2] - p1[2];
            
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            // Check Teleportation
            if (dt >= 0 && dt <= 5 && dist > MAX_TELEPORT_DISTANCE_PER_MS * 5) {
                const speed = dt === 0 ? dist : dist / dt;
                if (speed > MAX_TELEPORT_DISTANCE_PER_MS) {
                    return { isSuspicious: true, reason: `Teleportation detected: Speed ${speed.toFixed(2)} units/ms` };
                }
            }

            // Check Straight Line
            if (i >= 2) {
                const p0 = path[i-2];
                // Check cross product to see if p0, p1, p2 are collinear
                const dx1 = p1[0] - p0[0];
                const dy1 = p1[1] - p0[1];
                const dx2 = p2[0] - p1[0];
                const dy2 = p2[1] - p1[1];
                
                const crossProduct = dx1 * dy2 - dy1 * dx2;
                
                // If the cross product is near 0, they are collinear
                if (Math.abs(crossProduct) < 0.1 && (Math.abs(dx2) > 0 || Math.abs(dy2) > 0)) {
                    const duration = p2[2] - path[currentStraightLineStartIdx][2];
                    if (duration > MAX_STRAIGHT_LINE_DURATION_MS) {
                        return { isSuspicious: true, reason: `Straight line detected over ${duration}ms` };
                    }
                } else {
                    currentStraightLineStartIdx = i - 1;
                }
            }
        }
    } catch {
       // fail safe
    }
    return { isSuspicious: false, reason: null };
}