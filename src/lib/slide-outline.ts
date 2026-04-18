import type { ContentKind } from "@/types/content";

/** Strip common markdown for a plain-text snippet. */
export function stripMarkdownForSnippet(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~]{1,2}([^*_~]+)[*_~]{1,2}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function slideSnippetText(body: string, kind: ContentKind | undefined): string {
  const k = kind ?? "TEXT";
  if (k === "IMAGE") return "Picture";
  if (k === "VIDEO") {
    const u = body.trim();
    if (!u) return "Video";
    return u.length > 72 ? `${u.slice(0, 69)}…` : u;
  }
  const plain = stripMarkdownForSnippet(body);
  if (!plain) return "—";
  return plain.length > 90 ? `${plain.slice(0, 87)}…` : plain;
}

export function contentKindShort(kind: ContentKind | undefined): string {
  switch (kind ?? "TEXT") {
    case "SLIDE":
      return "Slide";
    case "IMAGE":
      return "Image";
    case "VIDEO":
      return "Video";
    default:
      return "Text";
  }
}
