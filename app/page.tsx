import Link from 'next/link';

export default function LandingPage() {
    return (
        <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none z-0" />
            
            <div className="relative z-10 flex flex-col items-center text-center max-w-4xl space-y-8 mt-16">
                
                {/* Badge */}
                <div className="px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-bold tracking-widest uppercase mb-4 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    Early Access Agent Build
                </div>

                {/* Hero Title */}
                <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase leading-tight drop-shadow-2xl">
                    Precision <span className="text-emerald-500">Mechanics</span><br/>
                    In Your Browser
                </h1>

                {/* Subtitle */}
                <p className="text-gray-400 text-lg md:text-xl font-medium max-w-2xl mt-6">
                    A dedicated, low-latency environment designed to push human reaction time and fine motor control. Train your aim natively without heavy downloads.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-6 mt-10">
                    <Link 
                        href="/game" 
                        className="group relative px-8 py-4 bg-emerald-500 text-gray-950 font-black tracking-widest uppercase rounded-lg hover:bg-emerald-400 transition-all duration-300 hover:scale-105 shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.6)]"
                    >
                        <span className="relative z-10">Initialize Training</span>
                        <div className="absolute inset-0 bg-white/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                    </Link>
                    
                    <Link 
                        href="/login" 
                        className="px-8 py-4 border border-gray-700 bg-gray-900/50 backdrop-blur-sm text-gray-300 font-bold tracking-widest uppercase rounded-lg hover:border-emerald-500/50 hover:bg-gray-800 transition-all duration-300"
                    >
                        Sign In Profile
                    </Link>
                </div>

                {/* Stats / Features Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 w-full">
                    {[
                        { title: "Browser Native", desc: "No installs required. Instant execution." },
                        { title: "Raw Input", desc: "1:1 mapping with no artificial acceleration." },
                        { title: "Analytics", desc: "Track macro & micro performance metrics." }
                    ].map((feature, i) => (
                        <div key={i} className="p-6 rounded-2xl bg-gray-900/40 border border-gray-800 backdrop-blur-sm hover:border-emerald-500/30 transition-colors group">
                            <h3 className="text-emerald-400 font-bold uppercase tracking-wider mb-2 text-sm group-hover:text-emerald-300 transition-colors">
                                {feature.title}
                            </h3>
                            <p className="text-gray-500 text-xs font-medium">
                                {feature.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}