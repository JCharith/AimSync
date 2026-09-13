"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { BaseTarget, GameResult } from "@/lib/game/types";
import { difficultyConfig, difficultyLabels, getScaledRadius, type Difficulty } from "@/lib/utils/drillConfig";
import { calculateAccuracy, calculateAverageReactionTime, calculateBestReactionTime } from "@/lib/utils/gameMath";
import { useBaseGameEngine } from "@/lib/hooks/useBaseGameEngine";
import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";
import { spawnHitmarker } from "@/lib/utils/hitmarker";

const FOV = 800; // Focal length
const NEAR_PLANE = 0.1;
const MAX_LIGHT_DISTANCE = 60; // How far the light reaches

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface EcholocationProps {
    overrideSettings?: OverrideSettings;
    onFinish?: (res: GameResult) => void;
}

interface Point3D {
    x: number;
    y: number;
    z: number;
}

interface SphericalTarget extends BaseTarget {
    x: number;
    y: number;
    z: number;
    distance: number;
}

// --- 3D Math Engine ---
const rotate3D = (p: Point3D, cameraYaw: number, cameraPitch: number): Point3D => {
    const yawRad = (cameraYaw * Math.PI) / 180;
    const pitchRad = (cameraPitch * Math.PI) / 180;

    const cosY = Math.cos(yawRad);
    const sinY = Math.sin(yawRad);
    const x1 = p.x * cosY - p.z * sinY;
    const z1 = p.x * sinY + p.z * cosY;

    const cosX = Math.cos(pitchRad);
    const sinX = Math.sin(pitchRad);
    const y1 = p.y * cosX - z1 * sinX;
    const z2 = p.y * sinX + z1 * cosX;

    return { x: x1, y: y1, z: z2 };
};

const clipLine3D = (p1: Point3D, p2: Point3D): [Point3D, Point3D] | null => {
    if (p1.z >= NEAR_PLANE && p2.z >= NEAR_PLANE) return [p1, p2];
    if (p1.z < NEAR_PLANE && p2.z < NEAR_PLANE) return null;

    const t = (NEAR_PLANE - p1.z) / (p2.z - p1.z);
    const clippedP = {
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t,
        z: NEAR_PLANE,
    };

    if (p1.z >= NEAR_PLANE) return [p1, clippedP];
    return [clippedP, p2];
};

const projectToScreen = (p: Point3D, width: number, height: number) => {
    const scale = FOV / p.z;
    return {
        screenX: (width / 2) + p.x * scale,
        screenY: (height / 2) - p.y * scale,
        scale,
        z: p.z,
    };
};

const drawDepthLine = (
    ctx: CanvasRenderingContext2D,
    w1: Point3D,
    w2: Point3D,
    yaw: number,
    pitch: number,
    width: number,
    height: number,
    baseColor: [number, number, number],
    maxDist = MAX_LIGHT_DISTANCE,
    lineWidth = 2,
    intensity = 1.0
) => {
    const r1 = rotate3D(w1, yaw, pitch);
    const r2 = rotate3D(w2, yaw, pitch);

    const clipped = clipLine3D(r1, r2);
    if (!clipped) return;

    const [c1, c2] = clipped;
    const p1 = projectToScreen(c1, width, height);
    const p2 = projectToScreen(c2, width, height);

    const getAlpha = (z: number) => Math.max(0, 1 - (z / maxDist));
    const alpha1 = getAlpha(c1.z);
    const alpha2 = getAlpha(c2.z);

    if (alpha1 <= 0 && alpha2 <= 0) return;

    const r1Color = Math.min(255, Math.floor(baseColor[0] * intensity));
    const g1Color = Math.min(255, Math.floor(baseColor[1] * intensity));
    const b1Color = Math.min(255, Math.floor(baseColor[2] * intensity));

    const grad = ctx.createLinearGradient(p1.screenX, p1.screenY, p2.screenX, p2.screenY);
    grad.addColorStop(0, `rgba(${r1Color}, ${g1Color}, ${b1Color}, ${alpha1})`);
    grad.addColorStop(1, `rgba(${r1Color}, ${g1Color}, ${b1Color}, ${alpha2})`);

    ctx.strokeStyle = grad;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(p1.screenX, p1.screenY);
    ctx.lineTo(p2.screenX, p2.screenY);
    ctx.stroke();
};

// Wireframe radial grid
const gridLines: [Point3D, Point3D][] = [];
const NUM_RINGS = 10;
const RADIUS_STEP = 12;
const FLOOR_Y = -30;
const CEIL_Y = 30;
const NUM_SPOKES = 16;

for (let r = 1; r <= NUM_RINGS; r++) {
    const radius = r * RADIUS_STEP;
    const segments = 32;
    for (let i = 0; i < segments; i++) {
        const a1 = (i / segments) * Math.PI * 2;
        const a2 = ((i + 1) / segments) * Math.PI * 2;
        const x1 = Math.cos(a1) * radius;
        const z1 = Math.sin(a1) * radius;
        const x2 = Math.cos(a2) * radius;
        const z2 = Math.sin(a2) * radius;

        gridLines.push([{ x: x1, y: FLOOR_Y, z: z1 }, { x: x2, y: FLOOR_Y, z: z2 }]);
        gridLines.push([{ x: x1, y: CEIL_Y, z: z1 }, { x: x2, y: CEIL_Y, z: z2 }]);
    }
}

for (let i = 0; i < NUM_SPOKES; i++) {
    const angle = (i / NUM_SPOKES) * Math.PI * 2;
    const maxRadius = NUM_RINGS * RADIUS_STEP;
    const x = Math.cos(angle) * maxRadius;
    const z = Math.sin(angle) * maxRadius;

    gridLines.push([{ x: 0, y: FLOOR_Y, z: 0 }, { x, y: FLOOR_Y, z }]);
    gridLines.push([{ x: 0, y: CEIL_Y, z: 0 }, { x, y: CEIL_Y, z }]);
}

export default function Echolocation({ overrideSettings, onFinish }: EcholocationProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const sessionStartRef = useRef<number>(0);
    const lastClickTimeRef = useRef<number>(0);

    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const effectiveDifficulty = overrideSettings?.difficulty ?? difficulty;
    const [sensitivity, setSensitivity] = useState<number>(1.0);

    const [target, setTarget] = useState<SphericalTarget | null>(null);
    const targetRef = useRef<SphericalTarget | null>(null);

    const engine = useBaseGameEngine({
        modeId: "echolocation",
        overrideSettings,
        onSessionComplete: onFinish,
    });

    const config = difficultyConfig[effectiveDifficulty];
    const accuracy = calculateAccuracy(engine.hits, engine.misses);
    const averageReactionTime = calculateAverageReactionTime(engine.reactionTimes);
    const bestReactionTime = calculateBestReactionTime(engine.reactionTimes);

    // Sync refs
    useEffect(() => {
        targetRef.current = target;
    }, [target]);

    // Camera state
    const cameraYawRef = useRef(0);
    const cameraPitchRef = useRef(0);

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

    const playSpatialSound = (targetX: number, targetY: number, targetZ: number, distance: number) => {
        if (!audioCtxRef.current) return;
        const ctx = audioCtxRef.current;

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const panner = ctx.createPanner();
        const filter = ctx.createBiquadFilter();

        panner.panningModel = "HRTF";
        panner.distanceModel = "inverse";
        panner.refDistance = 1;
        panner.maxDistance = 10000;
        panner.rolloffFactor = 1;

        const diffConfig = {
            easy: { filterFreq: 20000, volume: 1.0 },
            medium: { filterFreq: 6000, volume: 0.85 },
            hard: { filterFreq: 2000, volume: 0.7 },
            extreme: { filterFreq: 800, volume: 0.5 },
        };
        const audioSettings = diffConfig[effectiveDifficulty] || diffConfig.medium;

        filter.type = "lowpass";
        filter.frequency.value = audioSettings.filterFreq;

        const rot = rotate3D({ x: targetX, y: targetY, z: targetZ }, cameraYawRef.current, cameraPitchRef.current);

        panner.positionX.value = rot.x;
        panner.positionY.value = rot.y;
        panner.positionZ.value = rot.z;

        if (distance > 15) {
            osc.type = "triangle";
            osc.frequency.setValueAtTime(150, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(1.5 * audioSettings.volume, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        } else {
            osc.type = "square";
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);
            gainNode.gain.setValueAtTime(1.0 * audioSettings.volume, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        }

        osc.connect(filter);
        filter.connect(panner);
        panner.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    };

    const handleInitialize = async () => {
        initAudio();
        setTarget(null);
        lastClickTimeRef.current = 0;
        cameraYawRef.current = 0;
        cameraPitchRef.current = 0;
        sessionStartRef.current = performance.now();
        engine.beginSession();
    };

    const spawnTarget = useCallback(() => {
        engine.clearAllTimersAndLoops();
        const currentSession = engine.sessionIdxRef.current;
        const elapsedSec = (performance.now() - sessionStartRef.current) / 1000;
        const baseRadius = getScaledRadius(config.targetRadius, effectiveDifficulty, elapsedSec, engine.duration);

        // Target should spawn OUTSIDE front FOV
        const yawOffset = (60 + Math.random() * 120) * (Math.random() > 0.5 ? 1 : -1);
        const newYaw = (cameraYawRef.current + yawOffset + 360) % 360;
        const newPitch = -30 + Math.random() * 60;

        const isCloseSpawn = Math.random() < 0.15;
        const newDistance = isCloseSpawn ? 3 + Math.random() * 7 : 20 + Math.random() * 40;

        const yawRad = (newYaw * Math.PI) / 180;
        const pitchRad = (newPitch * Math.PI) / 180;

        const x = newDistance * Math.sin(yawRad) * Math.cos(pitchRad);
        const y = newDistance * Math.sin(pitchRad);
        const z = -newDistance * Math.cos(yawRad) * Math.cos(pitchRad);

        const ttl = config.targetLifetimeMs * 1.5;
        const newTarget: SphericalTarget = {
            id: Math.random().toString(),
            x, y, z,
            radius: baseRadius,
            spawnedAt: performance.now(),
            timeToLive: ttl,
            distance: newDistance,
        };

        setTarget(newTarget);
        playSpatialSound(x, y, z, newDistance);
        engine.incrementSpawned();

        engine.addTimeout(() => {
            if (engine.sessionIdxRef.current !== currentSession) return;
            setTarget(null);
            engine.incrementTimeoutMiss(config.missPenalty);
            spawnTarget();
        }, newTarget.timeToLive || 800);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config, effectiveDifficulty, engine.dimensions, engine.duration, engine.incrementSpawned, engine.incrementTimeoutMiss]);

    // Spawn first target when engine transitions to "live"
    const prevPhaseRef = useRef(engine.phase);
    useEffect(() => {
        if (engine.phase === "live" && prevPhaseRef.current !== "live") {
            sessionStartRef.current = performance.now();
            spawnTarget();
            if (canvasRef.current) {
                canvasRef.current.requestPointerLock();
            }
        }
        prevPhaseRef.current = engine.phase;
    }, [engine.phase, spawnTarget]);

    // Pointer Lock & Mouse Movement Handler
    useEffect(() => {
        if (engine.phase !== "live") return;

        const handleMouseMove = (e: MouseEvent) => {
            if (document.pointerLockElement === canvasRef.current) {
                const sensitivityMultiplier = 0.05 * sensitivity;
                cameraYawRef.current = (cameraYawRef.current + e.movementX * sensitivityMultiplier) % 360;

                cameraPitchRef.current -= e.movementY * sensitivityMultiplier;
                cameraPitchRef.current = Math.max(-89, Math.min(89, cameraPitchRef.current));
            }
        };

        document.addEventListener("mousemove", handleMouseMove);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
        };
    }, [engine.phase, sensitivity]);

    // Canvas render loop
    useEffect(() => {
        if (engine.phase !== "live") return;

        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            ctx.clearRect(0, 0, engine.dimensions.width, engine.dimensions.height);

            const centerX = engine.dimensions.width / 2;
            const centerY = engine.dimensions.height / 2;
            const yaw = cameraYawRef.current;
            const pitch = cameraPitchRef.current;

            // Render Sonar Grid with Sweep Effect
            const time = performance.now() / 1000;
            const sweepAngle = (time * 1.5) % (Math.PI * 2);

            gridLines.forEach(([w1, w2]) => {
                const midX = (w1.x + w2.x) / 2;
                const midZ = (w1.z + w2.z) / 2;
                const angle = Math.atan2(midZ, midX);
                let angleDiff = sweepAngle - angle;

                while (angleDiff < 0) angleDiff += Math.PI * 2;
                while (angleDiff > Math.PI * 2) angleDiff -= Math.PI * 2;

                let intensity = 1.0;
                if (angleDiff < 0.6) {
                    intensity = 1.0 + (0.6 - angleDiff) * 3;
                } else if (angleDiff > Math.PI * 2 - 0.1) {
                    intensity = 1.5;
                } else {
                    intensity = 0.2;
                }

                drawDepthLine(ctx, w1, w2, yaw, pitch, engine.dimensions.width, engine.dimensions.height, [6, 182, 212], MAX_LIGHT_DISTANCE, 1, intensity);
            });

            // Draw 3D Target
            const currentTarget = targetRef.current;
            if (currentTarget) {
                const rotTarget = rotate3D(currentTarget, yaw, pitch);
                if (rotTarget.z >= NEAR_PLANE) {
                    const proj = projectToScreen(rotTarget, engine.dimensions.width, engine.dimensions.height);
                    const renderRadius = currentTarget.radius * 20 * proj.scale / FOV;

                    if (
                        proj.screenX + renderRadius > 0 &&
                        proj.screenX - renderRadius < engine.dimensions.width &&
                        proj.screenY + renderRadius > 0 &&
                        proj.screenY - renderRadius < engine.dimensions.height
                    ) {
                        const pulse = Math.sin(time * 6) * 0.15 + 1.15;

                        ctx.beginPath();
                        ctx.arc(proj.screenX, proj.screenY, renderRadius * pulse, 0, Math.PI * 2);
                        ctx.strokeStyle = "rgba(255, 50, 50, 0.3)";
                        ctx.lineWidth = 2;
                        ctx.stroke();

                        const grad = ctx.createRadialGradient(
                            proj.screenX - renderRadius * 0.3,
                            proj.screenY - renderRadius * 0.3,
                            renderRadius * 0.1,
                            proj.screenX,
                            proj.screenY,
                            renderRadius
                        );
                        grad.addColorStop(0, "#ff6666");
                        grad.addColorStop(1, "#990000");

                        ctx.beginPath();
                        ctx.arc(proj.screenX, proj.screenY, renderRadius, 0, Math.PI * 2);
                        ctx.fillStyle = grad;
                        ctx.fill();

                        ctx.beginPath();
                        ctx.arc(proj.screenX, proj.screenY, renderRadius * 0.25, 0, Math.PI * 2);
                        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
                        ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
                        ctx.shadowBlur = 10;
                        ctx.fill();
                        ctx.shadowColor = "transparent";
                        ctx.shadowBlur = 0;
                    }
                }
            }

            // Draw Static Crosshair
            ctx.strokeStyle = "rgba(0, 255, 0, 0.8)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(centerX - 8, centerY);
            ctx.lineTo(centerX + 8, centerY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - 8);
            ctx.lineTo(centerX, centerY + 8);
            ctx.stroke();

            engine.addAnimationFrame(render);
        };

        engine.addAnimationFrame(render);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engine.phase, target]);

    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (engine.phase !== "live") return;

        const now = performance.now();
        if (now - lastClickTimeRef.current < 80) return;
        lastClickTimeRef.current = now;

        if (document.pointerLockElement !== canvasRef.current) {
            canvasRef.current?.requestPointerLock();
        }

        if (!target) return;

        const rotTarget = rotate3D(target, cameraYawRef.current, cameraPitchRef.current);
        if (rotTarget.z >= NEAR_PLANE) {
            const proj = projectToScreen(rotTarget, engine.dimensions.width, engine.dimensions.height);

            const centerX = engine.dimensions.width / 2;
            const centerY = engine.dimensions.height / 2;

            const dx = proj.screenX - centerX;
            const dy = proj.screenY - centerY;
            const distToCenter = Math.sqrt(dx * dx + dy * dy);

            const renderRadius = target.radius * 20 * proj.scale / FOV;

            if (distToCenter <= renderRadius) {
                const reaction = performance.now() - target.spawnedAt;
                engine.triggerHit(reaction);
                engine.incrementScore(config.scorePerHit);
                spawnHitmarker(engine.dimensions.width / 2, engine.dimensions.height / 2);
                spawnTarget();
                return;
            }
        }

        engine.triggerMiss(config.missPenalty);
    };

    // Attach to engine canvasRef
    useEffect(() => {
        engine.canvasRef.current = canvasRef.current;
    }, [engine]);

    const isCountingDown = engine.countdown !== null && engine.countdown > 0;
    const isLive = engine.phase === "live";
    const isFinished = engine.phase === "finished" && engine.result !== null;

    return (
        <div ref={engine.containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-[#EAEAEA] overflow-hidden">
            {isFinished && engine.result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={engine.result} onRestart={handleInitialize} onBackToMenu={engine.resetToMenu} />
                </div>
            )}

            {engine.phase === "menu" && (
                <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-black/50">
                    <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                        <div className="space-y-2">
                            <h2 className="text-4xl font-black tracking-widest uppercase text-white">Echolocation</h2>
                            <p className="text-gray-500 text-sm">Rely on spatial audio to snap to 3D targets in a pitch-black void.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4 text-left">
                                <div className="flex flex-col">
                                    <label className="text-gray-400 text-xs font-bold tracking-wider uppercase mb-2">Difficulty</label>
                                    <select
                                        value={difficulty}
                                        onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                                        className="bg-black/80 border border-white/20 p-3 rounded-lg text-white focus:border-[#06b6d4] outline-none transition-all cursor-pointer"
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
                                        className="bg-black/80 border border-white/20 p-3 rounded-lg text-white focus:border-[#06b6d4] outline-none transition-all cursor-pointer"
                                    >
                                        {!overrideSettings && <option value={15}>15s (Warmup)</option>}
                                        <option value={30}>30s (Standard)</option>
                                        {!overrideSettings && <option value={45}>45s (Extended)</option>}
                                        <option value={60}>60s (Endurance)</option>
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-gray-400 text-xs font-bold tracking-wider uppercase mb-2">Sensitivity</label>
                                    <div className="flex items-center space-x-2 bg-black/80 border border-white/20 p-3 rounded-lg">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={sensitivity}
                                            onChange={(e) => setSensitivity(parseFloat(e.target.value) || 1.0)}
                                            className="bg-transparent w-full outline-none text-white font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleInitialize}
                                className="w-full px-12 py-5 bg-[#06b6d4] text-black text-lg font-black tracking-[0.2em] rounded-xl hover:bg-white transition-all shadow-[0_0_30px_rgba(6,182,212,0.3)]"
                            >
                                START PROTOCOL
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isCountingDown && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#121212]">
                    <span className="text-[10rem] font-black text-white animate-ping">{engine.countdown}</span>
                </div>
            )}

            {isLive && (
                <div className="relative flex flex-col w-full h-full z-20">
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10">
                        <SessionHUD
                            data={{
                                mode: "Echolocation",
                                difficulty: difficultyLabels[difficulty],
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
                    </div>
                </div>
            )}
        </div>
    );
}
