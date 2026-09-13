"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult, MovingTarget } from "@/lib/game/types";
import { difficultyConfig, difficultyLabels, getScaledRadius, type Difficulty } from "@/lib/utils/drillConfig";
import {
    calculateAccuracy,
    calculateAverageReactionTime,
    calculateBestReactionTime,
    getScaledCanvasCoordinates,
    isPointInsideTarget,
} from "@/lib/utils/gameMath";
import { createTrackingTarget, updateTrackingTargetPosition } from "@/lib/utils/targetSpawning";
import { useBaseGameEngine } from "@/lib/hooks/useBaseGameEngine";

import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";

type TrueTrackingTarget = MovingTarget & { health: number; isBeingTracked: boolean };

interface OverrideSettings { difficulty: Difficulty; duration: number; taskId?: string; }
interface TrackingModeProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

export default function TrackingMode({ overrideSettings, onFinish }: TrackingModeProps = {}) {
    const targetRef = useRef<TrueTrackingTarget | null>(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const targetTrailRef = useRef<{ x: number; y: number }[]>([]);

    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const effectiveDifficulty = overrideSettings?.difficulty ?? difficulty;

    const engine = useBaseGameEngine({
        modeId: "tracking-mode",
        overrideSettings,
        onSessionComplete: onFinish,
    });

    const config = difficultyConfig[effectiveDifficulty];
    const accuracy = calculateAccuracy(engine.hits, engine.misses);
    const averageReactionTime = calculateAverageReactionTime(engine.reactionTimes);
    const bestReactionTime = calculateBestReactionTime(engine.reactionTimes);

    const preRenderedHitCanvasRef = useRef<HTMLCanvasElement | OffscreenCanvas | null>(null);
    const preRenderedMissCanvasRef = useRef<HTMLCanvasElement | OffscreenCanvas | null>(null);
    const lastPreRenderedRadius = useRef<number | null>(null);

    const startTrackingLoop = useCallback(() => {
        let lastTime = performance.now();

        const tick = (currentTime: number) => {
            if (!engine.isMountedRef.current || engine.phase !== "live") return;
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;

            const canvas = engine.canvasRef.current;
            const ctx = canvas?.getContext("2d");

            if (canvas && ctx && targetRef.current) {
                const w = engine.dimensions.width;
                const h = engine.dimensions.height;
                const nextTarget = updateTrackingTargetPosition(targetRef.current, w, h);
                const { x, y } = mouseRef.current;
                const isHit = isPointInsideTarget(x, y, nextTarget.x, nextTarget.y, nextTarget.radius);
                let newHealth = targetRef.current.health;

                if (isHit) {
                    newHealth -= (deltaTime * 0.25);
                }

                if (newHealth <= 0) {
                    targetRef.current = null;
                    engine.incrementScore(config.scorePerHit + 50);
                    engine.triggerHit(0); // tracking reaction logs as 0
                    spawnTarget();
                    return;
                }

                targetRef.current = { ...nextTarget, health: newHealth, isBeingTracked: isHit } as TrueTrackingTarget;

                ctx.clearRect(0, 0, w, h);

                // Add to trail queue
                targetTrailRef.current.push({ x: nextTarget.x, y: nextTarget.y });
                if (targetTrailRef.current.length > 15) {
                    targetTrailRef.current.shift();
                }

                // Draw fading trail polyline
                const trail = targetTrailRef.current;
                if (trail.length > 1) {
                    for (let i = 0; i < trail.length - 1; i++) {
                        ctx.beginPath();
                        ctx.moveTo(trail[i].x, trail[i].y);
                        ctx.lineTo(trail[i + 1].x, trail[i + 1].y);
                        const opacity = (i / (trail.length - 1)) * 0.4;
                        ctx.strokeStyle = `rgba(0, 229, 255, ${opacity})`;
                        ctx.lineWidth = (i / (trail.length - 1)) * 4 + 1;
                        ctx.lineCap = "round";
                        ctx.lineJoin = "round";
                        ctx.stroke();
                    }
                }

                const t = targetRef.current;
                const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

                if (!preRenderedHitCanvasRef.current || !preRenderedMissCanvasRef.current || lastPreRenderedRadius.current !== t.radius) {
                    const { preRenderTrackingTarget } = require("@/lib/utils/canvasHelpers");
                    preRenderedHitCanvasRef.current = preRenderTrackingTarget(t.radius, true, dpr);
                    preRenderedMissCanvasRef.current = preRenderTrackingTarget(t.radius, false, dpr);
                    lastPreRenderedRadius.current = t.radius;
                }

                const glowRadius = t.radius * 1.6;
                const size = Math.ceil(glowRadius * 2) + 8;
                const activeCanvas = isHit ? preRenderedHitCanvasRef.current : preRenderedMissCanvasRef.current;

                ctx.drawImage(activeCanvas as any, t.x - size / 2, t.y - size / 2, size, size);

                // Health bar
                const barW = t.radius * 2;
                const barH = 5;
                const barX = t.x - t.radius;
                const barY = t.y + t.radius + 8;
                ctx.fillStyle = "rgba(255,255,255,0.1)";
                ctx.roundRect?.(barX, barY, barW, barH, 2);
                ctx.fill();
                ctx.fillStyle = isHit ? "#00E5FF" : "#EF4444";
                ctx.roundRect?.(barX, barY, barW * (newHealth / 100), barH, 2);
                ctx.fill();
            }

            engine.addAnimationFrame(tick);
        };

        engine.addAnimationFrame(tick);
    }, [config, engine]);

    const spawnTarget = useCallback(() => {
        engine.clearAllTimersAndLoops();
        const currentSession = engine.sessionIdxRef.current;
        const elapsedSec = 0;
        const radius = getScaledRadius(config.targetRadius, effectiveDifficulty, elapsedSec, engine.duration);

        // Clear trail queue on spawn
        targetTrailRef.current = [];

        const ttl = config.targetLifetimeMs + 1000;
        const baseTarget = createTrackingTarget(
            effectiveDifficulty,
            engine.dimensions.width,
            engine.dimensions.height,
            radius,
            ttl
        );
        targetRef.current = { ...baseTarget, health: 100, isBeingTracked: false };
        startTrackingLoop();

        engine.addTimeout(() => {
            if (!engine.isMountedRef.current || engine.sessionIdxRef.current !== currentSession) return;
            targetRef.current = null;
            engine.incrementTimeoutMiss(config.missPenalty);
            spawnTarget();
        }, ttl);
    }, [config, effectiveDifficulty, engine, startTrackingLoop]);

    const handleStartGame = async () => {
        targetRef.current = null;
        engine.beginSession();
    };

    // Spawn first target when engine transitions to "live"
    const prevPhaseRef = useRef(engine.phase);
    useEffect(() => {
        if (engine.phase === "live" && prevPhaseRef.current !== "live") {
            spawnTarget();
        }
        prevPhaseRef.current = engine.phase;
    }, [engine.phase, spawnTarget]);

    const updateMousePosition = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!engine.canvasRef.current) return;
        const { x, y } = getScaledCanvasCoordinates(event, engine.canvasRef.current, engine.dimensions.width, engine.dimensions.height, engine.mousePosRef.current);
        mouseRef.current.x = x;
        mouseRef.current.y = y;

        // In tracking mode, moving the mouse checks tracking collision;
        // to increment stats, we count mouse movements inside target as "hits" or check hits via target health drain.
        // We can increment hits/misses based on tracking.
        // Let's check how hits/misses are counted in continuous tracking:
        // Clicks or hover?
        // Wait, in continuous tracking, hits are incremented when a target's health reaches 0 (line 122 of legacy TrackingMode).
        // Let's check misses: misses are incremented when target lifetime expires (line 215 of legacy TrackingMode).
        // So they are counted automatically!
    };

    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!engine.canvasRef.current) return;
        const { x, y } = getScaledCanvasCoordinates(event, engine.canvasRef.current, engine.dimensions.width, engine.dimensions.height, engine.mousePosRef.current);
        if (targetRef.current) {
            const isHit = isPointInsideTarget(x, y, targetRef.current.x, targetRef.current.y, targetRef.current.radius);
            if (!isHit) {
                engine.triggerMiss(config.missPenalty);
            }
        }
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
                                <p className="text-[#3366FF] text-sm font-bold tracking-[0.3em] uppercase">AimSync Training</p>
                                <h2 className="text-5xl font-black tracking-widest uppercase">Continuous Tracking</h2>
                                <p className="text-slate-400 text-sm">Hold your cursor over the target. Drain its health bar to score.</p>
                            </div>
                            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 justify-center pt-4">
                                {!overrideSettings && (
                                    <>
                                        <label className="flex flex-col text-left flex-1">
                                            <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DIFFICULTY</span>
                                            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#3366FF] outline-none transition-all cursor-pointer">
                                                {Object.entries(difficultyLabels).map(([key, label]) => (
                                                    <option key={key} value={key}>{label.toUpperCase()}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="flex flex-col text-left flex-1">
                                            <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DURATION</span>
                                            <select value={engine.duration} onChange={(e) => engine.setDuration(Number(e.target.value))} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#3366FF] outline-none transition-all cursor-pointer">
                                                <option value={15}>15s (Warmup)</option>
                                                <option value={30}>30s (Standard)</option>
                                                <option value={45}>45s (Extended)</option>
                                                <option value={60}>60s (Endurance)</option>
                                            </select>
                                        </label>
                                    </>
                                )}
                            </div>
                            <button onClick={handleStartGame} className="w-full mt-8 px-12 py-5 bg-white text-[#121212] text-lg font-black tracking-[0.2em] rounded-xl hover:bg-[#3366FF] hover:text-white transition-all shadow-[0_0_30px_rgba(51,102,255,0.2)]">
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
                                mode: "Tracking Protocol",
                                difficulty: difficultyLabels[effectiveDifficulty],
                                timeLeft: engine.timeLeft,
                                score: engine.score,
                                hits: engine.hits,
                                misses: engine.misses,
                                accuracy,
                                averageReactionTime,
                                bestReactionTime,
                                extraLines: [{ label: "Timeouts", value: engine.missedByTimeout }],
                            }}
                        />
                    </div>

                    {/* ARENA */}
                    <div className="relative flex-1 w-full overflow-hidden">
                        <div className="absolute inset-0 z-0 overflow-hidden bg-[#1a2030] perspective-[800px]">
                            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[#1e293b] bg-[linear-gradient(to_right,#00000033_2px,transparent_2px),linear-gradient(to_bottom,#00000033_2px,transparent_2px)] bg-[size:4rem_4rem] origin-center [transform:rotateX(60deg)]" />
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_85%)] pointer-events-none" />
                        </div>
                        <div className="relative z-10 w-full h-full">
                            <canvas
                                ref={engine.canvasRef}
                                width={engine.dimensions.width}
                                height={engine.dimensions.height}
                                onMouseMove={updateMousePosition}
                                onMouseDown={updateMousePosition}
                                onClick={handleCanvasClick}
                                className="absolute inset-0 block cursor-crosshair"
                            />
                        </div>

                        {/* COUNTDOWN OVERLAY */}
                        {isCountingDown && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/40">
                                <div className="flex flex-col items-center gap-4">
                                    <span key={engine.countdown} className="text-[12rem] font-black text-[#3366FF] leading-none select-none"
                                        style={{ textShadow: "0 0 80px rgba(51,102,255,0.8), 0 0 20px rgba(51,102,255,1)" }}>
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