import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/scope";

const MAX = 200;

export async function GET(req: NextRequest) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const tenantId = authz.session.user.tenantId;
  const { searchParams } = req.nextUrl;
  const limitRaw = parseInt(searchParams.get("limit") ?? "80", 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 80, 1), MAX);

  const rows = await prisma.auditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      actorLabel: true,
      action: true,
      entityType: true,
      entityId: true,
      summary: true,
      metadata: true,
      createdAt: true,
    },
  });

  return NextResponse.json(rows);
}
