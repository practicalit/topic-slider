import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbidSuperAdminSchoolWrite,
  requireAuthForSchool,
  getTopicForSchoolRead,
  schoolCatalogTenantId,
} from "@/lib/scope";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authz = await requireAuthForSchool();
  if (!authz.ok) return authz.res;
  const readOnly = forbidSuperAdminSchoolWrite(authz.session);
  if (readOnly) return readOnly;

  const classId = authz.session.user.classId;
  if (!classId) {
    return NextResponse.json(
      { error: "No class selected. Open Class & topic to pick a class first.", code: "CONTEXT_REQUIRED" },
      { status: 400 }
    );
  }

  const { id } = await params;
  const existing = await getTopicForSchoolRead(authz.session, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tenantId = schoolCatalogTenantId(authz.session) ?? authz.session.user.tenantId;

  const progress = await prisma.classTopicProgress.upsert({
    where: { classId_topicId: { classId, topicId: id } },
    create: {
      tenantId,
      classId,
      topicId: id,
      taught: true,
      taughtAt: new Date(),
    },
    update: {
      taught: true,
      taughtAt: new Date(),
    },
  });

  return NextResponse.json(progress);
}

