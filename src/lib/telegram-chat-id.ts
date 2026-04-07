/** Normalize Telegram chat_id input (private user id is usually a positive integer string). */
export function parseTelegramChatId(input: string): string | null {
  const s = input.trim().replace(/\s/g, "");
  if (!s) return null;
  if (!/^-?\d+$/.test(s)) return null;
  return s;
}
