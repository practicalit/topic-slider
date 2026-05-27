import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidSuperAdminSchoolWrite, requireAdmin, requireAuth, verifyClassInTenant } from "@/lib/scope";

/**
 * GET /api/admin/students?classId=xxx
 * List students enrolled in a class (admin view, no session context required).
 *
 * POST /api/admin/students
 * Body: { classId, firstName, lastName }
 * Create a new student and immediately enroll them in the given class.
 */

export async function GET(req: NextRequest) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  if (!classId) {
    return NextResponse.json({ error: "classId is required" }, { status: 400 });
  }

  const tenantId = authz.session.user.tenantId;

  const enrollments = await prisma.studentClassEnrollment.findMany({
    where: { classId, tenantId, student: { deletedAt: null } },
    orderBy: { student: { firstName: "asc" } },
    include: {
      student: {
        include: { stars: true },
      },
    },
  });

  return NextResponse.json(enrollments.map((e) => e.student));
}

export async function POST(req: NextRequest) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;
  const readOnly = forbidSuperAdminSchoolWrite(authz.session);
  if (readOnly) return readOnly;

  const body = await req.json();
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const classId = typeof body.classId === "string" ? body.classId.trim() : "";

  if (!firstName || !lastName || !classId) {
    return NextResponse.json(
      { error: "firstName, lastName and classId are required" },
      { status: 400 }
    );
  }

  const tenantId = authz.session.user.tenantId;

  const activeClass = await verifyClassInTenant(tenantId, classId);
  if (!activeClass) {
    return NextResponse.json(
      { error: "Class is not available (archived or invalid)" },
      { status: 400 }
    );
  }

  const student = await prisma.student.create({
    data: {
      tenantId,
      firstName,
      lastName,
      enrollments: {
        create: { tenantId, classId },
      },
    },
  });

  return NextResponse.json(student, { status: 201 });
}
