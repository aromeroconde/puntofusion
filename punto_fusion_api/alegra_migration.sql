-- AlterTable
ALTER TABLE "pf_students" ADD COLUMN     "alegra_contact_id" VARCHAR(255),
ADD COLUMN     "requires_invoice" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "pf_classes_mapping" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agendador_event_type_id" VARCHAR(255) NOT NULL,
    "alegra_item_id" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pf_classes_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pf_classes_mapping_agendador_event_type_id_key" ON "pf_classes_mapping"("agendador_event_type_id");
