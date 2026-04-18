import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Optional subtitle for login UX (e.g. city). Extend per deployment. */
const SITE_SUBTITLE: Record<string, string> = {
  dc1: "Addis Ababa",
  dc2: "Addis Ababa",
  demo: "Demo site",
  va1: "Virginia",
  va2: "Virginia",
};

export type IdentifyMatch = {
  tenantSlug: string;
  tenantName: string;
  subtitle: string | null;
  username: string;
};

/**
 * POST { "identifier": "admin" } — find school users with that username (case-insensitive).
 * Email is not stored on User yet; identifier is treated as username across non-platform tenants.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const identifier =
    typeof body === "object" && body !== null && "identifier" in body
      ? String((body as { identifier?: unknown }).identifier ?? "").trim()
      : "";

  if (identifier.length < 2) {
    return NextResponse.json({ matches: [] satisfies IdentifyMatch[] });
  }

  const users = await prisma.user.findMany({
    where: {
      username: { equals: identifier, mode: "insensitive" },
      tenant: { isPlatform: false, deletedAt: null },
    },
    select: {
      username: true,
      tenant: { select: { slug: true, name: true } },
    },
  });

  const matches: IdentifyMatch[] = users.map((u) => {
    const slug = u.tenant.slug;
    return {
      tenantSlug: slug,
      tenantName: u.tenant.name,
      subtitle: SITE_SUBTITLE[slug.toLowerCase()] ?? null,
      username: u.username,
    };
  });

  // Dedupe same tenant (shouldn't happen with unique tenantId+username)
  const seen = new Set<string>();
  const unique = matches.filter((m) => {
    const k = `${m.tenantSlug}\0${m.username.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return NextResponse.json({ matches: unique });
}
