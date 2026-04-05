"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { GameResult, SwitchTarget } from "@/lib/game/types";
import { difficultyConfig, difficultyLabels, type Difficulty } from "@/lib/utils/drillConfig";
import { calculateAccuracy, calculateAverageReactionTime, calculateBestReactionTime, getScaledCanvasCoordinates, isPointInsideTarget } from "@/lib/utils/gameMath";
import { createTargetSwitchWave } from "@/lib/utils/targetSpawning";
import { buildGameResult } from "@/lib/utils/resultBuilder";
import { updateStatsWithResult } from "@/lib/utils/statsService";
import { draw3DBackground, draw3DTarget, ParticleEngine } from "@/lib/utils/gameRendering";

import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface TargetSwitchProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

export default function TargetSwitch({ overrideSettings, onFinish }: TargetSwitchProps = {}) {
    const { user } = useAuth();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const particleEngineRef = useRef<ParticleEngine>(new ParticleEngine());

    // BUG FIX: Atomic Wave ID tracking to prevent double-spawns
    const activeWaveId = useRef<number>(0);
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

    const [targets, setTargets] = useState<(SwitchTarget & { waveId: number })[]>([]);
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

    const clearWaveTimeout = useCallback(() => {
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const spawnWave = useCallback(() => {
        clearWaveTimeout();

        const newWaveId = Date.now();
        activeWaveId.current = newWaveId;

        const wave = createTargetSwitchWave(effectiveDifficulty, dimensionsRef.current.width, dimensionsRef.current.height, config.targetRadius);

        // Tag every target in this wave with the new ID
        setTargets(wave.map(t => ({ ...t, waveId: newWaveId })));
        setTotalTargetsSpawned((prev) => prev + wave.length);

        timeoutRef.current = window.setTimeout(() => {
            if (activeWaveId.current === newWaveId) {
                if (targets.length > 0) {
                    targets.forEach(t => particleEngineRef.current.spawnExplosion(t.x, t.y, t.radius, false));
                }
                setMisses((prev) => prev + 1);
                setMissedByTimeout((prev) => prev + 1);
                setScore((prev) => Math.max(0, prev - config.missPenalty));
                spawnWave();
            }
        }, config.targetLifetimeMs);
    }, [effectiveDifficulty, config, clearWaveTimeout]);

    const resetState = () => {
        clearWaveTimeout();
        if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
        activeWaveId.current = 0;
        setGameStarted(false); setIsFinished(false); setTimeLeft(effectiveDuration); setCountdown(null);
        setTargets([]); setScore(0); setHits(0); setMisses(0); setReactionTimes([]);
        setTotalTargetsSpawned(0); setMissedByTimeout(0); setResult(null);
        particleEngineRef.current.particles = [];
    };

    const startGame = async () => {
        resetState();
        setGameStarted(true);
        if (containerRef.current && !document.fullscreenElement) await containerRef.current.requestFullscreen().catch(() => { });
        startRenderLoop();
        setCountdown(3);
    };

    const endSession = async () => {
        clearWaveTimeout();
        if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
        activeWaveId.current = 0;
        setGameStarted(false);
        setTargets([]);

        const resultData = buildGameResult({
            mode: "Target Switch",
            difficulty: difficultyLabels[effectiveDifficulty],
            score, hits, misses,
            duration: effectiveDuration,
            reactionTimes, totalTargetsSpawned,
            missedByTimeout,
            extraStats: { "Wave Targets Spawned": totalTargetsSpawned }
        });

        updateStatsWithResult(resultData);

        if (document.fullscreenElement) await document.exitFullscreen().catch(() => { });
        if (onFinish) { onFinish(resultData); } else { setResult(resultData); setIsFinished(true); }
    };

    useEffect(() => {
        if (countdown === 0) { setCountdown(null); spawnWave(); }
        else if (countdown !== null) {
            const timer = window.setTimeout(() => setCountdown((c) => c! - 1), 1000);
            return () => window.clearTimeout(timer);
        }
    }, [countdown, spawnWave]);

    useEffect(() => {
        if (!gameStarted) return;
        const updateSize = () => { if (canvasRef.current?.parentElement) { const { clientWidth, clientHeight } = canvasRef.current.parentElement; dimensionsRef.current = { width: clientWidth, height: clientHeight }; setRenderDimensions({ width: clientWidth, height: clientHeight }); } };
        window.addEventListener("resize", updateSize); updateSize();
        return () => window.removeEventListener("resize", updateSize);
    }, [gameStarted]);

    useEffect(() => {
        if (!gameStarted || countdown !== null) return;
        const timer = window.setInterval(() => setTimeLeft((prev) => Math.max(0, prev - 1)), 1000);
        return () => window.clearInterval(timer);
    }, [gameStarted, countdown]);

    useEffect(() => {
        if (gameStarted && timeLeft === 0 && !isFinished) endSession();
    }, [timeLeft, gameStarted, isFinished, endSession]);

    const startRenderLoop = () => {
        if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);

        const tick = () => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (canvas && ctx) {
                draw3DBackground(ctx, dimensionsRef.current.width, dimensionsRef.current.height);
                for (const t of targets) {
                    if (t.waveId === activeWaveId.current) {
                        draw3DTarget(ctx, t.x, t.y, t.radius, t.isCorrect ? "emerald" : "red", performance.now());
                    }
                }
                particleEngineRef.current.updateAndDraw(ctx);
            }
            animationFrameRef.current = requestAnimationFrame(tick);
        };
        animationFrameRef.current = requestAnimationFrame(tick);
    };

    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        if (!gameStarted || (countdown !== null && countdown > 0)) return;

        const canvas = canvasRef.current; if (!canvas) return;
        
        addRipple(event.clientX, event.clientY);
        
        const { x, y } = getScaledCanvasCoordinates(event, canvas, dimensionsRef.current.width, dimensionsRef.current.height);

        let clicked = null;
        for (const t of targets) {
            if (isPointInsideTarget(x, y, t.x, t.y, t.radius)) {
                // BUG FIX: Verify the target belongs to the active wave
                if (t.waveId === activeWaveId.current) {
                    clicked = t;
                    break;
                }
            }
        }

        if (!clicked) {
            setMisses((p) => p + 1);
            setScore((p) => Math.max(0, p - config.missPenalty));
            return;
        }

        if (clicked.isCorrect) {
            particleEngineRef.current.spawnExplosion(clicked.x, clicked.y, clicked.radius, true);
            activeWaveId.current = 0; // Lock wave immediately
            const reaction = performance.now() - clicked.spawnedAt;
            setHits((p) => p + 1);
            setScore((p) => p + config.scorePerHit);
            setReactionTimes((p) => [...p, reaction]);
            spawnWave();
        } else {
            // Shatter immediately and remove the target from the array
            particleEngineRef.current.spawnExplosion(clicked.x, clicked.y, clicked.radius, false);
            setTargets((prev) => prev.filter((t) => t.id !== clicked!.id));
            setMisses((p) => p + 1);
            setScore((p) => Math.max(0, p - config.missPenalty));
        }
    };

    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-white overflow-hidden">
            {isFinished && result && (<div className="absolute inset-0 z-[100]"><ResultsScreen result={result} onRestart={startGame} onBackToMenu={resetState} /></div>)}
            {!gameStarted && !isFinished && (
                <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                    <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                        <div className="space-y-2">
                            <p className="text-emerald-500 text-sm font-bold tracking-[0.3em] uppercase leading-none mb-1">AimSync Protocol</p>
                            <h2 className="text-5xl font-black tracking-widest uppercase">Target Switch</h2>
                        </div>
                        <button onClick={startGame} className="w-full mt-8 px-12 py-5 bg-white text-[#121212] text-lg font-black tracking-[0.2em] rounded-xl hover:bg-emerald-500 hover:text-white transition-all uppercase">Initialize Sequence</button>
                    </div>
                </div>
            )}
            {gameStarted && (
                <div className="relative flex flex-col w-full h-full z-20">
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10 backdrop-blur-sm">
                        <SessionHUD data={{ mode: "Target Switch", difficulty: difficultyLabels[difficulty], timeLeft, score, hits, misses, accuracy: calculateAccuracy(hits, misses), averageReactionTime: calculateAverageReactionTime(reactionTimes), bestReactionTime: calculateBestReactionTime(reactionTimes), extraLines: [{ label: "Timeouts", value: missedByTimeout }] }} />
                    </div>
                    <div className="relative flex-1 w-full overflow-hidden bg-black">
                        <canvas ref={canvasRef} width={renderDimensions.width} height={renderDimensions.height} onClick={handleCanvasClick} className="absolute inset-0 block cursor-crosshair" />
                        {ripples.map(r => (
                            <div key={r.id} className="fixed w-16 h-16 border-2 border-[#10B981] rounded-full animate-ping pointer-events-none z-50 origin-center" style={{ left: r.x - 32, top: r.y - 32 }} />
                        ))}
                        {countdown !== null && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                                <span className="text-[12rem] font-black text-emerald-400 animate-ping">{countdown}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}