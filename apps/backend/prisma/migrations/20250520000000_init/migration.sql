-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "ServerType" AS ENUM ('VANILLA', 'PAPER', 'PURPUR', 'FABRIC', 'FORGE', 'NEOFORGE', 'MODPACK');
CREATE TYPE "RuntimeMode" AS ENUM ('NATIVE', 'DOCKER');
CREATE TYPE "ServerStatus" AS ENUM ('INSTALLING', 'STOPPED', 'STARTING', 'RUNNING', 'STOPPING', 'CRASHED');
CREATE TYPE "BackupStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

CREATE TABLE "Server" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "serverType" "ServerType" NOT NULL,
    "minecraftVersion" TEXT NOT NULL,
    "javaVersion" TEXT NOT NULL DEFAULT '21',
    "ramMb" INTEGER NOT NULL,
    "port" INTEGER NOT NULL,
    "status" "ServerStatus" NOT NULL DEFAULT 'INSTALLING',
    "runtimeMode" "RuntimeMode" NOT NULL DEFAULT 'NATIVE',
    "autoRestart" BOOLEAN NOT NULL DEFAULT true,
    "eulaAccepted" BOOLEAN NOT NULL DEFAULT false,
    "dataPath" TEXT NOT NULL,
    "containerId" TEXT,
    "modpackId" INTEGER,
    "modpackFileId" INTEGER,
    "modpackName" TEXT,
    "maxPlayers" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Server_uuid_key" ON "Server"("uuid");
CREATE UNIQUE INDEX "Server_port_key" ON "Server"("port");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Server" ADD CONSTRAINT "Server_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
