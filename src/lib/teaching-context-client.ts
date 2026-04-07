/**
 * Client-side check aligned with server `requireTeachingContext` in scope.ts.
 */
export function sessionHasTeachingContext(user: {
  role?: string;
  classId?: string | null;
  subjectId?: string | null;
  superViewTenantId?: string | null;
} | null | undefined): boolean {
  if (!user?.classId || !user.subjectId) return false;
  if (user.role === "SUPER_ADMIN") {
    const tid = user.superViewTenantId;
    return typeof tid === "string" && tid.length > 0;
  }
  return true;
}
