import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildJeopardyBoardFromTopic,
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
  getTopicInTenant,
  type ScopedSession,
} from "@/lib/scope";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
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

  const body = await req.json().catch(() => ({}));
  const bodyCol =
    typeof body?.columns === "number" && Number.isFinite(body.columns)
      ? clampJeopardyColumns(body.columns)
      : undefined;
  const bodyRow =
    typeof body?.rows === "number" && Number.isFinite(body.rows)
      ? clampJeopardyRows(body.rows)
      : undefined;

  const full = await prisma.topic.findFirst({
    where: { id: topicId },
    include: {
      contents: { orderBy: { sortOrder: "asc" } },
      quizzes: true,
    },
  });
  if (!full) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const columns = bodyCol ?? clampJeopardyColumns(full.jeopardyColumns);
  const rows = bodyRow ?? clampJeopardyRows(full.jeopardyRows);

  const uid = authz.session.user.id;

  await prisma.topic.update({
    where: { id: topicId },
    data: {
      ...(bodyCol !== undefined && { jeopardyColumns: bodyCol }),
      ...(bodyRow !== undefined && { jeopardyRows: bodyRow }),
      updatedById: uid,
    },
  });

  const generated = buildJeopardyBoardFromTopic(full, { columns, rows });

  await prisma.$transaction(async (tx) => {
    await tx.jeopardyCategory.deleteMany({ where: { topicId } });
    for (let i = 0; i < generated.length; i++) {
      const cat = generated[i];
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

  const categories = await prisma.jeopardyCategory.findMany({
    where: { topicId },
    orderBy: { sortOrder: "asc" },
    include: { cells: { orderBy: { sortOrder: "asc" } } },
  });

  const updated = await prisma.topic.findFirst({
    where: { id: topicId },
    select: {
      jeopardyColumns: true,
      jeopardyRows: true,
      jeopardyTeamCount: true,
    },
  });

  const settings = {
    columns: clampJeopardyColumns(updated?.jeopardyColumns ?? columns),
    rows: clampJeopardyRows(updated?.jeopardyRows ?? rows),
    teamCount: clampJeopardyTeamCount(updated?.jeopardyTeamCount ?? 2),
  };

  await touchTopicUpdatedBy(topicId, uid);
  auditForSessionFireAndForget(authz.session as ScopedSession, {
    action: "JEOPARDY_GENERATE",
    entityType: "Topic",
    entityId: topicId,
    summary: "Auto-generated Jeopardy board from slides and quizzes",
    metadata: { categories: categories.length },
  });

  return NextResponse.json({ categories, settings, generated: true });
}
