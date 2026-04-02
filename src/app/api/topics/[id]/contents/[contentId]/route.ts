import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type Params = { params: Promise<{ id: string; contentId: string }> };

// PUT /api/topics/:id/contents/:contentId
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { contentId } = await params;
  const body = await req.json();
  const { title, body: contentBody, sortOrder } = body;

  const content = await prisma.content.update({
    where: { id: contentId },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(contentBody !== undefined && { body: contentBody.trim() }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });
  return NextResponse.json(content);
}

// DELETE /api/topics/:id/contents/:contentId
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { contentId } = await params;
  await prisma.content.delete({ where: { id: contentId } });
  return NextResponse.json({ success: true });
}
