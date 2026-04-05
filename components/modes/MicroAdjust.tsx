"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { BaseTarget, GameResult } from "@/lib/game/types";
import { difficultyConfig, difficultyLabels, type Difficulty } from "@/lib/utils/drillConfig";
import {
    calculateAccuracy,
    calculateAverageReactionTime,
    calculateBestReactionTime,
    getScaledCanvasCoordinates,
    isPointInsideTarget,
} from "@/lib/utils/gameMath";
import { createMicroAdjustTarget } from "@/lib/utils/targetSpawning";
import { buildGameResult } from "@/lib/utils/resultBuilder";
import { updateStatsWithResult } from "@/lib/utils/statsService";
import { draw3DBackground, draw3DTarget, ParticleEngine } from "@/lib/utils/gameRendering";

import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface MicroAdjustProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

export default function MicroAdjust({ overrideSettings, onFinish }: MicroAdjustProps = {}) {
    const { user, isLoggedIn } = useAuth();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const particleEngineRef = useRef<ParticleEngine>(new ParticleEngine());

    // BUG FIX: Atomic ID tracking for high-precision clicks
    const activeTargetId = useRef<number>(0);
    const targetRef = useRef<(Omit<BaseTarget, "id"> & { id: number }) | null>(null);
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

    const config = difficultyConfig[effectiveDifficulty];
    const microRadius = Math.max(10, Math.round(config.targetRadius * 0.65));

    const [ripples, setRipples] = useState<{ id: number, x: number, y: number }[]>([]);
    const addRipple = useCallback((x: number, y: number) => {
        const id = Date.now();
        setRipples(p => [...p, { id, x, y }]);
        setTimeout(() => setRipples(p => p.filter(r => r.id !== id)), 600);
    }, []);

    const accuracy = useMemo(() => calculateAccuracy(hits, misses), [hits, misses]);

    const clearEngineTimers = useCallback(() => {
        if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
        if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    }, []);

    const clearTargetTimeout = useCallback(() => {
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const spawnTarget = useCallback(() => {
        clearTargetTimeout();

        const newId = Date.now();
        activeTargetId.current = newId;

        const currentX = targetRef.current?.x;
        const currentY = targetRef.current?.y;

        const nextTarget = createMicroAdjustTarget(
            dimensionsRef.current.width,
            dimensionsRef.current.height,
            microRadius,
            currentX,
            currentY
        );

        targetRef.current = { ...nextTarget, id: newId };
        setTotalTargetsSpawned((prev) => prev + 1);

        timeoutRef.current = window.setTimeout(() => {
            if (activeTargetId.current === newId) {
                if (targetRef.current) {
                    particleEngineRef.current.spawnExplosion(targetRef.current.x, targetRef.current.y, targetRef.current.radius, false);
                }
                setMisses((prev) => prev + 1);
                setMissedByTimeout((prev) => prev + 1);
                setScore((prev) => Math.max(0, prev - config.missPenalty));
                spawnTarget();
            }
        }, config.targetLifetimeMs);
    }, [config, microRadius, clearTargetTimeout]);

    const resetState = () => {
        clearEngineTimers();
        activeTargetId.current = 0;
        setGameStarted(false);
        setIsFinished(false);
        setTimeLeft(effectiveDuration);
        setCountdown(null);
        targetRef.current = null;
        particleEngineRef.current.particles = [];
        setScore(0);
        setHits(0);
        setMisses(0);
        setReactionTimes([]);
        setTotalTargetsSpawned(0);
        setMissedByTimeout(0);
        setResult(null);
    };

    const startGame = async () => {
        resetState();
        setGameStarted(true);
        if (containerRef.current && !document.fullscreenElement) {
            await containerRef.current.requestFullscreen().catch(() => { });
        }
        startRenderLoop();
        setCountdown(3);
    };

    const endSession = async () => {
        clearEngineTimers();
        activeTargetId.current = 0;
        setGameStarted(false);
        targetRef.current = null;

        const resultData = buildGameResult({
            mode: "Micro Adjust",
            difficulty: difficultyLabels[effectiveDifficulty],
            score, hits, misses,
            duration: effectiveDuration,
            reactionTimes, totalTargetsSpawned,
            missedByTimeout,
            extraStats: { "Micro Radius": microRadius, "Timeout Misses": missedByTimeout },
        });

        updateStatsWithResult(resultData);

        if (document.fullscreenElement) await document.exitFullscreen().catch(() => { });
        if (onFinish) onFinish(resultData);
        else { setResult(resultData); setIsFinished(true); }
    };

    const startRenderLoop = () => {
        const tick = () => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (canvas && ctx) {
                draw3DBackground(ctx, dimensionsRef.current.width, dimensionsRef.current.height);

                const t = targetRef.current;
                if (t && t.id === activeTargetId.current) {
                    draw3DTarget(ctx, t.x, t.y, t.radius, "emerald", performance.now());
                }
                
                particleEngineRef.current.updateAndDraw(ctx);
            }
            animationFrameRef.current = requestAnimationFrame(tick);
        };
        animationFrameRef.current = requestAnimationFrame(tick);
    };

    useEffect(() => {
        if (countdown === 0) { setCountdown(null); spawnTarget(); }
        else if (countdown !== null) {
            const t = window.setTimeout(() => setCountdown(c => c! - 1), 1000);
            return () => window.clearTimeout(t);
        }
    }, [countdown, spawnTarget]);

    useEffect(() => {
        if (!gameStarted || countdown !== null) return;
        const t = window.setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
        return () => window.clearInterval(t);
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
    }, [timeLeft, gameStarted, isFinished]);

    const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        if (!gameStarted || !targetRef.current || (countdown !== null && countdown > 0)) return;

        if (targetRef.current.id !== activeTargetId.current) return;

        addRipple(event.clientX, event.clientY);

        const canvas = canvasRef.current;
        if (!canvas) return;

        const { x, y } = getScaledCanvasCoordinates(event, canvas, dimensionsRef.current.width, dimensionsRef.current.height);

        if (isPointInsideTarget(x, y, targetRef.current.x, targetRef.current.y, targetRef.current.radius)) {
            particleEngineRef.current.spawnExplosion(targetRef.current.x, targetRef.current.y, targetRef.current.radius, true);

            activeTargetId.current = 0;
            setHits((prev) => prev + 1);
            setReactionTimes((prev) => [...prev, performance.now() - targetRef.current!.spawnedAt]);
            setScore((prev) => prev + config.scorePerHit);
            spawnTarget();
        } else {
            // USER REQUEST: Shatter immediately on miss!
            particleEngineRef.current.spawnExplosion(targetRef.current.x, targetRef.current.y, targetRef.current.radius, false);
            activeTargetId.current = 0;
            setMisses((prev) => prev + 1);
            setScore((prev) => Math.max(0, prev - config.missPenalty));
            spawnTarget();
        }
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
                    <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                        <div className="space-y-2">
                            <p className="text-[#A855F7] text-sm font-bold tracking-[0.3em] uppercase">AimSync Protocol</p>
                            <h2 className="text-5xl font-black tracking-widest uppercase">Micro Adjust</h2>
                        </div>
                        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 justify-center pt-4">
                            <label className="flex flex-col text-left flex-1">
                                <span className="text-gray-400 text-xs font-bold tracking-wider mb-2 uppercase">Difficulty</span>
                                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white outline-none">
                                    {Object.entries(difficultyLabels)
                                        .filter(([key]) => isLoggedIn ? true : ["easy", "medium"].includes(key))
                                        .map(([key, label]) => (
                                        <option key={key} value={key}>{label.toUpperCase()}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="flex flex-col text-left flex-1">
                                <span className="text-gray-400 text-xs font-bold tracking-wider mb-2 uppercase">Duration</span>
                                <select value={durationSeconds} onChange={(e) => setDurationSeconds(Number(e.target.value))} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white outline-none">
                                    <option value={15}>15s</option>
                                    <option value={30}>30s</option>
                                    <option value={60}>60s</option>
                                </select>
                            </label>
                        </div>
                        <button onClick={startGame} className="w-full mt-8 px-12 py-5 bg-white text-[#121212] text-lg font-black tracking-[0.2em] rounded-xl hover:bg-[#A855F7] hover:text-white transition-all uppercase">
                            Initialize Sequence
                        </button>
                    </div>
                </div>
            )}

            {gameStarted && (
                <div className="relative flex flex-col w-full h-full z-20">
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10 backdrop-blur-sm">
                        <SessionHUD data={{ mode: "Micro Adjust", difficulty: difficultyLabels[difficulty], timeLeft, score, hits, misses, accuracy, averageReactionTime: calculateAverageReactionTime(reactionTimes), bestReactionTime: calculateBestReactionTime(reactionTimes) }} />
                    </div>
                    <div className="relative flex-1 w-full overflow-hidden bg-black">
                        <canvas ref={canvasRef} width={renderDimensions.width} height={renderDimensions.height} onMouseDown={handleCanvasMouseDown} className="absolute inset-0 block cursor-crosshair" />
                        {ripples.map(r => (
                            <div key={r.id} className="fixed w-16 h-16 border-2 border-[#10B981] rounded-full animate-ping pointer-events-none z-50 origin-center" style={{ left: r.x - 32, top: r.y - 32 }} />
                        ))}
                        {countdown !== null && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-[12rem] font-black text-[#A855F7] animate-ping">{countdown}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}