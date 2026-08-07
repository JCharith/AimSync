import { NextResponse } from 'next/server';

export const runtime = 'edge';

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

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const exerciseId = searchParams.get('exerciseId') || 'static-flick';
    const difficulty = searchParams.get('difficulty') || 'medium';
    const rivalUsername = searchParams.get('rivalUsername');

    const db = await getDb();

    // Local dev mock fallback
    if (!db) {
        if (rivalUsername) {
            // Generate a procedurally generated ghost rival if we are in dev mock
            try {
                const { generateGhostData } = require('@/lib/utils/ghostGenerator');
                const { compressGhost } = require('@/lib/utils/ghostCompression');
                const targetScore = rivalUsername.toLowerCase().includes("apex") ? 12000 : 8000;
                const ghost = generateGhostData(exerciseId, difficulty, targetScore);
                const compressed = compressGhost(ghost);
                return NextResponse.json({ ghostTelemetry: compressed });
            } catch (e) {
                return NextResponse.json({ error: "Failed to generate mock ghost" }, { status: 500 });
            }
        }

        // Return mock leaderboard list
        const mockStandings = [
            { username: "ApexClicker", score: 12400, accuracy: 96.5, max_combo: 82, duration_seconds: 30, created_at: new Date().toISOString(), has_ghost: 1 },
            { username: "Shrouded", score: 11050, accuracy: 94.2, max_combo: 68, duration_seconds: 30, created_at: new Date().toISOString(), has_ghost: 1 },
            { username: "MouseGod", score: 9800, accuracy: 91.8, max_combo: 55, duration_seconds: 30, created_at: new Date().toISOString(), has_ghost: 1 },
            { username: "AimSync_Bot", score: 8000, accuracy: 88.0, max_combo: 45, duration_seconds: 30, created_at: new Date().toISOString(), has_ghost: 1 }
        ];
        return NextResponse.json(mockStandings);
    }

    try {
        if (rivalUsername) {
            // Fetch rival's best ghost telemetry from session_logs
            const rivalRecord = await db.prepare(`
                SELECT ghost_telemetry
                FROM session_logs
                WHERE exercise_id = ? AND difficulty = ? AND username = ? AND ghost_telemetry IS NOT NULL AND (is_flagged = 0 OR is_flagged IS NULL)
                ORDER BY score DESC
                LIMIT 1
            `).bind(exerciseId, difficulty, rivalUsername).first();

            if (!rivalRecord || !rivalRecord.ghost_telemetry) {
                if (rivalUsername.toLowerCase().includes("bot") || rivalUsername.toLowerCase().includes("clicker") || rivalUsername.toLowerCase().includes("god")) {
                    try {
                        const { generateGhostData } = require('@/lib/utils/ghostGenerator');
                        const { compressGhost } = require('@/lib/utils/ghostCompression');
                        const targetScore = rivalUsername.toLowerCase().includes("god") ? 10000 : 7500;
                        const ghost = generateGhostData(exerciseId, difficulty, targetScore);
                        const compressed = compressGhost(ghost);
                        return NextResponse.json({ ghostTelemetry: compressed });
                    } catch (e) {
                        return NextResponse.json({ error: "Failed to generate fallback bot ghost" }, { status: 500 });
                    }
                }
                return NextResponse.json({ error: "Rival ghost telemetry not found" }, { status: 404 });
            }

            return NextResponse.json({ ghostTelemetry: rivalRecord.ghost_telemetry });
        }

        // Fetch standings from session_logs (unique players, best scores) sorted by score DESC
        const standings = await db.prepare(`
            SELECT sl.username, sl.score, sl.accuracy, sl.max_combo, sl.duration as duration_seconds, sl.created_at, (sl.ghost_telemetry IS NOT NULL) AS has_ghost
            FROM session_logs sl
            INNER JOIN (
                SELECT username, MAX(score) as max_score
                FROM session_logs
                WHERE exercise_id = ? AND difficulty = ? AND (is_flagged = 0 OR is_flagged IS NULL)
                GROUP BY username
            ) t2 ON sl.username = t2.username AND sl.score = t2.max_score
            WHERE sl.exercise_id = ? AND sl.difficulty = ? AND (sl.is_flagged = 0 OR sl.is_flagged IS NULL)
            ORDER BY sl.score DESC, sl.created_at ASC
            LIMIT 10
        `).bind(exerciseId, difficulty, exerciseId, difficulty).all();

        return NextResponse.json(standings.results || []);
    } catch (error) {
        console.error("D1 GET Leaderboard Error:", error);
        return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
    }
}
