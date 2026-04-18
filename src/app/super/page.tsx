"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AccessRestricted } from "@/components/access-restricted";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { errorMessageFromJson, readApiErrorMessage } from "@/lib/api-client";
import { SUPER_ADMIN_ROUTE_MESSAGE } from "@/lib/scope";
type TenantRow = { id: string; slug: string; name: string; createdAt: string };
type AdminRow = { id: string; username: string; createdAt: string };

export default function SuperAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [createMsg, setCreateMsg] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminsByTenant, setAdminsByTenant] = useState<Record<string, AdminRow[]>>({});
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminMsg, setAdminMsg] = useState("");

  const reloadTenants = useCallback(async () => {
    setLoadError("");
    const res = await fetch("/api/super/tenants");
    if (res.status === 403) {
      setLoadError(await readApiErrorMessage(res, SUPER_ADMIN_ROUTE_MESSAGE));
      return;
    }
    if (!res.ok) {
      setLoadError(await readApiErrorMessage(res, "Could not load sites."));
      return;
    }
    const data = await res.json();
    if (Array.isArray(data)) setTenants(data);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (session?.user?.role !== "SUPER_ADMIN") return;
    reloadTenants().catch(() => setLoadError("Could not load sites."));
  }, [status, session?.user?.role, reloadTenants]);

  async function loadAdmins(tenantId: string) {
    const res = await fetch(`/api/super/tenants/${tenantId}/admins`);
    if (!res.ok) return;
    const data = await res.json();
    if (data?.admins && Array.isArray(data.admins)) {
      setAdminsByTenant((prev) => ({ ...prev, [tenantId]: data.admins }));
    }
  }

  function toggleExpand(id: string) {
    setAdminMsg("");
    setAdminUser("");
    setAdminPass("");
    setExpandedId((prev) => {
      const closing = prev === id;
      if (!closing) {
        void loadAdmins(id);
      }
      return closing ? null : id;
    });
  }

  async function handleCreateSite(e: FormEvent) {
    e.preventDefault();
    setCreateMsg("");
    const res = await fetch("/api/super/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: newSlug, name: newName }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCreateMsg(errorMessageFromJson(data, "Could not create site."));
      return;
    }
    setNewSlug("");
    setNewName("");
    setCreateMsg(`Created site “${data.name}” (${data.slug}). School admins can add classes and subjects after signing in.`);
    await reloadTenants();
  }

  async function handleAddAdmin(e: FormEvent, tenantId: string) {
    e.preventDefault();
    setAdminMsg("");
    const res = await fetch(`/api/super/tenants/${tenantId}/admins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: adminUser, password: adminPass }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAdminMsg(errorMessageFromJson(data, "Could not create admin."));
      return;
    }
    setAdminUser("");
    setAdminPass("");
    setAdminMsg(`Admin “${data.username}” created. They sign in on the main login page using this site’s slug.`);
    await loadAdmins(tenantId);
  }

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex justify-center py-20 text-gray-500 font-medium">Loading…</div>
    );
  }

  if (session?.user?.role !== "SUPER_ADMIN") {
    return (
      <AccessRestricted
        title="Platform administrators only"
        description={SUPER_ADMIN_ROUTE_MESSAGE}
        hint="School admins and volunteers should use the main app from the home page."
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Platform administration</h1>
      <p className="text-gray-600 mb-8">
        Create school sites (for example DC1, DC2) and their site administrators. To <strong>browse</strong>{" "}
        classes, topics, and students, use <strong>Class &amp; subject</strong> in the nav and pick a school
        (read-only). Only site admins can change classroom data.
      </p>

      <ApiErrorAlert
        message={loadError}
        className="mb-6"
        onDismiss={loadError ? () => setLoadError("") : undefined}
      />

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add school site</h2>
        <form onSubmit={handleCreateSite} className="space-y-4">
          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-gray-900 mb-1">
              Slug (login &amp; URL key)
            </label>
            <input
              id="slug"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="e.g. dc1"
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-gray-900 bg-white"
            />
          </div>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-1">
              Display name
            </label>
            <input
              id="name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. DC1"
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-gray-900 bg-white"
            />
          </div>
          {createMsg && (
            <p className="text-sm text-indigo-600 font-medium">{createMsg}</p>
          )}
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg border border-indigo-200"
          >
            Create site
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">School sites</h2>
        {tenants.length === 0 ? (
          <p className="text-gray-600 text-sm">No sites yet. Create one above.</p>
        ) : (
          <ul className="space-y-3">
            {tenants.map((t) => (
              <li
                key={t.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(t.id)}
                  className="w-full text-left px-5 py-4 flex justify-between items-center hover:bg-gray-100/30 transition-colors"
                >
                  <span>
                    <span className="font-semibold text-gray-900">{t.name}</span>
                    <span className="text-gray-600 text-sm ml-2">({t.slug})</span>
                  </span>
                  <span className="text-indigo-600 text-sm font-medium">
                    {expandedId === t.id ? "Hide" : "Manage admins"}
                  </span>
                </button>
                {expandedId === t.id && (
                  <div className="px-5 pb-5 pt-0 border-t border-gray-200 space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                        Site admins
                      </p>
                      {(adminsByTenant[t.id] ?? []).length === 0 ? (
                        <p className="text-sm text-gray-600">No admins yet.</p>
                      ) : (
                        <ul className="text-sm text-gray-900 space-y-1">
                          {(adminsByTenant[t.id] ?? []).map((a) => (
                            <li key={a.id}>
                              <code className="bg-gray-100 px-1.5 py-0.5 rounded">{a.username}</code>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <form
                      onSubmit={(e) => handleAddAdmin(e, t.id)}
                      className="space-y-3 pt-2 border-t border-gray-200/60"
                    >
                      <p className="text-sm font-medium text-gray-900">Add site admin</p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <input
                          value={adminUser}
                          onChange={(e) => setAdminUser(e.target.value)}
                          placeholder="Username"
                          required
                          autoComplete="off"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                        />
                        <input
                          type="password"
                          value={adminPass}
                          onChange={(e) => setAdminPass(e.target.value)}
                          placeholder="Password (min 8 chars)"
                          required
                          minLength={8}
                          autoComplete="new-password"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                        />
                      </div>
                      {adminMsg && (
                        <p className="text-xs text-indigo-600 font-medium">{adminMsg}</p>
                      )}
                      <button
                        type="submit"
                        className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg border border-indigo-200"
                      >
                        Create admin
                      </button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
