import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbidSuperAdminSchoolWrite,
  requireAuthForSchool,
  getTopicForSchoolRead,
} from "@/lib/scope";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authz = await requireAuthForSchool();
  if (!authz.ok) return authz.res;
  const readOnly = forbidSuperAdminSchoolWrite(authz.session);
  if (readOnly) return readOnly;

  const { id } = await params;
  const existing = await getTopicForSchoolRead(authz.session, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const topic = await prisma.topic.update({
    where: { id },
    data: { taught: true, taughtAt: new Date() },
  });
  return NextResponse.json(topic);
}
