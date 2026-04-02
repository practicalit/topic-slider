import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET /api/topics/:id - get topic with contents and quizzes
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const topic = await prisma.topic.findUnique({
    where: { id },
    include: {
      contents: { orderBy: { sortOrder: "asc" } },
      quizzes: true,
    },
  });
  if (!topic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(topic);
}

// PUT /api/topics/:id - update a topic (admin only)
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { title, description, taught } = body;

  const topic = await prisma.topic.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(taught !== undefined && {
        taught,
        taughtAt: taught ? new Date() : null,
      }),
    },
  });
  return NextResponse.json(topic);
}

// DELETE /api/topics/:id - delete a topic (admin only)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.topic.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
