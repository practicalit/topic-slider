/** Bounds for one-time volunteer invite link + passcode lifetime (hours). */

export const MIN_INVITE_HOURS = 1;
const ABSOLUTE_MAX_HOURS = 168; // 1 week cap

export type InviteExpiryBounds = {
  minExpiresHours: number;
  maxExpiresHours: number;
  defaultExpiresHours: number;
};

export function inviteExpiryBounds(): InviteExpiryBounds {
  const maxRaw = parseInt(process.env.VOLUNTEER_INVITE_MAX_HOURS ?? "72", 10);
  const maxExpiresHours = Number.isFinite(maxRaw)
    ? Math.max(MIN_INVITE_HOURS, Math.min(ABSOLUTE_MAX_HOURS, maxRaw))
    : 72;

  const defaultRaw = parseInt(process.env.VOLUNTEER_INVITE_DEFAULT_HOURS ?? "6", 10);
  const defaultExpiresHours = Number.isFinite(defaultRaw)
    ? Math.max(MIN_INVITE_HOURS, Math.min(maxExpiresHours, defaultRaw))
    : 6;

  return {
    minExpiresHours: MIN_INVITE_HOURS,
    maxExpiresHours,
    defaultExpiresHours,
  };
}

/** Coerce API/body value to a whole number of hours within bounds. */
export function clampExpiresInHours(raw: unknown, bounds: InviteExpiryBounds): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? parseFloat(raw) : NaN;
  if (!Number.isFinite(n)) return bounds.defaultExpiresHours;
  const rounded = Math.round(n);
  return Math.min(bounds.maxExpiresHours, Math.max(bounds.minExpiresHours, rounded));
}
