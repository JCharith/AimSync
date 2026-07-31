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

const ENDURANCE_DURATION = 180; // 3-minute locked endurance evaluation protocol

type TrueTrackingTarget = MovingTarget & { health: number; isBeingTracked: boolean };

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface ConsistencyCheckProps { overrideSettings?: OverrideSettings; onFinish?: (res: GameResult) => void; }

export interface StabilityMetrics {
    neuralStabilityScore: number;
    focusDegradationPct: number;
    coefficientOfVariation: number;
    blockMeans: number[];
}

export default function ConsistencyCheck({ overrideSettings, onFinish }: ConsistencyCheckProps = {}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const targetRef = useRef<TrueTrackingTarget | null>(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const targetTrailRef = useRef<{ x: number; y: number }[]>([]);

    const sessionStartRef = useRef<number | null>(null);
    const hitsHistoryRef = useRef<{ timestamp: number; reactionTime: number }[]>([]);
    const [realTimeStability, setRealTimeStability] = useState<number>(100);
    const [focusDegradation, setFocusDegradation] = useState<number>(0);

    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const effectiveDifficulty = overrideSettings?.difficulty ?? difficulty;

    // Advanced Neural Stability Score Calculation Engine
    const computeNeuralStabilityMetrics = useCallback((hits: { timestamp: number; reactionTime: number }[]): StabilityMetrics => {
        const BLOCK_DURATION = 30; // 30 seconds per block
        const NUM_BLOCKS = 6; // 6 blocks = 180s total
        const blocks: number[][] = Array.from({ length: NUM_BLOCKS }, () => []);

        for (const hit of hits) {
            const blockIdx = Math.min(NUM_BLOCKS - 1, Math.max(0, Math.floor(hit.timestamp / BLOCK_DURATION)));
            blocks[blockIdx].push(hit.reactionTime);
        }

        const blockMeans: number[] = [];
        for (let i = 0; i < NUM_BLOCKS; i++) {
            const blockHits = blocks[i];
            if (blockHits.length > 0) {
                const mean = blockHits.reduce((sum, val) => sum + val, 0) / blockHits.length;
                blockMeans.push(mean);
            }
        }

        if (blockMeans.length < 2) {
            return {
                neuralStabilityScore: 100,
                focusDegradationPct: 0,
                coefficientOfVariation: 0,
                blockMeans: [0, 0, 0, 0, 0, 0]
            };
        }

        // Coefficient of Variation (CV = stdDev / mean) across 30s blocks
        const overallMean = blockMeans.reduce((sum, val) => sum + val, 0) / blockMeans.length;
        const variance = blockMeans.reduce((sum, val) => sum + Math.pow(val - overallMean, 2), 0) / blockMeans.length;
        const stdDev = Math.sqrt(variance);
        const cv = overallMean > 0 ? (stdDev / overallMean) : 0;

        // Focus Degradation: compare initial phase (0-60s, blocks 0 & 1) vs final phase (120-180s, blocks 4 & 5)
        const initialHits = [...blocks[0], ...blocks[1]];
        const finalHits = [...blocks[4], ...blocks[5]];

        let initialAvg = overallMean;
        let finalAvg = overallMean;

        if (initialHits.length > 0) {
            initialAvg = initialHits.reduce((a, b) => a + b, 0) / initialHits.length;
        }
        if (finalHits.length > 0) {
            finalAvg = finalHits.reduce((a, b) => a + b, 0) / finalHits.length;
        }

        // Degradation % (positive value indicates reaction slowdown / focus degradation)
        const degradationPct = initialAvg > 0 ? ((finalAvg - initialAvg) / initialAvg) * 100 : 0;

        // Final score formula (0 to 100): 100 - CV penalty - degradation penalty
        const cvPenalty = cv * 250;
        const degradationPenalty = Math.max(0, degradationPct) * 0.4;
        const finalScore = Math.max(0, Math.min(100, Math.round(100 - cvPenalty - degradationPenalty)));

        return {
            neuralStabilityScore: finalScore,
            focusDegradationPct: Number(degradationPct.toFixed(1)),
            coefficientOfVariation: Number(cv.toFixed(3)),
            blockMeans
        };
    }, []);

    // Export Telemetry and Stability Metrics to Cloudflare D1 Serverless Database
    const exportTelemetryToD1 = useCallback(async (result: GameResult, metrics: StabilityMetrics) => {
        try {
            const payload = {
                exerciseId: "consistency-check",
                exercise_id: "consistency-check",
                difficulty: effectiveDifficulty,
                score: result.score,
                hits: result.hits,
                misses: result.misses,
                accuracy: result.accuracy,
                maxCombo: Number(result.extraStats?.["Max Combo"] ?? 0),
                durationSeconds: ENDURANCE_DURATION,
                neuralStabilityScore: metrics.neuralStabilityScore,
                focusDegradation: metrics.focusDegradationPct,
                coefficientOfVariation: metrics.coefficientOfVariation,
            };

            // Post to primary D1 scores telemetry endpoint
            await fetch('/api/scores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(err => console.error('[D1 Export] Scores error:', err));

            // Post to update-stats endpoint to update user skill matrices & rolling averages
            await fetch('/api/update-stats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    neuralStabilityScore: metrics.neuralStabilityScore,
                    missQuadrants: {
                        topLeft: Math.floor(result.misses * 0.25),
                        topRight: Math.floor(result.misses * 0.25),
                        bottomLeft: Math.floor(result.misses * 0.25),
                        bottomRight: Math.floor(result.misses * 0.25)
                    }
                })
            }).catch(err => console.error('[D1 Export] Update stats error:', err));

        } catch (error) {
            console.error('[D1 Export Error]:', error);
        }
    }, [effectiveDifficulty]);

    const handleSessionComplete = useCallback((res: GameResult) => {
        const metrics = computeNeuralStabilityMetrics(hitsHistoryRef.current);
        const augmentedResult: GameResult = {
            ...res,
            extraStats: {
                ...(res.extraStats || {}),
                "Neural Stability Score": `${metrics.neuralStabilityScore}%`,
                "Focus Degradation": `${metrics.focusDegradationPct}%`,
                "Coefficient of Variation": metrics.coefficientOfVariation
            }
        };

        exportTelemetryToD1(augmentedResult, metrics);

        if (onFinish) {
            onFinish(augmentedResult);
        }
    }, [computeNeuralStabilityMetrics, exportTelemetryToD1, onFinish]);

    const engine = useBaseGameEngine({
        modeId: "consistency-check",
        overrideSettings: {
            difficulty: effectiveDifficulty,
            duration: overrideSettings?.duration ?? ENDURANCE_DURATION,
        },
        onSessionComplete: handleSessionComplete,
    });

    const config = difficultyConfig[effectiveDifficulty];
    const accuracy = calculateAccuracy(engine.hits, engine.misses);
    const averageReactionTime = calculateAverageReactionTime(engine.reactionTimes);
    const bestReactionTime = calculateBestReactionTime(engine.reactionTimes);

    const startTrackingLoop = useCallback(() => {
        let lastTime = performance.now();

        const tick = (currentTime: number) => {
            if (!engine.isMountedRef.current || engine.phase !== "live") return;
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;

            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");

            if (canvas && ctx && targetRef.current) {
                const nextTarget = updateTrackingTargetPosition(
                    targetRef.current,
                    engine.dimensions.width,
                    engine.dimensions.height
                );

                const { x, y } = mouseRef.current;
                const isHit = isPointInsideTarget(x, y, nextTarget.x, nextTarget.y, nextTarget.radius);

                let newHealth = targetRef.current.health;
                if (isHit) {
                    newHealth -= deltaTime * 0.25;
                }

                if (newHealth <= 0) {
                    const trackingDuration = performance.now() - targetRef.current.spawnedAt;
                    const elapsedMs = performance.now() - (sessionStartRef.current ?? performance.now());
                    const elapsedSec = elapsedMs / 1000;
                    
                    hitsHistoryRef.current.push({
                        timestamp: elapsedSec,
                        reactionTime: trackingDuration
                    });
                    
                    const metrics = computeNeuralStabilityMetrics(hitsHistoryRef.current);
                    setRealTimeStability(metrics.neuralStabilityScore);
                    setFocusDegradation(metrics.focusDegradationPct);

                    if (engine.kinematicsExtraStatsRef) {
                        engine.kinematicsExtraStatsRef.current["Neural Stability Score"] = metrics.neuralStabilityScore;
                        engine.kinematicsExtraStatsRef.current["Focus Degradation"] = metrics.focusDegradationPct;
                    }

                    targetRef.current = null;
                    engine.incrementScore(config.scorePerHit + 50);
                    engine.triggerHit(trackingDuration);
                    spawnTarget();
                    return;
                }

                targetRef.current = { ...nextTarget, health: newHealth, isBeingTracked: isHit } as TrueTrackingTarget;

                ctx.clearRect(0, 0, engine.dimensions.width, engine.dimensions.height);

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
                        ctx.strokeStyle = `rgba(139, 92, 246, ${opacity})`;
                        ctx.lineWidth = (i / (trail.length - 1)) * 4 + 1;
                        ctx.lineCap = "round";
                        ctx.lineJoin = "round";
                        ctx.stroke();
                    }
                }

                const t = targetRef.current;

                // Purple-tinted target for ConsistencyCheck evaluation identity
                const gradient = ctx.createRadialGradient(
                    t.x - t.radius * 0.3, t.y - t.radius * 0.3, t.radius * 0.1,
                    t.x, t.y, t.radius
                );
                if (t.isBeingTracked) {
                    gradient.addColorStop(0, "#FFFFFF");
                    gradient.addColorStop(0.3, "#a78bfa");
                    gradient.addColorStop(1, "#3b0764");
                } else {
                    gradient.addColorStop(0, "#DDD6FE");
                    gradient.addColorStop(0.3, "#8b5cf6");
                    gradient.addColorStop(1, "#3b0764");
                }

                ctx.beginPath();
                ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.shadowColor = t.isBeingTracked ? "rgba(167,139,250,0.8)" : "rgba(0,0,0,0.6)";
                ctx.shadowBlur = 25;
                ctx.shadowOffsetY = 20;
                ctx.fill();
                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;
            }

            engine.addAnimationFrame(tick);
        };

        engine.addAnimationFrame(tick);
    }, [config, computeNeuralStabilityMetrics, engine]);

    const spawnTarget = useCallback(() => {
        engine.clearAllTimersAndLoops();
        const currentSession = engine.sessionIdxRef.current;
        const elapsedSec = 0;
        const radius = getScaledRadius(config.targetRadius, effectiveDifficulty, elapsedSec, engine.duration);

        targetTrailRef.current = [];

        const baseTarget = createTrackingTarget(
            effectiveDifficulty,
            engine.dimensions.width,
            engine.dimensions.height,
            radius
        );

        targetRef.current = { ...baseTarget, health: 100, isBeingTracked: false };
        engine.incrementSpawned();
        startTrackingLoop();

        engine.addTimeout(() => {
            if (!engine.isMountedRef.current || engine.sessionIdxRef.current !== currentSession) return;
            engine.incrementTimeoutMiss(config.missPenalty);
            spawnTarget();
        }, config.targetLifetimeMs + 1000);
    }, [config, effectiveDifficulty, engine, startTrackingLoop]);

    const handleStartGame = async () => {
        targetRef.current = null;
        engine.beginSession();
    };

    const prevPhaseRef = useRef(engine.phase);
    useEffect(() => {
        if (engine.phase === "live" && prevPhaseRef.current !== "live") {
            sessionStartRef.current = performance.now();
            hitsHistoryRef.current = [];
            setRealTimeStability(100);
            setFocusDegradation(0);
            spawnTarget();
        }
        prevPhaseRef.current = engine.phase;
    }, [engine.phase, spawnTarget]);

    useEffect(() => {
        engine.canvasRef.current = canvasRef.current;
    }, [engine]);

    const updateMousePosition = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current) return;
        const { x, y } = getScaledCanvasCoordinates(event, canvasRef.current, engine.dimensions.width, engine.dimensions.height, engine.mousePosRef.current);
        mouseRef.current.x = x;
        mouseRef.current.y = y;
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
                            <div className="space-y-3">
                                <p className="text-[#8b5cf6] text-sm font-bold tracking-[0.35em] uppercase">Evaluation Protocol</p>
                                <h2 className="text-5xl font-black tracking-widest uppercase text-white">Consistency Check</h2>
                                <p className="text-gray-500 text-sm leading-relaxed pt-1">
                                    A grueling <span className="text-white font-bold">180-second (3-minute)</span> sustained endurance evaluation.<br />
                                    Maintain focus and tracking accuracy. The engine measures your<br />
                                    <span className="text-[#8b5cf6] font-bold">Neural Stability Score</span> &amp; focus degradation across 30s blocks.
                                </p>
                            </div>

                            {!overrideSettings && (
                                <div className="flex flex-col text-left">
                                    <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DIFFICULTY</span>
                                    <select
                                        value={difficulty}
                                        onChange={e => setDifficulty(e.target.value as Difficulty)}
                                        className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#8b5cf6] outline-none transition-all cursor-pointer"
                                    >
                                        {Object.entries(difficultyLabels).map(([key, label]) => (
                                            <option key={key} value={key}>{label.toUpperCase()}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="flex gap-3 justify-center">
                                {[
                                    { label: "FORMAT", value: "Endurance Track" },
                                    { label: "DURATION", value: "180s · LOCKED" },
                                    { label: "ENGINE", value: "Neural Stability CV" },
                                ].map(item => (
                                    <div key={item.label} className="flex flex-col items-center px-4 py-2 border border-[#8b5cf6]/20 bg-[#8b5cf6]/5 rounded-xl flex-1">
                                        <span className="text-[#8b5cf6] text-[9px] font-black tracking-widest uppercase mb-1">{item.label}</span>
                                        <span className="text-white font-black text-xs tracking-wider uppercase">{item.value}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleStartGame}
                                className="w-full px-12 py-5 bg-[#8b5cf6] text-white text-lg font-black tracking-[0.2em] rounded-xl hover:bg-white hover:text-[#8b5cf6] transition-all shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)]"
                            >
                                INITIATE 180S ENDURANCE SEQUENCE
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
                                mode: "Consistency Check",
                                difficulty: difficultyLabels[effectiveDifficulty],
                                timeLeft: engine.timeLeft,
                                score: engine.score,
                                hits: engine.hits,
                                misses: engine.misses,
                                accuracy,
                                averageReactionTime,
                                bestReactionTime,
                                extraLines: [
                                    { label: "Neural Stability", value: `${realTimeStability}%` },
                                    { label: "Focus Decay", value: `${focusDegradation}%` }
                                ],
                            }}
                        />
                    </div>

                    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-1 bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 rounded-full pointer-events-none">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6] shadow-[0_0_6px_#8b5cf6] animate-pulse" />
                        <span className="text-[#8b5cf6] text-[9px] font-black tracking-[0.35em] uppercase">180s Endurance Protocol · Stability Engine Active</span>
                    </div>

                    {/* ARENA */}
                    <div className="relative flex-1 w-full overflow-hidden">
                        <div className="absolute inset-0 z-0 overflow-hidden bg-[#2f3b4c] perspective-[800px]">
                            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[#334155] bg-[linear-gradient(to_right,#00000033_2px,transparent_2px),linear-gradient(to_bottom,#00000033_2px,transparent_2px)] bg-[size:4rem_4rem] origin-center [transform:rotateX(60deg)]" />
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)] pointer-events-none" />
                        </div>

                        <div className="relative z-10 w-full h-full">
                            <canvas
                                ref={canvasRef}
                                width={engine.dimensions.width}
                                height={engine.dimensions.height}
                                onMouseMove={updateMousePosition}
                                className="absolute inset-0 block cursor-crosshair"
                            />
                        </div>

                        {/* COUNTDOWN OVERLAY */}
                        {isCountingDown && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/40">
                                <div className="flex flex-col items-center gap-4">
                                    <span key={engine.countdown} className="text-[12rem] font-black text-[#8b5cf6] leading-none select-none drop-shadow-[0_0_60px_#8b5cf6]">
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
