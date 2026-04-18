export type ParsedStudent = { firstName: string; lastName: string };

const HEADER_HINTS = /^(first|given|fname|መጀመሪያ|last|family|surname|lname|የአባት|name|full)/i;

function looksLikeHeaderRow(cells: string[]): boolean {
  const joined = cells.join(" ").toLowerCase();
  return HEADER_HINTS.test(joined);
}

function parseFullNameCell(text: string): ParsedStudent | null {
  const t = text.trim();
  if (t.length < 2) return null;
  if (t.includes(",")) {
    const [a, ...rest] = t.split(",").map((s) => s.trim());
    const b = rest.join(",").trim();
    if (b) return { firstName: b, lastName: a };
    const parts = a.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return {
        firstName: parts.slice(0, -1).join(" "),
        lastName: parts[parts.length - 1],
      };
    }
    return null;
  }
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      firstName: parts.slice(0, -1).join(" "),
      lastName: parts[parts.length - 1],
    };
  }
  return null;
}

function rowToStudent(cells: string[]): ParsedStudent | null {
  const cleaned = cells.map((c) => String(c ?? "").trim()).filter((c) => c.length > 0);
  if (cleaned.length === 0) return null;
  if (cleaned.length >= 2) {
    return { firstName: cleaned[0], lastName: cleaned.slice(1).join(" ") };
  }
  return parseFullNameCell(cleaned[0]);
}

/** Map header names to column indices */
function mapHeaderColumns(headerCells: string[]): { first: number; last: number } | null {
  const lower = headerCells.map((h) => h.toLowerCase().trim());
  let first = -1;
  let last = -1;
  let full = -1;

  lower.forEach((h, i) => {
    if (/^first|^given|^fname|^መጀመሪያ/.test(h)) first = i;
    if (/^last|^family|^surname|^lname|^የአባት/.test(h)) last = i;
    if (/^full|^name$|^student/.test(h)) full = i;
  });

  if (first >= 0 && last >= 0) return { first, last };
  if (full >= 0) return { first: full, last: -2 }; // sentinel: single full-name column
  return null;
}

export function parseStudentRowsFromMatrix(rows: string[][]): ParsedStudent[] {
  const out: ParsedStudent[] = [];
  if (rows.length === 0) return out;

  let start = 0;
  let colMap: { first: number; last: number } | null = null;

  const firstRow = rows[0].map((c) => String(c ?? "").trim());
  if (looksLikeHeaderRow(firstRow)) {
    colMap = mapHeaderColumns(firstRow);
    if (colMap) start = 1;
  }

  for (let r = start; r < rows.length; r++) {
    const cells = rows[r].map((c) => String(c ?? "").trim());
    if (cells.every((c) => !c)) continue;

    let s: ParsedStudent | null = null;
    if (colMap) {
      if (colMap.last === -2) {
        const full = cells[colMap.first] ?? "";
        s = parseFullNameCell(full);
      } else {
        const fn = cells[colMap.first] ?? "";
        const ln = cells[colMap.last] ?? "";
        if (fn && ln) s = { firstName: fn, lastName: ln };
      }
    } else {
      s = rowToStudent(cells);
    }
    if (s && s.firstName && s.lastName) out.push(s);
  }

  return dedupeStudents(out);
}

function dedupeStudents(list: ParsedStudent[]): ParsedStudent[] {
  const seen = new Set<string>();
  const out: ParsedStudent[] = [];
  for (const s of list) {
    const key = `${s.firstName.toLowerCase()}\0${s.lastName.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function parseStudentRowsFromDelimitedText(raw: string): ParsedStudent[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const delim = lines[0].includes("\t") ? "\t" : ",";
  const matrix = lines.map((line) => {
    if (delim === "\t") return line.split("\t");
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if ((ch === "," && !inQuotes) || ch === "\t") {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  });

  return parseStudentRowsFromMatrix(matrix);
}

/** Heuristic lines from OCR: bullets, numbers, extra spaces */
export function parseStudentRowsFromOcrText(text: string): ParsedStudent[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(/^[\s•\-\*\d.)]+/i, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((l) => l.length > 1);

  const matrix = lines.map((l) => [l]);
  return parseStudentRowsFromMatrix(matrix);
}
