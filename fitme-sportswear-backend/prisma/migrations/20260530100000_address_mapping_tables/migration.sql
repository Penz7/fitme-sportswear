CREATE TABLE "province_mapping" (
    "id" SERIAL NOT NULL,
    "sapo_id" INTEGER,
    "sapo_name" TEXT,
    "pancake_id" INTEGER,
    "pancake_name" TEXT,
    "similarity" DOUBLE PRECISION,

    CONSTRAINT "province_mapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "district_mapping" (
    "id" SERIAL NOT NULL,
    "sapo_id" INTEGER,
    "sapo_name" TEXT,
    "sapo_cityid" INTEGER,
    "sapo_city" TEXT,
    "pancake_id" INTEGER,
    "pancake_name" TEXT,
    "similarity" DOUBLE PRECISION,

    CONSTRAINT "district_mapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ward_mapping" (
    "id" SERIAL NOT NULL,
    "sapo_id" INTEGER,
    "sapo_name" TEXT,
    "sapo_districtid" INTEGER,
    "sapo_district" TEXT,
    "sapo_cityid" INTEGER,
    "sapo_city" TEXT,
    "pancake_id" INTEGER,
    "pancake_name" TEXT,
    "similarity" DOUBLE PRECISION,

    CONSTRAINT "ward_mapping_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "province_mapping_pancake_id_idx" ON "province_mapping"("pancake_id");
CREATE INDEX "district_mapping_pancake_id_idx" ON "district_mapping"("pancake_id");
CREATE INDEX "ward_mapping_pancake_id_idx" ON "ward_mapping"("pancake_id");
