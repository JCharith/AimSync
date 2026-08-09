import { Suspense } from 'react';
import Link from 'next/link';

export const runtime = 'edge';

// --- SKELETON LOADER FOR INSTANT EDGE STREAMING ---
function LeaderboardTableSkeleton() {
    return (
        <div className="max-w-6xl w-full bg-white/[0.01] border border-white/5 rounded-3xl overflow-hidden shadow-2xl animate-pulse">
            <table className="w-full text-left border-collapse table-fixed">
                <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02] text-xs font-bold uppercase tracking-widest text-slate-500">
                        <th className="py-4 px-6 w-20">Rank</th>
                        <th className="py-4 px-6 w-48 text-left">Competitor</th>
                        <th className="py-4 px-6 w-24 text-center">Level</th>
                        <th className="py-4 px-6 w-28 text-right">Avg Acc</th>
                        <th className="py-4 px-6 w-28 text-right">Max Combo</th>
                        <th className="py-4 px-6 w-28 text-right">Sessions</th>
                        <th className="py-4 px-6 w-32 text-right">Neural Stability</th>
                        <th className="py-4 px-6 w-36 text-right">Overall Rank</th>
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: 15 }).map((_, i) => (
                        <tr key={i} className="border-b border-white/5 h-[61px]">
                            <td className="py-3.5 px-6"><div className="w-8 h-8 bg-white/5 rounded-lg" /></td>
                            <td className="py-3.5 px-6"><div className="w-32 h-4 bg-white/5 rounded" /></td>
                            <td className="py-3.5 px-6"><div className="w-10 h-4 bg-white/5 rounded mx-auto" /></td>
                            <td className="py-3.5 px-6"><div className="w-16 h-4 bg-white/5 rounded ml-auto" /></td>
                            <td className="py-3.5 px-6"><div className="w-16 h-4 bg-white/5 rounded ml-auto" /></td>
                            <td className="py-3.5 px-6"><div className="w-12 h-4 bg-white/5 rounded ml-auto" /></td>
                            <td className="py-3.5 px-6"><div className="w-20 h-4 bg-white/5 rounded ml-auto" /></td>
                            <td className="py-3.5 px-6"><div className="w-24 h-4 bg-white/5 rounded ml-auto" /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export interface LeaderboardEntry {
    user_id: string;
    username: string;
    current_level: number;
    total_xp: number;
    total_sessions: number;
    avg_accuracy: number;
    peak_combo: number;
    consistency_days: number;
    neural_stability: number;
    ranking_score: number;
}

// Fallback high score rankings for local dev or when database is unseeded
const MOCK_LEADERBOARD: LeaderboardEntry[] = [
    { user_id: 'usr-1', username: 'ApexClicker_Pro', current_level: 42, total_xp: 128500, total_sessions: 312, avg_accuracy: 97.4, peak_combo: 142, consistency_days: 7, neural_stability: 98, ranking_score: 189400 },
    { user_id: 'usr-2', username: 'ShroudedVector', current_level: 38, total_xp: 104200, total_sessions: 245, avg_accuracy: 95.8, peak_combo: 118, consistency_days: 6, neural_stability: 94, ranking_score: 154200 },
    { user_id: 'usr-3', username: 'Hyperion_Flick', current_level: 35, total_xp: 91000, total_sessions: 198, avg_accuracy: 94.1, peak_combo: 104, consistency_days: 7, neural_stability: 92, ranking_score: 132800 },
    { user_id: 'usr-4', username: 'VanguardPrecision', current_level: 31, total_xp: 78400, total_sessions: 164, avg_accuracy: 92.5, peak_combo: 89, consistency_days: 5, neural_stability: 89, ranking_score: 108900 },
    { user_id: 'usr-5', username: 'CyberSleeve', current_level: 28, total_xp: 66200, total_sessions: 135, avg_accuracy: 91.2, peak_combo: 76, consistency_days: 5, neural_stability: 87, ranking_score: 89400 },
    { user_id: 'usr-6', username: 'ZeroMiss_Ghost', current_level: 25, total_xp: 54100, total_sessions: 110, avg_accuracy: 89.6, peak_combo: 68, consistency_days: 4, neural_stability: 85, ranking_score: 72100 },
    { user_id: 'usr-7', username: 'Kovaak_Reflex', current_level: 22, total_xp: 45000, total_sessions: 92, avg_accuracy: 88.0, peak_combo: 59, consistency_days: 4, neural_stability: 82, ranking_score: 58200 },
];

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

// --- DYNAMIC D1 DATA LOADER ---
async function LeaderboardData() {
    let entries: LeaderboardEntry[] = [];
    const db = await getDb();

    if (db) {
        try {
            // Relational D1 query combining session_logs and skill_matrices with SQL sorting
            const result = await db.prepare(`
                SELECT 
                    sm.user_id,
                    COALESCE(u.name, MAX(sl.username), 'Anonymous Player') as username,
                    sm.current_level,
                    sm.total_xp,
                    COUNT(sl.id) as total_sessions,
                    ROUND(COALESCE(AVG(sl.accuracy), sm.accuracy, 0.0), 1) as avg_accuracy,
                    COALESCE(MAX(sl.max_combo), 0) as peak_combo,
                    COUNT(DISTINCT date(sl.created_at)) as consistency_days,
                    ROUND(COALESCE(AVG(sl.neural_stability_score), 85.0), 0) as neural_stability,
                    ROUND(sm.total_xp * (COALESCE(AVG(sl.accuracy), sm.accuracy, 50.0) / 100.0) * (1.0 + (COUNT(sl.id) / 100.0)), 0) as ranking_score
                FROM skill_matrices sm
                LEFT JOIN users u ON sm.user_id = u.id
                LEFT JOIN session_logs sl ON sm.user_id = sl.user_id AND (sl.is_flagged = 0 OR sl.is_flagged IS NULL)
                GROUP BY sm.user_id, sm.current_level, sm.total_xp, u.name
                ORDER BY ranking_score DESC, avg_accuracy DESC, consistency_days DESC
                LIMIT 50
            `).all();

            entries = result.results || [];
        } catch (e) {
            console.error("Leaderboard D1 query error:", e);
        }
    }

    if (entries.length === 0) {
        entries = MOCK_LEADERBOARD;
    }

    return (
        <div className="max-w-6xl w-full bg-white/[0.01] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed min-w-[760px]">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02] text-xs font-bold uppercase tracking-widest text-slate-500">
                            <th className="py-4 px-6 w-20">Rank</th>
                            <th className="py-4 px-6 w-48 text-left">Competitor</th>
                            <th className="py-4 px-6 w-24 text-center">Level</th>
                            <th className="py-4 px-6 w-28 text-right">Avg Acc</th>
                            <th className="py-4 px-6 w-28 text-right">Max Combo</th>
                            <th className="py-4 px-6 w-28 text-right">Sessions</th>
                            <th className="py-4 px-6 w-32 text-right">Neural Stability</th>
                            <th className="py-4 px-6 w-36 text-right">Overall Rank</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm font-mono">
                        {entries.map((entry, index) => {
                            const rank = index + 1;
                            let rankColor = "text-slate-400";
                            let rankBg = "bg-white/5";

                            if (rank === 1) {
                                rankColor = "text-[#08090d] font-black";
                                rankBg = "bg-yellow-400";
                            } else if (rank === 2) {
                                rankColor = "text-[#08090d] font-black";
                                rankBg = "bg-slate-300";
                            } else if (rank === 3) {
                                rankColor = "text-[#08090d] font-black";
                                rankBg = "bg-amber-600";
                            }

                            return (
                                <tr key={entry.user_id} className="hover:bg-white/[0.02] transition-colors border-b border-white/5">
                                    <td className="py-3.5 px-6">
                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${rankBg} ${rankColor}`}>
                                            {rank}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-6 font-bold tracking-wide truncate text-left text-slate-200">
                                        {entry.username || 'Anonymous Player'}
                                    </td>
                                    <td className="py-3.5 px-6 text-center text-slate-300">
                                        {entry.current_level}
                                    </td>
                                    <td className="py-3.5 px-6 text-right text-emerald-400 font-semibold">
                                        {entry.avg_accuracy}%
                                    </td>
                                    <td className="py-3.5 px-6 text-right text-slate-300">
                                        {entry.peak_combo}
                                    </td>
                                    <td className="py-3.5 px-6 text-right text-slate-400">
                                        {entry.total_sessions}
                                    </td>
                                    <td className="py-3.5 px-6 text-right text-purple-400 font-semibold">
                                        {entry.neural_stability}%
                                    </td>
                                    <td className="py-3.5 px-6 text-right font-black text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.2)]">
                                        {Number(entry.ranking_score).toLocaleString()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default async function LeaderboardPage() {
    return (
        <div className="flex-1 flex flex-col min-h-screen bg-[#08090d] text-white p-4 md:p-8 font-sans selection:bg-[#00f0ff] selection:text-[#08090d] items-center">
            {/* Header */}
            <div className="max-w-6xl w-full flex flex-col md:flex-row items-center justify-between gap-6 mb-8 mt-4">
                <div className="text-center md:text-left space-y-2">
                    <p className="text-[#00f0ff] text-xs font-bold tracking-[0.4em] uppercase">Cloudflare D1 Edge Network</p>
                    <h1 className="text-4xl md:text-5xl font-black tracking-widest uppercase">
                        LEADER<span className="text-[#00f0ff] drop-shadow-[0_0_15px_rgba(0,240,255,0.4)]">BOARD</span>
                    </h1>
                    <p className="text-gray-400 text-sm max-w-xl font-medium">
                        Real-time player standings sorted by overall rank score and training consistency metrics.
                    </p>
                </div>
                <Link
                    href="/dashboard"
                    className="px-6 py-3 border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 rounded-xl font-bold tracking-wider transition-all text-sm shrink-0"
                >
                    RETURN TO COMMAND CENTER
                </Link>
            </div>

            {/* Standings Table wrapped in Suspense for streaming edge shell rendering */}
            <Suspense fallback={<LeaderboardTableSkeleton />}>
                <LeaderboardData />
            </Suspense>
        </div>
    );
}
