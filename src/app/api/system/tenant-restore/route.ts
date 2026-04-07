import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MIN_SECRET_LEN = 16;

/**
 * Emergency restore for an archived tenant (no valid session possible).
 * Requires ARCHIVE_RESTORE_SECRET in the request body matching the server env var.
 */
export async function POST(req: NextRequest) {
  const configured = process.env.ARCHIVE_RESTORE_SECRET?.trim();
  if (!configured || configured.length < MIN_SECRET_LEN) {
    return NextResponse.json(
      { error: "ARCHIVE_RESTORE_SECRET is not configured on the server." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const secret = typeof body.secret === "string" ? body.secret : "";
  const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";

  if (secret !== configured) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: { not: null } },
    select: { id: true, slug: true },
  });
  if (!tenant) {
    return NextResponse.json(
      { error: "No archived tenant found with that id" },
      { status: 404 }
    );
  }

  const slugTaken = await prisma.tenant.findFirst({
    where: { slug: tenant.slug, deletedAt: null, NOT: { id: tenant.id } },
    select: { id: true },
  });
  if (slugTaken) {
    return NextResponse.json(
      {
        error:
          "Another active site already uses this slug. Rename the other tenant or merge data before restoring.",
        code: "SLUG_CONFLICT",
      },
      { status: 409 }
    );
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { deletedAt: null },
  });

  return NextResponse.json({ success: true, tenantId: tenant.id, slug: tenant.slug });
}
