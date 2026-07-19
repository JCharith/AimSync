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
import { useAuth } from "@/lib/contexts/AuthContext";
import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";
import ComboMeter from "@/components/ComboMeter";
import { spawnHitmarker } from "@/lib/utils/hitmarker";
import { useKinematicsTracker } from "@/lib/hooks/useKinematicsTracker";
import StreakAnnouncer from "@/components/StreakAnnouncer";
import { ParticleShatterSystem } from "@/lib/engine/ParticleShatter";

interface OverrideSettings { difficulty: Difficulty; duration: number; taskId?: string; }
interface StaticFlickProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

export default function StaticFlick({ overrideSettings, onFinish }: StaticFlickProps = {}) {
    const { isTrial } = useAuth();
    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const effectiveDifficulty = overrideSettings?.difficulty ?? difficulty;

    const [target, setTarget] = useState<BaseTarget | null>(null);
    const activeTargetId = useRef<string | null>(null);
    const lastHitTargetIdRef = useRef<string | null>(null);
    const sessionStartRef = useRef<number>(0);

    const engine = useBaseGameEngine({
        modeId: "static-flick",
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

    // ── Kinematics Tracker ──────────────────────────────────────────────────
    const kinematics = useKinematicsTracker();
    // Rolling session accumulators (refs — never trigger re-renders)
    const kinUiSumRef    = useRef(0);
    const kinOfcSumRef   = useRef(0);
    const kinSampleCount = useRef(0);

    // High-performance particle system instance
    const particleSystemRef = useRef<ParticleShatterSystem | null>(null);
    useEffect(() => {
        particleSystemRef.current = new ParticleShatterSystem();
        return () => {
            particleSystemRef.current?.reset();
        };
    }, []);

    const config = difficultyConfig[effectiveDifficulty];

    const accuracy = calculateAccuracy(engine.hits, engine.misses);
    const averageReactionTime = calculateAverageReactionTime(engine.reactionTimes);
    const bestReactionTime = calculateBestReactionTime(engine.reactionTimes);

    const spawnTarget = useCallback(() => {
        engine.clearAllTimersAndLoops();
        const currentSession = engine.sessionIdxRef.current;
        const elapsedSec = (performance.now() - sessionStartRef.current) / 1000;
        
        let nextTarget;
        const targetIndex = engine.totalTargetsSpawned;
        if (engine.loadedGhost && engine.loadedGhost.targets && engine.loadedGhost.targets[targetIndex]) {
            const gTgt = engine.loadedGhost.targets[targetIndex];
            const x = (gTgt.x / 1000) * engine.dimensions.width;
            const y = (gTgt.y / 1000) * engine.dimensions.height;
            const radius = (gTgt.radius / 1000) * Math.min(engine.dimensions.width, engine.dimensions.height);
            nextTarget = {
                id: crypto.randomUUID(),
                x,
                y,
                radius,
                spawnedAt: performance.now(),
            };
        } else {
            const radius = getScaledRadius(config.targetRadius, effectiveDifficulty, elapsedSec, engine.duration);
            nextTarget = createStaticTarget(engine.dimensions.width, engine.dimensions.height, radius);
            nextTarget.spawnedAt = performance.now();
        }
        activeTargetId.current = nextTarget.id;

        setTarget(nextTarget);
        engine.incrementSpawned();
        engine.recordSpawnedTarget(nextTarget.x, nextTarget.y, nextTarget.radius);

        // Register the new target with the kinematic tracker.
        // Use the current mousePosRef coordinates as the cursor-at-spawn position.
        const { mousePosRef } = engine;
        kinematics.registerTargetSpawn(
            nextTarget.id,
            nextTarget.x,
            nextTarget.y,
            mousePosRef.current.x,
            mousePosRef.current.y
        );

        engine.addTimeout(() => {
            if (engine.sessionIdxRef.current !== currentSession) return;
            kinematics.discardTarget(nextTarget.id);
            engine.incrementTimeoutMiss(config.missPenalty);
            spawnTarget();
        }, config.targetLifetimeMs);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config, effectiveDifficulty, engine.dimensions, engine.duration, engine.incrementSpawned, engine.incrementTimeoutMiss, engine.totalTargetsSpawned, engine.loadedGhost, engine.recordSpawnedTarget]);

    const preRenderedCanvasRef = useRef<HTMLCanvasElement | OffscreenCanvas | null>(null);
    const lastPreRenderedRadius = useRef<number | null>(null);

    // Canvas render effect — continuous requestAnimationFrame loop when game is live
    useEffect(() => {
        const canvas = engine.canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animationFrameId: number;
        let lastTime = performance.now();

        const tick = () => {
            const now = performance.now();
            const delta = Math.min(0.1, (now - lastTime) / 1000);
            lastTime = now;

            ctx.clearRect(0, 0, engine.dimensions.width, engine.dimensions.height);

            // Draw active target
            if (target) {
                const t = target;
                const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

                if (!preRenderedCanvasRef.current || lastPreRenderedRadius.current !== t.radius) {
                    const { preRenderStaticFlickTarget } = require("@/lib/utils/canvasHelpers");
                    preRenderedCanvasRef.current = preRenderStaticFlickTarget(t.radius, dpr);
                    lastPreRenderedRadius.current = t.radius;
                }

                const glowRadius = t.radius * 1.7;
                const size = Math.ceil(glowRadius * 2) + 8;
                ctx.drawImage(preRenderedCanvasRef.current as any, t.x - size / 2, t.y - size / 2, size, size);
            }

            // Update and draw particle shatter vector FX
            if (particleSystemRef.current) {
                particleSystemRef.current.updateAndDraw(ctx, delta);
            }

            animationFrameId = requestAnimationFrame(tick);
        };

        if (engine.phase === "live" || engine.countdown !== null) {
            animationFrameId = requestAnimationFrame(tick);
        } else {
            // When not live, clear canvas and draw target if present once
            ctx.clearRect(0, 0, engine.dimensions.width, engine.dimensions.height);
            if (target) {
                const t = target;
                const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
                const { preRenderStaticFlickTarget } = require("@/lib/utils/canvasHelpers");
                preRenderedCanvasRef.current = preRenderStaticFlickTarget(t.radius, dpr);
                const glowRadius = t.radius * 1.7;
                const size = Math.ceil(glowRadius * 2) + 8;
                ctx.drawImage(preRenderedCanvasRef.current as any, t.x - size / 2, t.y - size / 2, size, size);
            }
        }

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [target, engine.dimensions, engine.canvasRef, engine.phase, engine.countdown]);

    const lastClickTimeRef = useRef<number>(0);

    // \u2500\u2500 Kinematic path recorder \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // Subscribes to mousemove on the game canvas (separate from the base engine's
    // crosshair handler) and pushes canvas-space coordinates into the tracker.
    // Uses engine.mousePosRef (already updated by the base handler) for zero
    // duplication of coordinate math.
    useEffect(() => {
        if (engine.phase !== "live") return;
        const canvas = engine.canvasRef.current;
        if (!canvas) return;

        const onMove = () => {
            const tid = activeTargetId.current;
            if (!tid) return;
            kinematics.recordMouseMove(
                tid,
                engine.mousePosRef.current.x,
                engine.mousePosRef.current.y
            );
        };

        canvas.addEventListener("mousemove", onMove);
        return () => canvas.removeEventListener("mousemove", onMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engine.phase, engine.canvasRef.current]);

    const handleStartGame = async () => {
        setTarget(null);
        lastHitTargetIdRef.current = null;
        lastClickTimeRef.current = 0;
        sessionStartRef.current = performance.now();
        // Reset kinematics accumulators for the new session
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
            if (target.id === lastHitTargetIdRef.current) return;
            lastHitTargetIdRef.current = target.id;

            engine.recordHitEvent(target.x, target.y, performance.now() - sessionStartRef.current);

            // ── Kinematic diagnostics ──────────────────────────────────────────
            const kinResult = kinematics.computeOnHit(target.id);
            if (kinResult) {
                kinUiSumRef.current    += kinResult.urgencyIndex;
                kinOfcSumRef.current   += kinResult.overFlickCoefficient;
                kinSampleCount.current += 1;
            }

            const reaction = performance.now() - target.spawnedAt;
            engine.triggerHit(reaction);
            engine.incrementScore(config.scorePerHit + (engine.combo * 5));

            // Spawn low-poly debris particle shatter flying outward from target coordinates
            if (particleSystemRef.current) {
                particleSystemRef.current.spawnShatter(target.x, target.y, '#3366FF', 16);
            }

            // Persist rolling kinematic session averages into kinematicsExtraStatsRef
            // so they flow into the final GameResult.extraStats at session end.
            const n = kinSampleCount.current;
            if (n > 0) {
                engine.kinematicsExtraStatsRef.current = {
                    "Urgency Index":          parseFloat((kinUiSumRef.current  / n).toFixed(3)),
                    "Over-Flick Coefficient": parseFloat((kinOfcSumRef.current / n).toFixed(3)),
                };
            }

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
        <div ref={engine.containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-[#EAEAEA] overflow-hidden">

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
                                <h2 className="text-5xl font-black tracking-widest uppercase text-white">Static Flick</h2>
                                <p className="text-slate-400 text-sm">Click targets as fast as possible. Chain hits to build your combo.</p>
                            </div>
                            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 justify-center pt-4">
                                {!overrideSettings && (
                                    <>
                                        <label className="flex flex-col text-left flex-1">
                                            <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DIFFICULTY</span>
                                            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#3366FF] outline-none transition-all cursor-pointer">
                                                {Object.entries(difficultyLabels).map(([key, label]) => (
                                                    <option key={key} value={key} disabled={isTrial && key !== "medium"}>
                                                        {label.toUpperCase()}{isTrial && key !== "medium" ? " 🔒" : ""}
                                                     </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="flex flex-col text-left flex-1">
                                            <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DURATION</span>
                                            <select value={engine.duration} onChange={(e) => engine.setDuration(Number(e.target.value))} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#3366FF] outline-none transition-all cursor-pointer">
                                                <option value={15} disabled={isTrial}>15s (Warmup){isTrial ? " 🔒" : ""}</option>
                                                <option value={30}>30s (Standard)</option>
                                                <option value={45} disabled={isTrial}>45s (Extended){isTrial ? " 🔒" : ""}</option>
                                                <option value={60} disabled={isTrial}>60s (Endurance){isTrial ? " 🔒" : ""}</option>
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
                                mode: "Static Flick",
                                difficulty: difficultyLabels[effectiveDifficulty],
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
                                onMouseDown={handleCanvasMouseDown}
                                className="absolute inset-0 block cursor-crosshair"
                            />
                            <ComboMeter combo={engine.combo} />
                            <StreakAnnouncer combo={engine.combo} />
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