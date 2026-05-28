"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AccessRestricted } from "@/components/access-restricted";
import { SUPER_ADMIN_WRITE_FORBIDDEN_MESSAGE, VOLUNTEER_FORBIDDEN_MESSAGE } from "@/lib/scope";

interface ClassRow {
  id: string;
  code?: string;
  name?: string;
}

interface EnrolledStudent {
  id: string;
  firstName: string;
  lastName: string;
  stars: { id: string; points: number; topicId: string }[];
}

interface SearchStudent {
  id: string;
  firstName: string;
  lastName: string;
}

export default function AdminStudentsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (sessionStatus === "unauthenticated") router.replace("/login");
  }, [sessionStatus, router]);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState("");
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Add new student
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [addMsg, setAddMsg] = useState("");
  const [addError, setAddError] = useState("");

  // Enroll existing
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchStudent[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch classes once
  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    fetch("/api/me/classes")
      .then((r) => r.json())
      .then((d: unknown) => {
        const arr = Array.isArray(d) ? (d as ClassRow[]) : [];
        setClasses(arr);
        if (arr.length === 1) setClassId(arr[0].id);
      })
      .catch(() => {});
  }, [sessionStatus]);

  const fetchEnrolled = useCallback((cid: string) => {
    if (!cid) return;
    setLoadingStudents(true);
    fetch(`/api/admin/students?classId=${encodeURIComponent(cid)}`)
      .then((r) => r.json())
      .then((d: unknown) => {
        setEnrolledStudents(Array.isArray(d) ? (d as EnrolledStudent[]) : []);
      })
      .catch(() => setEnrolledStudents([]))
      .finally(() => setLoadingStudents(false));
  }, []);

  useEffect(() => {
    if (classId) fetchEnrolled(classId);
    else setEnrolledStudents([]);
  }, [classId, fetchEnrolled]);

  // Debounced search for existing students not in this class
  useEffect(() => {
    if (!searchQuery.trim() || !classId) {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/students/search?q=${encodeURIComponent(searchQuery.trim())}&classId=${encodeURIComponent(classId)}`
        );
        const data = (await res.json()) as unknown;
        setSearchResults(Array.isArray(data) ? (data as SearchStudent[]) : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery, classId]);

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    setAddMsg("");
    setAddError("");
    if (!firstName.trim() || !lastName.trim() || !classId) return;
    const res = await fetch("/api/admin/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, firstName: firstName.trim(), lastName: lastName.trim() }),
    });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setAddError(d.error ?? "Could not add student.");
      return;
    }
    setFirstName("");
    setLastName("");
    setAddMsg("Student added and enrolled.");
    fetchEnrolled(classId);
  }

  async function handleEnrollExisting(studentId: string) {
    await fetch(`/api/admin/students/${studentId}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId }),
    });
    setSearchQuery("");
    setSearchResults([]);
    fetchEnrolled(classId);
  }

  async function handleUnenroll(studentId: string, name: string) {
    if (!confirm(`Remove ${name} from this class?`)) return;
    await fetch(
      `/api/admin/students/${studentId}/enroll?classId=${encodeURIComponent(classId)}`,
      { method: "DELETE" }
    );
    fetchEnrolled(classId);
  }

  if (sessionStatus === "loading") {
    return <div className="flex justify-center py-20 text-gray-500">Loading…</div>;
  }

  if (!session?.user || session.user.role !== "ADMIN") {
    const isSuper = session?.user?.role === "SUPER_ADMIN";
    return (
      <AccessRestricted
        title={isSuper ? "View-only for platform admins" : "School admin only"}
        description={isSuper ? SUPER_ADMIN_WRITE_FORBIDDEN_MESSAGE : VOLUNTEER_FORBIDDEN_MESSAGE}
      />
    );
  }

  const selectedClass = classes.find((c) => c.id === classId);
  const classLabel = selectedClass
    ? `${selectedClass.code ?? ""}${selectedClass.name ? ` — ${selectedClass.name}` : ""}`.trim()
    : "";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back link */}
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          ← Back to Admin Panel
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Student Enrollment</h1>
      <p className="text-sm text-gray-600 mb-6">
        Select a class to see enrolled students, add new students, or enroll existing ones.
        Students can belong to multiple classes.
      </p>

      {/* Class picker */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <label className="block text-sm font-semibold text-gray-800 mb-2">Class</label>
        <select
          value={classId}
          onChange={(e) => { setClassId(e.target.value); setAddMsg(""); setAddError(""); }}
          className="w-full sm:w-72 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="">Select a class…</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}{c.name ? ` — ${c.name}` : ""}
            </option>
          ))}
        </select>
      </div>

      {!classId ? (
        <p className="text-gray-400 text-center py-12 text-sm">Pick a class above to get started.</p>
      ) : (
        <div className="space-y-6">
          {/* ── Add new student ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Add a new student</h2>
            <p className="text-xs text-gray-500 mb-4">
              Creates a brand-new student record and enrolls them in{" "}
              <span className="font-medium text-gray-700">{classLabel}</span>.
            </p>

            {addMsg && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-3">
                {addMsg}
              </p>
            )}
            {addError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                {addError}
              </p>
            )}

            <form onSubmit={(e) => void handleAddStudent(e)} className="flex flex-col sm:flex-row gap-2">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                required
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                required
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                type="submit"
                disabled={!firstName.trim() || !lastName.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg whitespace-nowrap"
              >
                Add &amp; enroll
              </button>
            </form>
          </div>

          {/* ── Enroll existing student ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Enroll an existing student</h2>
            <p className="text-xs text-gray-500 mb-4">
              Search for a student who already exists in your school but isn&apos;t yet in{" "}
              <span className="font-medium text-gray-700">{classLabel}</span>.
            </p>

            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name…"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none mb-2"
            />

            {searchLoading && (
              <p className="text-xs text-gray-400 py-2">Searching…</p>
            )}

            {!searchLoading && searchResults.length > 0 && (
              <ul className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                {searchResults.map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                    <span className="text-sm text-gray-900">
                      {s.firstName} {s.lastName}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleEnrollExisting(s.id)}
                      className="text-sm font-medium text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-md border border-emerald-200"
                    >
                      Enroll
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!searchLoading && searchQuery.trim() && searchResults.length === 0 && (
              <p className="text-xs text-gray-400 py-2">
                No students found outside this class matching &ldquo;{searchQuery}&rdquo;.
              </p>
            )}
          </div>

          {/* ── Enrolled students ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">
                Enrolled in {classLabel}
              </h2>
              {!loadingStudents && (
                <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5 font-medium">
                  {enrolledStudents.length} student{enrolledStudents.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {loadingStudents ? (
              <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
            ) : enrolledStudents.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No students enrolled yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stars
                    </th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {enrolledStudents.map((s) => {
                    const totalStars = s.stars.reduce((sum, st) => sum + st.points, 0);
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {s.firstName} {s.lastName}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {totalStars > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              ⭐ {totalStars}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              void handleUnenroll(s.id, `${s.firstName} ${s.lastName}`)
                            }
                            className="text-xs font-medium text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md border border-red-200"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
