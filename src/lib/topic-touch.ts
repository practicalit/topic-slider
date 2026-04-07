import { prisma } from "@/lib/prisma";

/** Bumps topic.updatedAt and records who last changed the topic or its nested content. */
export async function touchTopicUpdatedBy(topicId: string, userId: string): Promise<void> {
  await prisma.topic.update({
    where: { id: topicId },
    data: { updatedById: userId },
  });
}
