"use client";

import { useEffect, useRef, useState } from "react";
import { updateStatsWithResult } from "@/lib/utils/statsService";
import type { GameResult } from "@/lib/game/types";

export default function ResultsScreen({ result, onRestart, onBackToMenu }: { result: GameResult, onRestart: () => void, onBackToMenu: () => void }) {
    const hasSaved = useRef(false);
    const [saveStatus, setSaveStatus] = useState<"syncing" | "synced" | "error">("syncing");

    useEffect(() => {
        if (!hasSaved.current && result) {
            updateStatsWithResult(result)
                .then(() => {
                    hasSaved.current = true;
                    setSaveStatus("synced");
                })
                .catch(() => setSaveStatus("error"));
        }
    }, [result]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/90 backdrop-blur-xl p-4">
            <div className="w-full max-w-lg bg-gray-900 border border-white/10 rounded-3xl p-10 text-center shadow-2xl">
                <div className="mb-6 flex justify-center">
                    {saveStatus === "syncing" && <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent animate-spin rounded-full" />}
                    {saveStatus === "synced" && <span className="text-emerald-500 text-xs font-black uppercase tracking-widest">● Telemetry Synced</span>}
                </div>

                <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">Session Ended</h2>
                <div className="text-5xl font-black text-emerald-500 mb-8">{result.score.toLocaleString()}</div>

                <div className="grid grid-cols-2 gap-4 mb-10">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                        <p className="text-gray-500 text-[10px] font-black uppercase mb-1">Accuracy</p>
                        <p className="text-xl font-bold text-white">{result.accuracy.toFixed(1)}%</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                        <p className="text-gray-500 text-[10px] font-black uppercase mb-1">Avg Reaction</p>
                        <p className="text-xl font-bold text-white">{Math.round(result.averageReactionTime)}ms</p>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <button onClick={onRestart} className="w-full py-4 bg-emerald-500 text-gray-950 font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-all">Re-Deploy</button>
                    <button onClick={onBackToMenu} className="w-full py-4 bg-transparent text-gray-500 font-bold uppercase tracking-widest rounded-xl hover:text-white transition-all">Return to Hub</button>
                </div>
            </div>
        </div>
    );
}