import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbidSuperAdminSchoolWrite,
  requireAuthForSchool,
  requireTeachingContext,
  verifyClassInTenant,
} from "@/lib/scope";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/students/[id]/enroll
 * Enroll an existing tenant student into the current session's class.
 * Idempotent — re-enrolling an already-enrolled student is a no-op.
 */
export async function POST(_req: NextRequest, { params }: Params) {
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

  const { id: studentId } = await params;

  // Verify student belongs to this tenant and is not archived
  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId: ctx.tenantId, deletedAt: null },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  await prisma.studentClassEnrollment.upsert({
    where: { classId_studentId: { classId: ctx.classId, studentId } },
    create: { tenantId: ctx.tenantId, classId: ctx.classId, studentId },
    update: {},
  });

  return NextResponse.json({ success: true });
}
