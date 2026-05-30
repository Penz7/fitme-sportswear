-- CreateEnum
CREATE TYPE "ProductMappingStatus" AS ENUM ('matched', 'partial', 'conflict');

-- CreateTable
CREATE TABLE "sapo_products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "name" TEXT,
    "available" INTEGER,
    "remain" INTEGER,
    "retailPrice" DECIMAL(18,2),
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sapo_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pancake_products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "name" TEXT,
    "available" INTEGER,
    "remain" INTEGER,
    "retailPrice" DECIMAL(18,2),
    "warehouseId" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancake_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopify_products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "name" TEXT,
    "available" BIGINT,
    "remain" BIGINT,
    "retailPrice" DECIMAL(18,2),
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_mappings" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "sapoProductId" TEXT,
    "sapoVariantId" TEXT,
    "pancakeProductId" TEXT,
    "pancakeVariantId" TEXT,
    "pancakeWarehouseId" TEXT,
    "shopifyProductId" TEXT,
    "shopifyVariantId" TEXT,
    "status" "ProductMappingStatus" NOT NULL,
    "conflictReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sapo_products_sku_key" ON "sapo_products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "pancake_products_sku_key" ON "pancake_products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_products_sku_key" ON "shopify_products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_mappings_sku_key" ON "product_mappings"("sku");
