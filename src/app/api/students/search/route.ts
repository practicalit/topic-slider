import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthForSchool, requireTeachingContext } from "@/lib/scope";

/**
 * GET /api/students/search?q=&classId=
 * Search all non-deleted tenant students, optionally filtering by name query.
 * Returns students with their current class enrollments so the UI can show
 * which classes they are already in and exclude already-enrolled ones.
 */
export async function GET(req: NextRequest) {
  const authz = await requireAuthForSchool();
  if (!authz.ok) return authz.res;
  const ctx = requireTeachingContext(authz.session);
  if (!ctx.ok) return ctx.res;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const excludeClassId = searchParams.get("classId") ?? ctx.classId;

  const students = await prisma.student.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      // Exclude students already enrolled in the target class
      ...(excludeClassId
        ? {
            enrollments: {
              none: { classId: excludeClassId },
            },
          }
        : {}),
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 20,
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  return NextResponse.json(students);
}
