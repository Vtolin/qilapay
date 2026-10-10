-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'ID',
    "currentTier" INTEGER NOT NULL DEFAULT 0,
    "personaKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "KycTierConfig" (
    "tier" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "perTxLimitUsd" DOUBLE PRECISION NOT NULL,
    "rolling30dLimitUsd" DOUBLE PRECISION NOT NULL,
    "requiredMethods" TEXT NOT NULL DEFAULT '[]',
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "KycTierConfig_pkey" PRIMARY KEY ("tier")
);

-- CreateTable
CREATE TABLE "KycVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "targetTier" INTEGER NOT NULL,
    "providerRef" TEXT NOT NULL DEFAULT 'mock',
    "payload" TEXT NOT NULL DEFAULT '{}',
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "KycVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 6,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'frankfurter',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "walletAddress" TEXT,
    "linkedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromCcy" TEXT NOT NULL,
    "toCcy" TEXT NOT NULL,
    "amountIn" TEXT NOT NULL,
    "amountOut" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "spreadBps" INTEGER NOT NULL,
    "feeUsd" DOUBLE PRECISION NOT NULL,
    "usdEquivalent" DOUBLE PRECISION NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "executionMode" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'quoted',
    "txHash" TEXT,
    "submitTxHash" TEXT,
    "swapTxHash" TEXT,
    "outTxHash" TEXT,
    "submittedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "memo" TEXT,
    "executionMode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferEvent" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskDecision" (
    "id" TEXT NOT NULL,
    "transferId" TEXT,
    "userId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "reasonCodes" TEXT NOT NULL DEFAULT '[]',
    "inputSnapshot" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'HOLD_REVIEW',

    CONSTRAINT "ScreeningEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "KycVerification_userId_status_idx" ON "KycVerification"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");

-- CreateIndex
CREATE UNIQUE INDEX "FxRate_base_quote_key" ON "FxRate"("base", "quote");

-- CreateIndex
CREATE INDEX "Recipient_userId_idx" ON "Recipient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_quoteId_key" ON "Transfer"("quoteId");

-- CreateIndex
CREATE INDEX "Transfer_userId_createdAt_idx" ON "Transfer"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Transfer_status_idx" ON "Transfer"("status");

-- CreateIndex
CREATE INDEX "TransferEvent_transferId_idx" ON "TransferEvent"("transferId");

-- CreateIndex
CREATE INDEX "RiskDecision_userId_idx" ON "RiskDecision"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningEntry_name_key" ON "ScreeningEntry"("name");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycVerification" ADD CONSTRAINT "KycVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipient" ADD CONSTRAINT "Recipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferEvent" ADD CONSTRAINT "TransferEvent_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskDecision" ADD CONSTRAINT "RiskDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskDecision" ADD CONSTRAINT "RiskDecision_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
