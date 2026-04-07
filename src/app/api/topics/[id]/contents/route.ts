import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
import { parseContentKind, validateContentPayload } from "@/lib/content-api";
import { parseSlideThemeFromDb, slideThemeToPrismaJson } from "@/lib/slide-theme";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const authz = await requireAuthForSchool();
  if (!authz.ok) return authz.res;

  const { id } = await params;
  const topic = await getTopicForSchoolRead(authz.session, id);
  if (!topic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contents = await prisma.content.findMany({
    where: { topicId: id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(contents);
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
  const { title, body: contentBody } = body;
  const kind = parseContentKind(body.kind);

  const titleTrim = typeof title === "string" ? title.trim() : "";
  const bodyTrim = typeof contentBody === "string" ? contentBody.trim() : "";
  const err = validateContentPayload(kind, titleTrim, bodyTrim);
  if (err) {
    return NextResponse.json({ error: err }, { status: 400 });
  }

  const maxOrder = await prisma.content.aggregate({
    where: { topicId: id },
    _max: { sortOrder: true },
  });

  const slideThemeDb: Prisma.InputJsonValue | typeof Prisma.DbNull =
    kind === "SLIDE" && body.slideTheme != null
      ? slideThemeToPrismaJson(parseSlideThemeFromDb(body.slideTheme)!)
      : Prisma.DbNull;

  const content = await prisma.content.create({
    data: {
      topicId: id,
      kind,
      title: titleTrim,
      body: bodyTrim,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      slideTheme: slideThemeDb,
    },
  });

  const uid = authz.session.user.id;
  await touchTopicUpdatedBy(id, uid);
  auditForSessionFireAndForget(authz.session as ScopedSession, {
    action: "CONTENT_CREATE",
    entityType: "Content",
    entityId: content.id,
    summary: `Added content block “${titleTrim}” to topic`,
    metadata: { topicId: id, kind, title: titleTrim },
  });

  return NextResponse.json(content, { status: 201 });
}
