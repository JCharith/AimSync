import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getLevelFromXp } from '@/lib/utils/progressionEngine';

// Force Next.js to use Cloudflare Edge Runtime
export const runtime = 'edge';

// Helper to retrieve Cloudflare D1 database binding
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

export interface RadarDataPoint {
    subject: string;
    level: number;
    fullMark: number;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const session = await auth().catch(() => null);
    let userId = session?.user?.id || searchParams.get('userId') || undefined;
    const returnFull = searchParams.get('full') === 'true';

    // Baseline fallback structure for guests or unauthenticated states
    const defaultRadarData: RadarDataPoint[] = [
        { subject: 'Flicking', level: 1, fullMark: 100 },
        { subject: 'Tracking', level: 1, fullMark: 100 },
        { subject: 'Speed', level: 1, fullMark: 100 },
        { subject: 'Precision', level: 1, fullMark: 100 },
        { subject: 'Perception', level: 1, fullMark: 100 },
        { subject: 'Cognition', level: 1, fullMark: 100 },
    ];

    if (!userId || userId === 'undefined' || userId === 'local' || userId === 'null' || userId === 'guest' || userId === 'trial') {
        if (returnFull) {
            return NextResponse.json({
                radarData: defaultRadarData,
                skillMatrix: null,
                progression: null,
                sessionAverages: null,
                authenticated: false
            });
        }
        return NextResponse.json(defaultRadarData);
    }

    const db = await getDb();

    if (!db) {
        // Fallback for local development server without active D1 binding
        const mockRadarData: RadarDataPoint[] = [
            { subject: 'Flicking', level: 12, fullMark: 100 },
            { subject: 'Tracking', level: 18, fullMark: 100 },
            { subject: 'Speed', level: 25, fullMark: 100 },
            { subject: 'Precision', level: 15, fullMark: 100 },
            { subject: 'Perception', level: 20, fullMark: 100 },
            { subject: 'Cognition', level: 22, fullMark: 100 },
        ];
        if (returnFull) {
            return NextResponse.json({
                radarData: mockRadarData,
                skillMatrix: {
                    accuracy: 94.2, flicking: 12, tracking: 18, reaction: 25, consistency: 15, spray_control: 20,
                    miss_quadrant_top_left: 10, miss_quadrant_top_right: 15, miss_quadrant_bottom_left: 8, miss_quadrant_bottom_right: 12
                },
                progression: { current_level: 15, total_xp: 98000, global_accuracy: 94.2 },
                sessionAverages: { avg_accuracy: 94.2, avg_urgency: 1.05, neural_stability: 92.0 },
                authenticated: true,
                mocked: true
            });
        }
        return NextResponse.json(mockRadarData);
    }

    try {
        // 1. Direct fetch from optimized skill_matrices table in Cloudflare D1
        let matrix = await db
            .prepare(`
                SELECT 
                    accuracy, flicking, tracking, reaction, consistency, spray_control,
                    miss_quadrant_top_left, miss_quadrant_top_right, miss_quadrant_bottom_left, miss_quadrant_bottom_right,
                    current_level, total_xp, total_games, time_played,
                    xp_flicking, xp_tracking, xp_speed, xp_precision, xp_perception, xp_cognition
                FROM skill_matrices 
                WHERE user_id = ?
            `)
            .bind(userId)
            .first();

        // 2. If no row exists yet for new player, attempt calculation from session_logs or return baseline
        if (!matrix) {
            const telemetrySummary = await db
                .prepare(`
                    SELECT 
                        exercise_id, 
                        SUM(xp_earned) as total_xp,
                        COUNT(id) as total_games,
                        AVG(accuracy) as avg_accuracy
                    FROM session_logs 
                    WHERE user_id = ? AND (is_flagged = 0 OR is_flagged IS NULL)
                    GROUP BY exercise_id
                `)
                .bind(userId)
                .all();

            const rows = telemetrySummary.results || [];
            if (rows.length === 0) {
                // New player with no session logs: return default baseline matrix values
                if (returnFull) {
                    return NextResponse.json({
                        radarData: defaultRadarData,
                        skillMatrix: null,
                        progression: { current_level: 1, total_xp: 0, global_accuracy: 0.0 },
                        sessionAverages: null,
                        authenticated: true
                    });
                }
                return NextResponse.json(defaultRadarData);
            }

            let flickingXp = 0;
            let trackingXp = 0;
            let speedXp = 0;
            let precisionXp = 0;
            let perceptionXp = 0;
            let cognitionXp = 0;

            for (const row of rows) {
                const exercise = (row.exercise_id || 'unknown').toLowerCase().replace(/_/g, '-');
                const sessionXp = Number(row.total_xp) || 0;
                const primaryXp = Math.floor(sessionXp * 0.70);
                const secondaryXp = Math.floor(sessionXp * 0.30);

                switch (exercise) {
                    case 'static-flick':
                    case 'flick-benchmark':
                    case 'blind-flick':
                        precisionXp += primaryXp;
                        flickingXp += secondaryXp;
                        break;
                    case 'tracking-mode':
                    case 'continuous-track':
                    case 'recoil-evasion':
                    case 'recoil-reactive':
                    case 'consistency-check':
                        trackingXp += primaryXp;
                        perceptionXp += secondaryXp;
                        break;
                    case 'reaction-test':
                    case 'cognition-react':
                        speedXp += primaryXp;
                        perceptionXp += secondaryXp;
                        break;
                    case 'target-switch':
                    case 'cognitive-overdrive':
                        cognitionXp += primaryXp;
                        flickingXp += secondaryXp;
                        break;
                    case 'micro-adjust':
                    case 'micro-precision':
                        precisionXp += primaryXp;
                        flickingXp += secondaryXp;
                        break;
                    default:
                        precisionXp += sessionXp;
                }
            }

            matrix = {
                accuracy: 0.0,
                flicking: getLevelFromXp(flickingXp),
                tracking: getLevelFromXp(trackingXp),
                reaction: getLevelFromXp(speedXp),
                consistency: getLevelFromXp(precisionXp),
                spray_control: getLevelFromXp(perceptionXp),
                miss_quadrant_top_left: 0,
                miss_quadrant_top_right: 0,
                miss_quadrant_bottom_left: 0,
                miss_quadrant_bottom_right: 0,
                current_level: getLevelFromXp(flickingXp + trackingXp + speedXp + precisionXp + perceptionXp + cognitionXp),
                total_xp: flickingXp + trackingXp + speedXp + precisionXp + perceptionXp + cognitionXp,
                total_games: 0,
                time_played: 0,
                xp_flicking: flickingXp,
                xp_tracking: trackingXp,
                xp_speed: speedXp,
                xp_precision: precisionXp,
                xp_perception: perceptionXp,
                xp_cognition: cognitionXp
            };
        }

        // 3. Compile discrete RadarProfiler Data Points
        const radarData: RadarDataPoint[] = [
            { subject: 'Flicking', level: matrix.flicking || getLevelFromXp(matrix.xp_flicking || 0), fullMark: 100 },
            { subject: 'Tracking', level: matrix.tracking || getLevelFromXp(matrix.xp_tracking || 0), fullMark: 100 },
            { subject: 'Speed', level: matrix.reaction || getLevelFromXp(matrix.xp_speed || 0), fullMark: 100 },
            { subject: 'Precision', level: matrix.consistency || getLevelFromXp(matrix.xp_precision || 0), fullMark: 100 },
            { subject: 'Perception', level: matrix.spray_control || getLevelFromXp(matrix.xp_perception || 0), fullMark: 100 },
            { subject: 'Cognition', level: getLevelFromXp(matrix.xp_cognition || 0), fullMark: 100 },
        ];

        if (returnFull) {
            const sessionAverages = await db
                .prepare(`
                    SELECT 
                        ROUND(AVG(accuracy), 1) as avg_accuracy,
                        ROUND(AVG(average_urgency_index), 2) as avg_urgency,
                        ROUND(AVG(neural_stability_score), 1) as neural_stability,
                        MAX(max_combo) as peak_combo,
                        COUNT(id) as total_sessions
                    FROM session_logs
                    WHERE user_id = ? AND (is_flagged = 0 OR is_flagged IS NULL)
                `)
                .bind(userId)
                .first();

            return NextResponse.json({
                radarData,
                skillMatrix: matrix,
                progression: matrix,
                sessionAverages,
                authenticated: true
            });
        }

        // Return array structure directly to hydrate RadarProfiler canvas component
        return NextResponse.json(radarData);

    } catch (error) {
        console.error('D1 GET stats Sync Error:', error);
        return NextResponse.json({ error: 'Database stats sync failed' }, { status: 500 });
    }
}
