import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbidSuperAdminSchoolWrite,
  requireAuthForSchool,
  requireTeachingContext,
  verifyClassInTenant,
} from "@/lib/scope";

const MAX_BATCH = 400;
const MAX_NAME_LEN = 80;

type Row = { firstName: string; lastName: string };

function normalizeRow(r: unknown): Row | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const firstName = typeof o.firstName === "string" ? o.firstName.trim() : "";
  const lastName = typeof o.lastName === "string" ? o.lastName.trim() : "";
  if (!firstName || !lastName) return null;
  if (firstName.length > MAX_NAME_LEN || lastName.length > MAX_NAME_LEN) return null;
  return { firstName, lastName };
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
  const raw = body.students;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "students array required" }, { status: 400 });
  }
  if (raw.length === 0) {
    return NextResponse.json({ error: "No students to add" }, { status: 400 });
  }
  if (raw.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `At most ${MAX_BATCH} students per import` },
      { status: 400 }
    );
  }

  const rows: Row[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const n = normalizeRow(item);
    if (!n) continue;
    const key = `${n.firstName.toLowerCase()}\0${n.lastName.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(n);
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid name rows" }, { status: 400 });
  }

  const { count } = await prisma.student.createMany({
    data: rows.map((r) => ({
      tenantId: ctx.tenantId,
      classId: ctx.classId,
      firstName: r.firstName,
      lastName: r.lastName,
    })),
  });

  return NextResponse.json({ created: count, requested: rows.length }, { status: 201 });
}
