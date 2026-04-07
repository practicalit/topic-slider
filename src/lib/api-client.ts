/** JSON body shape returned by most API routes on error. */
export type ApiErrorBody = {
  error?: string;
  code?: string;
};

export function errorMessageFromJson(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as ApiErrorBody).error;
    if (typeof e === "string" && e.trim()) return e.trim();
  }
  return fallback;
}

/**
 * Reads a failed Response and returns a user-facing message (uses server `error` when present).
 */
export async function readApiErrorMessage(res: Response, fallback?: string): Promise<string> {
  try {
    const j = (await res.json()) as unknown;
    const fromServer = errorMessageFromJson(j, "");
    if (fromServer) return fromServer;
  } catch {
    /* not JSON */
  }
  if (fallback) return fallback;
  switch (res.status) {
    case 401:
      return "Please sign in again to continue.";
    case 403:
      return "You don’t have permission to do that.";
    case 404:
      return "We couldn’t find that. It may have been removed or you may not have access.";
    case 400:
      return "Something was wrong with the request. Check your choices and try again.";
    case 413:
      return "That file is too large. Try a smaller image or video.";
    default:
      return `Something went wrong (${res.status}). Please try again.`;
  }
}
