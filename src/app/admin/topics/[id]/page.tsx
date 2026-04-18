"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AccessRestricted } from "@/components/access-restricted";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { readApiErrorMessage } from "@/lib/api-client";
import {
  SUPER_ADMIN_WRITE_FORBIDDEN_MESSAGE,
  VOLUNTEER_FORBIDDEN_MESSAGE,
} from "@/lib/scope";
import { JeopardyBoardEditor } from "@/components/jeopardy-board-editor";
import { ContentMediaUpload, isImageBodyPreviewable } from "@/components/content-media-upload";
import { CONTENT_KIND_OPTIONS, type ContentKind } from "@/types/content";

interface Content {
  id: string;
  kind?: ContentKind;
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

function bodyFieldLabel(kind: ContentKind): string {
  switch (kind) {
    case "IMAGE":
      return "Image URL (https) or path from upload";
    case "VIDEO":
      return "Video URL or path from upload";
    default:
      return "Body (markdown)";
  }
}

function bodyPlaceholder(kind: ContentKind): string {
  switch (kind) {
    case "IMAGE":
      return "https://… or upload above — stored as /uploads/media/…";
    case "VIDEO":
      return "YouTube / Vimeo / .mp4 link, or upload above";
    case "SLIDE":
      return "Supporting text (markdown): bullets, quotes, etc.";
    default:
      return "Markdown: headings, lists, **bold**, images via ![alt](url)";
  }
}

function kindBadge(kind: ContentKind) {
  const label = CONTENT_KIND_OPTIONS.find((k) => k.value === kind)?.label ?? kind;
  return (
    <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
      {label}
    </span>
  );
}

export default function TopicEditPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");

  const [contentKind, setContentKind] = useState<ContentKind>("TEXT");
  const [contentTitle, setContentTitle] = useState("");
  const [contentBody, setContentBody] = useState("");

  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState(["", "", "", ""]);
  const [quizAnswer, setQuizAnswer] = useState(0);

  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [editKind, setEditKind] = useState<ContentKind>("TEXT");
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  const fetchTopic = useCallback(async () => {
    setLoadError("");
    setActionError("");
    const res = await fetch(`/api/topics/${id}`);
    if (!res.ok) {
      setTopic(null);
      setLoading(false);
      setLoadError(await readApiErrorMessage(res, "Could not load this topic."));
      return;
    }
    const data = await res.json();
    setTopic(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void fetchTopic();
  }, [fetchTopic]);

  async function handleAddContent(e: React.FormEvent) {
    e.preventDefault();
    if (!contentTitle.trim()) return;
    if (contentKind === "TEXT" || contentKind === "SLIDE") {
      if (!contentBody.trim()) return;
    } else if (!contentBody.trim()) {
      setActionError("Add an image or video URL, or upload a file.");
      return;
    }

    setActionError("");
    const res = await fetch(`/api/topics/${id}/contents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: contentKind,
        title: contentTitle,
        body: contentBody,
      }),
    });
    if (!res.ok) {
      setActionError(await readApiErrorMessage(res, "Could not add content."));
      return;
    }

    setContentTitle("");
    setContentBody("");
    setContentKind("TEXT");
    fetchTopic();
  }

  async function handleUpdateContent(contentId: string) {
    if (editKind === "TEXT" || editKind === "SLIDE") {
      if (!editBody.trim()) return;
    } else if (!editBody.trim()) {
      setActionError("Add an image or video URL, or upload a file.");
      return;
    }

    setActionError("");
    const res = await fetch(`/api/topics/${id}/contents/${contentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: editKind,
        title: editTitle,
        body: editBody,
        slideTheme: null,
      }),
    });
    if (!res.ok) {
      setActionError(await readApiErrorMessage(res, "Could not save this block."));
      return;
    }
    setEditingContent(null);
    fetchTopic();
  }

  async function handleDeleteContent(contentId: string) {
    if (!confirm("Delete this content slide?")) return;
    setActionError("");
    const res = await fetch(`/api/topics/${id}/contents/${contentId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setActionError(await readApiErrorMessage(res, "Could not delete this block."));
      return;
    }
    fetchTopic();
  }

  async function handleAddQuiz(e: React.FormEvent) {
    e.preventDefault();
    const validOptions = quizOptions.filter((o) => o.trim());
    if (!quizQuestion.trim() || validOptions.length < 2) return;

    setActionError("");
    const res = await fetch(`/api/topics/${id}/quizzes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: quizQuestion,
        options: validOptions,
        answer: quizAnswer,
      }),
    });
    if (!res.ok) {
      setActionError(await readApiErrorMessage(res, "Could not add the quiz question."));
      return;
    }

    setQuizQuestion("");
    setQuizOptions(["", "", "", ""]);
    setQuizAnswer(0);
    fetchTopic();
  }

  async function handleDeleteQuiz(quizId: string) {
    if (!confirm("Delete this quiz question?")) return;
    setActionError("");
    const res = await fetch(`/api/topics/${id}/quizzes/${quizId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setActionError(await readApiErrorMessage(res, "Could not delete the quiz question."));
      return;
    }
    fetchTopic();
  }

  if (sessionStatus === "loading") {
    return <div className="flex justify-center py-20 text-gray-500">Loading...</div>;
  }

  if (sessionStatus === "unauthenticated") {
    router.replace("/login");
    return (
      <div className="flex justify-center py-20 text-gray-500">Redirecting to sign in…</div>
    );
  }

  if (!session?.user || session.user.role !== "ADMIN") {
    const isSuper = session?.user?.role === "SUPER_ADMIN";
    return (
      <AccessRestricted
        title={isSuper ? "View-only for platform admins" : "School admin only"}
        description={isSuper ? SUPER_ADMIN_WRITE_FORBIDDEN_MESSAGE : VOLUNTEER_FORBIDDEN_MESSAGE}
        hint={
          isSuper
            ? undefined
            : "You can still open Present or Students for the selected class if your school allows it."
        }
      />
    );
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-gray-500">Loading...</div>;
  }

  if (!topic) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <ApiErrorAlert
          message={loadError || "We couldn’t load this topic."}
          className="mb-6"
        />
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
        >
          ← Back to Admin
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <ApiErrorAlert
        message={actionError}
        className="mb-4"
        onDismiss={actionError ? () => setActionError("") : undefined}
      />
      <button
        type="button"
        onClick={() => router.push("/admin")}
        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-4 inline-block"
      >
        ← Back to Topics
      </button>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">{topic.title}</h1>
      {topic.description && <p className="text-gray-500 mb-8">{topic.description}</p>}

      <section className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Content blocks ({topic.contents.length})
        </h2>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Add content block</h3>
          <form onSubmit={handleAddContent} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select
                value={contentKind}
                onChange={(e) => setContentKind(e.target.value as ContentKind)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
              >
                {CONTENT_KIND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} — {opt.hint}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={contentTitle}
              onChange={(e) => setContentTitle(e.target.value)}
              placeholder="Title / headline / caption"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
            />
            <ContentMediaUpload
              kind={contentKind}
              body={contentBody}
              setBody={setContentBody}
              onUploadError={(m) => setActionError(m)}
            />
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {bodyFieldLabel(contentKind)}
              </label>
              <textarea
                value={contentBody}
                onChange={(e) => setContentBody(e.target.value)}
                placeholder={bodyPlaceholder(contentKind)}
                required={contentKind === "TEXT" || contentKind === "SLIDE"}
                rows={contentKind === "IMAGE" || contentKind === "VIDEO" ? 2 : 6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900 font-mono text-sm"
              />
            </div>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2 rounded-lg transition-colors"
            >
              Add block
            </button>
          </form>
        </div>

        <div className="space-y-3">
          {topic.contents.map((content, index) => (
            <div
              key={content.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
            >
              {editingContent === content.id ? (
                <div className="space-y-3">
                  <select
                    value={editKind}
                    onChange={(e) => setEditKind(e.target.value as ContentKind)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
                  >
                    {CONTENT_KIND_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  />
                  <ContentMediaUpload
                    kind={editKind}
                    body={editBody}
                    setBody={setEditBody}
                    onUploadError={(m) => setActionError(m)}
                  />
                  <label className="block text-xs text-gray-600">{bodyFieldLabel(editKind)}</label>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    required={editKind === "TEXT" || editKind === "SLIDE"}
                    rows={editKind === "IMAGE" || editKind === "VIDEO" ? 2 : 6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900 font-mono text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateContent(content.id)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingContent(null)}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-1.5 rounded-lg text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-indigo-500 font-medium">#{index + 1}</span>
                      {kindBadge(content.kind ?? "TEXT")}
                      <h4 className="font-medium text-gray-900">{content.title}</h4>
                    </div>
                    {content.kind === "IMAGE" && isImageBodyPreviewable(content.body) && (
                      <div className="mt-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={content.body}
                          alt=""
                          className="max-h-32 rounded-lg border border-gray-200 object-contain"
                        />
                      </div>
                    )}
                    {(content.kind === "TEXT" || content.kind === "SLIDE" || !content.kind) && (
                      <p className="text-gray-600 text-sm mt-1 whitespace-pre-wrap break-words">
                        {content.body.length > 200 ? content.body.slice(0, 200) + "…" : content.body}
                      </p>
                    )}
                    {(content.kind === "VIDEO" || content.kind === "IMAGE") && (
                      <p className="text-gray-500 text-xs mt-1 font-mono break-all">{content.body}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingContent(content.id);
                        setEditKind(content.kind ?? "TEXT");
                        setEditTitle(content.title);
                        setEditBody(content.body);
                      }}
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
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

      <section className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Jeopardy-style game</h2>
        <p className="text-sm text-gray-600 mb-4">
          Class game board tied to this topic: columns from slide sections, clues from bullets and quiz
          questions. Present from the topic screen as solo (stars) or teams.
        </p>
        <JeopardyBoardEditor topicId={id} />
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Quiz Questions ({topic.quizzes.length})
        </h2>

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
                          i === quiz.answer ? "text-green-700 font-medium" : "text-gray-600"
                        }`}
                      >
                        {i === quiz.answer ? "✓" : "○"} {opt}
                      </p>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
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
