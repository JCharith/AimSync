'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface ResolutionGuardProps {
    children: React.ReactNode;
}

export default function ResolutionGuard({ children }: ResolutionGuardProps) {
    const [resolution, setResolution] = useState<{ width: number; height: number }>({
        width: typeof window !== 'undefined' ? window.innerWidth : 1024,
        height: typeof window !== 'undefined' ? window.innerHeight : 768,
    });
    const [isValid, setIsValid] = useState<boolean>(true);
    const [isMounted, setIsMounted] = useState<boolean>(false);

    useEffect(() => {
        setIsMounted(true);

        const checkResolution = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            setResolution({ width, height });
            setIsValid(width >= 1024 && height >= 768);
        };

        // Perform initial check on mount
        checkResolution();

        window.addEventListener('resize', checkResolution);
        return () => window.removeEventListener('resize', checkResolution);
    }, []);

    // Hydration protection for Next.js SSR
    if (!isMounted) {
        return <>{children}</>;
    }

    if (!isValid) {
        return (
            <div className="fixed inset-0 z-[99999] bg-[#0c0d12] flex items-center justify-center p-4 sm:p-6 overflow-hidden font-sans select-none">
                {/* Tactical Cyber Background Glow */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.15),transparent_70%)] pointer-events-none" />
                <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

                {/* Cyber-Tactical Warning Card */}
                <div className="relative max-w-xl w-full bg-[#12141d]/95 border border-red-500/30 rounded-2xl p-8 sm:p-10 backdrop-blur-2xl shadow-[0_0_80px_rgba(239,68,68,0.18)] flex flex-col items-center text-center overflow-hidden">
                    {/* Tactical Corner Accents */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-red-500/60 rounded-tl-2xl pointer-events-none" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-red-500/60 rounded-tr-2xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-red-500/60 rounded-bl-2xl pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-red-500/60 rounded-br-2xl pointer-events-none" />

                    {/* Status Header Badge */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-xs tracking-widest uppercase mb-6 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
                        SYSTEM LOCKOUT // RESOLUTION SECURITY GUARD
                    </div>

                    {/* Lock Icon */}
                    <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(239,68,68,0.25)] relative group">
                        <svg className="w-10 h-10 text-red-500 transition-transform group-hover:scale-110 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <rect x="5" y="11" width="14" height="10" rx="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M8 11V7a4 4 0 018 0v4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="16" r="1.5" fill="currentColor" />
                        </svg>
                    </div>

                    {/* Header */}
                    <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider mb-4 drop-shadow-md">
                        INSUFFICIENT RESOLUTION
                    </h2>

                    {/* Exact Prompt Required Warning Text */}
                    <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8 max-w-lg font-normal">
                        Insufficient Resolution. AimSync tactical training requires a minimum resolution of 1024x768 to ensure precise 1:1 spatial scaling and accurate mouse telemetry. Please switch to a desktop or tablet device, or resize your window.
                    </p>

                    {/* Telemetry Stats */}
                    <div className="grid grid-cols-2 gap-4 w-full mb-8 font-mono text-xs">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col items-center">
                            <span className="text-slate-400 uppercase tracking-widest text-[10px] mb-1">Current Display</span>
                            <span className="text-red-400 font-bold text-sm sm:text-base tracking-wider">
                                {resolution.width} &times; {resolution.height}
                            </span>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col items-center">
                            <span className="text-slate-400 uppercase tracking-widest text-[10px] mb-1">Required Minimum</span>
                            <span className="text-emerald-400 font-bold text-sm sm:text-base tracking-wider">
                                1024 &times; 768
                            </span>
                        </div>
                    </div>

                    {/* Return Action */}
                    <Link
                        href="/dashboard"
                        className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:shadow-[0_0_30px_rgba(239,68,68,0.4)]"
                    >
                        RETURN TO TACTICAL HUB
                    </Link>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
