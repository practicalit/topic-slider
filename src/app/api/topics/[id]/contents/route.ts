import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET /api/topics/:id/contents
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const contents = await prisma.content.findMany({
    where: { topicId: id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(contents);
}

// POST /api/topics/:id/contents (admin only)
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { title, body: contentBody } = body;

  if (!title || !contentBody) {
    return NextResponse.json(
      { error: "Title and body are required" },
      { status: 400 }
    );
  }

  const maxOrder = await prisma.content.aggregate({
    where: { topicId: id },
    _max: { sortOrder: true },
  });

  const content = await prisma.content.create({
    data: {
      topicId: id,
      title: title.trim(),
      body: contentBody.trim(),
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json(content, { status: 201 });
}
