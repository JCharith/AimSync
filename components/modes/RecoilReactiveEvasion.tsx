"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRecoil } from "@/hooks/UseRecoil";
import ComboMeter from "@/components/ComboMeter";
import { WeaponStats } from "@/lib/utils/AssetManager";
import { difficultyConfig, difficultyLabels, type Difficulty } from "@/lib/utils/drillConfig";
import ResultsScreen from "@/components/ResultsScreen";
import type { GameResult } from "@/lib/game/types";
import { spawnHitmarker } from "@/lib/utils/hitmarker";
import { useBaseGameEngine } from "@/lib/hooks/useBaseGameEngine";

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface RecoilReactiveEvasionProps {
    overrideSettings?: OverrideSettings;
    onFinish: (result: GameResult) => void;
}

const MOCK_RIFLE: WeaponStats = {
    id: "ar-01",
    name: "Assault Rifle",
    type: "rifle",
    gameStyle: "cs2",
    magSize: 30,
    fireRate: 10,
    firstShotSpread: 0.1,
    audioProfile: "heavy",
};

export default function RecoilReactiveEvasion({ overrideSettings, onFinish }: RecoilReactiveEvasionProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const effectiveDifficulty = overrideSettings?.difficulty ?? difficulty;

    const engine = useBaseGameEngine({
        modeId: "recoil-evasion",
        overrideSettings,
        onSessionComplete: onFinish,
    });

    const { startFiring, stopFiring, getShotTrajectory } = useRecoil(MOCK_RIFLE);
    const config = difficultyConfig[effectiveDifficulty];

    const isFiringInternal = useRef(false);
    const lockOnTime = useRef(0);
    const lastMissTime = useRef(0);

    // Camera state
    const cameraPitch = useRef(0);
    const cameraYaw = useRef(0);

    // Target state in 3D
    const targetPos = useRef({ x: 0, y: 0, z: 15 });
    const targetWander = useRef({ angle: 0, speed: 1.5 });
    const evasionVel = useRef({ x: 0, y: 0 });

    const keys = useRef<{ [key: string]: boolean }>({});

    const handleKeyDown = useCallback((e: KeyboardEvent) => { keys.current[e.code] = true; }, []);
    const handleKeyUp = useCallback((e: KeyboardEvent) => { keys.current[e.code] = false; }, []);

    const handleMouseDown = useCallback((e: MouseEvent) => {
        if (e.button === 0 && engine.phase === "live") {
            startFiring();
            isFiringInternal.current = true;
        }
    }, [startFiring, engine.phase]);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (e.button === 0) {
            stopFiring();
            isFiringInternal.current = false;
        }
    }, [stopFiring]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (engine.phase !== "live") return;
        const sens = 0.002;
        cameraYaw.current -= e.movementX * sens;
        cameraPitch.current -= e.movementY * sens;
        cameraPitch.current = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, cameraPitch.current));
    }, [engine.phase]);

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        window.addEventListener("mousedown", handleMouseDown);
        window.addEventListener("mouseup", handleMouseUp);

        const canvas = canvasRef.current;
        if (canvas) {
            document.addEventListener("mousemove", handleMouseMove);
        }

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            window.removeEventListener("mousedown", handleMouseDown);
            window.removeEventListener("mouseup", handleMouseUp);
            document.removeEventListener("mousemove", handleMouseMove);
        };
    }, [handleKeyDown, handleKeyUp, handleMouseDown, handleMouseUp, handleMouseMove]);

    const rotate3D = (x: number, y: number, z: number, pitch: number, yaw: number) => {
        const cosY = Math.cos(yaw);
        const sinY = Math.sin(yaw);
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;

        const cosP = Math.cos(pitch);
        const sinP = Math.sin(pitch);
        const y2 = y * cosP - z1 * sinP;
        const z2 = y * sinP + z1 * cosP;

        return { x: x1, y: y2, z: z2 };
    };

    const projectToScreen = (x: number, y: number, z: number, width: number, height: number) => {
        if (z <= 0) return null;
        const fov = 800;
        const scale = fov / z;
        return {
            x: width / 2 + x * scale,
            y: height / 2 + y * scale,
            scale,
        };
    };

    // Render loop
    useEffect(() => {
        if (engine.phase !== "live") return;

        let lastTime = performance.now();

        const tick = (currentTime: number) => {
            if (!engine.isMountedRef.current || engine.phase !== "live") return;
            const deltaTime = (currentTime - lastTime) / 1000;
            lastTime = currentTime;

            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const width = canvas.width;
            const height = canvas.height;

            // Recoil trajectory
            const recoil = getShotTrajectory();
            const kickX = recoil.kickX || 0;
            const kickY = recoil.kickY || 0;

            if (document.pointerLockElement === canvas) {
                cameraPitch.current += kickY * deltaTime * 10;
                cameraYaw.current += kickX * deltaTime * 10;
            }

            // Target evasion
            const kickMagnitude = Math.sqrt(kickX ** 2 + kickY ** 2);
            const movementMultiplier = effectiveDifficulty === "easy" ? 0.5 : effectiveDifficulty === "medium" ? 1.0 : 1.5;

            if (kickMagnitude > 0.05) {
                evasionVel.current.y += kickY * 25 * deltaTime * movementMultiplier;
                evasionVel.current.x -= kickX * 45 * deltaTime * movementMultiplier;
            } else {
                evasionVel.current.x *= 0.95;
                evasionVel.current.y *= 0.95;
            }

            // Autonomous wandering
            targetWander.current.angle += deltaTime * 1.5 * movementMultiplier;
            const wanderX = Math.cos(targetWander.current.angle) * targetWander.current.speed * movementMultiplier;
            const wanderY = Math.sin(targetWander.current.angle * 0.7) * targetWander.current.speed * movementMultiplier;

            targetPos.current.x += (evasionVel.current.x + wanderX) * deltaTime;
            targetPos.current.y += (evasionVel.current.y + wanderY) * deltaTime;

            const bound = 8;
            if (Math.abs(targetPos.current.x) > bound) {
                targetPos.current.x = Math.sign(targetPos.current.x) * bound;
                evasionVel.current.x *= -0.5;
            }
            if (Math.abs(targetPos.current.y) > bound) {
                targetPos.current.y = Math.sign(targetPos.current.y) * bound;
                evasionVel.current.y *= -0.5;
            }

            ctx.clearRect(0, 0, width, height);

            // Draw Background Grid
            ctx.lineWidth = 1;
            for (let i = -10; i <= 10; i++) {
                const p1 = rotate3D(-10, i, 20, cameraPitch.current, cameraYaw.current);
                const p2 = rotate3D(10, i, 20, cameraPitch.current, cameraYaw.current);
                const s1 = projectToScreen(p1.x, p1.y, p1.z, width, height);
                const s2 = projectToScreen(p2.x, p2.y, p2.z, width, height);

                if (s1 && s2) {
                    const alpha = Math.max(0.05, 1 - (p1.z / 35));
                    ctx.strokeStyle = `rgba(50, 50, 50, ${alpha})`;
                    ctx.beginPath();
                    ctx.moveTo(s1.x, s1.y);
                    ctx.lineTo(s2.x, s2.y);
                    ctx.stroke();
                }

                const vp1 = rotate3D(i, -10, 20, cameraPitch.current, cameraYaw.current);
                const vp2 = rotate3D(i, 10, 20, cameraPitch.current, cameraYaw.current);
                const vs1 = projectToScreen(vp1.x, vp1.y, vp1.z, width, height);
                const vs2 = projectToScreen(vp2.x, vp2.y, vp2.z, width, height);

                if (vs1 && vs2) {
                    const alpha = Math.max(0.05, 1 - (vp1.z / 35));
                    ctx.strokeStyle = `rgba(50, 50, 50, ${alpha})`;
                    ctx.beginPath();
                    ctx.moveTo(vs1.x, vs1.y);
                    ctx.lineTo(vs2.x, vs2.y);
                    ctx.stroke();
                }
            }

            // Project and draw target
            const relPos = rotate3D(targetPos.current.x, targetPos.current.y, targetPos.current.z, cameraPitch.current, cameraYaw.current);
            const screenPos = projectToScreen(relPos.x, relPos.y, relPos.z, width, height);
            const targetSizeScaled = config.targetRadius / 30;

            if (screenPos) {
                const radius = targetSizeScaled * screenPos.scale;

                // Glow
                const grad = ctx.createRadialGradient(screenPos.x, screenPos.y, 0, screenPos.x, screenPos.y, radius * 1.5);
                grad.addColorStop(0, "rgba(239, 68, 68, 0.4)");
                grad.addColorStop(1, "transparent");
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(screenPos.x, screenPos.y, radius * 1.5, 0, Math.PI * 2);
                ctx.fill();

                // Core
                ctx.fillStyle = "#ef4444";
                ctx.beginPath();
                ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = "#fff";
                ctx.font = "10px Space Grotesk";
                ctx.textAlign = "center";
                ctx.fillText("EVASIVE_HOSTILE", screenPos.x, screenPos.y - radius - 10);
            }

            // Hit Detection
            if (document.pointerLockElement === canvas && isFiringInternal.current) {
                const centerX = width / 2;
                const centerY = height / 2;

                const spreadScale = 1000;
                const shotX = centerX + recoil.offsetX * spreadScale;
                const shotY = centerY + recoil.offsetY * spreadScale;

                if (screenPos) {
                    const dx = shotX - screenPos.x;
                    const dy = shotY - screenPos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const radius = targetSizeScaled * screenPos.scale;

                    if (dist < radius) {
                        lockOnTime.current += deltaTime;
                        if (lockOnTime.current >= 0.1) {
                            engine.triggerHit(0);
                            engine.incrementScore(config.scorePerHit || 10);
                            lockOnTime.current -= 0.1;
                            spawnHitmarker(width / 2, height / 2);
                        }

                        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
                        ctx.beginPath();
                        ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        lockOnTime.current = 0;
                        if (currentTime - lastMissTime.current > 100) {
                            engine.triggerMiss(config.missPenalty);
                            lastMissTime.current = currentTime;
                        }
                    }
                }
            }

            // Draw Crosshair
            ctx.strokeStyle = "#00ff00";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(width / 2 - 10, height / 2);
            ctx.lineTo(width / 2 + 10, height / 2);
            ctx.moveTo(width / 2, height / 2 - 10);
            ctx.lineTo(width / 2, height / 2 + 10);
            ctx.stroke();

            // Recoil indicator
            if (kickMagnitude > 0) {
                ctx.strokeStyle = "rgba(255, 255, 0, 0.5)";
                ctx.beginPath();
                ctx.arc(width / 2, height / 2, kickMagnitude * 100, 0, Math.PI * 2);
                ctx.stroke();
            }

            engine.addAnimationFrame(tick);
        };

        engine.addAnimationFrame(tick);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engine.phase, effectiveDifficulty]);

    const handleStartGame = () => {
        targetPos.current = { x: 0, y: 0, z: 15 };
        cameraPitch.current = 0;
        cameraYaw.current = 0;
        engine.beginSession();
    };

    const handleStopFiringRef = useRef(stopFiring);
    handleStopFiringRef.current = stopFiring;

    useEffect(() => {
        return () => {
            handleStopFiringRef.current();
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        };
    }, []);

    // Sync canvas resolution dynamically
    useEffect(() => {
        if (engine.phase !== "live") return;
        const updateSize = () => {
            const canvas = canvasRef.current;
            if (canvas && canvas.parentElement) {
                canvas.width = canvas.parentElement.clientWidth;
                canvas.height = canvas.parentElement.clientHeight;
            }
        };
        window.addEventListener("resize", updateSize);
        updateSize();
        return () => window.removeEventListener("resize", updateSize);
    }, [engine.phase]);

    // Attach canvas to engine for dimensions
    useEffect(() => {
        engine.canvasRef.current = canvasRef.current;
    }, [engine]);

    const isFinished = engine.phase === "finished" && engine.result !== null;

    return (
        <div className="relative w-full h-full bg-black rounded-xl overflow-hidden border border-white/5 shadow-2xl flex-1">
            <canvas
                ref={canvasRef}
                className="w-full h-full object-cover cursor-none"
            />

            {isFinished && engine.result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={engine.result} onRestart={handleStartGame} onBackToMenu={engine.resetToMenu} />
                </div>
            )}

            {engine.phase === "menu" && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
                    <div className="w-full max-w-md p-8 bg-[#121212]/90 border border-white/10 rounded-2xl text-center space-y-6 shadow-2xl">
                        <div className="space-y-2">
                            <h2 className="text-3xl font-black tracking-widest uppercase text-white">Recoil Evasion</h2>
                            <p className="text-slate-400 text-xs">Counter weapon kick while tracking the target.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-left">
                            <div className="flex flex-col">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Difficulty</label>
                                <select
                                    value={difficulty}
                                    onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                                    className="bg-black border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-red"
                                >
                                    {Object.entries(difficultyLabels).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Time</label>
                                <select
                                    value={engine.duration}
                                    onChange={(e) => engine.setDuration(Number(e.target.value))}
                                    className="bg-black border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-red"
                                >
                                    <option value={30}>30 Seconds</option>
                                    <option value={60}>60 Seconds</option>
                                </select>
                            </div>
                        </div>

                        <button
                            className="w-full py-4 bg-red text-white font-black text-xs tracking-[0.3em] uppercase rounded-lg shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:bg-white hover:text-red transition-all"
                            onClick={handleStartGame}
                        >
                            Deploy Protocol
                        </button>
                    </div>
                </div>
            )}

            {/* UI Overlay */}
            {engine.phase === "live" && (
                <>
                    <div className="absolute top-6 left-6 pointer-events-none">
                        <div className="bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-lg">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Session Score</p>
                            <p className="text-3xl font-black text-white font-mono">{engine.score.toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="absolute top-6 right-6 pointer-events-none">
                        <div className="bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-lg text-right">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Time Remaining</p>
                            <p className="text-3xl font-black text-red font-mono">{engine.timeLeft}s</p>
                        </div>
                    </div>

                    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 pointer-events-none">
                        <ComboMeter combo={engine.combo} />
                    </div>
                </>
            )}

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                <div className="w-[800px] h-[600px] border border-white/5 rounded-full" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[300px] border border-white/5 rounded-full" />
            </div>

            {engine.phase === "live" && !document.pointerLockElement && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
                    <button
                        className="px-8 py-4 bg-red text-white font-black text-xs tracking-[0.3em] uppercase rounded-md shadow-[0_0_30px_rgba(239,68,68,0.4)] animate-pulse"
                        onClick={() => canvasRef.current?.requestPointerLock()}
                    >
                        Click to Initialize Calibration
                    </button>
                </div>
            )}
        </div>
    );
}
