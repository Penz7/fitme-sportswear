CREATE TABLE "product_sync_conflicts" (
  "id" TEXT NOT NULL,
  "normalizedSku" TEXT NOT NULL,
  "conflictType" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "originalSkus" JSONB NOT NULL,
  "involvedEntities" JSONB NOT NULL,
  "message" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "lastNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_sync_conflicts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_sync_conflicts_normalizedSku_conflictType_platform_key"
ON "product_sync_conflicts"("normalizedSku", "conflictType", "platform");

CREATE INDEX "product_sync_conflicts_resolvedAt_idx"
ON "product_sync_conflicts"("resolvedAt");
