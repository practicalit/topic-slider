"use client";

import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, FormEvent, useRef } from "react";
import Link from "next/link";
import { FloatingQuotes } from "@/components/floating-quotes";

const REMEMBER_KEY = "mk_remember_school_login";

type IdentifyMatch = {
  tenantSlug: string;
  tenantName: string;
  subtitle: string | null;
  username: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSite, setRememberSite] = useState(false);
  const [step, setStep] = useState<"identify" | "password">("identify");
  const [identifyLoading, setIdentifyLoading] = useState(false);
  const [matches, setMatches] = useState<IdentifyMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<IdentifyMatch | null>(null);
  const [multiIndex, setMultiIndex] = useState(0);
  /**
   * After "Change username", stay on the identify step until the user clicks "Continue to password"
   * or edits the username — otherwise debounced identify immediately re-opens the password step.
   */
  const singleSiteGateRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Ignores stale identify responses when the user types quickly or navigates steps. */
  const identifyRequestId = useRef(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(REMEMBER_KEY);
      if (!raw) return;
      const o = JSON.parse(raw) as IdentifyMatch & { username?: string };
      if (o.tenantSlug && o.tenantName && o.username) {
        setIdentifier(o.username);
        setSelectedMatch({
          tenantSlug: o.tenantSlug,
          tenantName: o.tenantName,
          subtitle: o.subtitle ?? null,
          username: o.username,
        });
        setStep("password");
        setRememberSite(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const runIdentify = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      identifyRequestId.current += 1;
      singleSiteGateRef.current = false;
      setMatches([]);
      setSelectedMatch(null);
      setStep("identify");
      setError("");
      setIdentifyLoading(false);
      return;
    }
    const reqId = ++identifyRequestId.current;
    setIdentifyLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: trimmed }),
      });
      if (identifyRequestId.current !== reqId) return;

      if (!res.ok) {
        singleSiteGateRef.current = false;
        setMatches([]);
        setSelectedMatch(null);
        setStep("identify");
        setError("Could not look up your account. Try again in a moment.");
        return;
      }

      let data: { matches?: IdentifyMatch[] };
      try {
        data = (await res.json()) as { matches?: IdentifyMatch[] };
      } catch {
        if (identifyRequestId.current !== reqId) return;
        singleSiteGateRef.current = false;
        setMatches([]);
        setSelectedMatch(null);
        setStep("identify");
        setError("Unexpected response from server. Try again.");
        return;
      }

      if (identifyRequestId.current !== reqId) return;
      const list = Array.isArray(data.matches) ? data.matches : [];
      setMatches(list);
      if (list.length === 0) {
        singleSiteGateRef.current = false;
        setSelectedMatch(null);
        setStep("identify");
        setError("No school account found with that username on any site.");
      } else if (list.length === 1) {
        setSelectedMatch(list[0]);
        if (singleSiteGateRef.current) {
          setStep("identify");
        } else {
          setStep("password");
        }
      } else {
        singleSiteGateRef.current = false;
        setSelectedMatch(null);
        setMultiIndex(0);
        setStep("identify");
      }
    } catch {
      if (identifyRequestId.current !== reqId) return;
      setError("Could not look up your account. Check your connection.");
      setMatches([]);
      singleSiteGateRef.current = false;
      setSelectedMatch(null);
      setStep("identify");
    } finally {
      if (identifyRequestId.current === reqId) setIdentifyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step === "password") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runIdentify(identifier);
    }, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [identifier, runIdentify, step]);

  function handleContinueMulti() {
    const m = matches[multiIndex];
    if (!m) return;
    setSelectedMatch(m);
    setStep("password");
    setError("");
  }

  function handleBackToIdentify() {
    singleSiteGateRef.current = true;
    setStep("identify");
    setPassword("");
    setSelectedMatch(null);
    setMatches([]);
    setError("");
  }

  function handleContinueSingleSite() {
    singleSiteGateRef.current = false;
    setStep("password");
    setError("");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step !== "password" || !selectedMatch || !password.trim()) return;
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        tenantSlug: selectedMatch.tenantSlug,
        username: selectedMatch.username,
        password: password.trim(),
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid password, or this site no longer has your account.");
        return;
      }

      if (rememberSite) {
        localStorage.setItem(
          REMEMBER_KEY,
          JSON.stringify({
            ...selectedMatch,
            username: selectedMatch.username,
          })
        );
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      let s;
      try {
        s = await getSession();
      } catch {
        setError("Signed in, but we could not load your session. Refresh the page.");
        return;
      }

      if (s?.user?.role === "SUPER_ADMIN") {
        router.push("/super");
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } catch {
      setError("Could not sign in. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const quotesSlug = selectedMatch?.tenantSlug ?? matches[0]?.tenantSlug ?? "";
  const canSubmit =
    step === "password" && Boolean(selectedMatch) && password.trim().length > 0 && !loading;
  const showMultiPicker = step === "identify" && matches.length > 1;
  const showSingleSiteContinue =
    step === "identify" &&
    matches.length === 1 &&
    Boolean(selectedMatch) &&
    singleSiteGateRef.current;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 relative px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.12),_transparent_55%)]" />
      <FloatingQuotes tenantSlug={quotesSlug} />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-white/30 bg-white/65 p-8 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 supports-[backdrop-filter]:bg-white/55">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-400 shadow-sm ring-1 ring-violet-300/90 sm:h-12 sm:w-12"
                aria-hidden
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6 text-white sm:h-7 sm:w-7"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M11 3h2v8h8v2h-8v8h-2v-8H3v-2h8V3z" />
                </svg>
              </div>
              <p className="font-abyssinica text-3xl sm:text-4xl font-normal text-gray-900 leading-tight text-left">
                ማህበረ ቅዱሳን
              </p>
            </div>
            <p className="mt-2 text-sm font-medium uppercase tracking-[0.2em] text-indigo-800/90">
              Mahibere Kidusan
            </p>
            <p className="text-gray-600 mt-3 text-sm">Sign in to your school workspace</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
            noValidate
            aria-busy={loading || identifyLoading}
          >
            {error && (
              <div
                role="alert"
                className="bg-red-500/10 text-red-800 border border-red-200/80 px-4 py-3 rounded-xl text-sm"
              >
                {error}
              </div>
            )}

            {step === "identify" && (
              <>
                <div>
                  <label htmlFor="identifier" className="block text-sm font-semibold text-gray-800 mb-1.5">
                    Username
                  </label>
                  <input
                    id="identifier"
                    type="text"
                    name="identifier"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => {
                      singleSiteGateRef.current = false;
                      setIdentifier(e.target.value);
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300/80 bg-white/80 text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400"
                    placeholder="Your username at school"
                    aria-invalid={Boolean(error && step === "identify" && !identifyLoading)}
                    aria-describedby="identifier-hint"
                  />
                  <p id="identifier-hint" className="text-xs text-gray-500 mt-1.5">
                    We look up this username across all school sites. If you use the same name on more than
                    one site, you&apos;ll pick the right school next.
                  </p>
                  {identifyLoading && (
                    <p className="text-xs text-indigo-600 mt-2 font-medium" role="status" aria-live="polite">
                      Looking up your account…
                    </p>
                  )}
                </div>

                {showSingleSiteContinue && selectedMatch && (
                  <div
                    className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-4 space-y-3"
                    role="region"
                    aria-label="Site found for this username"
                  >
                    <p className="text-sm text-gray-800">
                      <span className="font-semibold">Found one site for this username:</span>{" "}
                      <span className="font-bold text-gray-900">{selectedMatch.tenantName}</span>
                      {selectedMatch.subtitle && (
                        <span className="text-gray-600"> ({selectedMatch.subtitle})</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-600">
                      Change the username above to use a different account, or continue to enter your password.
                    </p>
                    <button
                      type="button"
                      onClick={handleContinueSingleSite}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors"
                    >
                      Continue to password
                    </button>
                  </div>
                )}

                {showMultiPicker && (
                  <div
                    className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-4 space-y-3"
                    role="radiogroup"
                    aria-labelledby="site-picker-heading"
                  >
                    <p id="site-picker-heading" className="text-sm font-semibold text-gray-800">
                      Choose your site
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {matches.map((m, i) => (
                        <label
                          key={`${m.tenantSlug}-${m.username}`}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                            multiIndex === i
                              ? "border-indigo-500 bg-white shadow-sm"
                              : "border-gray-200 bg-white/60 hover:border-indigo-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="sitePick"
                            className="mt-1 text-indigo-600"
                            checked={multiIndex === i}
                            onChange={() => setMultiIndex(i)}
                          />
                          <span>
                            <span className="font-semibold text-gray-900">{m.tenantName}</span>
                            <span className="text-gray-500 text-sm"> ({m.tenantSlug})</span>
                            {m.subtitle && (
                              <span className="block text-xs text-gray-600 mt-0.5">{m.subtitle}</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleContinueMulti}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors"
                    >
                      Continue to password
                    </button>
                  </div>
                )}
              </>
            )}

            {step === "password" && selectedMatch && (
              <>
                <div
                  className="rounded-xl border border-emerald-200/90 bg-emerald-50/70 px-4 py-3 text-sm text-gray-800"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <p className="font-semibold text-emerald-900">Active site</p>
                  <p className="mt-1">
                    Logging into{" "}
                    <span className="font-bold text-gray-900">{selectedMatch.tenantName}</span>
                    {selectedMatch.subtitle && (
                      <>
                        {" "}
                        <span className="text-gray-600">({selectedMatch.subtitle})</span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-gray-600 mt-1 font-mono">Site key: {selectedMatch.tenantSlug}</p>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleBackToIdentify}
                    className="text-sm font-semibold text-indigo-700 hover:underline"
                    aria-label="Go back to change username or school"
                  >
                    ← Change username
                  </button>
                </div>

                <div className="opacity-90 scale-[0.98] origin-top transition-all">
                  <label htmlFor="username-readonly" className="block text-xs font-medium text-gray-500 mb-1">
                    Username
                  </label>
                  <input
                    id="username-readonly"
                    readOnly
                    value={selectedMatch.username}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100/80 text-gray-700 text-sm"
                    aria-readonly="true"
                    aria-label={`Username for this sign-in: ${selectedMatch.username}`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-800">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-xs font-semibold text-indigo-700 hover:underline"
                      aria-pressed={showPassword}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300/80 bg-white/90 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400"
                    placeholder="Enter password"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    id="remember-site"
                    type="checkbox"
                    checked={rememberSite}
                    onChange={(e) => setRememberSite(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">
                    Remember my site on this device{" "}
                    <span className="text-gray-500">(skips choosing school next time)</span>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-900/20 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </>
            )}
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Volunteer with an invite?{" "}
            <Link href="/join" className="font-semibold text-indigo-700 hover:underline">
              Sign in with link &amp; passcode
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-gray-500">
            Platform operators:{" "}
            <Link href="/system-portal" className="text-gray-700 font-semibold hover:underline">
              System portal
            </Link>
          </p>

          <div className="mt-6 p-4 rounded-xl bg-white/40 border border-white/50 text-xs text-gray-600 space-y-2">
            <p className="font-semibold text-gray-800">Demo</p>
            <p>
              Each site uses <code className="bg-white/80 px-1 rounded">admin</code> /{" "}
              <code className="bg-white/80 px-1 rounded">admin123</code> or{" "}
              <code className="bg-white/80 px-1 rounded">volunteer</code> /{" "}
              <code className="bg-white/80 px-1 rounded">volunteer123</code> (unless changed in{" "}
              <code className="bg-white/80 px-1 rounded">.env</code>).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
