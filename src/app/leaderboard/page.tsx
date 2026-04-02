"use client";

import { useEffect, useState } from "react";

interface LeaderboardEntry {
  id: string;
  firstName: string;
  lastName: string;
  totalStars: number;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stars")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20 text-gray-500">Loading...</div>;
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">⭐ Leaderboard</h1>
      <p className="text-gray-500 mb-8">Top performers from quizzes</p>

      {entries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
          No quiz results yet. Complete a quiz to see the leaderboard!
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className={`flex items-center gap-4 p-5 rounded-xl border transition-all ${
                index === 0
                  ? "bg-yellow-50 border-yellow-200 shadow-md"
                  : index === 1
                  ? "bg-gray-50 border-gray-200 shadow-sm"
                  : index === 2
                  ? "bg-orange-50 border-orange-200 shadow-sm"
                  : "bg-white border-gray-200"
              }`}
            >
              <div className="text-2xl w-10 text-center flex-shrink-0">
                {index < 3 ? medals[index] : (
                  <span className="text-lg text-gray-400 font-bold">#{index + 1}</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-lg">
                  {entry.firstName} {entry.lastName}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">⭐</span>
                <span className="text-2xl font-bold text-gray-900">
                  {entry.totalStars}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
