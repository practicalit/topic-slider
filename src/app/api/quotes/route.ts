import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Quotes for the login backdrop: pass ?tenantSlug= (public), or use the signed-in user's site.
 * Returns a JSON array (possibly empty `[]`). Empty when the tenant slug is unknown, the tenant
 * has no rows in `Quote`, or the request is unauthenticated and has no `tenantSlug` query param.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("tenantSlug")?.trim().toLowerCase();

  if (slug) {
    const tenant = await prisma.tenant.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true },
    });
    if (!tenant) {
      return NextResponse.json([]);
    }
    const quotes = await prisma.quote.findMany({
      where: { tenantId: tenant.id },
    });
    return NextResponse.json(quotes);
  }

  const session = await auth();
  if (session?.user?.tenantId) {
    const quotes = await prisma.quote.findMany({
      where: { tenantId: session.user.tenantId },
    });
    return NextResponse.json(quotes);
  }

  return NextResponse.json([]);
}
