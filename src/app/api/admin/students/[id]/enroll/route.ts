import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidSuperAdminSchoolWrite, requireAdmin, requireAuth, verifyClassInTenant } from "@/lib/scope";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/students/[id]/enroll
 * Body: { classId }
 * Enroll an existing tenant student into a class. Idempotent.
 *
 * DELETE /api/admin/students/[id]/enroll?classId=xxx
 * Remove a student's enrollment from a class.
 */

export async function POST(req: NextRequest, { params }: Params) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;
  const readOnly = forbidSuperAdminSchoolWrite(authz.session);
  if (readOnly) return readOnly;

  const { id: studentId } = await params;
  const body = await req.json();
  const classId = typeof body.classId === "string" ? body.classId.trim() : "";

  if (!classId) {
    return NextResponse.json({ error: "classId is required" }, { status: 400 });
  }

  const tenantId = authz.session.user.tenantId;

  const activeClass = await verifyClassInTenant(tenantId, classId);
  if (!activeClass) {
    return NextResponse.json(
      { error: "Class is not available (archived or invalid)" },
      { status: 400 }
    );
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId, deletedAt: null },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  await prisma.studentClassEnrollment.upsert({
    where: { classId_studentId: { classId, studentId } },
    create: { tenantId, classId, studentId },
    update: {},
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;
  const readOnly = forbidSuperAdminSchoolWrite(authz.session);
  if (readOnly) return readOnly;

  const { id: studentId } = await params;
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");

  if (!classId) {
    return NextResponse.json({ error: "classId is required" }, { status: 400 });
  }

  const tenantId = authz.session.user.tenantId;

  const deleted = await prisma.studentClassEnrollment.deleteMany({
    where: { studentId, classId, tenantId },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
