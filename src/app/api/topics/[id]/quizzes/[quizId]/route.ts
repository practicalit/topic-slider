import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditForSessionFireAndForget } from "@/lib/audit-log";
import { touchTopicUpdatedBy } from "@/lib/topic-touch";
import {
  forbidSuperAdminSchoolWrite,
  requireAdmin,
  requireAuth,
  getTopicInTenant,
  type ScopedSession,
} from "@/lib/scope";

type Params = { params: Promise<{ id: string; quizId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const readOnly = forbidSuperAdminSchoolWrite(authz.session);
  if (readOnly) return readOnly;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const { id, quizId } = await params;
  const topic = await getTopicInTenant(authz.session.user.tenantId, id);
  if (!topic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const q = await prisma.quiz.findFirst({
    where: { id: quizId, topicId: id },
    select: { question: true },
  });
  const deleted = await prisma.quiz.deleteMany({
    where: { id: quizId, topicId: id },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const uid = authz.session.user.id;
  await touchTopicUpdatedBy(id, uid);
  auditForSessionFireAndForget(authz.session as ScopedSession, {
    action: "QUIZ_DELETE",
    entityType: "Quiz",
    entityId: quizId,
    summary: `Deleted quiz question`,
    metadata: { topicId: id, question: q?.question?.slice(0, 120) },
  });

  return NextResponse.json({ success: true });
}
