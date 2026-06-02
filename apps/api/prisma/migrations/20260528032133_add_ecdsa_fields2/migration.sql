-- AlterTable
ALTER TABLE "transfers" ADD COLUMN     "nonce" TEXT,
ADD COLUMN     "recipientPayloadHash" TEXT;
