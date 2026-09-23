"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { useRouter } from "next/navigation";
import type { GameResult, Difficulty } from "@/lib/game/types";
import { getModeConfig } from "@/lib/config/modeRegistry";
import { RoutineDirector } from "@/lib/services/routineDirector";
import { useAuth } from "@/lib/contexts/AuthContext";

interface ResultsScreenProps {
    exerciseId?: string;
    rawScoreData?: {
        hits: number;
        misses: number;
        maxCombo: number;
        durationSeconds: number;
    };
    onBackToDashboard?: () => void;

    // Legacy support:
    result?: GameResult | null;
    onRestart?: () => void;
    onBackToMenu?: () => void;
}

export default function ResultsScreen({
    exerciseId,
    rawScoreData,
    onBackToDashboard,
    result,
    onRestart,
    onBackToMenu
}: ResultsScreenProps = {}) {
    const router = useRouter();
    const storeReset = useGameStore(state => state.reset);
    const storeStartGame = useGameStore(state => state.startGame);
    const { isTrial } = useAuth();

    const [dailyState, setDailyState] = useState(() => RoutineDirector.getContractState());
    const [isContractActive, setIsContractActive] = useState(() => RoutineDirector.isContractActive());

    // 1. State Management: isSyncing defaults to true to cleanly intercept page lifecycles
    const [isSyncing, setIsSyncing] = useState(true);
    const [syncData, setSyncData] = useState<{
        currentLevel: number;
        currentXp: number;
        xpNeededForNext: number;
        xpEarned?: number;
    } | null>(null);

    // Latch to prevent double rendering triggers in React StrictMode
    const hasSyncedRef = useRef(false);

    // 2. Resolve parameters from either new props or legacy result
    const currentMode = exerciseId || result?.modeId || 'unknown-protocol';
    
    const hits = typeof rawScoreData?.hits === 'number' 
        ? rawScoreData.hits 
        : (result?.hits || 0);

    const misses = typeof rawScoreData?.misses === 'number' 
        ? rawScoreData.misses 
        : (result?.misses || 0);

    const maxCombo = typeof rawScoreData?.maxCombo === 'number' 
        ? rawScoreData.maxCombo 
        : (Number(result?.extraStats?.["Max Combo"]) || 0);

    const durationSeconds = typeof rawScoreData?.durationSeconds === 'number' 
        ? rawScoreData.durationSeconds 
        : (result?.durationSeconds || 30);

    const shotsFired = hits + misses;
    const accuracy = shotsFired > 0 ? Math.round((hits / shotsFired) * 100) : 0;
    const displayScore = result?.score ?? (hits * 10 + maxCombo * 5);
    const avgKps = (displayScore / (durationSeconds || 1)).toFixed(2);

    // Retrieve config from Centralized Registry
    const modeConfig = getModeConfig(currentMode);
    const showComboCell = modeConfig.supportsCombo;

    // 3. Async Transmission Lifecycle
    useEffect(() => {
        if (hasSyncedRef.current) return;
        hasSyncedRef.current = true;

        const transmitTelemetry = async () => {
            try {
                const payload = {
                    exerciseId: currentMode,
                    difficulty: result?.difficulty || "medium",
                    hits,
                    misses,
                    maxCombo,
                    score: result?.score ?? 0,
                    durationSeconds,
                    ghostTelemetry: result?.ghostTelemetry || null,
                    averageUrgencyIndex: result?.extraStats?.["Urgency Index"] ?? 1.0,
                    overFlickCoefficient: result?.extraStats?.["Over-Flick Coefficient"] ?? 1.0,
                    missQuadrants: result?.missQuadrants || null,
                    neuralStabilityScore: result?.extraStats?.["Neural Stability Score"] ?? null,
                    isTrial: isTrial
                };

                const response = await fetch('/api/scores', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        setSyncData({
                            currentLevel: data.currentLevel,
                            currentXp: data.currentXp,
                            xpNeededForNext: data.xpNeededForNext,
                            xpEarned: data.xpEarned,
                        });
                    }
                }
            } catch (error) {
                console.error("Telemetry sync failed:", error);
            } finally {
                setIsSyncing(false);
            }
        };

        transmitTelemetry();
    }, [currentMode, hits, misses, maxCombo, durationSeconds, result?.difficulty, result?.ghostTelemetry]);

    const handleNextContractDrill = () => {
        if (dailyState) {
            const dirDiff = dailyState.drills[dailyState.currentStepIndex]?.difficulty || "medium";
            let mappedDiff: Difficulty = "bonus";
            if (dirDiff === "easy") mappedDiff = "eco";
            else if (dirDiff === "medium") mappedDiff = "bonus";
            else if (dirDiff === "hard") mappedDiff = "force-buy";
            else if (dirDiff === "extreme") mappedDiff = "full-buy";

            const calculatedAccuracy = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0;
            const rxTimes = result?.reactionTimes || [];
            const avgRx = rxTimes.length > 0 ? rxTimes.reduce((a, b) => a + b, 0) / rxTimes.length : 0;
            const bestRx = rxTimes.length > 0 ? Math.min(...rxTimes) : 0;

            const gameResultPayload: GameResult = {
                id: `result-${Date.now()}`,
                modeId: currentMode,
                score: displayScore,
                hits,
                misses,
                accuracy: calculatedAccuracy,
                reactionTimes: rxTimes,
                averageReactionTime: avgRx,
                bestReactionTime: bestRx,
                createdAt: new Date().toISOString(),
                difficulty: mappedDiff,
                durationSeconds: durationSeconds,
                extraStats: { "Max Combo": maxCombo }
            };
            const updated = RoutineDirector.completeDrill(gameResultPayload);
            if (updated) {
                if (updated.status === "completed") {
                    router.push("/dashboard");
                } else {
                    const nextDrill = updated.drills[updated.currentStepIndex];
                    router.push(`/game?mode=${nextDrill.modeId}&diff=${nextDrill.difficulty}&time=${nextDrill.durationSeconds}&autoStart=true`);
                }
            } else {
                router.push("/dashboard");
            }
        }
    };

    const handleReturnToHub = async () => {
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => {});
        }
        storeReset();
        if (onBackToDashboard) {
            onBackToDashboard();
        } else if (onBackToMenu) {
            onBackToMenu();
        } else {
            router.push('/dashboard');
        }
    };

    const handlePlayAgain = () => {
        if (onRestart) {
            onRestart();
        } else {
            hasSyncedRef.current = false;
            setIsSyncing(true);
            storeStartGame(durationSeconds, isTrial);
        }
    };

    const gridCols = showComboCell ? 'md:grid-cols-5' : 'md:grid-cols-4';

    return (
        <div className="absolute inset-0 z-[200] bg-black/85 backdrop-blur-xl pointer-events-auto flex items-center justify-center p-6 transition-all duration-500 ease-out animate-in fade-in zoom-in-95">
            {/* 1. Synchronization Loader Overlay */}
            {isSyncing && (
                <div className="absolute inset-0 z-[300] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md rounded-3xl pointer-events-auto">
                    <div className="flex flex-col items-center gap-4 px-10 py-8 rounded-2xl border border-white/10 bg-white/5 shadow-2xl">
                        <div className="w-10 h-10 border-4 border-[#3366FF]/30 border-t-[#3366FF] rounded-full animate-spin" />
                        <p className="text-white text-sm font-bold tracking-[0.3em] uppercase">
                            Syncing Telemetry to Edge...
                        </p>
                        <p className="text-gray-500 text-xs tracking-wider">
                            Uploading to Cloudflare D1
                        </p>
                    </div>
                </div>
            )}

            <div className="w-full max-w-4xl bg-[#121212] border border-white/10 rounded-3xl p-10 shadow-2xl flex flex-col items-center text-white relative overflow-hidden">
                <style>{`
                  .xp-progress-fill {
                    transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
                  }
                `}</style>

                <p className="text-[#3366FF] text-sm font-bold tracking-[0.4em] uppercase mb-2">Protocol Complete</p>
                <h1 className="text-5xl font-black tracking-widest uppercase text-white drop-shadow-md mb-6">
                    {modeConfig.name}
                </h1>

                {/* Metric Grid */}
                <div className={`grid grid-cols-2 ${gridCols} gap-4 w-full mb-8 relative z-10`}>
                    <div className="flex flex-col items-center p-4 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                        <span className="text-gray-500 text-[10px] font-black tracking-wider mb-2 uppercase">Score</span>
                        <span className="text-3xl font-black text-white tabular-nums">{displayScore}</span>
                    </div>

                    <div className="flex flex-col items-center p-4 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                        <span className="text-gray-500 text-[10px] font-black tracking-wider mb-2 uppercase">Accuracy</span>
                        <span className="text-3xl font-black text-[#1DB954] tabular-nums">{accuracy}%</span>
                    </div>

                    <div className="flex flex-col items-center p-4 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                        <span className="text-gray-500 text-[10px] font-black tracking-wider mb-2 uppercase">Avg KPS</span>
                        <span className="text-3xl font-black text-cyan-400 tabular-nums">{avgKps}</span>
                    </div>

                    {/* 2. Conditional Matrix Filtering for Max Combo */}
                    {showComboCell && (
                        <div className="flex flex-col items-center p-4 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                            <span className="text-gray-500 text-[10px] font-black tracking-wider mb-2 uppercase">Max Combo</span>
                            <span className="text-3xl font-black italic text-orange-400 tabular-nums drop-shadow-md">x{maxCombo}</span>
                        </div>
                    )}

                    <div className="flex flex-col items-center p-4 bg-white/5 rounded-2xl border border-[#3366FF]/30 shadow-[0_0_15px_rgba(51,102,255,0.1)] relative overflow-hidden">
                        <span className="text-[#3366FF] text-[10px] font-black tracking-wider mb-2 uppercase">XP Earned</span>
                        <span className="text-3xl font-black text-[#3366FF] tabular-nums">
                            +{syncData ? syncData.xpEarned ?? 0 : (hits * 10 + maxCombo * 5)}
                        </span>
                    </div>
                </div>

                {/* Consistency Check Custom Stability Metrics */}
                {currentMode === "consistency-check" && (
                    <div className="w-full p-6 mb-8 rounded-2xl border border-[#8b5cf6]/30 bg-[#8b5cf6]/5 shadow-[0_0_20px_rgba(139,92,246,0.15)] relative z-10 flex flex-col sm:flex-row justify-around items-center gap-4 text-center sm:text-left">
                        <div className="flex flex-col items-center sm:items-start">
                            <span className="text-[#8b5cf6] text-[10px] font-bold tracking-widest uppercase">Neural Stability</span>
                            <span className="text-4xl font-black text-white mt-1 drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]">
                                {result?.extraStats?.["Stability Score"] || "100%"}
                            </span>
                        </div>
                        <div className="h-px sm:h-12 w-full sm:w-px bg-white/10" />
                        <div className="flex flex-col items-center sm:items-start">
                            <span className="text-gray-500 text-[10px] font-bold tracking-widest uppercase">Variance Assessment</span>
                            <span className="text-lg font-extrabold text-[#c084fc] mt-1">
                                {result?.extraStats?.["Assessment"] || "Stable Focus"}
                            </span>
                        </div>
                        <div className="h-px sm:h-12 w-full sm:w-px bg-white/10" />
                        <div className="flex flex-col items-center sm:items-start">
                            <span className="text-gray-500 text-[10px] font-bold tracking-widest uppercase">Block-to-Block Std Dev</span>
                            <span className="text-lg font-bold text-white mt-1">
                                {result?.extraStats?.["Std Dev Track"] || "0ms"}
                            </span>
                        </div>
                    </div>
                )}

                {/* 3. Performance Progress Bar Tracker */}
                {syncData && (
                    <div className="w-full mb-8 relative z-10">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400 text-xs font-black tracking-widest uppercase">
                                    Level {syncData.currentLevel}
                                </span>
                                <span className="text-gray-600 text-xs font-bold tracking-wider">
                                    {Math.round(syncData.currentXp).toLocaleString()} / {Math.round(syncData.xpNeededForNext).toLocaleString()} XP
                                </span>
                                <span className="text-gray-400 text-xs font-black tracking-widest uppercase">
                                    Level {syncData.currentLevel + 1}
                                </span>
                            </div>
                            <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                                <div
                                    className="xp-progress-fill h-full rounded-full bg-gradient-to-r from-[#3366FF] to-cyan-400 shadow-[0_0_8px_rgba(51,102,255,0.6)]"
                                    style={{
                                        width: `${(syncData.currentXp / syncData.xpNeededForNext) * 100}%`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {isContractActive && dailyState && dailyState.drills[dailyState.currentStepIndex] && dailyState.drills[dailyState.currentStepIndex].modeId === currentMode ? (
                    <div className="flex flex-col gap-4 w-full items-center justify-center relative z-10">
                        <button
                            onClick={handleNextContractDrill}
                            className="px-12 py-6 bg-gradient-to-r from-[#3366FF] to-cyan-500 text-white font-black tracking-[0.25em] text-lg uppercase rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all duration-300 shadow-[0_0_30px_rgba(51,102,255,0.45)] w-full max-w-md animate-pulse"
                        >
                            {dailyState.currentStepIndex === dailyState.drills.length - 1
                                ? "Complete Daily Contract"
                                : `Next Drill: ${getModeConfig(dailyState.drills[dailyState.currentStepIndex + 1]?.modeId || "")?.name || "Next"}`}
                        </button>
                        <p className="text-slate-500 text-[10px] font-bold tracking-[0.2em] uppercase mt-2">
                            Daily Contract Active &bull; Step {dailyState.currentStepIndex + 1} of {dailyState.drills.length}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col sm:flex-row gap-4 w-full justify-center relative z-10">
                        <button
                            onClick={handlePlayAgain}
                            className="px-10 py-5 bg-[#EAEAEA] text-[#121212] font-black tracking-[0.2em] uppercase rounded-xl hover:bg-[#3366FF] hover:text-white transition-all duration-300 w-full sm:w-auto"
                        >
                            Run Again
                        </button>
                        <button
                            onClick={handleReturnToHub}
                            className="px-10 py-5 bg-transparent border border-white/20 text-white font-bold tracking-[0.2em] uppercase rounded-xl hover:bg-white/10 hover:border-white/50 transition-all duration-300 w-full sm:w-auto"
                        >
                            Abort to Hub
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}