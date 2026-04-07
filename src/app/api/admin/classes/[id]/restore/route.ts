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

  const archived = await prisma.schoolClass.findFirst({
    where: { id, tenantId, deletedAt: { not: null } },
  });
  if (!archived) {
    return NextResponse.json({ error: "Not found or not archived" }, { status: 404 });
  }

  const conflict = await prisma.schoolClass.findFirst({
    where: {
      tenantId,
      code: archived.code,
      deletedAt: null,
      NOT: { id },
    },
    select: { id: true },
  });
  if (conflict) {
    return NextResponse.json(
      {
        error:
          "Another active class already uses this code. Rename or archive that class first.",
        code: "CODE_CONFLICT",
      },
      { status: 409 }
    );
  }

  await prisma.schoolClass.update({
    where: { id },
    data: { deletedAt: null },
  });
  return NextResponse.json({ success: true });
}
