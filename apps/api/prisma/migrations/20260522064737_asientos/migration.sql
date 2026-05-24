/*
  Warnings:

  - You are about to drop the column `section` on the `tickets` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[eventId,seatId]` on the table `tickets` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "tickets" DROP COLUMN "section",
ADD COLUMN     "seatId" TEXT,
ADD COLUMN     "seatNumber" INTEGER,
ADD COLUMN     "seatRow" TEXT,
ADD COLUMN     "seatSection" TEXT;

-- CreateTable
CREATE TABLE "venue_sections" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "colorHex" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "row" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "seatLabel" TEXT,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_section_prices" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_section_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "venue_sections_code_key" ON "venue_sections"("code");

-- CreateIndex
CREATE INDEX "seats_sectionId_idx" ON "seats"("sectionId");

-- CreateIndex
CREATE INDEX "seats_row_idx" ON "seats"("row");

-- CreateIndex
CREATE INDEX "event_section_prices_eventId_idx" ON "event_section_prices"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_section_prices_eventId_sectionId_key" ON "event_section_prices"("eventId", "sectionId");

-- CreateIndex
CREATE INDEX "tickets_seatId_idx" ON "tickets"("seatId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_eventId_seatId_key" ON "tickets"("eventId", "seatId");

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "venue_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_section_prices" ADD CONSTRAINT "event_section_prices_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_section_prices" ADD CONSTRAINT "event_section_prices_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "venue_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "seats"("id") ON DELETE SET NULL ON UPDATE CASCADE;
