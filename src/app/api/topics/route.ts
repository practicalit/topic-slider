import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/topics - list all topics
export async function GET() {
  const topics = await prisma.topic.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { contents: true, quizzes: true } } },
  });
  return NextResponse.json(topics);
}

// POST /api/topics - create a topic (admin only)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description } = body;

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const maxOrder = await prisma.topic.aggregate({ _max: { sortOrder: true } });
  const topic = await prisma.topic.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json(topic, { status: 201 });
}
