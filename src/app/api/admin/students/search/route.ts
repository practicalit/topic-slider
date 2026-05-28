import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/scope";

/**
 * GET /api/admin/students/search?q=&classId=
 * Search non-deleted tenant students. When classId is provided, excludes
 * students already enrolled in that class.
 */
export async function GET(req: NextRequest) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const excludeClassId = searchParams.get("classId") ?? undefined;
  const tenantId = authz.session.user.tenantId;

  const students = await prisma.student.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(excludeClassId
        ? { enrollments: { none: { classId: excludeClassId } } }
        : {}),
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 20,
    select: { id: true, firstName: true, lastName: true },
  });

  return NextResponse.json(students);
}
