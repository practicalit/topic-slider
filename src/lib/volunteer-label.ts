/** Sanitize volunteer name from admin invite form (letters, numbers, common punctuation). */
export function sanitizeVolunteerLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/\s+/g, " ");
  if (t.length < 1 || t.length > 80) return null;
  if (!/^[\p{L}\p{N}\s'\-.,]+$/u.test(t)) return null;
  return t;
}
