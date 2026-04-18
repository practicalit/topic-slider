import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import {
  UPLOAD_MEDIA_PREFIX,
  defaultMaxImageBytes,
  defaultMaxVideoBytes,
  extensionForUpload,
  mimeAllowedForKind,
  type UploadKind,
} from "@/lib/media-upload";
import { forbidSuperAdminSchoolWrite, requireAdmin, requireAuth } from "@/lib/scope";

export const runtime = "nodejs";

function parseKind(v: unknown): UploadKind | null {
  if (v === "IMAGE" || v === "VIDEO") return v;
  return null;
}

export async function POST(req: NextRequest) {
  const authz = await requireAuth();
  if (!authz.ok) return authz.res;
  const readOnly = forbidSuperAdminSchoolWrite(authz.session);
  if (readOnly) return readOnly;
  const forbidden = requireAdmin(authz.session);
  if (forbidden) return forbidden;

  const formData = await req.formData();
  const kind = parseKind(formData.get("kind"));
  const file = formData.get("file");

  if (!kind) {
    return NextResponse.json({ error: "kind must be IMAGE or VIDEO" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const ext = extensionForUpload(file, kind);
  if (!ext || !EXT_MATCHES_KIND(ext, kind)) {
    return NextResponse.json(
      {
        error:
          kind === "IMAGE"
            ? "Use JPEG, PNG, GIF, or WebP."
            : "Use MP4, WebM, or Ogg video.",
      },
      { status: 400 }
    );
  }

  if (!mimeAllowedForKind(file.type ?? "", ext, kind)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }

  const maxBytes = kind === "IMAGE" ? defaultMaxImageBytes() : defaultMaxVideoBytes();
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `File too large (max ${Math.round(maxBytes / (1024 * 1024))} MB)` },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads", "media");
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${ext}`;
  const diskPath = path.join(dir, filename);
  await writeFile(diskPath, buffer);

  const url = `${UPLOAD_MEDIA_PREFIX}${filename}`;
  return NextResponse.json({ url });
}

function EXT_MATCHES_KIND(ext: string, kind: UploadKind): boolean {
  if (kind === "IMAGE") return ["jpg", "png", "gif", "webp"].includes(ext);
  return ["mp4", "webm", "ogg"].includes(ext);
}
