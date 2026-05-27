"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AccessRestricted } from "@/components/access-restricted";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { readApiErrorMessage } from "@/lib/api-client";
import {
  SUPER_ADMIN_WRITE_FORBIDDEN_MESSAGE,
  VOLUNTEER_FORBIDDEN_MESSAGE,
} from "@/lib/scope";
import { sessionDisplayName } from "@/lib/user-display";

type TopicUserRef = { username: string; displayName: string | null; role: string };

interface Topic {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { contents: number; quizzes: number };
  createdBy?: TopicUserRef | null;
  updatedBy?: TopicUserRef | null;
}

type CatRow = { id: string; code?: string; name?: string };

export default function AdminPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  // Auth redirect — no TeachingContextGuard needed; admin manages independently
  useEffect(() => {
    if (sessionStatus === "unauthenticated") router.replace("/login");
  }, [sessionStatus, router]);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");

  // Class + subject selectors (driven locally, not from session context)
  const [classes, setClasses] = useState<CatRow[]>([]);
  const [subjects, setSubjects] = useState<CatRow[]>([]);
  const [subjectId, setSubjectId] = useState("");

  // Create class / subject forms
  const [newClassCode, setNewClassCode] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [catalogMsg, setCatalogMsg] = useState("");

  const reloadCatalog = useCallback(async () => {
    const [c, s] = await Promise.all([fetch("/api/me/classes"), fetch("/api/me/subjects")]);
    const cl = c.ok ? await c.json() : [];
    const su = s.ok ? await s.json() : [];
    if (Array.isArray(cl)) setClasses(cl);
    if (Array.isArray(su)) setSubjects(su);
  }, []);

  useEffect(() => {
    if (session?.user?.role === "ADMIN") {
      reloadCatalog().catch(() => {});
    }
  }, [session?.user?.role, reloadCatalog]);

  // Pre-populate subjectId from session if available
  useEffect(() => {
    if (session?.user?.subjectId) setSubjectId(session.user.subjectId);
  }, [session?.user?.subjectId]);

  // Fetch topics when subject is selected
  const fetchTopics = useCallback(async () => {
    if (!subjectId) { setTopics([]); return; }
    setLoading(true);
    setPageError("");
    const res = await fetch(
      `/api/topics?subjectId=${encodeURIComponent(subjectId)}`
    );
    if (!res.ok) {
      setTopics([]);
      setLoading(false);
      setPageError(await readApiErrorMessage(res, "Could not load topics."));
      return;
    }
    const data = await res.json();
    setTopics(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [subjectId]);

  useEffect(() => {
    if (session?.user?.role === "ADMIN") fetchTopics();
  }, [subjectId, fetchTopics, session?.user?.role]);

  async function handleCreateTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !subjectId) return;
    setPageError("");

    const res = await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, subjectId }),
    });
    if (!res.ok) {
      setPageError(await readApiErrorMessage(res, "Could not create the topic."));
      return;
    }
    setTitle("");
    setDescription("");
    fetchTopics();
  }

  async function handleDeleteTopic(id: string) {
    if (!confirm("Delete this topic and all its content?")) return;
    setPageError("");
    const res = await fetch(`/api/topics/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setPageError(await readApiErrorMessage(res, "Could not delete the topic."));
      return;
    }
    fetchTopics();
  }

  async function handleAddClass(e: React.FormEvent) {
    e.preventDefault();
    setCatalogMsg("");
    if (!newClassCode.trim()) return;
    const res = await fetch("/api/admin/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: newClassCode.trim(), name: newClassName.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setCatalogMsg(data.error || "Could not add class."); return; }
    setNewClassCode("");
    setNewClassName("");
    await reloadCatalog();
    setCatalogMsg("Class added.");
  }

  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault();
    setCatalogMsg("");
    if (!newSubjectName.trim()) return;
    const res = await fetch("/api/admin/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSubjectName.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setCatalogMsg(data.error || "Could not add subject."); return; }
    setNewSubjectName("");
    await reloadCatalog();
    setSubjectId(data.id);
    setCatalogMsg("Subject added.");
  }

  if (sessionStatus === "loading") {
    return <div className="flex justify-center py-20 text-gray-500">Loading...</div>;
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
            : "Use Class & topic from the menu to start presenting."
        }
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <ApiErrorAlert
        message={pageError}
        className="mb-6"
        onDismiss={pageError ? () => setPageError("") : undefined}
      />
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
      <p className="text-sm text-gray-600 mb-6">
        Create and manage classes, subjects, and topics independently.
      </p>

      {/* Tool links */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-xl border border-gray-200 bg-white flex flex-col justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Archive &amp; restore</h2>
            <p className="text-sm text-gray-600 mt-1">Archive classes, subjects, students, or the whole site.</p>
          </div>
          <Link href="/admin/archive" className="shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm font-medium px-4 py-2 rounded-lg text-center border border-gray-300">
            Open archive tools
          </Link>
        </div>
        <div className="p-4 rounded-xl border border-gray-200 bg-white flex flex-col justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Activity log</h2>
            <p className="text-sm text-gray-600 mt-1">Who changed topics, slides, quizzes — with timestamps.</p>
          </div>
          <Link href="/admin/audit" className="shrink-0 bg-white hover:bg-gray-50 text-gray-900 text-sm font-medium px-4 py-2 rounded-lg text-center border border-gray-300">
            View activity log
          </Link>
        </div>
        <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50 flex flex-col justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Volunteer invite</h2>
            <p className="text-sm text-gray-600 mt-1">Generate a single-use link and passcode for a volunteer.</p>
          </div>
          <Link href="/admin/volunteer-access" className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg text-center border border-indigo-700">
            Open invite tool
          </Link>
        </div>
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 flex flex-col justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Students</h2>
            <p className="text-sm text-gray-600 mt-1">Enroll or remove students from classes. Students can belong to multiple classes.</p>
          </div>
          <Link href="/admin/students" className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg text-center border border-emerald-700">
            Manage students
          </Link>
        </div>
      </div>

      {/* Create class + subject */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Classes &amp; Subjects</h2>
        {catalogMsg && (
          <p className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 mb-4">
            {catalogMsg}
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-6">
          <form onSubmit={handleAddClass} className="space-y-3">
            <p className="text-sm font-semibold text-gray-800">Add new class</p>
            <input
              value={newClassCode}
              onChange={(e) => setNewClassCode(e.target.value)}
              placeholder="Class code (e.g. 111)"
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <input
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="Display name (optional)"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
              Add class
            </button>
          </form>
          <form onSubmit={handleAddSubject} className="space-y-3">
            <p className="text-sm font-semibold text-gray-800">Add new subject</p>
            <input
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="Subject name (e.g. Bible Study)"
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
              Add subject
            </button>
          </form>
        </div>
      </div>

      {/* Create + list topics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Topics</h2>
        <p className="text-sm text-gray-600 mb-4">
          Topics belong to a subject and are available to all classes. Taught status is tracked per class when presented.
        </p>

        <form onSubmit={handleCreateTopic} className="space-y-4 mb-6 pb-6 border-b border-gray-100">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">Select subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Topic title"
              required
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900"
            />
            <button
              type="submit"
              disabled={!subjectId || !title.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              Add Topic
            </button>
          </div>
        </form>

        {/* Topic list */}
        {!subjectId ? (
          <p className="text-gray-400 text-center py-6 text-sm">Select a subject above to see topics.</p>
        ) : loading ? (
          <div className="flex justify-center py-8 text-gray-500">Loading topics…</div>
        ) : topics.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No topics for this subject yet.</p>
        ) : (
          <div className="space-y-4">
            {topics.map((topic) => (
              <div
                key={topic.id}
                className="rounded-xl border border-gray-200 p-5 flex items-start justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900">{topic.title}</h3>
                  </div>
                  {topic.description && (
                    <p className="text-gray-600 text-sm mb-2">{topic.description}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    {topic._count.contents} slide(s) · {topic._count.quizzes} quiz question(s)
                  </p>
                  <div className="text-xs text-gray-500 mt-2 space-y-0.5">
                    {topic.createdBy ? (
                      <p>Created by <span className="font-medium">{sessionDisplayName(topic.createdBy)}</span> · {new Date(topic.createdAt).toLocaleString()}</p>
                    ) : (
                      <p>Created · {new Date(topic.createdAt).toLocaleString()}</p>
                    )}
                    <p>
                      Last updated{" "}
                      {topic.updatedBy ? (
                        <span className="font-medium">{sessionDisplayName(topic.updatedBy)}</span>
                      ) : "—"}{" "}
                      · {new Date(topic.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                  <Link
                    href={`/admin/topics/${topic.id}`}
                    className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors border border-indigo-200"
                  >
                    Edit Content
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDeleteTopic(topic.id)}
                    className="bg-red-100 text-red-700 hover:bg-red-200 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
