import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user?.role === "ADMIN";
  const isSuper = session.user?.role === "SUPER_ADMIN";
  const hasContext =
    Boolean(session.user?.classId && session.user?.subjectId) &&
    (!isSuper || Boolean(session.user?.superViewTenantId));

  const cardClass =
    "group block p-6 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-indigo-300 transition-all";

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {!hasContext && (
        <div className="mb-8 p-4 rounded-xl border border-indigo-200 bg-indigo-50/80 text-gray-800">
          <p className="font-semibold">
            {isSuper ? "Choose a school site, class, and subject (read-only)" : "Choose your class and subject"}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {isSuper
              ? "Platform admins browse any school’s data in view-only mode. Use Platform in the nav to manage sites."
              : "Topics, students, and the leaderboard are scoped to one class and subject at a time."}
          </p>
          <Link href="/context" className="inline-block mt-3 text-sm font-semibold text-indigo-600 hover:underline">
            Open class &amp; subject →
          </Link>
        </div>
      )}

      <div className="mb-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="border-l-4 border-indigo-600 pl-4 sm:pl-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Dashboard</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Welcome to Mahibere Kidusan — ማህበረ ቅዱሳን
          </h1>
          <p className="mt-3 max-w-2xl text-base text-gray-600 sm:text-lg">
            Classroom presentation and quiz tool for substitute teachers and volunteers. Your active site
            and class appear in the header.
          </p>
          {isSuper && !session.user?.superViewTenantSlug && (
            <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block">
              Choose a school under <strong>Class &amp; subject</strong> to browse in read-only mode.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/present" className={cardClass}>
          <div className="text-3xl mb-3">📖</div>
          <h2 className="text-xl font-semibold text-gray-900 group-hover:text-indigo-600">Present a Topic</h2>
          <p className="text-gray-500 mt-2">
            Choose an untaught topic and walk through the content slides with students
          </p>
        </Link>

        <Link href="/students" className={cardClass}>
          <div className="text-3xl mb-3">👨‍🎓</div>
          <h2 className="text-xl font-semibold text-gray-900 group-hover:text-indigo-600">Manage Students</h2>
          <p className="text-gray-500 mt-2">Add or view students in the classroom</p>
        </Link>

        <Link href="/leaderboard" className={cardClass}>
          <div className="text-3xl mb-3">⭐</div>
          <h2 className="text-xl font-semibold text-gray-900 group-hover:text-indigo-600">Leaderboard</h2>
          <p className="text-gray-500 mt-2">See who has the most stars from quizzes</p>
        </Link>

        {isAdmin && (
          <Link href="/admin" className={cardClass}>
            <div className="text-3xl mb-3">⚙️</div>
            <h2 className="text-xl font-semibold text-gray-900 group-hover:text-indigo-600">Admin Panel</h2>
            <p className="text-gray-500 mt-2">Create and manage topics, content, and quizzes</p>
          </Link>
        )}

        <Link href="/help" className={cardClass}>
          <div className="text-3xl mb-3">📘</div>
          <h2 className="text-xl font-semibold text-gray-900 group-hover:text-indigo-600">Help &amp; user guide</h2>
          <p className="text-gray-500 mt-2">
            How to use the app for volunteers, school admins, and platform operators — plus about this site
          </p>
        </Link>
      </div>
    </div>
  );
}
