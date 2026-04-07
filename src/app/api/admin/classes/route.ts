import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/scope";

export async function POST(req: NextRequest) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const body = await req.json();
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() || null : null;

  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  try {
    const row = await prisma.schoolClass.create({
      data: {
        tenantId: authz.session.user.tenantId,
        code,
        name,
      },
      select: { id: true, code: true, name: true },
    });
    return NextResponse.json(row, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Class code already exists for this site" },
      { status: 409 }
    );
  }
}
