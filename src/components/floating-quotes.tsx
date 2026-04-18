"use client";

import { useEffect, useState, useCallback } from "react";

interface Quote {
  id: string;
  quote: string;
  reference: string;
  category: string;
}

interface FloatingQuote {
  id: string;
  quote: Quote;
  top: number;
  left: number;
  visible: boolean;
}

const categoryLabels: Record<string, string> = {
  hope: "ተስፋ",
  happiness: "ደስታ",
  resilience: "ጥንካሬ",
  love: "ፍቅር",
  faith: "እምነት",
  peace: "ሰላም",
  wisdom: "ጥበብ",
  mercy: "ምህረት",
};

const categoryColors: Record<string, string> = {
  hope: "text-yellow-200",
  happiness: "text-pink-200",
  resilience: "text-orange-200",
  love: "text-red-200",
  faith: "text-blue-200",
  peace: "text-green-200",
  wisdom: "text-purple-200",
  mercy: "text-teal-200",
};

function pickRandom<T>(arr: T[], exclude: T[] = []): T {
  const pool = arr.filter((item) => !exclude.includes(item));
  const source = pool.length > 0 ? pool : arr;
  return source[Math.floor(Math.random() * source.length)];
}

function randomPosition(slot: number) {
  // Split screen into zones to avoid overlap with center login form
  // slot 0 = top-left region, slot 1 = bottom-right region
  const zones = [
    { top: [5, 30], left: [3, 30] },
    { top: [65, 88], left: [60, 92] },
  ];
  const zone = zones[slot % zones.length];
  return {
    top: zone.top[0] + Math.random() * (zone.top[1] - zone.top[0]),
    left: zone.left[0] + Math.random() * (zone.left[1] - zone.left[0]),
  };
}

export function FloatingQuotes({ tenantSlug }: { tenantSlug?: string }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [floating, setFloating] = useState<FloatingQuote[]>([]);

  useEffect(() => {
    const slug = tenantSlug?.trim().toLowerCase();
    const url = slug ? `/api/quotes?tenantSlug=${encodeURIComponent(slug)}` : "/api/quotes";
    fetch(url)
      .then((r) => r.json())
      .then((data: Quote[]) => {
        if (Array.isArray(data) && data.length > 0) setQuotes(data);
        else setQuotes([]);
      })
      .catch(() => {
        setQuotes([]);
      });
  }, [tenantSlug]);

  const spawnPair = useCallback(() => {
    if (quotes.length < 2) return;

    const q1 = pickRandom(quotes);
    const q2 = pickRandom(quotes, [q1]);
    const pos1 = randomPosition(0);
    const pos2 = randomPosition(1);
    const now = Date.now();

    const newFloating: FloatingQuote[] = [
      { id: `${now}-0`, quote: q1, ...pos1, visible: false },
      { id: `${now}-1`, quote: q2, ...pos2, visible: false },
    ];

    setFloating(newFloating);
    // Trigger fade-in after mount
    requestAnimationFrame(() => {
      setFloating((prev) => prev.map((f) => ({ ...f, visible: true })));
    });
  }, [quotes]);

  useEffect(() => {
    if (quotes.length === 0) return;

    // Spawn initial pair
    spawnPair();

    // Rotate every 10 seconds
    const interval = setInterval(() => {
      // Fade out first
      setFloating((prev) => prev.map((f) => ({ ...f, visible: false })));
      // Then spawn new after fade-out completes
      setTimeout(() => spawnPair(), 1000);
    }, 10000);

    return () => clearInterval(interval);
  }, [quotes, spawnPair]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {floating.map((f) => (
        <div
          key={f.id}
          className={`absolute max-w-xs transition-opacity duration-1000 ${
            f.visible ? "opacity-90" : "opacity-0"
          }`}
          style={{ top: `${f.top}%`, left: `${f.left}%` }}
        >
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/20 shadow-lg">
            <p
              className={`text-sm font-medium leading-relaxed ${
                categoryColors[f.quote.category] || "text-white"
              }`}
            >
              &ldquo;{f.quote.quote}&rdquo;
            </p>
            <p className="text-xs text-white/70 mt-1.5 font-semibold">
              — {f.quote.reference}
            </p>
            <span className="inline-block mt-1 text-[10px] bg-white/15 text-white/60 rounded-full px-2 py-0.5">
              {categoryLabels[f.quote.category] || f.quote.category}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
