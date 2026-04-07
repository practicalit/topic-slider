import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/scope";

export async function POST(req: NextRequest) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const row = await prisma.subject.create({
      data: {
        tenantId: authz.session.user.tenantId,
        name,
      },
      select: { id: true, name: true },
    });
    return NextResponse.json(row, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Subject name already exists for this site" },
      { status: 409 }
    );
  }
}
