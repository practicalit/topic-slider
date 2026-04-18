"use client";

import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import Link from "next/link";

export default function SystemPortalPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = e.currentTarget;
    const username = (form.elements.namedItem("username") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    const result = await signIn("super-admin", {
      username,
      password,
      redirect: false,
    });
    setLoading(false);

    if (result?.error) {
      setError("Invalid operator credentials.");
      return;
    }
    await getSession();
    router.push("/super");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 px-4 py-16 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.15),transparent_45%),radial-gradient(circle_at_70%_80%,rgba(139,92,246,0.12),transparent_40%)]" />
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-zinc-700/80 bg-zinc-900/90 p-8 shadow-2xl backdrop-blur-xl">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-400 mb-2">
              Internal
            </p>
            <h1 className="text-2xl font-bold text-white">System portal</h1>
            <p className="text-sm text-zinc-400 mt-2">Platform super administrator access only</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-red-950/80 border border-red-800 text-red-200 px-4 py-3 text-sm">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="op-user" className="block text-sm font-medium text-zinc-300 mb-1.5">
                Operator username
              </label>
              <input
                id="op-user"
                name="username"
                type="text"
                required
                autoComplete="username"
                className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-600 text-white placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="op-pass" className="block text-sm font-medium text-zinc-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <input
                id="op-pass"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-600 text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition-colors border border-indigo-500/50"
            >
              {loading ? "Signing in…" : "Enter platform"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-zinc-500">
            <Link href="/login" prefetch={false} className="text-zinc-400 hover:text-white underline underline-offset-2">
              ← School sign-in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
