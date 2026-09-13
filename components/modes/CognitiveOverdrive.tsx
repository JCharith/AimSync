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

interface Distractor {
    id: string;
    baseX: number;
    baseY: number;
    radius: number;
    phase: number;
    speed: number;
    amplitude: number;
    axis: "x" | "y";
}

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface CognitiveOverdriveProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

export default function CognitiveOverdrive({ overrideSettings, onFinish }: CognitiveOverdriveProps = {}) {
    const { isTrial } = useAuth();
    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const effectiveDifficulty = overrideSettings?.difficulty ?? difficulty;

    const [target, setTarget] = useState<BaseTarget | null>(null);
    const targetRef = useRef<BaseTarget | null>(null);
    const [distractors, setDistractors] = useState<Distractor[]>([]);
    const distractorsRef = useRef<Distractor[]>([]);

    const activeTargetId = useRef<string | null>(null);
    const lastHitTargetIdRef = useRef<string | null>(null);
    const sessionStartRef = useRef<number>(0);

    const engine = useBaseGameEngine({
        modeId: "cognitive-overdrive",
        overrideSettings,
        onSessionComplete: onFinish,
    });

    const config = difficultyConfig[effectiveDifficulty];
    const accuracy = calculateAccuracy(engine.hits, engine.misses);
    const averageReactionTime = calculateAverageReactionTime(engine.reactionTimes);
    const bestReactionTime = calculateBestReactionTime(engine.reactionTimes);

    // Sync refs
    useEffect(() => {
        targetRef.current = target;
    }, [target]);

    useEffect(() => {
        distractorsRef.current = distractors;
    }, [distractors]);

    const spawnTarget = useCallback(() => {
        engine.clearAllTimersAndLoops();
        const currentSession = engine.sessionIdxRef.current;
        const elapsedSec = (performance.now() - sessionStartRef.current) / 1000;
        const radius = getScaledRadius(config.targetRadius, effectiveDifficulty, elapsedSec, engine.duration);
        const nextTarget = createStaticTarget(engine.dimensions.width, engine.dimensions.height, radius);
        const ttl = config.targetLifetimeMs * 1.5;
        nextTarget.timeToLive = ttl;
        activeTargetId.current = nextTarget.id;

        setTarget(nextTarget);

        // Spawn distractors
        const numDistractors = Math.floor(Math.random() * 2) + 1;
        const newDistractors: Distractor[] = [];
        for (let i = 0; i < numDistractors; i++) {
            newDistractors.push({
                id: Math.random().toString(),
                baseX: nextTarget.x,
                baseY: nextTarget.y,
                radius: radius * 1.1,
                phase: Math.random() * Math.PI * 2,
                speed: 3 + Math.random() * 4,
                amplitude: radius * (1.5 + Math.random() * 2),
                axis: Math.random() > 0.5 ? "x" : "y",
            });
        }
        setDistractors(newDistractors);
        engine.incrementSpawned();

        engine.addTimeout(() => {
            if (engine.sessionIdxRef.current !== currentSession) return;
            setTarget(null);
            setDistractors([]);
            engine.incrementTimeoutMiss(config.missPenalty);
            spawnTarget();
        }, nextTarget.timeToLive || 800);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config, effectiveDifficulty, engine.dimensions, engine.duration, engine.incrementSpawned, engine.incrementTimeoutMiss]);

    const preRenderedTargetCanvasRef = useRef<HTMLCanvasElement | OffscreenCanvas | null>(null);
    const lastPreRenderedTargetRadius = useRef<number | null>(null);

    const preRenderedDistractorCanvasRef = useRef<HTMLCanvasElement | OffscreenCanvas | null>(null);
    const lastPreRenderedDistractorRadius = useRef<number | null>(null);

    // Canvas render loop using addAnimationFrame
    useEffect(() => {
        if (engine.phase !== "live" && engine.phase !== "countdown") return;

        const render = () => {
            const canvas = engine.canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            ctx.clearRect(0, 0, engine.dimensions.width, engine.dimensions.height);
            const time = performance.now() / 1000;

            const currentTarget = targetRef.current;
            const currentDistractors = distractorsRef.current;

            if (currentTarget) {
                const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
                if (!preRenderedTargetCanvasRef.current || lastPreRenderedTargetRadius.current !== currentTarget.radius) {
                    const { preRenderCognitiveTarget } = require("@/lib/utils/canvasHelpers");
                    preRenderedTargetCanvasRef.current = preRenderCognitiveTarget(currentTarget.radius, dpr);
                    lastPreRenderedTargetRadius.current = currentTarget.radius;
                }

                const shadowBlur = 15;
                const size = Math.ceil((currentTarget.radius + shadowBlur) * 2);
                const offset = currentTarget.radius + shadowBlur;
                ctx.drawImage(preRenderedTargetCanvasRef.current as any, currentTarget.x - offset, currentTarget.y - offset, size, size);
            }

            currentDistractors.forEach(d => {
                const currentX = d.baseX + (d.axis === "x" ? Math.sin(time * d.speed + d.phase) * d.amplitude : 0);
                const currentY = d.baseY + (d.axis === "y" ? Math.sin(time * d.speed + d.phase) * d.amplitude : 0);
                const pulse = Math.sin(time * 10) * 0.1 + 1.1;

                ctx.beginPath();
                ctx.arc(currentX, currentY, d.radius * pulse, 0, Math.PI * 2);
                ctx.strokeStyle = "rgba(50, 150, 255, 0.5)";
                ctx.lineWidth = 2;
                ctx.stroke();

                const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
                if (!preRenderedDistractorCanvasRef.current || lastPreRenderedDistractorRadius.current !== d.radius) {
                    const { preRenderCognitiveDistractor } = require("@/lib/utils/canvasHelpers");
                    preRenderedDistractorCanvasRef.current = preRenderCognitiveDistractor(d.radius, dpr);
                    lastPreRenderedDistractorRadius.current = d.radius;
                }

                const size = Math.ceil(d.radius * 2) + 4;
                const offset = size / 2;
                ctx.drawImage(preRenderedDistractorCanvasRef.current as any, currentX - offset, currentY - offset, size, size);
            });

            engine.addAnimationFrame(render);
        };

        engine.addAnimationFrame(render);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engine.phase, engine.dimensions, engine.canvasRef]);

    const lastClickTimeRef = useRef<number>(0);

    const handleStartGame = async () => {
        setTarget(null);
        setDistractors([]);
        lastHitTargetIdRef.current = null;
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
        const time = performance.now() / 1000;

        let hitDistractor: Distractor | null = null;
        for (const d of distractors) {
            const currentX = d.baseX + (d.axis === "x" ? Math.sin(time * d.speed + d.phase) * d.amplitude : 0);
            const currentY = d.baseY + (d.axis === "y" ? Math.sin(time * d.speed + d.phase) * d.amplitude : 0);
            if (isPointInsideTarget(x, y, currentX, currentY, d.radius)) {
                hitDistractor = d;
                break;
            }
        }

        if (hitDistractor) {
            engine.triggerMiss(config.missPenalty * 2);
            setDistractors(prev => prev.filter(d => d.id !== hitDistractor!.id));
            return;
        }

        if (isPointInsideTarget(x, y, target.x, target.y, target.radius)) {
            if (target.id === lastHitTargetIdRef.current) return;
            lastHitTargetIdRef.current = target.id;

            const reaction = performance.now() - target.spawnedAt;
            engine.triggerHit(reaction);
            engine.incrementScore(config.scorePerHit + engine.combo * 5);
            spawnHitmarker(event.clientX, event.clientY);
            spawnTarget();
            return;
        }

        engine.triggerMiss(config.missPenalty);
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
                                <h2 className="text-5xl font-black tracking-widest uppercase text-white">Cognitive Overdrive</h2>
                                <p className="text-gray-400 mt-2">Target Discrimination: Shoot the red hostile targets. Avoid the blue civilian targets blocking your line of sight.</p>
                            </div>
                            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 justify-center pt-4">
                                <label className="flex flex-col text-left flex-1">
                                    <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DIFFICULTY</span>
                                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#3366FF] outline-none transition-all cursor-pointer">
                                        {Object.entries(difficultyLabels).map(([key, label]) => (
                                            <option key={key} value={key} disabled={isTrial && key !== "eco" && key !== "bonus"}>
                                                {label.toUpperCase()}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="flex flex-col text-left flex-1">
                                    <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DURATION</span>
                                    <select value={engine.duration} onChange={(e) => engine.setDuration(Number(e.target.value))} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#3366FF] outline-none transition-all cursor-pointer">
                                        {!overrideSettings && (
                                            <option value={15} disabled={isTrial}>15s (Warmup)</option>
                                        )}
                                        <option value={30}>30s (Standard)</option>
                                        {!overrideSettings && (
                                            <option value={45}>45s (Extended)</option>
                                        )}
                                        <option value={60} disabled={isTrial}>60s (Endurance)</option>
                                    </select>
                                </label>
                            </div>
                            <button onClick={handleStartGame} className="w-full mt-8 px-12 py-5 bg-white text-[#121212] text-lg font-black tracking-[0.2em] rounded-xl hover:bg-[#3366FF] hover:text-white transition-all">
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
                                mode: "Cognitive Overdrive",
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
                                    <span key={engine.countdown} className="text-[12rem] font-black text-[#3366FF] leading-none select-none drop-shadow-[0_0_60px_#3366FF]">
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
