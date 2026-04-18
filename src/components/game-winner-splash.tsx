"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export type GameWinnerSplashProps = {
  open: boolean;
  variant: "jeopardy" | "quiz";
  /** Main celebration headline */
  title: string;
  /** Optional secondary line under title */
  highlight?: string;
  /** Supporting lines (scores, names, ties) */
  lines: string[];
  onContinue: () => void;
  continueLabel?: string;
  /** Optional second action (e.g. stay on Jeopardy board) */
  onDismiss?: () => void;
  dismissLabel?: string;
};

/** Floating ornaments — crosses and stars (Sunday school / church-school tone) */
function FloatingOrnaments() {
  const items = useMemo(
    () =>
      [
        { s: "✦", l: "12%", t: "18%", d: 5.2, delay: 0 },
        { s: "✧", l: "78%", t: "22%", d: 4.5, delay: 0.4 },
        { s: "✝", l: "88%", t: "65%", d: 6, delay: 0.2 },
        { s: "✦", l: "8%", t: "55%", d: 5.5, delay: 0.6 },
        { s: "✧", l: "45%", t: "12%", d: 4.8, delay: 0.1 },
        { s: "✦", l: "52%", t: "78%", d: 5, delay: 0.3 },
        { s: "✧", l: "25%", t: "72%", d: 6.2, delay: 0.5 },
        { s: "✦", l: "92%", t: "38%", d: 4.3, delay: 0.7 },
      ] as const,
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {items.map((it, i) => (
        <span
          key={i}
          className="absolute text-amber-300/50 text-lg md:text-2xl select-none"
          style={{
            left: it.l,
            top: it.t,
            animation: `winner-ornament-float ${it.d}s ease-in-out infinite`,
            animationDelay: `${it.delay}s`,
          }}
        >
          {it.s}
        </span>
      ))}
    </div>
  );
}

export function GameWinnerSplash({
  open,
  variant,
  title,
  highlight,
  lines,
  onContinue,
  continueLabel = "Continue",
  onDismiss,
  dismissLabel = "Stay here",
}: GameWinnerSplashProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  const verse =
    variant === "quiz"
      ? "“Well done, good and faithful servant.” — Matthew 25:21"
      : "“Let us rejoice and be glad in Him.” — Psalm 118:24";

  const node = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="winner-splash-title"
    >
      {/* Backdrop layers */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#06150c] via-slate-900 to-[#020806]"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-[0.35] animate-[winner-glow-pulse_5s_ease-in-out_infinite]"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% -10%, rgba(251, 191, 36, 0.45), transparent 55%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(201, 162, 39, 0.2), transparent 50%)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-30 mix-blend-screen animate-[winner-shimmer_8s_linear_infinite] bg-[length:200%_200%]"
        style={{
          background:
            "linear-gradient(125deg, transparent 40%, rgba(255, 250, 220, 0.12) 50%, transparent 60%)",
        }}
        aria-hidden
      />

      <FloatingOrnaments />

      <div className="relative z-10 w-full max-w-lg rounded-3xl border-2 border-amber-400/50 bg-gradient-to-b from-slate-900/95 to-[#0a1f12]/98 px-6 py-10 md:px-10 md:py-12 shadow-[0_0_60px_rgba(201,162,39,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm text-center">
        <p className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.35em] text-amber-200/85 mb-3">
          ይክበር አምላክ · Glory to God
        </p>

        <h2
          id="winner-splash-title"
          className="font-bold text-white text-2xl md:text-4xl leading-tight mb-2"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {title}
        </h2>

        {highlight ? (
          <p className="text-lg md:text-xl font-semibold text-amber-100/95 mb-5 leading-snug">{highlight}</p>
        ) : null}

        {lines.length > 0 && (
          <ul className="text-left space-y-2.5 mb-8 text-white/90 text-sm md:text-base border-t border-amber-400/20 pt-6">
            {lines.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-amber-300 shrink-0 mt-0.5">✦</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}

        <p
          className="text-xs md:text-sm text-white/65 italic leading-relaxed mb-8 border-t border-gray-200 pt-6"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {verse}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="order-2 sm:order-1 rounded-xl border border-indigo-300 px-5 py-3 text-sm font-medium text-white/90 hover:bg-white/5 transition-colors"
            >
              {dismissLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onContinue}
            className="order-1 sm:order-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-400 px-8 py-3.5 text-sm md:text-base font-bold text-gray-900 shadow-lg shadow-amber-900/30 hover:from-amber-100 hover:to-amber-300 transition-all border border-amber-200/50"
          >
            {continueLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
