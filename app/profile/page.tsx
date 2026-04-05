"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function ProfilePage() {
    const { user, isLoggedIn } = useAuth();
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        if (isLoggedIn && user) {
            getDoc(doc(db, 'users', user.uid)).then(snap => {
                if (snap.exists()) setStats(snap.data());
            });
        }
    }, [isLoggedIn, user]);

    if (!isLoggedIn) return <div className="p-20 text-center uppercase font-black text-gray-700">Unauthorized Access</div>;

    return (
        <main className="min-h-screen bg-gray-950 pt-24 px-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-6 mb-12">
                    <img src={user?.photoURL || ''} className="w-24 h-24 rounded-full border-2 border-emerald-500" alt="Avatar" />
                    <div>
                        <h1 className="text-4xl font-black text-white uppercase">{user?.displayName}</h1>
                        <p className="text-emerald-500 font-bold tracking-widest text-xs uppercase">Tactical Operative</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard label="Lifetime Score" value={stats?.totalScore?.toLocaleString() || "0"} />
                    <StatCard label="Total Sessions" value={stats?.totalSessions || "0"} />
                    <StatCard label="Total Hits" value={stats?.totalHits || "0"} />
                </div>
            </div>
        </main>
    );
}

function StatCard({ label, value }: { label: string, value: string }) {
    return (
        <div className="p-8 bg-gray-900 border border-white/5 rounded-2xl">
            <p className="text-gray-500 text-[10px] font-black uppercase mb-2 tracking-widest">{label}</p>
            <p className="text-3xl font-black text-white">{value}</p>
        </div>
    );
}