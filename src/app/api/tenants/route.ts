import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Public list for login (slug + display name only). */
export async function GET() {
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null, isPlatform: false },
    select: { id: true, slug: true, name: true },
    orderBy: { slug: "asc" },
  });
  return NextResponse.json(tenants);
}
