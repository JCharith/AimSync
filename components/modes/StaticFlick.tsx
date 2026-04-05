"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { logoutUser } from "@/lib/auth";
import type { BaseTarget, GameResult } from "@/lib/game/types";
import { difficultyConfig, difficultyLabels, type Difficulty } from "@/lib/utils/drillConfig";
import {
    calculateAccuracy,
    calculateAverageReactionTime,
    calculateBestReactionTime,
    getScaledCanvasCoordinates,
    isPointInsideTarget,
} from "@/lib/utils/gameMath";
import { createStaticTarget } from "@/lib/utils/targetSpawning";
import { buildGameResult } from "@/lib/utils/resultBuilder";
import { updateStatsWithResult } from "@/lib/utils/statsService";
import { draw3DBackground, draw3DTarget, ParticleEngine } from "@/lib/utils/gameRendering";

import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface StaticFlickProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

export default function StaticFlick({ overrideSettings, onFinish }: StaticFlickProps = {}) {
    const { user, isLoggedIn } = useAuth();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const particleEngineRef = useRef<ParticleEngine>(new ParticleEngine());

    // BUG FIX: Atomic ID tracking to prevent double-spawns
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

    const [ripples, setRipples] = useState<{ id: number, x: number, y: number }[]>([]);
    const addRipple = useCallback((x: number, y: number) => {
        const id = Date.now();
        setRipples(p => [...p, { id, x, y }]);
        setTimeout(() => setRipples(p => p.filter(r => r.id !== id)), 600);
    }, []);

    const config = difficultyConfig[effectiveDifficulty];
    const accuracy = useMemo(() => calculateAccuracy(hits, misses), [hits, misses]);
    const averageReactionTime = useMemo(() => calculateAverageReactionTime(reactionTimes), [reactionTimes]);
    const bestReactionTime = useMemo(() => calculateBestReactionTime(reactionTimes), [reactionTimes]);

    const clearTargetTimeout = () => {
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const spawnTarget = useCallback(() => {
        clearTargetTimeout();

        // Generate a new unique ID for this specific spawn instance
        const newId = Date.now();
        activeTargetId.current = newId;

        const nextTarget = createStaticTarget(dimensionsRef.current.width, dimensionsRef.current.height, config.targetRadius);

        targetRef.current = { ...nextTarget, id: newId };
        setTotalTargetsSpawned((prev) => prev + 1);

        timeoutRef.current = window.setTimeout(() => {
            // Only process timeout if this is still the active target
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
    }, [config, dimensionsRef]);

    const resetState = () => {
        clearTargetTimeout();
        if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
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
        clearTargetTimeout();
        if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
        activeTargetId.current = 0;
        setGameStarted(false);
        targetRef.current = null;

        const resultData = buildGameResult({
            mode: "Static Flick",
            difficulty: difficultyLabels[effectiveDifficulty],
            score,
            hits,
            misses,
            duration: effectiveDuration,
            reactionTimes,
            totalTargetsSpawned,
            missedByTimeout,
            extraStats: { "Timeout Misses": missedByTimeout },
        });

        // SECURE SAVE: Pushes to Firestore under current user UID
        updateStatsWithResult(resultData);

        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => { });
        }

        if (onFinish) {
            onFinish(resultData);
        } else {
            setResult(resultData);
            setIsFinished(true);
        }
    };

    useEffect(() => {
        if (countdown === null) return;
        if (countdown === 0) {
            setCountdown(null);
            spawnTarget();
            return;
        }
        const timer = window.setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
        return () => window.clearTimeout(timer);
    }, [countdown, spawnTarget]);

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
        if (!gameStarted || countdown !== null) return;
        const timer = window.setInterval(() => {
            setTimeLeft((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [gameStarted, countdown]);

    useEffect(() => {
        if (gameStarted && timeLeft === 0 && !isFinished && countdown === null) endSession();
    }, [timeLeft, gameStarted, isFinished, countdown]);

    const startRenderLoop = () => {
        if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
        
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

    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        if (!gameStarted || !targetRef.current || (countdown !== null && countdown > 0)) return;

        // BUG FIX: Ignore clicks if the target ID doesn't match the current active ID
        if (targetRef.current.id !== activeTargetId.current) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        addRipple(event.clientX, event.clientY);

        const { x, y } = getScaledCanvasCoordinates(event, canvas, dimensionsRef.current.width, dimensionsRef.current.height);

        if (isPointInsideTarget(x, y, targetRef.current.x, targetRef.current.y, targetRef.current.radius)) {
            // Embody target explosion
            particleEngineRef.current.spawnExplosion(targetRef.current.x, targetRef.current.y, targetRef.current.radius, true);

            // Invalidate the ID immediately to prevent "double-hits"
            activeTargetId.current = 0;
            const reaction = performance.now() - targetRef.current.spawnedAt;
            setHits((prev) => prev + 1);
            setScore((prev) => prev + config.scorePerHit);
            setReactionTimes((prev) => [...prev, reaction]);
            spawnTarget();
        } else {
            // USER REQUEST: Shatter immediately on miss!
            particleEngineRef.current.spawnExplosion(targetRef.current.x, targetRef.current.y, targetRef.current.radius, false);
            activeTargetId.current = 0; // Destroy it
            setMisses((prev) => prev + 1);
            setScore((prev) => Math.max(0, prev - config.missPenalty));
            spawnTarget();
        }
    };

    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-[#EAEAEA] overflow-hidden">
            {isFinished && result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={result} onRestart={startGame} onBackToMenu={resetState} />
                </div>
            )}

            {!gameStarted && !isFinished && (
                <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                    <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                        <div className="space-y-2">
                            <p className="text-[#3366FF] text-sm font-bold tracking-[0.3em] uppercase">AimSync Protocol</p>
                            <h2 className="text-5xl font-black tracking-widest uppercase text-white">Static Flick</h2>
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
                        <button onClick={startGame} className="w-full mt-8 px-12 py-5 bg-white text-[#121212] text-lg font-black tracking-[0.2em] rounded-xl hover:bg-[#3366FF] hover:text-white transition-all">
                            INITIALIZE SEQUENCE
                        </button>
                    </div>
                </div>
            )}

            {gameStarted && (
                <div className="relative flex flex-col w-full h-full z-20">
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10 backdrop-blur-sm">
                        <SessionHUD
                            data={{
                                mode: "Static Flick",
                                difficulty: difficultyLabels[difficulty],
                                timeLeft,
                                score,
                                hits,
                                misses,
                                accuracy,
                                averageReactionTime,
                                bestReactionTime,
                                extraLines: [
                                    { label: "Spawned", value: totalTargetsSpawned },
                                    { label: "Timeouts", value: missedByTimeout },
                                ],
                            }}
                        />
                    </div>

                    <div className="relative flex-1 w-full overflow-hidden bg-black">
                        <canvas
                            ref={canvasRef}
                            width={renderDimensions.width}
                            height={renderDimensions.height}
                            onClick={handleCanvasClick}
                            className="absolute inset-0 block cursor-crosshair"
                        />
                        {ripples.map(r => (
                            <div key={r.id} className="fixed w-16 h-16 border-2 border-[#10B981] rounded-full animate-ping pointer-events-none z-50 origin-center" style={{ left: r.x - 32, top: r.y - 32 }} />
                        ))}

                        {countdown !== null && countdown > 0 && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                                <span key={countdown} className="text-[12rem] font-black text-[#3366FF] animate-ping drop-shadow-[0_0_60px_#3366FF]">
                                    {countdown}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}