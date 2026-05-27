-- CreateTable: per-class taught tracking (replaces Topic.classId + Topic.taught)
CREATE TABLE "ClassTopicProgress" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "taught" BOOLEAN NOT NULL DEFAULT false,
    "taughtAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassTopicProgress_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ClassTopicProgress" ADD CONSTRAINT "ClassTopicProgress_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassTopicProgress" ADD CONSTRAINT "ClassTopicProgress_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassTopicProgress" ADD CONSTRAINT "ClassTopicProgress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "ClassTopicProgress_classId_topicId_key" ON "ClassTopicProgress"("classId", "topicId");
CREATE INDEX "ClassTopicProgress_tenantId_idx" ON "ClassTopicProgress"("tenantId");
CREATE INDEX "ClassTopicProgress_classId_idx" ON "ClassTopicProgress"("classId");
CREATE INDEX "ClassTopicProgress_topicId_idx" ON "ClassTopicProgress"("topicId");

-- Migrate existing taught data: create a progress row for every topic (preserving taught status per its current class)
INSERT INTO "ClassTopicProgress" ("id", "tenantId", "classId", "topicId", "taught", "taughtAt", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "tenantId",
    "classId",
    "id",
    "taught",
    "taughtAt",
    NOW(),
    NOW()
FROM "Topic";

-- DropIndex (old compound index included classId)
DROP INDEX IF EXISTS "Topic_tenantId_classId_subjectId_idx";

-- CreateIndex (new index without classId)
CREATE INDEX "Topic_tenantId_subjectId_idx" ON "Topic"("tenantId", "subjectId");

-- DropForeignKey
ALTER TABLE "Topic" DROP CONSTRAINT IF EXISTS "Topic_classId_fkey";

-- AlterTable: remove classId, taught, taughtAt from Topic
ALTER TABLE "Topic" DROP COLUMN "classId";
ALTER TABLE "Topic" DROP COLUMN "taught";
ALTER TABLE "Topic" DROP COLUMN "taughtAt";
