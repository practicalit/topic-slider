import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
import { parseContentKind, validateContentPayload } from "@/lib/content-api";
import { parseSlideThemeFromDb, slideThemeToPrismaJson } from "@/lib/slide-theme";

type Params = { params: Promise<{ id: string; contentId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const readOnly = forbidSuperAdminSchoolWrite(authz.session);
  if (readOnly) return readOnly;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const { id, contentId } = await params;
  const topic = await getTopicInTenant(authz.session.user.tenantId, id);
  if (!topic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.content.findFirst({
    where: { id: contentId, topicId: id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { title, body: contentBody, sortOrder } = body;

  const nextKind =
    body.kind !== undefined ? parseContentKind(body.kind) : existing.kind;
  const nextTitle =
    title !== undefined ? String(title).trim() : existing.title;
  const nextBody =
    contentBody !== undefined ? String(contentBody).trim() : existing.body;

  const err = validateContentPayload(nextKind, nextTitle, nextBody);
  if (err) {
    return NextResponse.json({ error: err }, { status: 400 });
  }

  const data: Prisma.ContentUpdateInput = {
    kind: nextKind,
    title: nextTitle,
    body: nextBody,
    ...(sortOrder !== undefined && { sortOrder }),
  };

  if (nextKind !== "SLIDE") {
    data.slideTheme = Prisma.DbNull;
  } else if (body.slideTheme !== undefined) {
    data.slideTheme =
      body.slideTheme === null
        ? Prisma.DbNull
        : slideThemeToPrismaJson(parseSlideThemeFromDb(body.slideTheme)!);
  }

  const content = await prisma.content.update({
    where: { id: contentId },
    data,
  });

  const uid = authz.session.user.id;
  await touchTopicUpdatedBy(id, uid);
  auditForSessionFireAndForget(authz.session as ScopedSession, {
    action: "CONTENT_UPDATE",
    entityType: "Content",
    entityId: contentId,
    summary: `Updated content block “${content.title}”`,
    metadata: { topicId: id, title: content.title },
  });

  return NextResponse.json(content);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const readOnly = forbidSuperAdminSchoolWrite(authz.session);
  if (readOnly) return readOnly;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const { id, contentId } = await params;
  const topic = await getTopicInTenant(authz.session.user.tenantId, id);
  if (!topic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.content.findFirst({
    where: { id: contentId, topicId: id },
    select: { title: true },
  });
  const deleted = await prisma.content.deleteMany({
    where: { id: contentId, topicId: id },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const uid = authz.session.user.id;
  await touchTopicUpdatedBy(id, uid);
  auditForSessionFireAndForget(authz.session as ScopedSession, {
    action: "CONTENT_DELETE",
    entityType: "Content",
    entityId: contentId,
    summary: `Deleted content block “${existing?.title ?? contentId}”`,
    metadata: { topicId: id },
  });

  return NextResponse.json({ success: true });
}
