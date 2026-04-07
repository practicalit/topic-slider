import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/scope";

/**
 * Archives the current site (tenant). All sessions for this tenant will stop working until
 * a operator restores the tenant using ARCHIVE_RESTORE_SECRET (see /api/system/tenant-restore).
 */
export async function POST(req: NextRequest) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  const confirmSlug =
    typeof body.confirmSlug === "string" ? body.confirmSlug.trim().toLowerCase() : "";

  const tenant = await prisma.tenant.findFirst({
    where: { id: authz.session.user.tenantId, deletedAt: null },
    select: { id: true, slug: true, name: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found or already archived" }, { status: 404 });
  }
  if (!confirmSlug || confirmSlug !== tenant.slug.toLowerCase()) {
    return NextResponse.json(
      { error: "Type the site slug exactly to confirm archiving." },
      { status: 400 }
    );
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({
    success: true,
    tenantId: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    hint:
      "Save tenantId. To restore when no one can log in: POST /api/system/tenant-restore with ARCHIVE_RESTORE_SECRET and tenantId.",
  });
}
