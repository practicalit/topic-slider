import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET /api/topics/:id/quizzes
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const quizzes = await prisma.quiz.findMany({
    where: { topicId: id },
  });
  return NextResponse.json(quizzes);
}

// POST /api/topics/:id/quizzes (admin only)
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { question, options, answer } = body;

  if (!question || !Array.isArray(options) || options.length < 2 || answer === undefined) {
    return NextResponse.json(
      { error: "Question, options (min 2), and answer index are required" },
      { status: 400 }
    );
  }

  if (typeof answer !== "number" || answer < 0 || answer >= options.length) {
    return NextResponse.json(
      { error: "Answer must be a valid option index" },
      { status: 400 }
    );
  }

  const quiz = await prisma.quiz.create({
    data: {
      topicId: id,
      question: question.trim(),
      options: options.map((o: string) => o.trim()),
      answer,
    },
  });
  return NextResponse.json(quiz, { status: 201 });
}
