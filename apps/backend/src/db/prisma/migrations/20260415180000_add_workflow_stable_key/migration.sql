-- Add stable export/import-safe key to workflows
-- Format: "wf_" + 10 hex chars (derived from id so each backfill is deterministic)

-- 1. Add the column as nullable so backfill can populate it
ALTER TABLE "workflows" ADD COLUMN "key" TEXT;

-- 2. Backfill existing rows with a stable, unique-per-env key derived from id
UPDATE "workflows"
SET "key" = 'wf_' || substring(md5("id"), 1, 10)
WHERE "key" IS NULL;

-- 3. Enforce NOT NULL now that every row has a value
ALTER TABLE "workflows" ALTER COLUMN "key" SET NOT NULL;

-- 4. Uniqueness scope: one key per environment
CREATE UNIQUE INDEX "workflows_environmentId_key_key" ON "workflows"("environmentId", "key");
