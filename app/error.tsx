'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log critical runtime telemetry to console
        console.error('[AimSync Engine Critical Failure]:', error);
    }, [error]);

    return (
        <div className="min-h-screen bg-[#08090c] text-white flex flex-col items-center justify-center relative overflow-hidden px-4 font-sans select-none">
            {/* Ambient Red Alert Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-red-600/15 rounded-full blur-[150px] pointer-events-none" />

            {/* Tactical Grid Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

            {/* Error Container */}
            <div className="relative z-10 max-w-xl w-full flex flex-col items-center text-center p-8 bg-white/[0.02] border border-red-500/20 rounded-3xl backdrop-blur-xl shadow-[0_0_50px_rgba(239,68,68,0.15)]">
                {/* HUD Header Badge */}
                <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full mb-6">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                    <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-red-400">
                        CRITICAL ENGINE EXCEPTION
                    </span>
                </div>

                {/* Exception Title */}
                <h1 className="text-3xl font-black font-mono tracking-tight text-white mb-2">
                    SYSTEM EXECUTION HALTED
                </h1>

                <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-6">
                    An unhandled rendering exception occurred in the graphics or telemetry worker thread.
                </p>

                {/* Error Log Snippet */}
                <div className="w-full bg-black/60 border border-red-500/20 rounded-xl p-4 mb-8 text-left font-mono text-[11px] overflow-x-auto shadow-inner">
                    <div className="text-red-400 font-bold mb-1 uppercase text-[9px] tracking-widest flex justify-between">
                        <span>Stack Diagnosis</span>
                        {error.digest && <span>Digest: {error.digest}</span>}
                    </div>
                    <p className="text-slate-300 break-words font-mono">
                        {error.message || 'An unexpected graphics loop exception occurred.'}
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 w-full mb-8">
                    <button
                        onClick={() => reset()}
                        className="flex-1 py-3.5 px-4 bg-[#3366ff] hover:bg-blue-600 text-white font-mono font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(51,102,255,0.3)] hover:shadow-[0_0_25px_rgba(51,102,255,0.5)] active:scale-[0.98] cursor-pointer"
                    >
                        Re-Initialize Engine
                    </button>

                    <Link
                        href="/dashboard"
                        className="flex-1 py-3.5 px-4 bg-white/5 hover:bg-white/10 text-slate-200 font-mono font-bold text-xs uppercase tracking-widest rounded-xl border border-white/10 transition-all hover:border-white/20 active:scale-[0.98] text-center"
                    >
                        Mission Control
                    </Link>
                </div>

                {/* Discord Support Link */}
                <div className="pt-6 border-t border-white/5 w-full flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>Report Exception Telemetry</span>
                    <a
                        href="https://discord.gg/aimsync"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#5865F2] hover:underline font-bold flex items-center gap-1.5 transition-colors"
                    >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                        </svg>
                        Discord HQ
                    </a>
                </div>
            </div>

            {/* Footer Status Bar */}
            <div className="mt-8 font-mono text-[10px] text-slate-600 flex gap-6 tracking-widest uppercase">
                <span>STATUS: CRITICAL</span>
                <span>FAILSAFE: ENGAGED</span>
                <span>AIMSYNC TELEMETRY</span>
            </div>
        </div>
    );
}
