import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbidSuperAdminSchoolWrite,
  requireAuthForSchool,
  requireTeachingContext,
} from "@/lib/scope";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authz = await requireAuthForSchool();
  if (!authz.ok) return authz.res;
  const readOnly = forbidSuperAdminSchoolWrite(authz.session);
  if (readOnly) return readOnly;
  const ctx = requireTeachingContext(authz.session);
  if (!ctx.ok) return ctx.res;

  const { id } = await params;

  // Remove enrollment from this class only
  const deleted = await prisma.studentClassEnrollment.deleteMany({
    where: {
      studentId: id,
      classId: ctx.classId,
      tenantId: ctx.tenantId,
    },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
