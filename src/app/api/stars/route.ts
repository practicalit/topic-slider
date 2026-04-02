import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/stars - award stars to students
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { studentId, topicId, points } = body;

  if (!studentId || !topicId || typeof points !== "number") {
    return NextResponse.json(
      { error: "studentId, topicId, and points are required" },
      { status: 400 }
    );
  }

  const star = await prisma.star.upsert({
    where: {
      studentId_topicId: { studentId, topicId },
    },
    update: {
      points: { increment: points },
    },
    create: {
      studentId,
      topicId,
      points,
    },
  });
  return NextResponse.json(star);
}

// GET /api/stars - leaderboard
export async function GET() {
  const leaderboard = await prisma.student.findMany({
    include: {
      stars: true,
    },
    orderBy: {
      firstName: "asc",
    },
  });

  const result = leaderboard
    .map((student: typeof leaderboard[number]) => ({
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      totalStars: student.stars.reduce((sum: number, s: { points: number }) => sum + s.points, 0),
    }))
    .sort((a: { totalStars: number }, b: { totalStars: number }) => b.totalStars - a.totalStars);

  return NextResponse.json(result);
}
