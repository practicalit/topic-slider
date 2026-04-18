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

  const students = await prisma.student.findMany({
    where: { tenantId: ctx.tenantId, classId: ctx.classId, deletedAt: null },
    orderBy: { firstName: "asc" },
    include: { stars: true },
  });
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

  const student = await prisma.student.create({
    data: {
      tenantId: ctx.tenantId,
      classId: ctx.classId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    },
  });
  return NextResponse.json(student, { status: 201 });
}
