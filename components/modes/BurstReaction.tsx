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
import { createBurstTarget, getBurstSize } from "@/lib/utils/targetSpawning";
import { useBaseGameEngine } from "@/lib/hooks/useBaseGameEngine";
import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";
import { spawnHitmarker } from "@/lib/utils/hitmarker";
import ComboMeter from "@/components/ComboMeter";

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface BurstReactionProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

export default function BurstReaction({ overrideSettings, onFinish }: BurstReactionProps = {}) {
    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const effectiveDifficulty = overrideSettings?.difficulty ?? difficulty;

    const [targets, setTargets] = useState<BaseTarget[]>([]);
    const targetsRef = useRef<BaseTarget[]>([]);
    const activeTargetIds = useRef<Set<string>>(new Set());
    const sessionStartRef = useRef<number>(0);

    const engine = useBaseGameEngine({
        modeId: "burst-reaction",
        overrideSettings,
        onSessionComplete: onFinish,
    });

    const config = difficultyConfig[effectiveDifficulty];
    const accuracy = calculateAccuracy(engine.hits, engine.misses);
    const averageReactionTime = calculateAverageReactionTime(engine.reactionTimes);
    const bestReactionTime = calculateBestReactionTime(engine.reactionTimes);

    const spawnCluster = useCallback(() => {
        engine.clearAllTimersAndLoops();
        const currentSession = engine.sessionIdxRef.current;
        const elapsedSec = (performance.now() - sessionStartRef.current) / 1000;
        const radius = getScaledRadius(config.targetRadius, effectiveDifficulty, elapsedSec, engine.duration);

        const clusterSize = getBurstSize(effectiveDifficulty) || 3;
        const newCluster: BaseTarget[] = [];
        activeTargetIds.current.clear();

        const clusterLifetime = Math.max(800, config.targetLifetimeMs * 1.5);

        for (let i = 0; i < clusterSize; i++) {
            let next = createBurstTarget(engine.dimensions.width, engine.dimensions.height, radius);
            let attempts = 0;
            while (newCluster.some((t) => Math.hypot(t.x - next.x, t.y - next.y) < radius * 2.5) && attempts < 15) {
                next = createBurstTarget(engine.dimensions.width, engine.dimensions.height, radius);
                attempts++;
            }
            next.timeToLive = clusterLifetime;
            newCluster.push(next);
            activeTargetIds.current.add(next.id);
        }

        targetsRef.current = newCluster;
        setTargets(newCluster);
        for (let i = 0; i < clusterSize; i++) {
            engine.incrementSpawned();
        }

        engine.addTimeout(() => {
            if (engine.sessionIdxRef.current !== currentSession) return;
            const remaining = targetsRef.current.length;
            if (remaining > 0) {
                engine.incrementTimeoutMiss(config.missPenalty * remaining);
            }
            targetsRef.current = [];
            setTargets([]);

            engine.addTimeout(() => {
                if (engine.sessionIdxRef.current !== currentSession) return;
                spawnCluster();
            }, 320);
        }, clusterLifetime);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config, effectiveDifficulty, engine.dimensions, engine.duration, engine.incrementSpawned, engine.incrementTimeoutMiss]);

    const preRenderedCanvasRef = useRef<HTMLCanvasElement | OffscreenCanvas | null>(null);
    const lastPreRenderedRadius = useRef<number | null>(null);

    // Canvas render loop
    useEffect(() => {
        const canvas = engine.canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, engine.dimensions.width, engine.dimensions.height);

        if (targets.length > 0) {
            const firstTarget = targets[0];
            const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

            if (!preRenderedCanvasRef.current || lastPreRenderedRadius.current !== firstTarget.radius) {
                const { preRenderBurstReactionTarget } = require("@/lib/utils/canvasHelpers");
                preRenderedCanvasRef.current = preRenderBurstReactionTarget(firstTarget.radius, dpr);
                lastPreRenderedRadius.current = firstTarget.radius;
            }

            const shadowBlur = 25;
            const shadowOffset = 20;
            const size = Math.ceil((firstTarget.radius + shadowBlur) * 2) + shadowOffset;
            const offset = firstTarget.radius + shadowBlur;

            for (const t of targets) {
                ctx.drawImage(preRenderedCanvasRef.current as any, t.x - offset, t.y - offset, size, size);
            }
        }
    }, [targets, engine.dimensions, engine.canvasRef]);

    const handleStartGame = async () => {
        setTargets([]);
        targetsRef.current = [];
        sessionStartRef.current = performance.now();
        engine.beginSession();
    };

    // Spawn first cluster when engine transitions to "live"
    const prevPhaseRef = useRef(engine.phase);
    useEffect(() => {
        if (engine.phase === "live" && prevPhaseRef.current !== "live") {
            sessionStartRef.current = performance.now();
            spawnCluster();
        }
        prevPhaseRef.current = engine.phase;
    }, [engine.phase, spawnCluster]);

    const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (engine.phase !== "live" || targets.length === 0 || engine.countdown !== null) return;
        const canvas = engine.canvasRef.current;
        if (!canvas) return;

        const { x, y } = getScaledCanvasCoordinates(event, canvas, engine.dimensions.width, engine.dimensions.height, engine.mousePosRef.current);
        let hitIndex = -1;
        for (let i = 0; i < targetsRef.current.length; i++) {
            if (isPointInsideTarget(x, y, targetsRef.current[i].x, targetsRef.current[i].y, targetsRef.current[i].radius)) {
                hitIndex = i;
                break;
            }
        }

        if (hitIndex !== -1) {
            const hitTarget = targetsRef.current[hitIndex];
            if (!activeTargetIds.current.has(hitTarget.id)) return;
            activeTargetIds.current.delete(hitTarget.id);

            const reaction = performance.now() - hitTarget.spawnedAt;
            engine.triggerHit(reaction);
            engine.incrementScore(config.scorePerHit + engine.combo * 5);

            targetsRef.current.splice(hitIndex, 1);
            setTargets([...targetsRef.current]);

            spawnHitmarker(event.clientX, event.clientY);

            if (targetsRef.current.length === 0) {
                engine.clearAllTimersAndLoops();
                engine.addTimeout(() => {
                    spawnCluster();
                }, 250);
            }
            return;
        }

        engine.triggerMiss(config.missPenalty);
    };

    const isCountingDown = engine.countdown !== null && engine.countdown > 0;
    const isLive = engine.phase === "live";
    const isFinished = engine.phase === "finished" && engine.result !== null;

    return (
        <div ref={engine.containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-white overflow-hidden">
            {isFinished && engine.result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={engine.result} onRestart={handleStartGame} onBackToMenu={engine.resetToMenu} />
                </div>
            )}
            {engine.phase === "menu" && (
                <>
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-30 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />
                    <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                        <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                            <div className="space-y-2">
                                <p className="text-orange-500 text-sm font-bold tracking-[0.3em] uppercase">AimSync Training</p>
                                <h2 className="text-5xl font-black tracking-widest uppercase">True Burst</h2>
                            </div>
                            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 justify-center pt-4">
                                <label className="flex flex-col text-left flex-1">
                                    <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DIFFICULTY</span>
                                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-orange-500 outline-none transition-all cursor-pointer">
                                        {Object.entries(difficultyLabels).map(([k, l]) => <option key={k} value={k}>{l.toUpperCase()}</option>)}
                                    </select>
                                </label>
                                <label className="flex flex-col text-left flex-1">
                                    <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DURATION</span>
                                    <select value={engine.duration} onChange={(e) => engine.setDuration(Number(e.target.value))} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-orange-500 outline-none transition-all cursor-pointer">
                                        {!overrideSettings && <option value={15}>15s (Warmup)</option>}
                                        <option value={30}>30s (Standard)</option>
                                        {!overrideSettings && <option value={45}>45s (Extended)</option>}
                                        <option value={60}>60s (Endurance)</option>
                                    </select>
                                </label>
                            </div>
                            <button onClick={handleStartGame} className="w-full mt-8 px-12 py-5 bg-white text-[#121212] text-lg font-black tracking-[0.2em] rounded-xl hover:bg-orange-500 hover:text-white transition-all">INITIALIZE SEQUENCE</button>
                        </div>
                    </div>
                </>
            )}
            {(isLive || isCountingDown) && (
                <div className="relative flex flex-col w-full h-full z-20">
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10 backdrop-blur-sm">
                        <SessionHUD data={{ mode: "True Burst", difficulty: difficultyLabels[difficulty], timeLeft: engine.timeLeft, score: engine.score, hits: engine.hits, misses: engine.misses, accuracy, averageReactionTime, bestReactionTime, extraLines: [{ label: "Multiplier", value: `${engine.combo}x` }] }} />
                    </div>
                    <div className="relative flex-1 w-full overflow-hidden">
                        <div className="absolute inset-0 z-0 overflow-hidden bg-[#2f3b4c] perspective-[800px]">
                            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[#334155] bg-[linear-gradient(to_right,#00000033_2px,transparent_2px),linear-gradient(to_bottom,#00000033_2px,transparent_2px)] bg-[size:4rem_4rem] origin-center [transform:rotateX(60deg)]" />
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)] pointer-events-none" />
                        </div>
                        <div className="relative z-10 w-full h-full">
                            <canvas ref={engine.canvasRef} width={engine.dimensions.width} height={engine.dimensions.height} onMouseDown={handleCanvasMouseDown} className="absolute inset-0 block cursor-none" />
                            <ComboMeter combo={engine.combo} />
                        </div>
                        {isCountingDown && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/40">
                                <div className="flex flex-col items-center gap-4">
                                    <span key={engine.countdown} className="text-[12rem] font-black text-orange-400 leading-none select-none drop-shadow-[0_0_60px_#F97316]">
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