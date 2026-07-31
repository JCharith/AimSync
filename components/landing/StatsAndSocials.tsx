"use client";

import Link from "next/link";

interface StatItemProps {
  value: string;
  label: string;
  subtext?: string;
  badge?: string;
}

function StatCard({ value, label, subtext, badge }: StatItemProps) {
  return (
    <div className="relative group p-6 md:p-8 rounded-xl bg-surface/80 border border-white/10 backdrop-blur-md hover:border-red/40 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
      {/* Corner accent glow */}
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-red/10 rounded-full blur-xl group-hover:bg-red/20 transition-all duration-300" />
      
      {/* Tactical top bar line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] md:text-xs font-black tracking-[0.25em] uppercase text-red flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
            {label}
          </span>
          {badge && (
            <span className="px-2 py-0.5 text-[9px] font-black tracking-widest uppercase rounded bg-red/10 border border-red/30 text-red">
              {badge}
            </span>
          )}
        </div>

        <div className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight tabular-nums group-hover:text-white transition-colors">
          {value}
        </div>
      </div>

      {subtext && (
        <p className="mt-3 text-xs text-slate-400 font-medium tracking-wide">
          {subtext}
        </p>
      )}
    </div>
  );
}

export default function StatsAndSocials() {
  return (
    <section className="relative z-10 py-16 md:py-24 border-y border-white/10 bg-background/90 overflow-hidden">
      {/* Background cyber grid effect */}
      <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      
      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6 border-b border-white/5 pb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red/10 border border-red/20 text-red text-[11px] font-black uppercase tracking-widest mb-3">
              <span className="w-2 h-2 rounded-full bg-red animate-ping" />
              Edge Architecture
            </div>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-white">
              TACTICAL METRICS & <span className="text-red">COMMUNITY HUB</span>
            </h2>
          </div>

          {/* Social Links & Plus+ CTA */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Discord Link */}
            <a
              href="https://discord.gg/aimsync"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2.5 px-4 py-3 rounded-lg bg-surface border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/10 text-slate-300 hover:text-white transition-all duration-200"
              title="Join AimSync Discord Community"
            >
              <svg className="w-5 h-5 fill-current text-indigo-400 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span className="text-xs font-black uppercase tracking-wider">Discord</span>
            </a>

            {/* GitHub Link */}
            <a
              href="https://github.com/LogicArchitectDS/AimSync"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2.5 px-4 py-3 rounded-lg bg-surface border border-white/10 hover:border-slate-400/50 hover:bg-white/5 text-slate-300 hover:text-white transition-all duration-200"
              title="Explore AimSync GitHub Repository & Docs"
            >
              <svg className="w-5 h-5 fill-current text-slate-300 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
              <span className="text-xs font-black uppercase tracking-wider">GitHub</span>
            </a>

            {/* Plus+ Patreon CTA Button */}
            <a
              href="https://www.patreon.com/aimsync"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex items-center gap-2.5 bg-red text-white px-6 py-3 rounded-lg font-black text-xs uppercase tracking-widest hover:scale-105 transition-all duration-200 shadow-[0_0_25px_rgba(239,68,68,0.4)] hover:shadow-[0_0_35px_rgba(239,68,68,0.7)] overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                Unlock Plus+ Supporter
                <svg className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </a>
          </div>
        </div>

        {/* Factual Edge-Native Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          <StatCard
            label="Catalog Scale"
            value="14 Precision Drills"
            subtext="Flick, tracking, switching & micro-correction routines tailored for tactical shooters."
            badge="ACTIVE"
          />

          <StatCard
            label="Deployment Scale"
            value="0 MB Installer / 100% Edge Native"
            subtext="Runs instantly inside modern WebGL browsers powered by Cloudflare D1 & Workers."
            badge="ZERO LAG"
          />

          <StatCard
            label="Pro Warmups"
            value="3 Pro-Athlete Blueprints Loaded"
            subtext="Preloaded custom warm-up sequences modeled after elite esports champions."
            badge="FEATURED"
          />
        </div>

      </div>
    </section>
  );
}
