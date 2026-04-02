import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user?.role === "ADMIN";

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to MK Educator
        </h1>
        <p className="text-lg text-gray-600">
          Classroom presentation and quiz tool for substitute teachers and volunteers
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/present"
          className="group block p-6 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-indigo-300 transition-all"
        >
          <div className="text-3xl mb-3">📖</div>
          <h2 className="text-xl font-semibold text-gray-900 group-hover:text-indigo-600">
            Present a Topic
          </h2>
          <p className="text-gray-500 mt-2">
            Choose an untaught topic and walk through the content slides with students
          </p>
        </Link>

        <Link
          href="/students"
          className="group block p-6 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-indigo-300 transition-all"
        >
          <div className="text-3xl mb-3">👨‍🎓</div>
          <h2 className="text-xl font-semibold text-gray-900 group-hover:text-indigo-600">
            Manage Students
          </h2>
          <p className="text-gray-500 mt-2">
            Add or view students in the classroom
          </p>
        </Link>

        <Link
          href="/leaderboard"
          className="group block p-6 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-indigo-300 transition-all"
        >
          <div className="text-3xl mb-3">⭐</div>
          <h2 className="text-xl font-semibold text-gray-900 group-hover:text-indigo-600">
            Leaderboard
          </h2>
          <p className="text-gray-500 mt-2">
            See who has the most stars from quizzes
          </p>
        </Link>

        {isAdmin && (
          <Link
            href="/admin"
            className="group block p-6 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-indigo-300 transition-all"
          >
            <div className="text-3xl mb-3">⚙️</div>
            <h2 className="text-xl font-semibold text-gray-900 group-hover:text-indigo-600">
              Admin Panel
            </h2>
            <p className="text-gray-500 mt-2">
              Create and manage topics, content, and quizzes
            </p>
          </Link>
        )}
      </div>
    </div>
  );
}
