CREATE TABLE "sapo_order_tracking" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "orderIds" JSONB NOT NULL,
    "lastUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sapo_order_tracking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sapo_order_tracking_type_key" ON "sapo_order_tracking"("type");
