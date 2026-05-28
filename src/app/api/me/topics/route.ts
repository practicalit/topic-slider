import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthForSchool, schoolCatalogTenantId } from "@/lib/scope";

// GET /api/me/topics?classId=xxx
// Returns all topics for the tenant (any subject), with per-class taught status from ClassTopicProgress.
export async function GET(req: NextRequest) {
  const authz = await requireAuthForSchool();
  if (!authz.ok) return authz.res;

  const tenantId = schoolCatalogTenantId(authz.session);
  if (!tenantId) {
    return NextResponse.json(
      { error: "Pick a school site first.", code: "TENANT_SCOPE_REQUIRED" },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  if (!classId) {
    return NextResponse.json({ error: "classId is required" }, { status: 400 });
  }

  const topics = await prisma.topic.findMany({
    where: {
      tenantId,
      subject: { deletedAt: null },
    },
    orderBy: [{ subject: { name: "asc" } }, { sortOrder: "asc" }],
    select: {
      id: true,
      title: true,
      subjectId: true,
      _count: { select: { contents: true } },
      subject: { select: { name: true } },
      progress: {
        where: { classId },
        select: { taught: true },
      },
    },
  });

  // Flatten: expose taught as a top-level boolean (false if no progress row yet)
  const result = topics.map((t) => ({
    id: t.id,
    title: t.title,
    subjectId: t.subjectId,
    taught: t.progress[0]?.taught ?? false,
    _count: t._count,
    subject: t.subject,
  }));

  return NextResponse.json(result);
}

