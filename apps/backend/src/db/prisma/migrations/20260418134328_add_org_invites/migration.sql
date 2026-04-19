-- CreateTable
CREATE TABLE "org_invites" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "invitedByUserId" TEXT NOT NULL,
    "inviteTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_invites_inviteTokenHash_key" ON "org_invites"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "org_invites_invitedEmail_idx" ON "org_invites"("invitedEmail");

-- CreateIndex
CREATE INDEX "org_invites_organizationId_idx" ON "org_invites"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "org_invites_organizationId_invitedEmail_key" ON "org_invites"("organizationId", "invitedEmail");

-- AddForeignKey
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
