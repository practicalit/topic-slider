-- CreateTable
CREATE TABLE "BibleVerse" (
    "id" TEXT NOT NULL,
    "verse" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BibleVerse_pkey" PRIMARY KEY ("id")
);
