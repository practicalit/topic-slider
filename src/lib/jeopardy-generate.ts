import type { Content, ContentKind, Quiz } from "@prisma/client";
import { stripMarkdownForSnippet } from "@/lib/slide-outline";

/** Hard caps (UI + API). Per-topic values are stored on Topic and clamped here. */
export const JEOPARDY_LIMITS = {
  minColumns: 2,
  maxColumns: 10,
  minRows: 2,
  maxRows: 10,
  minTeams: 2,
  maxTeams: 8,
} as const;

export type JeopardyDimensions = { columns: number; rows: number };

export function clampJeopardyColumns(n: number): number {
  return Math.min(
    JEOPARDY_LIMITS.maxColumns,
    Math.max(JEOPARDY_LIMITS.minColumns, Math.round(Number(n)) || JEOPARDY_LIMITS.minColumns)
  );
}

export function clampJeopardyRows(n: number): number {
  return Math.min(
    JEOPARDY_LIMITS.maxRows,
    Math.max(JEOPARDY_LIMITS.minRows, Math.round(Number(n)) || JEOPARDY_LIMITS.minRows)
  );
}

export function clampJeopardyTeamCount(n: number): number {
  return Math.min(
    JEOPARDY_LIMITS.maxTeams,
    Math.max(JEOPARDY_LIMITS.minTeams, Math.round(Number(n)) || JEOPARDY_LIMITS.minTeams)
  );
}

/** Point values for row 0..rows-1 (100, 200, …). */
export function pointTiersForRows(rows: number): number[] {
  const r = clampJeopardyRows(rows);
  return Array.from({ length: r }, (_, i) => 100 * (i + 1));
}

export type GeneratedCategory = {
  title: string;
  contentId: string | null;
  cells: { points: number; clue: string; answer: string }[];
};

function extractBulletsAndLines(md: string): string[] {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  const bulletRe = /^\s*[-*•]\s+(.+)$/;
  const numRe = /^\s*\d+[.)]\s+(.+)$/;
  for (const line of lines) {
    const m = line.match(bulletRe) || line.match(numRe);
    if (m) out.push(m[1].trim());
  }
  if (out.length > 0) return out;

  const plain = stripMarkdownForSnippet(md);
  if (plain.length > 12) {
    const chunks = plain
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);
    if (chunks.length > 0) return chunks;
    return [plain.slice(0, 280)];
  }
  return [];
}

function padClues(lines: string[], need: number, title: string): string[] {
  const result = [...lines];
  let i = 0;
  while (result.length < need) {
    result.push(`Review point ${result.length + 1} from “${title.slice(0, 40)}”.`);
    i++;
    if (i > need + 5) break;
  }
  return result.slice(0, need);
}

function cellsFromTextSlide(
  content: Content,
  tiers: readonly number[]
): GeneratedCategory["cells"] {
  const lines = padClues(extractBulletsAndLines(content.body), tiers.length, content.title);
  return tiers.map((points, i) => {
    const clue = lines[i] ?? `Think about this section: ${content.title}`;
    const trimmed = clue.length > 500 ? `${clue.slice(0, 497)}…` : clue;
    return {
      points,
      clue: trimmed,
      answer: content.title,
    };
  });
}

function cellsFromQuizzes(
  quizzes: Quiz[],
  tiers: readonly number[],
  offset: number
): GeneratedCategory["cells"] {
  if (quizzes.length === 0) {
    return tiers.map((points) => ({
      points,
      clue: "Add quiz questions in admin to auto-fill this cell.",
      answer: "—",
    }));
  }
  return tiers.map((points, i) => {
    const q = quizzes[(offset + i) % quizzes.length];
    const ans = q.options[q.answer] ?? q.options[0] ?? "—";
    return {
      points,
      clue: q.question.length > 600 ? `${q.question.slice(0, 597)}…` : q.question,
      answer: ans,
    };
  });
}

export function buildJeopardyBoardFromTopic(
  topic: {
    title: string;
    contents: Content[];
    quizzes: Quiz[];
  },
  dims: JeopardyDimensions
): GeneratedCategory[] {
  const columns = clampJeopardyColumns(dims.columns);
  const rows = clampJeopardyRows(dims.rows);
  const tiers = pointTiersForRows(rows);

  const textKinds: ContentKind[] = ["TEXT", "SLIDE"];
  const textSlides = topic.contents
    .filter((c) => textKinds.includes(c.kind))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, columns);

  const categories: GeneratedCategory[] = [];

  for (const c of textSlides) {
    categories.push({
      title: c.title.slice(0, 120),
      contentId: c.id,
      cells: cellsFromTextSlide(c, tiers),
    });
  }

  let quizOffset = 0;
  while (categories.length < columns && topic.quizzes.length > 0) {
    categories.push({
      title: `Quiz round ${categories.length - textSlides.length + 1}`,
      contentId: null,
      cells: cellsFromQuizzes(topic.quizzes, tiers, quizOffset),
    });
    quizOffset += tiers.length;
  }

  if (categories.length === 0) {
    if (topic.quizzes.length > 0) {
      categories.push({
        title: "Review questions",
        contentId: null,
        cells: cellsFromQuizzes(topic.quizzes, tiers, 0),
      });
    } else {
      categories.push({
        title: topic.title.slice(0, 80) || "General",
        contentId: null,
        cells: tiers.map((points) => ({
          points,
          clue: `Edit this clue in Admin → Topic → Jeopardy board (${points} pts).`,
          answer: "Edit the answer in Admin after generating.",
        })),
      });
    }
  }

  return categories.slice(0, columns);
}
