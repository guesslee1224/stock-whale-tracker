"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError("Unable to connect to auth service"); setLoading(false); return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{
        background: "#060D1A",
        backgroundImage: `
          linear-gradient(rgba(26, 45, 74, 0.35) 1px, transparent 1px),
          linear-gradient(90deg, rgba(26, 45, 74, 0.35) 1px, transparent 1px)
        `,
        backgroundSize: "48px 48px",
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0, 232, 122, 0.04), transparent)",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-xl text-3xl mb-4"
            style={{
              background: "rgba(0, 232, 122, 0.08)",
              boxShadow: "0 0 32px rgba(0, 232, 122, 0.12), inset 0 0 0 1px rgba(0, 232, 122, 0.15)",
            }}
          >
            🐋
          </div>
          <h1 className="font-heading font-bold text-xl tracking-[0.15em] uppercase text-foreground">
            Whale Tracker
          </h1>
          <p className="text-[11px] tracking-widest uppercase text-muted-foreground mt-1">
            Market Intelligence
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl border border-border p-7"
          style={{ background: "rgba(10, 22, 40, 0.9)", backdropFilter: "blur(16px)" }}
        >
          <p className="text-[11px] tracking-widest uppercase text-muted-foreground mb-5">
            Sign in to continue
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-[11px] font-medium tracking-widest uppercase text-muted-foreground"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded border border-border bg-muted/30 text-foreground text-sm px-3 py-2.5 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary font-mono transition-colors duration-150"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-[11px] font-medium tracking-widest uppercase text-muted-foreground"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded border border-border bg-muted/30 text-foreground text-sm px-3 py-2.5 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary font-mono transition-colors duration-150"
              />
            </div>

            {error && (
              <p
                className="text-[11px] px-3 py-2 rounded"
                style={{
                  background: "rgba(255, 77, 109, 0.08)",
                  color: "#FF4D6D",
                  boxShadow: "inset 0 0 0 1px rgba(255, 77, 109, 0.2)",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded text-[12px] font-bold tracking-[0.12em] uppercase transition-all duration-150 mt-2"
              style={
                loading
                  ? {
                      background: "rgba(128, 151, 180, 0.08)",
                      color: "#8097B4",
                      boxShadow: "inset 0 0 0 1px #1A2D4A",
                      cursor: "wait",
                    }
                  : {
                      background: "#00E87A",
                      color: "#060D1A",
                      boxShadow: "0 0 20px rgba(0, 232, 122, 0.2)",
                    }
              }
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
