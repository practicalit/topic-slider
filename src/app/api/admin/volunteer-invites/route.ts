import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditForSessionFireAndForget } from "@/lib/audit-log";
import {
  SUPER_ADMIN_WRITE_FORBIDDEN_CODE,
  SUPER_ADMIN_WRITE_FORBIDDEN_MESSAGE,
  UNAUTHORIZED_CODE,
  UNAUTHORIZED_MESSAGE,
  VOLUNTEER_FORBIDDEN_CODE,
  VOLUNTEER_FORBIDDEN_MESSAGE,
  type ScopedSession,
} from "@/lib/scope";
import { generateInvitePasscode, generateInviteToken } from "@/lib/invite-crypto";
import { sanitizeVolunteerLabel } from "@/lib/volunteer-label";
import { clampExpiresInHours, inviteExpiryBounds } from "@/lib/volunteer-invite-ttl";

/**
 * Invite links must open in the volunteer's browser. Use AUTH_URL when set so links
 * match how users reach the app (required for phones on LAN when admins use localhost).
 * Otherwise fall back to the request origin, then localhost.
 */
function appBaseUrl(req: NextRequest): string {
  const env = (process.env.AUTH_URL || process.env.NEXTAUTH_URL)?.replace(/\/$/, "") ?? "";
  const origin = req.nextUrl.origin.replace(/\/$/, "");

  if (process.env.NODE_ENV !== "production") {
    if (env) return env;
    if (origin.startsWith("http://") || origin.startsWith("https://")) {
      return origin;
    }
    return "http://localhost:3001";
  }

  if (env) return env;
  if (origin.startsWith("http://") || origin.startsWith("https://")) {
    return origin;
  }
  return "http://localhost:3001";
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: UNAUTHORIZED_MESSAGE, code: UNAUTHORIZED_CODE }, { status: 401 });
  }
  if (session.user.role === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: SUPER_ADMIN_WRITE_FORBIDDEN_MESSAGE, code: SUPER_ADMIN_WRITE_FORBIDDEN_CODE },
      { status: 403 }
    );
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: VOLUNTEER_FORBIDDEN_MESSAGE, code: VOLUNTEER_FORBIDDEN_CODE },
      { status: 403 }
    );
  }

  return NextResponse.json(inviteExpiryBounds());
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: UNAUTHORIZED_MESSAGE, code: UNAUTHORIZED_CODE }, { status: 401 });
  }
  if (session.user.role === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: SUPER_ADMIN_WRITE_FORBIDDEN_MESSAGE, code: SUPER_ADMIN_WRITE_FORBIDDEN_CODE },
      { status: 403 }
    );
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: VOLUNTEER_FORBIDDEN_MESSAGE, code: VOLUNTEER_FORBIDDEN_CODE },
      { status: 403 }
    );
  }

  const body = await req.json();
  const userId = body.userId as string | undefined;
  const volunteerLabel = sanitizeVolunteerLabel(body.volunteerName);
  const bounds = inviteExpiryBounds();
  const expiresInHours = clampExpiresInHours(body.expiresInHours, bounds);

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (!volunteerLabel) {
    return NextResponse.json(
      {
        error:
          "Volunteer name is required (1–80 characters: letters, numbers, spaces, and . , ' -).",
      },
      { status: 400 }
    );
  }

  const volunteer = await prisma.user.findFirst({
    where: {
      id: userId,
      role: "VOLUNTEER",
      tenantId: session.user.tenantId,
    },
  });
  if (!volunteer) {
    return NextResponse.json({ error: "Volunteer user not found" }, { status: 404 });
  }

  const token = generateInviteToken();
  const passcode = generateInvitePasscode();
  const passcodeHash = await bcrypt.hash(passcode, 10);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  const invite = await prisma.volunteerInvite.create({
    data: {
      token,
      passcodeHash,
      telegramChatId: null,
      volunteerLabel,
      userId: volunteer.id,
      expiresAt,
      createdById: session.user.id ?? null,
    },
  });

  const joinUrl = `${appBaseUrl(req)}/join?t=${encodeURIComponent(token)}`;

  auditForSessionFireAndForget(session as ScopedSession, {
    action: "VOLUNTEER_INVITE_CREATE",
    entityType: "VolunteerInvite",
    entityId: invite.id,
    summary: `One-time invite for ${volunteer.username} (${volunteerLabel})`,
    metadata: {
      volunteerUserId: volunteer.id,
      volunteerUsername: volunteer.username,
      volunteerLabel,
      expiresInHours,
    },
  });

  return NextResponse.json({
    ok: true,
    joinUrl,
    passcode,
    volunteerLabel,
    expiresAt: expiresAt.toISOString(),
    expiresInHours,
  });
}
