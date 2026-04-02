import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/students
export async function GET() {
  const students = await prisma.student.findMany({
    orderBy: { firstName: "asc" },
    include: {
      stars: true,
    },
  });
  return NextResponse.json(students);
}

// POST /api/students
export async function POST(req: NextRequest) {
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
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    },
  });
  return NextResponse.json(student, { status: 201 });
}
