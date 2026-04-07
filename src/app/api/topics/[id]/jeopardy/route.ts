import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  clampJeopardyColumns,
  clampJeopardyRows,
  clampJeopardyTeamCount,
} from "@/lib/jeopardy-generate";
import { auditForSessionFireAndForget } from "@/lib/audit-log";
import { touchTopicUpdatedBy } from "@/lib/topic-touch";
import {
  forbidSuperAdminSchoolWrite,
  requireAdmin,
  requireAuth,
  requireAuthForSchool,
  getTopicForSchoolRead,
  getTopicInTenant,
  type ScopedSession,
} from "@/lib/scope";

type Params = { params: Promise<{ id: string }> };

async function jeopardyResponse(topicId: string) {
  const topic = await prisma.topic.findFirst({
    where: { id: topicId },
    select: {
      jeopardyColumns: true,
      jeopardyRows: true,
      jeopardyTeamCount: true,
    },
  });
  const settings = {
    columns: clampJeopardyColumns(topic?.jeopardyColumns ?? 5),
    rows: clampJeopardyRows(topic?.jeopardyRows ?? 5),
    teamCount: clampJeopardyTeamCount(topic?.jeopardyTeamCount ?? 2),
  };
  const categories = await prisma.jeopardyCategory.findMany({
    where: { topicId },
    orderBy: { sortOrder: "asc" },
    include: { cells: { orderBy: { sortOrder: "asc" } } },
  });
  return { categories, settings };
}

function parseSettings(raw: unknown): {
  columns?: number;
  rows?: number;
  teamCount?: number;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: { columns?: number; rows?: number; teamCount?: number } = {};
  if (o.columns !== undefined) {
    if (typeof o.columns !== "number" || !Number.isFinite(o.columns)) return null;
    out.columns = clampJeopardyColumns(o.columns);
  }
  if (o.rows !== undefined) {
    if (typeof o.rows !== "number" || !Number.isFinite(o.rows)) return null;
    out.rows = clampJeopardyRows(o.rows);
  }
  if (o.teamCount !== undefined) {
    if (typeof o.teamCount !== "number" || !Number.isFinite(o.teamCount)) return null;
    out.teamCount = clampJeopardyTeamCount(o.teamCount);
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const authz = await requireAuthForSchool();
  if (!authz.ok) return authz.res;

  const { id } = await params;
  const topic = await getTopicForSchoolRead(authz.session, id);
  if (!topic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(await jeopardyResponse(id));
}

export async function PUT(req: NextRequest, { params }: Params) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const readOnly = forbidSuperAdminSchoolWrite(authz.session);
  if (readOnly) return readOnly;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const { id: topicId } = await params;
  const topic = await getTopicInTenant(authz.session.user.tenantId, topicId);
  if (!topic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const hasCategoriesKey = Object.prototype.hasOwnProperty.call(body, "categories");
  const rawSettings = parseSettings((body as Record<string, unknown>).settings);

  const uid = authz.session.user.id;

  if (rawSettings) {
    await prisma.topic.update({
      where: { id: topicId },
      data: {
        ...(rawSettings.columns !== undefined && { jeopardyColumns: rawSettings.columns }),
        ...(rawSettings.rows !== undefined && { jeopardyRows: rawSettings.rows }),
        ...(rawSettings.teamCount !== undefined && {
          jeopardyTeamCount: rawSettings.teamCount,
        }),
        updatedById: uid,
      },
    });
  }

  if (!hasCategoriesKey) {
    if (!rawSettings) {
      return NextResponse.json(
        { error: "Provide settings and/or categories" },
        { status: 400 }
      );
    }
    auditForSessionFireAndForget(authz.session as ScopedSession, {
      action: "JEOPARDY_SETTINGS_UPDATE",
      entityType: "Topic",
      entityId: topicId,
      summary: "Updated Jeopardy board settings",
      metadata: rawSettings,
    });
    return NextResponse.json(await jeopardyResponse(topicId));
  }

  const rawCats = (body as Record<string, unknown>).categories;
  if (!Array.isArray(rawCats)) {
    return NextResponse.json({ error: "categories must be an array" }, { status: 400 });
  }

  const { columns: maxCol, rows: maxRow } = (await jeopardyResponse(topicId)).settings;

  if (rawCats.length > maxCol) {
    return NextResponse.json(
      { error: `At most ${maxCol} categories (board columns). Increase columns in settings or remove categories.` },
      { status: 400 }
    );
  }

  if (rawCats.length === 0) {
    await prisma.jeopardyCategory.deleteMany({ where: { topicId } });
    await touchTopicUpdatedBy(topicId, uid);
    auditForSessionFireAndForget(authz.session as ScopedSession, {
      action: "JEOPARDY_CLEAR",
      entityType: "Topic",
      entityId: topicId,
      summary: "Cleared Jeopardy board",
    });
    return NextResponse.json(await jeopardyResponse(topicId));
  }

  const normalized: {
    title: string;
    contentId: string | null;
    cells: { points: number; clue: string; answer: string }[];
  }[] = [];

  for (let ci = 0; ci < rawCats.length; ci++) {
    const c = rawCats[ci];
    if (!c || typeof c !== "object") {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    const title = typeof c.title === "string" ? c.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "Each category needs a title" }, { status: 400 });
    }
    const cellsIn = Array.isArray(c.cells) ? c.cells : [];
    if (cellsIn.length === 0 || cellsIn.length > maxRow) {
      return NextResponse.json(
        { error: `Each category needs 1–${maxRow} cells (board rows). Increase rows in settings or trim cells.` },
        { status: 400 }
      );
    }

    let contentId: string | null =
      typeof c.contentId === "string" && c.contentId.trim() ? c.contentId.trim() : null;
    if (contentId) {
      const content = await prisma.content.findFirst({
        where: { id: contentId, topicId },
      });
      if (!content) contentId = null;
    }

    const cells: { points: number; clue: string; answer: string }[] = [];
    for (let ri = 0; ri < cellsIn.length; ri++) {
      const cell = cellsIn[ri];
      if (!cell || typeof cell !== "object") {
        return NextResponse.json({ error: "Invalid cell" }, { status: 400 });
      }
      const points = typeof cell.points === "number" ? Math.round(cell.points) : NaN;
      if (!Number.isFinite(points) || points < 1 || points > 1_000_000) {
        return NextResponse.json({ error: "Invalid cell points" }, { status: 400 });
      }
      const clue = typeof cell.clue === "string" ? cell.clue.trim() : "";
      const answer = typeof cell.answer === "string" ? cell.answer.trim() : "";
      if (!clue || !answer) {
        return NextResponse.json({ error: "Each cell needs clue and answer" }, { status: 400 });
      }
      cells.push({ points, clue, answer });
    }

    normalized.push({ title: title.slice(0, 200), contentId, cells });
  }

  await prisma.$transaction(async (tx) => {
    await tx.jeopardyCategory.deleteMany({ where: { topicId } });
    for (let i = 0; i < normalized.length; i++) {
      const cat = normalized[i];
      const created = await tx.jeopardyCategory.create({
        data: {
          topicId,
          title: cat.title,
          sortOrder: i,
        },
      });
      await tx.jeopardyCell.createMany({
        data: cat.cells.map((cell, j) => ({
          categoryId: created.id,
          points: cell.points,
          clue: cell.clue,
          answer: cell.answer,
          sortOrder: j,
          contentId: cat.contentId,
        })),
      });
    }
  });

  await touchTopicUpdatedBy(topicId, uid);
  auditForSessionFireAndForget(authz.session as ScopedSession, {
    action: "JEOPARDY_SAVE",
    entityType: "Topic",
    entityId: topicId,
    summary: `Saved Jeopardy board (${normalized.length} categories)`,
    metadata: { categories: normalized.length },
  });

  return NextResponse.json(await jeopardyResponse(topicId));
}
