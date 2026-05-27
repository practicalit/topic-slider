-- CreateTable: student-class enrollment (many-to-many)
CREATE TABLE "StudentClassEnrollment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentClassEnrollment_pkey" PRIMARY KEY ("id")
);

-- Migrate existing Student.classId rows into the new enrollment table
INSERT INTO "StudentClassEnrollment" ("id", "tenantId", "classId", "studentId", "createdAt")
SELECT gen_random_uuid()::text, "tenantId", "classId", "id", NOW()
FROM "Student"
WHERE "classId" IS NOT NULL AND "deletedAt" IS NULL;

-- CreateIndex
CREATE INDEX "StudentClassEnrollment_tenantId_idx" ON "StudentClassEnrollment"("tenantId");
CREATE INDEX "StudentClassEnrollment_classId_idx" ON "StudentClassEnrollment"("classId");
CREATE INDEX "StudentClassEnrollment_studentId_idx" ON "StudentClassEnrollment"("studentId");
CREATE UNIQUE INDEX "StudentClassEnrollment_classId_studentId_key" ON "StudentClassEnrollment"("classId", "studentId");

-- AddForeignKey
ALTER TABLE "StudentClassEnrollment" ADD CONSTRAINT "StudentClassEnrollment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentClassEnrollment" ADD CONSTRAINT "StudentClassEnrollment_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentClassEnrollment" ADD CONSTRAINT "StudentClassEnrollment_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey and index for old Student.classId column
ALTER TABLE "Student" DROP CONSTRAINT "Student_classId_fkey";
DROP INDEX "Student_tenantId_classId_idx";

-- DropColumn: classId from Student
ALTER TABLE "Student" DROP COLUMN "classId";

-- AlterTable: remove default on ClassTopicProgress.updatedAt (cleanup)
ALTER TABLE "ClassTopicProgress" ALTER COLUMN "updatedAt" DROP DEFAULT;
