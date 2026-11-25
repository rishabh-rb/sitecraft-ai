-- Align databases created from the earlier initialization with schema.prisma.
-- Preserve existing rows and leave enum columns alone on already-aligned installations.
BEGIN;

DO $$ BEGIN CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "GenerationStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DeploymentStatus" AS ENUM ('PENDING', 'BUILDING', 'READY', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT,
  ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'USER';

DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema()
      AND table_name = 'User' AND column_name = 'role' AND udt_name <> 'UserRole') THEN
    ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING upper("role"::text)::"UserRole";
  END IF;
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema()
      AND table_name = 'Project' AND column_name = 'status' AND udt_name <> 'ProjectStatus') THEN
    ALTER TABLE "Project" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "Project" ALTER COLUMN "status" TYPE "ProjectStatus"
      USING upper("status"::text)::"ProjectStatus";
  END IF;
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema()
      AND table_name = 'Generation' AND column_name = 'status' AND udt_name <> 'GenerationStatus') THEN
    ALTER TABLE "Generation" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "Generation" ALTER COLUMN "status" TYPE "GenerationStatus" USING (
      CASE upper("status"::text) WHEN 'STARTED' THEN 'RUNNING' WHEN 'COMPLETED' THEN 'SUCCESS'
      ELSE upper("status"::text) END
    )::"GenerationStatus";
  END IF;
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema()
      AND table_name = 'Deployment' AND column_name = 'status' AND udt_name <> 'DeploymentStatus') THEN
    ALTER TABLE "Deployment" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "Deployment" ALTER COLUMN "status" TYPE "DeploymentStatus"
      USING upper("status"::text)::"DeploymentStatus";
  END IF;
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema()
      AND table_name = 'ApiUsage' AND column_name = 'estimatedCost' AND udt_name <> 'float8') THEN
    ALTER TABLE "ApiUsage" ALTER COLUMN "estimatedCost" TYPE DOUBLE PRECISION USING "estimatedCost"::double precision;
  END IF;
END $$;

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'DRAFT',
  ALTER COLUMN "framework" SET DEFAULT 'nextjs-react-tailwind';
ALTER TABLE "Generation" ALTER COLUMN "status" SET DEFAULT 'PENDING',
  ALTER COLUMN "input" DROP NOT NULL, ALTER COLUMN "output" DROP NOT NULL;
ALTER TABLE "Deployment" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "Website" ALTER COLUMN "theme" SET DEFAULT 'modern',
  ALTER COLUMN "fontFamily" SET DEFAULT 'Inter', ALTER COLUMN "generatedCode" DROP NOT NULL;
ALTER TABLE "WebsitePage" ALTER COLUMN "pageType" SET DEFAULT 'standard',
  ALTER COLUMN "generatedCode" DROP NOT NULL;
ALTER TABLE "ApiUsage" ALTER COLUMN "model" DROP NOT NULL,
  ALTER COLUMN "tokens" DROP NOT NULL, ALTER COLUMN "tokens" DROP DEFAULT,
  ALTER COLUMN "estimatedCost" DROP NOT NULL, ALTER COLUMN "estimatedCost" DROP DEFAULT;

CREATE TABLE IF NOT EXISTS "Account" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refresh_token" TEXT,
  "access_token" TEXT,
  "expires_at" INTEGER,
  "token_type" TEXT,
  "scope" TEXT,
  "id_token" TEXT,
  "session_state" TEXT
);
CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT PRIMARY KEY,
  "sessionToken" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "expires" TIMESTAMP(3) NOT NULL
);
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id" TEXT PRIMARY KEY,
  "adminUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "VerificationToken" (
  "identifier" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_adminUserId_idx" ON "AdminAuditLog"("adminUserId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "ApiUsage_userId_idx" ON "ApiUsage"("userId");
CREATE INDEX IF NOT EXISTS "ApiUsage_provider_idx" ON "ApiUsage"("provider");
CREATE INDEX IF NOT EXISTS "ApiUsage_model_idx" ON "ApiUsage"("model");
CREATE INDEX IF NOT EXISTS "ApiUsage_createdAt_idx" ON "ApiUsage"("createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_projectId_idx" ON "ChatMessage"("projectId");
CREATE INDEX IF NOT EXISTS "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "Deployment_projectId_idx" ON "Deployment"("projectId");
CREATE INDEX IF NOT EXISTS "Deployment_status_idx" ON "Deployment"("status");
CREATE INDEX IF NOT EXISTS "Deployment_provider_idx" ON "Deployment"("provider");
CREATE INDEX IF NOT EXISTS "Deployment_createdAt_idx" ON "Deployment"("createdAt");
CREATE INDEX IF NOT EXISTS "Generation_projectId_idx" ON "Generation"("projectId");
CREATE INDEX IF NOT EXISTS "Generation_agent_idx" ON "Generation"("agent");
CREATE INDEX IF NOT EXISTS "Generation_status_idx" ON "Generation"("status");
CREATE INDEX IF NOT EXISTS "Generation_createdAt_idx" ON "Generation"("createdAt");
CREATE INDEX IF NOT EXISTS "Project_userId_idx" ON "Project"("userId");
CREATE INDEX IF NOT EXISTS "Project_status_idx" ON "Project"("status");
CREATE INDEX IF NOT EXISTS "Project_createdAt_idx" ON "Project"("createdAt");
CREATE INDEX IF NOT EXISTS "Project_updatedAt_idx" ON "Project"("updatedAt");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User"("createdAt");
CREATE INDEX IF NOT EXISTS "Website_projectId_idx" ON "Website"("projectId");
CREATE INDEX IF NOT EXISTS "Website_createdAt_idx" ON "Website"("createdAt");
CREATE INDEX IF NOT EXISTS "WebsitePage_websiteId_idx" ON "WebsitePage"("websiteId");

COMMIT;
