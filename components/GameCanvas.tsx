'use client';

import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSearchParams, useRouter } from 'next/navigation';

// Stores & Components
import WeaponModel from './WeaponModel';
import TargetManager from './TargetManager';
import TrackingManager from './TrackingManager';
import { useWeaponStore } from '@/store/weaponStore';
import { useRecoil } from '@/hooks/UseRecoil';
import { useGameStore } from '@/store/gameStore';
import { StorageEngine } from '@/lib/utils/storage';
import { useRawInput } from '@/hooks/useRawInput';
import { useWeaponAudio } from '@/hooks/useWeaponAudio';
import { GameHUDOverlay, GameHUDOverlayRef } from './game/GameHUDOverlay';
import ResolutionGuard from '@/components/guards/ResolutionGuard';

// Reusable Vector2 reference to prevent GC allocation in the 144Hz loop
const CENTER_COORDS = new THREE.Vector2(0, 0);

// --- THE 3D ENGINE CORE ---
function EngineCore({ targetScale, activeMode }: { targetScale: number, activeMode: string }) {
    const { camera, scene } = useThree();
    const activeWeapon = useWeaponStore((state) => state.activeWeapon);

    const { startFiring, stopFiring, getShotTrajectory } = useRecoil(activeWeapon);
    const { recordShot, recordHit, recordMiss } = useGameStore();
    const { playFire } = useWeaponAudio();

    const raycaster = useRef(new THREE.Raycaster());
    const pendingShot = useRef(false);

    // Ammo tracking (Zero React re-render)
    const maxAmmo = activeWeapon?.magSize || 30;
    const ammoRef = useRef(maxAmmo);
    const isReloading = useRef(false);

    const startTimeRef = useRef(performance.now());

    // Reset ammo on gun swap
    useEffect(() => {
        ammoRef.current = activeWeapon?.magSize || 30;
        window.AimSyncHUD?.updateAmmo(ammoRef.current, activeWeapon?.magSize || 30);
        isReloading.current = false;
    }, [activeWeapon]);

    // Reset start time on mode swap
    useEffect(() => {
        startTimeRef.current = performance.now();
    }, [activeMode]);

    // Keyboard listener for manual reload
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'r' && ammoRef.current < maxAmmo && !isReloading.current) {
                isReloading.current = true;
                // Simulating weapon reload (1.2s)
                setTimeout(() => {
                    ammoRef.current = maxAmmo;
                    window.AimSyncHUD?.updateAmmo(ammoRef.current, maxAmmo);
                    isReloading.current = false;
                }, 1200);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [maxAmmo]);

    // Dynamic mouse sensitivity loader
    const [sensitivity, setSensitivity] = useState(1.0);
    useEffect(() => {
        const { getStoredSettings } = require('@/lib/utils/userSettingsStorage');
        setSensitivity(getStoredSettings().sensitivity);
    }, []);

    const { addRecoil } = useRawInput({ sensitivity });

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 0) {
                startFiring();
                pendingShot.current = true; // Queue the shot for the next 3D frame
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (e.button === 0) stopFiring();
        };

        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [startFiring, stopFiring]);

    // Offload all aiming/shooting calculations to the 60+ FPS useFrame loop
    // This completely decouples 3D physics from the React main thread / DOM event loop
    useFrame(() => {
        if (pendingShot.current) {
            pendingShot.current = false; // Consume the shot

            if (isReloading.current) return;

            if (ammoRef.current <= 0) {
                // Auto reload if player attempts to fire empty weapon
                isReloading.current = true;
                setTimeout(() => {
                    ammoRef.current = maxAmmo;
                    window.AimSyncHUD?.updateAmmo(ammoRef.current, maxAmmo);
                    isReloading.current = false;
                }, 1200);
                return;
            }

            // Decrement Ammo ref & push to HUD directly
            ammoRef.current--;
            window.AimSyncHUD?.updateAmmo(ammoRef.current, maxAmmo);

            recordShot();

            // Play firing sound instantly
            if (activeWeapon && activeWeapon.id) {
                playFire(activeWeapon.id);
            }

            // Calculate and apply camera recoil kickback
            const trajectory = getShotTrajectory();
            // In Three.js, vertical kick climbs upwards which translates to negative local X rotation.
            // Adjust coefficients to align recoil magnitude with 3D space movement.
            addRecoil(-trajectory.kickY * 0.45, trajectory.kickX * 0.45, (Math.random() - 0.5) * 0.015);

            // Raycast logic with zero allocation
            raycaster.current.setFromCamera(CENTER_COORDS, camera);

            // Filter scene elements to inspect only active target meshes (strict raycast filtering)
            const targets: THREE.Object3D[] = [];
            for (const child of scene.children) {
                if (child.type === 'Group') {
                    for (const subChild of child.children) {
                        if (subChild.name === 'target' || subChild.name === 'tracking-target') {
                            targets.push(subChild);
                        } else if (subChild.type === 'Group') {
                            for (const mesh of subChild.children) {
                                if (mesh.name === 'target') {
                                    targets.push(mesh);
                                }
                            }
                        }
                    }
                }
            }

            const intersects = raycaster.current.intersectObjects(targets, true);

            const updateHUDStats = (isHit: boolean) => {
                const currentStore = useGameStore.getState();
                const newScore = currentStore.score;
                const totalShots = currentStore.shotsFired;
                const accuracy = Math.round((newScore / Math.max(1, totalShots)) * 100);
                const elapsed = (performance.now() - startTimeRef.current) / 1000;
                const kps = elapsed > 0 ? (newScore / elapsed).toFixed(2) : '0.00';

                window.AimSyncHUD?.updateTelemetry({
                    score: newScore,
                    accuracy: accuracy,
                    hits: newScore,
                    misses: totalShots - newScore,
                    kps: parseFloat(kps)
                });
                
                if (!isHit) {
                    window.AimSyncHUD?.updateCombo(0);
                }
            };

            if (intersects.length > 0) {
                const hitObject = intersects[0].object;
                if (hitObject.name === 'target') {
                    // The Death Lock: Prevents ghost-spawns
                    if (!hitObject.userData.isDead) {
                        hitObject.userData.isDead = true;
                        
                        if (hitObject.userData.isFriendly) {
                            // Protocol 2: Left-clicking a friendly mesh instantly resets combo
                            recordMiss();
                            updateHUDStats(false);
                        } else {
                            // Protocol 1: Echolocation sound tracking reaction check
                            if (activeMode === 'echolocation') {
                                const delta = performance.now() - hitObject.userData.spawnTime;
                                const reactionWindow = 750; // 750ms reaction window
                                if (delta <= reactionWindow) {
                                    recordHit(30); // Max score multiplier (3x base XP)
                                } else {
                                    recordHit(10);
                                }
                            } else {
                                recordHit(10);
                            }

                            // Trigger hitmarker on the HUD
                            window.AimSyncHUD?.triggerHitMarker();

                            // Compute projected screen coordinates to spawn floating combo text directly on target
                            const tempV = new THREE.Vector3();
                            hitObject.getWorldPosition(tempV);
                            tempV.project(camera);
                            const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
                            const y = (-(tempV.y * 0.5) + 0.5) * window.innerHeight;

                            const currentStore = useGameStore.getState();
                            const newCombo = currentStore.combo;
                            
                            window.AimSyncHUD?.updateCombo(newCombo, x, y);
                            updateHUDStats(true);

                            // Push to killfeed
                            const isHeadshot = Math.random() > 0.6;
                            window.AimSyncHUD?.addKillfeed('Player', 'Hostile', activeWeapon?.name || 'Pistol', isHeadshot);
                        }

                        if (hitObject.userData.onHit) {
                            hitObject.userData.onHit(hitObject.userData.id);
                        }
                    }
                } else if (hitObject.name !== 'tracking-target') {
                    recordMiss();
                    updateHUDStats(false);
                }
            } else {
                recordMiss();
                updateHUDStats(false);
            }
        }
    });

    return (
        <>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 10]} intensity={1} />

            {/* Render the correct manager based on activeMode */}
            {(activeMode === 'static-flick' || activeMode === 'echolocation' || activeMode === 'cognitive-overdrive') && (
                <TargetManager targetScale={targetScale} activeMode={activeMode} />
            )}
            {(activeMode === 'continuous-track' || activeMode === 'recoil-reactive' || activeMode === 'recoil-evasion') && (
                <TrackingManager targetScale={targetScale} activeMode={activeMode} />
            )}

            {/* Fallback if mode isn't built yet */}
            {activeMode !== 'static-flick' && 
             activeMode !== 'echolocation' && 
             activeMode !== 'cognitive-overdrive' && 
             activeMode !== 'continuous-track' && 
             activeMode !== 'recoil-reactive' && 
             activeMode !== 'recoil-evasion' && (
                <TargetManager targetScale={targetScale} activeMode={activeMode} />
            )}

            {activeWeapon && <WeaponModel weaponType={activeWeapon?.type || 'pistol'} />}
        </>
    );
}

// --- THE MATCH CONTROLLER & SEQUENCE ENGINE ---
export default function GameCanvas() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // 1. URL Parameter Parsing
    const playlistId = searchParams.get('playlist');
    const paramMode = searchParams.get('mode') || 'static-flick';
    const paramTime = parseInt(searchParams.get('time') || '0', 10);
    const paramDiff = searchParams.get('diff') || 'Bonus';

    // 2. Sequence State
    const [playlistTasks, setPlaylistTasks] = useState<any[]>([]);
    const [currentTaskIndex, setCurrentTaskIndex] = useState(0);

    // Match State (decoupling high-frequency timer ticks from state)
    const [activeMode, setActiveMode] = useState(paramMode);
    const [timeLimit, setTimeLimit] = useState(paramTime);
    const [difficulty, setDifficulty] = useState(paramDiff);
    const [isMatchOver, setIsMatchOver] = useState(false);

    const timeLeftRef = useRef(paramTime);
    const hudRef = useRef<GameHUDOverlayRef>(null);

    // 3. Playlist/Task Initialization
    useEffect(() => {
        if (playlistId) {
            const allPlaylists = StorageEngine.getPlaylists();
            const foundPlaylist = allPlaylists.find(p => p.id === playlistId);

            if (foundPlaylist && foundPlaylist.tasks.length > 0) {
                setPlaylistTasks(foundPlaylist.tasks);

                // Load the first task of the sequence
                const firstTask = foundPlaylist.tasks[0];
                setActiveMode(firstTask.mode);
                setDifficulty(firstTask.difficulty);
                setTimeLimit(firstTask.timeLimit);
                timeLeftRef.current = firstTask.timeLimit;
            }
        } else {
            // Standard single-mode deployment
            setActiveMode(paramMode);
            setDifficulty(paramDiff);
            setTimeLimit(paramTime);
            timeLeftRef.current = paramTime;
        }
    }, [playlistId, paramMode, paramTime, paramDiff]);

    // Reset global state store on active mode changes & sync HUD
    useEffect(() => {
        useGameStore.getState().reset();
        
        // Wait for HUD overlay mounting before pushing initial values
        const initHUD = () => {
            if (window.AimSyncHUD) {
                window.AimSyncHUD.updateTimer(timeLimit);
                const currentWeapon = useWeaponStore.getState().activeWeapon;
                window.AimSyncHUD.updateAmmo(currentWeapon?.magSize || 30, currentWeapon?.magSize || 30);
                window.AimSyncHUD.updateCombo(0);
                window.AimSyncHUD.updateTelemetry({ score: 0, accuracy: 100, hits: 0, misses: 0, kps: 0 });
            } else {
                requestAnimationFrame(initHUD);
            }
        };
        initHUD();
    }, [activeMode, timeLimit, currentTaskIndex]);

    const [isPointerLocked, setIsPointerLocked] = useState(false);

    useEffect(() => {
        const handleLockChange = () => {
            const locked = !!document.pointerLockElement;
            setIsPointerLocked(locked);
        };
        document.addEventListener('pointerlockchange', handleLockChange);
        return () => document.removeEventListener('pointerlockchange', handleLockChange);
    }, []);

    const handleFocusClick = () => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            try {
                const res = (canvas.requestPointerLock as any)({ unadjustedMovement: true });
                if (res && typeof res.catch === 'function') res.catch(() => canvas.requestPointerLock());
            } catch {
                canvas.requestPointerLock();
            }
        }
    };

    // 4. The Countdown Timer (zero-re-render update loop)
    useEffect(() => {
        if (timeLimit <= 0) return; // Freeplay sandbox mode

        const timer = setInterval(() => {
            if (!document.pointerLockElement) return; // Timer paused until user clicks & locks crosshair
            timeLeftRef.current -= 1;
            
            // Push directly to UI Layer
            if (hudRef.current) {
                hudRef.current.updateTimer(timeLeftRef.current);
            } else {
                window.AimSyncHUD?.updateTimer(timeLeftRef.current);
            }

            if (timeLeftRef.current <= 0) {
                clearInterval(timer);
                setIsMatchOver(true);
                // Automatically unlock pointer so they can click the Next Task button
                document.exitPointerLock?.();
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLimit, currentTaskIndex]); // Restart timer if task index changes

    // 5. Tactical Difficulty Scaler
    const getTargetScale = () => {
        const norm = difficulty.toLowerCase().trim();
        if (norm === 'eco' || norm === 'easy') return 1.1;
        if (norm === 'bonus' || norm === 'medium' || norm === 'normal') return 0.85;
        if (norm === 'force buy' || norm === 'force-buy' || norm === 'hard') return 0.65;
        if (norm === 'full buy' || norm === 'full-buy' || norm === 'extreme') return 0.45;
        return 0.85;
    };

    // 6. Sequence Logic (Next Task)
    const handleNextTask = () => {
        if (currentTaskIndex + 1 < playlistTasks.length) {
            const nextIndex = currentTaskIndex + 1;
            const nextTask = playlistTasks[nextIndex];

            setCurrentTaskIndex(nextIndex);
            setActiveMode(nextTask.mode);
            setDifficulty(nextTask.difficulty);
            setTimeLimit(nextTask.timeLimit);
            timeLeftRef.current = nextTask.timeLimit;
            setIsMatchOver(false);
        } else {
            document.exitPointerLock?.();
            document.exitFullscreen?.().catch(() => {});
            useGameStore.getState().reset();
            router.push('/dashboard');
        }
    };

    const handleAbortToHub = () => {
        document.exitPointerLock?.();
        document.exitFullscreen?.().catch(() => {});
        useGameStore.getState().reset();
        router.push('/dashboard');
    };

    // --- RESULTS / BRIEFING SCREEN ---
    if (isMatchOver) {
        const isPlaylist = playlistTasks.length > 0;
        const hasNext = isPlaylist && currentTaskIndex + 1 < playlistTasks.length;

        return (
            <div className="w-full h-screen bg-[#121212] flex flex-col items-center justify-center text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[#3366FF]/10 blur-[100px] pointer-events-none rounded-full scale-150" />

                <h1 className="text-6xl font-black text-[#3366FF] mb-4 uppercase tracking-widest relative z-10">Time Up</h1>

                {isPlaylist && (
                    <p className="text-sm font-mono text-slate-400 mb-2 relative z-10">
                        Task {currentTaskIndex + 1} of {playlistTasks.length} Complete
                    </p>
                )}

                <p className="text-xl text-slate-300 mb-12 relative z-10">
                    Data recorded. Preparing next phase.
                </p>

                <div className="flex gap-4 relative z-10">
                    <button
                        onClick={handleAbortToHub}
                        className="px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 font-bold uppercase tracking-widest rounded transition-all"
                    >
                        Abort Sequence
                    </button>

                    {hasNext ? (
                        <button
                            onClick={handleNextTask}
                            className="px-8 py-4 bg-[#3366FF] hover:bg-blue-500 font-black uppercase tracking-widest rounded transition-colors shadow-[0_0_20px_rgba(51,102,255,0.3)]"
                        >
                            Deploy Next Task
                        </button>
                    ) : (
                        <button
                            onClick={handleAbortToHub}
                            className="px-8 py-4 bg-[#3366FF] hover:bg-blue-500 font-black uppercase tracking-widest rounded transition-colors shadow-[0_0_20px_rgba(51,102,255,0.3)]"
                        >
                            Return to Mission Control
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // --- REGULAR GAME RENDER ---
    return (
        <ResolutionGuard>
            <div className="w-full h-screen bg-zinc-900 relative overflow-hidden">

                <div className="absolute top-4 left-4 z-50 text-white/50 font-mono text-[10px] uppercase tracking-widest pointer-events-none">
                    {activeMode.replace('-', ' ')} // {difficulty} // Click to lock crosshair
                </div>

                {/* Playlist Progress Tracker */}
                {playlistTasks.length > 0 && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 mt-2 flex gap-1 z-50 pointer-events-none">
                        {playlistTasks.map((_, i) => (
                            <div key={i} className={`h-1.5 w-6 rounded-full ${i <= currentTaskIndex ? 'bg-[#3366FF] shadow-[0_0_10px_rgba(51,102,255,0.8)]' : 'bg-white/10'}`} />
                        ))}
                    </div>
                )}

                {/* Sleek Click to Focus & Lock Crosshair Overlay */}
                {!isPointerLocked && !isMatchOver && (
                    <div
                        onClick={handleFocusClick}
                        className="absolute inset-0 z-[150] flex flex-col items-center justify-center bg-black/75 backdrop-blur-md cursor-pointer animate-in fade-in duration-200"
                    >
                        <div className="p-8 border border-white/10 bg-[#121212]/95 rounded-2xl text-center shadow-2xl space-y-4 max-w-md pointer-events-auto">
                            <div className="w-14 h-14 rounded-full bg-[#3366FF]/20 border border-[#3366FF] flex items-center justify-center mx-auto text-[#3366FF] text-2xl font-bold animate-pulse">
                                🎯
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-widest text-white">
                                {timeLeftRef.current < timeLimit ? "Click to Resume" : "Click to Focus & Lock Crosshair"}
                            </h2>
                            <p className="text-xs text-slate-400 font-mono tracking-wider">
                                Unconstrained raw mouse input active. Press ESC anytime to pause session.
                            </p>
                            <div className="pt-2">
                                <span className="px-6 py-3 bg-[#3366FF] text-white font-black text-xs uppercase tracking-widest rounded-lg inline-block shadow-[0_0_20px_rgba(51,102,255,0.4)]">
                                    Engage Lock
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <Canvas>
                    <EngineCore targetScale={getTargetScale()} activeMode={activeMode} />
                </Canvas>

                {/* Zero Re-Render HUD Overlay */}
                <GameHUDOverlay ref={hudRef} isActive={!isMatchOver} gameState={isMatchOver ? "finished" : "ACTIVE"} />
            </div>
        </ResolutionGuard>
    );
}