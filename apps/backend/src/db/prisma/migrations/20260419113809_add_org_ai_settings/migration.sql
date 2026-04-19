-- CreateTable
CREATE TABLE "org_ai_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "aiBuilderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiProvider" TEXT,
    "aiApiKeyEncrypted" TEXT,
    "aiApiKeyIv" TEXT,
    "aiModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_ai_settings_organizationId_key" ON "org_ai_settings"("organizationId");

-- AddForeignKey
ALTER TABLE "org_ai_settings" ADD CONSTRAINT "org_ai_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
