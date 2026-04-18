import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthForSchool, schoolCatalogTenantId } from "@/lib/scope";

export async function GET() {
  const authz = await requireAuthForSchool();
  if (!authz.ok) return authz.res;

  const tenantId = schoolCatalogTenantId(authz.session);
  if (!tenantId) {
    return NextResponse.json(
      { error: "Pick a school site first (Class & subject).", code: "TENANT_SCOPE_REQUIRED" },
      { status: 400 }
    );
  }

  const classes = await prisma.schoolClass.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
  return NextResponse.json(classes);
}
