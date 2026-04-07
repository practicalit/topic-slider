import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

export async function GET(_req: NextRequest, { params }: Params) {
  const authz = await requireAuthForSchool();
  if (!authz.ok) return authz.res;

  const { id } = await params;
  const topic = await getTopicForSchoolRead(authz.session, id);
  if (!topic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const quizzes = await prisma.quiz.findMany({
    where: { topicId: id },
  });
  return NextResponse.json(quizzes);
}

export async function POST(req: NextRequest, { params }: Params) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const readOnly = forbidSuperAdminSchoolWrite(authz.session);
  if (readOnly) return readOnly;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const { id } = await params;
  const topic = await getTopicInTenant(authz.session.user.tenantId, id);
  if (!topic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { question, options, answer } = body;

  if (!question || !Array.isArray(options) || options.length < 2 || answer === undefined) {
    return NextResponse.json(
      { error: "Question, options (min 2), and answer index are required" },
      { status: 400 }
    );
  }

  if (typeof answer !== "number" || answer < 0 || answer >= options.length) {
    return NextResponse.json(
      { error: "Answer must be a valid option index" },
      { status: 400 }
    );
  }

  const quiz = await prisma.quiz.create({
    data: {
      topicId: id,
      question: question.trim(),
      options: options.map((o: string) => o.trim()),
      answer,
    },
  });

  const uid = authz.session.user.id;
  await touchTopicUpdatedBy(id, uid);
  auditForSessionFireAndForget(authz.session as ScopedSession, {
    action: "QUIZ_CREATE",
    entityType: "Quiz",
    entityId: quiz.id,
    summary: `Added quiz question to topic`,
    metadata: { topicId: id, question: quiz.question.slice(0, 120) },
  });

  return NextResponse.json(quiz, { status: 201 });
}
