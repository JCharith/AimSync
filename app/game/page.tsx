"use client";

import { useState } from "react";
import React from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

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
import { DEFAULT_ROUTINES } from "@/lib/utils/routineEngine";

type Mode =
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
    | "reaction-test";

// --- COMPONENT DICTIONARY ---
const ModeRegistry: Record<Exclude<Mode, "menu">, React.ElementType> = {
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
};

// --- PROTOCOL MENU DATA ---
const protocolCards: { id: Exclude<Mode, "menu">; category: string; title: string; desc: string; color: string }[] = [
    { id: "static-flick", category: "Combat", title: "Static Flick", desc: "Develop raw mechanical memory and stopping power.", color: "#3366FF" },
    { id: "micro-adjust", category: "Precision", title: "Micro Adjust", desc: "Master tiny, pixel-perfect mouse corrections.", color: "#f43f5e" },
    { id: "tracking-mode", category: "Dynamic", title: "Continuous Tracking", desc: "Engage erratic targets to develop crosshair prediction.", color: "#06b6d4" },
    { id: "target-switch", category: "Cognitive", title: "Target Switch", desc: "Rapidly identify and eliminate the correct target hidden among decoys.", color: "#1DB954" },
    { id: "burst-reaction", category: "Reflex", title: "Burst Reaction", desc: "Engage rapid target clusters to build combo multipliers.", color: "#f97316" },
    { id: "reaction-test", category: "Baseline", title: "Reaction Test", desc: "Pure neurological stimulus response testing.", color: "#eab308" },
    { id: "flick-benchmark", category: "Evaluation", title: "Flick Benchmark", desc: "Standardized testing protocol to rank flicking accuracy.", color: "#ec4899" },
    { id: "consistency-check", category: "Evaluation", title: "Consistency Check", desc: "Test variance in performance over prolonged engagements.", color: "#8b5cf6" },
    { id: "custom-routine", category: "Playlist", title: "Custom Routine", desc: "Execute user-defined training playlists.", color: "#64748b" },
    { id: "sensitivity-finder", category: "Diagnostic", title: "Sens Matrix", desc: "Mathematical analysis to calculate optimal mouse sensitivity.", color: "#8A2BE2" },
];

export default function GamePage() {
    const { isLoggedIn } = useAuth();
    const [currentMode, setCurrentMode] = useState<Mode>("menu");
    const [selectedCardId, setSelectedCardId] = useState<Exclude<Mode, "menu">>("static-flick");

    if (currentMode !== "menu") {
        const ActiveComponent = ModeRegistry[currentMode];

        const handleModeFinish = () => {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch((err) => {
                    console.warn("Could not exit fullscreen naturally:", err);
                });
            }
            setCurrentMode("menu");
        };

        return (
            <div className="relative w-full h-screen bg-[#121212]">
                <button
                    onClick={handleModeFinish}
                    className="absolute top-6 right-6 z-[100] px-4 py-2 bg-black/50 border border-white/10 rounded text-xs font-bold tracking-widest text-gray-400 hover:text-white hover:border-white/30 transition-all backdrop-blur-md"
                >
                    ABORT TO HUB
                </button>
                <ActiveComponent onFinish={handleModeFinish} />
            </div>
        );
    }

    const selectedCard = protocolCards.find(c => c.id === selectedCardId)!;
    
    // GUESTS CAN ONLY PLAY THESE
    const allowedModesForGuests = ["static-flick", "micro-adjust"];
    const isLocked = !isLoggedIn && !allowedModesForGuests.includes(selectedCard.id);

    return (
        <div className="min-h-screen bg-[#050505] text-[#EAEAEA] flex flex-col relative overflow-hidden pt-16">
            {/* Background elements */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
            
            <div className="relative z-10 w-full max-w-[1600px] mx-auto flex flex-col lg:flex-row h-full lg:h-[calc(100vh-64px)]">
                
                {/* Left Sidebar - Scrollable List */}
                <div className="w-full lg:w-[400px] border-r border-white/10 bg-black/40 backdrop-blur-md flex flex-col min-h-[50vh] lg:h-full border-t border-t-white/5">
                    <div className="p-6 border-b border-white/10">
                        <h2 className="text-xl font-black tracking-widest text-white uppercase">Protocols</h2>
                        <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">Select Training Module</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {protocolCards.map((card) => {
                            const isSelected = selectedCardId === card.id;
                            const isCardLocked = !isLoggedIn && !allowedModesForGuests.includes(card.id);
                            
                            return (
                                <button
                                    key={card.id}
                                    onClick={() => setSelectedCardId(card.id)}
                                    className={`w-full group relative flex items-center text-left p-4 rounded-xl border transition-all duration-300 overflow-hidden ${isSelected ? 'bg-white/10 border-white/20 shadow-lg' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                                >
                                    {/* Distinct color line */}
                                    <div className={`absolute left-0 top-0 w-1 h-full transition-opacity duration-300 ${isSelected ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`} style={{ backgroundColor: card.color }} />
                                    
                                    <div className="ml-3 flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-[10px] font-bold tracking-widest uppercase opacity-80" style={{ color: card.color }}>
                                                {card.category}
                                            </p>
                                            {isCardLocked && (
                                                <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                            )}
                                        </div>
                                        <h2 className={`text-sm font-black tracking-wider uppercase transition-colors ${isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                                            {card.title}
                                        </h2>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Area - Detail Spotlight */}
                <div className="flex-1 p-8 lg:p-16 flex flex-col justify-center relative min-h-[50vh] overflow-y-auto w-full">
                    
                    {/* Thematic background glow based on selected card */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] blur-[150px] opacity-10 rounded-full pointer-events-none transition-colors duration-700" style={{ backgroundColor: selectedCard.color }} />

                    <div className="relative z-10 max-w-2xl">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 mb-6 inline-block" style={{ color: selectedCard.color }}>
                            {selectedCard.category} Module
                        </span>
                        
                        <h1 className="text-4xl md:text-6xl font-black text-white tracking-widest uppercase leading-none drop-shadow-xl mb-6">
                            {selectedCard.title}
                        </h1>
                        
                        <p className="text-gray-400 text-base md:text-xl font-medium leading-relaxed mb-10 max-w-xl">
                            {selectedCard.desc}
                        </p>
                        
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            {isLocked ? (
                                <div className="flex flex-col gap-3 items-start">
                                    <button disabled className="px-8 py-4 bg-gray-900 border border-gray-800 text-gray-500 font-black tracking-widest uppercase rounded-xl cursor-not-allowed flex items-center gap-3">
                                        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                        Restricted Access
                                    </button>
                                    <p className="text-[10px] text-red-500 font-bold tracking-widest uppercase">Cloud Authentication Required</p>
                                    <Link href="/login" className="text-xs text-[#3366FF] font-bold uppercase tracking-wider hover:underline transition-all">Authenticate Profile →</Link>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setCurrentMode(selectedCardId)}
                                    className="px-10 py-5 bg-white text-[#050505] font-black tracking-[0.2em] uppercase rounded-xl hover:bg-gray-200 transition-all duration-300 hover:scale-[1.02] shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center gap-3 group"
                                >
                                    INITIALIZE
                                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}