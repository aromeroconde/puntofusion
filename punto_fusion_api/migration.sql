-- CreateEnum
CREATE TYPE "pf_student_status" AS ENUM ('activo', 'inactivo', 'egresado');

-- CreateEnum
CREATE TYPE "pf_contact_preferred_channel" AS ENUM ('mensaje', 'llamada', 'visita');

-- CreateEnum
CREATE TYPE "pf_request_status" AS ENUM ('nuevo', 'en_espera', 'agendado', 'cotizado', 'cerrado');

-- CreateEnum
CREATE TYPE "pf_booking_status" AS ENUM ('pendiente_pago', 'confirmado', 'cancelado', 'no_show');

-- CreateEnum
CREATE TYPE "pf_payment_method" AS ENUM ('sinpe', 'otro');

-- CreateEnum
CREATE TYPE "pf_payment_status" AS ENUM ('pendiente', 'verificado', 'rechazado', 'reembolsado');

-- CreateEnum
CREATE TYPE "pf_attachment_kind" AS ENUM ('comprobante', 'foto', 'video', 'documento', 'otro');

-- CreateTable
CREATE TABLE "pf_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" TEXT,
    "whatsapp" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "preferred_channel" "pf_contact_preferred_channel",
    "last_seen_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pf_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pf_students" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contact_id" UUID NOT NULL,
    "status" "pf_student_status" NOT NULL DEFAULT 'activo',
    "level" TEXT,
    "group_schedule" VARCHAR(255),
    "reschedules_used" INTEGER NOT NULL DEFAULT 0,
    "requires_invoice" BOOLEAN NOT NULL DEFAULT false,
    "alegra_contact_id" VARCHAR(255),
    "start_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pf_students_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "pf_services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "service" TEXT NOT NULL,
    "subservice" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL,
    "price_amount" DECIMAL,
    "duration_min" INTEGER,
    "capacity" INTEGER,
    "requires_level" TEXT,
    "is_bookable" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pf_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pf_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contact_id" UUID NOT NULL,
    "student_id" UUID,
    "service_id" UUID,
    "internal_tag" TEXT,
    "objective" TEXT,
    "level" TEXT,
    "desired_datetime" TIMESTAMPTZ,
    "has_files" BOOLEAN NOT NULL DEFAULT false,
    "status" "pf_request_status" NOT NULL DEFAULT 'nuevo',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ,

    CONSTRAINT "pf_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pf_bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ,
    "end_at" TIMESTAMPTZ,
    "status" "pf_booking_status" NOT NULL DEFAULT 'pendiente_pago',
    "payment_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pf_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pf_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "method" "pf_payment_method" NOT NULL DEFAULT 'sinpe',
    "amount" DECIMAL,
    "currency" TEXT NOT NULL,
    "status" "pf_payment_status" NOT NULL DEFAULT 'pendiente',
    "reference_text" TEXT,
    "paid_at" TIMESTAMPTZ,
    "verified_at" TIMESTAMPTZ,
    "proof_attachment_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentId" UUID,

    CONSTRAINT "pf_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pf_waitlist" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contact_id" UUID NOT NULL,
    "service_id" UUID,
    "preference" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pf_waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pf_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contact_id" UUID,
    "request_id" UUID,
    "booking_id" UUID,
    "kind" "pf_attachment_kind" NOT NULL DEFAULT 'otro',
    "file_path" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size_bytes" BIGINT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pf_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pf_calendars" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Costa_Rica',
    "default_duration_min" INTEGER,
    "default_capacity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pf_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pf_calendar_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "calendar_id" UUID NOT NULL,
    "resource_id" UUID,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "slot_duration_min" INTEGER,
    "capacity" INTEGER,
    "effective_from" DATE,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pf_calendar_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pf_availability_slots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "calendar_id" UUID,
    "resource_id" UUID,
    "service_id" UUID,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "booked_count" INTEGER NOT NULL DEFAULT 0,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "external_calendar_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pf_availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pf_resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pf_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pf_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "policy_key" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL DEFAULT 'global',
    "scope_ref" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "policy" JSONB NOT NULL DEFAULT '{}',
    "effective_from" TIMESTAMPTZ,
    "effective_to" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pf_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pf_kb_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "source" TEXT,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pf_kb_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pf_kb_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pf_kb_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pf_contacts_whatsapp_key" ON "pf_contacts"("whatsapp");

-- CreateIndex
CREATE UNIQUE INDEX "pf_students_contact_id_key" ON "pf_students"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "pf_classes_mapping_agendador_event_type_id_key" ON "pf_classes_mapping"("agendador_event_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "pf_calendars_key_key" ON "pf_calendars"("key");

-- CreateIndex
CREATE UNIQUE INDEX "pf_resources_key_key" ON "pf_resources"("key");

-- AddForeignKey
ALTER TABLE "pf_students" ADD CONSTRAINT "pf_students_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "pf_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pf_requests" ADD CONSTRAINT "pf_requests_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "pf_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pf_requests" ADD CONSTRAINT "pf_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "pf_students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pf_requests" ADD CONSTRAINT "pf_requests_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "pf_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pf_bookings" ADD CONSTRAINT "pf_bookings_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "pf_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pf_bookings" ADD CONSTRAINT "pf_bookings_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "pf_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pf_payments" ADD CONSTRAINT "pf_payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "pf_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pf_payments" ADD CONSTRAINT "pf_payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "pf_students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pf_waitlist" ADD CONSTRAINT "pf_waitlist_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "pf_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pf_waitlist" ADD CONSTRAINT "pf_waitlist_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "pf_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pf_attachments" ADD CONSTRAINT "pf_attachments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "pf_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pf_attachments" ADD CONSTRAINT "pf_attachments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "pf_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pf_calendar_rules" ADD CONSTRAINT "pf_calendar_rules_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "pf_calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pf_availability_slots" ADD CONSTRAINT "pf_availability_slots_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "pf_calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pf_kb_chunks" ADD CONSTRAINT "pf_kb_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "pf_kb_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Migración: Vincular Agendador bookings ↔ pf_bookings ───
ALTER TABLE "pf_bookings" ALTER COLUMN "request_id" DROP NOT NULL;
ALTER TABLE "pf_bookings" ALTER COLUMN "slot_id" DROP NOT NULL;
ALTER TABLE "pf_bookings" ADD COLUMN "agendador_booking_id" UUID;
ALTER TABLE "pf_bookings" ADD COLUMN "event_type_id" UUID;
ALTER TABLE "pf_bookings" ADD COLUMN "student_id" UUID;

-- AddForeignKey (booking → student)
ALTER TABLE "pf_bookings" ADD CONSTRAINT "pf_bookings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "pf_students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

