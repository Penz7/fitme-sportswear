CREATE TABLE "order_mappings" (
    "id" TEXT NOT NULL,
    "sapoOrderId" TEXT,
    "pancakeOrderId" TEXT,
    "shopifyOrderId" TEXT,
    "pancakeStatus" INTEGER,
    "pancakeStatusDescription" TEXT,
    "shopifyStatus" TEXT,
    "sapoStatus" TEXT,
    "sapoPackedStatus" TEXT,
    "sapoFulfillmentStatus" TEXT,
    "sapoReceivedStatus" TEXT,
    "sapoPaymentStatus" TEXT,
    "sapoReturnStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_mappings_pancakeOrderId_key" ON "order_mappings"("pancakeOrderId");
CREATE UNIQUE INDEX "order_mappings_shopifyOrderId_key" ON "order_mappings"("shopifyOrderId");
CREATE INDEX "order_mappings_sapoOrderId_idx" ON "order_mappings"("sapoOrderId");
