"use client";

import { useState } from "react";
import { authenticate, DemoUser } from "@/lib/auth";

interface LoginScreenProps {
  onLogin: (user: DemoUser) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const user = authenticate(email, password);
    if (user) {
      onLogin(user);
    } else {
      setError("Invalid email or password");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#171717] text-white font-bold text-xl mb-4">
            B
          </div>
          <h1 className="text-xl font-semibold text-[#171717]">Welcome to BuildAI</h1>
          <p className="text-sm text-[#8e8e8e] mt-1">AI-Powered Construction Management</p>
        </div>

        {/* Login form */}
        <div className="border border-[#e5e5e5] rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-[13px] font-medium text-[#666] mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#e5e5e5] text-[#171717] placeholder-[#b4b4b4] text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717]/30 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[13px] font-medium text-[#666] mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#e5e5e5] text-[#171717] placeholder-[#b4b4b4] text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717]/30 transition-colors"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#171717] hover:bg-[#333] text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Continue"
              )}
            </button>
          </form>
        </div>

        {/* Demo accounts */}
        <div className="mt-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-[#e5e5e5]" />
            <span className="text-[11px] text-[#8e8e8e] uppercase tracking-wider">Demo accounts</span>
            <div className="flex-1 h-px bg-[#e5e5e5]" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setEmail("admin@buildai.com"); setPassword("admin123"); setError(""); }}
              className="text-left px-3 py-2.5 rounded-xl border border-[#e5e5e5] hover:bg-[#f9f9f9] transition-colors"
            >
              <p className="text-[13px] font-medium text-[#171717]">Admin</p>
              <p className="text-[11px] text-[#8e8e8e]">PMO Director</p>
            </button>
            <button
              type="button"
              onClick={() => { setEmail("pm@buildai.com"); setPassword("demo123"); setError(""); }}
              className="text-left px-3 py-2.5 rounded-xl border border-[#e5e5e5] hover:bg-[#f9f9f9] transition-colors"
            >
              <p className="text-[13px] font-medium text-[#171717]">Project Manager</p>
              <p className="text-[11px] text-[#8e8e8e]">User view</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
