"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

interface Content {
  id: string;
  title: string;
  body: string;
  sortOrder: number;
}

interface Quiz {
  id: string;
  question: string;
  options: string[];
  answer: number;
}

interface Topic {
  id: string;
  title: string;
  description: string | null;
  taught: boolean;
  contents: Content[];
  quizzes: Quiz[];
}

type Mode = "slides" | "quiz";

export default function PresentTopicPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mode, setMode] = useState<Mode>("slides");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/topics/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setTopic(data);
        setLoading(false);
      });
  }, [id]);

  async function markAsTaught() {
    await fetch(`/api/topics/${id}/taught`, { method: "POST" });
    setTopic((prev) => (prev ? { ...prev, taught: true } : prev));
  }

  if (loading || !topic) {
    return <div className="flex justify-center py-20 text-gray-500">Loading...</div>;
  }

  const slides = topic.contents;
  const totalSlides = slides.length;

  if (mode === "quiz") {
    return (
      <QuizMode
        topic={topic}
        onBack={() => setMode("slides")}
        onFinish={() => router.push("/present")}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{topic.title}</h1>
            <p className="text-sm text-gray-500">
              Slide {currentSlide + 1} of {totalSlides}
            </p>
          </div>
          <div className="flex gap-2">
            {!topic.taught && (
              <button
                onClick={markAsTaught}
                className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                ✓ Mark as Taught
              </button>
            )}
            {topic.quizzes.length > 0 && (
              <button
                onClick={() => setMode("quiz")}
                className="bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                Start Quiz →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Slide Content */}
      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-3xl w-full mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 md:p-14 min-h-[400px]">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">
              {slides[currentSlide].title}
            </h2>
            <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed prose-p:my-4 prose-headings:mt-8 prose-headings:mb-4 prose-li:my-1.5 prose-blockquote:my-5 prose-ul:my-4 prose-ol:my-4 prose-table:my-6 prose-hr:my-6">
              <ReactMarkdown
                components={{
                  img: ({ ...props }) => (
                    <img {...props} className="rounded-xl mx-auto max-h-64 object-contain" />
                  ),
                }}
              >
                {slides[currentSlide].body}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
            disabled={currentSlide === 0}
            className="bg-gray-200 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed px-6 py-2.5 rounded-lg font-medium transition-colors text-gray-700"
          >
            ← Previous
          </button>

          {/* Slide dots */}
          <div className="flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  i === currentSlide ? "bg-indigo-600" : "bg-gray-300 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => {
              if (currentSlide === totalSlides - 1) {
                if (topic.quizzes.length > 0) {
                  setMode("quiz");
                } else {
                  markAsTaught();
                  router.push("/present");
                }
              } else {
                setCurrentSlide(currentSlide + 1);
              }
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            {currentSlide === totalSlides - 1
              ? topic.quizzes.length > 0
                ? "Start Quiz →"
                : "Finish ✓"
              : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------ Quiz Mode ------ */

interface QuizModeProps {
  topic: Topic;
  onBack: () => void;
  onFinish: () => void;
}

interface StudentOption {
  id: string;
  firstName: string;
  lastName: string;
}

function QuizMode({ topic, onBack, onFinish }: QuizModeProps) {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/students")
      .then((r) => r.json())
      .then(setStudents);
  }, []);

  const quiz = topic.quizzes[currentQ];
  const isCorrect = selectedAnswer === quiz?.answer;
  const totalQuestions = topic.quizzes.length;

  function handleSubmitAnswer() {
    if (selectedAnswer === null || !selectedStudent) return;
    setShowResult(true);

    if (isCorrect) {
      setScores((prev) => ({
        ...prev,
        [selectedStudent]: (prev[selectedStudent] || 0) + 1,
      }));
    }
  }

  async function handleNext() {
    if (currentQ === totalQuestions - 1) {
      // Award stars
      for (const [studentId, points] of Object.entries(scores)) {
        await fetch("/api/stars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            topicId: topic.id,
            points,
          }),
        });
      }

      // Extra star for current correct answer
      if (isCorrect && selectedStudent) {
        // Already counted in scores
      }

      // Mark as taught
      await fetch(`/api/topics/${topic.id}/taught`, { method: "POST" });
      onFinish();
    } else {
      setCurrentQ(currentQ + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setSelectedStudent("");
    }
  }

  if (!quiz) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Quiz: {topic.title}
            </h1>
            <p className="text-sm text-gray-500">
              Question {currentQ + 1} of {totalQuestions}
            </p>
          </div>
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900 text-sm font-medium"
          >
            ← Back to Slides
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="max-w-2xl w-full">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            {/* Student Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Which student is answering?
              </label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                disabled={showResult}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
              >
                <option value="">Select a student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
            </div>

            {/* Question */}
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {quiz.question}
            </h2>

            {/* Options */}
            <div className="space-y-3 mb-6">
              {quiz.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => !showResult && setSelectedAnswer(i)}
                  disabled={showResult}
                  className={`w-full text-left px-5 py-3 rounded-lg border-2 font-medium transition-all ${
                    showResult
                      ? i === quiz.answer
                        ? "border-green-500 bg-green-50 text-green-700"
                        : i === selectedAnswer
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-gray-200 text-gray-500"
                      : selectedAnswer === i
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  }`}
                >
                  <span className="mr-3">{String.fromCharCode(65 + i)}.</span>
                  {opt}
                </button>
              ))}
            </div>

            {/* Result */}
            {showResult && (
              <div
                className={`p-4 rounded-lg mb-4 ${
                  isCorrect
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {isCorrect
                  ? "⭐ Correct! +1 star!"
                  : `✗ Incorrect. The correct answer was: ${quiz.options[quiz.answer]}`}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              {!showResult ? (
                <button
                  onClick={handleSubmitAnswer}
                  disabled={selectedAnswer === null || !selectedStudent}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                >
                  {currentQ === totalQuestions - 1 ? "Finish Quiz ✓" : "Next Question →"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
