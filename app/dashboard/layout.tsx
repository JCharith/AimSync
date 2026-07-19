"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { StorageEngine } from "@/lib/utils/storage";
import { useAuth } from "@/lib/contexts/AuthContext";
import type { UserStats } from "@/lib/game/types";

function DashboardBackground() {
    return (
        <div className="fixed inset-0 z-0 pointer-events-none">
            {/* Premium Image Background */}
            <div className="absolute inset-0">
                <Image
                    src="/hero-bg.png"
                    alt="AimSync Training Hub"
                    fill
                    priority
                    className="object-cover object-center opacity-[0.12] blur-[8px]"
                />
                {/* Deep Vignette / Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/70 to-background" />
                <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-transparent to-background/95" />
            </div>
            
            {/* Tech Grid & Accents */}
            <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:48px_48px]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_50%_0%,rgba(239,68,68,0.08),transparent)]"></div>
        </div>
    );
}

function getRankInfo(stats: UserStats) {
    if (stats.totalGamesPlayed < 5) return { tier: "Unranked", color: "text-slate-500", glow: "rgba(100,116,139,0.5)" };
    
    if (stats.globalAccuracy >= 90) return { tier: "Grandmaster", color: "text-yellow-400", glow: "rgba(250,204,21,0.5)" };
    if (stats.globalAccuracy >= 80) return { tier: "Master", color: "text-purple-400", glow: "rgba(192,132,252,0.5)" };
    if (stats.globalAccuracy >= 70) return { tier: "Diamond", color: "text-cyan-400", glow: "rgba(34,211,238,0.5)" };
    if (stats.globalAccuracy >= 60) return { tier: "Platinum", color: "text-emerald-400", glow: "rgba(52,211,153,0.5)" };
    if (stats.globalAccuracy >= 50) return { tier: "Gold", color: "text-yellow-600", glow: "rgba(202,138,4,0.5)" };
    if (stats.globalAccuracy >= 40) return { tier: "Silver", color: "text-slate-300", glow: "rgba(203,213,225,0.5)" };
    return { tier: "Bronze", color: "text-orange-800", glow: "rgba(154,52,18,0.5)" };
}

function DashboardHeader() {
    const pathname = usePathname();
    const [stats, setStats] = useState<UserStats | null>(null);
    const { user, isTrial } = useAuth();

    useEffect(() => {
        const timer = setTimeout(() => {
            setStats(StorageEngine.getUserStats());
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    const rankInfo = stats ? getRankInfo(stats) : { tier: "Unranked" };

    const navItems = [
        { name: "Overview", path: "/dashboard" },
        { name: "Tasks", path: "/dashboard/tasks" },
        { name: "Playlists", path: "/dashboard/playlists" },
        { name: "Rank", path: "/dashboard/rank" },
    ];

    return (
        <header className="relative z-50 flex items-center justify-between w-full border-b border-white/5 bg-surface/40 backdrop-blur-xl px-8 py-4 mb-8">
            <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="w-8 h-8 relative flex items-center justify-center transition-transform group-hover:scale-110">
                        <div className="absolute w-8 h-8 rounded-full border-2 border-red" />
                        <div className="absolute w-1 h-1 rounded-full bg-red" />
                        <div className="absolute w-4 h-px bg-red" />
                        <div className="absolute w-px h-4 bg-red" />
                    </div>
                    <span className="text-xl font-black uppercase tracking-tighter">
                        <span className="text-text-primary">AIM</span>
                        <span className="text-red">SYNC</span>
                    </span>
                </Link>

                {/* Top Nav Tabs like KovaaKs/AimLab */}
                <nav className="hidden md:flex items-center gap-1 border-l border-white/10 pl-8">
                    {navItems.map((item) => {
                        const isActive = pathname === item.path;
                        return (
                            <Link 
                                key={item.name}
                                href={item.path}
                                className={`px-6 py-2 rounded-md font-bold text-xs tracking-widest uppercase transition-colors ${
                                    isActive 
                                        ? "bg-white/10 text-white" 
                                        : "text-slate-400 hover:text-white hover:bg-white/5"
                                }`}
                            >
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>
            
            <div className="flex items-center gap-6">
                <Link href={isTrial ? "#" : "/dashboard/profile"} className="flex items-center gap-3 group">
                    <div className="flex flex-col items-end hidden md:flex">
                        <span className="text-xs font-black text-white tracking-widest leading-none mb-1 group-hover:text-red transition-colors">
                            {isTrial ? "Agent_T" : (user?.username || "Agent_01")}
                        </span>
                        <span className="text-[10px] text-red font-bold uppercase tracking-widest leading-none">Global Rank: {rankInfo.tier}</span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-surface border border-white/20 flex items-center justify-center overflow-hidden group-hover:border-red transition-colors shadow-[0_0_15px_rgba(239,68,68,0.1)] cursor-pointer">
                        {user?.profilePhoto ? (
                            <img src={user.profilePhoto} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <svg className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        )}
                    </div>
                </Link>
            </div>
        </header>
    );
}

function DashboardFooter() {
    const { logout } = useAuth();
    return (
        <footer className="relative z-10 w-full mt-auto py-4 px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] text-slate-500 font-black tracking-[0.2em] uppercase border-t border-white/5 bg-surface/40 backdrop-blur-md">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <div className="flex space-x-0.5">
                        <div className="w-1 h-3 bg-red opacity-80 animate-pulse" />
                        <div className="w-1 h-3 bg-red opacity-40 animate-pulse delay-75" />
                        <div className="w-1 h-3 bg-red opacity-20 animate-pulse delay-150" />
                    </div>
                    <span className="text-white/80">SYS_V.0.2.1</span>
                </div>
                <div className="hidden md:block w-px h-3 bg-white/10" />
                <span className="hidden md:inline-block tracking-widest">AimSync Competitive Core</span>
            </div>

            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-emerald-400 font-mono tracking-widest">12MS</span>
                </div>
                <div className="w-px h-3 bg-white/10" />
                <button 
                    onClick={logout}
                    className="text-slate-400 hover:text-red transition-colors flex items-center gap-2 group uppercase"
                >
                    <span>Terminate Session</span>
                    <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                </button>
            </div>
        </footer>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background text-text-primary relative overflow-x-hidden flex flex-col">
            <DashboardBackground />
            
            <div className="relative z-10 w-full max-w-[1600px] mx-auto flex-1 flex flex-col px-4 md:px-8 pb-12">
                <DashboardHeader />
                {children}
            </div>
            
            <DashboardFooter />
        </div>
    );
}