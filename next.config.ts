import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Next.js dev blocks WebSocket + some `/_next/*` requests unless the browser host is allowlisted.
 * When you open the app via http://localhost:<port>, set AUTH_URL to that same
 * origin so the hostname is allowed — or set ALLOWED_DEV_ORIGINS to extra hostnames (comma-separated).
 */
function buildAllowedDevOrigins(): string[] | undefined {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  const hosts = new Set<string>();
  const skip = new Set(["localhost", "127.0.0.1"]);

  const list = process.env.ALLOWED_DEV_ORIGINS?.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean) ?? [];
  for (const h of list) {
    if (h && !skip.has(h)) hosts.add(h);
  }

  const authBase = process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (authBase) {
    try {
      const { hostname } = new URL(authBase);
      if (hostname && !skip.has(hostname)) {
        hosts.add(hostname);
      }
    } catch {
      /* ignore */
    }
  }

  if (hosts.size === 0) return undefined;
  return [...hosts];
}

const allowedDevOrigins = buildAllowedDevOrigins();

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  ...(allowedDevOrigins ? { allowedDevOrigins } : {}),
};

export default nextConfig;
