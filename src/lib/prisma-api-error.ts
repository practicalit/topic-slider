import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

/** Map Prisma failures to JSON API responses instead of opaque 500s. */
export function jsonFromPrismaError(e: unknown): NextResponse | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2022" || e.code === "P2021") {
      return NextResponse.json(
        {
          error:
            "Database schema is missing columns or tables. Run: npx prisma migrate deploy",
          code: "MIGRATION_REQUIRED",
        },
        { status: 503 }
      );
    }
  }
  if (e instanceof Prisma.PrismaClientInitializationError) {
    return NextResponse.json(
      {
        error: "Cannot reach the database. Check DATABASE_URL and that PostgreSQL is running.",
        code: "DB_UNAVAILABLE",
      },
      { status: 503 }
    );
  }
  return null;
}
