"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Row = { id: string; code?: string; name?: string };
type TenantRow = { id: string; slug: string; name: string };

export default function ContextPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const isSuper = session?.user?.role === "SUPER_ADMIN";

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [viewTenantId, setViewTenantId] = useState("");
  const [classes, setClasses] = useState<Row[]>([]);
  const [subjects, setSubjects] = useState<Row[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newClassCode, setNewClassCode] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [adminMsg, setAdminMsg] = useState("");
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

  const reloadCatalog = useCallback(async () => {
    if (isSuper && !session?.user?.superViewTenantId) {
      setClasses([]);
      setSubjects([]);
      return;
    }
    const [c, s] = await Promise.all([fetch("/api/me/classes"), fetch("/api/me/subjects")]);
    if (!c.ok || !s.ok) {
      setClasses([]);
      setSubjects([]);
      return;
    }
    const cl = await c.json();
    const su = await s.json();
    if (Array.isArray(cl)) setClasses(cl);
    if (Array.isArray(su)) setSubjects(su);
  }, [isSuper, session?.user?.superViewTenantId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    reloadCatalog().catch(() => {});
  }, [status, reloadCatalog]);

  useEffect(() => {
    if (!session?.user) return;
    if (session.user.classId) setClassId(session.user.classId);
    if (session.user.subjectId) setSubjectId(session.user.subjectId);
  }, [session?.user]);

  const canPickClass = !isSuper || Boolean(viewTenantId);
  const classReady = Boolean(classId);
  const canSubmitForm =
    Boolean(classId && subjectId && (!isSuper || viewTenantId));

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
    setSubjectId("");
    setError("");
    await update({
      superViewTenantId: id || null,
      superViewTenantSlug: t?.slug ?? null,
      classId: null,
      subjectId: null,
    });
    if (!id) {
      setClasses([]);
      setSubjects([]);
      return;
    }
    const [c, s] = await Promise.all([fetch("/api/me/classes"), fetch("/api/me/subjects")]);
    const cl = c.ok ? await c.json() : [];
    const su = s.ok ? await s.json() : [];
    if (Array.isArray(cl)) setClasses(cl);
    if (Array.isArray(su)) setSubjects(su);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (isSuper && !viewTenantId) {
      setError("Choose a school site first.");
      return;
    }
    if (!classId || !subjectId) {
      setError("Choose both a class and a subject.");
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
          subjectId,
        });
      } else {
        await update({ classId, subjectId });
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddClass(e: FormEvent) {
    e.preventDefault();
    setAdminMsg("");
    if (!newClassCode.trim()) return;
    const res = await fetch("/api/admin/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: newClassCode.trim(),
        name: newClassName.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAdminMsg(data.error || "Could not add class");
      return;
    }
    setNewClassCode("");
    setNewClassName("");
    await reloadCatalog();
    setClassId(data.id);
    setAdminMsg("Class added.");
  }

  async function handleAddSubject(e: FormEvent) {
    e.preventDefault();
    setAdminMsg("");
    if (!newSubjectName.trim()) return;
    const res = await fetch("/api/admin/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSubjectName.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAdminMsg(data.error || "Could not add subject");
      return;
    }
    setNewSubjectName("");
    await reloadCatalog();
    setSubjectId(data.id);
    setAdminMsg("Subject added.");
  }

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex justify-center py-20 text-gray-500 font-medium">Loading...</div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10 sm:py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Class &amp; subject</h1>
      {isSuper ? (
        <p className="text-gray-600 mb-2">
          <span className="font-semibold text-indigo-600">Read-only browse.</span> Choose a school, then{" "}
          <strong className="text-gray-800">class</strong> and <strong className="text-gray-800">subject</strong>{" "}
          so topics and the leaderboard match that section.
        </p>
      ) : (
        <p className="text-gray-600 mb-2">
          Your site:{" "}
          <span className="font-semibold text-indigo-600">{session?.user?.tenantSlug}</span>.{" "}
          <strong className="text-gray-800">Start by choosing your class</strong>, then the subject you&apos;re
          teaching.
        </p>
      )}
      <p className="text-sm text-gray-500 mb-6">
        Tip: use <kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-xs font-mono">Tab</kbd>{" "}
        to move through the list, or click the class box first — it opens ready for you.
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Your teaching context</p>

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
            Class <span className="font-normal text-gray-500">— pick this first</span>
          </label>
          <select
            ref={classSelectRef}
            id="classId"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            required
            disabled={!canPickClass}
            aria-describedby="class-hint"
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
          <p id="class-hint" className="mt-1.5 text-xs text-gray-500">
            {classes.length === 0 && canPickClass
              ? "No classes yet. Ask an admin to add one, or use the section below if you are an admin."
              : "Opens focused so you can start here right away."}
          </p>
        </div>

        <div>
          <label htmlFor="subjectId" className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-1">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                classReady ? "bg-indigo-100 text-indigo-800" : "bg-gray-100 text-gray-400"
              }`}
            >
              2
            </span>
            Subject
          </label>
          <select
            id="subjectId"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            required
            disabled={!canPickClass || !classReady}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">
              {!canPickClass
                ? "Select a school first…"
                : !classReady
                  ? "Choose a class first…"
                  : "Select subject…"}
            </option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={saving || !canSubmitForm}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-indigo-200 shadow-sm"
        >
          {saving ? "Saving…" : canSubmitForm ? "Save & go to dashboard" : "Choose class and subject to continue"}
        </button>
      </form>

      {session?.user?.role === "ADMIN" && !isSuper && (
        <div className="mt-8 p-5 rounded-xl border border-indigo-300 bg-indigo-50">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Add class or subject (admin)</h2>
          {adminMsg && <p className="text-xs text-gray-600 mb-3">{adminMsg}</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            <form onSubmit={handleAddClass} className="space-y-2">
              <p className="text-xs font-medium text-gray-800">New class</p>
              <input
                value={newClassCode}
                onChange={(e) => setNewClassCode(e.target.value)}
                placeholder="Code (e.g. 111)"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900"
              />
              <input
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Name (optional)"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900"
              />
              <button
                type="submit"
                className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg border border-indigo-200"
              >
                Add class
              </button>
            </form>
            <form onSubmit={handleAddSubject} className="space-y-2">
              <p className="text-xs font-medium text-gray-800">New subject</p>
              <input
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="e.g. Bible Study"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900"
              />
              <button
                type="submit"
                className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg border border-indigo-200 mt-6"
              >
                Add subject
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
