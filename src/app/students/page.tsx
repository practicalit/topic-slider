"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { TeachingContextGuard } from "@/components/teaching-context-guard";
import { StudentBulkImport } from "@/components/student-bulk-import";
import { sessionHasTeachingContext } from "@/lib/teaching-context-client";

interface Student {
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

export default function StudentsPage() {
  const { data: session, status } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(true);

  // Enroll existing student
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchStudent[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const classId = session?.user?.classId;

  const fetchStudents = useCallback(async () => {
    if (status !== "authenticated" || !session?.user || !sessionHasTeachingContext(session.user)) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/students");
      const data = (await res.json()) as unknown;
      setStudents(Array.isArray(data) ? (data as Student[]) : []);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [status, session?.user]);

  useEffect(() => {
    void fetchStudents();
  }, [fetchStudents]);

  // Debounced search for existing students not yet in this class
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!searchQuery.trim() || !classId) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/students/search?q=${encodeURIComponent(searchQuery.trim())}&classId=${encodeURIComponent(classId)}`
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
    if (!firstName.trim() || !lastName.trim()) return;

    await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName }),
    });

    setFirstName("");
    setLastName("");
    void fetchStudents();
  }

  async function handleEnrollExisting(studentId: string) {
    await fetch(`/api/students/${studentId}/enroll`, { method: "POST" });
    setSearchQuery("");
    setSearchResults([]);
    void fetchStudents();
  }

  async function handleUnenrollStudent(id: string) {
    if (
      !confirm(
        "Remove this student from the class? They will still exist in other classes they are enrolled in."
      )
    )
      return;
    await fetch(`/api/students/${id}`, { method: "DELETE" });
    void fetchStudents();
  }

  return (
    <TeachingContextGuard>
      {loading ? (
        <div className="flex justify-center py-20 text-gray-500">Loading...</div>
      ) : (
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Students</h1>

          {/* Add new student */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Student</h2>
            <form onSubmit={handleAddStudent} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                required
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
              />
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                required
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                Add Student
              </button>
            </form>
          </div>

          {/* Enroll existing student */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Enroll Existing Student</h2>
            <p className="text-sm text-gray-500 mb-3">
              Search students from other classes and add them to this class.
            </p>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name…"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
            />
            {searchLoading && (
              <p className="text-sm text-gray-400 mt-2">Searching…</p>
            )}
            {!searchLoading && searchResults.length > 0 && (
              <ul className="mt-2 border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                {searchResults.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between px-4 py-2 hover:bg-gray-50"
                  >
                    <span className="text-gray-900">
                      {s.firstName} {s.lastName}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleEnrollExisting(s.id)}
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                    >
                      Enroll
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!searchLoading && searchQuery.trim() && searchResults.length === 0 && (
              <p className="text-sm text-gray-400 mt-2">No matching students found outside this class.</p>
            )}
          </div>

          <StudentBulkImport onImported={fetchStudents} />

          {/* Enrolled students list */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-4">
            {students.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No students enrolled. Add one above.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Stars
                    </th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-900 font-medium">
                        {student.firstName} {student.lastName}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-yellow-500">
                          {"⭐".repeat(
                            Math.min(
                              student.stars.reduce((sum, s) => sum + s.points, 0),
                              5
                            )
                          )}
                        </span>
                        <span className="text-gray-600 ml-1 text-sm">
                          {student.stars.reduce((sum, s) => sum + s.points, 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => void handleUnenrollStudent(student.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </TeachingContextGuard>
  );
}
