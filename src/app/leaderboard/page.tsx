"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { TeachingContextGuard } from "@/components/teaching-context-guard";
import { sessionHasTeachingContext } from "@/lib/teaching-context-client";

type LeaderScope = "subject" | "class";

interface LeaderboardEntry {
  id: string;
  firstName: string;
  lastName: string;
  totalStars: number;
}

export default function LeaderboardPage() {
  const { data: session, status } = useSession();
  const [scope, setScope] = useState<LeaderScope>("subject");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    if (!sessionHasTeachingContext(session.user)) return;

    let cancelled = false;
    setLoading(true);
    const q = scope === "subject" ? "?scope=subject" : "?scope=class";
    fetch(`/api/stars${q}`)
      .then(async (r) => {
        const data = (await r.json()) as unknown;
        if (cancelled) return;
        setEntries(Array.isArray(data) ? (data as LeaderboardEntry[]) : []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setEntries([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status, session?.user, scope]);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <TeachingContextGuard>
      {loading ? (
        <div className="flex justify-center py-20 text-gray-500">Loading...</div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">⭐ Leaderboard</h1>
          <p className="text-gray-500 mb-4">Top performers from quizzes in this class.</p>

          <div
            className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            role="tablist"
            aria-label="Leaderboard scope"
          >
            <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                role="tab"
                aria-selected={scope === "subject"}
                onClick={() => setScope("subject")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  scope === "subject"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                This subject
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={scope === "class"}
                onClick={() => setScope("class")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  scope === "class"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                All-time (class)
              </button>
            </div>
            <p className="text-xs text-gray-500 sm:max-w-xs sm:text-right">
              {scope === "subject"
                ? "Stars from topics in your current subject only — your session leaderboard."
                : "Every star across all subjects in this class."}
            </p>
          </div>

          {entries.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
              No students in this class yet.
            </div>
          ) : entries.every((e) => e.totalStars === 0) ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
              {scope === "subject"
                ? "No quiz stars in this subject yet. Run a quiz or switch to “All-time (class)” to see other totals."
                : "No quiz results yet. Complete a quiz to see the leaderboard!"}
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry, index) => {
                const isTop = index === 0 && entry.totalStars > 0;
                const leaderBadge =
                  isTop &&
                  (scope === "subject" ? (
                    <span className="mt-1 inline-flex w-fit items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-sky-900">
                      Session leader
                    </span>
                  ) : (
                    <span className="mt-1 inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-950">
                      All-time leader
                    </span>
                  ));

                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-4 p-5 rounded-xl border transition-all ${
                      index === 0 && entry.totalStars > 0
                        ? scope === "subject"
                          ? "bg-sky-50/80 border-sky-200 shadow-md"
                          : "bg-yellow-50 border-yellow-200 shadow-md"
                        : index === 1
                          ? "bg-gray-50 border-gray-200 shadow-sm"
                          : index === 2
                            ? "bg-orange-50 border-orange-200 shadow-sm"
                            : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="text-2xl w-10 text-center flex-shrink-0">
                      {index < 3 && entry.totalStars > 0 ? (
                        medals[index]
                      ) : (
                        <span className="text-lg text-gray-400 font-bold">#{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {entry.firstName} {entry.lastName}
                      </h3>
                      {leaderBadge}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-2xl">⭐</span>
                      <span className="text-2xl font-bold text-indigo-600 tabular-nums">{entry.totalStars}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </TeachingContextGuard>
  );
}
