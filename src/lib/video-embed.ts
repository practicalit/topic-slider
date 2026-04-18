import { isUploadVideoPath } from "@/lib/media-upload";

export type VideoEmbedResolved =
  | { kind: "youtube"; id: string }
  | { kind: "vimeo"; id: string }
  | { kind: "dailymotion"; id: string }
  | { kind: "native"; src: string }
  | { kind: "external"; href: string };

function extractYoutubeId(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{6,32}$/.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) {
        const id = u.pathname.split("/")[2];
        return id && /^[\w-]{6,32}$/.test(id) ? id : null;
      }
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/")[2];
        return id && /^[\w-]{6,32}$/.test(id) ? id : null;
      }
      const v = u.searchParams.get("v");
      if (v && /^[\w-]{6,32}$/.test(v)) return v;
    }
  } catch {
    return null;
  }
  return null;
}

function extractVimeoId(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (!host.includes("vimeo.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const id = parts[parts.length - 1];
    if (id && /^\d+$/.test(id)) return id;
  } catch {
    return null;
  }
  return null;
}

function extractDailymotionId(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (!u.hostname.includes("dailymotion.com")) return null;
    const m = u.pathname.match(/\/video\/([^/?]+)/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

function isDirectVideoUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return /\.(mp4|webm|ogg)(\?.*)?$/i.test(u.pathname);
  } catch {
    return false;
  }
}

/** Resolve a user-pasted video URL to a safe embed strategy (no arbitrary iframe src). */
export function resolveVideoEmbed(raw: string): VideoEmbedResolved {
  const url = raw.trim();
  if (!url) return { kind: "external", href: "" };

  if (isUploadVideoPath(url)) {
    return { kind: "native", src: url };
  }

  const yt = extractYoutubeId(url);
  if (yt) return { kind: "youtube", id: yt };

  const vm = extractVimeoId(url);
  if (vm) return { kind: "vimeo", id: vm };

  const dm = extractDailymotionId(url);
  if (dm) return { kind: "dailymotion", id: dm };

  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { kind: "external", href: url };
    }
    if (isDirectVideoUrl(url)) {
      return { kind: "native", src: url };
    }
    return { kind: "external", href: url };
  } catch {
    return { kind: "external", href: url };
  }
}
