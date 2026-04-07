"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { sessionHasTeachingContext } from "@/lib/teaching-context-client";

/** Redirects to /context until class + subject (and super view tenant for SUPER_ADMIN) are set. */
export function TeachingContextGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    if (!sessionHasTeachingContext(session.user)) {
      router.replace("/context");
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="flex justify-center py-20 text-gray-500 font-medium">Loading...</div>
    );
  }

  if (status !== "authenticated" || !session?.user) {
    return (
      <div className="flex justify-center py-20 text-gray-500 font-medium">Loading...</div>
    );
  }

  if (!sessionHasTeachingContext(session.user)) {
    return (
      <div className="flex justify-center py-20 text-gray-500 font-medium">Redirecting...</div>
    );
  }

  return <>{children}</>;
}
