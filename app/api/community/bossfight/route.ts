import { NextResponse } from 'next/server';

// Set the runtime configuration to 'edge' to ensure ultra-low latency response
// and full compatibility with Cloudflare Pages/Workers serverless deployment.
export const runtime = 'edge';

/**
 * Retrieves the Cloudflare D1 SQL database instance.
 * Dynamically handles local development mock context as well as Edge request environment bindings.
 */
async function getDb(): Promise<any> {
    try {
        const db = (process.env as any).DB;
        if (db) return db;
        // Dynamically import getCloudflareContext to prevent build-time crashes when bundling outside Cloudflare environments
        const { getCloudflareContext } = await import('@opennextjs/cloudflare');
        const { env } = await getCloudflareContext();
        return env.DB;
    } catch {
        return null;
    }
}

/**
 * GET Handler: Fetches the community's combined weekend progress.
 * Queries D1 to sum up all hit records in the telemetry table from the last 48 hours.
 */
export async function GET(request: Request) {
    const db = await getDb();
    if (!db) {
        // Safe development fallback data if D1 is unbound
        return NextResponse.json({ totalHits: 724120, target: 1000000, message: "Local mock data" });
    }

    try {
        // Query target hits accumulated in the last 48 hours (the weekend window)
        const stats = await db.prepare(`
            SELECT SUM(hits) as total_hits 
            FROM scores_telemetry 
            WHERE created_at >= datetime('now', '-2 days')
        `).first();

        const totalHits = Number(stats?.total_hits) || 0;
        return NextResponse.json({
            success: true,
            totalHits,
            target: 1000000,
            remaining: Math.max(0, 1000000 - totalHits)
        });
    } catch (err: any) {
        console.error("Community GET stats failed:", err);
        return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }
}

/**
 * POST Handler: Triggered by n8n cron node when community hits the combined 1,000,000 target.
 * Authenticates with a shared secret, checks weekend scores, queries unique participants,
 * and atomically updates their user progression tables in a database transaction block.
 */
export async function POST(request: Request) {
    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Shared security token authentication
    const secret = body.secret;
    const expectedSecret = process.env.COMMUNITY_BOSS_FIGHT_SECRET;
    if (!expectedSecret) throw new Error("COMMUNITY_BOSS_FIGHT_SECRET environment variable is not set");

    if (secret !== expectedSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    if (!db) {
        // Local developer mock fallback
        return NextResponse.json({
            success: true,
            mocked: true,
            message: "Local environment mock: 1,000,000 targets reached! Vanguard badge unlocked globally."
        });
    }

    try {
        // 1. Calculate combined hits during the 48-hour weekend window
        const stats = await db.prepare(`
            SELECT SUM(hits) as total_hits 
            FROM scores_telemetry 
            WHERE created_at >= datetime('now', '-2 days')
        `).first();

        const totalHits = Number(stats?.total_hits) || 0;

        // Verify if community goal has been achieved (allow override check via forceUnlock flag)
        if (totalHits < 1000000 && !body.forceUnlock) {
            return NextResponse.json({
                success: false,
                totalHits,
                target: 1000000,
                message: "Boss fight goal not met. Grind more target hits!"
            });
        }

        // 2. Query all unique user IDs who actively completed runs during this weekend
        const participants = await db.prepare(`
            SELECT DISTINCT user_id 
            FROM scores_telemetry 
            WHERE created_at >= datetime('now', '-2 days')
        `).all();

        const userIds = (participants.results || []).map((p: any) => p.user_id);

        if (userIds.length === 0) {
            return NextResponse.json({
                success: true,
                totalHits,
                unlockedCount: 0,
                message: "No active weekend participants found to unlock badges for."
            });
        }

        // 3. Atomically unlock the Vanguard badge for all participants inside a single db transaction batch
        const updateStatements = userIds.map((uid: string) => {
            return db.prepare(`
                UPDATE user_progression 
                SET vanguard_badge_unlocked = 1, updated_at = CURRENT_TIMESTAMP 
                WHERE user_id = ?
            `).bind(uid);
        });

        await db.batch(updateStatements);

        return NextResponse.json({
            success: true,
            totalHits,
            unlockedCount: userIds.length,
            message: `Successfully unlocked 'Vanguard' crosshair profiles and profile badges for all ${userIds.length} weekend participants!`
        });
    } catch (err: any) {
        console.error("Community boss fight transaction failed:", err);
        return NextResponse.json({ error: "Database transaction failed" }, { status: 500 });
    }
}
