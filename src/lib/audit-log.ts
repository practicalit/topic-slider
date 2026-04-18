import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ScopedSession } from "@/lib/scope";
import { sessionDisplayName } from "@/lib/user-display";

export async function writeAudit(entry: {
  tenantId: string | null;
  actorUserId: string | null;
  actorLabel: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        actorUserId: entry.actorUserId,
        actorLabel: entry.actorLabel,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        summary: entry.summary ?? null,
        metadata:
          entry.metadata != null
            ? (entry.metadata as Prisma.InputJsonValue)
            : undefined,
      },
    });
  } catch (e) {
    console.error("[audit-log]", e);
  }
}

export function auditFireAndForget(
  entry: Parameters<typeof writeAudit>[0]
): void {
  void writeAudit(entry);
}

/** Resolve actor label from DB so audits stay accurate if displayName changes later. */
export async function writeAuditForSession(
  session: ScopedSession,
  partial: Omit<
    Parameters<typeof writeAudit>[0],
    "tenantId" | "actorUserId" | "actorLabel"
  >
): Promise<void> {
  let actorLabel: string | null = session.user.id;
  try {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { username: true, displayName: true, role: true },
    });
    if (u) actorLabel = sessionDisplayName(u);
  } catch {
    /* keep id */
  }
  await writeAudit({
    tenantId: session.user.tenantId,
    actorUserId: session.user.id,
    actorLabel,
    ...partial,
  });
}

export function auditForSessionFireAndForget(
  session: ScopedSession,
  partial: Omit<
    Parameters<typeof writeAudit>[0],
    "tenantId" | "actorUserId" | "actorLabel"
  >
): void {
  void writeAuditForSession(session, partial);
}
