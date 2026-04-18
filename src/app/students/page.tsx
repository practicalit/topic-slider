"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function StudentsPage() {
  const { data: session, status } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(true);

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
    fetchStudents();
  }

  async function handleDeleteStudent(id: string) {
    if (
      !confirm(
        "Archive this student? They will be hidden from lists; an admin can restore from Admin → Archive & restore."
      )
    )
      return;
    await fetch(`/api/students/${id}`, { method: "DELETE" });
    fetchStudents();
  }

  return (
    <TeachingContextGuard>
      {loading ? (
        <div className="flex justify-center py-20 text-gray-500">Loading...</div>
      ) : (
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Students</h1>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Student</h2>
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

          <StudentBulkImport onImported={fetchStudents} />

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {students.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No students yet. Add one above.</p>
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
                          onClick={() => handleDeleteStudent(student.id)}
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
