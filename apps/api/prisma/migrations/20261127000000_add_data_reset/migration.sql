-- CreateTable
-- Solo crea la tabla de marcas: el borrado de datos es un script manual (scripts/reset-progress.mjs).
CREATE TABLE "DataReset" (
    "id" VARCHAR(32) NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "DataReset_pkey" PRIMARY KEY ("id")
);
