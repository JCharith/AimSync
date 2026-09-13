"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameResult, SwitchTarget } from "@/lib/game/types";
import { difficultyConfig, difficultyLabels, getScaledRadius, type Difficulty } from "@/lib/utils/drillConfig";
import {
    calculateAccuracy,
    calculateAverageReactionTime,
    calculateBestReactionTime,
    getScaledCanvasCoordinates,
    isPointInsideTarget,
} from "@/lib/utils/gameMath";
import { createTargetSwitchWave } from "@/lib/utils/targetSpawning";
import { buildGameResult } from "@/lib/utils/resultBuilder";
import { updateStatsWithResult } from "@/lib/utils/statsStorage";

import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";
import { spawnHitmarker } from "@/lib/utils/hitmarker";
import { useAuth } from "@/lib/contexts/AuthContext";
import ComboMeter from "@/components/ComboMeter";

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface TargetSwitchProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

export default function TargetSwitch({ overrideSettings, onFinish }: TargetSwitchProps = {}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const sessionIdxRef = useRef(0);
    const sessionStartRef = useRef<number>(0);
    const activeTargetId = useRef<string | null>(null);
    const lastClickTimeRef = useRef<number>(0);

    const dimensionsRef = useRef({ width: 1600, height: 900 });
    const [renderDimensions, setRenderDimensions] = useState({ width: 1600, height: 900 });

    const { isTrial } = useAuth();

    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const [durationSeconds, setDurationSeconds] = useState<number>(overrideSettings?.duration ?? 30);
    const effectiveDifficulty = overrideSettings?.difficulty ?? difficulty;
    const effectiveDuration = overrideSettings?.duration ?? durationSeconds;
    
    const [gameStarted, setGameStarted] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number>(30);
    const [countdown, setCountdown] = useState<number | null>(null);

    const [targets, setTargets] = useState<SwitchTarget[]>([]);
    
    const [score, setScore] = useState(0);
    const [hits, setHits] = useState(0);
    const [misses, setMisses] = useState(0);
    const [combo, setCombo] = useState(0);
    const [reactionTimes, setReactionTimes] = useState<number[]>([]);
    const [totalTargetsSpawned, setTotalTargetsSpawned] = useState(0);
    const [missedByTimeout, setMissedByTimeout] = useState(0);
    const [result, setResult] = useState<GameResult | null>(null);

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

    const spawnWave = () => {
        clearTargetTimeout();
        const currentSession = sessionIdxRef.current;
        
        const elapsedSec = (performance.now() - sessionStartRef.current) / 1000;
        const radius = getScaledRadius(config.targetRadius, effectiveDifficulty, elapsedSec, effectiveDuration);
        
        const ttl = config.targetLifetimeMs * 1.5;
        const wave = createTargetSwitchWave(effectiveDifficulty, dimensionsRef.current.width, dimensionsRef.current.height, radius, ttl);
        const correctTarget = wave.find(t => t.isCorrect);
        if (correctTarget) {
            activeTargetId.current = correctTarget.id;
        }
        setTargets(wave);
        setTotalTargetsSpawned((prev) => prev + 1);

        timeoutRef.current = window.setTimeout(() => {
            if (sessionIdxRef.current !== currentSession) return;
            
            setTargets([]);
            setMisses((prev) => prev + 1);
            setMissedByTimeout((prev) => prev + 1);
            setCombo(0);
            setScore((prev) => Math.max(0, prev - config.missPenalty));
            spawnWave();
        }, ttl);
    };

    const resetState = () => {
        sessionIdxRef.current++;
        clearTargetTimeout();
        lastClickTimeRef.current = 0;
        setGameStarted(false);
        setIsFinished(false);
        setTimeLeft(durationSeconds);
        setCountdown(null);
        setTargets([]);
        setScore(0);
        setHits(0);
        setMisses(0);
        setCombo(0);
        setReactionTimes([]);
        setTotalTargetsSpawned(0);
        setMissedByTimeout(0);
        setResult(null);
    };

    const startGame = async () => {
        resetState();
        setGameStarted(true);
        sessionStartRef.current = performance.now();
        if (containerRef.current && !document.fullscreenElement) {
            await containerRef.current.requestFullscreen().catch(() => { });
        }
        setCountdown(3);
    };

    const endSession = async () => {
        clearTargetTimeout();
        setGameStarted(false);
        setTargets([]);

        const resultData = buildGameResult({
            mode: "Target Switch",
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

        await updateStatsWithResult(resultData);

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

    // --- COUNTDOWN EFFECT ---
    useEffect(() => {
        if (countdown === null) return;
        if (countdown === 0) {
            setCountdown(null);
            spawnWave();
            return;
        }
        const timer = window.setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
        return () => window.clearTimeout(timer);
    }, [countdown]);

    // --- DYNAMIC RESOLUTION OBSERVER ---
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

    useEffect(() => { setTimeLeft(durationSeconds); }, [durationSeconds]);

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

    useEffect(() => {
        return () => clearTargetTimeout();
    }, []);

    // --- 3D ENGINE RENDERING (2D Fallback) ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);

        targets.forEach(target => {
            let colors = { inner: "#FFAAAA", mid: "#EF4444", outer: "#660000", shadow: "rgba(220, 38, 38, 0.6)" };
            if (!target.isCorrect) {
                colors = { inner: "#66b2ff", mid: "#004c99", outer: "#002244", shadow: "rgba(0, 76, 153, 0.6)" };
            }

            const gradient = ctx.createRadialGradient(
                target.x - target.radius * 0.3, target.y - target.radius * 0.3, target.radius * 0.1,
                target.x, target.y, target.radius
            );
            gradient.addColorStop(0, colors.inner);
            gradient.addColorStop(0.3, colors.mid);
            gradient.addColorStop(1, colors.outer);

            ctx.beginPath();
            ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.shadowColor = colors.shadow;
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 10;
            ctx.fill();
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        });
    }, [targets, renderDimensions]);

    const isCountingDown = countdown !== null && countdown > 0;

    const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        if (!gameStarted || isCountingDown) return;

        const now = performance.now();
        if (now - lastClickTimeRef.current < 80) return;
        lastClickTimeRef.current = now;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const { x, y } = getScaledCanvasCoordinates(event, canvas, dimensionsRef.current.width, dimensionsRef.current.height);

        let hitTarget: SwitchTarget | null = null;
        for (const t of targets) {
            if (isPointInsideTarget(x, y, t.x, t.y, t.radius)) {
                hitTarget = t;
                break;
            }
        }

        if (hitTarget) {
            if (hitTarget.isCorrect) {
                if (hitTarget.id !== activeTargetId.current) return;
                const reaction = performance.now() - hitTarget.spawnedAt;
                const nextCombo = combo + 1;
                setHits((prev) => prev + 1);
                setCombo(nextCombo);
                setScore((prev) => prev + config.scorePerHit + (nextCombo * 5));
                setReactionTimes((prev) => [...prev, reaction]);
                spawnHitmarker(event.clientX, event.clientY);
                spawnWave();
            } else {
                setScore((prev) => Math.max(0, prev - config.missPenalty * 2));
                setCombo(0);
                // Remove the decoy if clicked, or just penalize. Let's penalize and keep wave active.
                setTargets(prev => prev.filter(t => t.id !== hitTarget!.id));
            }
            return;
        }

        setMisses((prev) => prev + 1);
        setCombo(0);
        setScore((prev) => Math.max(0, prev - config.missPenalty));
        spawnWave();
    };

    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-[#EAEAEA] overflow-hidden">
            {isFinished && result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={result} onRestart={startGame} onBackToMenu={resetState} />
                </div>
            )}

            {!gameStarted && !isFinished && (
                <>
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-30 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
                    <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                        <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                            <div className="space-y-2">
                                <p className="text-[#1DB954] text-sm font-bold tracking-[0.3em] uppercase">AimSync Training</p>
                                <h2 className="text-5xl font-black tracking-widest uppercase text-white">Target Switch</h2>
                                <p className="text-gray-400 mt-2">Identify and eliminate the RED target hidden among BLUE decoys.</p>
                            </div>
                            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 justify-center pt-4">
                                <label className="flex flex-col text-left flex-1">
                                    <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DIFFICULTY</span>
                                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#1DB954] outline-none transition-all cursor-pointer">
                                        {Object.entries(difficultyLabels).map(([key, label]) => {
                                            const isLocked = isTrial && key !== "eco" && key !== "bonus";
                                            return (
                                                <option key={key} value={key} disabled={isLocked}>
                                                    {label.toUpperCase()}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </label>
                                <label className="flex flex-col text-left flex-1">
                                    <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DURATION</span>
                                    <select value={durationSeconds} onChange={(e) => setDurationSeconds(Number(e.target.value))} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#1DB954] outline-none transition-all cursor-pointer">
                                        {!overrideSettings && <option value={15} disabled={isTrial}>15s (Warmup)</option>}
                                        <option value={30}>30s (Standard)</option>
                                        {!overrideSettings && <option value={45}>45s (Extended)</option>}
                                        <option value={60} disabled={isTrial}>60s (Endurance)</option>
                                    </select>
                                </label>
                            </div>
                            <button onClick={startGame} className="w-full mt-8 px-12 py-5 bg-white text-[#121212] text-lg font-black tracking-[0.2em] rounded-xl hover:bg-[#1DB954] hover:text-white transition-all">
                                INITIALIZE SEQUENCE
                            </button>
                        </div>
                    </div>
                </>
            )}

            {gameStarted && (
                <div className="relative flex flex-col w-full h-full z-20">
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10 backdrop-blur-sm">
                        <SessionHUD
                            data={{
                                mode: "Target Switch",
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
                    <div className="relative flex-1 w-full overflow-hidden">
                        <div className="absolute inset-0 z-0 overflow-hidden bg-[#2f3b4c] perspective-[800px]">
                            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[#334155] bg-[linear-gradient(to_right,#00000033_2px,transparent_2px),linear-gradient(to_bottom,#00000033_2px,transparent_2px)] bg-[size:4rem_4rem] origin-center [transform:rotateX(60deg)]"></div>
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)] pointer-events-none"></div>
                        </div>

                        <div className="relative z-10 w-full h-full">
                            <canvas
                                ref={canvasRef}
                                width={renderDimensions.width}
                                height={renderDimensions.height}
                                onMouseDown={handleCanvasMouseDown}
                                className="absolute inset-0 block cursor-crosshair"
                            />
                            
                            <ComboMeter combo={combo} />
                        </div>

                        {isCountingDown && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                                <span key={countdown} className="text-[12rem] font-black text-[#1DB954] animate-ping leading-none select-none drop-shadow-[0_0_60px_#1DB954]">
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