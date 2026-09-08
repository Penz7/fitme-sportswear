CREATE TYPE "PreorderLineStatus" AS ENUM ('PENDING', 'ALLOCATED', 'READY_TO_FULFILL', 'FULFILLED', 'CANCELLED');

CREATE TABLE "preorder_skus" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "shopifyProductId" TEXT,
    "shopifyVariantId" TEXT,
    "allowPreorder" BOOLEAN NOT NULL DEFAULT false,
    "preorderLimit" INTEGER,
    "expectedRestockDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preorder_skus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "preorder_lines" (
    "id" TEXT NOT NULL,
    "preorderSkuId" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "sapoOrderId" TEXT,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "allocatedQty" INTEGER NOT NULL DEFAULT 0,
    "status" "PreorderLineStatus" NOT NULL DEFAULT 'PENDING',
    "paymentConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preorder_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "preorder_skus_sku_key" ON "preorder_skus"("sku");
CREATE INDEX "preorder_skus_allowPreorder_idx" ON "preorder_skus"("allowPreorder");
CREATE UNIQUE INDEX "preorder_lines_shopifyOrderId_sku_key" ON "preorder_lines"("shopifyOrderId", "sku");
CREATE INDEX "preorder_lines_preorderSkuId_status_createdAt_idx" ON "preorder_lines"("preorderSkuId", "status", "createdAt");
CREATE INDEX "preorder_lines_sapoOrderId_idx" ON "preorder_lines"("sapoOrderId");

ALTER TABLE "preorder_lines" ADD CONSTRAINT "preorder_lines_preorderSkuId_fkey"
  FOREIGN KEY ("preorderSkuId") REFERENCES "preorder_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
