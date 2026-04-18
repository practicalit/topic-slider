"use client";

import { useState } from "react";
import { isUploadImagePath } from "@/lib/media-upload";
import type { ContentKind } from "@/types/content";

type Props = {
  kind: ContentKind;
  body: string;
  setBody: (v: string) => void;
  /** Shown instead of window.alert when upload fails */
  onUploadError?: (message: string) => void;
};

export function ContentMediaUpload({ kind, body, setBody, onUploadError }: Props) {
  const [busy, setBusy] = useState(false);

  if (kind !== "IMAGE" && kind !== "VIDEO") return null;

  async function uploadFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("kind", kind);
      const res = await fetch("/api/uploads/media", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Upload failed");
      }
      if (!j.url) throw new Error("Invalid response");
      setBody(j.url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed.";
      if (onUploadError) onUploadError(msg);
      else alert(msg);
    } finally {
      setBusy(false);
    }
  }

  const accept =
    kind === "IMAGE"
      ? "image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
      : "video/mp4,video/webm,video/ogg,.mp4,.webm,.ogg";

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-2 space-y-2">
      <label className="block text-xs font-medium text-gray-700">
        {kind === "IMAGE" ? "Upload picture" : "Upload video file"}
        <input
          type="file"
          accept={accept}
          disabled={busy}
          className="mt-1 block w-full text-sm text-gray-900 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-900 hover:file:bg-gray-50"
          onChange={(e) => void uploadFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {busy && <p className="text-xs text-gray-500">Uploading…</p>}
      {body.trim().startsWith("/uploads/media/") && (
        <p className="text-[11px] text-gray-600">
          Using uploaded file. Paste a URL below to replace it, or choose another file.
        </p>
      )}
    </div>
  );
}

export function isImageBodyPreviewable(body: string): boolean {
  const b = body.trim();
  return b.startsWith("https://") || isUploadImagePath(b);
}
