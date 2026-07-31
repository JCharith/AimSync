export interface D1Database {
    prepare(query: string): {
        bind(...values: any[]): any;
        first<T = unknown>(colName?: string): Promise<T | null>;
        all<T = unknown>(): Promise<{ results?: T[]; success: boolean; error?: string }>;
        run(): Promise<any>;
    };
    batch(statements: any[]): Promise<any>;
}

export interface Env {
    DB: D1Database;
    DISCORD_COMMUNITY_WEBHOOK_URL?: string;
    DISCORD_PUBLIC_WEBHOOK_URL?: string;
    DISCORD_WEBHOOK_URL?: string;
}

export interface ScheduledEvent {
    cron: string;
    scheduledTime: number;
    type: string;
}

export interface ExecutionContext {
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
}

interface PlayerStats {
    user_id: string;
    username: string;
    total_sessions: number;
    total_hits: number;
    total_misses: number;
    avg_accuracy: number;
    avg_urgency: number;
    avg_overflick: number;
    peak_combo: number;
    weekly_xp_gained: number;
    current_level: number;
    total_xp: number;
}

interface RetentionMetrics {
    active_players: number;
    total_community_sessions: number;
    total_community_hits: number;
    overall_avg_accuracy: number;
}

export default {
    // 1. Cloudflare Scheduled Cron Handler (Fires on '0 23 * * 0')
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        ctx.waitUntil(runWeeklyProgressionDigest(env));
    },

    // 2. HTTP Fetch Handler for Manual Testing / Webhook Triggers
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        if (url.pathname === '/trigger-cron' || url.pathname === '/cron/weekly-progression') {
            try {
                const result = await runWeeklyProgressionDigest(env);
                return new Response(JSON.stringify({ success: true, message: 'Weekly progression cron executed successfully.', result }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error: any) {
                return new Response(JSON.stringify({ success: false, error: error.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        return new Response(JSON.stringify({
            service: 'AimSync Weekly Progression Cron Worker',
            status: 'active',
            cronSchedule: '0 23 * * 0 (Sunday 23:00 UTC)',
            manualEndpoint: '/trigger-cron'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

/**
 * Main routine querying Cloudflare D1 and posting the progression digest to Discord
 */
export async function runWeeklyProgressionDigest(env: Env) {
    if (!env.DB) {
        throw new Error('D1 database binding (DB) is not available.');
    }

    // 1. Query Top 10 Player Performance Aggregates (Past 7 Days)
    const leaderboardStmt = env.DB.prepare(`
        SELECT 
            st.user_id, 
            st.username, 
            count(st.id) as total_sessions, 
            sum(st.hits) as total_hits, 
            sum(st.misses) as total_misses, 
            round((sum(st.hits) * 100.0) / (sum(st.hits) + sum(st.misses)), 2) as avg_accuracy, 
            avg(st.average_urgency_index) as avg_urgency, 
            avg(st.over_flick_coefficient) as avg_overflick, 
            max(st.max_combo) as peak_combo, 
            sum(st.xp_earned) as weekly_xp_gained, 
            up.current_level, 
            up.total_xp 
        FROM scores_telemetry st 
        JOIN user_progression up ON st.user_id = up.user_id 
        WHERE st.created_at >= datetime('now', '-7 days') 
          AND st.integrity_flag = 'HIGH_INTEGRITY' 
        GROUP BY st.user_id, st.username, up.current_level, up.total_xp 
        ORDER BY weekly_xp_gained DESC 
        LIMIT 10;
    `);

    // 2. Query Community Retention Metrics
    const retentionStmt = env.DB.prepare(`
        SELECT 
            count(DISTINCT user_id) as active_players,
            count(id) as total_community_sessions,
            sum(hits) as total_community_hits,
            round(avg(accuracy), 2) as overall_avg_accuracy
        FROM scores_telemetry
        WHERE created_at >= datetime('now', '-7 days') 
          AND integrity_flag = 'HIGH_INTEGRITY';
    `);

    const [leaderboardResult, retentionResult] = await Promise.all([
        leaderboardStmt.all<PlayerStats>(),
        retentionStmt.first<RetentionMetrics>()
    ]);

    const players = leaderboardResult.results || [];
    const retention = retentionResult || {
        active_players: 0,
        total_community_sessions: 0,
        total_community_hits: 0,
        overall_avg_accuracy: 0.0
    };

    // 3. Format Leaderboard Summary Text
    let leaderboardText = '';
    if (players.length === 0) {
        leaderboardText = 'No high-integrity player sessions recorded this week.';
    } else {
        leaderboardText = players.slice(0, 5).map((p: PlayerStats, idx: number) => {
            const rankMedals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            const medal = rankMedals[idx] || `${idx + 1}.`;
            const bonusXp = (p.weekly_xp_gained || 0) + 500;
            const name = p.username || 'Unknown Player';
            return `${medal} **${name}** (Lvl ${p.current_level || 1}) • **${p.total_sessions}** sessions • **${p.avg_accuracy || 0}%** Acc • **+${bonusXp.toLocaleString()}** XP`;
        }).join('\n');
    }

    // 4. Construct Discord Webhook Payload
    const webhookUrl = env.DISCORD_COMMUNITY_WEBHOOK_URL || env.DISCORD_PUBLIC_WEBHOOK_URL || env.DISCORD_WEBHOOK_URL;
    const timestamp = new Date().toISOString();

    const discordEmbed = {
        title: '🎯 AimSync Weekly Retention & Community Progression Digest',
        description: 'Sunday Night Tactical Telemetry Breakdown & Weekly XP Rewards Distribution.',
        color: 3066993, // Emerald Green (#2ECC71)
        fields: [
            {
                name: '📊 Community Retention & Activity Metrics',
                value: `• **Active Players (7d):** ${retention.active_players}\n• **Total Sessions Played:** ${retention.total_community_sessions}\n• **Community Avg Accuracy:** ${retention.overall_avg_accuracy || 0}%`,
                inline: false
            },
            {
                name: '🏆 Top Weekly Performers (+500 Bonus XP Claimed)',
                value: leaderboardText,
                inline: false
            },
            {
                name: '🧠 AI Tactical Coaching Recommendations',
                value: '1. **Urgency Index:** Target acquisition timing is steady. Maintain rhythmic flick velocity.\n2. **Trajectory Correction:** Over-flick dampening recommended for micro-adjust drills.\n3. **Focus Drill:** Prioritize Continuous Tracking modes next week for +1.5x XP multipliers.',
                inline: false
            }
        ],
        footer: {
            text: 'AimSync Cloudflare D1 & Edge Progression Engine • Scheduled Sunday Report'
        },
        timestamp
    };

    if (!webhookUrl) {
        console.warn('[Weekly Progression Cron] DISCORD_COMMUNITY_WEBHOOK_URL not configured. Embed payload:', JSON.stringify(discordEmbed, null, 2));
        return {
            posted: false,
            reason: 'DISCORD_COMMUNITY_WEBHOOK_URL missing',
            stats: { active_players: retention.active_players, playersCount: players.length }
        };
    }

    // 5. Post to Discord Public Webhook
    const discordRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [discordEmbed] })
    });

    if (!discordRes.ok) {
        const errBody = await discordRes.text();
        throw new Error(`Discord Webhook POST failed with status ${discordRes.status}: ${errBody}`);
    }

    return {
        posted: true,
        stats: {
            active_players: retention.active_players,
            total_sessions: retention.total_community_sessions,
            top_players_count: players.length
        }
    };
}
