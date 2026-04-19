-- AlterTable
ALTER TABLE "org_plans" ADD COLUMN     "taskQueueOverride" TEXT;

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "defaultTaskQueue" TEXT,
ADD COLUMN     "workerCpuMillicores" INTEGER,
ADD COLUMN     "workerMemoryMb" INTEGER,
ADD COLUMN     "workerReplicas" INTEGER DEFAULT 1,
ADD COLUMN     "workerTier" TEXT DEFAULT 'shared';
