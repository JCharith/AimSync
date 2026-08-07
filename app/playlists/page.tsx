"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { proPlaylists, ProPlaylist, ProPlaylistTask } from "@/lib/config/proPlaylists";

export default function PlaylistsMarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [gameFilter, setGameFilter] = useState<"All" | "Valorant" | "CS2" | "Hybrid">("All");
  const [creatorFilter, setCreatorFilter] = useState<"All" | "pro-team" | "specialist">("All");
  const [selectedPlaylist, setSelectedPlaylist] = useState<ProPlaylist | null>(null);
  const [loadedPlaylistId, setLoadedPlaylistId] = useState<string | null>(null);

  // Filtered Playlists
  const filteredPlaylists = useMemo(() => {
    return proPlaylists.filter((item) => {
      const matchesSearch =
        item.proName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.team.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesGame = gameFilter === "All" || item.gameFocus === gameFilter;
      const matchesCreator = creatorFilter === "All" || item.creatorType === creatorFilter;

      return matchesSearch && matchesGame && matchesCreator;
    });
  }, [searchQuery, gameFilter, creatorFilter]);

  // Featured Athletes (TenZ, Sacy, Aspas)
  const featuredAthletes = useMemo(() => {
    return proPlaylists.filter((p) => ["tenz", "sacy", "aspas"].includes(p.id));
  }, []);

  const handleLoadPlaylist = (playlist: ProPlaylist) => {
    try {
      localStorage.setItem("aimsync_active_playlist", JSON.stringify({
        id: playlist.id,
        proName: playlist.proName,
        team: playlist.team,
        sequence: playlist.sequence,
        loadedAt: Date.now()
      }));
      setLoadedPlaylistId(playlist.id);
      setTimeout(() => {
        setLoadedPlaylistId(null);
      }, 3000);
    } catch (err) {
      console.error("Failed to load playlist into localStorage", err);
    }
  };

  const getDifficultyColor = (difficulty: ProPlaylistTask["difficulty"]) => {
    switch (difficulty) {
      case "Eco":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "Bonus":
        return "bg-sky-500/10 text-sky-400 border-sky-500/30";
      case "Force Buy":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "Full Buy":
        return "bg-red/10 text-red border-red/30";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col font-sans selection:bg-red/30 selection:text-white">
      {/* ═══ HEADER / NAVBAR ═══ */}
      <header className="sticky top-0 z-50 bg-black/70 backdrop-blur-md border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 relative flex items-center justify-center">
              <div className="absolute w-8 h-8 rounded-full border-2 border-red group-hover:scale-105 transition-transform" />
              <div className="absolute w-1 h-1 rounded-full bg-red" />
              <div className="absolute w-4 h-px bg-red" />
              <div className="absolute w-px h-4 bg-red" />
            </div>
            <span className="text-xl font-black uppercase tracking-tight">
              <span className="text-white">AIM</span>
              <span className="text-red">SYNC</span>
            </span>
          </Link>

          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard"
              className="bg-red/10 border border-red/30 text-red hover:bg-red hover:text-white px-4 py-2 rounded text-xs font-black uppercase tracking-widest transition-all duration-200"
            >
              Launch Trainer
            </Link>
          </div>
        </div>
      </header>

      {/* ═══ HERO TITLE ═══ */}
      <section className="relative z-10 py-16 md:py-20 border-b border-white/10 bg-surface/40 overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red/10 border border-red/20 text-red text-[11px] font-black uppercase tracking-widest mb-4">
            <span className="w-2 h-2 rounded-full bg-red animate-pulse" />
            Tactical Routine Marketplace
          </div>
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-white mb-4">
            PRO-ATHLETE <span className="text-red">PLAYLISTS</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl font-medium">
            Precompiled warm-up protocols and mechanical routines engineered by world champions. Load routines directly into your AimSync training engine.
          </p>

          {/* Quick Stats Pill */}
          <div className="mt-8 flex flex-wrap gap-4 text-xs font-mono">
            <div className="px-4 py-2 rounded-lg bg-black/50 border border-white/10 flex items-center gap-2 text-slate-300">
              <span className="text-red font-black">{proPlaylists.length}</span> PRO ROUTINES READY
            </div>
            <div className="px-4 py-2 rounded-lg bg-black/50 border border-white/10 flex items-center gap-2 text-slate-300">
              <span className="text-emerald-400 font-black">100%</span> ENGINE COMPATIBLE
            </div>
            <div className="px-4 py-2 rounded-lg bg-black/50 border border-white/10 flex items-center gap-2 text-slate-300">
              <span className="text-cyan-400 font-black">0 MB</span> DOWNLOAD NEEDED
            </div>
          </div>
        </div>
      </section>

      {/* ═══ MAIN CONTENT MARKETPLACE ═══ */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full space-y-12">
        
        {/* ── FEATURED ATHLETES SHOWCASE ── */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black uppercase tracking-wider text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red" />
              FEATURED CHAMPION ROUTINES
            </h2>
            <span className="text-xs font-mono text-slate-500 uppercase">PRECOMPILED PAYLOADS</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredAthletes.map((playlist) => (
              <div
                key={playlist.id}
                className={`relative group p-6 rounded-xl bg-surface/80 border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg ${playlist.accentColor}`}
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-red bg-red/10 border border-red/30 px-2 py-0.5 rounded">
                        {playlist.team}
                      </span>
                      <h3 className="text-2xl font-black uppercase tracking-tight text-white mt-1">
                        {playlist.proName}
                      </h3>
                    </div>
                    <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded bg-white/5 border border-white/10 text-slate-300">
                      {playlist.gameFocus}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 font-medium leading-relaxed">
                    {playlist.description}
                  </p>

                  {/* Task Sequence Badges */}
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Routine Breakdown:</span>
                    <div className="flex flex-col gap-1.5">
                      {playlist.sequence.map((task, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded bg-black/40 border border-white/5">
                          <span className="font-bold text-slate-200 truncate max-w-[180px]">{task.name}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${getDifficultyColor(task.difficulty)}`}>
                              {task.difficulty}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">{task.duration}s</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-white/10 flex items-center gap-3">
                  <button
                    onClick={() => handleLoadPlaylist(playlist)}
                    className="flex-1 bg-red text-white py-2.5 px-4 rounded text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                  >
                    {loadedPlaylistId === playlist.id ? (
                      <>
                        <span className="text-emerald-300 font-black">✓ LOADED INTO ENGINE</span>
                      </>
                    ) : (
                      <>
                        <span>LOAD ROUTINE</span>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setSelectedPlaylist(playlist)}
                    className="p-2.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                    title="Preview full parameters"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SEARCH & FILTER TOOLBAR ── */}
        <section className="p-6 rounded-xl bg-surface border border-white/10 backdrop-blur-md space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full md:w-96">
              <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search athlete, team, or routine..."
                className="w-full bg-black/50 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red/50 transition-colors"
              />
            </div>

            {/* Game Focus Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mr-2">Title:</span>
              {(["All", "Valorant", "CS2", "Hybrid"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGameFilter(g)}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                    gameFilter === g
                      ? "bg-red text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]"
                      : "bg-black/40 border border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Creator Type Pills */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mr-2">Category:</span>
              {(["All", "pro-team", "specialist"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCreatorFilter(c)}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                    creatorFilter === c
                      ? "bg-white text-black font-black"
                      : "bg-black/40 border border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  {c === "All" ? "All" : c === "pro-team" ? "Pro Teams" : "Specialists"}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── ALL PRO PLAYLISTS GRID ── */}
        <section className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
              SHOWING <span className="text-white">{filteredPlaylists.length}</span> ROUTINES
            </h3>
            {loadedPlaylistId && (
              <div className="px-3 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black uppercase animate-pulse">
                ✓ ROUTINE SYNCED TO DASHBOARD ENGINE
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlaylists.map((playlist) => (
              <div
                key={playlist.id}
                className={`p-6 rounded-xl bg-surface/60 border border-white/10 hover:border-white/20 transition-all duration-200 flex flex-col justify-between space-y-6 ${playlist.accentColor}`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-red">
                          {playlist.team}
                        </span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                          {playlist.creatorType}
                        </span>
                      </div>
                      <h4 className="text-xl font-black uppercase tracking-tight text-white mt-1">
                        {playlist.proName}
                      </h4>
                    </div>
                    <span className="px-2 py-1 text-[10px] font-black uppercase rounded bg-white/5 border border-white/10 text-slate-300">
                      {playlist.gameFocus}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 font-medium leading-relaxed line-clamp-2">
                    {playlist.description}
                  </p>

                  {/* Task sequence count & duration */}
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5 font-mono text-slate-400">
                    <span>{playlist.sequence.length} DRILL TASKS</span>
                    <span>
                      TOTAL: {playlist.sequence.reduce((acc, t) => acc + t.duration, 0)}s
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                  <button
                    onClick={() => handleLoadPlaylist(playlist)}
                    className="flex-1 bg-red/10 border border-red/30 text-red hover:bg-red hover:text-white py-2 px-3 rounded text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    {loadedPlaylistId === playlist.id ? "✓ LOADED" : "LOAD PLAYLIST"}
                  </button>

                  <button
                    onClick={() => setSelectedPlaylist(playlist)}
                    className="p-2 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ═══ PLAYLIST PREVIEW MODAL ═══ */}
      {selectedPlaylist && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-white/20 rounded-2xl max-w-lg w-full p-6 space-y-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedPlaylist(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-red">
                  {selectedPlaylist.team}
                </span>
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-white/5 border border-white/10 text-slate-300">
                  {selectedPlaylist.gameFocus}
                </span>
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight text-white">
                {selectedPlaylist.proName} Routine
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {selectedPlaylist.description}
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
                Exercise Sequence ({selectedPlaylist.sequence.length} Drills)
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {selectedPlaylist.sequence.map((task, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg bg-black/50 border border-white/10 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span className="text-red font-mono text-[10px]">0{idx + 1}</span>
                        {task.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        MODE: {task.modeId}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded border ${getDifficultyColor(task.difficulty)}`}>
                        {task.difficulty}
                      </span>
                      <span className="font-mono text-slate-300">{task.duration}s</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center gap-4">
              <button
                onClick={() => {
                  handleLoadPlaylist(selectedPlaylist);
                  setSelectedPlaylist(null);
                }}
                className="flex-1 bg-red text-white py-3 rounded-lg font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.4)]"
              >
                LOAD THIS ROUTINE NOW
              </button>
              <Link
                href="/dashboard"
                className="px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-white/10 bg-black py-8 px-6 text-center text-xs text-slate-500 mt-16">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-mono">
            © {new Date().getFullYear()} AIMSYNC. PRO-ATHLETE ENGINE.
          </p>
          <div className="flex gap-6 font-bold uppercase tracking-wider">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <a href="https://discord.gg/aimsync" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Discord</a>
            <a href="https://github.com/LogicArchitectDS/AimSync" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
