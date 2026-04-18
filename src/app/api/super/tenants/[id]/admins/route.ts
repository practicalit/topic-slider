import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireSuperAdmin } from "@/lib/scope";

type Params = { params: Promise<{ id: string }> };

async function getSchoolTenantOr404(tenantId: string) {
  return prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null, isPlatform: false },
    select: { id: true, slug: true, name: true },
  });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireSuperAdmin(authz.session);
  if (forbidden) return forbidden;

  const { id } = await params;
  const tenant = await getSchoolTenantOr404(id);
  if (!tenant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admins = await prisma.user.findMany({
    where: { tenantId: tenant.id, role: "ADMIN" },
    select: { id: true, username: true, createdAt: true },
    orderBy: { username: "asc" },
  });
  return NextResponse.json({ tenant, admins });
}

export async function POST(req: NextRequest, { params }: Params) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireSuperAdmin(authz.session);
  if (forbidden) return forbidden;

  const { id } = await params;
  const tenant = await getSchoolTenantOr404(id);
  if (!tenant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password) {
    return NextResponse.json({ error: "username and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        username,
        password: passwordHash,
        role: "ADMIN",
      },
      select: { id: true, username: true, createdAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not create user (username may already exist for this site)." },
      { status: 409 }
    );
  }
}
