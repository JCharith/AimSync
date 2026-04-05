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
    isPointInsideTarget
} from "@/lib/utils/gameMath";
import { createBurstTarget, getBurstSize } from "@/lib/utils/targetSpawning";
import { buildGameResult } from "@/lib/utils/resultBuilder";
import { updateStatsWithResult } from "@/lib/utils/statsService";
import { draw3DBackground, draw3DTarget, ParticleEngine } from "@/lib/utils/gameRendering";

import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface BurstReactionProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

// Extend BaseTarget to include the session check
type BurstTarget = BaseTarget & { sessionId: number };

export default function BurstReaction({ overrideSettings, onFinish }: BurstReactionProps = {}) {
    const { user } = useAuth();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const particleEngineRef = useRef<ParticleEngine>(new ParticleEngine());

    // BUG FIX: Track the active cluster session to prevent double-spawning next wave
    const clusterSessionId = useRef<number>(0);
    const targetsRef = useRef<BurstTarget[]>([]);
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

    const [combo, setCombo] = useState(0);
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

    const clearEngineTimers = () => {
        if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
        if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    };

    const spawnCluster = useCallback(() => {
        if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);

        // Generate a new Session ID for this specific burst
        const newSessionId = Date.now();
        clusterSessionId.current = newSessionId;

        const clusterSize = getBurstSize(difficulty) || 3;
        const newCluster: BurstTarget[] = [];

        for (let i = 0; i < clusterSize; i++) {
            let next = createBurstTarget(dimensionsRef.current.width, dimensionsRef.current.height, config.targetRadius);
            let attempts = 0;
            // Ensure no overlap within the cluster
            while (newCluster.some((t) => Math.hypot(t.x - next.x, t.y - next.y) < config.targetRadius * 2.5) && attempts < 15) {
                next = createBurstTarget(dimensionsRef.current.width, dimensionsRef.current.height, config.targetRadius);
                attempts++;
            }
            newCluster.push({ ...next, sessionId: newSessionId });
        }

        targetsRef.current = newCluster;
        setTotalTargetsSpawned((prev) => prev + clusterSize);

        const clusterLifetime = Math.max(800, config.targetLifetimeMs * 1.5);

        timeoutRef.current = window.setTimeout(() => {
            // Only process timeout if this is still the active session
            if (clusterSessionId.current === newSessionId) {
                const remaining = targetsRef.current.length;
                if (remaining > 0) {
                    targetsRef.current.forEach(t => particleEngineRef.current.spawnExplosion(t.x, t.y, t.radius, false));
                    setMisses((p) => p + remaining);
                    setMissedByTimeout((p) => p + remaining);
                    setCombo(0);
                    setScore((p) => Math.max(0, p - config.missPenalty * remaining));
                }
                targetsRef.current = [];
                // Delay before next spawn to prevent visual flickering
                window.setTimeout(() => spawnCluster(), 320);
            }
        }, clusterLifetime);
    }, [difficulty, config]);

    const resetState = () => {
        clearEngineTimers();
        clusterSessionId.current = 0;
        setGameStarted(false); setIsFinished(false); setTimeLeft(effectiveDuration); setCountdown(null);
        targetsRef.current = []; setCombo(0); setScore(0); setHits(0); setMisses(0);
        setReactionTimes([]); setTotalTargetsSpawned(0); setMissedByTimeout(0); setResult(null);
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
        clearEngineTimers();
        clusterSessionId.current = 0;
        setGameStarted(false);
        targetsRef.current = [];

        const resultData = buildGameResult({
            mode: "Burst Reaction",
            difficulty: difficultyLabels[effectiveDifficulty],
            score, hits, misses,
            duration: effectiveDuration,
            reactionTimes, totalTargetsSpawned,
            missedByTimeout,
            extraStats: { "Max Combo": combo, "Timeout Misses": missedByTimeout }
        });

        // Sync result to Firestore
        updateStatsWithResult(resultData);

        if (document.fullscreenElement) await document.exitFullscreen().catch(() => { });
        if (onFinish) { onFinish(resultData); } else { setResult(resultData); setIsFinished(true); }
    };

    const startRenderLoop = () => {
        if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
        const tick = () => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (canvas && ctx) {
                draw3DBackground(ctx, dimensionsRef.current.width, dimensionsRef.current.height);
                for (const t of targetsRef.current) {
                    draw3DTarget(ctx, t.x, t.y, t.radius, "emerald", performance.now());
                }
                particleEngineRef.current.updateAndDraw(ctx);
            }
            animationFrameRef.current = requestAnimationFrame(tick);
        };
        animationFrameRef.current = requestAnimationFrame(tick);
    };

    useEffect(() => {
        if (countdown === null) return;
        if (countdown === 0) {
            setCountdown(null);
            spawnCluster();
            return;
        }
        const timer = window.setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
        return () => window.clearTimeout(timer);
    }, [countdown, spawnCluster]);

    useEffect(() => {
        if (!gameStarted) return;
        const updateSize = () => {
            if (canvasRef.current?.parentElement) {
                const { clientWidth, clientHeight } = canvasRef.current.parentElement;
                dimensionsRef.current = { width: clientWidth, height: clientHeight };
                setRenderDimensions({ width: clientWidth, height: clientHeight });
            }
        };
        window.addEventListener("resize", updateSize); updateSize();
        return () => window.removeEventListener("resize", updateSize);
    }, [gameStarted]);

    useEffect(() => {
        if (!gameStarted || countdown !== null) return;
        const timer = window.setInterval(() => setTimeLeft((p) => Math.max(0, p - 1)), 1000);
        return () => window.clearInterval(timer);
    }, [gameStarted, countdown]);

    useEffect(() => {
        if (gameStarted && timeLeft === 0 && !isFinished && countdown === null) endSession();
    }, [timeLeft, gameStarted, isFinished, countdown]);

    const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        if (!gameStarted || targetsRef.current.length === 0 || (countdown !== null && countdown > 0)) return;

        const canvas = canvasRef.current; if (!canvas) return;
        addRipple(event.clientX, event.clientY);
        const { x, y } = getScaledCanvasCoordinates(event, canvas, dimensionsRef.current.width, dimensionsRef.current.height);

        let hitIndex = -1;
        for (let i = 0; i < targetsRef.current.length; i++) {
            const t = targetsRef.current[i];
            // BUG FIX: Only allow hits if target belongs to the current active session
            if (t.sessionId === clusterSessionId.current && isPointInsideTarget(x, y, t.x, t.y, t.radius)) {
                hitIndex = i;
                break;
            }
        }

        if (hitIndex !== -1) {
            const hitTarget = targetsRef.current[hitIndex];
            particleEngineRef.current.spawnExplosion(hitTarget.x, hitTarget.y, hitTarget.radius, true);
            const reaction = performance.now() - hitTarget.spawnedAt;
            const nextCombo = combo + 1;

            targetsRef.current.splice(hitIndex, 1);
            setHits((p) => p + 1);
            setCombo(nextCombo);
            setReactionTimes((p) => [...p, reaction]);
            setScore((p) => p + config.scorePerHit + nextCombo * 5);

            if (targetsRef.current.length === 0) {
                if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
                window.setTimeout(() => spawnCluster(), 250);
            }
            return;
        }
        setMisses((p) => p + 1); setCombo(0); setScore((p) => Math.max(0, p - config.missPenalty));
    };

    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-white overflow-hidden">
            {isFinished && result && (<div className="absolute inset-0 z-[100]"><ResultsScreen result={result} onRestart={startGame} onBackToMenu={resetState} /></div>)}
            {!gameStarted && !isFinished && (
                <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                    <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                        <div className="space-y-2">
                            <p className="text-orange-500 text-sm font-bold tracking-[0.3em] uppercase leading-none mb-1">AimSync Training</p>
                            <h2 className="text-5xl font-black tracking-widest uppercase">True Burst</h2>
                        </div>
                        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 justify-center pt-4">
                            <label className="flex flex-col text-left flex-1"><span className="text-gray-400 text-xs font-bold tracking-wider mb-2 uppercase">Difficulty</span>
                                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white outline-none">
                                    {Object.entries(difficultyLabels).map(([k, l]) => <option key={k} value={k}>{l.toUpperCase()}</option>)}
                                </select></label>
                            <label className="flex flex-col text-left flex-1"><span className="text-gray-400 text-xs font-bold tracking-wider mb-2 uppercase">Duration</span>
                                <select value={durationSeconds} onChange={(e) => setDurationSeconds(Number(e.target.value))} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white outline-none">
                                    <option value={15}>15s</option><option value={30}>30s</option><option value={60}>60s</option>
                                </select></label>
                        </div>
                        <button onClick={startGame} className="w-full mt-8 px-12 py-5 bg-white text-[#121212] text-lg font-black tracking-[0.2em] rounded-xl hover:bg-orange-500 hover:text-white transition-all uppercase">Initialize Sequence</button>
                    </div>
                </div>
            )}
            {gameStarted && (
                <div className="relative flex flex-col w-full h-full z-20">
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10 backdrop-blur-sm">
                        <SessionHUD data={{ mode: "True Burst", difficulty: difficultyLabels[difficulty], timeLeft, score, hits, misses, accuracy, averageReactionTime, bestReactionTime, extraLines: [{ label: "Multiplier", value: `${combo}x` }] }} />
                    </div>
                    <div className="relative flex-1 w-full overflow-hidden bg-black">
                        <canvas ref={canvasRef} width={renderDimensions.width} height={renderDimensions.height} onMouseDown={handleCanvasMouseDown} className="absolute inset-0 block cursor-crosshair" />
                        {ripples.map(r => (
                            <div key={r.id} className="fixed w-16 h-16 border-2 border-[#10B981] rounded-full animate-ping pointer-events-none z-50 origin-center" style={{ left: r.x - 32, top: r.y - 32 }} />
                        ))}
                        {countdown !== null && countdown > 0 && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                                <span key={countdown} className="text-[12rem] font-black text-orange-400 animate-ping drop-shadow-[0_0_60px_#F97316]">{countdown}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}