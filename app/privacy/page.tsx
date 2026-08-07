import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | AimSync",
  description: "Privacy Policy, Data Collection, Cloudflare D1 Telemetry Storage, Discord OAuth, and Security disclosures for AimSync.",
};

export default function PrivacyPolicyPage() {
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
              href="/terms"
              className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors hidden sm:block"
            >
              Terms of Service
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
            Data Protection & Telemetry Disclosures
          </div>
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-white mb-4">
            PRIVACY <span className="text-red">POLICY</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl font-medium">
            How AimSync collects, logs, encrypts, and handles player telemetry on Cloudflare D1, Discord authentication data, and third-party integrations.
          </p>
          <div className="mt-6 text-xs text-slate-500 font-mono">
            LAST REVISED: {lastUpdated} // VERSION 2.4.0-PRIVACY
          </div>
        </div>
      </section>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="flex-1 max-w-6xl mx-auto px-6 py-12 md:py-16 w-full grid grid-cols-1 lg:grid-cols-4 gap-12">
        
        {/* Quick Navigation Sidebar */}
        <aside className="lg:col-span-1 space-y-4 hidden lg:block sticky top-24 h-fit">
          <div className="p-4 rounded-xl bg-surface border border-white/10">
            <h3 className="text-xs font-black uppercase tracking-widest text-red mb-4">
              Policy Sections
            </h3>
            <nav className="space-y-2 text-xs font-bold text-slate-400">
              <a href="#overview" className="block hover:text-white transition-colors">1. Overview & Commitment</a>
              <a href="#data-collected" className="block hover:text-white transition-colors">2. Data We Collect</a>
              <a href="#d1-telemetry" className="block hover:text-white transition-colors">3. Cloudflare D1 Telemetry</a>
              <a href="#discord-data" className="block hover:text-white transition-colors">4. Discord Identity Data</a>
              <a href="#patreon-billing" className="block hover:text-white transition-colors">5. Patreon Third-Party Billing</a>
              <a href="#storage-cookies" className="block hover:text-white transition-colors">6. Local Storage & Cookies</a>
              <a href="#user-rights" className="block hover:text-white transition-colors">7. User Rights & Deletion</a>
            </nav>
          </div>
        </aside>

        {/* Legal Text Content */}
        <div className="lg:col-span-3 space-y-12 text-slate-300 leading-relaxed font-medium">
          
          {/* Section 1 */}
          <section id="overview" className="p-6 md:p-8 rounded-xl bg-surface/60 border border-white/10 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-red/10 border border-red/30 text-red font-mono text-xs font-black">01</span>
              <h2 className="text-xl md:text-2xl font-black uppercase text-white tracking-tight">
                Overview & Privacy Commitment
              </h2>
            </div>
            <p className="text-sm md:text-base leading-relaxed">
              At <strong className="text-white">AimSync</strong>, we respect your privacy and are committed to transparency regarding how your data is processed. AimSync operates as a modern edge-native web application designed to benchmark and elevate your aiming performance. We collect only the data necessary to calculate your analytics, manage your account, enforce leaderboard anti-cheat integrity, and sync supporter entitlements.
            </p>
          </section>

          {/* Section 2 */}
          <section id="data-collected" className="p-6 md:p-8 rounded-xl bg-surface/60 border border-white/10 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-red/10 border border-red/30 text-red font-mono text-xs font-black">02</span>
              <h2 className="text-xl md:text-2xl font-black uppercase text-white tracking-tight">
                Information We Collect
              </h2>
            </div>
            <p className="text-sm md:text-base leading-relaxed">
              We collect three categories of data when you interact with AimSync:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs md:text-sm pt-2">
              <div className="p-4 rounded-lg bg-black/40 border border-white/10 space-y-2">
                <h4 className="text-red font-bold uppercase tracking-wider">A. Exercise Telemetry</h4>
                <p className="text-slate-400">
                  Target hit/miss coordinates, reaction time (ms), accuracy percentages, drill IDs, and mouse movement vectors.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-black/40 border border-white/10 space-y-2">
                <h4 className="text-red font-bold uppercase tracking-wider">B. Identity Profile</h4>
                <p className="text-slate-400">
                  Discord User ID, username, avatar photo URL, and supporter tier status obtained via Discord OAuth 2.0.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-black/40 border border-white/10 space-y-2">
                <h4 className="text-red font-bold uppercase tracking-wider">C. Device Diagnostics</h4>
                <p className="text-slate-400">
                  Browser type, WebGL capabilities, refresh rate statistics, input polling frequency, and IP location flags.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Cloudflare D1 Telemetry */}
          <section id="d1-telemetry" className="p-6 md:p-8 rounded-xl bg-surface/60 border border-white/10 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-red/10 border border-red/30 text-red font-mono text-xs font-black">03</span>
              <h2 className="text-xl md:text-2xl font-black uppercase text-white tracking-tight">
                Telemetry Logging on Cloudflare D1 Edge Network
              </h2>
            </div>
            <p className="text-sm md:text-base leading-relaxed">
              AimSync runs on a zero-server edge architecture powered by <strong className="text-white">Cloudflare Workers</strong> and <strong className="text-white">Cloudflare D1</strong> (distributed SQLite edge database).
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-slate-300">
              <li><strong className="text-white">Performance Analytics:</strong> Exercise results are logged instantly to Cloudflare D1 to compute global leaderboard ranks, percentile distributions, and muscle memory heatmaps.</li>
              <li><strong className="text-white">Anti-Cheat Auditing:</strong> High-frequency input timing and mouse displacement vectors are analyzed to detect automated scripts, botting, or altered frame rates.</li>
              <li><strong className="text-white">Encryption & Isolation:</strong> Telemetry in transit is encrypted using TLS 1.3. Cloudflare D1 stores database records in isolated edge regions to ensure sub-10ms response times and data redundancy.</li>
            </ul>
          </section>

          {/* Section 4: Discord Identity Data */}
          <section id="discord-data" className="p-6 md:p-8 rounded-xl bg-surface/60 border border-white/10 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-red/10 border border-red/30 text-red font-mono text-xs font-black">04</span>
              <h2 className="text-xl md:text-2xl font-black uppercase text-white tracking-tight">
                Discord OAuth 2.0 Data Usage
              </h2>
            </div>
            <p className="text-sm md:text-base leading-relaxed">
              When you authenticate with Discord, AimSync receives an OAuth token granting access to your public Discord profile.
            </p>
            <div className="bg-black/40 border border-white/10 p-4 rounded-lg space-y-2 text-xs md:text-sm">
              <p className="text-slate-300">
                <strong className="text-white">What we DO with your Discord data:</strong> We display your Discord avatar and username on your leaderboard entries and profile dashboard, and sync your Patreon supporter tier role on the AimSync Discord server.
              </p>
              <p className="text-slate-400">
                <strong className="text-white">What we DO NOT do:</strong> We do not request email access, private messages, friend lists, or server management permissions. We never sell or share your Discord account data with advertisers.
              </p>
            </div>
          </section>

          {/* Section 5: Patreon Third-Party Billing */}
          <section id="patreon-billing" className="p-6 md:p-8 rounded-xl bg-surface/60 border border-white/10 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-red/10 border border-red/30 text-red font-mono text-xs font-black">05</span>
              <h2 className="text-xl md:text-2xl font-black uppercase text-white tracking-tight">
                Third-Party Patreon Billing
              </h2>
            </div>
            <p className="text-sm md:text-base leading-relaxed">
              Supporter tier subscriptions (<em className="text-white">Vanguard $1/mo, Elite $3/mo, Pro-Caliber $5/mo</em>) are processed exclusively by <strong className="text-white">Patreon, Inc.</strong>
            </p>
            <p className="text-xs md:text-sm text-slate-400">
              When you subscribe via Patreon, Patreon handles payment validation and notifies AimSync via encrypted webhook of your tier status. AimSync receives only your Patreon user ID and active tier name to unlock Plus+ features. We never store or handle credit card numbers or billing addresses.
            </p>
          </section>

          {/* Section 6: Local Storage */}
          <section id="storage-cookies" className="p-6 md:p-8 rounded-xl bg-surface/60 border border-white/10 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-red/10 border border-red/30 text-red font-mono text-xs font-black">06</span>
              <h2 className="text-xl md:text-2xl font-black uppercase text-white tracking-tight">
                Local Storage & Cookies
              </h2>
            </div>
            <p className="text-sm md:text-base leading-relaxed">
              AimSync uses browser Local Storage instead of intrusive tracking cookies to persist your local settings, crosshair customizations, sensitivity ratios, and session state (<code className="text-red font-mono text-xs bg-black px-1.5 py-0.5 rounded">aimsync_current_user</code>, <code className="text-red font-mono text-xs bg-black px-1.5 py-0.5 rounded">aimsync_trial_active</code>). No third-party tracking pixels or marketing cookies are installed.
            </p>
          </section>

          {/* Section 7: User Rights */}
          <section id="user-rights" className="p-6 md:p-8 rounded-xl bg-surface/60 border border-white/10 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-red/10 border border-red/30 text-red font-mono text-xs font-black">07</span>
              <h2 className="text-xl md:text-2xl font-black uppercase text-white tracking-tight">
                User Rights & Data Deletion
              </h2>
            </div>
            <p className="text-sm md:text-base leading-relaxed">
              You have full ownership of your data. You may request a copy of your stored exercise telemetry or request complete deletion of your player profile and Cloudflare D1 history by contacting us on our official Discord or opening a ticket on GitHub.
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
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <a href="https://discord.gg/aimsync" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Discord</a>
            <a href="https://github.com/LogicArchitectDS/AimSync" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
