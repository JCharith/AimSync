"use client";

import React from "react";
import type { HUDData } from "@/lib/game/hud";

type SessionHUDProps = {
    data: HUDData;
    zenMode?: boolean;
};

const formatMs = (value?: number) => {
    if (value === undefined) return "-";
    return `${Math.round(value)} ms`;
};

export default function SessionHUD({ data, zenMode = true }: SessionHUDProps) {
    return (
        <>
            {/* Minimalist, Low-Opacity Zen Top Bar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 px-6 py-1.5 bg-black/60 border border-white/10 rounded-full backdrop-blur-md text-xs font-mono text-white/60 opacity-30 hover:opacity-100 transition-opacity duration-300 pointer-events-none select-none">
                <div>
                    SCORE: <span className="font-bold text-white">{data.score}</span>
                </div>
                <div className="w-px h-3 bg-white/20" />
                <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-zinc-400 font-mono tracking-widest uppercase">TIME</span>
                    <span className="font-bold text-amber-400 tabular-nums">{data.timeLeft}s</span>
                </div>
            </div>

            {/* Non-Essential Heavy Bottom Bar (Faded out in Zen Mode) */}
            <div className={`w-full flex flex-row items-center justify-between px-6 py-4 bg-background/80 border-t border-gray-800 text-text-primary z-10 transition-opacity duration-300 ${zenMode ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                {/* Left: Mode & Difficulty */}
                <div className="flex flex-col">
                    <h3 className="font-black tracking-widest uppercase text-sm">
                        {data.mode}
                    </h3>
                    <span className="text-cyan text-xs font-bold uppercase tracking-wider">
                        {data.difficulty}
                    </span>
                </div>

                {/* Center: Primary Stats (Horizontal) */}
                <div className="flex flex-row gap-8 text-sm">
                    <div className="flex flex-col items-center">
                        <span className="text-text-muted text-xs font-bold tracking-widest">SCORE</span>
                        <span className="font-black text-cyan text-lg">{data.score}</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-text-muted text-xs font-bold tracking-widest">ACCURACY</span>
                        <span className="font-black text-lg">{data.accuracy}%</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-text-muted text-xs font-bold tracking-widest">HITS / MISSES</span>
                        <span className="font-black text-lg">{data.hits} / {data.misses}</span>
                    </div>

                    {data.averageReactionTime !== undefined && (
                        <div className="flex flex-col items-center border-l border-gray-800 pl-8">
                            <span className="text-text-muted text-xs font-bold tracking-widest">AVG REACTION</span>
                            <span className="font-black text-lg">{formatMs(data.averageReactionTime)}</span>
                        </div>
                    )}
                </div>

                {/* Right: Time Remaining */}
                <div className="flex flex-col items-end">
                    <span className="text-text-muted text-xs font-bold tracking-widest">TIME</span>
                    <span className="font-black text-orange text-2xl leading-none">{data.timeLeft}s</span>
                </div>
            </div>
        </>
    );
}