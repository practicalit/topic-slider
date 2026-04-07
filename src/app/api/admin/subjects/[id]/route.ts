import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { countTopicsForSubject } from "@/lib/archive";
import { requireAdmin, requireAuth } from "@/lib/scope";

type Params = { params: Promise<{ id: string }> };

/** Soft-delete (archive) a subject. Blocked if any topic uses it. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const tenantId = authz.session.user.tenantId;
  const { id } = await params;

  const row = await prisma.subject.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const topicCount = await countTopicsForSubject(tenantId, id);
  if (topicCount > 0) {
    return NextResponse.json(
      {
        error: "Cannot archive a subject that still has topics. Delete those topics first.",
        code: "HAS_TOPICS",
        topicCount,
      },
      { status: 409 }
    );
  }

  await prisma.subject.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
