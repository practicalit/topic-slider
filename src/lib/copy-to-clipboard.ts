/**
 * Copy text to the clipboard. Uses the async Clipboard API when possible,
 * then falls back to a hidden textarea + execCommand (works on many http:// LAN URLs).
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* try fallback */
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
