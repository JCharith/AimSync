"use client";

import React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";



// --- ACTIVE PROTOCOLS ---
import StaticFlick from "@/components/modes/StaticFlick";
import SensitivityFinder from "@/components/modes/SensitivityFinder";
import TrackingMode from "@/components/modes/TrackingMode";
import TargetSwitch from "@/components/modes/TargetSwitch";
import BurstReaction from "@/components/modes/BurstReaction";
import MicroAdjust from "@/components/modes/MicroAdjust";
import RoutineRunner from "@/components/modes/RoutineRunner";
import ReactionTest from "@/components/modes/ReactionTest";
import FlickBenchmark from "@/components/modes/FlickBenchmark";
import ConsistencyCheck from "@/components/modes/ConsistencyCheck";
import CustomRoutine from "@/components/modes/CustomRoutine";
import Echolocation from "@/components/modes/Echolocation";
import CognitiveOverdrive from "@/components/modes/CognitiveOverdrive";
import RecoilReactiveEvasion from "@/components/modes/RecoilReactiveEvasion";
import BlindFlick from "@/components/modes/BlindFlick";
import JigglePeek from "@/components/modes/JigglePeek";
import { DEFAULT_ROUTINES } from "@/lib/utils/routineEngine";
import { Difficulty } from "@/lib/utils/drillConfig";
import { proPlaylists } from "@/lib/config/proPlaylists";
import type { Routine } from "@/lib/game/types";

export type Mode =
    | "menu"
    | "static-flick"
    | "tracking-mode"
    | "target-switch"
    | "burst-reaction"
    | "micro-adjust"
    | "sensitivity-finder"
    | "consistency-check"
    | "custom-routine"
    | "flick-benchmark"
    | "reaction-test"
    | "echolocation"
    | "cognitive-overdrive"
    | "recoil-evasion"
    | "blind-flick"
    | "jiggle-peek";

const ModeRegistry: Record<Exclude<Mode, "menu">, React.ElementType<any>> = {
    "static-flick": StaticFlick,
    "tracking-mode": TrackingMode,
    "target-switch": TargetSwitch,
    "burst-reaction": BurstReaction,
    "micro-adjust": MicroAdjust,
    "sensitivity-finder": SensitivityFinder,
    "consistency-check": ConsistencyCheck,
    "custom-routine": CustomRoutine,
    "flick-benchmark": FlickBenchmark,
    "reaction-test": ReactionTest,
    "echolocation": Echolocation,
    "cognitive-overdrive": CognitiveOverdrive,
    "recoil-evasion": RecoilReactiveEvasion,
    "blind-flick": BlindFlick,
    "jiggle-peek": JigglePeek,
};



export const protocolCards: { id: Exclude<Mode, "menu">; category: string; title: string; desc: string; color: string }[] = [
    // ... (keep your exact protocolCards array here)
    { id: "static-flick", category: "Combat", title: "Static Flick", desc: "Develop raw mechanical memory and stopping power.", color: "#3366FF" },
    { id: "tracking-mode", category: "Dynamic", title: "Continuous Tracking", desc: "Engage erratic targets to develop crosshair prediction.", color: "#06b6d4" },
    { id: "target-switch", category: "Cognitive", title: "Target Switch", desc: "Rapidly identify and eliminate the correct target hidden among decoys.", color: "#1DB954" },
    { id: "burst-reaction", category: "Reflex", title: "Burst Reaction", desc: "Engage rapid target clusters to build combo multipliers.", color: "#f97316" },
    { id: "micro-adjust", category: "Precision", title: "Micro Adjust", desc: "Master tiny, pixel-perfect mouse corrections.", color: "#f43f5e" },
    { id: "reaction-test", category: "Baseline", title: "Reaction Test", desc: "Pure neurological stimulus response testing.", color: "#eab308" },
    { id: "flick-benchmark", category: "Evaluation", title: "Flick Benchmark", desc: "Standardized testing protocol to rank flicking accuracy.", color: "#ec4899" },
    { id: "consistency-check", category: "Evaluation", title: "Consistency Check", desc: "Test variance in performance over prolonged engagements.", color: "#8b5cf6" },
    { id: "custom-routine", category: "Playlist", title: "Custom Routine", desc: "Execute user-defined training playlists.", color: "#64748b" },
    { id: "sensitivity-finder", category: "Diagnostic", title: "Sens Matrix", desc: "Mathematical analysis to calculate optimal mouse sensitivity.", color: "#8A2BE2" },
    { id: "echolocation", category: "Perception", title: "Echolocation", desc: "Rely on spatial audio to snap to targets behind you.", color: "#06b6d4" },
    { id: "cognitive-overdrive", category: "Cognitive", title: "Cognitive Overdrive", desc: "Target discrimination: shoot the hostile targets and avoid distractors.", color: "#3b82f6" },
    { id: "recoil-evasion", category: "Dynamic", title: "Recoil Evasion", desc: "Counteract weapon recoil while tracking a target that evades your spray pattern.", color: "#f87171" },
    { id: "blind-flick", category: "Perception", title: "Blind Flick", desc: "Acquire targets in a dark void using spatial audio pans.", color: "#8b5cf6" },
    { id: "jiggle-peek", category: "Combat", title: "Jiggle Peek", desc: "Practice reaction discipline against peeking targets.", color: "#f43f5e" },
];

function resolveModeKey(modeId: string | null): Exclude<Mode, "menu"> | null {
    if (!modeId) return null;
    const normalized = modeId.toLowerCase().replace(/_/g, "-");
    
    // Resolve known aliases/legacy configurations back to registry keys
    if (
        normalized === "continuous-tracking" ||
        normalized === "tracking-protocol" ||
        normalized === "continuous-track" ||
        normalized === "tracking-while-moving" ||
        normalized === "smoothness-track"
    ) {
        return "tracking-mode";
    }
    if (normalized === "micro-precision") {
        return "micro-adjust";
    }
    if (normalized === "vertical-flick" || normalized === "spatial-flick") {
        return "static-flick";
    }
    if (normalized === "flick-track-hybrid") {
        return "target-switch";
    }
    if (normalized === "cognition-react") {
        return "reaction-test";
    }
    if (normalized === "sound-spatialization-anchor" || normalized === "sound_spatialization_anchor") {
        return "blind-flick";
    }
    if (normalized === "jasp-jiggle-peek" || normalized === "jasp_jiggle_peek") {
        return "jiggle-peek";
    }
    if (
        normalized === "recoil-reactive-evasion" ||
        normalized === "recoil_reactive_evasion" ||
        normalized === "recoil-reactive"
    ) {
        return "recoil-evasion";
    }

    if (normalized in ModeRegistry) {
        return normalized as Exclude<Mode, "menu">;
    }
    return null;
}

function GameEngine() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { isTrial } = useAuth();
    const modeParam = searchParams.get("mode");
    const diffParam = searchParams.get("diff");
    const timeParam = searchParams.get("time");
    const playlistParam = searchParams.get("playlist");

    let currentMode = resolveModeKey(modeParam);

    // Apply strict trial mode limits
    if (isTrial) {
        if (currentMode !== "static-flick" && currentMode !== "micro-adjust") {
            currentMode = "static-flick";
        }
    }

    // Resolve playlist if parameter exists (block for trial users)
    const proPlaylist = React.useMemo(() => {
        if (isTrial || !playlistParam) return null;
        return proPlaylists.find((p) => p.id === playlistParam) || null;
    }, [playlistParam, isTrial]);

    const compiledRoutine = React.useMemo(() => {
        if (!proPlaylist) return null;

        const difficultyMap: Record<string, string> = {
            "Eco": "easy",
            "Bonus": "medium",
            "Force Buy": "hard",
            "Full Buy": "extreme",
        };

        const routine: Routine = {
            id: proPlaylist.id,
            name: `${proPlaylist.proName}'s Regimen`,
            description: proPlaylist.description,
            authorId: proPlaylist.creatorType,
            createdAt: new Date().toISOString(),
            drills: proPlaylist.sequence.map((task, idx) => ({
                id: `${proPlaylist.id}-drill-${idx}-${Date.now()}`,
                modeId: resolveModeKey(task.modeId) || task.modeId,
                difficulty: difficultyMap[task.difficulty] || "medium",
                durationSeconds: task.duration,
            })),
        };

        return routine;
    }, [proPlaylist]);

    const overrideSettings = React.useMemo(() => {
        if (isTrial) {
            return {
                difficulty: 'medium' as Difficulty, // 'bonus' maps to 'medium' in config
                duration: 30
            };
        }

        if (!diffParam && !timeParam) return undefined;
        const diffMap: Record<string, Difficulty> = {
            'eco': 'easy',
            'bonus': 'medium',
            'force-buy': 'hard',
            'full-buy': 'extreme',
            'easy': 'easy',
            'medium': 'medium',
            'hard': 'hard',
            'extreme': 'extreme'
        };
        return {
            difficulty: diffMap[diffParam?.toLowerCase() || ''] || 'medium',
            duration: Number(timeParam) > 0 ? Number(timeParam) : 30
        };
    }, [diffParam, timeParam, isTrial]);

    const handleModeFinish = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch((err) => {
                console.warn("Could not exit fullscreen naturally:", err);
            });
        }
        router.push("/dashboard");
    };

    if (compiledRoutine) {
        return (
            <div className="relative w-full h-screen bg-[#121212] overflow-hidden">
                <button
                    onClick={handleModeFinish}
                    className="absolute bottom-6 right-6 z-[100] px-4 py-2 bg-black/50 border border-white/10 rounded text-xs font-bold tracking-widest text-gray-400 hover:text-white hover:border-white/30 transition-all backdrop-blur-md"
                >
                    ABORT TO HUB
                </button>
                <RoutineRunner
                    routine={compiledRoutine}
                    onComplete={handleModeFinish}
                />
            </div>
        );
    }

    if (!currentMode) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#121212] text-white space-y-4">
                <h2 className="text-2xl font-black tracking-widest uppercase">Invalid Protocol</h2>
                <button
                    onClick={() => router.push("/dashboard")}
                    className="px-6 py-2 bg-[#3366FF] hover:bg-white hover:text-[#3366FF] transition-all rounded-lg font-bold tracking-widest uppercase text-sm"
                >
                    Return to Hub
                </button>
            </div>
        );
    }

    const ActiveComponent = ModeRegistry[currentMode];

    return (
        <div className="relative w-full h-screen bg-[#121212] overflow-hidden">



            {/* Existing Abort Button */}
            <button
                onClick={handleModeFinish}
                className="absolute bottom-6 right-6 z-[100] px-4 py-2 bg-black/50 border border-white/10 rounded text-xs font-bold tracking-widest text-gray-400 hover:text-white hover:border-white/30 transition-all backdrop-blur-md"
            >
                ABORT TO HUB
            </button>

            {/* The Active Mode Component */}
            {React.createElement(ActiveComponent as any, { 
                key: `${currentMode}-${JSON.stringify(overrideSettings)}`,
                onFinish: currentMode === "custom-routine" ? handleModeFinish : undefined,
                overrideSettings 
            })}
        </div>
    );
}

export default function GamePage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen bg-[#121212] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-[#3366FF] border-t-transparent rounded-full animate-spin"></div>
            </div>
        }>
            <GameEngine />
        </React.Suspense>
    );
}