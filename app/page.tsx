"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import StatsAndSocials from "@/components/landing/StatsAndSocials";

/* ---------- animated grid canvas ---------- */
function GridCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Perspective grid
      const vx = w / 2;
      const vy = h * 0.48;
      const cols = 18;
      const rows = 14;
      const speed = 0.18;

      // Scroll offset simulates forward movement
      const offset = (t * speed) % (h / rows);

      ctx.save();

      // Horizontal lines (receding)
      for (let r = 0; r <= rows + 1; r++) {
        const rawY = r * (h / rows) + offset;
        // Project y into perspective
        const progress = rawY / h; // 0 = horizon, 1 = bottom
        const screenY = vy + (rawY - vy) * progress;
        if (screenY < vy || screenY > h + 20) continue;

        const alpha = Math.pow(progress, 1.5) * 0.55;
        const lineWidth = progress * 1.2;

        // x spread at this row
        const spread = ((screenY - vy) / (h - vy)) * (w * 0.55);
        const x0 = vx - spread;
        const x1 = vx + spread;

        ctx.beginPath();
        ctx.moveTo(x0, screenY);
        ctx.lineTo(x1, screenY);
        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }

      // Vertical lines (radiating from vanishing point)
      for (let c = 0; c <= cols; c++) {
        const frac = c / cols; // 0..1
        const bottomX = w * frac;

        const alpha = (1 - Math.abs(frac - 0.5) * 1.6) * 0.5;
        if (alpha <= 0) continue;

        ctx.beginPath();
        ctx.moveTo(vx, vy);
        ctx.lineTo(bottomX, h + 10);
        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Glow at vanishing point
      const grd = ctx.createRadialGradient(vx, vy, 0, vx, vy, w * 0.35);
      grd.addColorStop(0, "rgba(239,68,68,0.18)");
      grd.addColorStop(0.5, "rgba(239,68,68,0.06)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      ctx.restore();

      t++;
      animationId = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.9 }}
    />
  );
}

/* ---------- game logos ---------- */
function ValorantLogo() {
  return (
    <Image
      src="/valorant-v2.png"
      alt="Valorant"
      width={360}
      height={360}
      className="h-28 md:h-40 lg:h-48 w-auto object-contain drop-shadow-[0_0_25px_rgba(255,70,85,0.3)]"
    />
  );
}

function CS2Logo() {
  return (
    <Image
      src="/cs2-logo.png"
      alt="Counter-Strike 2"
      width={500}
      height={360}
      className="h-28 md:h-40 lg:h-48 w-auto object-contain drop-shadow-[0_0_25px_rgba(255,255,255,0.2)]"
    />
  );
}

/* ---------- stat chip ---------- */
function StatChip({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 text-center px-4">
      <span className="text-xl md:text-2xl lg:text-3xl font-black tracking-tight text-white tabular-nums">
        {value}
      </span>
      <span className="text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase text-red">
        {label}
      </span>
    </div>
  );
}

/* ---------- main page ---------- */
export default function Home() {
  const { user, isTrial, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Early session checks & Auth.js rehydration corridors
    const storedUser = localStorage.getItem("aimsync_current_user");
    const isTrialActive = localStorage.getItem("aimsync_trial_active") === "true";
    const hasSession = !!storedUser || isTrialActive || user || isTrial;

    if (hasSession) {
      // Direct window logic / DOM pointer transition without hitting React state triggers
      const landingRoot = document.getElementById("landing-root");
      if (landingRoot) {
        // GPU Compositor Retention styles
        landingRoot.style.willChange = "transform, opacity";
        landingRoot.style.transition = "transform 600ms cubic-bezier(0.16, 1, 0.3, 1), opacity 600ms cubic-bezier(0.16, 1, 0.3, 1)";
        landingRoot.style.transform = "translate3d(0, -20px, 0) scale(0.98)";
        landingRoot.style.opacity = "0";
      }

      // Route the viewport to /dashboard automatically without requiring manual player input
      const timer = setTimeout(() => {
        router.push("/dashboard");
      }, 350);

      return () => clearTimeout(timer);
    }
  }, [user, isTrial, router]);

  return (
    <div id="landing-root" className="min-h-screen flex flex-col bg-background selection:bg-red/30" style={{ willChange: "transform, opacity" }}>
      {/* ═══ HERO SECTION ═══ */}
      <section className="relative flex flex-col min-h-screen overflow-hidden">
        {/* Background image layer */}
        <div className="absolute inset-0">
          <Image
            src="/hero-bg.png"
            alt="AimSync training arena"
            fill
            sizes="100vw"
            priority
            className="object-cover object-center opacity-50"
          />
          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/20 to-background/90" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/40" />
        </div>

        {/* Animated grid canvas on top of the bg image */}
        <GridCanvas />

        {/* ── NAVBAR ── */}
        <nav className="relative z-50 flex items-center justify-between px-8 py-5 w-full bg-black/40 backdrop-blur-md border-b border-white/5">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            {/* Crosshair icon */}
            <div className="w-8 h-8 relative flex items-center justify-center">
              <div className="absolute w-8 h-8 rounded-full border-2 border-red" />
              <div className="absolute w-1 h-1 rounded-full bg-red" />
              <div className="absolute w-4 h-px bg-red" />
              <div className="absolute w-px h-4 bg-red" />
            </div>
            <span className="text-lg font-black uppercase tracking-tight">
              <span className="text-white">AIM</span>
              <span className="text-red">SYNC</span>
            </span>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-bold tracking-widest uppercase text-slate-400">
            <Link href="#how-it-works" className="hover:text-white transition-colors">
              How it works
            </Link>
            <a
              href="https://www.patreon.com/aimsync"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Plus+
            </a>
          </div>

          {/* Right side: sign in */}
          <div className="flex items-center gap-4">
            {user || isTrial ? (
              <Link href="/dashboard" className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-red overflow-hidden hover:scale-105 transition-transform bg-black shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                {user?.profilePhoto ? (
                  <img src={user.profilePhoto} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-black text-white">{isTrial ? "T" : (user?.username?.charAt(0) || "U")}</span>
                )}
              </Link>
            ) : (
              <Link
                href="/auth/login"
                className="text-slate-300 px-5 py-2 text-sm font-bold uppercase tracking-widest hover:text-white transition-all duration-200"
              >
                Login
              </Link>
            )}
          </div>
        </nav>

        {/* ── HERO CONTENT ── */}
        <div className="relative z-10 flex-1 flex flex-col justify-end px-8 md:px-16 lg:px-24 pb-40 pt-8 max-w-7xl mx-auto w-full">

          <div className="flex flex-col items-start text-left max-w-3xl">
            <h1 className="text-6xl md:text-7xl lg:text-[5.5rem] font-black uppercase tracking-tighter leading-[0.9] text-white mb-6">
              THE ONLINE<br />
              <span className="text-red drop-shadow-[0_0_40px_rgba(239,68,68,0.5)]">
                AIM TRAINER
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-300 font-medium tracking-wide max-w-xl mb-12">
              TURNS YOUR BROWSER INTO A PERSONALISED AIMING COACH
            </p>

            <Link
              href="/dashboard"
              id="cta-start-training"
              className="group relative bg-red text-white px-12 py-5 rounded-md font-black text-lg uppercase tracking-widest hover:scale-105 transition-all duration-200 shadow-[0_0_40px_rgba(239,68,68,0.4)] hover:shadow-[0_0_60px_rgba(239,68,68,0.6)] self-start"
            >
              <span className="relative z-10">Start Aim Training</span>
              <div className="absolute inset-0 rounded-md bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 opacity-50">
          <div className="w-px h-12 bg-gradient-to-b from-white to-transparent animate-pulse" />
        </div>
      </section>

      {/* ═══ STATS & SOCIALS HUB ═══ */}
      <StatsAndSocials />

      {/* ═══ BENCHMARK SECTION ═══ */}
      <section id="how-it-works" className="relative z-10 px-8 md:px-16 py-32 max-w-7xl mx-auto w-full flex flex-col md:flex-row items-center gap-16">
        <div className="flex-1 space-y-8">
          <div className="inline-block px-4 py-1.5 rounded-full border border-red/30 bg-red/10 text-red text-xs font-black tracking-widest uppercase">
            Global Leaderboards
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter text-white leading-tight">
            BENCHMARK YOUR AIM IN <span className="text-red">60 SECONDS</span>
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            Find out exactly where you stand against the rest of the world. Take our standardized assessment to reveal your true mechanical tier, from Bronze to Grandmaster.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-3 bg-white text-black px-8 py-4 rounded-md font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-colors"
          >
            Rank Your Aim
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
        <div className="flex-1 relative w-full flex justify-center">
          {/* Mockup of a radar chart or benchmark UI */}
          <div className="aspect-square w-full max-w-md bg-black/50 border border-white/10 rounded-full flex items-center justify-center relative shadow-[0_0_100px_rgba(239,68,68,0.15)]">
            <div className="absolute inset-4 border border-white/5 rounded-full" />
            <div className="absolute inset-12 border border-white/5 rounded-full" />
            <div className="absolute inset-20 border border-white/5 rounded-full" />
            <div className="w-32 h-32 bg-red/20 border-2 border-red rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.4)] backdrop-blur-sm z-10">
              <span className="text-5xl font-black text-white">#1</span>
            </div>

            {/* Decorative nodes */}
            <div className="absolute top-[15%] left-[20%] w-4 h-4 bg-emerald-400 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.8)]" />
            <div className="absolute bottom-[20%] right-[15%] w-4 h-4 bg-cyan-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
            <div className="absolute top-[40%] right-[10%] w-4 h-4 bg-purple-400 rounded-full shadow-[0_0_15px_rgba(192,132,252,0.8)]" />
          </div>
        </div>
      </section>

      {/* ═══ CORE DRILLS SECTION ═══ */}
      <section className="relative z-10 bg-black/40 border-y border-white/5 py-32">
        <div className="max-w-7xl mx-auto px-8 md:px-16 w-full">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white">
              THE <span className="text-red">CORE</span> DRILLS
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Master the four foundational pillars of aim. Isolate your weaknesses and train them efficiently.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "FLICKING",
                desc: "Develop explosive muscle memory to snap to targets instantly.",
                color: "text-blue-500",
                border: "group-hover:border-blue-500",
                bg: "group-hover:bg-blue-500/10",
              },
              {
                title: "TRACKING",
                desc: "Keep your crosshair glued to erratically moving targets.",
                color: "text-emerald-500",
                border: "group-hover:border-emerald-500",
                bg: "group-hover:bg-emerald-500/10",
              },
              {
                title: "SWITCHING",
                desc: "Rapidly transition between multiple targets with minimal overflick.",
                color: "text-purple-500",
                border: "group-hover:border-purple-500",
                bg: "group-hover:bg-purple-500/10",
              },
              {
                title: "TIMING",
                desc: "Click precisely as your crosshair crosses the target threshold.",
                color: "text-orange-500",
                border: "group-hover:border-orange-500",
                bg: "group-hover:bg-orange-500/10",
              },
            ].map((drill, i) => (
              <Link
                key={i}
                href="/dashboard"
                className={`group flex flex-col p-8 rounded-xl border border-white/10 bg-surface/60 backdrop-blur-md transition-all duration-300 cursor-pointer ${drill.border} ${drill.bg}`}
              >
                <div className="flex justify-between items-start mb-6">
                  <h3 className={`text-xl font-black uppercase tracking-widest ${drill.color}`}>
                    {drill.title}
                  </h3>
                  <div className={`w-8 h-8 rounded bg-white/5 flex items-center justify-center transition-colors group-hover:bg-white group-hover:text-black`}>
                    <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed font-medium">
                  {drill.desc}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ GAME SYNC / THE TRAINER ═══ */}
      <section className="relative z-10 py-32 overflow-hidden bg-gradient-to-b from-background to-[#1a0505]">
        <div className="max-w-7xl mx-auto px-8 md:px-16 w-full flex flex-col items-center text-center space-y-12">

          <div className="space-y-6 max-w-3xl">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter text-white leading-tight">
              GAME SYNC: <br /><span className="text-red">IT&apos;S AN AIM CHANGER</span>
            </h2>
            <p className="text-slate-300 text-lg leading-relaxed">
              Don&apos;t guess your sensitivity. AimSync provides 1:1 physics matching, FOV scaling, and sensitivity syncing for the world&apos;s most competitive tactical shooters.
            </p>
          </div>

          {/* Logos */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-16 md:gap-32 w-full py-16 border-y border-white/10 bg-black/30 backdrop-blur-sm rounded-3xl mt-8 mb-8">
            <div className="flex flex-col items-center gap-4">
              <div className="transition-transform duration-300 hover:scale-110">
                <ValorantLogo />
              </div>
              <span className="text-sm font-black tracking-[0.3em] uppercase text-[#FF4655]">VALORANT</span>
            </div>

            <div className="w-px h-16 md:h-32 bg-white/10 hidden md:block" />

            <div className="flex flex-col items-center gap-4">
              <div className="transition-transform duration-300 hover:scale-110">
                <CS2Logo />
              </div>
              <span className="text-sm font-black tracking-[0.3em] uppercase text-white">CS2</span>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-3 border-2 border-red text-red px-10 py-4 rounded-md font-black text-sm uppercase tracking-widest hover:bg-red hover:text-white transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)]"
          >
            Start your journey with The Trainer now
          </Link>

        </div>
      </section>

      {/* ═══ ADVANCED ANALYTICS (Patreon Plus+) ═══ */}
      <section id="plus" className="relative z-10 px-8 md:px-16 py-32 max-w-7xl mx-auto w-full flex flex-col md:flex-row-reverse items-center gap-16">
        <div className="flex-1 space-y-8">
          <div className="inline-block px-4 py-1.5 rounded-full border border-red/30 bg-red/10 text-red text-xs font-black tracking-widest uppercase">
            AimSync Plus+ Supporter
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter text-white leading-tight">
            SUPPORT THE PLATFORM, <br />UNLOCK ELITE STATUS
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            AimSync is built for gaming athletes. By joining our Patreon supporter tiers from just <strong>$1 to $5/month</strong>, you directly fuel the development of our browser-based, zero-installation core engine while gaining premium privileges.
          </p>
          <ul className="space-y-4 text-white font-bold tracking-wider">
            <li className="flex items-center gap-3">
              <span className="text-red text-xl">✓</span> Vanguard Tier ($1/mo): Discord role + Supporter badge
            </li>
            <li className="flex items-center gap-3">
              <span className="text-red text-xl">✓</span> Elite Tier ($3/mo): Advanced analytics + early access features
            </li>
            <li className="flex items-center gap-3">
              <span className="text-red text-xl">✓</span> Pro-Caliber Tier ($5/mo): Custom drill builder + unlimited telemetry history
            </li>
          </ul>
          <div className="pt-4">
            <a
              href="https://www.patreon.com/aimsync"
              target="_blank"
              rel="noopener noreferrer"
              className="patreon-btn"
            >
              Unlock Elite Supporter Tier +
            </a>
          </div>
        </div>
        <div className="flex-1 relative w-full aspect-video bg-surface/80 border border-white/10 rounded-xl overflow-hidden shadow-2xl p-6 flex flex-col">
          <div className="w-full flex items-end gap-2 h-48 border-b border-white/10 pb-4">
            {[40, 65, 45, 80, 55, 90, 75, 100].map((h, i) => (
              <div key={i} className="flex-1 bg-gradient-to-t from-red/20 to-red rounded-t-sm" style={{ height: `${h}%` }}></div>
            ))}
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4 pt-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Avg Reaction</p>
              <p className="text-2xl font-black text-white font-mono">184<span className="text-sm text-red">ms</span></p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Accuracy</p>
              <p className="text-2xl font-black text-white font-mono">92.4<span className="text-sm text-red">%</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative z-10 border-t border-white/10 bg-black pt-20 pb-10 px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          {/* Brand Col */}
          <div className="space-y-6 col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 relative flex items-center justify-center">
                <div className="absolute w-8 h-8 rounded-full border-2 border-red" />
                <div className="absolute w-1 h-1 rounded-full bg-red" />
                <div className="absolute w-4 h-px bg-red" />
                <div className="absolute w-px h-4 bg-red" />
              </div>
              <span className="text-2xl font-black uppercase tracking-tighter">
                <span className="text-white">AIM</span>
                <span className="text-red">SYNC</span>
              </span>
            </Link>
            <p className="text-sm text-slate-500 leading-relaxed max-w-sm font-medium">
              The professional browser-based aim trainer. Benchmark, analyze, and improve your aim for free.
            </p>
            <Link
              href="/dashboard"
              className="inline-block bg-red text-white px-8 py-3 rounded font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-colors"
            >
              Start Aim Training
            </Link>
          </div>

          {/* Links Col */}
          <div>
            <h4 className="text-white text-xs font-black uppercase tracking-widest mb-6">Product</h4>
            <ul className="space-y-4 text-sm font-bold text-slate-500">
              <li><Link href="/dashboard" className="hover:text-red transition-colors">The Trainer</Link></li>
              <li><Link href="/dashboard" className="hover:text-red transition-colors">Benchmarks</Link></li>
              <li><Link href="/dashboard" className="hover:text-red transition-colors">Analytics</Link></li>
              <li>
                <a
                  href="https://www.patreon.com/aimsync"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-red transition-colors"
                >
                  Plus+
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Col */}
          <div>
            <h4 className="text-white text-xs font-black uppercase tracking-widest mb-6">Community</h4>
            <ul className="space-y-4 text-sm font-bold text-slate-500">
              <li><a href="https://discord.gg/aimsync" target="_blank" rel="noopener noreferrer" className="hover:text-red transition-colors">Discord</a></li>
              <li><a href="https://github.com/LogicArchitectDS/AimSync" target="_blank" rel="noopener noreferrer" className="hover:text-red transition-colors">GitHub Docs</a></li>
              <li><Link href="/terms" className="hover:text-red transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-red transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-8 border-t border-white/10 text-center">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
            © {new Date().getFullYear()} AIMSYNC. BUILT FOR GAMING ATHLETES.
          </p>
        </div>
      </footer>

      {/* Styles */}
      <style>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }

        .patreon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background: #ff4655; /* Tactical cyber-neon red */
          color: #ffffff;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          padding: 1.25rem 2.5rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          z-index: 1;
          transition: transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
          will-change: transform;
        }

        /* Background/Glow layer for GPU composited shadows */
        .patreon-btn::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 0.375rem;
          background: #ff4655;
          box-shadow: 0 0 25px rgba(255, 70, 85, 0.7);
          opacity: 0.5;
          z-index: -1;
          transition: opacity 0.2s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
          will-change: transform, opacity;
        }

        .patreon-btn:hover {
          transform: scale(1.05);
        }

        .patreon-btn:hover::before {
          opacity: 1;
          transform: scale(1.08);
          box-shadow: 0 0 35px rgba(255, 70, 85, 0.9);
        }

        .patreon-btn:focus {
          outline: none;
          transform: scale(1.05);
        }

        .patreon-btn:focus::before {
          opacity: 1;
          transform: scale(1.12);
          box-shadow: 0 0 45px rgba(255, 70, 85, 0.95);
        }

        .patreon-btn:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
}