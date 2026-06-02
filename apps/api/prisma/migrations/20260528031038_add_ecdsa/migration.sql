-- AlterTable
ALTER TABLE "transfers" ADD COLUMN     "payloadHash" TEXT,
ADD COLUMN     "recipientSignature" TEXT,
ADD COLUMN     "senderSignature" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "publicKey" TEXT;
