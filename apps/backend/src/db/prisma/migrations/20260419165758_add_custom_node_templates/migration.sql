-- CreateTable
CREATE TABLE "custom_node_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'Puzzle',
    "color" TEXT NOT NULL DEFAULT '#8b5cf6',
    "category" TEXT NOT NULL DEFAULT 'utilities',
    "handles" JSONB NOT NULL,
    "inputsSchema" JSONB NOT NULL,
    "executionMode" TEXT NOT NULL,
    "code" TEXT,
    "httpTemplate" JSONB,
    "credentialType" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "gitSyncedAt" TIMESTAMP(3),
    "originHash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_node_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_node_templates_organizationId_idx" ON "custom_node_templates"("organizationId");

-- CreateIndex
CREATE INDEX "custom_node_templates_isPublic_idx" ON "custom_node_templates"("isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "custom_node_templates_organizationId_key_key" ON "custom_node_templates"("organizationId", "key");

-- AddForeignKey
ALTER TABLE "custom_node_templates" ADD CONSTRAINT "custom_node_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
