"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { errorMessageFromJson } from "@/lib/api-client";
import {
  JEOPARDY_LIMITS,
  clampJeopardyColumns,
  clampJeopardyRows,
  clampJeopardyTeamCount,
  pointTiersForRows,
} from "@/lib/jeopardy-generate";
import type { JeopardyCategoryDTO, JeopardySettingsDTO } from "@/components/jeopardy-play-mode";

type CellDraft = { points: number; clue: string; answer: string };
type CatDraft = { title: string; contentId: string | null; cells: CellDraft[] };

function dtoToDrafts(categories: JeopardyCategoryDTO[]): CatDraft[] {
  return categories.map((c) => ({
    title: c.title,
    contentId: c.cells[0]?.contentId ?? null,
    cells: c.cells.map((cell) => ({
      points: cell.points,
      clue: cell.clue,
      answer: cell.answer,
    })),
  }));
}

function emptyCategory(title: string, tiers: number[]): CatDraft {
  return {
    title,
    contentId: null,
    cells: tiers.map((points) => ({
      points,
      clue: "",
      answer: "",
    })),
  };
}

function resizeDraftsToGrid(drafts: CatDraft[], columns: number, rows: number): CatDraft[] {
  const tiers = pointTiersForRows(rows);
  const next = drafts.slice(0, columns);
  while (next.length < columns) {
    next.push(emptyCategory(`Category ${next.length + 1}`, tiers));
  }
  return next.map((cat) => {
    const cells = cat.cells.slice(0, rows);
    while (cells.length < rows) {
      const idx = cells.length;
      cells.push({
        points: tiers[idx] ?? 100 * (idx + 1),
        clue: "",
        answer: "",
      });
    }
    return { ...cat, cells };
  });
}

export function JeopardyBoardEditor({ topicId }: { topicId: string }) {
  const [drafts, setDrafts] = useState<CatDraft[]>([]);
  const [settings, setSettings] = useState<JeopardySettingsDTO>({
    columns: 5,
    rows: 5,
    teamCount: 2,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [okHint, setOkHint] = useState("");

  const tiers = useMemo(() => pointTiersForRows(settings.rows), [settings.rows]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/topics/${topicId}/jeopardy`);
    const data = await res.json().catch(() => ({}));
    const cats = Array.isArray(data.categories) ? data.categories : [];
    if (data.settings && typeof data.settings === "object") {
      const s = data.settings as Record<string, unknown>;
      const num = (v: unknown, fallback: number) =>
        typeof v === "number" && Number.isFinite(v)
          ? v
          : typeof v === "string"
            ? parseInt(v, 10)
            : fallback;
      setSettings({
        columns: clampJeopardyColumns(num(s.columns, 5)),
        rows: clampJeopardyRows(num(s.rows, 5)),
        teamCount: clampJeopardyTeamCount(num(s.teamCount, 2)),
      });
    }
    setDrafts(cats.length > 0 ? dtoToDrafts(cats) : []);
    setLoading(false);
  }, [topicId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSettingsOnly() {
    setEditorError("");
    setOkHint("");
    setSaving(true);
    const res = await fetch(`/api/topics/${topicId}/jeopardy`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: {
          columns: settings.columns,
          rows: settings.rows,
          teamCount: settings.teamCount,
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setEditorError(errorMessageFromJson(data, "Could not save layout."));
      return;
    }
    if (data.settings) setSettings(data.settings);
    setOkHint("Layout and team defaults saved.");
  }

  async function handleGenerate() {
    if (!confirm("Replace the current Jeopardy board with auto-generated clues from slides and quizzes?")) {
      return;
    }
    setEditorError("");
    setOkHint("");
    setGenerating(true);
    const res = await fetch(`/api/topics/${topicId}/jeopardy/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        columns: settings.columns,
        rows: settings.rows,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setGenerating(false);
    if (!res.ok) {
      setEditorError(errorMessageFromJson(data, "Could not generate the board."));
      return;
    }
    if (Array.isArray(data.categories)) {
      setDrafts(dtoToDrafts(data.categories));
    }
    if (data.settings) setSettings(data.settings);
  }

  async function handleSave() {
    setEditorError("");
    setOkHint("");
    if (drafts.length === 0) {
      setEditorError("Add at least one category, or generate a board.");
      return;
    }
    if (drafts.length > settings.columns) {
      setEditorError(
        `You have more categories than columns. Trim to at most ${settings.columns} categories or increase columns.`
      );
      return;
    }
    for (const c of drafts) {
      if (!c.title.trim()) {
        setEditorError("Each category needs a title.");
        return;
      }
      if (c.cells.length > settings.rows) {
        setEditorError(
          `Each category may have at most ${settings.rows} rows. Remove rows or increase board rows.`
        );
        return;
      }
      for (const cell of c.cells) {
        if (!cell.clue.trim() || !cell.answer.trim()) {
          setEditorError("Every cell needs both a clue and an answer.");
          return;
        }
      }
    }

    setSaving(true);
    const res = await fetch(`/api/topics/${topicId}/jeopardy`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: {
          columns: settings.columns,
          rows: settings.rows,
          teamCount: settings.teamCount,
        },
        categories: drafts.map((c) => ({
          title: c.title.trim(),
          contentId: c.contentId,
          cells: c.cells.map((cell) => ({
            points: cell.points,
            clue: cell.clue.trim(),
            answer: cell.answer.trim(),
          })),
        })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setEditorError(errorMessageFromJson(data, "Could not save the board."));
      return;
    }
    if (Array.isArray(data.categories)) {
      setDrafts(dtoToDrafts(data.categories));
    }
    if (data.settings) setSettings(data.settings);
    setOkHint("Jeopardy board saved.");
  }

  function addCategory() {
    if (drafts.length >= settings.columns) return;
    setDrafts((d) => [...d, emptyCategory(`Category ${d.length + 1}`, tiers)]);
  }

  function removeCategory(index: number) {
    setDrafts((d) => d.filter((_, i) => i !== index));
  }

  function updateCategoryTitle(index: number, title: string) {
    setDrafts((d) => d.map((c, i) => (i === index ? { ...c, title } : c)));
  }

  function updateCell(ci: number, ri: number, patch: Partial<CellDraft>) {
    setDrafts((d) =>
      d.map((c, i) => {
        if (i !== ci) return c;
        const cells = c.cells.map((cell, j) => (j === ri ? { ...cell, ...patch } : cell));
        return { ...c, cells };
      })
    );
  }

  function addCell(catIndex: number) {
    setDrafts((d) =>
      d.map((c, i) => {
        if (i !== catIndex || c.cells.length >= settings.rows) return c;
        const last = c.cells[c.cells.length - 1];
        const nextPoints = last ? last.points + 100 : tiers[c.cells.length] ?? 100 * (c.cells.length + 1);
        return { ...c, cells: [...c.cells, { points: nextPoints, clue: "", answer: "" }] };
      })
    );
  }

  function removeCell(catIndex: number, cellIndex: number) {
    setDrafts((d) =>
      d.map((c, i) => {
        if (i !== catIndex || c.cells.length <= 1) return c;
        return { ...c, cells: c.cells.filter((_, j) => j !== cellIndex) };
      })
    );
  }

  function applyGridToDrafts() {
    setDrafts((d) => resizeDraftsToGrid(d, settings.columns, settings.rows));
  }

  if (loading) {
    return <p className="text-sm text-gray-600">Loading Jeopardy board…</p>;
  }

  return (
    <div className="space-y-4">
      <ApiErrorAlert
        message={editorError}
        onDismiss={editorError ? () => setEditorError("") : undefined}
      />
      {okHint && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {okHint}
        </p>
      )}
      <div className="rounded-xl border border-gray-200 bg-white/90 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Board & groups</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            Columns (categories)
            <input
              type="number"
              min={JEOPARDY_LIMITS.minColumns}
              max={JEOPARDY_LIMITS.maxColumns}
              value={settings.columns}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  columns: Math.min(
                    JEOPARDY_LIMITS.maxColumns,
                    Math.max(JEOPARDY_LIMITS.minColumns, parseInt(e.target.value, 10) || s.columns)
                  ),
                }))
              }
              className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-gray-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            Rows (point levels)
            <input
              type="number"
              min={JEOPARDY_LIMITS.minRows}
              max={JEOPARDY_LIMITS.maxRows}
              value={settings.rows}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  rows: Math.min(
                    JEOPARDY_LIMITS.maxRows,
                    Math.max(JEOPARDY_LIMITS.minRows, parseInt(e.target.value, 10) || s.rows)
                  ),
                }))
              }
              className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-gray-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            Teams (for group play)
            <input
              type="number"
              min={JEOPARDY_LIMITS.minTeams}
              max={JEOPARDY_LIMITS.maxTeams}
              value={settings.teamCount}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  teamCount: Math.min(
                    JEOPARDY_LIMITS.maxTeams,
                    Math.max(JEOPARDY_LIMITS.minTeams, parseInt(e.target.value, 10) || s.teamCount)
                  ),
                }))
              }
              className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-gray-900"
            />
          </label>
          <button
            type="button"
            onClick={() => void saveSettingsOnly()}
            disabled={saving}
            className="text-sm font-medium text-indigo-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 disabled:opacity-50"
          >
            Save layout only
          </button>
          <button
            type="button"
            onClick={applyGridToDrafts}
            disabled={drafts.length === 0}
            className="text-sm font-medium text-gray-800 border border-indigo-300 rounded-lg px-3 py-1.5 hover:bg-indigo-100 disabled:opacity-40"
            title="Trim or pad the draft board to match columns × rows (does not save)"
          >
            Resize draft to match
          </button>
        </div>
        <p className="text-[11px] text-gray-600">
          Columns {JEOPARDY_LIMITS.minColumns}–{JEOPARDY_LIMITS.maxColumns}, rows {JEOPARDY_LIMITS.minRows}–
          {JEOPARDY_LIMITS.maxRows}, teams {JEOPARDY_LIMITS.minTeams}–{JEOPARDY_LIMITS.maxTeams}. Default points
          for new rows: 100, 200, … per row.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={generating}
          className="bg-amber-400 hover:bg-amber-500 text-gray-900 text-sm font-semibold px-4 py-2 rounded-lg border border-indigo-300 disabled:opacity-50"
        >
          {generating ? "Generating…" : "Auto-generate from slides & quizzes"}
        </button>
        <button
          type="button"
          onClick={addCategory}
          disabled={drafts.length >= settings.columns}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 border border-gray-200 rounded-lg px-3 py-1.5 disabled:opacity-40"
        >
          Add category
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg border border-indigo-200 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save board"}
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!confirm("Remove the entire Jeopardy board for this topic?")) return;
            setEditorError("");
            setOkHint("");
            setSaving(true);
            const res = await fetch(`/api/topics/${topicId}/jeopardy`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ categories: [] }),
            });
            const data = await res.json().catch(() => ({}));
            setSaving(false);
            if (!res.ok) {
              setEditorError(errorMessageFromJson(data, "Could not clear the board."));
              return;
            }
            setDrafts([]);
            setOkHint("Board cleared.");
          }}
          disabled={saving || drafts.length === 0}
          className="text-sm text-red-700 hover:underline disabled:opacity-40"
        >
          Clear board
        </button>
      </div>

      {drafts.length === 0 ? (
        <p className="text-sm text-gray-600 italic">
          No board yet — set size above, then generate or add categories.
        </p>
      ) : (
        <div className="space-y-8">
          {drafts.map((cat, ci) => (
            <div
              key={ci}
              className="rounded-xl border border-gray-200 bg-indigo-50 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={cat.title}
                  onChange={(e) => updateCategoryTitle(ci, e.target.value)}
                  className="flex-1 min-w-[12rem] px-3 py-2 border border-gray-200 rounded-lg font-semibold text-gray-900"
                  placeholder="Category title"
                />
                <button
                  type="button"
                  onClick={() => addCell(ci)}
                  disabled={cat.cells.length >= settings.rows}
                  className="text-xs text-indigo-600 font-medium disabled:opacity-40"
                >
                  + Row
                </button>
                <button
                  type="button"
                  onClick={() => removeCategory(ci)}
                  className="text-xs text-red-600 font-medium"
                >
                  Remove category
                </button>
              </div>
              <div className="space-y-3">
                {cat.cells.map((cell, ri) => (
                  <div
                    key={ri}
                    className="grid sm:grid-cols-[5rem_1fr_1fr_auto] gap-2 items-start bg-white/80 rounded-lg p-3 border border-gray-200"
                  >
                    <input
                      type="number"
                      min={1}
                      max={999999}
                      value={cell.points}
                      onChange={(e) =>
                        updateCell(ci, ri, { points: Math.max(1, parseInt(e.target.value, 10) || 1) })
                      }
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-gray-900 tabular-nums"
                    />
                    <textarea
                      value={cell.clue}
                      onChange={(e) => updateCell(ci, ri, { clue: e.target.value })}
                      placeholder="Clue (read aloud)"
                      rows={2}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-gray-900"
                    />
                    <textarea
                      value={cell.answer}
                      onChange={(e) => updateCell(ci, ri, { answer: e.target.value })}
                      placeholder="Answer"
                      rows={2}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => removeCell(ci, ri)}
                      disabled={cat.cells.length <= 1}
                      className="text-xs text-red-600 self-center disabled:opacity-30"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
