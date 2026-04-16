-- AlterTable
ALTER TABLE "webhook_endpoints" ADD COLUMN     "authType" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "basicPassword" TEXT,
ADD COLUMN     "basicUsername" TEXT,
ADD COLUMN     "jwtAudience" TEXT,
ADD COLUMN     "jwtIssuer" TEXT,
ADD COLUMN     "jwtJwksUri" TEXT,
ADD COLUMN     "jwtPublicKey" TEXT;
