"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AccessRestricted } from "@/components/access-restricted";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { useToast } from "@/components/toast-provider";
import { errorMessageFromJson, readApiErrorMessage } from "@/lib/api-client";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import {
  SUPER_ADMIN_WRITE_FORBIDDEN_MESSAGE,
  VOLUNTEER_FORBIDDEN_MESSAGE,
} from "@/lib/scope";

interface Volunteer {
  id: string;
  username: string;
}

type InviteTtlConfig = {
  minExpiresHours: number;
  maxExpiresHours: number;
  defaultExpiresHours: number;
};

const FALLBACK_TTL: InviteTtlConfig = {
  minExpiresHours: 1,
  maxExpiresHours: 72,
  defaultExpiresHours: 6,
};

export default function VolunteerAccessPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [userId, setUserId] = useState("");
  const [volunteerName, setVolunteerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [ttlConfig, setTtlConfig] = useState<InviteTtlConfig>(FALLBACK_TTL);
  const [expiresInHours, setExpiresInHours] = useState(FALLBACK_TTL.defaultExpiresHours);
  const [result, setResult] = useState<{
    joinUrl: string;
    passcode: string;
    volunteerLabel: string;
    expiresAt: string;
    expiresInHours?: number;
  } | null>(null);
  const [err, setErr] = useState("");
  const ttlFromServerApplied = useRef(false);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!session || session.user?.role !== "ADMIN") {
      setLoading(false);
      return;
    }

    (async () => {
      const [volRes, ttlRes] = await Promise.all([
        fetch("/api/admin/volunteers"),
        fetch("/api/admin/volunteer-invites"),
      ]);

      if (ttlRes.ok) {
        const ttl = (await ttlRes.json()) as Partial<InviteTtlConfig>;
        if (
          typeof ttl.minExpiresHours === "number" &&
          typeof ttl.maxExpiresHours === "number" &&
          typeof ttl.defaultExpiresHours === "number"
        ) {
          const next: InviteTtlConfig = {
            minExpiresHours: ttl.minExpiresHours,
            maxExpiresHours: ttl.maxExpiresHours,
            defaultExpiresHours: ttl.defaultExpiresHours,
          };
          setTtlConfig(next);
          if (!ttlFromServerApplied.current) {
            ttlFromServerApplied.current = true;
            setExpiresInHours(
              Math.min(
                next.maxExpiresHours,
                Math.max(next.minExpiresHours, next.defaultExpiresHours)
              )
            );
          } else {
            setExpiresInHours((h) =>
              Math.min(next.maxExpiresHours, Math.max(next.minExpiresHours, h))
            );
          }
        }
      }

      if (!volRes.ok) {
        setLoading(false);
        setErr(await readApiErrorMessage(volRes, "Could not load volunteers."));
        return;
      }
      const data = (await volRes.json()) as Volunteer[];
      setVolunteers(Array.isArray(data) ? data : []);
      if (data.length > 0) setUserId(data[0].id);
      setLoading(false);
    })().catch(() => {
      setLoading(false);
      setErr("Could not load volunteers.");
    });
  }, [session, sessionStatus]);

  async function handleCopy(kind: "link" | "pass", text: string) {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      showToast(kind === "link" ? "Link copied to clipboard." : "Passcode copied to clipboard.");
    } else {
      showToast("Could not copy automatically. Select the text and copy manually.", "error");
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setResult(null);
    setGenerating(true);

    const res = await fetch("/api/admin/volunteer-invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, volunteerName, expiresInHours }),
    });

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      setGenerating(false);
      setErr(res.ok ? "Invalid response from server." : `Request failed (${res.status}).`);
      return;
    }
    setGenerating(false);

    if (!res.ok) {
      setErr(errorMessageFromJson(data, "Request failed."));
      return;
    }

    const body = data as Record<string, unknown>;
    const joinUrl = typeof body.joinUrl === "string" ? body.joinUrl : "";
    const passcode = typeof body.passcode === "string" ? body.passcode : "";
    const expiresAt = typeof body.expiresAt === "string" ? body.expiresAt : "";
    const volunteerLabel = typeof body.volunteerLabel === "string" ? body.volunteerLabel : "";
    const expiresInHoursRes =
      typeof body.expiresInHours === "number" && Number.isFinite(body.expiresInHours)
        ? body.expiresInHours
        : undefined;
    if (!joinUrl || !passcode) {
      setErr("Invalid response from server.");
      return;
    }

    setResult({ joinUrl, passcode, expiresAt, volunteerLabel, expiresInHours: expiresInHoursRes });
    showToast("Invite generated. Copy the link and passcode to send to the volunteer.");
  }

  if (sessionStatus === "loading") {
    return (
      <div className="flex justify-center py-20 text-gray-500">Loading…</div>
    );
  }

  if (sessionStatus === "unauthenticated") {
    router.replace("/login");
    return (
      <div className="flex justify-center py-20 text-gray-500">Redirecting to sign in…</div>
    );
  }

  if (!session?.user || session.user.role !== "ADMIN") {
    const isSuper = session?.user?.role === "SUPER_ADMIN";
    return (
      <AccessRestricted
        title={isSuper ? "View-only for platform admins" : "School admin only"}
        description={isSuper ? SUPER_ADMIN_WRITE_FORBIDDEN_MESSAGE : VOLUNTEER_FORBIDDEN_MESSAGE}
        hint={
          isSuper
            ? undefined
            : "Only a school administrator can create one-time invites for volunteers."
        }
      />
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <ApiErrorAlert message={err} className="mb-4" onDismiss={err ? () => setErr("") : undefined} />
      <Link
        href="/admin"
        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-6 inline-block"
      >
        ← Back to Admin
      </Link>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Volunteer one-time invite</h1>
      <p className="text-gray-600 text-sm mb-6">
        Choose the volunteer account, enter their <strong>name</strong> (shown as{" "}
        <code className="bg-gray-100 px-1 rounded text-xs">volunteer+name</code> when they sign in), set
        how long the invite stays valid, then generate a single-use link and passcode. Copy both and send
        by SMS, WhatsApp, email, or any channel.
      </p>

      {loading ? (
        <p className="text-gray-600">Loading volunteers…</p>
      ) : volunteers.length === 0 ? (
        <p className="text-red-600 text-sm">No volunteer users. Seed or create a volunteer first.</p>
      ) : (
        <form onSubmit={handleGenerate} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Volunteer account</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              aria-label="Volunteer account to invite"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-gray-900"
            >
              {volunteers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.username}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Volunteer name (for sign-in label)
            </label>
            <input
              type="text"
              value={volunteerName}
              onChange={(e) => setVolunteerName(e.target.value)}
              required
              maxLength={80}
              placeholder="e.g. Maria or Abebe"
              autoComplete="name"
              aria-describedby="volunteer-name-hint"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-gray-900"
            />
            <p id="volunteer-name-hint" className="text-xs text-gray-500 mt-1">
              Letters, numbers, spaces, and <code className="bg-gray-50 px-0.5">.&apos;-</code> only. They
              appear as <strong>volunteer+</strong>
              <em>name</em> in the app after they use this invite.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor="invite-ttl" className="block text-sm font-medium text-gray-900">
                Invite expires in
              </label>
              <span className="text-sm font-semibold tabular-nums text-indigo-700">
                {expiresInHours} hour{expiresInHours === 1 ? "" : "s"}
              </span>
            </div>
            <input
              id="invite-ttl"
              type="range"
              min={ttlConfig.minExpiresHours}
              max={ttlConfig.maxExpiresHours}
              step={1}
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(Number(e.target.value))}
              aria-valuemin={ttlConfig.minExpiresHours}
              aria-valuemax={ttlConfig.maxExpiresHours}
              aria-valuenow={expiresInHours}
              aria-valuetext={`${expiresInHours} hours`}
              className="w-full h-2 accent-indigo-600 cursor-pointer"
            />
            <p className="text-xs text-gray-500 mt-1">
              Default {ttlConfig.defaultExpiresHours}h (set by your server). Range{" "}
              {ttlConfig.minExpiresHours}–{ttlConfig.maxExpiresHours}h.
            </p>
          </div>

          <button
            type="submit"
            disabled={generating}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-50 border border-indigo-200"
          >
            {generating ? "Generating…" : "Generate invite"}
          </button>
        </form>
      )}

      {result && (
        <div className="mt-8 p-5 rounded-xl border border-indigo-300 bg-indigo-50 text-sm text-gray-900 space-y-4">
          <p className="font-semibold text-indigo-900">
            Copy and send to <span className="font-mono">volunteer+{result.volunteerLabel}</span>
          </p>
          <div className="space-y-2">
            <span className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
              Link
            </span>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
              <code className="flex-1 text-xs break-all bg-white border border-gray-200 rounded-lg px-3 py-2">
                {result.joinUrl}
              </code>
              <button
                type="button"
                onClick={() => void handleCopy("link", result.joinUrl)}
                className="shrink-0 text-sm font-semibold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 border border-indigo-200 rounded-lg px-3 py-2"
                aria-label="Copy invite link to clipboard"
              >
                Copy link
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <span className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
              Passcode
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-xl tracking-[0.35em] font-mono bg-white border border-gray-200 rounded-lg px-3 py-2">
                {result.passcode}
              </code>
              <button
                type="button"
                onClick={() => void handleCopy("pass", result.passcode)}
                className="text-sm font-semibold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 border border-indigo-200 rounded-lg px-3 py-2"
                aria-label="Copy passcode to clipboard"
              >
                Copy passcode
              </button>
            </div>
          </div>
          {result.expiresAt && (
            <p className="text-xs text-gray-600 pt-1 border-t border-indigo-200">
              Expires: {new Date(result.expiresAt).toLocaleString()}
              {result.expiresInHours != null && (
                <span className="block text-gray-500 mt-0.5">
                  ({result.expiresInHours} hour{result.expiresInHours === 1 ? "" : "s"} from when you
                  generated it)
                </span>
              )}
            </p>
          )}
        </div>
      )}

      <div className="mt-10 text-xs text-gray-600 space-y-2">
        <p>
          <strong>Link must match your site URL:</strong> set{" "}
          <code className="bg-gray-100 px-1 rounded">AUTH_URL</code> in{" "}
          <code className="bg-gray-100 px-1 rounded">.env</code> to the same base URL volunteers use
          (production domain or your LAN address and port).
        </p>
      </div>
    </div>
  );
}
