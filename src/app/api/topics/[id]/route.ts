import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditForSessionFireAndForget } from "@/lib/audit-log";
import {
  requireAdmin,
  requireAuth,
  requireAuthForSchool,
  getTopicInTenant,
  type ScopedSession,
} from "@/lib/scope";

type Params = { params: Promise<{ id: string }> };

// GET /api/topics/:id — site-scoped; SUPER_ADMIN may read any non-platform school topic
export async function GET(_req: NextRequest, { params }: Params) {
  const authz = await requireAuthForSchool();
  if (!authz.ok) return authz.res;

  const { id } = await params;
  const whereBase =
    authz.session.user.role === "SUPER_ADMIN"
      ? {
          id,
          tenant: { isPlatform: false, deletedAt: null },
          schoolClass: { deletedAt: null },
          subject: { deletedAt: null },
        }
      : {
          id,
          tenantId: authz.session.user.tenantId,
          schoolClass: { deletedAt: null },
          subject: { deletedAt: null },
        };

  const topic = await prisma.topic.findFirst({
    where: whereBase,
    include: {
      contents: { orderBy: { sortOrder: "asc" } },
      quizzes: true,
    },
  });
  if (!topic) {
    return NextResponse.json(
      {
        error:
          "That topic was not found. It may belong to another class or site, or it may have been removed.",
        code: "TOPIC_NOT_FOUND",
      },
      { status: 404 }
    );
  }
  return NextResponse.json(topic);
}

// PUT /api/topics/:id — admin, same site
export async function PUT(req: NextRequest, { params }: Params) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const { id } = await params;
  const existing = await getTopicInTenant(authz.session.user.tenantId, id);
  if (!existing) {
    return NextResponse.json(
      {
        error:
          "That topic was not found for your school, or you don’t have permission to change it.",
        code: "TOPIC_NOT_FOUND",
      },
      { status: 404 }
    );
  }

  const body = await req.json();
  const { title, description, taught } = body;

  const uid = authz.session.user.id;
  const topic = await prisma.topic.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(taught !== undefined && {
        taught,
        taughtAt: taught ? new Date() : null,
      }),
      updatedById: uid,
    },
  });

  auditForSessionFireAndForget(authz.session as ScopedSession, {
    action: "TOPIC_UPDATE",
    entityType: "Topic",
    entityId: id,
    summary: `Updated topic “${topic.title}”`,
    metadata: {
      title: topic.title,
      taught: topic.taught,
    },
  });

  return NextResponse.json(topic);
}

// DELETE /api/topics/:id — admin, same site
export async function DELETE(_req: NextRequest, { params }: Params) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const { id } = await params;
  const existing = await getTopicInTenant(authz.session.user.tenantId, id);
  if (!existing) {
    return NextResponse.json(
      {
        error:
          "That topic was not found for your school, or you don’t have permission to delete it.",
        code: "TOPIC_NOT_FOUND",
      },
      { status: 404 }
    );
  }

  auditForSessionFireAndForget(authz.session as ScopedSession, {
    action: "TOPIC_DELETE",
    entityType: "Topic",
    entityId: id,
    summary: `Deleted topic “${existing.title}”`,
    metadata: { title: existing.title },
  });

  await prisma.topic.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
