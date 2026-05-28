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
  });
  if (!archived) {
    return NextResponse.json({ error: "Not found or not archived" }, { status: 404 });
  }

  await prisma.student.update({
    where: { id },
    data: { deletedAt: null },
  });
  return NextResponse.json({ success: true });
}
