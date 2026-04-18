import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Labels for the global context pill (site + class). School users: own tenant; super admin: viewed tenant.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const u = session.user;
  const isSuper = u.role === "SUPER_ADMIN";
  const tenantId = isSuper ? u.superViewTenantId : u.tenantId;

  if (!tenantId) {
    return NextResponse.json({
      siteName: null,
      className: null,
      subjectName: null,
    });
  }

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { name: true, slug: true },
  });

  let className: string | null = null;
  if (u.classId) {
    const cls = await prisma.schoolClass.findFirst({
      where: { id: u.classId, tenantId, deletedAt: null },
      select: { code: true, name: true },
    });
    if (cls) {
      className = cls.name ? `${cls.code} — ${cls.name}` : cls.code;
    }
  }

  let subjectName: string | null = null;
  if (u.subjectId) {
    const sub = await prisma.subject.findFirst({
      where: { id: u.subjectId, tenantId, deletedAt: null },
      select: { name: true },
    });
    subjectName = sub?.name ?? null;
  }

  return NextResponse.json({
    siteName: tenant?.name ?? tenant?.slug ?? null,
    className,
    subjectName,
  });
}
