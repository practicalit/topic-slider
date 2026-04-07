/** Public URL prefix for files written under `public/uploads/media/`. */
export const UPLOAD_MEDIA_PREFIX = "/uploads/media/";

/** UUID v4 filename + allowed extension (no path segments). */
const UPLOAD_FILENAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpe?g|png|gif|webp|mp4|webm|ogg)$/i;

export function isSafeUploadMediaUrl(pathOrUrl: string): boolean {
  const s = pathOrUrl.trim().split("?")[0];
  if (!s.startsWith(UPLOAD_MEDIA_PREFIX)) return false;
  if (s.includes("..") || s.includes("\\")) return false;
  const name = s.slice(UPLOAD_MEDIA_PREFIX.length);
  return UPLOAD_FILENAME_RE.test(name);
}

export function isUploadImagePath(s: string): boolean {
  return isSafeUploadMediaUrl(s) && /\.(jpe?g|png|gif|webp)$/i.test(s);
}

export function isUploadVideoPath(s: string): boolean {
  return isSafeUploadMediaUrl(s) && /\.(mp4|webm|ogg)$/i.test(s);
}

export const UPLOAD_ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export const UPLOAD_ALLOWED_VIDEO_MIMES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
] as const;

export type UploadKind = "IMAGE" | "VIDEO";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogg",
};

export function extensionForUpload(file: File, kind: UploadKind): string | null {
  const mime = file.type?.toLowerCase() ?? "";
  if (mime && MIME_TO_EXT[mime]) return MIME_TO_EXT[mime];
  const name = file.name?.trim() ?? "";
  const m = /\.([a-z0-9]+)$/i.exec(name);
  if (!m) return null;
  const ext = m[1].toLowerCase();
  if (kind === "IMAGE") {
    if (ext === "jpeg" || ext === "jpg") return "jpg";
    if (["png", "gif", "webp"].includes(ext)) return ext;
    return null;
  }
  if (["mp4", "webm", "ogg"].includes(ext)) return ext;
  return null;
}

export function mimeAllowedForKind(mime: string, ext: string, kind: UploadKind): boolean {
  const m = mime.toLowerCase();
  if (kind === "IMAGE") {
    if (UPLOAD_ALLOWED_IMAGE_MIMES.includes(m as (typeof UPLOAD_ALLOWED_IMAGE_MIMES)[number])) {
      return true;
    }
    return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
  }
  if (UPLOAD_ALLOWED_VIDEO_MIMES.includes(m as (typeof UPLOAD_ALLOWED_VIDEO_MIMES)[number])) {
    return true;
  }
  return ["mp4", "webm", "ogg"].includes(ext);
}

export function defaultMaxImageBytes(): number {
  const n = parseInt(process.env.UPLOAD_MAX_IMAGE_MB ?? "12", 10);
  return Math.min(Math.max(n, 1), 50) * 1024 * 1024;
}

export function defaultMaxVideoBytes(): number {
  const n = parseInt(process.env.UPLOAD_MAX_VIDEO_MB ?? "80", 10);
  return Math.min(Math.max(n, 1), 500) * 1024 * 1024;
}
