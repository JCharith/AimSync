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
import { createMicroAdjustTarget } from "@/lib/utils/targetSpawning";
import { useBaseGameEngine } from "@/lib/hooks/useBaseGameEngine";
import { useAuth } from "@/lib/contexts/AuthContext";
import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";
import ComboMeter from "@/components/ComboMeter";
import { spawnHitmarker } from "@/lib/utils/hitmarker";

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface MicroAdjustProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

export default function MicroAdjust({ overrideSettings, onFinish }: MicroAdjustProps = {}) {
    const { isTrial } = useAuth();
    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const effectiveDifficulty = overrideSettings?.difficulty ?? difficulty;

    const [target, setTarget] = useState<BaseTarget | null>(null);
    const activeTargetId = useRef<string | null>(null);
    const sessionStartRef = useRef<number>(0);

    const engine = useBaseGameEngine({
        modeId: "micro-adjust",
        overrideSettings,
        onSessionComplete: onFinish,
    });

    // Force bonus difficulty and 30s duration for trial users
    useEffect(() => {
        if (isTrial) {
            setDifficulty("medium");
            engine.setDuration(30);
        }
    }, [isTrial, engine]);

    const config = difficultyConfig[effectiveDifficulty];
    const microRadius = Math.max(10, Math.round(config.targetRadius * 0.65));

    const accuracy = calculateAccuracy(engine.hits, engine.misses);
    const averageReactionTime = calculateAverageReactionTime(engine.reactionTimes);
    const bestReactionTime = calculateBestReactionTime(engine.reactionTimes);

    const spawnTarget = useCallback(() => {
        engine.clearAllTimersAndLoops();
        const currentSession = engine.sessionIdxRef.current;
        const currentX = target?.x;
        const currentY = target?.y;

        const elapsedSec = (performance.now() - sessionStartRef.current) / 1000;
        const currentRadius = getScaledRadius(microRadius, effectiveDifficulty, elapsedSec, engine.duration);

        const nextTarget = createMicroAdjustTarget(
            engine.dimensions.width,
            engine.dimensions.height,
            currentRadius,
            currentX,
            currentY
        );

        setTarget(nextTarget);
        activeTargetId.current = nextTarget.id;
        engine.incrementSpawned();

        engine.addTimeout(() => {
            if (engine.sessionIdxRef.current !== currentSession) return;
            engine.incrementTimeoutMiss(config.missPenalty);
            spawnTarget();
        }, config.targetLifetimeMs);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config, effectiveDifficulty, engine.dimensions, engine.duration, microRadius, target, engine.incrementSpawned, engine.incrementTimeoutMiss]);

    // Canvas render effect
    useEffect(() => {
        const canvas = engine.canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, engine.dimensions.width, engine.dimensions.height);

        if (target) {
            const t = target;
            const gradient = ctx.createRadialGradient(
                t.x - t.radius * 0.3, t.y - t.radius * 0.3, t.radius * 0.1,
                t.x, t.y, t.radius
            );
            gradient.addColorStop(0, "#FFFFFF");
            gradient.addColorStop(0.3, "#A855F7");
            gradient.addColorStop(1, "#4C1D95");

            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.shadowColor = "rgba(0,0,0,0.6)";
            ctx.shadowBlur = 25;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 20;
            ctx.fill();
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }
    }, [target, engine.dimensions, engine.canvasRef]);

    const lastClickTimeRef = useRef<number>(0);

    const handleStartGame = async () => {
        setTarget(null);
        lastClickTimeRef.current = 0;
        sessionStartRef.current = performance.now();
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

    const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (engine.phase !== "live" || !target || engine.countdown !== null) return;
        if (target.id !== activeTargetId.current) return;

        const now = performance.now();
        if (now - lastClickTimeRef.current < 80) return;
        lastClickTimeRef.current = now;

        const canvas = engine.canvasRef.current;
        if (!canvas) return;

        const { x, y } = getScaledCanvasCoordinates(event, canvas, engine.dimensions.width, engine.dimensions.height, engine.mousePosRef.current);

        if (isPointInsideTarget(x, y, target.x, target.y, target.radius)) {
            const reaction = performance.now() - target.spawnedAt;
            engine.triggerHit(reaction);
            engine.incrementScore(config.scorePerHit + (engine.combo * 5));
            spawnHitmarker(event.clientX, event.clientY);
            spawnTarget();
            return;
        }

        engine.triggerMiss(config.missPenalty, x, y, target.x, target.y);
        spawnTarget();
    };

    const isCountingDown = engine.countdown !== null && engine.countdown > 0;
    const isLive = engine.phase === "live";
    const isFinished = engine.phase === "finished" && engine.result !== null;

    return (
        <div ref={engine.containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-white overflow-hidden">

            {/* RESULTS SCREEN */}
            {isFinished && engine.result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={engine.result} onRestart={handleStartGame} onBackToMenu={engine.resetToMenu} />
                </div>
            )}

            {/* PRE-GAME MENU */}
            {engine.phase === "menu" && (
                <>
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-30 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />
                    <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                        <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                            <div className="space-y-2">
                                <p className="text-[#A855F7] text-sm font-bold tracking-[0.3em] uppercase">AimSync Training</p>
                                <h2 className="text-5xl font-black tracking-widest uppercase">Micro Adjust</h2>
                            </div>
                            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 justify-center pt-4">
                                <label className="flex flex-col text-left flex-1">
                                    <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DIFFICULTY</span>
                                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#A855F7] outline-none transition-all cursor-pointer">
                                        {Object.entries(difficultyLabels).map(([key, label]) => (
                                            <option key={key} value={key} disabled={isTrial && key !== "medium"}>
                                                {label.toUpperCase()}{isTrial && key !== "medium" ? " 🔒" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="flex flex-col text-left flex-1">
                                    <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DURATION</span>
                                    <select value={engine.duration} onChange={(e) => engine.setDuration(Number(e.target.value))} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#A855F7] outline-none transition-all cursor-pointer">
                                        <option value={15} disabled={isTrial}>15s (Warmup){isTrial ? " 🔒" : ""}</option>
                                        <option value={30}>30s (Standard)</option>
                                        <option value={45} disabled={isTrial}>45s (Extended){isTrial ? " 🔒" : ""}</option>
                                        <option value={60} disabled={isTrial}>60s (Endurance){isTrial ? " 🔒" : ""}</option>
                                    </select>
                                </label>
                            </div>
                            <button onClick={handleStartGame} className="w-full mt-8 px-12 py-5 bg-white text-[#121212] text-lg font-black tracking-[0.2em] rounded-xl hover:bg-[#A855F7] hover:text-white transition-all">
                                INITIALIZE SEQUENCE
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ACTIVE GAME */}
            {(isLive || isCountingDown) && (
                <div className="relative flex flex-col w-full h-full z-20">
                    {/* TOP HUD */}
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10 backdrop-blur-sm">
                        <SessionHUD
                            data={{
                                mode: "Micro Adjust",
                                difficulty: difficultyLabels[difficulty],
                                timeLeft: engine.timeLeft,
                                score: engine.score,
                                hits: engine.hits,
                                misses: engine.misses,
                                accuracy,
                                averageReactionTime,
                                bestReactionTime,
                                extraLines: [{ label: "Target Scale", value: "-35%" }],
                            }}
                        />
                    </div>

                    {/* ARENA */}
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
                            <ComboMeter combo={engine.combo} />
                        </div>

                        {/* COUNTDOWN OVERLAY */}
                        {isCountingDown && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/40">
                                <div className="flex flex-col items-center gap-4">
                                    <span key={engine.countdown} className="text-[12rem] font-black text-[#A855F7] leading-none select-none drop-shadow-[0_0_60px_#A855F7]">
                                        {engine.countdown}
                                    </span>
                                    <p className="text-white/50 text-sm font-bold tracking-[0.3em] uppercase">Get Ready</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}