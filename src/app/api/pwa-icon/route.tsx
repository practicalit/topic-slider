import { ImageResponse } from "next/og";

export const runtime = "nodejs";

/**
 * PNG icons for web app manifest (install / splash). Sizes: s=64 … 512 (default 512).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = parseInt(searchParams.get("s") || "512", 10);
  const s = Number.isFinite(raw) ? Math.min(512, Math.max(64, raw)) : 512;
  const fontSize = Math.round(s * 0.28);

  return new ImageResponse(
    (
      <div
        style={{
          width: s,
          height: s,
          display: "flex",
          flexDirection: "column",
          background: "#4f46e5",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: "#ffffff",
            fontSize,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          MK
        </div>
      </div>
    ),
    { width: s, height: s }
  );
}
