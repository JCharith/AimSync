'use client';

import { useState, useEffect } from 'react';
import {
    Radar, RadarChart, PolarGrid,
    PolarAngleAxis, ResponsiveContainer, Tooltip
} from 'recharts';

export interface RadarDataPoint {
    subject: string;
    level: number;
    fullMark?: number;
}

interface RadarProfilerProps {
    data?: RadarDataPoint[];
    loading?: boolean;
}

const DEFAULT_BASELINE: RadarDataPoint[] = [
    { subject: 'Flicking', level: 1, fullMark: 100 },
    { subject: 'Tracking', level: 1, fullMark: 100 },
    { subject: 'Speed', level: 1, fullMark: 100 },
    { subject: 'Precision', level: 1, fullMark: 100 },
    { subject: 'Perception', level: 1, fullMark: 100 },
    { subject: 'Cognition', level: 1, fullMark: 100 },
];

export default function RadarProfiler({ data, loading = false }: RadarProfilerProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [fetchedData, setFetchedData] = useState<RadarDataPoint[] | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(loading);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (data && data.length > 0) {
            setFetchedData(data);
            setIsLoading(loading);
            return;
        }

        let isCancelled = false;
        async function hydrateFromD1() {
            setIsLoading(true);
            try {
                const res = await fetch('/api/get-stats');
                if (res.ok) {
                    const json = await res.json();
                    if (Array.isArray(json) && !isCancelled) {
                        setFetchedData(json);
                    }
                }
            } catch (err) {
                console.error('[RadarProfiler] Hydration error from D1:', err);
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        }

        hydrateFromD1();
        return () => {
            isCancelled = true;
        };
    }, [data, loading]);

    // SSR Guard
    if (!isMounted) {
        return (
            <div className="w-full max-w-md bg-[#121212]/80 backdrop-blur-md rounded-3xl border border-white/10 p-6 shadow-2xl flex flex-col items-center justify-center min-h-[362px] relative">
                <div className="w-12 h-12 rounded-full border-4 border-white/5 border-t-blue-500 animate-spin" />
            </div>
        );
    }

    // Use active data (passed or fetched), otherwise fallback baseline
    const activeData = (fetchedData && fetchedData.length > 0) ? fetchedData : (data && data.length > 0 ? data : DEFAULT_BASELINE);
    const chartData = activeData.map(item => ({
        subject: item?.subject || 'Unknown',
        level: typeof item?.level === 'number' ? item.level : 1,
        fullMark: item?.fullMark || 100
    }));

    return (
        <div className="w-full max-w-md bg-[#121212]/80 backdrop-blur-md rounded-3xl border border-white/10 p-6 shadow-2xl flex flex-col items-center relative overflow-hidden">
            <div className="absolute inset-0 bg-blue-500/5 blur-[80px] pointer-events-none rounded-full scale-150" />

            <h2 className="text-white/80 font-black tracking-[0.3em] uppercase text-sm mb-4 relative z-10">
                AimSync Diagnostic
            </h2>

            <div className="w-full min-h-[300px] relative z-10 flex items-center justify-center">
                {isLoading ? (
                    <div className="w-12 h-12 rounded-full border-4 border-white/5 border-t-blue-500 animate-spin" />
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                            <PolarGrid stroke="rgba(255,255,255,0.1)" />
                            <PolarAngleAxis
                                dataKey="subject"
                                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#000', borderColor: 'rgba(59,130,246,0.5)', borderRadius: '12px' }}
                                itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                                formatter={(value: any) => [`Level ${value}`, 'Current Rank']}
                            />
                            <Radar
                                name="Player Stats"
                                dataKey="level"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                fill="#3b82f6"
                                fillOpacity={0.4}
                                animationDuration={1500}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}