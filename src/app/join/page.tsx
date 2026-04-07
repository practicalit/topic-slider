"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("t")?.trim() ?? "";

  const [token, setToken] = useState(tokenFromUrl);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = searchParams.get("t")?.trim() ?? "";
    if (t) setToken(t);
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("volunteer-invite", {
        token: token.trim(),
        passcode: passcode.trim(),
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid or expired invite, or wrong passcode.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not sign in. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.12),_transparent_55%)]" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/30 bg-white/70 p-8 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 supports-[backdrop-filter]:bg-white/60">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Volunteer sign-in</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          Open the invite link from your administrator (or paste the token), then enter the 6-digit
          passcode.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading} noValidate>
          {error && (
            <div
              role="alert"
              className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm border border-red-200"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="token" className="block text-sm font-medium text-gray-900 mb-1">
              Invite token
            </label>
            <input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              autoComplete="off"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 text-sm font-mono"
              placeholder="From your invite link"
            />
          </div>

          <div>
            <label htmlFor="passcode" className="block text-sm font-medium text-gray-900 mb-1">
              Passcode (6 digits)
            </label>
            <input
              id="passcode"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              autoComplete="one-time-code"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 text-lg tracking-widest text-center"
              placeholder="••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading || token.trim().length < 8 || passcode.length !== 6}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 border border-indigo-200"
          >
            {loading ? "Signing in…" : "Continue"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          <Link href="/login" prefetch={false} className="text-indigo-600 font-semibold hover:underline">
            Regular username login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white/90">
          Loading…
        </div>
      }
    >
      <JoinForm />
    </Suspense>
  );
}
