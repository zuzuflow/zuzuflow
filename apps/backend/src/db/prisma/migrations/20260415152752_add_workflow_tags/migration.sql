-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "environmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_tags" (
    "workflowId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "workflow_tags_pkey" PRIMARY KEY ("workflowId","tagId")
);

-- CreateIndex
CREATE INDEX "tags_environmentId_idx" ON "tags"("environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_environmentId_name_key" ON "tags"("environmentId", "name");

-- CreateIndex
CREATE INDEX "workflow_tags_tagId_idx" ON "workflow_tags"("tagId");

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_tags" ADD CONSTRAINT "workflow_tags_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_tags" ADD CONSTRAINT "workflow_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
