import { prisma } from "@/lib/prisma";

export async function countTopicsForSubject(tenantId: string, subjectId: string) {
  return prisma.topic.count({ where: { tenantId, subjectId } });
}

export async function countActiveStudentsForClass(classId: string) {
  return prisma.studentClassEnrollment.count({
    where: { classId, student: { deletedAt: null } },
  });
}
