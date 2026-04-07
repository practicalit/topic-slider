"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { TeachingContextGuard } from "@/components/teaching-context-guard";
import { AccessRestricted } from "@/components/access-restricted";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { errorMessageFromJson, readApiErrorMessage } from "@/lib/api-client";
import {
  SUPER_ADMIN_WRITE_FORBIDDEN_MESSAGE,
  VOLUNTEER_FORBIDDEN_MESSAGE,
} from "@/lib/scope";

type ClassRow = { id: string; code: string; name: string | null; deletedAt?: string };
type SubjectRow = { id: string; name: string; deletedAt?: string };
type StudentRow = {
  id: string;
  firstName: string;
  lastName: string;
  deletedAt: string;
  classId: string;
  schoolClass: { code: string; deletedAt: string | null };
};

type ArchivePayload = {
  classes: { active: ClassRow[]; archived: ClassRow[] };
  subjects: { active: SubjectRow[]; archived: SubjectRow[] };
  students: { archived: StudentRow[] };
};

export default function AdminArchivePage() {
  const { data: session, status: sessionStatus } = useSession();
  const [data, setData] = useState<ArchivePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tenantConfirm, setTenantConfirm] = useState("");
  const [tenantMsg, setTenantMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch("/api/admin/archive");
    if (!res.ok) {
      setData(null);
      setLoading(false);
      setErr(await readApiErrorMessage(res, "Could not load archive data."));
      return;
    }
    const json = (await res.json()) as ArchivePayload;
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (sessionStatus !== "loading" && session?.user?.role === "ADMIN") {
      load().catch(() => setLoading(false));
    }
    if (sessionStatus !== "loading" && session?.user?.role !== "ADMIN") {
      setLoading(false);
    }
  }, [session?.user?.role, sessionStatus, load]);

  async function archiveClass(id: string, code: string) {
    if (!confirm(`Archive class ${code}? Topics and students must be cleared first.`)) return;
    setErr(null);
    const res = await fetch(`/api/admin/classes/${id}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(errorMessageFromJson(j, "Archive failed."));
      return;
    }
    load();
  }

  async function restoreClass(id: string) {
    setErr(null);
    const res = await fetch(`/api/admin/classes/${id}/restore`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(errorMessageFromJson(j, "Restore failed."));
      return;
    }
    load();
  }

  async function archiveSubject(id: string, name: string) {
    if (!confirm(`Archive subject “${name}”? All topics using it must be removed first.`)) return;
    setErr(null);
    const res = await fetch(`/api/admin/subjects/${id}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(errorMessageFromJson(j, "Archive failed."));
      return;
    }
    load();
  }

  async function restoreSubject(id: string) {
    setErr(null);
    const res = await fetch(`/api/admin/subjects/${id}/restore`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(errorMessageFromJson(j, "Restore failed."));
      return;
    }
    load();
  }

  async function restoreStudent(id: string) {
    setErr(null);
    const res = await fetch(`/api/admin/students/${id}/restore`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(errorMessageFromJson(j, "Restore failed."));
      return;
    }
    load();
  }

  async function archiveTenant(e: React.FormEvent) {
    e.preventDefault();
    setTenantMsg(null);
    const slug = session?.user?.tenantSlug;
    if (!slug) return;
    if (!confirm("This logs everyone out of the site until an operator restores it with the secret. Continue?")) {
      return;
    }
    const res = await fetch("/api/admin/tenant/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmSlug: tenantConfirm }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTenantMsg(errorMessageFromJson(j, "Archive failed."));
      return;
    }
    setTenantMsg(
      `Archived. Save tenantId: ${j.tenantId}. Restore with POST /api/system/tenant-restore (see .env.example).`
    );
    setTenantConfirm("");
  }

  if (sessionStatus === "loading") {
    return (
      <TeachingContextGuard>
        <div className="flex justify-center py-20 text-gray-500 font-medium">Loading...</div>
      </TeachingContextGuard>
    );
  }

  if (!session?.user || session.user.role !== "ADMIN") {
    const isSuper = session?.user?.role === "SUPER_ADMIN";
    return (
      <TeachingContextGuard>
        <AccessRestricted
          title={isSuper ? "View-only for platform admins" : "School admin only"}
          description={isSuper ? SUPER_ADMIN_WRITE_FORBIDDEN_MESSAGE : VOLUNTEER_FORBIDDEN_MESSAGE}
          hint={
            isSuper
              ? undefined
              : "Archiving and restoring classes is limited to school administrators."
          }
        />
      </TeachingContextGuard>
    );
  }

  return (
    <TeachingContextGuard>
      {loading ? (
        <div className="flex justify-center py-20 text-gray-500 font-medium">Loading...</div>
      ) : (
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Archive & restore</h1>
              <p className="text-sm text-gray-600 mt-1">
                Soft-delete classes, subjects, and students. Nothing is permanently removed here.
              </p>
            </div>
            <Link
              href="/admin"
              className="text-sm text-indigo-600 font-medium hover:underline shrink-0"
            >
              ← Admin home
            </Link>
          </div>

          <ApiErrorAlert
            message={err ?? ""}
            className="mb-4"
            onDismiss={err ? () => setErr(null) : undefined}
          />

          {data && (
            <div className="space-y-10">
              <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Classes</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                      Active
                    </h3>
                    {data.classes.active.length === 0 ? (
                      <p className="text-sm text-gray-500">None</p>
                    ) : (
                      <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                        {data.classes.active.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                          >
                            <span className="text-gray-900">
                              {c.code}
                              {c.name ? ` — ${c.name}` : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() => archiveClass(c.id, c.code)}
                              className="text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded text-xs font-medium"
                            >
                              Archive
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                      Archived
                    </h3>
                    {data.classes.archived.length === 0 ? (
                      <p className="text-sm text-gray-500">None</p>
                    ) : (
                      <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                        {data.classes.archived.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                          >
                            <span className="text-gray-800">
                              {c.code}
                              {c.name ? ` — ${c.name}` : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() => restoreClass(c.id)}
                              className="text-indigo-600 bg-indigo-50 hover:bg-gray-100 px-2 py-1 rounded text-xs font-medium border border-indigo-200"
                            >
                              Restore
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Subjects</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                      Active
                    </h3>
                    {data.subjects.active.length === 0 ? (
                      <p className="text-sm text-gray-500">None</p>
                    ) : (
                      <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                        {data.subjects.active.map((s) => (
                          <li
                            key={s.id}
                            className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                          >
                            <span className="text-gray-900">{s.name}</span>
                            <button
                              type="button"
                              onClick={() => archiveSubject(s.id, s.name)}
                              className="text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded text-xs font-medium"
                            >
                              Archive
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                      Archived
                    </h3>
                    {data.subjects.archived.length === 0 ? (
                      <p className="text-sm text-gray-500">None</p>
                    ) : (
                      <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                        {data.subjects.archived.map((s) => (
                          <li
                            key={s.id}
                            className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                          >
                            <span className="text-gray-800">{s.name}</span>
                            <button
                              type="button"
                              onClick={() => restoreSubject(s.id)}
                              className="text-indigo-600 bg-indigo-50 hover:bg-gray-100 px-2 py-1 rounded text-xs font-medium border border-indigo-200"
                            >
                              Restore
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Archived students</h2>
                <p className="text-sm text-gray-600 mb-3">
                  Students are archived from the Students page. Restore here if needed (class must be
                  active).
                </p>
                {data.students.archived.length === 0 ? (
                  <p className="text-sm text-gray-500">None</p>
                ) : (
                  <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                    {data.students.archived.map((st) => (
                      <li
                        key={st.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <div>
                          <span className="text-gray-900 font-medium">
                            {st.firstName} {st.lastName}
                          </span>
                          <span className="text-gray-600 ml-2">
                            Class {st.schoolClass.code}
                            {st.schoolClass.deletedAt ? " (class archived)" : ""}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => restoreStudent(st.id)}
                          disabled={!!st.schoolClass.deletedAt}
                          className="text-indigo-600 bg-indigo-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1 rounded text-xs font-medium border border-indigo-200 self-start sm:self-auto"
                        >
                          Restore
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="bg-red-50/80 rounded-xl border border-red-200 p-6">
                <h2 className="text-lg font-semibold text-red-900 mb-2">Archive entire site</h2>
                <p className="text-sm text-red-900/80 mb-4">
                  No one can log in until an operator calls{" "}
                  <code className="text-xs bg-white/80 px-1 rounded">POST /api/system/tenant-restore</code>{" "}
                  with <code className="text-xs bg-white/80 px-1 rounded">ARCHIVE_RESTORE_SECRET</code> and{" "}
                  <code className="text-xs bg-white/80 px-1 rounded">tenantId</code>. Copy the tenant id from
                  the response.
                </p>
                <form onSubmit={archiveTenant} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-medium text-red-900/80 mb-1">
                      Type site slug to confirm:{" "}
                      <span className="font-mono">{session?.user?.tenantSlug ?? "…"}</span>
                    </label>
                    <input
                      value={tenantConfirm}
                      onChange={(e) => setTenantConfirm(e.target.value)}
                      className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm"
                      placeholder="slug"
                      autoComplete="off"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-800"
                  >
                    Archive site
                  </button>
                </form>
                {tenantMsg && (
                  <p className="mt-3 text-sm text-red-900 whitespace-pre-wrap">{tenantMsg}</p>
                )}
              </section>
            </div>
          )}
        </div>
      )}
    </TeachingContextGuard>
  );
}
