"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export function NavBar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session || pathname === "/login") return null;

  const isAdmin = session.user?.role === "ADMIN";

  const links = [
    { href: "/", label: "Home" },
    { href: "/present", label: "Present" },
    { href: "/students", label: "Students" },
    { href: "/leaderboard", label: "Leaderboard" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <nav className="bg-indigo-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-1">
            <span className="text-xl font-bold mr-6">✝️ ማህበረ ቅዱሳን</span>
            <div className="flex gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? "bg-indigo-700 text-white"
                      : "text-indigo-100 hover:bg-indigo-500"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-indigo-200">
              {session.user?.name} ({session.user?.role?.toLowerCase()})
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="bg-indigo-700 hover:bg-indigo-800 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
