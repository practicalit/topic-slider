import type { ContentKind } from "@/types/content";
import { isUploadImagePath, isUploadVideoPath } from "@/lib/media-upload";

const KINDS: ContentKind[] = ["TEXT", "SLIDE", "IMAGE", "VIDEO"];

export function parseContentKind(v: unknown): ContentKind {
  if (typeof v === "string" && KINDS.includes(v as ContentKind)) {
    return v as ContentKind;
  }
  return "TEXT";
}

export function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateContentPayload(kind: ContentKind, title: string, body: string): string | null {
  const t = title.trim();
  const b = body.trim();
  if (!t) return "Title is required";
  if (kind === "IMAGE") {
    if (!b) return "Image URL or upload is required";
    if (isHttpsUrl(b) || isUploadImagePath(b)) return null;
    return "Use an https:// image URL or upload a picture (JPEG, PNG, GIF, WebP)";
  }
  if (kind === "VIDEO") {
    if (!b) return "Video URL or upload is required";
    if (isHttpUrl(b) || isUploadVideoPath(b)) return null;
    return "Enter a valid http(s) video link or upload MP4, WebM, or Ogg";
  }
  if (kind === "TEXT" || kind === "SLIDE") {
    if (!b) return "Body text is required";
    return null;
  }
  return null;
}
