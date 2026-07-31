import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getLevelFromXp } from '@/lib/utils/progressionEngine';

// Force Next.js to use Cloudflare Edge network
export const runtime = 'edge';

// Helper to retrieve Cloudflare D1 database binding
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
                progression: { current_level: 15, total_xp: 98000, global_accuracy: 94.2 },
                sessionAverages: { avg_accuracy: 94.2, avg_urgency: 1.05, neural_stability: 92.0 },
                mocked: true
            });
        }
        return NextResponse.json(mockRadarData);
    }

    try {
        // 1. Direct fetch from optimized user_progression table in Cloudflare D1
        let profile = await db
            .prepare(`
                SELECT 
                    current_level, total_xp, global_accuracy, total_games, time_played,
                    xp_flicking, xp_tracking, xp_speed, xp_precision, xp_perception, xp_cognition,
                    quadrant_top_left, quadrant_top_right, quadrant_bottom_left, quadrant_bottom_right,
                    top_left_misses, top_right_misses, bottom_left_misses, bottom_right_misses
                FROM user_progression 
                WHERE user_id = ?
            `)
            .bind(userId)
            .first();

        // 2. Dynamic aggregation fallback from scores_telemetry if user_progression record is not populated yet
        if (!profile) {
            const telemetrySummary = await db
                .prepare(`
                    SELECT 
                        exercise_id, 
                        SUM(xp_earned) as total_xp,
                        COUNT(id) as total_games,
                        AVG(accuracy) as avg_accuracy
                    FROM scores_telemetry 
                    WHERE user_id = ? AND (integrity_flag IS NULL OR integrity_flag = 'HIGH_INTEGRITY')
                    GROUP BY exercise_id
                `)
                .bind(userId)
                .all();

            const rows = telemetrySummary.results || [];
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
                    case 'burst-reaction':
                    case 'jiggle-peek':
                        speedXp += primaryXp;
                        flickingXp += secondaryXp;
                        break;
                    case 'echolocation':
                        perceptionXp += primaryXp;
                        flickingXp += secondaryXp;
                        break;
                    default:
                        precisionXp += sessionXp;
                }
            }

            profile = {
                current_level: getLevelFromXp(flickingXp + trackingXp + speedXp + precisionXp + perceptionXp + cognitionXp),
                total_xp: flickingXp + trackingXp + speedXp + precisionXp + perceptionXp + cognitionXp,
                global_accuracy: 0.0,
                total_games: 0,
                time_played: 0,
                xp_flicking: flickingXp,
                xp_tracking: trackingXp,
                xp_speed: speedXp,
                xp_precision: precisionXp,
                xp_perception: perceptionXp,
                xp_cognition: cognitionXp,
                quadrant_top_left: 25,
                quadrant_top_right: 25,
                quadrant_bottom_left: 25,
                quadrant_bottom_right: 25
            };
        }

        // 3. Compile discrete RadarProfiler Data Points
        const radarData: RadarDataPoint[] = [
            { subject: 'Flicking', level: getLevelFromXp(profile.xp_flicking || 0), fullMark: 100 },
            { subject: 'Tracking', level: getLevelFromXp(profile.xp_tracking || 0), fullMark: 100 },
            { subject: 'Speed', level: getLevelFromXp(profile.xp_speed || 0), fullMark: 100 },
            { subject: 'Precision', level: getLevelFromXp(profile.xp_precision || 0), fullMark: 100 },
            { subject: 'Perception', level: getLevelFromXp(profile.xp_perception || 0), fullMark: 100 },
            { subject: 'Cognition', level: getLevelFromXp(profile.xp_cognition || 0), fullMark: 100 },
        ];

        if (returnFull) {
            // Fetch session averages from telemetry
            const sessionAverages = await db
                .prepare(`
                    SELECT 
                        ROUND(AVG(accuracy), 1) as avg_accuracy,
                        ROUND(AVG(average_urgency_index), 2) as avg_urgency,
                        ROUND(AVG(neural_stability_score), 1) as neural_stability,
                        MAX(max_combo) as peak_combo,
                        COUNT(id) as total_sessions
                    FROM scores_telemetry
                    WHERE user_id = ? AND (integrity_flag IS NULL OR integrity_flag = 'HIGH_INTEGRITY')
                `)
                .bind(userId)
                .first();

            return NextResponse.json({
                radarData,
                progression: profile,
                sessionAverages
            });
        }

        // Return array structure directly to hydrate RadarProfiler canvas component
        return NextResponse.json(radarData);

    } catch (error) {
        console.error('D1 GET stats Sync Error:', error);
        return NextResponse.json({ error: 'Database stats sync failed' }, { status: 500 });
    }
}
