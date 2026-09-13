"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BaseTarget, GameResult } from "@/lib/game/types";
import { difficultyConfig, difficultyLabels, getScaledRadius, type Difficulty } from "@/lib/utils/drillConfig";
import {
    calculateAccuracy,
    calculateAverageReactionTime,
    calculateBestReactionTime,
    getScaledCanvasCoordinates,
    isPointInsideTarget,
} from "@/lib/utils/gameMath";
import { createStaticTarget } from "@/lib/utils/targetSpawning";
import { useBaseGameEngine } from "@/lib/hooks/useBaseGameEngine";
import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";
import { spawnHitmarker } from "@/lib/utils/hitmarker";
import { useKinematicsTracker } from "@/lib/hooks/useKinematicsTracker";

const BENCHMARK_DURATION = 60; // Locked 60s always

interface FlickBenchmarkProps {
    onFinish?: (res: GameResult) => void;
}

export default function FlickBenchmark({ onFinish }: FlickBenchmarkProps) {
    const [difficulty, setDifficulty] = useState<Difficulty>("hard");
    const benchmarkConfig = difficultyConfig[difficulty];

    const [target, setTarget] = useState<BaseTarget | null>(null);
    const activeTargetId = useRef<string | null>(null);
    const lastClickTimeRef = useRef<number>(0);
    const sessionStartRef = useRef<number>(0);
    const [calculating, setCalculating] = useState(false);

    const engine = useBaseGameEngine({
        modeId: "flick-benchmark",
        overrideSettings: {
            difficulty,
            duration: BENCHMARK_DURATION,
        },
        onSessionComplete: onFinish,
    });

    // ── Kinematics Tracker ───────────────────────────────────────────────
    const kinematics = useKinematicsTracker();
    const kinUiSumRef    = useRef(0);
    const kinOfcSumRef   = useRef(0);
    const kinSampleCount = useRef(0);

    const accuracy = calculateAccuracy(engine.hits, engine.misses);
    const averageReactionTime = calculateAverageReactionTime(engine.reactionTimes);
    const bestReactionTime = calculateBestReactionTime(engine.reactionTimes);

    const spawnTarget = useCallback(() => {
        engine.clearAllTimersAndLoops();
        const currentSession = engine.sessionIdxRef.current;
        const elapsedSec = (performance.now() - sessionStartRef.current) / 1000;
        const radius = getScaledRadius(benchmarkConfig.targetRadius, difficulty, elapsedSec, BENCHMARK_DURATION);
        const next = createStaticTarget(
            engine.dimensions.width,
            engine.dimensions.height,
            radius
        );
        next.timeToLive = benchmarkConfig.targetLifetimeMs;
        activeTargetId.current = next.id;
        setTarget(next);
        engine.incrementSpawned();

        // Register with kinematics tracker
        const { mousePosRef } = engine;
        kinematics.registerTargetSpawn(
            next.id, next.x, next.y,
            mousePosRef.current.x, mousePosRef.current.y
        );

        engine.addTimeout(() => {
            if (engine.sessionIdxRef.current !== currentSession) return;
            setTarget(null);
            kinematics.discardTarget(next.id);
            engine.incrementTimeoutMiss(benchmarkConfig.missPenalty);
            spawnTarget();
        }, next.timeToLive || 800);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [benchmarkConfig, difficulty, engine.dimensions, engine.incrementSpawned, engine.incrementTimeoutMiss]);

    // Canvas render — target drawn as red sphere (same as StaticFlick)
    useEffect(() => {
        const canvas = engine.canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, engine.dimensions.width, engine.dimensions.height);

        if (target) {
            // Outer glow ring
            ctx.beginPath();
            ctx.arc(target.x, target.y, target.radius + 5, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(236, 72, 153, 0.12)";
            ctx.fill();

            // Pink sphere gradient
            const gradient = ctx.createRadialGradient(
                target.x - target.radius * 0.3, target.y - target.radius * 0.3, target.radius * 0.05,
                target.x, target.y, target.radius
            );
            gradient.addColorStop(0, "#FFCCE8");
            gradient.addColorStop(0.35, "#ec4899");
            gradient.addColorStop(1, "#7c0040");

            ctx.beginPath();
            ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.shadowColor = "rgba(236, 72, 153, 0.7)";
            ctx.shadowBlur = 22;
            ctx.shadowOffsetY = 8;
            ctx.fill();
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
        }
    }, [target, engine.dimensions, engine.canvasRef]);

    const handleInitialize = async () => {
        setTarget(null);
        lastClickTimeRef.current = 0;
        kinematics.resetTracker();
        kinUiSumRef.current    = 0;
        kinOfcSumRef.current   = 0;
        kinSampleCount.current = 0;
        engine.beginSession();
    };

    // Spawn first target when engine transitions to "live"
    const prevPhaseRef = useRef(engine.phase);
    useEffect(() => {
        if (engine.phase === "live" && prevPhaseRef.current !== "live") {
            sessionStartRef.current = performance.now();
            spawnTarget();
        }
        prevPhaseRef.current = engine.phase;
    }, [engine.phase, spawnTarget]);

    // ── Kinematic path recorder ────────────────────────────────────────────
    useEffect(() => {
        if (engine.phase !== "live") return;
        const canvas = engine.canvasRef.current;
        if (!canvas) return;
        const onMove = () => {
            const tid = activeTargetId.current;
            if (!tid) return;
            kinematics.recordMouseMove(tid, engine.mousePosRef.current.x, engine.mousePosRef.current.y);
        };
        canvas.addEventListener("mousemove", onMove);
        return () => canvas.removeEventListener("mousemove", onMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engine.phase, engine.canvasRef.current]);

    useEffect(() => {
        if (engine.phase === "finished") {
            setCalculating(true);
            const t = setTimeout(() => {
                setCalculating(false);
            }, 800);
            return () => clearTimeout(t);
        }
    }, [engine.phase]);

    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (engine.phase !== "live" || !target || engine.countdown !== null) return;
        if (target.id !== activeTargetId.current) return;

        const now = performance.now();
        if (now - lastClickTimeRef.current < 80) return;
        lastClickTimeRef.current = now;

        const canvas = engine.canvasRef.current;
        if (!canvas) return;

        const { x, y } = getScaledCanvasCoordinates(e, canvas, engine.dimensions.width, engine.dimensions.height, engine.mousePosRef.current);

        if (isPointInsideTarget(x, y, target.x, target.y, target.radius)) {
            // ── Kinematic diagnostics ─────────────────────────────────
            const kinResult = kinematics.computeOnHit(target.id);
            if (kinResult) {
                kinUiSumRef.current    += kinResult.urgencyIndex;
                kinOfcSumRef.current   += kinResult.overFlickCoefficient;
                kinSampleCount.current += 1;
            }
            const n = kinSampleCount.current;
            if (n > 0) {
                engine.kinematicsExtraStatsRef.current = {
                    "Urgency Index":          parseFloat((kinUiSumRef.current  / n).toFixed(3)),
                    "Over-Flick Coefficient": parseFloat((kinOfcSumRef.current / n).toFixed(3)),
                };
            }

            const reaction = performance.now() - target.spawnedAt;
            engine.triggerHit(reaction);
            engine.incrementScore(benchmarkConfig.scorePerHit);
            spawnHitmarker(e.clientX, e.clientY);
            spawnTarget();
        } else {
            engine.triggerMiss(benchmarkConfig.missPenalty);
        }
    };

    const difficultyOptions: { key: Difficulty; label: string; desc: string }[] = [
        { key: "easy", label: "ECO", desc: "Large targets · 1400ms lifetime" },
        { key: "medium", label: "BONUS", desc: "Medium targets · 1100ms lifetime" },
        { key: "hard", label: "FORCE BUY", desc: "Small targets · 850ms lifetime" },
        { key: "extreme", label: "FULL BUY", desc: "Micro targets · 650ms lifetime" },
    ];

    const isCountingDown = engine.countdown !== null && engine.countdown > 0;
    const isLive = engine.phase === "live";
    const isFinished = engine.phase === "finished" && engine.result !== null && !calculating;

    return (
        <div ref={engine.containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-[#EAEAEA] overflow-hidden">

            {/* RESULTS SCREEN */}
            {isFinished && engine.result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={engine.result} onRestart={handleInitialize} onBackToMenu={engine.resetToMenu} />
                </div>
            )}

            {/* PRE-GAME MENU */}
            {engine.phase === "menu" && (
                <>
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-30 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />
                    <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                        <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                            <div className="space-y-2">
                                <p className="text-[#ec4899] text-sm font-bold tracking-[0.35em] uppercase">Evaluation Protocol</p>
                                <h2 className="text-5xl font-black tracking-widest uppercase text-white">Flick Benchmark</h2>
                                <p className="text-gray-500 text-sm leading-relaxed pt-1">
                                    An official, unmodified run. Duration is locked to <span className="text-white font-bold">60 seconds</span>.<br />
                                    Choose your difficulty below, then initialize the sequence.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <span className="text-gray-400 text-xs font-bold tracking-wider uppercase block text-left">Select Difficulty</span>
                                <div className="grid grid-cols-2 gap-3">
                                    {difficultyOptions.map(opt => (
                                        <button
                                            key={opt.key}
                                            onClick={() => setDifficulty(opt.key)}
                                            className={`flex flex-col text-left p-4 rounded-xl border transition-all duration-200 ${
                                                difficulty === opt.key
                                                    ? "border-[#ec4899] bg-[#ec4899]/10 shadow-[0_0_20px_rgba(236,72,153,0.15)]"
                                                    : "border-white/10 bg-black/40 hover:border-white/30 hover:bg-black/60"
                                            }`}
                                        >
                                            <span className={`text-xs font-black tracking-widest uppercase mb-1 ${difficulty === opt.key ? "text-[#ec4899]" : "text-gray-400"}`}>
                                                {opt.label}
                                            </span>
                                            <span className="text-white font-bold text-sm">{opt.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 justify-center">
                                {[
                                    { label: "MODE", value: "Static Flick" },
                                    { label: "DURATION", value: "60s · LOCKED" },
                                    { label: "ACCURACY FLOOR", value: "85%" },
                                ].map(item => (
                                    <div key={item.label} className="flex flex-col items-center px-4 py-2 border border-[#ec4899]/20 bg-[#ec4899]/5 rounded-xl flex-1">
                                        <span className="text-[#ec4899] text-[9px] font-black tracking-widest uppercase mb-1">{item.label}</span>
                                        <span className="text-white font-black text-xs tracking-wider uppercase">{item.value}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleInitialize}
                                className="w-full mt-2 px-12 py-5 bg-[#ec4899] text-white text-lg font-black tracking-[0.2em] rounded-xl hover:bg-white hover:text-[#ec4899] transition-all shadow-[0_0_30px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.6)]"
                            >
                                INITIALIZE BENCHMARK
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* COUNTDOWN */}
            {engine.phase === "countdown" && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#121212]">
                    <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

                    <div className="relative z-10 text-center space-y-6">
                        <p className="text-[#ec4899] text-xs font-black tracking-[0.5em] uppercase">
                            Benchmark Protocol · Locked Config
                        </p>
                        <div className="flex flex-col items-center space-y-1">
                            <span className="text-gray-500 text-xs tracking-widest uppercase">Commencing In</span>
                            <span
                                key={engine.countdown}
                                className="text-[10rem] font-black leading-none text-white drop-shadow-[0_0_60px_#ec4899] animate-ping"
                                style={{ animationDuration: "0.8s", animationIterationCount: 1, animationFillMode: "both" }}
                            >
                                {engine.countdown}
                            </span>
                        </div>

                        <div className="flex gap-4 mt-4">
                            {[
                                { label: "MODE", value: "Static Flick" },
                                { label: "DURATION", value: "60s" },
                                { label: "DIFFICULTY", value: difficultyLabels[difficulty].toUpperCase() },
                                { label: "ENVIRONMENT", value: "Dark" },
                            ].map(item => (
                                <div key={item.label} className="flex flex-col items-center px-5 py-3 border border-[#ec4899]/20 bg-[#ec4899]/5 rounded-xl">
                                    <span className="text-[#ec4899] text-[9px] font-black tracking-widest uppercase mb-1">{item.label}</span>
                                    <span className="text-white font-black text-sm tracking-wider uppercase">{item.value}</span>
                                    <span className="text-[#ec4899] text-[8px] font-bold tracking-wider uppercase mt-1">LOCKED</span>
                                </div>
                            ))}
                        </div>

                        <p className="text-gray-600 text-xs tracking-widest uppercase pt-2">
                            Center your mouse · Plant your wrist · Focus
                        </p>
                    </div>
                </div>
            )}

            {/* ACTIVE GAME */}
            {isLive && (
                <div className="relative flex flex-col w-full h-full z-20">
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10 backdrop-blur-sm">
                        <SessionHUD
                            data={{
                                mode: "Flick Benchmark",
                                difficulty: difficultyLabels[difficulty],
                                timeLeft: engine.timeLeft,
                                score: engine.score,
                                hits: engine.hits,
                                misses: engine.misses,
                                accuracy,
                                averageReactionTime,
                                bestReactionTime,
                                extraLines: [
                                    { label: "Spawned", value: engine.totalTargetsSpawned },
                                    { label: "Timeouts", value: engine.missedByTimeout },
                                ],
                            }}
                        />
                    </div>

                    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-1 bg-[#ec4899]/10 border border-[#ec4899]/30 rounded-full pointer-events-none">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#ec4899] shadow-[0_0_6px_#ec4899] animate-pulse" />
                        <span className="text-[#ec4899] text-[9px] font-black tracking-[0.35em] uppercase">Official Benchmark · All Settings Locked</span>
                    </div>

                    <div className="relative flex-1 w-full overflow-hidden">
                        <div className="absolute inset-0 z-0 overflow-hidden bg-[#2f3b4c] perspective-[800px]">
                            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[#334155] bg-[linear-gradient(to_right,#00000033_2px,transparent_2px),linear-gradient(to_bottom,#00000033_2px,transparent_2px)] bg-[size:4rem_4rem] origin-center [transform:rotateX(60deg)]" />
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)] pointer-events-none" />
                        </div>

                        <div className="relative z-10 w-full h-full">
                            <canvas
                                ref={engine.canvasRef}
                                width={engine.dimensions.width}
                                height={engine.dimensions.height}
                                onMouseDown={handleCanvasMouseDown}
                                className="absolute inset-0 block cursor-crosshair"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* CALCULATING TELEMETRY */}
            {calculating && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#121212]/95 backdrop-blur-sm">
                    <div className="text-center space-y-8">
                        <div className="relative w-24 h-24 mx-auto">
                            <div className="absolute inset-0 rounded-full border-4 border-[#ec4899]/20" />
                            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#ec4899] animate-spin" />
                            <div className="absolute inset-3 rounded-full bg-[#ec4899]/10 flex items-center justify-center">
                                <span className="text-[#ec4899] text-xl font-black">%</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-[#ec4899] text-3xl font-black tracking-widest uppercase">
                                Processing Telemetry
                            </h2>
                            <p className="text-gray-500 text-xs tracking-[0.3em] uppercase">
                                Applying accuracy modifiers...
                            </p>
                        </div>

                        <div className="flex gap-3 justify-center">
                            {["Calculating Score", "Checking Accuracy Floor", "Stamping Certificate"].map((step, i) => (
                                <div
                                    key={step}
                                    className="flex items-center gap-2 px-3 py-1.5 border border-white/5 bg-white/[0.02] rounded-lg"
                                    style={{ opacity: 0.4 + i * 0.2 }}
                                >
                                    <div
                                        className="w-1.5 h-1.5 rounded-full bg-[#ec4899] animate-pulse"
                                        style={{ animationDelay: `${i * 0.3}s` }}
                                    />
                                    <span className="text-gray-400 text-[9px] tracking-widest uppercase">{step}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}