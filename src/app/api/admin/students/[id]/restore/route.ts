import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/scope";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const tenantId = authz.session.user.tenantId;
  const { id } = await params;

  const archived = await prisma.student.findFirst({
    where: { id, tenantId, deletedAt: { not: null } },
    include: { schoolClass: { select: { deletedAt: true, code: true } } },
  });
  if (!archived) {
    return NextResponse.json({ error: "Not found or not archived" }, { status: 404 });
  }
  if (archived.schoolClass.deletedAt) {
    return NextResponse.json(
      {
        error: "This student’s class is still archived. Restore the class first.",
        code: "CLASS_ARCHIVED",
      },
      { status: 409 }
    );
  }

  await prisma.student.update({
    where: { id },
    data: { deletedAt: null },
  });
  return NextResponse.json({ success: true });
}
