import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireSuperAdmin } from "@/lib/scope";
import { normalizeTenantSlug, validateNewTenantSlug } from "@/lib/tenant-slug";

export async function GET() {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireSuperAdmin(authz.session);
  if (forbidden) return forbidden;

  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null, isPlatform: false },
    select: { id: true, slug: true, name: true, createdAt: true },
    orderBy: { slug: "asc" },
  });
  return NextResponse.json(tenants);
}

export async function POST(req: NextRequest) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireSuperAdmin(authz.session);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null);
  const slugRaw = typeof body?.slug === "string" ? body.slug : "";
  const nameRaw = typeof body?.name === "string" ? body.name.trim() : "";
  const slugErr = validateNewTenantSlug(slugRaw);
  if (slugErr) {
    return NextResponse.json({ error: slugErr }, { status: 400 });
  }
  if (!nameRaw) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const slug = normalizeTenantSlug(slugRaw);
  const clash = await prisma.tenant.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true },
  });
  if (clash) {
    return NextResponse.json({ error: "A site with this slug already exists." }, { status: 409 });
  }

  const tenant = await prisma.tenant.create({
    data: { slug, name: nameRaw },
    select: { id: true, slug: true, name: true, createdAt: true },
  });
  return NextResponse.json(tenant, { status: 201 });
}
