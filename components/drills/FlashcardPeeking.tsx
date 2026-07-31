'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface PeekAngle {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ActiveTarget {
    angleId: string;
    spawnTime: number;
    duration: number;
}

interface FeedbackParticle {
    x: number;
    y: number;
    text: string;
    color: string;
    alpha: number;
}

const PEEK_ANGLES: PeekAngle[] = [
    { id: 'wine', name: 'Wine Corner', x: 90, y: 340, width: 32, height: 64 },
    { id: 'close_left', name: 'Close Left', x: 190, y: 330, width: 32, height: 64 },
    { id: 'site_generator', name: 'Generator', x: 390, y: 280, width: 28, height: 56 },
    { id: 'green_box', name: 'Green Box', x: 530, y: 290, width: 28, height: 56 },
    { id: 'heaven', name: 'A Heaven', x: 660, y: 150, width: 26, height: 52 },
];

const GAME_DURATION_SEC = 30;

function getRandomAngle(excludeId?: string): PeekAngle {
    const available = excludeId ? PEEK_ANGLES.filter((a) => a.id !== excludeId) : PEEK_ANGLES;
    return available[Math.floor(Math.random() * available.length)];
}

function getRandomSpawnDelay(): number {
    return Math.random() * 500 + 350; // 350ms to 850ms
}

function getTargetDuration(score: number): number {
    const baseDuration = 1200;
    return Math.max(650, baseDuration - score * 10);
}

export default function FlashcardPeeking() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    // Backdrop state & ref
    const bgImageRef = useRef<HTMLImageElement | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);

    // Gameplay states
    const [isActive, setIsActive] = useState(false);
    const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SEC);
    const [score, setScore] = useState(0);
    const [totalShots, setTotalShots] = useState(0);
    const [hits, setHits] = useState(0);
    const [accuracy, setAccuracy] = useState<number | null>(null);
    const [highScore, setHighScore] = useState<number>(0);
    const [damageTaken, setDamageTaken] = useState(0);
    const [lastReactionMs, setLastReactionMs] = useState<number | null>(null);

    // Animation & Timing refs
    const animationFrameId = useRef<number>(0);
    const mousePosRef = useRef<{ x: number; y: number }>({ x: 400, y: 250 });
    const activeTargetRef = useRef<ActiveTarget | null>(null);
    const nextSpawnTimeRef = useRef<number>(0);
    const feedbackParticlesRef = useRef<FeedbackParticle[]>([]);
    const screenFlashAlphaRef = useRef<number>(0);
    const lastTargetIdRef = useRef<string>('');
    const gameTimerIdRef = useRef<NodeJS.Timeout | null>(null);

    // Audio synthesizer helper
    function playSound(type: 'GUNSHOT' | 'DINK' | 'DAMAGE') {
        try {
            if (!audioCtxRef.current) {
                const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (AudioContextClass) {
                    audioCtxRef.current = new AudioContextClass();
                }
            }
            const ctx = audioCtxRef.current;
            if (!ctx) return;
            if (ctx.state === 'suspended') ctx.resume();

            const gain = ctx.createGain();
            gain.connect(ctx.destination);

            if (type === 'GUNSHOT') {
                const osc = ctx.createOscillator();
                osc.connect(gain);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(15, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
            } else if (type === 'DINK') {
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                osc1.connect(gain);
                osc2.connect(gain);
                osc1.type = 'sine';
                osc2.type = 'triangle';
                osc1.frequency.setValueAtTime(1400, ctx.currentTime);
                osc2.frequency.setValueAtTime(2000, ctx.currentTime);
                gain.gain.setValueAtTime(0.25, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
                osc1.start(); osc2.start();
                osc1.stop(ctx.currentTime + 0.14); osc2.stop(ctx.currentTime + 0.14);
            } else if (type === 'DAMAGE') {
                const osc = ctx.createOscillator();
                osc.connect(gain);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(90, ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(30, ctx.currentTime + 0.22);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
                osc.start();
                osc.stop(ctx.currentTime + 0.22);
            }
        } catch {
            // Audio context protection
        }
    }

    // Procedural tactical backdrop rendering (fallback if image is missing)
    function drawProceduralBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.fillStyle = '#0a0d14';
        ctx.fillRect(0, 0, width, height);

        // Sky & horizon gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.6);
        skyGrad.addColorStop(0, '#0f172a');
        skyGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height * 0.6);

        // Ground gradient
        const groundGrad = ctx.createLinearGradient(0, height * 0.6, 0, height);
        groundGrad.addColorStop(0, '#090d16');
        groundGrad.addColorStop(1, '#030712');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, height * 0.6, width, height * 0.4);

        // Grid perspective lines
        ctx.strokeStyle = 'rgba(51, 102, 255, 0.08)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= width; x += 80) {
            ctx.beginPath();
            ctx.moveTo(x, height * 0.6);
            ctx.lineTo(width / 2 + (x - width / 2) * 2.5, height);
            ctx.stroke();
        }

        // Draw crosshair angle bounds
        PEEK_ANGLES.forEach((angle) => {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(
                angle.x - angle.width / 2,
                angle.y - angle.height / 2,
                angle.width,
                angle.height
            );
            ctx.setLineDash([]);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(angle.name, angle.x, angle.y + angle.height / 2 + 12);
        });
    }

    function drawTargetHeadCircle(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        lifespanPct: number
    ) {
        ctx.save();

        const headRadius = w / 2.2;
        const headY = y - h / 3;

        // Head hit-circle glow
        ctx.shadowBlur = 12;
        ctx.shadowColor = `rgba(239, 68, 68, ${0.5 + 0.5 * lifespanPct})`;

        // Body Silhouette
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y + h / 2);
        ctx.lineTo(x + w / 2, y + h / 2);
        ctx.lineTo(x + w / 3, y - h / 6);
        ctx.lineTo(x - w / 3, y - h / 6);
        ctx.closePath();
        ctx.fill();

        // 2D Head-level target circle (Precision Dink Spot)
        ctx.fillStyle = '#fca5a5';
        ctx.beginPath();
        ctx.arc(x, headY, headRadius, 0, Math.PI * 2);
        ctx.fill();

        // High-vis Head Center Dot
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(x, headY, headRadius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Reaction Timer Progress Bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x - w / 2, y + h / 2 + 4, w, 3);
        ctx.fillStyle = lifespanPct > 0.35 ? '#22c55e' : '#f97316';
        ctx.fillRect(x - w / 2, y + h / 2 + 4, w * lifespanPct, 3);

        ctx.restore();
    }

    function drawCrosshair(ctx: CanvasRenderingContext2D) {
        const mX = mousePosRef.current.x;
        const mY = mousePosRef.current.y;

        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.5;
        const size = 5;
        const gap = 3;

        ctx.beginPath();
        ctx.moveTo(mX - size - gap, mY); ctx.lineTo(mX - gap, mY);
        ctx.moveTo(mX + gap, mY); ctx.lineTo(mX + size + gap, mY);
        ctx.moveTo(mX, mY - size - gap); ctx.lineTo(mX, mY - gap);
        ctx.moveTo(mX, mY + gap); ctx.lineTo(mX, mY + size + gap);
        ctx.stroke();
    }

    function updateParticles(ctx: CanvasRenderingContext2D) {
        const particles = feedbackParticlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.y -= 1.0;
            p.alpha -= 0.02;

            if (p.alpha <= 0) {
                particles.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 3;
            ctx.fillText(p.text, p.x, p.y);
            ctx.restore();
        }
    }

    function updateLoop(timestamp: number) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (isActive) {
            const active = activeTargetRef.current;
            if (active) {
                const elapsed = timestamp - active.spawnTime;
                if (elapsed >= active.duration) {
                    // Enemy shot back!
                    playSound('DAMAGE');
                    setDamageTaken((prev) => prev + 1);
                    setScore((prev) => Math.max(0, prev - 150));

                    const angle = PEEK_ANGLES.find((a) => a.id === active.angleId);
                    if (angle) {
                        feedbackParticlesRef.current.push({
                            x: angle.x,
                            y: angle.y - 20,
                            text: 'SHOT BACK! (-150)',
                            color: '#ef4444',
                            alpha: 1.0,
                        });
                    }

                    screenFlashAlphaRef.current = 0.45;
                    activeTargetRef.current = null;
                    nextSpawnTimeRef.current = timestamp + getRandomSpawnDelay();
                }
            } else {
                if (timestamp >= nextSpawnTimeRef.current) {
                    const randomAngle = getRandomAngle(lastTargetIdRef.current);
                    lastTargetIdRef.current = randomAngle.id;

                    activeTargetRef.current = {
                        angleId: randomAngle.id,
                        spawnTime: timestamp,
                        duration: getTargetDuration(score),
                    };
                }
            }
        }

        // Render Backdrop
        if (bgImageRef.current && imageLoaded) {
            ctx.drawImage(bgImageRef.current, 0, 0, canvas.width, canvas.height);
        } else {
            drawProceduralBackdrop(ctx, canvas.width, canvas.height);
        }

        // Render Active Target
        const active = activeTargetRef.current;
        if (active && isActive) {
            const angle = PEEK_ANGLES.find((a) => a.id === active.angleId);
            if (angle) {
                const elapsed = timestamp - active.spawnTime;
                const pct = Math.max(0, 1 - elapsed / active.duration);
                drawTargetHeadCircle(ctx, angle.x, angle.y, angle.width, angle.height, pct);
            }
        }

        // Render Flash Overlay on damage
        if (screenFlashAlphaRef.current > 0) {
            ctx.fillStyle = `rgba(239, 68, 68, ${screenFlashAlphaRef.current})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            screenFlashAlphaRef.current -= 0.03;
        }

        updateParticles(ctx);
        drawCrosshair(ctx);

        animationFrameId.current = requestAnimationFrame(updateLoop);
    }

    // Load backdrop image with fallback support
    useEffect(() => {
        const img = new Image();
        img.src = '/images/ascent_a_main.png';
        img.onload = () => {
            bgImageRef.current = img;
            setImageLoaded(true);
        };
        img.onerror = () => {
            setImageLoaded(false);
        };

        const savedHigh = localStorage.getItem('aimsync_peeking_highscore');
        if (savedHigh) {
            setTimeout(() => {
                setHighScore(parseInt(savedHigh));
            }, 0);
        }
    }, []);

    function startDrill() {
        if (isActive) return;

        const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
            audioCtxRef.current = new AudioContextClass();
        }
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();

        setIsActive(true);
        setTimeLeft(GAME_DURATION_SEC);
        setScore(0);
        setTotalShots(0);
        setHits(0);
        setAccuracy(null);
        setDamageTaken(0);
        setLastReactionMs(null);
        feedbackParticlesRef.current = [];
        screenFlashAlphaRef.current = 0;

        nextSpawnTimeRef.current = performance.now() + 500;

        gameTimerIdRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    stopDrill();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = requestAnimationFrame(updateLoop);
    }

    function stopDrill() {
        setIsActive(false);
        activeTargetRef.current = null;

        if (gameTimerIdRef.current) {
            clearInterval(gameTimerIdRef.current);
            gameTimerIdRef.current = null;
        }

        setTotalShots((prevTotal) => {
            setHits((prevHits) => {
                if (prevTotal > 0) {
                    const acc = Math.round((prevHits / prevTotal) * 100);
                    setAccuracy(acc);
                }
                return prevHits;
            });
            return prevTotal;
        });

        setScore((finalScore) => {
            setHighScore((prevHigh) => {
                if (finalScore > prevHigh) {
                    localStorage.setItem('aimsync_peeking_highscore', finalScore.toString());
                    return finalScore;
                }
                return prevHigh;
            });
            return finalScore;
        });
    }

    function getCanvasCoords(e: React.MouseEvent<HTMLCanvasElement>) {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 400, y: 250 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height),
        };
    }

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isActive) {
            startDrill();
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const coords = getCanvasCoords(e);
        const clickX = coords.x;
        const clickY = coords.y;

        playSound('GUNSHOT');
        setTotalShots((prev) => prev + 1);

        const active = activeTargetRef.current;
        if (active) {
            const angle = PEEK_ANGLES.find((a) => a.id === active.angleId);
            if (angle) {
                const hLeft = angle.x - angle.width / 2;
                const hRight = angle.x + angle.width / 2;
                const hTop = angle.y - angle.height / 2;
                const hBottom = angle.y + angle.height / 2;

                if (clickX >= hLeft && clickX <= hRight && clickY >= hTop && clickY <= hBottom) {
                    playSound('DINK');
                    setHits((prev) => prev + 1);

                    const reactTime = Math.round(performance.now() - active.spawnTime);
                    setLastReactionMs(reactTime);

                    const ptsEarned = Math.max(100, 500 - reactTime);
                    setScore((prev) => prev + ptsEarned);

                    feedbackParticlesRef.current.push({
                        x: clickX,
                        y: clickY - 15,
                        text: `DINK! +${ptsEarned} (${reactTime}ms)`,
                        color: '#22c55e',
                        alpha: 1.0,
                    });

                    activeTargetRef.current = null;
                    nextSpawnTimeRef.current = performance.now() + getRandomSpawnDelay();
                    return;
                }
            }
        }

        setScore((prev) => Math.max(0, prev - 50));
        feedbackParticlesRef.current.push({
            x: clickX,
            y: clickY - 15,
            text: 'MISSED (-50)',
            color: '#94a3b8',
            alpha: 1.0,
        });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        mousePosRef.current = getCanvasCoords(e);
    };

    useEffect(() => {
        return () => {
            cancelAnimationFrame(animationFrameId.current);
            if (gameTimerIdRef.current) clearInterval(gameTimerIdRef.current);
            if (audioCtxRef.current) audioCtxRef.current.close();
        };
    }, []);

    return (
        <div className="flex flex-col items-center bg-[#08090c] p-6 rounded-3xl border border-white/10 shadow-2xl w-full max-w-4xl mx-auto">
            {/* Header Dashboard HUD */}
            <div className="w-full flex justify-between items-center mb-6 font-sans">
                <div>
                    <h2 className="text-[#3366ff] text-xs font-bold tracking-[0.4em] uppercase">AimSync Potato Engine</h2>
                    <h1 className="text-2xl font-black tracking-wider text-white uppercase">2.5D Flashcard Peeking</h1>
                </div>
                <div className="flex gap-6 text-right font-mono">
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">High Score</p>
                        <p className="text-xl font-black text-[#22c55e]">{highScore}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Score</p>
                        <p className="text-xl font-black text-white">{isActive ? score : '--'}</p>
                    </div>
                    {accuracy !== null && (
                        <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Accuracy</p>
                            <p className="text-xl font-black text-cyan-400">{accuracy}%</p>
                        </div>
                    )}
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Time Left</p>
                        <p className="text-xl font-black text-amber-500">{timeLeft}s</p>
                    </div>
                </div>
            </div>

            {/* The Canvas Workspace */}
            <div className="relative border border-white/10 rounded-2xl overflow-hidden shadow-inner cursor-none">
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={500}
                    onMouseDown={handleCanvasClick}
                    onMouseMove={handleMouseMove}
                    className="block"
                />

                {/* Instruction Overlay */}
                {!isActive && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none transition-all duration-300">
                        <p className="text-white text-lg font-black tracking-widest uppercase mb-2">CLICK CANVAS TO START PRE-AIM DRILL</p>
                        <p className="text-slate-400 text-xs max-w-md text-center leading-relaxed mb-4">
                            Pre-aim standard chokepoint angles (Ascent A-Main). Flat 2D head-level hit-circles spawn at common spots. Dink them before they shoot back!
                        </p>
                        <div className="flex gap-4 text-[10px] font-mono text-slate-400 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                            <span>Chokepoint: <strong className="text-white">Ascent A-Main</strong></span>
                            <span>Angles: <strong className="text-[#3366ff]">5 Pre-aim Spots</strong></span>
                        </div>
                    </div>
                )}
            </div>

            {/* Live Session Telemetry */}
            {(!isActive && (accuracy !== null || damageTaken > 0)) && (
                <div className="w-full grid grid-cols-4 gap-4 mt-6 p-4 bg-white/[0.02] border border-white/5 rounded-2xl font-mono text-center">
                    <div>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Dinks / Total Shots</p>
                        <p className="text-lg font-bold text-green-400">{hits} / {totalShots}</p>
                    </div>
                    <div>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Damage Taken</p>
                        <p className="text-lg font-bold text-red-400">{damageTaken}</p>
                    </div>
                    <div>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Last Reaction Speed</p>
                        <p className="text-lg font-bold text-cyan-400">{lastReactionMs !== null ? `${lastReactionMs}ms` : '--'}</p>
                    </div>
                    <div>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Final Score</p>
                        <p className="text-lg font-bold text-yellow-400">{score}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
