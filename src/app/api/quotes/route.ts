import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/quotes - return all quotes (public, used on login page)
export async function GET() {
  const quotes = await prisma.quote.findMany();
  return NextResponse.json(quotes);
}
