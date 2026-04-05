"use client";

import Link from "next/link";
// Using relative paths to avoid the alias issue from earlier
import { useAuth } from "../hooks/useAuth";
import { logoutUser } from "../lib/auth";

export default function Navbar() {
    // Bring in our global auth state from Firebase
    const { user, isLoading, isLoggedIn } = useAuth();

    return (
        <nav className="fixed top-0 w-full z-50 h-16 border-b border-gray-800 bg-gray-950/80 backdrop-blur-md px-6 flex items-center justify-between transition-all">

            {/* Logo Section */}
            <div className="flex items-center">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-5 h-5 bg-emerald-500 rounded-sm rotate-45 flex items-center justify-center transition-transform group-hover:rotate-90 duration-300">
                        <div className="w-1.5 h-1.5 bg-gray-950 rounded-full" />
                    </div>
                    <span className="text-xl font-black tracking-widest uppercase text-white">
                        Aim<span className="text-emerald-500">Sync</span>
                    </span>
                </Link>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-8 text-sm font-bold tracking-wider uppercase text-gray-400">
                <Link href="/game" className="hover:text-emerald-400 hover:-translate-y-0.5 transition-all duration-200">Train</Link>
                <Link href="/leaderboard" className="hover:text-emerald-400 hover:-translate-y-0.5 transition-all duration-200">Board</Link>
                <Link href="/profile" className="hover:text-emerald-400 hover:-translate-y-0.5 transition-all duration-200">Profile</Link>
            </div>

            {/* Actions / Authentication Layer */}
            <div className="flex items-center gap-6">

                {/* 1. Loading State (Prevents UI jump before Firebase wakes up) */}
                {isLoading ? (
                    <div className="hidden sm:block w-24 h-8 bg-gray-800/50 animate-pulse rounded-md" />
                ) :

                    /* 2. Logged In State (Show Avatar & Name) */
                    isLoggedIn ? (
                        <div className="flex items-center gap-4">
                            <button
                                onClick={logoutUser}
                                className="hidden sm:block text-xs font-bold uppercase tracking-wider text-gray-600 hover:text-red-400 transition-colors duration-200"
                            >
                                Abort Auth
                            </button>
                            <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 pl-2 pr-4 py-1.5 rounded-full cursor-default">
                                {user?.photoURL ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={user.photoURL}
                                        alt="Profile"
                                        className="w-6 h-6 rounded-full border border-emerald-500/50 bg-gray-900"
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-xs text-emerald-500 font-bold">
                                        {user?.displayName?.charAt(0) || "U"}
                                    </div>
                                )}
                                <span className="text-sm font-bold text-gray-300 max-w-[100px] truncate">
                                    {user?.displayName || "Agent"}
                                </span>
                            </div>
                        </div>
                    ) :

                        /* 3. Guest State (Link to Dedicated Login Page) */
                        (
                            <Link
                                href="/login"
                                className="hidden sm:block text-sm font-bold uppercase tracking-wider text-gray-400 hover:text-white hover:text-emerald-400 transition-colors duration-200"
                            >
                                Sign In
                            </Link>
                        )}
            </div>
        </nav>
    );
}