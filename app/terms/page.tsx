import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | AimSync",
  description: "Terms of Service, Telemetry Disclosures, Discord OAuth, Anti-Cheat Enforcement, and Patreon Billing Policy for AimSync.",
};

export default function TermsOfServicePage() {
  const lastUpdated = "July 30, 2026";

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col font-sans selection:bg-red/30 selection:text-white">
      {/* ═══ CYBER HEADER / NAVBAR ═══ */}
      <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-md border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
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

          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors hidden sm:block"
            >
              Privacy Policy
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
      <section className="relative z-10 py-16 md:py-20 border-b border-white/10 bg-surface/50 overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red/10 border border-red/20 text-red text-[11px] font-black uppercase tracking-widest mb-4">
            <span className="w-2 h-2 rounded-full bg-red animate-pulse" />
            Legal Framework & Agreement
          </div>
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-white mb-4">
            TERMS OF <span className="text-red">SERVICE</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl font-medium">
            System terms, telemetry disclosures, Discord OAuth authentication rules, anti-cheat hardware checks, and Patreon supporter policies.
          </p>
          <div className="mt-6 text-xs text-slate-500 font-mono">
            LAST REVISED: {lastUpdated} // VERSION 2.4.0-EDGE
          </div>
        </div>
      </section>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="flex-1 max-w-6xl mx-auto px-6 py-12 md:py-16 w-full grid grid-cols-1 lg:grid-cols-4 gap-12">
        
        {/* Quick Navigation Sidebar */}
        <aside className="lg:col-span-1 space-y-4 hidden lg:block sticky top-24 h-fit">
          <div className="p-4 rounded-xl bg-surface border border-white/10">
            <h3 className="text-xs font-black uppercase tracking-widest text-red mb-4">
              Sections Jump
            </h3>
            <nav className="space-y-2 text-xs font-bold text-slate-400">
              <a href="#acceptance" className="block hover:text-white transition-colors">1. Acceptance of Terms</a>
              <a href="#telemetry-d1" className="block hover:text-white transition-colors">2. Telemetry & Cloudflare D1</a>
              <a href="#discord-oauth" className="block hover:text-white transition-colors">3. Discord OAuth Authentication</a>
              <a href="#anticheat" className="block hover:text-white transition-colors">4. Anti-Cheat & Integrity Checks</a>
              <a href="#patreon-billing" className="block hover:text-white transition-colors">5. Patreon Supporter Tiers</a>
              <a href="#intellectual-property" className="block hover:text-white transition-colors">6. Intellectual Property</a>
              <a href="#disclaimer" className="block hover:text-white transition-colors">7. Warranties & Liability</a>
            </nav>
          </div>
        </aside>

        {/* Legal Text Content */}
        <div className="lg:col-span-3 space-y-12 text-slate-300 leading-relaxed font-medium">
          
          {/* Section 1 */}
          <section id="acceptance" className="p-6 md:p-8 rounded-xl bg-surface/60 border border-white/10 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-red/10 border border-red/30 text-red font-mono text-xs font-black">01</span>
              <h2 className="text-xl md:text-2xl font-black uppercase text-white tracking-tight">
                Acceptance of Terms
              </h2>
            </div>
            <p className="text-sm md:text-base leading-relaxed">
              By accessing, browsing, or utilizing the <strong className="text-white">AimSync</strong> web application located at aimsync.com (or any affiliated subdomain), you confirm your binding agreement to these Terms of Service. AimSync provides an edge-native, WebGL-powered FPS aim training platform designed for competitive gaming athletes. If you do not agree to these terms, you must immediately cease accessing the platform.
            </p>
          </section>

          {/* Section 2: Telemetry & Cloudflare D1 */}
          <section id="telemetry-d1" className="p-6 md:p-8 rounded-xl bg-surface/60 border border-white/10 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-red/10 border border-red/30 text-red font-mono text-xs font-black">02</span>
              <h2 className="text-xl md:text-2xl font-black uppercase text-white tracking-tight">
                Telemetry & Performance Logging (Cloudflare D1)
              </h2>
            </div>
            <p className="text-sm md:text-base leading-relaxed">
              To deliver real-time benchmark analysis, global leaderboard ranking, and muscle memory heatmaps, AimSync collects and logs detailed exercise telemetry during active training sessions.
            </p>
            <div className="bg-black/40 border border-white/10 p-4 rounded-lg space-y-2 text-xs md:text-sm">
              <h4 className="text-white font-bold uppercase tracking-wider text-red">Data Points Logged to Cloudflare D1 Edge Storage:</h4>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li><strong className="text-slate-200">Session Performance Metrics:</strong> Reaction latency (ms), hit/miss ratio, accuracy percentages, targets destroyed, and streak multipliers.</li>
                <li><strong className="text-slate-200">Spatial Telemetry:</strong> Crosshair displacement vectors, click timing, target positioning coordinates, and mouse delta movement values.</li>
                <li><strong className="text-slate-200">System Diagnostics:</strong> WebGL frame rates (FPS), rendering engine timing, display refresh rates, and browser user agent.</li>
              </ul>
            </div>
            <p className="text-xs md:text-sm text-slate-400">
              All telemetry is transmitted over encrypted TLS 1.3 tunnels to Cloudflare D1 distributed edge databases. This data is utilized solely for skill analytics, leaderboard validation, and platform optimization.
            </p>
          </section>

          {/* Section 3: Discord OAuth Authentication */}
          <section id="discord-oauth" className="p-6 md:p-8 rounded-xl bg-surface/60 border border-white/10 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-red/10 border border-red/30 text-red font-mono text-xs font-black">03</span>
              <h2 className="text-xl md:text-2xl font-black uppercase text-white tracking-tight">
                Discord OAuth 2.0 Authentication
              </h2>
            </div>
            <p className="text-sm md:text-base leading-relaxed">
              AimSync utilizes <strong className="text-white">Discord OAuth 2.0</strong> for secure player authentication and identity management.
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-slate-300">
              <li><strong className="text-white">Data Accessed:</strong> Upon authorizing Discord login, AimSync reads your public Discord User ID, username/handle, display avatar URL, and server role memberships.</li>
              <li><strong className="text-white">Security Guarantee:</strong> AimSync never receives or stores your Discord password, payment accounts, or private direct messages.</li>
              <li><strong className="text-white">Community Synchronization:</strong> Your Discord identity is linked to your AimSync player profile to sync Patreon supporter roles, badge displays, and leaderboard titles on our official Discord server.</li>
            </ul>
          </section>

          {/* Section 4: Anti-Cheat & Integrity Checks */}
          <section id="anticheat" className="p-6 md:p-8 rounded-xl bg-surface/60 border border-red/20 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-red/20 border border-red text-red font-mono text-xs font-black">04</span>
              <h2 className="text-xl md:text-2xl font-black uppercase text-white tracking-tight">
                Anti-Cheat & Hardware Integrity Enforcement
              </h2>
            </div>
            <p className="text-sm md:text-base leading-relaxed">
              Leaderboard integrity is essential to the competitive ethos of AimSync. To maintain an authentic global ranking system, AimSync implements automated client-side and edge-level anti-cheat checks.
            </p>
            <div className="bg-red/10 border border-red/30 p-4 rounded-lg space-y-2 text-xs md:text-sm text-slate-200">
              <h4 className="text-red font-bold uppercase tracking-wider">Integrity Checks Performed:</h4>
              <ul className="list-disc list-inside space-y-1 text-slate-300">
                <li>Input cadence variance analysis and synthetic macro/bot detection.</li>
                <li>Mouse displacement delta checks and sub-pixel trajectory smoothing detection.</li>
                <li>Browser environment integrity verification (DOM manipulation, script injection checks, speed hacks).</li>
                <li>Hardware input polling frequency and event timestamp validation.</li>
              </ul>
            </div>
            <p className="text-xs md:text-sm text-slate-400">
              Any player flagged for using auto-clickers, aimbots, memory modification, or cheated WebGL inputs will face immediate, unappealable disqualification from global leaderboards and permanent account suspension.
            </p>
          </section>

          {/* Section 5: Patreon Supporter Tiers */}
          <section id="patreon-billing" className="p-6 md:p-8 rounded-xl bg-surface/60 border border-white/10 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-red/10 border border-red/30 text-red font-mono text-xs font-black">05</span>
              <h2 className="text-xl md:text-2xl font-black uppercase text-white tracking-tight">
                Patreon Supporter Tiers & Billing
              </h2>
            </div>
            <p className="text-sm md:text-base leading-relaxed">
              AimSync offers optional supporter membership tiers (<em className="text-white">Vanguard $1/mo, Elite $3/mo, Pro-Caliber $5/mo</em>) hosted via Patreon.
            </p>
            <div className="space-y-3 text-sm">
              <p>
                <strong className="text-white">Third-Party Processing:</strong> All financial transactions, billing cycles, renewals, and payment method details are handled exclusively by <strong className="text-white">Patreon, Inc.</strong> AimSync does not collect, process, or store credit card numbers or banking data.
              </p>
              <p>
                <strong className="text-white">Supporter Perks & Cancellation:</strong> Supporter perks (badges, extended telemetry history, custom blueprint builder) remain active for the duration of your valid Patreon subscription. You may modify or cancel your subscription at any time directly through your Patreon account dashboard.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section id="intellectual-property" className="p-6 md:p-8 rounded-xl bg-surface/60 border border-white/10 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-red/10 border border-red/30 text-red font-mono text-xs font-black">06</span>
              <h2 className="text-xl md:text-2xl font-black uppercase text-white tracking-tight">
                Intellectual Property Rights
              </h2>
            </div>
            <p className="text-sm md:text-base leading-relaxed">
              All software code, drill designs, WebGL assets, crosshairs, visual interfaces, graphics, sound effects, and trademarks associated with AimSync are the exclusive intellectual property of AimSync and its creator. You are granted a personal, non-transferable, revocable license to access and use the platform for non-commercial aim training.
            </p>
          </section>

          {/* Section 7 */}
          <section id="disclaimer" className="p-6 md:p-8 rounded-xl bg-surface/60 border border-white/10 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-red/10 border border-red/30 text-red font-mono text-xs font-black">07</span>
              <h2 className="text-xl md:text-2xl font-black uppercase text-white tracking-tight">
                Disclaimer & Limitation of Liability
              </h2>
            </div>
            <p className="text-sm md:text-base leading-relaxed text-slate-400">
              AimSync is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind. AimSync disclaims all liability for any indirect, incidental, or consequential damages resulting from platform downtime, edge network latency, or loss of session telemetry.
            </p>
          </section>

        </div>
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-white/10 bg-black py-8 px-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-mono">
            © {new Date().getFullYear()} AIMSYNC. ALL RIGHTS RESERVED.
          </p>
          <div className="flex gap-6 font-bold uppercase tracking-wider">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <a href="https://discord.gg/aimsync" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Discord</a>
            <a href="https://github.com/LogicArchitectDS/AimSync" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
