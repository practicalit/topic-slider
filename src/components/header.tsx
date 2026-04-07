"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export type HeaderProps = {
  tenantSlug?: string | null;
};

type ContextSummary = {
  siteName: string | null;
  className: string | null;
  subjectName: string | null;
};

function BrandCrossIcon() {
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-300/95 shadow-sm ring-1 ring-white/40 sm:h-8 sm:w-8"
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4"
        fill="currentColor"
        aria-hidden
      >
        <path d="M11 3h2v8h8v2h-8v8h-2v-8H3v-2h8V3z" />
      </svg>
    </span>
  );
}

function ContextPill({
  summary,
  isSuper,
  compact,
}: {
  summary: ContextSummary | null;
  isSuper: boolean;
  compact?: boolean;
}) {
  const pad = compact ? "px-2.5 py-1" : "px-4 py-2";
  const text = compact ? "text-[10px] sm:text-xs" : "text-xs sm:text-sm";

  if (!summary?.siteName) {
    if (isSuper) {
      return (
        <div
          className={`max-w-[min(90vw,24rem)] truncate rounded-full border border-amber-300 bg-amber-100 text-center font-bold text-amber-950 shadow-sm ${pad} ${text}`}
          role="status"
        >
          📍 Select a school in Class &amp; subject
        </div>
      );
    }
    return (
      <div
        className={`max-w-[min(90vw,24rem)] truncate rounded-full border border-white/35 bg-black/25 text-center font-bold text-white shadow-md backdrop-blur-sm ${pad} ${text}`}
        role="status"
      >
        📍 Set class &amp; subject
      </div>
    );
  }

  const classPart = summary.className ?? "Class not set";
  const line = `📍 ${summary.siteName} — ${classPart}`;

  return (
    <div
      className={`max-w-[min(92vw,32rem)] truncate rounded-full border border-white/30 bg-black/25 text-center font-bold uppercase tracking-wide text-white shadow-lg backdrop-blur-sm ${pad} ${text}`}
      title={
        summary.subjectName
          ? `${summary.siteName} · ${summary.className ?? ""} · ${summary.subjectName}`
          : line
      }
      role="status"
      aria-live="polite"
    >
      <span className="normal-case font-bold tracking-normal">{line}</span>
    </div>
  );
}

export function Header({ tenantSlug: tenantSlugOverride }: HeaderProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [ctx, setCtx] = useState<ContextSummary | null>(null);

  const hideChrome =
    pathname === "/login" ||
    pathname === "/join" ||
    pathname === "/system-portal";

  useEffect(() => {
    if (!session?.user || hideChrome) return;
    let cancelled = false;
    fetch("/api/me/context-summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ContextSummary | null) => {
        if (!cancelled && data && typeof data.siteName !== "undefined") {
          setCtx(data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    session?.user?.tenantId,
    session?.user?.classId,
    session?.user?.subjectId,
    session?.user?.superViewTenantId,
    session?.user,
    hideChrome,
  ]);

  if (hideChrome) return null;

  if (status === "loading") {
    return (
      <header className="sticky top-0 z-50 border-b border-white/15 bg-[#5d39f4] backdrop-blur-md">
        <div className="mx-auto h-10 max-w-7xl animate-pulse px-3 sm:px-4 lg:px-6" aria-hidden />
      </header>
    );
  }

  if (!session?.user) return null;

  const isAdmin = session.user.role === "ADMIN";
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  const resolvedSlug =
    tenantSlugOverride !== undefined
      ? tenantSlugOverride
      : isSuperAdmin
        ? (session.user.superViewTenantSlug ?? null)
        : (session.user.tenantSlug ?? null);

  const badgeLabel = resolvedSlug?.trim() || null;

  const links = [
    { href: "/dashboard", label: "Home" },
    { href: "/context", label: "Class & subject" },
    { href: "/present", label: "Present" },
    { href: "/students", label: "Students" },
    { href: "/leaderboard", label: "Leaderboard" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
    ...(isSuperAdmin ? [{ href: "/super", label: "Platform" }] : []),
    { href: "/help", label: "Help" },
  ];

  const roleLabel = session.user.role?.toLowerCase().replaceAll("_", " ") ?? "";

  const navLinkClass = (active: boolean) =>
    `shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors sm:px-2.5 sm:py-1.5 sm:text-sm ${
      active
        ? "bg-black/25 text-white ring-1 ring-white/20"
        : "text-white/95 hover:bg-white/15 hover:text-white"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-white/15 bg-[#5d39f4] shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-[#5d39f4]">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
        {/* One slim row (sm+): logo, inline nav, context (xl+ only — at lg the pill sits below so nav links are not clipped), user + sign out */}
        <div className="flex min-h-[2.5rem] items-center gap-2 py-1.5 sm:min-h-[2.75rem] sm:gap-3 sm:py-2">
          <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              href="/dashboard"
              className="flex shrink-0 items-center gap-1.5 text-white sm:gap-2"
              title="Home"
            >
              <BrandCrossIcon />
              <span className="font-abyssinica hidden leading-tight sm:inline text-sm font-normal md:text-[0.95rem]">
                ማህበረ ቅዱሳን
              </span>
              <span className="text-xs font-bold sm:hidden">MK</span>
            </Link>
            {badgeLabel ? (
              <span
                className="hidden max-w-[4.5rem] truncate rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white sm:inline-flex md:max-w-[6.5rem] md:text-[10px]"
                title={`Site key: ${badgeLabel}`}
              >
                {badgeLabel}
              </span>
            ) : null}
          </div>

          <nav
            className="hidden min-w-0 flex-1 items-center justify-start gap-0.5 overflow-x-auto overflow-y-visible [-ms-overflow-style:none] [scrollbar-width:none] sm:flex sm:[&::-webkit-scrollbar]:h-1 sm:[&::-webkit-scrollbar-thumb]:rounded-full sm:[&::-webkit-scrollbar-thumb]:bg-white/35 sm:hover:[&::-webkit-scrollbar-thumb]:bg-white/50"
            aria-label="Main"
          >
            {links.map((link) => {
              const active =
                pathname === link.href ||
                (link.href === "/dashboard" && pathname === "/") ||
                (link.href === "/help" && pathname.startsWith("/help"));
              return (
                <Link key={link.href} href={link.href} className={navLinkClass(active)}>
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden min-w-0 max-w-md shrink-0 justify-center px-1 xl:flex xl:flex-none">
            <ContextPill summary={ctx} isSuper={isSuperAdmin} compact />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
            <span className="hidden max-w-[10rem] truncate text-xs text-white sm:inline md:max-w-[13rem]">
              <span className="font-semibold">{session.user.name || "Signed in"}</span>
              <span className="text-white/75"> ({roleLabel})</span>
            </span>
            <button
              type="button"
              onClick={async () => {
                await signOut({ redirect: false });
                window.location.assign("/login");
              }}
              className="rounded-md border border-white/25 bg-black/25 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-black/35 sm:px-2.5 sm:py-1.5"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* sm–lg (and xl+ uses row above): context under bar so nav row stays wide enough for all tabs */}
        <div className="hidden justify-center border-t border-white/10 py-1 sm:flex xl:hidden">
          <ContextPill summary={ctx} isSuper={isSuperAdmin} compact />
        </div>

        {/* Small screens: nav + context */}
        <div className="border-t border-white/10 pb-1.5 pt-1 sm:hidden">
          <nav className="flex flex-wrap justify-center gap-0.5" aria-label="Main">
            {links.map((link) => {
              const active =
                pathname === link.href ||
                (link.href === "/dashboard" && pathname === "/") ||
                (link.href === "/help" && pathname.startsWith("/help"));
              return (
                <Link key={link.href} href={link.href} className={navLinkClass(active)}>
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-1 flex justify-center px-1">
            <ContextPill summary={ctx} isSuper={isSuperAdmin} compact />
          </div>
        </div>
      </div>
    </header>
  );
}
