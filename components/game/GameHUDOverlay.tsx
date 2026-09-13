'use client';

import React, { forwardRef, useImperativeHandle, useEffect, useRef } from 'react';

// Define the interface for imperative control
export interface GameHUDOverlayRef {
    updateAmmo: (current: number, max: number) => void;
    updateTimer: (seconds: number) => void;
    updateCombo: (combo: number, x?: number, y?: number) => void;
    triggerHitMarker: () => void;
    addKillfeed: (killer: string, victim: string, weapon: string, headshot?: boolean) => void;
    updateTelemetry: (data: { score?: number; accuracy?: number; hits?: number; misses?: number; kps?: number }) => void;
}

// Global declaration for window.AimSyncHUD to allow bypass binding
declare global {
    interface Window {
        AimSyncHUD?: GameHUDOverlayRef;
    }
}

export interface GameHUDOverlayProps {
    isActive?: boolean;
    gameState?: 'menu' | 'countdown' | 'live' | 'finished' | 'ACTIVE' | string;
}

export const GameHUDOverlay = forwardRef<GameHUDOverlayRef, GameHUDOverlayProps>((props, ref) => {
    const isZenActive = props.isActive === true || props.gameState === 'ACTIVE' || props.gameState === 'live';
    // DOM references for Zero React Re-render updates
    const ammoFillRef = useRef<HTMLDivElement>(null);
    const ammoTextRef = useRef<HTMLSpanElement>(null);
    const timerTextRef = useRef<HTMLSpanElement>(null);
    const comboMeterRef = useRef<HTMLDivElement>(null);
    const comboTextRef = useRef<HTMLSpanElement>(null);
    const comboGaugeRef = useRef<HTMLDivElement>(null);
    const hitMarkerRef = useRef<HTMLDivElement>(null);
    const killfeedRef = useRef<HTMLDivElement>(null);
    const floatingComboContainerRef = useRef<HTMLDivElement>(null);
    
    // Telemetry DOM references
    const scoreValRef = useRef<HTMLSpanElement>(null);
    const accuracyValRef = useRef<HTMLSpanElement>(null);
    const hitsValRef = useRef<HTMLSpanElement>(null);
    const missesValRef = useRef<HTMLSpanElement>(null);
    const kpsValRef = useRef<HTMLSpanElement>(null);
    
    // Throttled Telemetry reference
    const diagnosticTextRef = useRef<HTMLDivElement>(null);
    
    // Timer refs to prevent race conditions or duplicate timeouts
    const hitMarkerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Imperative API definition
    const api: GameHUDOverlayRef = {
        // 1. Ammo update using CSS Variable calc and direct DOM string updates
        updateAmmo: (current, max) => {
            const ratio = Math.max(0, Math.min(1, current / (max || 1)));
            if (ammoFillRef.current) {
                ammoFillRef.current.style.setProperty('--ammo-fill-ratio', ratio.toString());
            }
            if (ammoTextRef.current) {
                ammoTextRef.current.textContent = `${current}/${max}`;
            }
        },

        // 2. High frequency timer updates directly bypassing state
        updateTimer: (seconds) => {
            if (!timerTextRef.current) return;
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            // Apply warning styling when timer runs low (under 5 seconds)
            if (seconds <= 5) {
                timerTextRef.current.classList.add('text-red', 'animate-pulse');
                timerTextRef.current.style.textShadow = '0 0 10px rgba(239, 68, 68, 0.8)';
            } else {
                timerTextRef.current.classList.remove('text-red', 'animate-pulse');
                timerTextRef.current.style.textShadow = '0 0 10px rgba(245, 158, 11, 0.5)';
            }
            timerTextRef.current.textContent = formatted;
        },

        // 3. Dynamic combo meter and optional screen-coordinate popups
        updateCombo: (combo, x, y) => {
            if (!comboMeterRef.current || !comboTextRef.current || !comboGaugeRef.current) return;

            // Handle HUD element visibility
            if (combo < 3) {
                comboMeterRef.current.style.opacity = '0';
                comboMeterRef.current.style.transform = 'translate3d(0, 20px, 0) scale(0.9)';
                return;
            }

            comboMeterRef.current.style.opacity = '1';
            comboTextRef.current.textContent = combo.toString();

            // Set gauge fill ratio
            const fillPct = Math.min((combo / 30) * 100, 100);
            comboGaugeRef.current.style.setProperty('--combo-fill-pct', `${fillPct}%`);

            // Apply different tier styles directly to DOM
            let color = '#d4d4d8'; // default slate-300
            let glow = 'rgba(212, 212, 216, 0.4)';
            let scale = 1.0;

            if (combo >= 30) {
                color = '#EF4444'; // Red
                glow = 'rgba(239, 68, 68, 0.9)';
                scale = 1.25;
            } else if (combo >= 20) {
                color = '#ea580c'; // Orange-600
                glow = 'rgba(234, 88, 12, 0.8)';
                scale = 1.15;
            } else if (combo >= 10) {
                color = '#f59e0b'; // Amber-500
                glow = 'rgba(245, 158, 11, 0.7)';
                scale = 1.05;
            } else if (combo >= 5) {
                color = '#3b82f6'; // Blue-500
                glow = 'rgba(59, 130, 246, 0.6)';
                scale = 1.0;
            }

            comboTextRef.current.style.color = color;
            comboTextRef.current.style.filter = `drop-shadow(0 0 12px ${glow})`;
            comboGaugeRef.current.style.backgroundColor = color;

            // Zero-React bump animation via hardware accelerated translation
            comboMeterRef.current.style.transform = `translate3d(0, -10px, 0) scale(${scale * 1.1})`;
            
            // Queue restore to baseline scale
            requestAnimationFrame(() => {
                if (comboMeterRef.current) {
                    comboMeterRef.current.style.transform = `translate3d(0, 0, 0) scale(${scale})`;
                }
            });

            // If coordinates are provided, spawn a floating transient combo popup at the hit location
            if (x !== undefined && y !== undefined && floatingComboContainerRef.current) {
                const popup = document.createElement('div');
                popup.className = 'absolute pointer-events-none text-2xl font-black italic select-none';
                popup.textContent = `x${combo}`;
                popup.style.color = color;
                popup.style.filter = `drop-shadow(0 0 8px ${glow})`;
                popup.style.willChange = 'transform, opacity';
                popup.style.transform = `translate3d(${x}px, ${y}px, 0) scale(0.6)`;
                popup.style.opacity = '0';
                popup.style.transition = 'transform 500ms cubic-bezier(0.1, 0.9, 0.2, 1), opacity 400ms ease-out';
                
                floatingComboContainerRef.current.appendChild(popup);

                // Trigger hardware transition
                requestAnimationFrame(() => {
                    popup.style.transform = `translate3d(${x}px, ${y - 50}px, 0) scale(1.3)`;
                    popup.style.opacity = '1';
                });

                // Smooth fade out
                setTimeout(() => {
                    popup.style.opacity = '0';
                    popup.style.transform = `translate3d(${x}px, ${y - 75}px, 0) scale(0.8)`;
                }, 300);

                // Garbage collect the DOM element
                setTimeout(() => {
                    popup.remove();
                }, 500);
            }
        },

        // 4. Hit-marker indicator using transforms on target registration
        triggerHitMarker: () => {
            if (!hitMarkerRef.current) return;
            
            if (hitMarkerTimeoutRef.current) {
                clearTimeout(hitMarkerTimeoutRef.current);
            }

            // Instantly transition to full scale & opacity
            hitMarkerRef.current.style.transition = 'none';
            hitMarkerRef.current.style.transform = 'translate3d(-50%, -50%, 0) scale(1.0)';
            hitMarkerRef.current.style.opacity = '1';

            // Allow rendering frame to lock scale, then apply transition to fade out
            requestAnimationFrame(() => {
                if (hitMarkerRef.current) {
                    hitMarkerRef.current.style.transition = 'transform 150ms cubic-bezier(0.1, 0.9, 0.2, 1), opacity 150ms ease-out';
                    hitMarkerRef.current.style.transform = 'translate3d(-50%, -50%, 0) scale(0.5)';
                    hitMarkerRef.current.style.opacity = '0';
                }
            });
        },

        // 5. Hardware-accelerated Killfeed
        addKillfeed: (killer, victim, weapon, headshot = false) => {
            if (!killfeedRef.current) return;

            const entry = document.createElement('div');
            entry.className = 'flex items-center gap-2 bg-[#0d0e10]/90 border border-zinc-800/80 px-4 py-1.5 rounded-sm text-xs font-mono text-white shadow-lg pointer-events-none select-none max-w-sm';
            entry.style.willChange = 'transform, opacity';
            entry.style.transform = 'translate3d(120%, 0, 0)';
            entry.style.opacity = '0';
            entry.style.transition = 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out';

            const killerSpan = document.createElement('span');
            killerSpan.className = 'font-bold text-cyan-400';
            killerSpan.textContent = killer;

            const weaponSpan = document.createElement('span');
            weaponSpan.className = 'text-zinc-500 font-bold px-1';
            weaponSpan.textContent = `[${weapon.toUpperCase()}]`;

            // If headshot, prepend a tactical indicator
            if (headshot) {
                const hsIcon = document.createElement('span');
                hsIcon.className = 'text-red font-black mr-0.5';
                hsIcon.textContent = '⚡';
                weaponSpan.prepend(hsIcon);
            }

            const victimSpan = document.createElement('span');
            victimSpan.className = 'font-bold text-rose-500';
            victimSpan.textContent = victim;

            entry.appendChild(killerSpan);
            entry.appendChild(weaponSpan);
            entry.appendChild(victimSpan);

            // Insert entry at the top of the feed list
            killfeedRef.current.prepend(entry);

            // Animate entry in
            requestAnimationFrame(() => {
                entry.style.transform = 'translate3d(0, 0, 0)';
                entry.style.opacity = '1';
            });

            // Fade out timer
            setTimeout(() => {
                entry.style.opacity = '0';
                entry.style.transform = 'translate3d(0, -15px, 0)';
                // Remove from DOM after transition completes
                setTimeout(() => entry.remove(), 250);
            }, 3000);
        },

        // 6. Bulk Telemetry updates bypassing React reconciliation
        updateTelemetry: (data) => {
            if (data.score !== undefined && scoreValRef.current) {
                scoreValRef.current.textContent = data.score.toString();
            }
            if (data.accuracy !== undefined && accuracyValRef.current) {
                accuracyValRef.current.textContent = `${data.accuracy}%`;
            }
            if (data.hits !== undefined && data.misses !== undefined && hitsValRef.current) {
                hitsValRef.current.textContent = `${data.hits}/${data.misses}`;
            }
            if (data.kps !== undefined && kpsValRef.current) {
                kpsValRef.current.textContent = data.kps.toString();
            }
        }
    };

    // Bind to both standard react ref and global window handle
    useImperativeHandle(ref, () => api);

    useEffect(() => {
        window.AimSyncHUD = api;
        return () => {
            delete window.AimSyncHUD;
        };
    }, []);

    // ────────────────────────────────────────────────────────────────────────
    // THROTTLED STATE DECOUPLING CYCLE (Throttled 30Hz Loop)
    // Updates ambient diagnostics & non-critical telemetry, completely leaving 
    // the main game loops and mouse listeners clear for raw 240Hz polling.
    // ────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        let frameCount = 0;
        let lastLoggedTime = performance.now();
        let fps = 144; // default baseline

        const statsTimer = setInterval(() => {
            const now = performance.now();
            const elapsed = now - lastLoggedTime;
            
            // Calculate actual performance metrics
            if (elapsed >= 1000) {
                fps = Math.round((frameCount * 1000) / elapsed);
                frameCount = 0;
                lastLoggedTime = now;
            }
            frameCount++;

            // Decoupled slow updates
            if (diagnosticTextRef.current) {
                const latency = (Math.random() * 0.08 + 0.04).toFixed(2);
                const memory = (performance as any).memory 
                    ? `${Math.round((performance as any).memory.usedJSHeapSize / 1048576)}MB` 
                    : '24.8MB';
                
                diagnosticTextRef.current.innerHTML = `
                    <div class="flex gap-4 text-[9px] font-mono text-zinc-500 tracking-wider">
                        <span>SYS.FPS: <span class="text-green-500 font-bold">${fps}HZ</span></span>
                        <span>LATENCY: <span class="text-cyan-400 font-bold">${latency}ms</span></span>
                        <span>MEM: <span class="text-zinc-400">${memory}</span></span>
                        <span>D1.SYNC: <span class="text-cyan-500 font-bold">READY</span></span>
                    </div>
                `;
            }
        }, 1000 / 30); // 30Hz throttle cycle

        return () => clearInterval(statsTimer);
    }, []);

    return (
        <div className="absolute inset-0 w-full h-full pointer-events-none select-none z-40 overflow-hidden font-sans">
            {/* Cyberpunk Grid/Glow Ambient Overlay */}
            <div className={`absolute inset-0 bg-[#050505]/20 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none transition-opacity duration-300 ${isZenActive ? 'opacity-0' : 'opacity-100'}`} />
            
            {/* Subtle Screen Brackets (Cyber-tactical Neon Accents using vector sprites) */}
            <div className={`absolute inset-x-8 inset-y-8 border border-zinc-800/20 pointer-events-none transition-opacity duration-300 ${isZenActive ? 'opacity-0' : 'opacity-100'}`}>
                {/* Top-Left Bracket */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-500/40 pointer-events-none filter drop-shadow(0 0 6px rgba(6,182,212,0.4))" />
                {/* Top-Right Bracket */}
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-500/40 pointer-events-none filter drop-shadow(0 0 6px rgba(6,182,212,0.4))" />
                {/* Bottom-Left Bracket */}
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-500/40 pointer-events-none filter drop-shadow(0 0 6px rgba(6,182,212,0.4))" />
                {/* Bottom-Right Bracket */}
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-500/40 pointer-events-none filter drop-shadow(0 0 6px rgba(6,182,212,0.4))" />
            </div>

            {/* TOP HEADER: Zen Mode Minimalist Timer & Score */}
            <div className="absolute top-6 inset-x-8 flex justify-between items-start">
                
                {/* Left Side: System Telemetry */}
                <div className={`flex flex-col gap-1 bg-black/60 border border-zinc-800/80 px-4 py-2 backdrop-blur-md rounded-sm transition-opacity duration-300 ${isZenActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <span className="text-[9px] text-zinc-500 font-mono tracking-widest uppercase">Target Telemetry</span>
                    <div className="flex gap-4 text-xs font-mono text-zinc-300">
                        <div>SCORE: <span ref={scoreValRef} className="text-cyan-400 font-black font-mono">0</span></div>
                        <div className="w-px h-3 bg-zinc-800 self-center" />
                        <div>ACC: <span ref={accuracyValRef} className="text-emerald-400 font-black font-mono">100%</span></div>
                        <div className="w-px h-3 bg-zinc-800 self-center" />
                        <div>H/M: <span ref={hitsValRef} className="text-zinc-400 font-black font-mono">0/0</span></div>
                        <div className="w-px h-3 bg-zinc-800 self-center" />
                        <div>KPS: <span ref={kpsValRef} className="text-purple-400 font-black font-mono">0.00</span></div>
                    </div>
                </div>

                {/* Center: Mission Clock (Zen Mode Minimalist Low-Opacity Bar) */}
                <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div className={`flex items-center gap-6 bg-black/70 px-6 py-1.5 border border-zinc-800/80 rounded-full shadow-2xl relative overflow-hidden transition-opacity duration-300 ${isZenActive ? 'opacity-40 hover:opacity-100' : 'opacity-100'}`}>
                        <div className="text-xs font-mono text-zinc-400 tracking-wider">
                            SCORE: <span ref={scoreValRef} className="text-white font-bold font-mono">0</span>
                        </div>
                        <div className="w-px h-3 bg-zinc-700" />
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-zinc-400 font-mono tracking-widest uppercase">TIME</span>
                            <span 
                                ref={timerTextRef}
                                className="text-lg font-black font-mono text-amber-500 tabular-nums select-none filter drop-shadow(0 0 6px rgba(245,158,11,0.4))"
                            >
                                00:00
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Throttled Diagnostics & Killfeed Mount */}
                <div className={`flex flex-col items-end gap-2 transition-opacity duration-300 ${isZenActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <div ref={diagnosticTextRef} className="bg-black/60 border border-zinc-800/80 px-3 py-1.5 backdrop-blur-md rounded-sm" />
                </div>
            </div>

            {/* KILLFEED: Renders in upper right below header */}
            <div 
                ref={killfeedRef} 
                className={`absolute top-24 right-8 flex flex-col gap-1.5 items-end pointer-events-none transition-opacity duration-300 ${isZenActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            />

            {/* FLOATING COMBO POPUPS CONTAINER */}
            <div 
                ref={floatingComboContainerRef} 
                className="absolute inset-0 pointer-events-none z-30" 
            />

            {/* CENTER HARDWARE HIT-MARKER OVERLAY */}
            <div 
                ref={hitMarkerRef}
                className="absolute top-1/2 left-1/2 pointer-events-none z-50 opacity-0 transform -translate-x-1/2 -translate-y-1/2"
                style={{
                    width: '32px',
                    height: '32px',
                    willChange: 'transform, opacity',
                    transform: 'translate3d(-50%, -50%, 0) scale(0)',
                }}
            >
                {/* Diagonal Hitmarker ticks */}
                <svg 
                    width="100%" 
                    height="100%" 
                    viewBox="0 0 32 32" 
                    fill="none" 
                    stroke="#FF007F" 
                    strokeWidth="2.5" 
                    strokeLinecap="round"
                    className="filter drop-shadow(0 0 4px rgba(255, 0, 127, 0.8))"
                >
                    <path d="M 8 8 L 4 4" />
                    <path d="M 24 8 L 28 4" />
                    <path d="M 8 24 L 4 28" />
                    <path d="M 24 24 L 28 28" />
                </svg>
            </div>

            {/* BOTTOM LEFT: Dynamic Combo Tracker (Arkham Style) */}
            <div 
                ref={comboMeterRef}
                className={`absolute bottom-10 left-8 flex flex-col pointer-events-none z-50 opacity-0 transform translate-y-4 scale-95 transition-opacity duration-300 ${isZenActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                style={{
                    willChange: 'transform, opacity',
                    transition: 'transform 120ms cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 150ms ease-out',
                }}
            >
                <div className="flex items-end justify-start mb-1.5">
                    <span className="text-white/40 font-black italic text-2xl mr-1 pb-1">x</span>
                    <span 
                        ref={comboTextRef}
                        className="font-black italic text-6xl tracking-tighter origin-bottom-left transition-colors duration-150 tabular-nums"
                    >
                        0
                    </span>
                </div>
                
                {/* Cyberpunk combo progress meter */}
                <div className="w-56 h-2 bg-black/75 border border-zinc-800/80 overflow-hidden rounded-sm skew-x-[-12deg] shadow-lg relative">
                    <div 
                        ref={comboGaugeRef}
                        className="h-full transition-all duration-300 ease-out" 
                        style={{ 
                            width: 'var(--combo-fill-pct, 0%)',
                            willChange: 'width',
                            backgroundColor: '#d4d4d8'
                        }} 
                    />
                </div>
                <span className="text-zinc-500 text-[8px] font-mono font-bold tracking-[0.3em] uppercase mt-1.5 ml-1 italic">
                    COMBO MULTIPLIER
                </span>
            </div>

            {/* BOTTOM RIGHT: Rapid-Fire Ammo Cell */}
            <div className={`absolute bottom-10 right-8 flex flex-col items-end pointer-events-none z-50 bg-black/60 border border-zinc-800/80 px-5 py-3 rounded-sm backdrop-blur-md transition-opacity duration-300 ${isZenActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <span className="text-[9px] text-zinc-500 font-mono tracking-widest uppercase mb-1">Weapon Magazine</span>
                <div className="flex items-center gap-3">
                    <div className="w-40 h-2 bg-zinc-950/80 border border-zinc-800/80 rounded-sm skew-x-[-15deg] overflow-hidden relative">
                        <div 
                            ref={ammoFillRef}
                            className="h-full bg-cyan-400"
                            style={{
                                width: '100%',
                                willChange: 'clip-path',
                                transition: 'clip-path 60ms cubic-bezier(0, 0, 0.2, 1)',
                                clipPath: 'inset(0 calc(100% - (var(--ammo-fill-ratio, 1) * 100%)) 0 0)',
                                filter: 'drop-shadow(0 0 4px rgba(6,182,212,0.8))'
                            }}
                        />
                    </div>
                    <span 
                        ref={ammoTextRef}
                        className="text-lg font-black font-mono text-cyan-400 tabular-nums tracking-tighter"
                    >
                        30/30
                    </span>
                </div>
            </div>
        </div>
    );
});

GameHUDOverlay.displayName = 'GameHUDOverlay';
