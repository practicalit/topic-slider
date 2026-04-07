/** Slugs reserved for internal use (platform tenant, future aliases). */
export const RESERVED_TENANT_SLUGS = new Set(["__platform__", "platform"]);

export function normalizeTenantSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Returns an error message or null if valid. */
export function validateNewTenantSlug(slug: string): string | null {
  const s = normalizeTenantSlug(slug);
  if (!s || s.length > 64) {
    return "Slug is required (max 64 characters).";
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(s)) {
    return "Slug must start with a letter or digit and contain only lowercase letters, digits, and hyphens.";
  }
  if (RESERVED_TENANT_SLUGS.has(s)) {
    return "This slug is reserved.";
  }
  return null;
}
