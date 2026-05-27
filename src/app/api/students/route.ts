import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbidSuperAdminSchoolWrite,
  requireAuthForSchool,
  requireTeachingContext,
  verifyClassInTenant,
} from "@/lib/scope";

export async function GET() {
  const authz = await requireAuthForSchool();
  if (!authz.ok) return authz.res;
  const ctx = requireTeachingContext(authz.session);
  if (!ctx.ok) return ctx.res;

  // Return students enrolled in the current session class (excluding soft-deleted students)
  const enrollments = await prisma.studentClassEnrollment.findMany({
    where: { classId: ctx.classId, tenantId: ctx.tenantId, student: { deletedAt: null } },
    orderBy: { student: { firstName: "asc" } },
    include: {
      student: {
        include: { stars: true },
      },
    },
  });

  const students = enrollments.map((e) => e.student);
  return NextResponse.json(students);
}

export async function POST(req: NextRequest) {
  const authz = await requireAuthForSchool();
  if (!authz.ok) return authz.res;
  const readOnly = forbidSuperAdminSchoolWrite(authz.session);
  if (readOnly) return readOnly;
  const ctx = requireTeachingContext(authz.session);
  if (!ctx.ok) return ctx.res;

  const activeClass = await verifyClassInTenant(ctx.tenantId, ctx.classId);
  if (!activeClass) {
    return NextResponse.json(
      { error: "Class is not available (archived or invalid)" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { firstName, lastName } = body;

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "First name and last name are required" },
      { status: 400 }
    );
  }

  // Create student (tenant-level) and immediately enroll in current class
  const student = await prisma.student.create({
    data: {
      tenantId: ctx.tenantId,
      firstName: (firstName as string).trim(),
      lastName: (lastName as string).trim(),
      enrollments: {
        create: {
          tenantId: ctx.tenantId,
          classId: ctx.classId,
        },
      },
    },
  });
  return NextResponse.json(student, { status: 201 });
}
