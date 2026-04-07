"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameWinnerSplash } from "@/components/game-winner-splash";

export type JeopardyCellDTO = {
  id: string;
  points: number;
  clue: string;
  answer: string;
  sortOrder: number;
  contentId: string | null;
};

export type JeopardyCategoryDTO = {
  id: string;
  title: string;
  sortOrder: number;
  cells: JeopardyCellDTO[];
};

export type JeopardySettingsDTO = {
  columns: number;
  rows: number;
  teamCount: number;
};

type PlayMode = "solo" | "teams";

type StudentOpt = { id: string; firstName: string; lastName: string };

type Props = {
  topicId: string;
  topicTitle: string;
  categories: JeopardyCategoryDTO[];
  settings: JeopardySettingsDTO;
  onBack: () => void;
  onFinish: () => void;
};

function defaultTeamLabels(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Team ${i + 1}`);
}

function jeopardyWinnerCopy(
  playMode: PlayMode,
  teamNames: string[],
  teamScores: Record<string, number>,
  studentScores: Record<string, number>,
  students: StudentOpt[]
): { title: string; highlight?: string; lines: string[] } {
  if (playMode === "teams") {
    const entries = teamNames.map((n) => [n, teamScores[n] ?? 0] as const);
    const max = Math.max(0, ...entries.map(([, s]) => s));
    if (max === 0) {
      return {
        title: "The board is complete",
        highlight: "Give thanks for every truth recalled in faith.",
        lines: [],
      };
    }
    const winners = entries.filter(([, s]) => s === max).map(([n]) => n);
    return {
      title: winners.length > 1 ? "A joyful tie!" : "We celebrate you!",
      highlight:
        winners.length > 1
          ? `${winners.join(" & ")} shine together at ${max} points.`
          : `${winners[0]} leads today with ${max} points.`,
      lines: entries
        .filter(([, s]) => s > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([n, s]) => `${n}: ${s} point${s === 1 ? "" : "s"}`),
    };
  }

  const sorted = Object.entries(studentScores)
    .filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    return {
      title: "Blessed are those who seek wisdom",
      highlight: "When you finish, stars will go to each child you marked.",
      lines: [],
    };
  }
  const [topId, topPts] = sorted[0];
  const st = students.find((s) => s.id === topId);
  const lines = sorted.slice(0, 8).map(([id, pts]) => {
    const s = students.find((x) => x.id === id);
    return `${s ? `${s.firstName} ${s.lastName}` : "Student"} — ${pts} star${pts === 1 ? "" : "s"}`;
  });
  return {
    title: "Heaven rejoices with you",
    highlight: `${st?.firstName ?? "A student"} gathered the most stars (${topPts}).`,
    lines,
  };
}

export function JeopardyPlayMode({
  topicId,
  topicTitle,
  categories,
  settings,
  onBack,
  onFinish,
}: Props) {
  const [playMode, setPlayMode] = useState<PlayMode>("solo");
  const [teamNames, setTeamNames] = useState(() => defaultTeamLabels(settings.teamCount));
  const [teamScores, setTeamScores] = useState<Record<string, number>>({});
  const [studentScores, setStudentScores] = useState<Record<string, number>>({});
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [activeCell, setActiveCell] = useState<JeopardyCellDTO | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [awardStudentId, setAwardStudentId] = useState("");
  const [winnerSplashOpen, setWinnerSplashOpen] = useState(false);
  const [winnerSplashReason, setWinnerSplashReason] = useState<"end" | "complete">("end");
  const boardCompleteCelebratedRef = useRef(false);

  useEffect(() => {
    fetch("/api/students")
      .then((r) => r.json())
      .then((data: StudentOpt[]) => {
        if (Array.isArray(data)) setStudents(data);
      });
  }, []);

  useEffect(() => {
    setTeamNames((prev) => {
      const n = settings.teamCount;
      if (prev.length === n) return prev;
      return Array.from({ length: n }, (_, i) => prev[i] ?? `Team ${i + 1}`);
    });
  }, [settings.teamCount]);

  const totalCells = useMemo(
    () => categories.reduce((n, c) => n + c.cells.length, 0),
    [categories]
  );

  useEffect(() => {
    if (totalCells === 0 || revealed.size < totalCells) {
      boardCompleteCelebratedRef.current = false;
      return;
    }
    if (activeCell || boardCompleteCelebratedRef.current) return;
    boardCompleteCelebratedRef.current = true;
    setWinnerSplashReason("complete");
    setWinnerSplashOpen(true);
  }, [revealed.size, totalCells, activeCell]);

  const openCell = useCallback((cell: JeopardyCellDTO) => {
    if (revealed.has(cell.id)) return;
    setActiveCell(cell);
    setShowAnswer(false);
  }, [revealed]);

  const closeModal = useCallback(() => {
    setActiveCell(null);
    setShowAnswer(false);
    setAwardStudentId("");
  }, []);

  const markRevealed = useCallback(() => {
    if (!activeCell) return;
    setRevealed((prev) => new Set(prev).add(activeCell.id));
    closeModal();
  }, [activeCell, closeModal]);

  const awardTeam = useCallback(
    (team: string) => {
      if (!activeCell) return;
      setTeamScores((prev) => ({
        ...prev,
        [team]: (prev[team] ?? 0) + activeCell.points,
      }));
      markRevealed();
    },
    [activeCell, markRevealed]
  );

  const awardSolo = useCallback(() => {
    if (!activeCell || !awardStudentId) return;
    setStudentScores((prev) => ({
      ...prev,
      [awardStudentId]: (prev[awardStudentId] ?? 0) + activeCell.points,
    }));
    markRevealed();
  }, [activeCell, awardStudentId, markRevealed]);

  async function commitJeopardyFinish() {
    setWinnerSplashOpen(false);
    if (playMode === "solo") {
      for (const [studentId, points] of Object.entries(studentScores)) {
        if (points <= 0) continue;
        await fetch("/api/stars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, topicId, points }),
        });
      }
    }
    await fetch(`/api/topics/${topicId}/taught`, { method: "POST" });
    onFinish();
  }

  function openEndGameSplash() {
    setWinnerSplashReason("end");
    setWinnerSplashOpen(true);
  }

  const splashCopy = jeopardyWinnerCopy(
    playMode,
    teamNames,
    teamScores,
    studentScores,
    students
  );

  const maxPointsWidth = useMemo(() => {
    let m = 1;
    for (const c of categories) {
      for (const cell of c.cells) m = Math.max(m, cell.points);
    }
    return String(m).length;
  }, [categories]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-slate-900 text-white">
      <div className="border-b border-indigo-200 px-4 py-3 bg-slate-900/95">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">Jeopardy: {topicTitle}</h1>
            <p className="text-xs text-white/70">
              {revealed.size} / {totalCells} revealed · Solo awards stars; teams keep score on screen only
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={playMode}
              onChange={(e) => setPlayMode(e.target.value as PlayMode)}
              className="rounded-lg border border-amber-400/35 bg-slate-900 px-2 py-1.5 text-sm text-white"
            >
              <option value="solo">Solo (students + stars)</option>
              <option value="teams">Teams / groups</option>
            </select>
            {playMode === "teams" && (
              <div className="flex flex-wrap items-center gap-1.5 max-w-md">
                <span className="text-[10px] uppercase tracking-wide text-white/60 shrink-0">
                  Groups ({settings.teamCount})
                </span>
                {teamNames.map((name, i) => (
                  <input
                    key={i}
                    type="text"
                    value={name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTeamNames((prev) => prev.map((p, j) => (j === i ? v : p)));
                    }}
                    className="min-w-[5.5rem] max-w-[8rem] flex-1 rounded-md border border-amber-400/35 bg-slate-900 px-2 py-1 text-xs text-white"
                    aria-label={`Team ${i + 1} name`}
                  />
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (confirm("Clear all revealed cells on the board?")) {
                  boardCompleteCelebratedRef.current = false;
                  setRevealed(new Set());
                }
              }}
              className="rounded-lg border border-amber-400/30 px-3 py-1.5 text-sm text-white hover:bg-amber-500/10"
            >
              Reset board
            </button>
            <button
              type="button"
              onClick={onBack}
              className="text-sm font-medium text-amber-300 hover:underline"
            >
              ← Slides
            </button>
            <button
              type="button"
              onClick={openEndGameSplash}
              className="rounded-lg bg-amber-400 px-4 py-1.5 text-sm font-semibold text-gray-900 hover:bg-gray-100"
            >
              End game ✓
            </button>
          </div>
        </div>
      </div>

      {(playMode === "teams" && teamNames.length > 0) || playMode === "solo" ? (
        <div className="border-b border-amber-400/20 bg-black/20 px-4 py-2">
          <div className="max-w-6xl mx-auto flex flex-wrap gap-4 text-sm">
            {playMode === "teams"
              ? teamNames.map((name, i) => (
                  <span key={`score-${i}`} className="font-semibold tabular-nums">
                    {name}: <span className="text-amber-300">{teamScores[name] ?? 0}</span>
                  </span>
                ))
              : students.length > 0 && (
                  <span className="text-white/80">
                    Stars will be awarded for totals shown when you pick a student per clue.
                  </span>
                )}
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-6xl mx-auto overflow-x-auto">
          <div
            className="grid gap-2 min-w-[640px]"
            style={{
              gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))`,
            }}
          >
            {categories.map((cat) => (
              <div key={cat.id} className="flex flex-col gap-2">
                <div className="min-h-[3.5rem] flex items-center justify-center rounded-lg bg-amber-400 px-2 py-2 text-center text-sm font-bold uppercase tracking-wide text-gray-900 leading-tight">
                  {cat.title}
                </div>
                {cat.cells.map((cell) => {
                  const done = revealed.has(cell.id);
                  return (
                    <button
                      key={cell.id}
                      type="button"
                      disabled={done}
                      onClick={() => openCell(cell)}
                      className={`min-h-[4rem] rounded-lg border-2 text-lg font-bold tabular-nums transition-all ${
                        done
                          ? "border-slate-700 bg-slate-900/50 text-white/35 cursor-default line-through"
                          : "border-amber-400/50 bg-indigo-600 text-white shadow-md hover:border-amber-400 hover:scale-[1.02] active:scale-[0.98]"
                      }`}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {done ? "—" : cell.points.toString().padStart(maxPointsWidth, "\u00a0")}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <GameWinnerSplash
        open={winnerSplashOpen}
        variant="jeopardy"
        title={splashCopy.title}
        highlight={splashCopy.highlight}
        lines={splashCopy.lines}
        onContinue={() => void commitJeopardyFinish()}
        continueLabel="Give thanks & finish"
        onDismiss={() => setWinnerSplashOpen(false)}
        dismissLabel={winnerSplashReason === "complete" ? "Stay on board" : "Go back"}
      />

      {activeCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border-2 border-amber-400 bg-slate-900 p-8 shadow-2xl">
            <p className="text-center text-sm font-semibold text-amber-300 mb-2">
              {activeCell.points} points
            </p>
            <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-6 leading-snug">
              {activeCell.clue}
            </h2>

            {!showAnswer ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAnswer(true)}
                  className="rounded-xl bg-amber-400 px-8 py-3 text-lg font-bold text-gray-900 hover:bg-gray-100"
                >
                  Show answer
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-xl border border-indigo-300 bg-black/25 p-5">
                  <p className="text-xs uppercase tracking-wider text-amber-300/80 mb-2">Answer</p>
                  <p className="text-lg text-white whitespace-pre-wrap">{activeCell.answer}</p>
                </div>

                {playMode === "solo" ? (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-white/90">
                      Who earned these points?
                    </label>
                    <select
                      value={awardStudentId}
                      onChange={(e) => setAwardStudentId(e.target.value)}
                      className="w-full rounded-lg border border-amber-400/35 bg-slate-900 px-4 py-2.5 text-white"
                    >
                      <option value="">Select student…</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        onClick={closeModal}
                        className="rounded-lg border border-indigo-300 px-4 py-2 text-sm text-white hover:bg-white/5"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={markRevealed}
                        className="rounded-lg border border-indigo-300 px-4 py-2 text-sm text-white hover:bg-white/5"
                      >
                        Mark done (no points)
                      </button>
                      <button
                        type="button"
                        onClick={awardSolo}
                        disabled={!awardStudentId}
                        className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
                      >
                        Award {activeCell.points} pts + close
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-white/85">Add points to the team that answered:</p>
                    <div className="flex flex-wrap gap-2">
                      {teamNames.map((name, i) => (
                        <button
                          key={`award-${i}`}
                          type="button"
                          onClick={() => awardTeam(name)}
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 border border-indigo-200"
                        >
                          {name} +{activeCell.points}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={markRevealed}
                      className="text-sm text-amber-300/80 hover:underline"
                    >
                      Skip scoring (mark done only)
                    </button>
                  </div>
                )}
              </div>
            )}

            {!showAnswer && (
              <button
                type="button"
                onClick={closeModal}
                className="mt-6 w-full text-center text-sm text-white/60 hover:text-white"
              >
                Close without revealing
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
