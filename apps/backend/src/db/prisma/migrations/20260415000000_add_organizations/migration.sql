-- =============================================================================
-- Add Organizations (multi-tenancy) + email on Users
-- =============================================================================

-- 1. Create organizations table
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- 2. Create org_members table
CREATE TABLE "org_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "org_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "org_members_userId_organizationId_key" ON "org_members"("userId", "organizationId");
CREATE INDEX "org_members_userId_idx" ON "org_members"("userId");
CREATE INDEX "org_members_organizationId_idx" ON "org_members"("organizationId");
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Add email column to users (nullable for existing users)
ALTER TABLE "users" ADD COLUMN "email" TEXT;
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- 4. Add organizationId to environments (nullable initially for data migration)
ALTER TABLE "environments" ADD COLUMN "organizationId" TEXT;

-- 5. DATA MIGRATION: Create default organization and link existing data
-- Insert the default organization
INSERT INTO "organizations" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES ('org-default', 'Default Organization', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Assign all existing environments to the default org
UPDATE "environments" SET "organizationId" = 'org-default' WHERE "organizationId" IS NULL;

-- Add all existing users as org members (admin users → owner, others → member)
INSERT INTO "org_members" ("id", "userId", "organizationId", "role", "createdAt")
SELECT gen_random_uuid()::text, "id", 'org-default',
       CASE WHEN "role" = 'admin' THEN 'owner' ELSE 'member' END,
       CURRENT_TIMESTAMP
FROM "users";

-- 6. Make organizationId NOT NULL now that data is migrated
ALTER TABLE "environments" ALTER COLUMN "organizationId" SET NOT NULL;

-- 7. Add foreign key from environments to organizations
ALTER TABLE "environments" ADD CONSTRAINT "environments_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "environments_organizationId_idx" ON "environments"("organizationId");

-- 8. Change environment slug uniqueness from global to per-organization
DROP INDEX "environments_slug_key";
CREATE UNIQUE INDEX "environments_organizationId_slug_key" ON "environments"("organizationId", "slug");

-- 9. Change stored_credentials name uniqueness from global to per-environment
DROP INDEX "stored_credentials_name_key";
CREATE UNIQUE INDEX "stored_credentials_environmentId_name_key" ON "stored_credentials"("environmentId", "name");

-- 10. Change variables key uniqueness from global to per-environment
DROP INDEX "variables_key_key";
CREATE UNIQUE INDEX "variables_environmentId_key_key" ON "variables"("environmentId", "key");
