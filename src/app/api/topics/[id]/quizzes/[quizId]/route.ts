import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type Params = { params: Promise<{ id: string; quizId: string }> };

// DELETE /api/topics/:id/quizzes/:quizId
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { quizId } = await params;
  await prisma.quiz.delete({ where: { id: quizId } });
  return NextResponse.json({ success: true });
}
