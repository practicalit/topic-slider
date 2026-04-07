"use client";

import { useCallback, useRef, useState } from "react";
import { errorMessageFromJson } from "@/lib/api-client";
import {
  parseStudentRowsFromDelimitedText,
  parseStudentRowsFromOcrText,
  type ParsedStudent,
} from "@/lib/student-import-parse";

type Props = {
  onImported: () => void;
};

export function StudentBulkImport({ onImported }: Props) {
  const sheetInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedStudent[]>([]);
  const [tab, setTab] = useState<"sheet" | "photo">("sheet");
  const [busy, setBusy] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrPct, setOcrPct] = useState(0);
  const [parseError, setParseError] = useState("");
  const [importMsg, setImportMsg] = useState("");

  const clearInputs = () => {
    if (sheetInputRef.current) sheetInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const parseSpreadsheetFile = useCallback(async (file: File) => {
    setParseError("");
    setImportMsg("");
    const lower = file.name.toLowerCase();
    try {
      let rows: ParsedStudent[];
      if (lower.endsWith(".csv") || file.type === "text/csv") {
        const text = await file.text();
        rows = parseStudentRowsFromDelimitedText(text);
      } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        const { parseStudentRowsFromXlsxBuffer } = await import("@/lib/student-import-xlsx");
        const buf = await file.arrayBuffer();
        rows = parseStudentRowsFromXlsxBuffer(buf);
      } else {
        setParseError("Use a .csv, .xlsx, or .xls file.");
        return;
      }
      if (rows.length === 0) {
        setParseError("No names found. Try two columns (First name, Last name) or one column (First Last).");
        setPreview([]);
        return;
      }
      setPreview(rows);
    } catch {
      setParseError("Could not read that file. Check the format and try again.");
      setPreview([]);
    }
  }, []);

  const runOcr = useCallback(async (file: File) => {
    setParseError("");
    setImportMsg("");
    setBusy(true);
    setOcrStatus("Loading OCR…");
    setOcrPct(0);
    try {
      const { recognize } = await import("tesseract.js");
      const result = await recognize(file, "eng", {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") {
            setOcrPct(Math.round(100 * (m.progress ?? 0)));
            setOcrStatus(`Reading image… ${Math.round(100 * (m.progress ?? 0))}%`);
          }
        },
      });
      const text = result.data.text ?? "";
      const rows = parseStudentRowsFromOcrText(text);
      if (rows.length === 0) {
        setParseError(
          "No names detected. Use a clear screenshot (one name per line). You can paste or fix rows below after a partial read."
        );
        setPreview(fallbackRowsFromRawLines(text));
      } else {
        setPreview(rows);
        setOcrStatus(`Found ${rows.length} name(s). Review and edit below.`);
      }
    } catch {
      setParseError("OCR failed. Try a sharper image or use a spreadsheet instead.");
      setOcrStatus("");
    } finally {
      setBusy(false);
    }
  }, []);

  function fallbackRowsFromRawLines(text: string): ParsedStudent[] {
    return text
      .split(/\r?\n/)
      .map((l) => l.replace(/^[\s•\-\*\d.)]+/i, "").trim())
      .filter((l) => l.length > 2)
      .map((l) => {
        const parts = l.split(/\s+/);
        if (parts.length >= 2) {
          return {
            firstName: parts.slice(0, -1).join(" "),
            lastName: parts[parts.length - 1],
          };
        }
        return { firstName: l, lastName: "" };
      });
  }

  async function submitBulk() {
    setImportMsg("");
    const cleaned = preview
      .map((r) => ({
        firstName: r.firstName.trim(),
        lastName: r.lastName.trim(),
      }))
      .filter((r) => r.firstName && r.lastName);
    if (cleaned.length === 0) {
      setImportMsg("Add at least one row with first and last name.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/students/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: cleaned }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportMsg(errorMessageFromJson(data, "Import failed."));
        return;
      }
      setImportMsg(`Added ${data.created} student(s).`);
      setPreview([]);
      clearInputs();
      onImported();
    } finally {
      setBusy(false);
    }
  }

  function updateRow(i: number, field: "firstName" | "lastName", value: string) {
    setPreview((prev) => {
      const next = [...prev];
      const row = { ...next[i], [field]: value };
      next[i] = row;
      return next;
    });
  }

  function removeRow(i: number) {
    setPreview((prev) => prev.filter((_, j) => j !== i));
  }

  function addEmptyRow() {
    setPreview((prev) => [...prev, { firstName: "", lastName: "" }]);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Bulk add students</h2>
      <p className="text-sm text-gray-600 mb-4">
        Upload a class list spreadsheet, or a screenshot where each line is one student (OCR works best
        with clear Latin text; you can edit results before saving).
      </p>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab("sheet")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "sheet"
              ? "bg-indigo-600 text-white border border-indigo-200"
              : "bg-gray-100 text-gray-900 hover:bg-indigo-50 border border-gray-200"
          }`}
        >
          Spreadsheet
        </button>
        <button
          type="button"
          onClick={() => setTab("photo")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "photo"
              ? "bg-indigo-600 text-white border border-indigo-200"
              : "bg-gray-100 text-gray-900 hover:bg-indigo-50 border border-gray-200"
          }`}
        >
          Screenshot (OCR)
        </button>
      </div>

      {tab === "sheet" && (
        <div className="space-y-3">
          <input
            ref={sheetInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="block w-full text-sm text-gray-900 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:font-medium"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void parseSpreadsheetFile(f);
            }}
          />
          <p className="text-xs text-gray-600">
            CSV or Excel: use a header row like <strong>First name</strong> / <strong>Last name</strong>, or
            two columns without headers, or one column with <strong>First Last</strong> per row.
          </p>
        </div>
      )}

      {tab === "photo" && (
        <div className="space-y-3">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="block w-full text-sm text-gray-900 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:font-medium"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void runOcr(f);
            }}
          />
          {busy && ocrStatus && (
            <p className="text-sm text-gray-600">
              {ocrStatus}
              {ocrPct > 0 && ocrPct < 100 ? ` (${ocrPct}%)` : ""}
            </p>
          )}
          <p className="text-xs text-gray-600">
            First run downloads the OCR engine in your browser (can take a moment). For handwritten or
            Amharic lists, results may need manual cleanup in the table below.
          </p>
        </div>
      )}

      {parseError && (
        <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {parseError}
        </div>
      )}

      {preview.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-gray-900">
              Preview ({preview.length}) — edit if needed
            </h3>
            <button
              type="button"
              onClick={addEmptyRow}
              className="text-xs text-indigo-600 font-semibold hover:underline"
            >
              + Add row
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">First</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Last</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {preview.map((row, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-2 py-1">
                      <input
                        value={row.firstName}
                        onChange={(e) => updateRow(i, "firstName", e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-gray-900"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        value={row.lastName}
                        onChange={(e) => updateRow(i, "lastName", e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-gray-900"
                      />
                    </td>
                    <td className="px-1">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="text-red-600 text-xs px-1"
                        aria-label="Remove row"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 items-center">
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitBulk()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg border border-indigo-200"
            >
              Import {preview.filter((r) => r.firstName.trim() && r.lastName.trim()).length} students
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPreview([]);
                setParseError("");
                setOcrStatus("");
                clearInputs();
              }}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Clear preview
            </button>
          </div>
        </div>
      )}

      {importMsg && (
        <p className={`mt-3 text-sm ${importMsg.startsWith("Added") ? "text-green-700" : "text-red-600"}`}>
          {importMsg}
        </p>
      )}
    </div>
  );
}
