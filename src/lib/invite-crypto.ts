import { randomBytes, randomInt } from "crypto";

export function generateInviteToken(): string {
  return randomBytes(24).toString("hex");
}

/** 6-digit numeric passcode (leading zeros allowed). */
export function generateInvitePasscode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
