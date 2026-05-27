"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";

type ClassRow = { id: string; code?: string; name?: string };
type TenantRow = { id: string; slug: string; name: string };
type TopicRow = {
  id: string;
  title: string;
  subjectId: string;
  taught: boolean;
  _count: { contents: number };
  subject: { name: string };
};

export default function ContextPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const isSuper = session?.user?.role === "SUPER_ADMIN";

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [viewTenantId, setViewTenantId] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [classId, setClassId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const classSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (!isSuper || status !== "authenticated") return;
    fetch("/api/super/tenants")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TenantRow[]) => {
        if (Array.isArray(data)) setTenants(data);
      })
      .catch(() => {});
  }, [isSuper, status]);

  useEffect(() => {
    if (session?.user?.superViewTenantId) {
      setViewTenantId(session.user.superViewTenantId);
    } else if (isSuper) {
      setViewTenantId("");
    }
  }, [session?.user?.superViewTenantId, isSuper]);

  const reloadClasses = useCallback(async () => {
    if (isSuper && !session?.user?.superViewTenantId) {
      setClasses([]);
      return;
    }
    const res = await fetch("/api/me/classes");
    if (!res.ok) { setClasses([]); return; }
    const data = await res.json();
    if (Array.isArray(data)) setClasses(data);
  }, [isSuper, session?.user?.superViewTenantId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    reloadClasses().catch(() => {});
  }, [status, reloadClasses]);

  // Load topics when class is selected
  useEffect(() => {
    if (!classId) { setTopics([]); setTopicId(""); return; }
    fetch(`/api/me/topics?classId=${encodeURIComponent(classId)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TopicRow[]) => {
        if (Array.isArray(data)) setTopics(data);
        setTopicId("");
      })
      .catch(() => {});
  }, [classId]);

  // Sync classId from session (do not auto-set topicId since we moved away from subjectId)
  useEffect(() => {
    if (!session?.user) return;
    if (session.user.classId) setClassId(session.user.classId);
  }, [session?.user]);

  const canPickClass = !isSuper || Boolean(viewTenantId);
  const classReady = Boolean(classId);
  const canSubmitForm = Boolean(classId && topicId && (!isSuper || viewTenantId));

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!canPickClass) return;
    const t = window.setTimeout(() => classSelectRef.current?.focus(), 100);
    return () => window.clearTimeout(t);
  }, [status, canPickClass, viewTenantId, isSuper]);

  async function handleSuperTenantChange(e: ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const t = tenants.find((x) => x.id === id);
    setViewTenantId(id);
    setClassId("");
    setTopicId("");
    setError("");
    await update({
      superViewTenantId: id || null,
      superViewTenantSlug: t?.slug ?? null,
      classId: null,
      subjectId: null,
    });
    if (!id) {
      setClasses([]);
      return;
    }
    const res = await fetch("/api/me/classes");
    const cl = res.ok ? await res.json() : [];
    if (Array.isArray(cl)) setClasses(cl);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (isSuper && !viewTenantId) {
      setError("Choose a school site first.");
      return;
    }
    if (!classId || !topicId) {
      setError("Choose both a class and a topic.");
      return;
    }

    const topic = topics.find((t) => t.id === topicId);
    if (!topic) {
      setError("Invalid topic selected.");
      return;
    }

    setSaving(true);
    try {
      if (isSuper) {
        const t = tenants.find((x) => x.id === viewTenantId);
        await update({
          superViewTenantId: viewTenantId,
          superViewTenantSlug: t?.slug ?? session?.user?.superViewTenantSlug ?? null,
          classId,
          subjectId: topic.subjectId,
        });
      } else {
        await update({ classId, subjectId: topic.subjectId });
      }
      router.push(`/present/${topicId}`);
      router.refresh();
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex justify-center py-20 text-gray-500 font-medium">Loading...</div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10 sm:py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Class &amp; topic</h1>
      {isSuper ? (
        <p className="text-gray-600 mb-6">
          <span className="font-semibold text-indigo-600">Read-only browse.</span> Choose a school,
          class, and topic to view the slides.
        </p>
      ) : (
        <p className="text-gray-600 mb-6">
          Your site:{" "}
          <span className="font-semibold text-indigo-600">{session?.user?.tenantSlug}</span>.{" "}
          Pick your class and the topic you&apos;re teaching — slides open right away.
        </p>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Choose class &amp; topic</p>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm border border-red-200">
            {error}
          </div>
        )}

        {isSuper && (
          <div>
            <label htmlFor="viewTenantId" className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-800">
                0
              </span>
              School site
            </label>
            <select
              id="viewTenantId"
              value={viewTenantId}
              onChange={handleSuperTenantChange}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
            >
              <option value="">Select school…</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="classId" className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-800">
              1
            </span>
            Class
          </label>
          <select
            ref={classSelectRef}
            id="classId"
            value={classId}
            onChange={(e) => { setClassId(e.target.value); setTopicId(""); }}
            required
            disabled={!canPickClass}
            className="w-full px-4 py-2.5 border-2 border-indigo-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white disabled:opacity-50"
          >
            <option value="">{isSuper && !viewTenantId ? "Select a school first…" : "Select class…"}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
                {c.name ? ` — ${c.name}` : ""}
              </option>
            ))}
          </select>
          {classes.length === 0 && canPickClass && (
            <p className="mt-1.5 text-xs text-gray-500">
              No classes yet. Ask an admin to add one under the Admin Panel.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="topicId" className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-1">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                classReady ? "bg-indigo-100 text-indigo-800" : "bg-gray-100 text-gray-400"
              }`}
            >
              2
            </span>
            Topic
          </label>
          <select
            id="topicId"
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            required
            disabled={!classReady}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">
              {!classReady
                ? "Choose a class first…"
                : topics.length === 0
                  ? "No topics for this class yet"
                  : "Select topic…"}
            </option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} — {t.subject.name}
                {t.taught ? " ✓" : ""}
              </option>
            ))}
          </select>
          {classReady && topics.length === 0 && (
            <p className="mt-1.5 text-xs text-gray-500">
              No topics for this class yet. Ask an admin to create topics under the Admin Panel.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving || !canSubmitForm}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-indigo-200 shadow-sm"
        >
          {saving ? "Opening…" : canSubmitForm ? "Start slides →" : "Choose class and topic to continue"}
        </button>
      </form>
    </div>
  );
}
