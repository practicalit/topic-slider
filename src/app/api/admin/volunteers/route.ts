import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  SUPER_ADMIN_WRITE_FORBIDDEN_CODE,
  SUPER_ADMIN_WRITE_FORBIDDEN_MESSAGE,
  UNAUTHORIZED_CODE,
  UNAUTHORIZED_MESSAGE,
  VOLUNTEER_FORBIDDEN_CODE,
  VOLUNTEER_FORBIDDEN_MESSAGE,
} from "@/lib/scope";

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: UNAUTHORIZED_MESSAGE, code: UNAUTHORIZED_CODE }, { status: 401 });
  }
  if (session.user.role === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: SUPER_ADMIN_WRITE_FORBIDDEN_MESSAGE, code: SUPER_ADMIN_WRITE_FORBIDDEN_CODE },
      { status: 403 }
    );
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: VOLUNTEER_FORBIDDEN_MESSAGE, code: VOLUNTEER_FORBIDDEN_CODE },
      { status: 403 }
    );
  }

  const volunteers = await prisma.user.findMany({
    where: { role: "VOLUNTEER", tenantId: session.user.tenantId },
    select: { id: true, username: true },
    orderBy: { username: "asc" },
  });

  return NextResponse.json(volunteers);
}
