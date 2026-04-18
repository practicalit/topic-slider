"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { TeachingContextGuard } from "@/components/teaching-context-guard";
import { AccessRestricted } from "@/components/access-restricted";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { readApiErrorMessage } from "@/lib/api-client";
import {
  SUPER_ADMIN_WRITE_FORBIDDEN_MESSAGE,
  VOLUNTEER_FORBIDDEN_MESSAGE,
} from "@/lib/scope";

type AuditRow = {
  id: string;
  actorLabel: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string | null;
  metadata: unknown;
  createdAt: string;
};

export default function AdminAuditPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (session?.user?.role !== "ADMIN") {
      setLoading(false);
      return;
    }

    (async () => {
      const r = await fetch("/api/admin/audit-log?limit=100");
      if (!r.ok) {
        setErr(await readApiErrorMessage(r, "Could not load activity."));
        setLoading(false);
        return;
      }
      const data = (await r.json()) as AuditRow[];
      setRows(Array.isArray(data) ? data : []);
      setLoading(false);
    })().catch(() => {
      setLoading(false);
      setErr("Could not load activity.");
    });
  }, [session?.user?.role, sessionStatus]);

  if (sessionStatus === "loading") {
    return (
      <TeachingContextGuard>
        <div className="flex justify-center py-20 text-gray-500">Loading…</div>
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
          hint={isSuper ? undefined : "Only school administrators can view the activity log."}
        />
      </TeachingContextGuard>
    );
  }

  return (
    <TeachingContextGuard>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <ApiErrorAlert message={err} className="mb-4" onDismiss={err ? () => setErr("") : undefined} />
        <Link
          href="/admin"
          className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to Admin
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Activity log</h1>
        <p className="text-sm text-gray-600 mb-6">
          Recent changes in your school site: topics, content, quizzes, Jeopardy boards, and volunteer
          invites. Timestamps are stored in UTC and shown in your browser&apos;s local time.
        </p>

        {loading ? (
          <p className="text-gray-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-500 text-sm">No activity recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Who</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap tabular-nums">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium max-w-[10rem] truncate">
                      {r.actorLabel ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="font-mono text-xs">{r.action}</span>
                      <span className="text-gray-400 text-xs block">
                        {r.entityType}
                        {r.entityId ? ` · ${r.entityId.slice(0, 8)}…` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-md">{r.summary ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TeachingContextGuard>
  );
}
