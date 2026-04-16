-- =============================================================================
-- Migration: user email required, login tracking, org address
-- =============================================================================

-- 1. Add lastLoginAt and lastLoginIp columns to users
ALTER TABLE "users" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "lastLoginIp" TEXT;

-- 2. Add address column to organizations
ALTER TABLE "organizations" ADD COLUMN "address" TEXT;

-- 3. Make email required: backfill any NULL emails with username@placeholder
UPDATE "users" SET "email" = CONCAT("username", '@placeholder.local') WHERE "email" IS NULL;

-- 4. Make email column NOT NULL (it was optional before)
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
