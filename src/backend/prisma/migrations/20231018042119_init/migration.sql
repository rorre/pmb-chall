-- CreateTable
CREATE TABLE "User" (
    "username" TEXT NOT NULL PRIMARY KEY,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "whatsapp" TEXT,
    "instagram" TEXT,
    "line" TEXT
);

-- CreateTable
CREATE TABLE "Matches" (
    "firstUsername" TEXT NOT NULL,
    "secondUsername" TEXT NOT NULL,
    "mutual" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("firstUsername", "secondUsername")
);
