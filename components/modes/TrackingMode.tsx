"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { GameResult, MovingTarget } from "@/lib/game/types";
import { difficultyConfig, difficultyLabels, type Difficulty } from "@/lib/utils/drillConfig";
import {
    calculateAccuracy,
    calculateAverageReactionTime,
    calculateBestReactionTime,
    getScaledCanvasCoordinates,
    isPointInsideTarget,
} from "@/lib/utils/gameMath";
import { createTrackingTarget, updateTrackingTargetPosition } from "@/lib/utils/targetSpawning";
import { buildGameResult } from "@/lib/utils/resultBuilder";
import { updateStatsWithResult } from "@/lib/utils/statsService";
import { draw3DBackground, draw3DTarget, ParticleEngine } from "@/lib/utils/gameRendering";

import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";

// Extend target type for atomic tracking
type TrueTrackingTarget = MovingTarget & { health: number; isBeingTracked: boolean; id: string };

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface TrackingModeProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

export default function TrackingMode({ overrideSettings, onFinish }: TrackingModeProps = {}) {
    const { user } = useAuth();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const animationFrameRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const particleEngineRef = useRef<ParticleEngine>(new ParticleEngine());

    // BUG FIX: Atomic ID tracking to synchronize movement and health logic
    const activeTargetId = useRef<string | null>(null);
    const targetRef = useRef<TrueTrackingTarget | null>(null);
    const mouseRef = useRef({ isFiring: false, x: 0, y: 0 });

    const dimensionsRef = useRef({ width: 1600, height: 900 });
    const [renderDimensions, setRenderDimensions] = useState({ width: 1600, height: 900 });

    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const [durationSeconds, setDurationSeconds] = useState<number>(overrideSettings?.duration ?? 30);
    const effectiveDifficulty = overrideSettings?.difficulty ?? difficulty;
    const effectiveDuration = overrideSettings?.duration ?? durationSeconds;

    const [gameStarted, setGameStarted] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number>(30);
    const [countdown, setCountdown] = useState<number | null>(null);

    const [score, setScore] = useState(0);
    const [hits, setHits] = useState(0);
    const [misses, setMisses] = useState(0);
    const [reactionTimes, setReactionTimes] = useState<number[]>([]);
    const [totalTargetsSpawned, setTotalTargetsSpawned] = useState(0);
    const [missedByTimeout, setMissedByTimeout] = useState(0);
    const [result, setResult] = useState<GameResult | null>(null);

    const [ripples, setRipples] = useState<{ id: number, x: number, y: number }[]>([]);
    const addRipple = useCallback((x: number, y: number) => {
        const id = Date.now();
        setRipples(p => [...p, { id, x, y }]);
        setTimeout(() => setRipples(p => p.filter(r => r.id !== id)), 600);
    }, []);

    const config = difficultyConfig[effectiveDifficulty];
    const accuracy = useMemo(() => calculateAccuracy(hits, misses), [hits, misses]);

    const clearAnimation = useCallback(() => {
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    }, []);

    const clearTargetTimeout = useCallback(() => {
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const spawnTarget = useCallback(() => {
        clearTargetTimeout();
        clearAnimation();

        // Generate atomic ID for the tracking target
        const newId = Date.now().toString();
        activeTargetId.current = newId;

        const baseTarget = createTrackingTarget(
            effectiveDifficulty,
            dimensionsRef.current.width,
            dimensionsRef.current.height,
            config.targetRadius
        );

        targetRef.current = {
            ...baseTarget,
            health: 100,
            isBeingTracked: false,
            id: newId
        };

        setTotalTargetsSpawned((prev) => prev + 1);
        startTrackingLoop();

        timeoutRef.current = window.setTimeout(() => {
            // Only timeout if this is still the active ID
            if (activeTargetId.current === newId) {
                if (targetRef.current) {
                    particleEngineRef.current.spawnExplosion(targetRef.current.x, targetRef.current.y, targetRef.current.radius, false);
                }
                setMisses((prev) => prev + 1);
                setMissedByTimeout((prev) => prev + 1);
                setScore((prev) => Math.max(0, prev - config.missPenalty));
                spawnTarget();
            }
        }, config.targetLifetimeMs + 1000);
    }, [effectiveDifficulty, config, clearAnimation, clearTargetTimeout]);

    const startTrackingLoop = () => {
        clearAnimation();
        let lastTime = performance.now();

        const tick = (currentTime: number) => {
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;

            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");

            if (canvas && ctx && targetRef.current) {
                const nextTarget = updateTrackingTargetPosition(targetRef.current, dimensionsRef.current.width, dimensionsRef.current.height);

                const { isFiring, x, y } = mouseRef.current;
                const isHit = isFiring && isPointInsideTarget(x, y, nextTarget.x, nextTarget.y, nextTarget.radius);

                let newHealth = targetRef.current.health;
                if (isHit) {
                    newHealth -= (deltaTime * 0.25);
                }

                // BUG FIX: Atomic check before kill-respawn
                if (newHealth <= 0 && targetRef.current.id === activeTargetId.current) {
                    particleEngineRef.current.spawnExplosion(targetRef.current.x, targetRef.current.y, targetRef.current.radius, true);
                    activeTargetId.current = null; // Invalidate immediately
                    targetRef.current = null;
                    setHits(h => h + 1);
                    setScore(s => s + config.scorePerHit + 50);
                    spawnTarget();
                    return;
                }

                targetRef.current = {
                    ...nextTarget,
                    health: newHealth,
                    isBeingTracked: isHit,
                    id: targetRef.current.id
                } as TrueTrackingTarget;

                draw3DBackground(ctx, dimensionsRef.current.width, dimensionsRef.current.height);

                const t = targetRef.current;
                
                if (t.isBeingTracked) {
                    // Spray particles continuously while tracking correctly
                    particleEngineRef.current.spawnTrail(t.x, t.y, t.radius, "#10B981");
                }
                
                draw3DTarget(ctx, t.x, t.y, t.radius, t.isBeingTracked ? "cyan" : "emerald", performance.now());
                particleEngineRef.current.updateAndDraw(ctx);
            }
            animationFrameRef.current = requestAnimationFrame(tick);
        };
        animationFrameRef.current = requestAnimationFrame(tick);
    };

    const resetState = () => {
        clearAnimation();
        clearTargetTimeout();
        activeTargetId.current = null;
        setGameStarted(false);
        setIsFinished(false);
        setTimeLeft(effectiveDuration);
        setCountdown(null);
        targetRef.current = null;
        mouseRef.current = { isFiring: false, x: 0, y: 0 };
        setScore(0);
        setHits(0);
        setMisses(0);
        setReactionTimes([]);
        setTotalTargetsSpawned(0);
        setMissedByTimeout(0);
        setResult(null);
        particleEngineRef.current.particles = [];
    };

    const startGame = async () => {
        resetState();
        setGameStarted(true);
        if (containerRef.current && !document.fullscreenElement) {
            await containerRef.current.requestFullscreen().catch(() => { });
        }
        setCountdown(3);
    };

    const endSession = useCallback(async () => {
        clearAnimation();
        clearTargetTimeout();
        activeTargetId.current = null;
        setGameStarted(false);
        targetRef.current = null;

        const resultData = buildGameResult({
            mode: "Tracking Protocol",
            difficulty: difficultyLabels[effectiveDifficulty],
            score, hits, misses,
            duration: effectiveDuration,
            reactionTimes, totalTargetsSpawned,
            missedByTimeout,
            extraStats: { "Timeout Misses": missedByTimeout },
        });

        // Push telemetry to Firestore
        updateStatsWithResult(resultData);

        if (document.fullscreenElement) await document.exitFullscreen().catch(() => { });
        if (onFinish) onFinish(resultData);
        else { setResult(resultData); setIsFinished(true); }
    }, [hits, misses, score, effectiveDifficulty, effectiveDuration, reactionTimes, totalTargetsSpawned, missedByTimeout, onFinish, clearAnimation, clearTargetTimeout]);

    useEffect(() => {
        if (countdown === 0) { setCountdown(null); spawnTarget(); }
        else if (countdown !== null) {
            const timer = window.setTimeout(() => setCountdown(c => c! - 1), 1000);
            return () => window.clearTimeout(timer);
        }
    }, [countdown, spawnTarget]);

    useEffect(() => {
        if (!gameStarted || countdown !== null) return;
        const timer = window.setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
        return () => window.clearInterval(timer);
    }, [gameStarted, countdown]);

    useEffect(() => {
        if (!gameStarted) return;
        const updateSize = () => {
            if (canvasRef.current && canvasRef.current.parentElement) {
                const { clientWidth, clientHeight } = canvasRef.current.parentElement;
                dimensionsRef.current = { width: clientWidth, height: clientHeight };
                setRenderDimensions({ width: clientWidth, height: clientHeight });
            }
        };
        window.addEventListener("resize", updateSize);
        updateSize();
        return () => window.removeEventListener("resize", updateSize);
    }, [gameStarted]);

    useEffect(() => {
        if (gameStarted && timeLeft === 0 && !isFinished) endSession();
    }, [timeLeft, gameStarted, isFinished, endSession]);

    useEffect(() => () => { clearAnimation(); clearTargetTimeout(); }, [clearAnimation, clearTargetTimeout]);

    const updateMousePosition = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current) return;
        const { x, y } = getScaledCanvasCoordinates(event, canvasRef.current, dimensionsRef.current.width, dimensionsRef.current.height);
        mouseRef.current.x = x;
        mouseRef.current.y = y;
    };

    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-white overflow-hidden">
            {isFinished && result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={result} onRestart={startGame} onBackToMenu={resetState} />
                </div>
            )}

            {!gameStarted && !isFinished && (
                <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                    <div className="w-full max-w-2xl text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                        <p className="text-[#3366FF] text-sm font-bold tracking-[0.3em] uppercase mb-2">AimSync Protocol</p>
                        <h2 className="text-5xl font-black tracking-widest uppercase">Tracking Mode</h2>
                        <button onClick={startGame} className="w-full mt-8 px-12 py-5 bg-white text-[#121212] text-lg font-black tracking-[0.2em] rounded-xl hover:bg-[#3366FF] hover:text-white transition-all uppercase">
                            Initialize Sequence
                        </button>
                    </div>
                </div>
            )}

            {gameStarted && (
                <div className="relative flex flex-col w-full h-full z-20">
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10 backdrop-blur-sm">
                        <SessionHUD data={{ mode: "Tracking Protocol", difficulty: difficultyLabels[difficulty], timeLeft, score, hits, misses, accuracy: calculateAccuracy(hits, misses), averageReactionTime: calculateAverageReactionTime(reactionTimes), bestReactionTime: calculateBestReactionTime(reactionTimes) }} />
                    </div>
                    <div className="relative flex-1 w-full overflow-hidden bg-black">
                        <canvas
                            ref={canvasRef}
                            width={renderDimensions.width}
                            height={renderDimensions.height}
                            onMouseDown={(e) => { 
                                if (!countdown) { 
                                    mouseRef.current.isFiring = true; 
                                    updateMousePosition(e); 
                                    addRipple(e.clientX, e.clientY);
                                } 
                            }}
                            onMouseUp={() => { mouseRef.current.isFiring = false; }}
                            onMouseMove={updateMousePosition}
                            onMouseLeave={() => { mouseRef.current.isFiring = false; }}
                            className="absolute inset-0 block cursor-crosshair"
                        />
                        {ripples.map(r => (
                            <div key={r.id} className="fixed w-16 h-16 border-2 border-[#10B981] rounded-full animate-ping pointer-events-none z-50 origin-center" style={{ left: r.x - 32, top: r.y - 32 }} />
                        ))}
                        {countdown !== null && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-[12rem] font-black text-[#3366FF] animate-ping">{countdown}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}