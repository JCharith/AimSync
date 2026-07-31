'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useWeaponStore } from '@/store/weaponStore';
import { WeaponStats } from '@/lib/utils/AssetManager';

// Preset weapon profiles if weaponStore is not populated
const WEAPON_PRESETS: Record<string, { name: string; fireRate: number; magSize: number; climbHeight: number; swayWidth: number }> = {
    vandal: { name: 'Vandal / AK-47', fireRate: 9.75, magSize: 25, climbHeight: 220, swayWidth: 60 },
    phantom: { name: 'Phantom / M4A1', fireRate: 11.0, magSize: 30, climbHeight: 200, swayWidth: 50 },
    spectre: { name: 'Spectre / MP9', fireRate: 13.33, magSize: 30, climbHeight: 180, swayWidth: 40 },
    stinger: { name: 'Stinger / MAC-10', fireRate: 16.0, magSize: 20, climbHeight: 240, swayWidth: 70 },
};

export default function RecoilTracer() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const activeWeapon = useWeaponStore((state) => state.activeWeapon);

    // Selected weapon key fallback
    const [selectedWeaponKey, setSelectedWeaponKey] = useState<string>('vandal');

    // Effective weapon stats
    const currentWeaponStats = activeWeapon || {
        id: selectedWeaponKey,
        name: WEAPON_PRESETS[selectedWeaponKey]?.name || 'Vandal',
        type: 'rifle' as const,
        gameStyle: 'valorant' as const,
        magSize: WEAPON_PRESETS[selectedWeaponKey]?.magSize || 25,
        fireRate: WEAPON_PRESETS[selectedWeaponKey]?.fireRate || 9.75,
        firstShotSpread: 0.25,
        audioProfile: 'unsuppressed_rifle',
    };

    // Gameplay states
    const [isFiring, setIsFiring] = useState(false);
    const [accuracy, setAccuracy] = useState<number>(100);
    const [averageAccuracy, setAverageAccuracy] = useState<number | null>(null);
    const [highScore, setHighScore] = useState<number>(0);
    const [bulletsFired, setBulletsFired] = useState<number>(0);

    // Animation & Tracking references
    const animationFrameId = useRef<number>(0);
    const bulletIndexRef = useRef<number>(0);
    const lastShotTimeRef = useRef<number>(0);
    const mousePosRef = useRef<{ x: number; y: number }>({ x: 400, y: 450 });
    const startPosRef = useRef<{ x: number; y: number }>({ x: 400, y: 450 });
    const currentTracerPosRef = useRef<{ x: number; y: number }>({ x: 400, y: 450 });
    const accuracySumRef = useRef<number>(0);
    const accuracyTicksRef = useRef<number>(0);

    // Generates a T-shape recoil pattern array based on weapon stats
    const generateTShapePattern = useCallback((weapon: { fireRate: number; magSize: number; climbHeight?: number; swayWidth?: number }) => {
        const magSize = Math.min(weapon.magSize || 25, 30);
        const pattern: { x: number; y: number }[] = [];
        
        const climbLimit = weapon.climbHeight || 220;
        const swayWidth = weapon.swayWidth || 60;
        const verticalBullets = Math.floor(magSize * 0.4); // 40% climb phase
        const horizontalBullets = magSize - verticalBullets; // 60% T-sway phase

        // Phase 1: Vertical climb (bottom of T to top)
        for (let i = 0; i < verticalBullets; i++) {
            const pct = i / (verticalBullets - 1);
            // Slight natural drift + exponential climb
            const dy = -Math.pow(pct, 0.85) * climbLimit;
            const dx = Math.sin(pct * Math.PI) * 8;
            pattern.push({ x: dx, y: dy });
        }

        // Phase 2: Horizontal T-sway (sweeping right, then left across top of T)
        const topY = -climbLimit;
        const halfSway = horizontalBullets / 2;
        for (let i = 0; i < horizontalBullets; i++) {
            let dx = 0;
            if (i < halfSway) {
                // Right sway
                const pct = i / halfSway;
                dx = Math.sin(pct * (Math.PI / 2)) * swayWidth;
            } else {
                // Left sway
                const pct = (i - halfSway) / halfSway;
                dx = swayWidth - Math.sin(pct * Math.PI) * (swayWidth * 2);
            }
            // Micro vertical wobble along the top bar of T
            const dy = topY + Math.sin(i * 0.8) * 6;
            pattern.push({ x: dx, y: dy });
        }

        return pattern;
    }, []);

    const sprayPatternRef = useRef<{ x: number; y: number }[]>([]);

    useEffect(() => {
        sprayPatternRef.current = generateTShapePattern(currentWeaponStats);
    }, [currentWeaponStats, generateTShapePattern]);

    const fireIntervalMs = 1000 / currentWeaponStats.fireRate;

    // Web Audio gunshot sound generator
    function playGunshotSound() {
        try {
            if (!audioCtxRef.current) {
                const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (AudioContextClass) {
                    audioCtxRef.current = new AudioContextClass();
                }
            }
            const ctx = audioCtxRef.current;
            if (!ctx) return;
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(15, ctx.currentTime + 0.09);

            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch {
            // Audio context protection
        }
    }

    function drawScene(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        active: boolean
    ) {
        const pattern = sprayPatternRef.current;

        // Clear canvas background
        ctx.fillStyle = '#08090c';
        ctx.fillRect(0, 0, width, height);

        const startX = startPosRef.current.x;
        const startY = startPosRef.current.y;

        // Draw crosshair grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height);
        ctx.moveTo(0, startY); ctx.lineTo(width, startY);
        ctx.stroke();

        if (pattern.length > 0) {
            // 1. Draw static T-shape recoil spray pattern guide (white line)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            for (let i = 1; i < pattern.length; i++) {
                ctx.lineTo(startX + pattern[i].x, startY + pattern[i].y);
            }
            ctx.stroke();

            // Draw discrete bullet node markers on recoil path
            pattern.forEach((pt, idx) => {
                ctx.fillStyle = idx === bulletIndexRef.current && active ? '#ef4444' : 'rgba(255, 255, 255, 0.2)';
                ctx.beginPath();
                ctx.arc(startX + pt.x, startY + pt.y, idx === bulletIndexRef.current && active ? 5 : 2, 0, Math.PI * 2);
                ctx.fill();
            });

            // 2. Draw ideal counter-drag compensation path (dashed green guide)
            ctx.strokeStyle = 'rgba(34, 197, 94, 0.15)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            for (let i = 1; i < pattern.length; i++) {
                ctx.lineTo(startX - pattern[i].x, startY - pattern[i].y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (active) {
            // 3. Active target dot (Red) climbing recoil pattern
            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(currentTracerPosRef.current.x, currentTracerPosRef.current.y, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // 4. Ideal compensation target ring (Green)
            const dx = currentTracerPosRef.current.x - startX;
            const dy = currentTracerPosRef.current.y - startY;
            const idealX = startX - dx;
            const idealY = startY - dy;

            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(idealX, idealY, 10, 0, Math.PI * 2);
            ctx.stroke();

            // 5. User cursor (Blue reticle)
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.arc(mousePosRef.current.x, mousePosRef.current.y, 4, 0, Math.PI * 2);
            ctx.fill();

            // Link line between user cursor and ideal target
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(mousePosRef.current.x, mousePosRef.current.y);
            ctx.lineTo(idealX, idealY);
            ctx.stroke();
        } else {
            // Baseline start anchor
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.arc(startX, startY, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function updateLoop(timestamp: number) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx || !isFiring) return;

        const pattern = sprayPatternRef.current;
        if (pattern.length === 0) return;

        // 1. Process bullet spray timing based on exact fireRate
        if (lastShotTimeRef.current === 0) {
            lastShotTimeRef.current = timestamp;
            playGunshotSound();
            setBulletsFired(1);
        }

        const elapsed = timestamp - lastShotTimeRef.current;
        if (elapsed >= fireIntervalMs) {
            bulletIndexRef.current += 1;
            lastShotTimeRef.current = timestamp;
            setBulletsFired(bulletIndexRef.current + 1);

            if (bulletIndexRef.current < pattern.length) {
                playGunshotSound();
            } else {
                // Spray complete
                handleStopExecution();
                return;
            }
        }

        // 2. Linear interpolation along recoil vector
        const currentIdx = Math.min(bulletIndexRef.current, pattern.length - 1);
        const nextIdx = Math.min(currentIdx + 1, pattern.length - 1);
        const lerpFactor = Math.min(1, elapsed / fireIntervalMs);

        const currentOffset = pattern[currentIdx];
        const nextOffset = pattern[nextIdx];

        const dx = currentOffset.x + (nextOffset.x - currentOffset.x) * lerpFactor;
        const dy = currentOffset.y + (nextOffset.y - currentOffset.y) * lerpFactor;

        const startX = startPosRef.current.x;
        const startY = startPosRef.current.y;

        currentTracerPosRef.current = {
            x: startX + dx,
            y: startY + dy,
        };

        // 3. Precision error delta check
        const idealUserPos = {
            x: startX - dx,
            y: startY - dy,
        };

        const currentMouseX = mousePosRef.current.x;
        const currentMouseY = mousePosRef.current.y;

        const distError = Math.sqrt(
            Math.pow(currentMouseX - idealUserPos.x, 2) +
            Math.pow(currentMouseY - idealUserPos.y, 2)
        );

        // Precision accuracy calculation (0px offset = 100%, 75px offset = 0%)
        const currentAcc = Math.max(0, 100 - (distError / 0.75));
        setAccuracy(Math.round(currentAcc));

        accuracySumRef.current += currentAcc;
        accuracyTicksRef.current += 1;

        // 4. Render Canvas frame
        drawScene(ctx, canvas.width, canvas.height, true);

        // Schedule next frame
        animationFrameId.current = requestAnimationFrame(updateLoop);
    }

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        startPosRef.current = { x: canvas.width / 2, y: canvas.height - 100 };
        mousePosRef.current = { ...startPosRef.current };
        currentTracerPosRef.current = { ...startPosRef.current };

        drawScene(ctx, canvas.width, canvas.height, false);

        const savedHigh = localStorage.getItem('aimsync_recoil_highscore');
        if (savedHigh) {
            setTimeout(() => {
                setHighScore(parseFloat(savedHigh));
            }, 0);
        }
    }, [currentWeaponStats]);

    function handleStartFiring(e: React.MouseEvent<HTMLCanvasElement>) {
        if (e.button !== 0 || isFiring) return;

        setIsFiring(true);
        setAccuracy(100);
        setBulletsFired(1);
        bulletIndexRef.current = 0;
        lastShotTimeRef.current = 0;
        accuracySumRef.current = 0;
        accuracyTicksRef.current = 0;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            mousePosRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        }

        animationFrameId.current = requestAnimationFrame(updateLoop);
    }

    function handleStopFiring() {
        if (!isFiring) return;
        handleStopExecution();
    }

    function handleStopExecution() {
        setIsFiring(false);
        cancelAnimationFrame(animationFrameId.current);

        if (accuracyTicksRef.current > 0) {
            const finalAcc = Math.round(accuracySumRef.current / accuracyTicksRef.current);
            setAverageAccuracy(finalAcc);

            if (finalAcc > highScore) {
                setHighScore(finalAcc);
                localStorage.setItem('aimsync_recoil_highscore', finalAcc.toString());
            }
        }

        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                drawScene(ctx, canvas.width, canvas.height, false);
            }
        }
    }

    function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            mousePosRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        }
    }

    useEffect(() => {
        return () => {
            cancelAnimationFrame(animationFrameId.current);
            if (audioCtxRef.current) {
                audioCtxRef.current.close();
            }
        };
    }, []);

    return (
        <div className="flex flex-col items-center bg-[#08090c] p-6 rounded-3xl border border-white/10 shadow-2xl w-full max-w-4xl mx-auto">
            {/* Header Dashboard HUD */}
            <div className="w-full flex flex-wrap justify-between items-center mb-6 font-sans gap-4">
                <div>
                    <h2 className="text-[#3366ff] text-xs font-bold tracking-[0.4em] uppercase">AimSync Potato Engine</h2>
                    <h1 className="text-2xl font-black tracking-wider text-white uppercase">2D Recoil Tracer</h1>
                </div>

                {/* Weapon Selector */}
                <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-xl border border-white/10">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-2">Weapon:</span>
                    {Object.keys(WEAPON_PRESETS).map((key) => (
                        <button
                            key={key}
                            onClick={() => setSelectedWeaponKey(key)}
                            disabled={isFiring}
                            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                                selectedWeaponKey === key
                                    ? 'bg-[#3366ff] text-white shadow-md'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {key}
                        </button>
                    ))}
                </div>

                {/* Stats Header */}
                <div className="flex gap-6 text-right font-mono">
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">High Score</p>
                        <p className="text-xl font-black text-[#22c55e]">{highScore}%</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Live Accuracy</p>
                        <p className="text-xl font-black text-white">{isFiring ? `${accuracy}%` : '--'}</p>
                    </div>
                    {averageAccuracy !== null && (
                        <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Last Run</p>
                            <p className="text-xl font-black text-cyan-400">{averageAccuracy}%</p>
                        </div>
                    )}
                </div>
            </div>

            {/* The Canvas Workspace */}
            <div className="relative border border-white/10 rounded-2xl overflow-hidden shadow-inner cursor-none">
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={500}
                    onMouseDown={handleStartFiring}
                    onMouseUp={handleStopFiring}
                    onMouseLeave={handleStopFiring}
                    onMouseMove={handleMouseMove}
                    className="block"
                />

                {/* Instruction & Telemetry Overlay */}
                {!isFiring && (
                    <div className="absolute inset-0 bg-black/65 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none transition-all duration-300">
                        <p className="text-white text-lg font-black tracking-widest uppercase mb-2">PRESS & HOLD LEFT-CLICK TO SPRAY</p>
                        <p className="text-slate-400 text-xs max-w-md text-center leading-relaxed mb-4">
                            Trace downward in reverse to compensate for the T-shape recoil vector. Keep your cursor inside the green target ring.
                        </p>
                        <div className="flex gap-4 text-[10px] font-mono text-slate-400 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                            <span>Fire Rate: <strong className="text-white">{currentWeaponStats.fireRate} BPS</strong></span>
                            <span>Mag Size: <strong className="text-white">{currentWeaponStats.magSize} Rds</strong></span>
                            <span>Pattern: <strong className="text-[#3366ff]">T-Vector</strong></span>
                        </div>
                    </div>
                )}

                {/* Live Bullet Count HUD */}
                {isFiring && (
                    <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1.5 rounded-lg border border-white/10 font-mono text-xs text-white">
                        Bullet: <span className="text-cyan-400 font-bold">{bulletsFired}</span> / {currentWeaponStats.magSize}
                    </div>
                )}
            </div>
        </div>
    );
}
