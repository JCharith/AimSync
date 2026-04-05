"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  // UI State
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setError(null);
    const { error } = await loginWithGoogle();
    if (error) {
      setError(error);
      setIsLoading(false);
    } else {
      router.push("/game"); // Redirect to hub on success
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    if (mode === "register") {
      const { error } = await registerWithEmail(email, password, username);
      if (error) setError(error);
      else router.push("/game");
    }
    else if (mode === "login") {
      const { error } = await loginWithEmail(email, password);
      if (error) setError(error);
      else router.push("/game");
    }
    else if (mode === "forgot") {
      const { error, success } = await resetPassword(email);
      if (error) setError(error);
      if (success) setMessage("Password reset email sent! Check your inbox.");
    }

    setIsLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 relative">

      {/* Background effects */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-5 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Back to Home */}
      <Link href="/" className="absolute top-8 left-8 text-gray-500 hover:text-emerald-400 text-sm font-bold uppercase tracking-widest transition-colors">
        ← Abort
      </Link>

      <div className="w-full max-w-md bg-gray-900/80 border border-gray-800 p-8 rounded-xl backdrop-blur-md z-10 shadow-2xl">

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">
            {mode === "login" ? "Secure Login" : mode === "register" ? "Create Agent" : "System Recovery"}
          </h2>
          <p className="text-gray-400 text-sm mt-2 font-medium">
            {mode === "login" ? "Enter your credentials to deploy." :
              mode === "register" ? "Register your profile for cloud telemetry." :
                "Enter your email to reset your password."}
          </p>
        </div>

        {/* Alerts */}
        {error && <div className="mb-6 p-3 bg-red-500/10 border border-red-500/50 text-red-400 text-sm text-center rounded-md">{error}</div>}
        {message && <div className="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 text-sm text-center rounded-md">{message}</div>}

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Gamer Tag</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 text-white px-4 py-3 rounded-md focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="e.g. TenZ"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 text-white px-4 py-3 rounded-md focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="agent@aimsync.com"
            />
          </div>

          {mode !== "forgot" && (
            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
                {mode === "login" && (
                  <button type="button" onClick={() => setMode("forgot")} className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
                    Forgot?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 text-white px-4 py-3 rounded-md focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-500 text-gray-950 font-black uppercase tracking-widest py-3 rounded-md hover:bg-emerald-400 transition-all duration-200 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Processing..." : mode === "login" ? "Authenticate" : mode === "register" ? "Initialize" : "Send Reset Link"}
          </button>
        </form>

        {/* Google Provider Divider */}
        {mode !== "forgot" && (
          <>
            <div className="flex items-center gap-4 my-6">
              <div className="h-px bg-gray-800 flex-1"></div>
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Or</span>
              <div className="h-px bg-gray-800 flex-1"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="w-full bg-gray-50 hover:bg-white text-gray-900 font-bold py-3 rounded-md transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
          </>
        )}

        {/* Footer Toggles */}
        <div className="mt-8 text-center text-sm font-medium text-gray-400">
          {mode === "login" ? (
            <p>No agent profile? <button onClick={() => { setMode("register"); setError(null); }} className="text-emerald-500 hover:text-emerald-400 ml-1">Register here.</button></p>
          ) : (
            <p>Return to <button onClick={() => { setMode("login"); setError(null); setMessage(null); }} className="text-emerald-500 hover:text-emerald-400 ml-1">Secure Login.</button></p>
          )}
        </div>

      </div>
    </main>
  );
}
