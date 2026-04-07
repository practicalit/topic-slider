import { prisma } from "@/lib/prisma";

export async function countTopicsForClass(tenantId: string, classId: string) {
  return prisma.topic.count({ where: { tenantId, classId } });
}

export async function countTopicsForSubject(tenantId: string, subjectId: string) {
  return prisma.topic.count({ where: { tenantId, subjectId } });
}

export async function countActiveStudentsForClass(classId: string) {
  return prisma.student.count({
    where: { classId, deletedAt: null },
  });
}
