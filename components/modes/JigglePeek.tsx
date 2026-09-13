"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { BaseTarget, GameResult } from "@/lib/game/types";
import { difficultyConfig, difficultyLabels, getScaledRadius, type Difficulty } from "@/lib/utils/drillConfig";
import { calculateAccuracy, calculateAverageReactionTime, calculateBestReactionTime, getScaledCanvasCoordinates, isPointInsideTarget } from "@/lib/utils/gameMath";
import { useBaseGameEngine } from "@/lib/hooks/useBaseGameEngine";
import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";
import ComboMeter from "@/components/ComboMeter";
import StreakAnnouncer from "@/components/StreakAnnouncer";
import { spawnHitmarker } from "@/lib/utils/hitmarker";

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface JigglePeekProps {
    overrideSettings?: OverrideSettings;
    onFinish?: (res: GameResult) => void;
}

interface JiggleTarget extends BaseTarget {
    coverSide: "left" | "right";
    wallEdgeX: number;
    hiddenX: number;
    peekX: number;
    y: number;
    status: "hidden" | "peeking";
}

export default function JigglePeek({ overrideSettings, onFinish }: JigglePeekProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const sessionStartRef = useRef<number>(0);
    const lastClickTimeRef = useRef<number>(0);
    const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const effectiveDifficulty = overrideSettings?.difficulty ?? difficulty;

    const [target, setTarget] = useState<JiggleTarget | null>(null);
    const targetRef = useRef<JiggleTarget | null>(null);
    
    // Misfire notification state
    const [misfireWarning, setMisfireWarning] = useState<boolean>(false);
    const misfireTimeoutRef = useRef<number | null>(null);
    
    const peekTimerRef = useRef<number | null>(null);
    const hideTimerRef = useRef<number | null>(null);

    const engine = useBaseGameEngine({
        modeId: "jiggle-peek",
        overrideSettings,
        onSessionComplete: onFinish,
    });

    const config = difficultyConfig[effectiveDifficulty];
    const accuracy = calculateAccuracy(engine.hits, engine.misses);
    const averageReactionTime = calculateAverageReactionTime(engine.reactionTimes);
    const bestReactionTime = calculateBestReactionTime(engine.reactionTimes);

    const audioCtxRef = useRef<AudioContext | null>(null);

    const initAudio = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioCtxRef.current.state === "suspended") {
            audioCtxRef.current.resume();
        }
    };

    const playMisfireSound = () => {
        if (!audioCtxRef.current) return;
        const ctx = audioCtxRef.current;
        
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        // Low buzz saw error wave
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(110, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(70, ctx.currentTime + 0.18);

        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.22);
    };

    const playHitSound = () => {
        if (!audioCtxRef.current) return;
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);

        gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.12);
    };

    const triggerMisfire = () => {
        playMisfireSound();
        setMisfireWarning(true);
        engine.triggerMiss(config.missPenalty);
        
        if (misfireTimeoutRef.current) {
            window.clearTimeout(misfireTimeoutRef.current);
        }
        misfireTimeoutRef.current = window.setTimeout(() => {
            setMisfireWarning(false);
        }, 500);
    };

    // Cycle cleanups
    const clearTimers = () => {
        if (peekTimerRef.current) {
            window.clearTimeout(peekTimerRef.current);
            peekTimerRef.current = null;
        }
        if (hideTimerRef.current) {
            window.clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    };

    const spawnTarget = useCallback(() => {
        engine.clearAllTimersAndLoops();
        clearTimers();

        const currentSession = engine.sessionIdxRef.current;
        const width = engine.dimensions.width;
        const height = engine.dimensions.height;

        const side: "left" | "right" = Math.random() > 0.5 ? "left" : "right";
        const wallEdgeX = side === "left" ? width * 0.35 : width * 0.65;
        
        // Head-dot parameters
        const elapsedSec = (performance.now() - sessionStartRef.current) / 1000;
        const radius = getScaledRadius(config.targetRadius, effectiveDifficulty, elapsedSec, engine.duration);
        const y = height * 0.35 + Math.random() * (height * 0.3);

        const hiddenX = side === "left" ? wallEdgeX - (radius + 20) : wallEdgeX + (radius + 20);
        const peekX = side === "left" ? wallEdgeX + (radius + 25) : wallEdgeX - (radius + 25);

        const nextTarget: JiggleTarget = {
            id: Math.random().toString(),
            coverSide: side,
            wallEdgeX,
            hiddenX,
            peekX,
            x: hiddenX,
            y,
            radius,
            spawnedAt: performance.now(),
            status: "hidden"
        };

        const ttl = config.targetLifetimeMs || 800;
        (nextTarget as any).timeToLive = ttl;
        targetRef.current = nextTarget;
        setTarget(nextTarget);
        engine.incrementSpawned();

        // Queue first peek
        scheduleNextPeek(nextTarget, currentSession);

        // Target TTL timeout to unmount and register miss
        engine.addTimeout(() => {
            if (engine.sessionIdxRef.current !== currentSession) return;
            setTarget(null);
            targetRef.current = null;
            engine.incrementTimeoutMiss(config.missPenalty);
            spawnTarget();
        }, ttl);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config, effectiveDifficulty, engine.dimensions, engine.duration, engine.incrementSpawned, engine.incrementTimeoutMiss]);

    const scheduleNextPeek = (activeTarget: JiggleTarget, sessionIdx: number) => {
        const hideDuration = 800 + Math.random() * 1400; // randomized hidden time
        
        hideTimerRef.current = window.setTimeout(() => {
            if (engine.sessionIdxRef.current !== sessionIdx) return;
            
            // Transition target to peeking
            if (targetRef.current && targetRef.current.id === activeTarget.id) {
                const peekedTarget = {
                    ...targetRef.current,
                    status: "peeking" as const,
                    x: targetRef.current.peekX,
                    spawnedAt: performance.now()
                };
                targetRef.current = peekedTarget;
                setTarget(peekedTarget);

                // Target stays peeked for only 150ms
                peekTimerRef.current = window.setTimeout(() => {
                    if (engine.sessionIdxRef.current !== sessionIdx) return;

                    // Slide back to hidden if not hit
                    if (targetRef.current && targetRef.current.id === activeTarget.id && targetRef.current.status === "peeking") {
                        const hiddenTarget = {
                            ...targetRef.current,
                            status: "hidden" as const,
                            x: targetRef.current.hiddenX
                        };
                        targetRef.current = hiddenTarget;
                        setTarget(hiddenTarget);
                        
                        // Loop and schedule next peek
                        scheduleNextPeek(hiddenTarget, sessionIdx);
                    }
                }, 150);
            }
        }, hideDuration);
    };

    const handleInitialize = async () => {
        initAudio();
        setTarget(null);
        setMisfireWarning(false);
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

    useEffect(() => {
        return () => {
            clearTimers();
            if (misfireTimeoutRef.current) {
                window.clearTimeout(misfireTimeoutRef.current);
            }
        };
    }, []);

    // Canvas render loop
    useEffect(() => {
        if (engine.phase !== "live") return;

        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const width = engine.dimensions.width;
            const height = engine.dimensions.height;

            ctx.clearRect(0, 0, width, height);

            // 1. Draw 2.5D Background Grid
            ctx.fillStyle = "#111217";
            ctx.fillRect(0, 0, width, height);

            ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
            ctx.lineWidth = 1;
            
            // Horizontal perspective lines
            const lines = 12;
            for (let i = 0; i <= lines; i++) {
                const ratio = i / lines;
                const lineY = height * 0.4 + ratio * (height * 0.6);
                ctx.beginPath();
                ctx.moveTo(0, lineY);
                ctx.lineTo(width, lineY);
                ctx.stroke();
            }

            // Radial floors
            for (let i = 0; i <= 20; i++) {
                const xRatio = i / 20;
                ctx.beginPath();
                ctx.moveTo(width / 2, height * 0.4);
                ctx.lineTo(xRatio * width, height);
                ctx.stroke();
            }

            // Draw shadow vignette
            const vigGrad = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, width * 0.7);
            vigGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
            vigGrad.addColorStop(1, "rgba(5, 5, 10, 0.9)");
            ctx.fillStyle = vigGrad;
            ctx.fillRect(0, 0, width, height);

            // 2. Draw Peeking Head Target
            const activeTarget = targetRef.current;
            if (activeTarget) {
                // Glow layer
                ctx.shadowColor = "#ff3b70";
                ctx.shadowBlur = activeTarget.status === "peeking" ? 18 : 0;

                ctx.beginPath();
                ctx.arc(activeTarget.x, activeTarget.y, activeTarget.radius, 0, Math.PI * 2);
                ctx.fillStyle = "#ff3b70";
                ctx.fill();

                // Highlight inner
                ctx.beginPath();
                ctx.arc(activeTarget.x, activeTarget.y, activeTarget.radius * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = "#ffffff";
                ctx.fill();

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
            }

            // 3. Draw Cover Wall Pillar
            if (activeTarget) {
                const grad = ctx.createLinearGradient(
                    activeTarget.coverSide === "left" ? 0 : activeTarget.wallEdgeX, 0,
                    activeTarget.coverSide === "left" ? activeTarget.wallEdgeX : width, 0
                );
                
                if (activeTarget.coverSide === "left") {
                    grad.addColorStop(0, "#1f222d");
                    grad.addColorStop(0.85, "#2a2e3d");
                    grad.addColorStop(1, "#363b4e");
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, activeTarget.wallEdgeX, height);
                    
                    // Wall neon border trim
                    ctx.strokeStyle = "#ff3b70";
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(activeTarget.wallEdgeX, 0);
                    ctx.lineTo(activeTarget.wallEdgeX, height);
                    ctx.stroke();
                } else {
                    grad.addColorStop(0, "#363b4e");
                    grad.addColorStop(0.15, "#2a2e3d");
                    grad.addColorStop(1, "#1f222d");
                    ctx.fillStyle = grad;
                    ctx.fillRect(activeTarget.wallEdgeX, 0, width - activeTarget.wallEdgeX, height);

                    // Wall neon border trim
                    ctx.strokeStyle = "#ff3b70";
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(activeTarget.wallEdgeX, 0);
                    ctx.lineTo(activeTarget.wallEdgeX, height);
                    ctx.stroke();
                }
            }

            // 4. Draw Crosshair
            const mx = mousePosRef.current.x;
            const my = mousePosRef.current.y;
            ctx.strokeStyle = "#00f0ff";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(mx - 8, my);
            ctx.lineTo(mx + 8, my);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(mx, my - 8);
            ctx.lineTo(mx, my + 8);
            ctx.stroke();

            engine.addAnimationFrame(render);
        };

        engine.addAnimationFrame(render);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engine.phase]);

    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (engine.phase !== "live") return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const { x, y } = getScaledCanvasCoordinates(e, canvas, engine.dimensions.width, engine.dimensions.height, engine.mousePosRef.current);
        mousePosRef.current = { x, y };
    };

    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (engine.phase !== "live" || !target) return;

        const now = performance.now();
        if (now - lastClickTimeRef.current < 80) return;
        lastClickTimeRef.current = now;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const { x, y } = getScaledCanvasCoordinates(e, canvas, engine.dimensions.width, engine.dimensions.height, engine.mousePosRef.current);

        // Click while target is hidden -> MISFIRE!
        if (target.status === "hidden") {
            triggerMisfire();
            return;
        }

        // Target is peeking -> check overlapping hit
        if (target.status === "peeking") {
            if (isPointInsideTarget(x, y, target.x, target.y, target.radius)) {
                clearTimers();
                playHitSound();
                const reaction = now - target.spawnedAt;
                engine.triggerHit(reaction);
                engine.incrementScore(config.scorePerHit + (engine.combo * 5));
                spawnHitmarker(x, y);
                spawnTarget();
            } else {
                engine.triggerMiss(config.missPenalty);
            }
        }
    };

    // Bind engine canvas
    useEffect(() => {
        engine.canvasRef.current = canvasRef.current;
    }, [engine]);

    const isCountingDown = engine.countdown !== null && engine.countdown > 0;
    const isLive = engine.phase === "live";
    const isFinished = engine.phase === "finished" && engine.result !== null;

    return (
        <div ref={engine.containerRef} className="relative w-full h-screen flex flex-col bg-[#111217] text-[#EAEAEA] overflow-hidden">
            {isFinished && engine.result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={engine.result} onRestart={handleInitialize} onBackToMenu={engine.resetToMenu} />
                </div>
            )}

            {engine.phase === "menu" && (
                <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-black/50">
                    <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                        <div className="space-y-2">
                            <p className="text-[#ff3b70] text-sm font-bold tracking-[0.3em] uppercase">Reaction Discipline Simulator</p>
                            <h2 className="text-4xl font-black tracking-widest uppercase text-white">Jiggle Peek Duel</h2>
                            <p className="text-gray-400 text-sm">Targets peek out from wall corners for only 150ms. Shooting while target is hidden triggers misfire penalties. Refine pre-fire timings.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-left">
                                <div className="flex flex-col">
                                    <label className="text-gray-400 text-xs font-bold tracking-wider uppercase mb-2">Difficulty</label>
                                    <select
                                        value={difficulty}
                                        onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                                        className="bg-black/80 border border-white/20 p-3 rounded-lg text-white focus:border-[#ff3b70] outline-none transition-all cursor-pointer"
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
                                        className="bg-black/80 border border-white/20 p-3 rounded-lg text-white focus:border-[#ff3b70] outline-none transition-all cursor-pointer"
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
                                className="w-full px-12 py-5 bg-[#ff3b70] text-white text-lg font-black tracking-[0.2em] rounded-xl hover:bg-white hover:text-[#ff3b70] transition-all shadow-[0_0_30px_rgba(255,59,112,0.3)]"
                            >
                                COMMENCE DUEL
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isCountingDown && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
                    <span className="text-[10rem] font-black text-[#ff3b70] animate-ping">{engine.countdown}</span>
                </div>
            )}

            {misfireWarning && (
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[40] animate-bounce pointer-events-none">
                    <div className="bg-red-600/90 border border-red-500 px-6 py-3 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.55)]">
                        <span className="text-sm font-black tracking-widest text-white uppercase">MISFIRE!</span>
                    </div>
                </div>
            )}

            {isLive && (
                <div className="relative flex flex-col w-full h-full z-20">
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10">
                        <SessionHUD
                            data={{
                                mode: "Jiggle Peek Duel",
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
                            onMouseMove={handleCanvasMouseMove}
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
