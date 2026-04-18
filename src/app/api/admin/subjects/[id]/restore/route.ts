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

  const archived = await prisma.subject.findFirst({
    where: { id, tenantId, deletedAt: { not: null } },
  });
  if (!archived) {
    return NextResponse.json({ error: "Not found or not archived" }, { status: 404 });
  }

  const conflict = await prisma.subject.findFirst({
    where: {
      tenantId,
      name: archived.name,
      deletedAt: null,
      NOT: { id },
    },
    select: { id: true },
  });
  if (conflict) {
    return NextResponse.json(
      {
        error:
          "Another active subject already uses this name. Rename or archive that subject first.",
        code: "NAME_CONFLICT",
      },
      { status: 409 }
    );
  }

  await prisma.subject.update({
    where: { id },
    data: { deletedAt: null },
  });
  return NextResponse.json({ success: true });
}
