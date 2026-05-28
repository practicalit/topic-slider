import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditForSessionFireAndForget } from "@/lib/audit-log";
import {
  requireAdmin,
  requireAuth,
  requireAuthForSchool,
  requireTeachingContext,
  type ScopedSession,
  verifySubjectInTenant,
} from "@/lib/scope";

// GET /api/topics — topics for a subject; subjectId from session context or ?subjectId= query param
export async function GET(req: NextRequest) {
  const authz = await requireAuthForSchool();
  if (!authz.ok) return authz.res;

  const { searchParams } = new URL(req.url);
  const qSubjectId = searchParams.get("subjectId");

  let tenantId: string, subjectId: string;

  if (qSubjectId) {
    // Admin explicitly specifying subject (no session context required)
    const forbidden = requireAdmin(authz.session);
    if (forbidden) return forbidden;
    tenantId = authz.session.user.tenantId;
    subjectId = qSubjectId;
  } else {
    const ctx = requireTeachingContext(authz.session);
    if (!ctx.ok) return ctx.res;
    ({ tenantId, subjectId } = ctx);
  }

  const topics = await prisma.topic.findMany({
    where: {
      tenantId,
      subjectId,
      subject: { deletedAt: null },
    },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { contents: true, quizzes: true } },
      createdBy: { select: { username: true, displayName: true, role: true } },
      updatedBy: { select: { username: true, displayName: true, role: true } },
    },
  });
  return NextResponse.json(topics);
}

// POST /api/topics — admin; subject must belong to your site
export async function POST(req: NextRequest) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const body = await req.json();
  const { title, description, subjectId } = body as {
    title?: string;
    description?: string;
    subjectId?: string;
  };

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!subjectId || typeof subjectId !== "string") {
    return NextResponse.json(
      { error: "subjectId is required" },
      { status: 400 }
    );
  }

  const tenantId = authz.session.user.tenantId;
  const sub = await verifySubjectInTenant(tenantId, subjectId);
  if (!sub) {
    return NextResponse.json({ error: "Invalid subject for this site" }, { status: 400 });
  }

  const maxOrder = await prisma.topic.aggregate({
    where: {
      tenantId,
      subjectId,
      subject: { deletedAt: null },
    },
    _max: { sortOrder: true },
  });

  const uid = authz.session.user.id;
  const topic = await prisma.topic.create({
    data: {
      tenantId,
      subjectId,
      title: title.trim(),
      description: description?.trim() || null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      createdById: uid,
      updatedById: uid,
    },
    include: {
      _count: { select: { contents: true, quizzes: true } },
      createdBy: { select: { username: true, displayName: true, role: true } },
      updatedBy: { select: { username: true, displayName: true, role: true } },
    },
  });

  auditForSessionFireAndForget(authz.session as ScopedSession, {
    action: "TOPIC_CREATE",
    entityType: "Topic",
    entityId: topic.id,
    summary: `Created topic \u201c${topic.title}\u201d`,
    metadata: { title: topic.title, subjectId },
  });

  return NextResponse.json(topic, { status: 201 });
}

