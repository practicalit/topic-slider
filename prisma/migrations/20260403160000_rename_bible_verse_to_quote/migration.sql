-- Rename table BibleVerse -> Quote
ALTER TABLE "BibleVerse" RENAME TO "Quote";

-- Rename column verse -> quote
ALTER TABLE "Quote" RENAME COLUMN "verse" TO "quote";

-- Rename primary key constraint
ALTER TABLE "Quote" RENAME CONSTRAINT "BibleVerse_pkey" TO "Quote_pkey";
