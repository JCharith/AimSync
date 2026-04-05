"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('totalScore', 'desc'), limit(10));
    getDocs(q).then(snap => {
      setLeaders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 pt-24 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-black text-white uppercase mb-12 text-center">Global Rankings</h1>
        <div className="space-y-4">
          {leaders.map((player, i) => (
            <div key={player.id} className="flex items-center justify-between p-6 bg-gray-900 border border-white/5 rounded-2xl hover:border-emerald-500/50 transition-all">
              <div className="flex items-center gap-4">
                <span className="text-emerald-500 font-black text-xl w-6">#{i + 1}</span>
                <span className="text-white font-black uppercase">{player.displayName || 'Anonymous'}</span>
              </div>
              <span className="text-gray-400 font-mono font-bold">{player.totalScore?.toLocaleString()} pts</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}