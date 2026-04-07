import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditForSessionFireAndForget } from "@/lib/audit-log";
import {
  requireAdmin,
  requireAuth,
  requireAuthForSchool,
  requireTeachingContext,
  type ScopedSession,
  verifyClassInTenant,
  verifySubjectInTenant,
} from "@/lib/scope";

// GET /api/topics — current site + class + subject from session
export async function GET() {
  const authz = await requireAuthForSchool();
  if (!authz.ok) return authz.res;
  const ctx = requireTeachingContext(authz.session);
  if (!ctx.ok) return ctx.res;

  const topics = await prisma.topic.findMany({
    where: {
      tenantId: ctx.tenantId,
      classId: ctx.classId,
      subjectId: ctx.subjectId,
      schoolClass: { deletedAt: null },
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

// POST /api/topics — admin; class + subject must belong to your site
export async function POST(req: NextRequest) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const body = await req.json();
  const { title, description, classId, subjectId } = body as {
    title?: string;
    description?: string;
    classId?: string;
    subjectId?: string;
  };

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!classId || typeof classId !== "string" || !subjectId || typeof subjectId !== "string") {
    return NextResponse.json(
      { error: "classId and subjectId are required" },
      { status: 400 }
    );
  }

  const tenantId = authz.session.user.tenantId;
  const [cls, sub] = await Promise.all([
    verifyClassInTenant(tenantId, classId),
    verifySubjectInTenant(tenantId, subjectId),
  ]);
  if (!cls || !sub) {
    return NextResponse.json({ error: "Invalid class or subject for this site" }, { status: 400 });
  }

  const maxOrder = await prisma.topic.aggregate({
    where: {
      tenantId,
      classId,
      subjectId,
      schoolClass: { deletedAt: null },
      subject: { deletedAt: null },
    },
    _max: { sortOrder: true },
  });

  const uid = authz.session.user.id;
  const topic = await prisma.topic.create({
    data: {
      tenantId,
      classId,
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
    summary: `Created topic “${topic.title}”`,
    metadata: { title: topic.title, classId, subjectId },
  });

  return NextResponse.json(topic, { status: 201 });
}
