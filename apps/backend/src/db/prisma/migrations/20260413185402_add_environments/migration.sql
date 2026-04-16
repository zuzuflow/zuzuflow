-- =============================================================================
-- Migration: add_environments
--
-- Adds Environment + UserEnvironment models, adds environmentId FK to 6 tables,
-- creates a default "Production" environment, and backfills all existing data.
-- =============================================================================

-- Step 1: Create new tables
-- CreateTable
CREATE TABLE "environments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "environments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_environments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'editor',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_environments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "environments_slug_key" ON "environments"("slug");

-- CreateIndex
CREATE INDEX "user_environments_userId_idx" ON "user_environments"("userId");

-- CreateIndex
CREATE INDEX "user_environments_environmentId_idx" ON "user_environments"("environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "user_environments_userId_environmentId_key" ON "user_environments"("userId", "environmentId");

-- Step 2: Create the default "Production" environment
INSERT INTO "environments" ("id", "name", "slug", "isDefault", "createdAt", "updatedAt")
VALUES ('env-default-production', 'Production', 'production', true, NOW(), NOW());

-- Step 3: Add all existing users as admin members of the default environment
INSERT INTO "user_environments" ("id", "userId", "environmentId", "role", "createdAt")
SELECT gen_random_uuid()::text, "id", 'env-default-production', 'admin', NOW()
FROM "users";

-- Step 4: Add environmentId columns as NULLABLE first
ALTER TABLE "executions" ADD COLUMN "environmentId" TEXT;
ALTER TABLE "folders" ADD COLUMN "environmentId" TEXT;
ALTER TABLE "stored_credentials" ADD COLUMN "environmentId" TEXT;
ALTER TABLE "variables" ADD COLUMN "environmentId" TEXT;
ALTER TABLE "webhook_endpoints" ADD COLUMN "environmentId" TEXT;
ALTER TABLE "workflows" ADD COLUMN "environmentId" TEXT;

-- Step 5: Backfill all existing rows with the default environment
UPDATE "executions" SET "environmentId" = 'env-default-production' WHERE "environmentId" IS NULL;
UPDATE "folders" SET "environmentId" = 'env-default-production' WHERE "environmentId" IS NULL;
UPDATE "stored_credentials" SET "environmentId" = 'env-default-production' WHERE "environmentId" IS NULL;
UPDATE "variables" SET "environmentId" = 'env-default-production' WHERE "environmentId" IS NULL;
UPDATE "webhook_endpoints" SET "environmentId" = 'env-default-production' WHERE "environmentId" IS NULL;
UPDATE "workflows" SET "environmentId" = 'env-default-production' WHERE "environmentId" IS NULL;

-- Step 6: Make columns NOT NULL now that all rows have a value
ALTER TABLE "executions" ALTER COLUMN "environmentId" SET NOT NULL;
ALTER TABLE "folders" ALTER COLUMN "environmentId" SET NOT NULL;
ALTER TABLE "stored_credentials" ALTER COLUMN "environmentId" SET NOT NULL;
ALTER TABLE "variables" ALTER COLUMN "environmentId" SET NOT NULL;
ALTER TABLE "webhook_endpoints" ALTER COLUMN "environmentId" SET NOT NULL;
ALTER TABLE "workflows" ALTER COLUMN "environmentId" SET NOT NULL;

-- Step 7: Create indexes
CREATE INDEX "executions_environmentId_idx" ON "executions"("environmentId");
CREATE INDEX "folders_environmentId_idx" ON "folders"("environmentId");
CREATE INDEX "stored_credentials_environmentId_idx" ON "stored_credentials"("environmentId");
CREATE INDEX "variables_environmentId_idx" ON "variables"("environmentId");
CREATE INDEX "webhook_endpoints_environmentId_idx" ON "webhook_endpoints"("environmentId");
CREATE INDEX "workflows_environmentId_idx" ON "workflows"("environmentId");

-- Step 8: Add foreign keys
ALTER TABLE "user_environments" ADD CONSTRAINT "user_environments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_environments" ADD CONSTRAINT "user_environments_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folders" ADD CONSTRAINT "folders_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "executions" ADD CONSTRAINT "executions_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stored_credentials" ADD CONSTRAINT "stored_credentials_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "variables" ADD CONSTRAINT "variables_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
