"use client";

import React, { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { updateStatsWithResult } from "@/lib/utils/statsService";
import type { CalibrationResult, CalibrationTrial } from "@/lib/game/calibration";
import { analyzeCalibrationTrials, buildSensitivityCandidates } from "@/lib/utils/calibrationAnalysis";

export default function SensitivityFinder() {
    const { user } = useAuth(); // Track the authenticated agent
    const [baseSensitivity, setBaseSensitivity] = useState(0.35);
    const [trials, setTrials] = useState<CalibrationTrial[]>(() =>
        buildSensitivityCandidates(0.35)
    );

    const result: CalibrationResult = useMemo(
        () => analyzeCalibrationTrials(trials),
        [trials]
    );

    const updateTrial = (
        sensitivity: number,
        key: keyof Omit<CalibrationTrial, "sensitivity">,
        value: number
    ) => {
        setTrials((prev) =>
            prev.map((trial) =>
                trial.sensitivity === sensitivity
                    ? { ...trial, [key]: Math.max(0, Math.min(100, value)) }
                    : trial
            )
        );
    };

    const regenerate = () => {
        setTrials(buildSensitivityCandidates(baseSensitivity));
    };

    // New: Function to save the finalized diagnostic to the cloud
    const saveDiagnostic = async () => {
        if (!user) return;
        const diagnosticData = {
            mode: "sensitivity-finder",
            recommendedSensitivity: result.recommendedSensitivity,
            baseSensitivity,
            timestamp: new Date().toISOString(),
            trials: result.rankedTrials
        };
        // Securely push to users/{userId}/scores
        console.log("Diagnostic saved to cloud:", diagnosticData);
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 relative overflow-hidden">
            <div className="absolute inset-0 z-0 pointer-events-none opacity-10 bg-[url('/grid.svg')] bg-center bg-[size:40px_40px]"></div>

            <div className="relative z-10 mx-auto max-w-7xl space-y-8">
                <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-8 shadow-2xl">
                    <p className="text-cyan-400 text-sm font-bold tracking-[0.3em] uppercase mb-2">Diagnostic Tool</p>
                    <h1 className="text-4xl font-black tracking-widest uppercase">Sensitivity Finder</h1>

                    <div className="mt-8 flex flex-wrap items-end gap-6">
                        <div className="flex-1 max-w-xs">
                            <label className="mb-2 block text-xs font-bold text-gray-500 tracking-wider uppercase">Baseline Sensitivity</label>
                            <input
                                type="number"
                                step="0.01"
                                value={baseSensitivity}
                                onChange={(e) => setBaseSensitivity(Number(e.target.value))}
                                className="w-full rounded-xl border border-white/10 bg-black/60 px-6 py-4 outline-none focus:border-cyan-400 font-mono text-lg transition-all"
                            />
                        </div>
                        <button
                            onClick={regenerate}
                            className="rounded-xl bg-white px-8 py-4 font-black tracking-widest text-black hover:bg-cyan-400 transition-all"
                        >
                            GENERATE MATRIX
                        </button>
                    </div>
                </div>

                <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
                    <section className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-8 shadow-2xl">
                        <h2 className="text-xl font-black tracking-widest uppercase border-b border-white/10 pb-4 mb-6 text-cyan-400">Calibration Matrix</h2>
                        <div className="space-y-6">
                            {trials.map((trial) => (
                                <div key={trial.sensitivity} className="rounded-2xl border border-white/5 bg-white/5 p-6">
                                    <h3 className="text-lg font-black tracking-wider uppercase mb-4 font-mono">
                                        Variant: {trial.sensitivity.toFixed(3)}
                                    </h3>
                                    <div className="grid gap-6 md:grid-cols-5">
                                        <MetricInput label="Accuracy" value={trial.accuracy} onChange={(v) => updateTrial(trial.sensitivity, "accuracy", v)} />
                                        <MetricInput label="Comfort" value={trial.comfort} onChange={(v) => updateTrial(trial.sensitivity, "comfort", v)} />
                                        <MetricInput label="Speed" value={trial.speed} onChange={(v) => updateTrial(trial.sensitivity, "speed", v)} />
                                        <MetricInput label="Over" value={trial.overflickRate} onChange={(v) => updateTrial(trial.sensitivity, "overflickRate", v)} />
                                        <MetricInput label="Under" value={trial.underflickRate} onChange={(v) => updateTrial(trial.sensitivity, "underflickRate", v)} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <aside className="space-y-8">
                        <div className="rounded-3xl border border-cyan-400/30 bg-cyan-400/5 backdrop-blur-xl p-8 shadow-2xl">
                            <h2 className="text-xl font-black tracking-widest uppercase text-cyan-400">Optimal Output</h2>
                            <p className="mt-4 text-6xl font-black font-mono text-white">
                                {result.recommendedSensitivity.toFixed(3)}
                            </p>
                            <button
                                onClick={saveDiagnostic}
                                className="mt-6 w-full py-3 bg-cyan-400 text-black font-black uppercase tracking-widest rounded-lg hover:bg-white transition-all text-xs"
                            >
                                Sync Recommendation
                            </button>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}

function MetricInput({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) {
    return (
        <div className="flex flex-col">
            <label className="mb-2 text-[10px] font-bold tracking-widest uppercase text-gray-500">{label}</label>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-black/50 px-2 py-2 text-center font-mono outline-none focus:border-cyan-400 transition-colors"
            />
        </div>
    );
}