"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { BaseTarget, GameResult } from "@/lib/game/types";
import { difficultyConfig, difficultyLabels, getScaledRadius, type Difficulty } from "@/lib/utils/drillConfig";
import { calculateAccuracy, calculateAverageReactionTime, calculateBestReactionTime, isPointInsideTarget } from "@/lib/utils/gameMath";
import { useBaseGameEngine } from "@/lib/hooks/useBaseGameEngine";
import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";
import ComboMeter from "@/components/ComboMeter";
import StreakAnnouncer from "@/components/StreakAnnouncer";
import { spawnHitmarker } from "@/lib/utils/hitmarker";
import { createStaticTarget } from "@/lib/utils/targetSpawning";

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface BlindFlickProps {
    overrideSettings?: OverrideSettings;
    onFinish?: (res: GameResult) => void;
}

export default function BlindFlick({ overrideSettings, onFinish }: BlindFlickProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const sessionStartRef = useRef<number>(0);
    const lastClickTimeRef = useRef<number>(0);
    
    // Mouse movement state tracking
    const lastMouseMoveTimeRef = useRef<number>(0);
    const isMouseMovingRef = useRef<boolean>(false);
    const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    
    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const effectiveDifficulty = overrideSettings?.difficulty ?? difficulty;

    const [target, setTarget] = useState<BaseTarget | null>(null);
    const targetRef = useRef<BaseTarget | null>(null);
    const hasFlashedRef = useRef<boolean>(false);
    const flashTimeoutRef = useRef<number | null>(null);
    const safetyTimeoutRef = useRef<number | null>(null);
 
    // Track state for the target's current visibility
    const [isTargetVisible, setIsTargetVisible] = useState<boolean>(false);

    const engine = useBaseGameEngine({
        modeId: "blind-flick",
        overrideSettings,
        onSessionComplete: onFinish,
    });

    const config = difficultyConfig[effectiveDifficulty];
    const accuracy = calculateAccuracy(engine.hits, engine.misses);
    const averageReactionTime = calculateAverageReactionTime(engine.reactionTimes);
    const bestReactionTime = calculateBestReactionTime(engine.reactionTimes);

    // Audio Context state
    const audioCtxRef = useRef<AudioContext | null>(null);

    const initAudio = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioCtxRef.current.state === "suspended") {
            audioCtxRef.current.resume();
        }
    };

    const playPanningSound = (targetX: number) => {
        if (!audioCtxRef.current) return;
        const ctx = audioCtxRef.current;
        
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const panner = ctx.createStereoPanner();

        // Calculate pan: fully left (-1) to fully right (1)
        const pan = (targetX - engine.dimensions.width / 2) / (engine.dimensions.width / 2);
        panner.pan.value = Math.max(-1, Math.min(1, pan));

        osc.type = "sine";
        osc.frequency.setValueAtTime(260, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(130, ctx.currentTime + 0.12);

        gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

        osc.connect(panner);
        panner.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.18);
    };

    const spawnTarget = useCallback(() => {
        if (safetyTimeoutRef.current) {
            window.clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
        }
        if (flashTimeoutRef.current) {
            window.clearTimeout(flashTimeoutRef.current);
            flashTimeoutRef.current = null;
        }
 
        const currentSession = engine.sessionIdxRef.current;
        const elapsedSec = (performance.now() - sessionStartRef.current) / 1000;
        const radius = getScaledRadius(config.targetRadius, effectiveDifficulty, elapsedSec, engine.duration);
        
        const ttl = config.targetLifetimeMs || 800;
        const nextTarget = createStaticTarget(engine.dimensions.width, engine.dimensions.height, radius, ttl);
        nextTarget.spawnedAt = performance.now();
        nextTarget.timeToLive = ttl;
        
        targetRef.current = nextTarget;
        setTarget(nextTarget);
        setIsTargetVisible(false);
        hasFlashedRef.current = false;
        isMouseMovingRef.current = false;
        
        playPanningSound(nextTarget.x);
        engine.incrementSpawned();
 
        // Safety timeout in case they never move their mouse
        safetyTimeoutRef.current = window.setTimeout(() => {
            if (engine.sessionIdxRef.current !== currentSession) return;
            setTarget(null);
            targetRef.current = null;
            engine.incrementTimeoutMiss(config.missPenalty);
            spawnTarget();
        }, nextTarget.timeToLive || 800);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config, effectiveDifficulty, engine.dimensions, engine.duration, engine.incrementSpawned, engine.incrementTimeoutMiss]);

    const handleInitialize = async () => {
        initAudio();
        setTarget(null);
        setIsTargetVisible(false);
        hasFlashedRef.current = false;
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

    // Trigger hit scoring and spawn next target
    const handleHitSuccess = (targetVal: BaseTarget, reaction: number) => {
        engine.triggerHit(reaction);
        engine.incrementScore(config.scorePerHit + (engine.combo * 5));
        spawnHitmarker(engine.mousePosRef.current.x, engine.mousePosRef.current.y);
        spawnTarget();
    };
 
    // Main game tick: monitors mouse stops and updates target flash state
    useEffect(() => {
        if (engine.phase !== "live") return;
 
        const checkMouseStop = () => {
            const now = performance.now();
            const currentTarget = targetRef.current;
 
            const mx = engine.mousePosRef.current.x;
            const my = engine.mousePosRef.current.y;
 
            if (mx !== prevMousePosRef.current.x || my !== prevMousePosRef.current.y) {
                isMouseMovingRef.current = true;
                lastMouseMoveTimeRef.current = now;
                prevMousePosRef.current = { x: mx, y: my };
            }
 
            if (currentTarget && !hasFlashedRef.current) {
                // If mouse has stopped moving for at least 100ms
                if (isMouseMovingRef.current && (now - lastMouseMoveTimeRef.current > 100)) {
                    isMouseMovingRef.current = false;
                    hasFlashedRef.current = true;
 
                    // 1. Check if crosshair is already on it at the stop instant (maximum reward)
                    if (isPointInsideTarget(mx, my, currentTarget.x, currentTarget.y, currentTarget.radius)) {
                        const reaction = now - currentTarget.spawnedAt;
                        handleHitSuccess(currentTarget, reaction);
                    } else {
                        // 2. Otherwise flash target visually for 150ms
                        setIsTargetVisible(true);
 
                        flashTimeoutRef.current = window.setTimeout(() => {
                            setIsTargetVisible(false);
                            // If the flash window expires without action, it's a timeout miss
                            engine.incrementTimeoutMiss(config.missPenalty);
                            spawnTarget();
                        }, 150);
                    }
                }
            }
 
            engine.addAnimationFrame(checkMouseStop);
        };
 
        engine.addAnimationFrame(checkMouseStop);
        
        return () => {
            if (flashTimeoutRef.current) {
                window.clearTimeout(flashTimeoutRef.current);
            }
            if (safetyTimeoutRef.current) {
                window.clearTimeout(safetyTimeoutRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engine.phase, config, spawnTarget]);

    // Canvas render loop
    useEffect(() => {
        if (engine.phase !== "live") return;

        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            ctx.clearRect(0, 0, engine.dimensions.width, engine.dimensions.height);

            // Draw dark void background
            ctx.fillStyle = "#0c0d12";
            ctx.fillRect(0, 0, engine.dimensions.width, engine.dimensions.height);

            // Draw target if visible
            const currentTarget = targetRef.current;
            if (currentTarget && isTargetVisible) {
                const grad = ctx.createRadialGradient(
                    currentTarget.x, currentTarget.y, currentTarget.radius * 0.1,
                    currentTarget.x, currentTarget.y, currentTarget.radius
                );
                grad.addColorStop(0, "#00f0ff");
                grad.addColorStop(0.4, "#00a2ff");
                grad.addColorStop(1, "rgba(0, 162, 255, 0)");

                ctx.shadowColor = "#00f0ff";
                ctx.shadowBlur = 15;

                ctx.beginPath();
                ctx.arc(currentTarget.x, currentTarget.y, currentTarget.radius, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
            }
 
            engine.addAnimationFrame(render);
        };
 
        engine.addAnimationFrame(render);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engine.phase, isTargetVisible]);
 
    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (engine.phase !== "live" || !target) return;
 
        const now = performance.now();
        if (now - lastClickTimeRef.current < 80) return;
        lastClickTimeRef.current = now;
 
        const canvas = canvasRef.current;
        if (!canvas) return;
 
        const x = engine.mousePosRef.current.x;
        const y = engine.mousePosRef.current.y;
 
        // Click is only allowed if target is currently visible (flashing)
        if (isTargetVisible && isPointInsideTarget(x, y, target.x, target.y, target.radius)) {
            if (flashTimeoutRef.current) {
                window.clearTimeout(flashTimeoutRef.current);
                flashTimeoutRef.current = null;
            }
            const reaction = now - target.spawnedAt;
            handleHitSuccess(target, reaction);
            return;
        }
 
        // Otherwise it is a miss
        engine.triggerMiss(config.missPenalty, x, y, target.x, target.y);
    };

    // Bind engine canvas
    useEffect(() => {
        engine.canvasRef.current = canvasRef.current;
    }, [engine]);

    const isCountingDown = engine.countdown !== null && engine.countdown > 0;
    const isLive = engine.phase === "live";
    const isFinished = engine.phase === "finished" && engine.result !== null;

    return (
        <div ref={engine.containerRef} className="relative w-full h-screen flex flex-col bg-[#0c0d12] text-[#EAEAEA] overflow-hidden">
            {isFinished && engine.result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={engine.result} onRestart={handleInitialize} onBackToMenu={engine.resetToMenu} />
                </div>
            )}

            {engine.phase === "menu" && (
                <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-black/50">
                    <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                        <div className="space-y-2">
                            <p className="text-[#00f0ff] text-sm font-bold tracking-[0.3em] uppercase">Sound-Spatialization Anchor</p>
                            <h2 className="text-4xl font-black tracking-widest uppercase text-white">Blind Flick</h2>
                            <p className="text-gray-400 text-sm">Flick to invisible targets using stereo panning audio cues. Targets flash for 150ms the moment you stop moving the mouse.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-left">
                                <div className="flex flex-col">
                                    <label className="text-gray-400 text-xs font-bold tracking-wider uppercase mb-2">Difficulty</label>
                                    <select
                                        value={difficulty}
                                        onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                                        className="bg-black/80 border border-white/20 p-3 rounded-lg text-white focus:border-[#00f0ff] outline-none transition-all cursor-pointer"
                                    >
                                        {Object.entries(difficultyLabels).map(([key, label]) => (
                                            <option key={key} value={key}>{label.toUpperCase()}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-gray-400 text-xs font-bold tracking-wider uppercase mb-2">Duration</label>
                                    <select
                                        value={engine.duration}
                                        onChange={(e) => engine.setDuration(Number(e.target.value))}
                                        className="bg-black/80 border border-white/20 p-3 rounded-lg text-white focus:border-[#00f0ff] outline-none transition-all cursor-pointer"
                                    >
                                        {!overrideSettings && <option value={15}>15s (Warmup)</option>}
                                        <option value={30}>30s (Standard)</option>
                                        {!overrideSettings && <option value={45}>45s (Extended)</option>}
                                        <option value={60}>60s (Endurance)</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleInitialize}
                                className="w-full px-12 py-5 bg-[#00f0ff] text-black text-lg font-black tracking-[0.2em] rounded-xl hover:bg-white transition-all shadow-[0_0_30px_rgba(0,240,255,0.3)]"
                            >
                                START SEQUENCE
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isCountingDown && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
                    <span className="text-[10rem] font-black text-[#00f0ff] animate-ping">{engine.countdown}</span>
                </div>
            )}

            {isLive && (
                <div className="relative flex flex-col w-full h-full z-20">
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10">
                        <SessionHUD
                            data={{
                                mode: "Blind Flicking",
                                difficulty: difficultyLabels[effectiveDifficulty],
                                timeLeft: engine.timeLeft,
                                score: engine.score,
                                hits: engine.hits,
                                misses: engine.misses,
                                accuracy,
                                averageReactionTime,
                                bestReactionTime,
                            }}
                        />
                    </div>

                    <div className="relative flex-1 w-full overflow-hidden bg-[#000000]">
                        <canvas
                            ref={canvasRef}
                            width={engine.dimensions.width}
                            height={engine.dimensions.height}
                            onMouseDown={handleCanvasMouseDown}
                            className="absolute inset-0 block cursor-none"
                        />
                        <ComboMeter combo={engine.combo} />
                        <StreakAnnouncer combo={engine.combo} />
                    </div>
                </div>
            )}
        </div>
    );
}
