import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/scope";

/** Lists active and archived classes, subjects, and archived students for the admin’s tenant. */
export async function GET() {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const tenantId = authz.session.user.tenantId;

  const [
    classesActive,
    classesArchived,
    subjectsActive,
    subjectsArchived,
    studentsArchived,
  ] = await Promise.all([
    prisma.schoolClass.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.schoolClass.findMany({
      where: { tenantId, deletedAt: { not: null } },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, deletedAt: true },
    }),
    prisma.subject.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.subject.findMany({
      where: { tenantId, deletedAt: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, deletedAt: true },
    }),
    prisma.student.findMany({
      where: { tenantId, deletedAt: { not: null } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        deletedAt: true,
        classId: true,
        schoolClass: { select: { code: true, deletedAt: true } },
      },
    }),
  ]);

  return NextResponse.json({
    classes: { active: classesActive, archived: classesArchived },
    subjects: { active: subjectsActive, archived: subjectsArchived },
    students: { archived: studentsArchived },
  });
}
