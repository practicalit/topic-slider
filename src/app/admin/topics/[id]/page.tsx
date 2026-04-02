"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

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
  contents: Content[];
  quizzes: Quiz[];
}

export default function TopicEditPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);

  // Content form
  const [contentTitle, setContentTitle] = useState("");
  const [contentBody, setContentBody] = useState("");

  // Quiz form
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState(["", "", "", ""]);
  const [quizAnswer, setQuizAnswer] = useState(0);

  // Edit mode
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  useEffect(() => {
    if (session && session.user?.role !== "ADMIN") {
      router.push("/");
    }
  }, [session, router]);

  useEffect(() => {
    fetchTopic();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchTopic() {
    const res = await fetch(`/api/topics/${id}`);
    if (!res.ok) {
      router.push("/admin");
      return;
    }
    const data = await res.json();
    setTopic(data);
    setLoading(false);
  }

  async function handleAddContent(e: React.FormEvent) {
    e.preventDefault();
    if (!contentTitle.trim() || !contentBody.trim()) return;

    await fetch(`/api/topics/${id}/contents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: contentTitle, body: contentBody }),
    });

    setContentTitle("");
    setContentBody("");
    fetchTopic();
  }

  async function handleUpdateContent(contentId: string) {
    await fetch(`/api/topics/${id}/contents/${contentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, body: editBody }),
    });
    setEditingContent(null);
    fetchTopic();
  }

  async function handleDeleteContent(contentId: string) {
    if (!confirm("Delete this content slide?")) return;
    await fetch(`/api/topics/${id}/contents/${contentId}`, {
      method: "DELETE",
    });
    fetchTopic();
  }

  async function handleAddQuiz(e: React.FormEvent) {
    e.preventDefault();
    const validOptions = quizOptions.filter((o) => o.trim());
    if (!quizQuestion.trim() || validOptions.length < 2) return;

    await fetch(`/api/topics/${id}/quizzes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: quizQuestion,
        options: validOptions,
        answer: quizAnswer,
      }),
    });

    setQuizQuestion("");
    setQuizOptions(["", "", "", ""]);
    setQuizAnswer(0);
    fetchTopic();
  }

  async function handleDeleteQuiz(quizId: string) {
    if (!confirm("Delete this quiz question?")) return;
    await fetch(`/api/topics/${id}/quizzes/${quizId}`, {
      method: "DELETE",
    });
    fetchTopic();
  }

  if (loading || !topic) {
    return <div className="flex justify-center py-20 text-gray-500">Loading...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <button
        onClick={() => router.push("/admin")}
        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-4 inline-block"
      >
        ← Back to Topics
      </button>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">{topic.title}</h1>
      {topic.description && (
        <p className="text-gray-500 mb-8">{topic.description}</p>
      )}

      {/* Content Section */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Content Slides ({topic.contents.length})
        </h2>

        {/* Add Content Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New Slide</h3>
          <form onSubmit={handleAddContent} className="space-y-3">
            <input
              type="text"
              value={contentTitle}
              onChange={(e) => setContentTitle(e.target.value)}
              placeholder="Slide title"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
            />
            <textarea
              value={contentBody}
              onChange={(e) => setContentBody(e.target.value)}
              placeholder="Slide content (supports plain text)"
              required
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2 rounded-lg transition-colors"
            >
              Add Slide
            </button>
          </form>
        </div>

        {/* Content List */}
        <div className="space-y-3">
          {topic.contents.map((content, index) => (
            <div
              key={content.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
            >
              {editingContent === content.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  />
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateContent(content.id)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingContent(null)}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-1.5 rounded-lg text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      <span className="text-indigo-500 mr-2">#{index + 1}</span>
                      {content.title}
                    </h4>
                    <p className="text-gray-600 text-sm mt-1 whitespace-pre-wrap">
                      {content.body.length > 200
                        ? content.body.slice(0, 200) + "..."
                        : content.body}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingContent(content.id);
                        setEditTitle(content.title);
                        setEditBody(content.body);
                      }}
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteContent(content.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Quiz Section */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Quiz Questions ({topic.quizzes.length})
        </h2>

        {/* Add Quiz Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Quiz Question</h3>
          <form onSubmit={handleAddQuiz} className="space-y-3">
            <input
              type="text"
              value={quizQuestion}
              onChange={(e) => setQuizQuestion(e.target.value)}
              placeholder="Question"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
            />
            {quizOptions.map((opt, i) => (
              <div key={i} className="flex items-center gap-3">
                <input
                  type="radio"
                  name="answer"
                  checked={quizAnswer === i}
                  onChange={() => setQuizAnswer(i)}
                  className="text-indigo-600"
                />
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const newOpts = [...quizOptions];
                    newOpts[i] = e.target.value;
                    setQuizOptions(newOpts);
                  }}
                  placeholder={`Option ${i + 1}${i >= 2 ? " (optional)" : ""}`}
                  required={i < 2}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                />
              </div>
            ))}
            <p className="text-xs text-gray-500">Select the radio button next to the correct answer</p>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2 rounded-lg transition-colors"
            >
              Add Question
            </button>
          </form>
        </div>

        {/* Quiz List */}
        <div className="space-y-3">
          {topic.quizzes.map((quiz, index) => (
            <div
              key={quiz.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-medium text-gray-900">
                    <span className="text-indigo-500 mr-2">Q{index + 1}.</span>
                    {quiz.question}
                  </h4>
                  <div className="mt-2 space-y-1">
                    {quiz.options.map((opt, i) => (
                      <p
                        key={i}
                        className={`text-sm ${
                          i === quiz.answer
                            ? "text-green-700 font-medium"
                            : "text-gray-600"
                        }`}
                      >
                        {i === quiz.answer ? "✓" : "○"} {opt}
                      </p>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteQuiz(quiz.id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium flex-shrink-0"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
