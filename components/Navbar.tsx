import Link from "next/link";
import Logo from "@/components/ui/Logo";

export default function Navbar() {
    return (
        <nav className="h-16 border-b border-white/5 bg-surface/80 backdrop-blur-md flex items-center justify-between px-6 z-50 sticky top-0">
            <div className="flex items-center">
                <Link href="/" className="inline-flex items-center">
                    <Logo size={32} showText={true} src="/images/logo.png" />
                </Link>
            </div>

            <div className="flex items-center space-x-8 text-sm font-medium text-text-muted">
                <Link href="/game" className="hover:text-text-primary transition-colors duration-150">
                    Train
                </Link>
                <Link href="/leaderboard" className="hover:text-text-primary transition-colors duration-150">
                    Board
                </Link>
                <Link href="/profile" className="hover:text-text-primary transition-colors duration-150">
                    Profile
                </Link>

                {/* CTA — red pill */}
                <button className="bg-red text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-red-600 transition-all duration-150 shadow-[0_0_12px_rgba(239,68,68,0.4)]">
                    Sign In
                </button>
            </div>
        </nav>
    );
}