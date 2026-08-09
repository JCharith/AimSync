import { NextResponse } from 'next/server';
import { auth } from '@/auth';

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

export interface ClickVector {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    isHit: boolean;
}

export interface MissQuadrantsPayload {
    topLeft?: number;
    topRight?: number;
    bottomLeft?: number;
    bottomRight?: number;
}

export async function POST(request: Request) {
    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const session = await auth().catch(() => null);
    let userId = session?.user?.id || body.userId;

    if (!userId || userId === 'guest' || userId === 'trial' || userId === 'local' || userId === 'undefined') {
        userId = 'anonymous';
    }

    // 1. Segment Incoming Click Vectors into 4 Quadrants
    let topLeft = 0;
    let topRight = 0;
    let bottomLeft = 0;
    let bottomRight = 0;

    if (Array.isArray(body.clickVectors) && body.clickVectors.length > 0) {
        for (const vec of body.clickVectors as ClickVector[]) {
            if (!vec.isHit) {
                const dx = vec.x - vec.targetX;
                const dy = vec.y - vec.targetY;

                if (dx < 0 && dy < 0) topLeft++;
                else if (dx >= 0 && dy < 0) topRight++;
                else if (dx < 0 && dy >= 0) bottomLeft++;
                else bottomRight++;
            }
        }
    } else if (body.missQuadrants) {
        const q: MissQuadrantsPayload = body.missQuadrants;
        topLeft = q.topLeft || 0;
        topRight = q.topRight || 0;
        bottomLeft = q.bottomLeft || 0;
        bottomRight = q.bottomRight || 0;
    } else if (typeof body.quadrant_top_left === 'number' || typeof body.top_left_misses === 'number') {
        topLeft = body.quadrant_top_left ?? body.top_left_misses ?? 0;
        topRight = body.quadrant_top_right ?? body.top_right_misses ?? 0;
        bottomLeft = body.quadrant_bottom_left ?? body.bottom_left_misses ?? 0;
        bottomRight = body.quadrant_bottom_right ?? body.bottom_right_misses ?? 0;
    }

    const sessionTotalMisses = topLeft + topRight + bottomLeft + bottomRight;
    let sessionTLPct = sessionTotalMisses > 0 ? (topLeft / sessionTotalMisses) * 100 : 25;
    let sessionTRPct = sessionTotalMisses > 0 ? (topRight / sessionTotalMisses) * 100 : 25;
    let sessionBLPct = sessionTotalMisses > 0 ? (bottomLeft / sessionTotalMisses) * 100 : 25;
    let sessionBRPct = sessionTotalMisses > 0 ? (bottomRight / sessionTotalMisses) * 100 : 25;

    const neuralStabilityScore = typeof body.neuralStabilityScore === 'number' ? body.neuralStabilityScore : null;

    const db = await getDb();

    if (!db) {
        // Fallback for local development server without D1 binding
        return NextResponse.json({
            success: true,
            mocked: true,
            rollingAverages: {
                quadrant_top_left: Number(sessionTLPct.toFixed(2)),
                quadrant_top_right: Number(sessionTRPct.toFixed(2)),
                quadrant_bottom_left: Number(sessionBLPct.toFixed(2)),
                quadrant_bottom_right: Number(sessionBRPct.toFixed(2)),
                top_left_misses: Number(sessionTLPct.toFixed(2)),
                top_right_misses: Number(sessionTRPct.toFixed(2)),
                bottom_left_misses: Number(sessionBLPct.toFixed(2)),
                bottom_right_misses: Number(sessionBRPct.toFixed(2)),
            },
            sessionMisses: { topLeft, topRight, bottomLeft, bottomRight },
            neuralStabilityScore
        });
    }

    try {
        // 2. Fetch existing user progression miss quadrant rolling averages from D1
        const existing = await db
            .prepare(`
                SELECT 
                    quadrant_top_left, quadrant_top_right, quadrant_bottom_left, quadrant_bottom_right,
                    top_left_misses, top_right_misses, bottom_left_misses, bottom_right_misses,
                    miss_quadrants 
                FROM user_progression 
                WHERE user_id = ?
            `)
            .bind(userId)
            .first();

        let newTL = sessionTLPct;
        let newTR = sessionTRPct;
        let newBL = sessionBLPct;
        let newBR = sessionBRPct;

        let cumTL = topLeft;
        let cumTR = topRight;
        let cumBL = bottomLeft;
        let cumBR = bottomRight;

        if (existing) {
            const prevTL = existing.quadrant_top_left || existing.top_left_misses || 0;
            const prevTR = existing.quadrant_top_right || existing.top_right_misses || 0;
            const prevBL = existing.quadrant_bottom_left || existing.bottom_left_misses || 0;
            const prevBR = existing.quadrant_bottom_right || existing.bottom_right_misses || 0;

            const hasPrevData = prevTL > 0 || prevTR > 0 || prevBL > 0 || prevBR > 0;

            if (hasPrevData && sessionTotalMisses > 0) {
                // Exponential Rolling Average (80% historical weight, 20% current session weight)
                const ALPHA = 0.20;
                newTL = (prevTL * (1 - ALPHA)) + (sessionTLPct * ALPHA);
                newTR = (prevTR * (1 - ALPHA)) + (sessionTRPct * ALPHA);
                newBL = (prevBL * (1 - ALPHA)) + (sessionBLPct * ALPHA);
                newBR = (prevBR * (1 - ALPHA)) + (sessionBRPct * ALPHA);
            }

            if (existing.miss_quadrants) {
                try {
                    const prevJSON = JSON.parse(existing.miss_quadrants);
                    cumTL += prevJSON.topLeft || 0;
                    cumTR += prevJSON.topRight || 0;
                    cumBL += prevJSON.bottomLeft || 0;
                    cumBR += prevJSON.bottomRight || 0;
                } catch {
                    // Ignore JSON parse error fallback
                }
            }
        }

        newTL = Number(newTL.toFixed(2));
        newTR = Number(newTR.toFixed(2));
        newBL = Number(newBL.toFixed(2));
        newBR = Number(newBR.toFixed(2));

        const updatedMissQuadrantsJSON = JSON.stringify({
            topLeft: cumTL,
            topRight: cumTR,
            bottomLeft: cumBL,
            bottomRight: cumBR
        });

        // 3. Persist rolling averages into Cloudflare D1 user_progression table
        await db.prepare(`
            INSERT INTO user_progression (
                user_id,
                quadrant_top_left,
                quadrant_top_right,
                quadrant_bottom_left,
                quadrant_bottom_right,
                top_left_misses,
                top_right_misses,
                bottom_left_misses,
                bottom_right_misses,
                miss_quadrants,
                last_played_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                quadrant_top_left = excluded.quadrant_top_left,
                quadrant_top_right = excluded.quadrant_top_right,
                quadrant_bottom_left = excluded.quadrant_bottom_left,
                quadrant_bottom_right = excluded.quadrant_bottom_right,
                top_left_misses = excluded.top_left_misses,
                top_right_misses = excluded.top_right_misses,
                bottom_left_misses = excluded.bottom_left_misses,
                bottom_right_misses = excluded.bottom_right_misses,
                miss_quadrants = excluded.miss_quadrants,
                last_played_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
        `).bind(
            userId,
            newTL,
            newTR,
            newBL,
            newBR,
            newTL,
            newTR,
            newBL,
            newBR,
            updatedMissQuadrantsJSON
        ).run();

        return NextResponse.json({
            success: true,
            userId,
            rollingAverages: {
                quadrant_top_left: newTL,
                quadrant_top_right: newTR,
                quadrant_bottom_left: newBL,
                quadrant_bottom_right: newBR,
                top_left_misses: newTL,
                top_right_misses: newTR,
                bottom_left_misses: newBL,
                bottom_right_misses: newBR,
            },
            sessionMisses: { topLeft, topRight, bottomLeft, bottomRight },
            cumulativeMisses: { topLeft: cumTL, topRight: cumTR, bottomLeft: cumBL, bottomRight: cumBR },
            neuralStabilityScore
        });

    } catch (error) {
        console.error('D1 Muscle Memory Heatmap Accumulator Error:', error);
        return NextResponse.json({ error: 'Failed to update muscle memory heatmap accumulator' }, { status: 500 });
    }
}
