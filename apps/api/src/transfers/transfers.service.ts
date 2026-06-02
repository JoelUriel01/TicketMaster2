import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha256';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { RespondTransferDto } from './dto/respond-transfer.dto';
import { TicketStatus, TransferStatus } from '@prisma/client';

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────
  // 1. INICIAR TRANSFERENCIA (remitente)
  // ─────────────────────────────────────────────────────────────

  async create(senderId: string, dto: CreateTransferDto) {
    // 1a. Cargar sender con su clave pública registrada
    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { id: true, publicKey: true },
    });
    if (!sender?.publicKey) {
      throw new BadRequestException(
        'El remitente no tiene una clave pública registrada. ' +
          'Registra tu clave pública antes de transferir.',
      );
    }

    // 1b. Verificar que el nonce no haya sido usado antes (anti-replay)
    const nonceUsed = await this.prisma.transfer.findFirst({
      where: { nonce: dto.nonce },
    });
    if (nonceUsed) {
      throw new ConflictException(
        'Este nonce ya fue utilizado. Genera una nueva solicitud.',
      );
    }

    // 1c. Verificar que el boleto exista, sea del sender y esté ACTIVE
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: dto.ticketId },
      select: { id: true, ownerId: true, status: true, eventId: true },
    });
    if (!ticket) throw new NotFoundException('Boleto no encontrado.');
    if (ticket.ownerId !== senderId) {
      throw new ForbiddenException('No eres el propietario de este boleto.');
    }
    if (ticket.status !== TicketStatus.ACTIVE) {
      throw new ConflictException(
        `El boleto no está activo (estado actual: ${ticket.status}).`,
      );
    }

    // 1d. Verificar que no haya ya una transferencia PENDING para este boleto
    const pendingTransfer = await this.prisma.transfer.findFirst({
      where: { ticketId: dto.ticketId, status: TransferStatus.PENDING },
    });
    if (pendingTransfer) {
      throw new ConflictException(
        'Ya existe una transferencia pendiente para este boleto.',
      );
    }

    // 1e. Verificar que el receptor exista y tenga clave pública
    const recipient = await this.prisma.user.findUnique({
      where: { id: dto.recipientId },
      select: { id: true, publicKey: true },
    });
    if (!recipient) throw new NotFoundException('Receptor no encontrado.');
    if (!recipient.publicKey) {
      throw new BadRequestException(
        'El receptor no ha registrado su clave pública todavía.',
      );
    }

    // 1f. Verificar firma ECDSA del remitente
    const payloadToVerify = this.buildInitiatorPayload({
      ticketId: dto.ticketId,
      senderId,
      recipientId: dto.recipientId,
      expiresAt: dto.expiresAt,
      nonce: dto.nonce,
    });
    const sigValid = this.verifySignature(
      payloadToVerify,
      dto.signature,
      sender.publicKey,
    );
    if (!sigValid) {
      throw new UnprocessableEntityException(
        'La firma ECDSA no es válida. El payload pudo haber sido alterado.',
      );
    }

    // 1g. Crear la transferencia y marcar el boleto como TRANSFER_PENDING
    const expiresAt = new Date(dto.expiresAt);

    const [transfer] = await this.prisma.$transaction([
      this.prisma.transfer.create({
        data: {
          ticketId: dto.ticketId,
          senderId,
          recipientId: dto.recipientId,
          status: TransferStatus.PENDING,
          expiresAt,
          nonce: dto.nonce,
          senderSignature: dto.signature,
          payloadHash: this.hashPayload(payloadToVerify),
        },
      }),
      this.prisma.ticket.update({
        where: { id: dto.ticketId },
        data: { status: TicketStatus.TRANSFER_PENDING },
      }),
    ]);

    return transfer;
  }

  // ─────────────────────────────────────────────────────────────
  // 2. RESPONDER TRANSFERENCIA (receptor: ACCEPT o REJECT)
  // ─────────────────────────────────────────────────────────────

  async respond(recipientId: string, dto: RespondTransferDto) {
    // 2a. Cargar la transferencia
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: dto.transferId },
      include: { ticket: true },
    });
    if (!transfer) throw new NotFoundException('Transferencia no encontrada.');
    if (transfer.recipientId !== recipientId) {
      throw new ForbiddenException(
        'No eres el receptor de esta transferencia.',
      );
    }
    if (transfer.status !== TransferStatus.PENDING) {
      throw new ConflictException(
        `La transferencia no está pendiente (estado: ${transfer.status}).`,
      );
    }
    if (new Date() > transfer.expiresAt) {
      // Expirar en la BD también
      await this.prisma.transfer.update({
        where: { id: transfer.id },
        data: { status: TransferStatus.EXPIRED },
      });
      await this.prisma.ticket.update({
        where: { id: transfer.ticketId },
        data: { status: TicketStatus.ACTIVE },
      });
      throw new ConflictException('La transferencia ha expirado.');
    }

    // 2b. Cargar clave pública del receptor
    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { publicKey: true },
    });
    if (!recipient?.publicKey) {
      throw new BadRequestException(
        'No tienes una clave pública registrada.',
      );
    }

    // 2c. Verificar firma del receptor
    const payloadToVerify = this.buildRecipientPayload({
      transferId: dto.transferId,
      recipientId,
      action: dto.action,
      timestamp: dto.timestamp,
    });
    const sigValid = this.verifySignature(
      payloadToVerify,
      dto.signature,
      recipient.publicKey,
    );
    if (!sigValid) {
      throw new UnprocessableEntityException(
        'La firma ECDSA de aceptación no es válida.',
      );
    }

    // 2d. Ejecutar según la acción
    if (dto.action === 'ACCEPT') {
      return this.executeAccept(transfer, dto.signature, payloadToVerify);
    } else {
      return this.executeReject(transfer);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. CANCELAR (remitente, sin firma requerida porque ya está auth)
  // ─────────────────────────────────────────────────────────────

  async cancel(senderId: string, transferId: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
    });
    if (!transfer) throw new NotFoundException('Transferencia no encontrada.');
    if (transfer.senderId !== senderId) {
      throw new ForbiddenException(
        'Solo el remitente puede cancelar la transferencia.',
      );
    }
    if (transfer.status !== TransferStatus.PENDING) {
      throw new ConflictException(
        `No se puede cancelar: estado actual ${transfer.status}.`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.transfer.update({
        where: { id: transferId },
        data: { status: TransferStatus.CANCELED, canceledAt: new Date() },
      }),
      this.prisma.ticket.update({
        where: { id: transfer.ticketId },
        data: { status: TicketStatus.ACTIVE },
      }),
    ]);
    return updated;
  }

  // ─────────────────────────────────────────────────────────────
  // 4. LISTADOS
  // ─────────────────────────────────────────────────────────────
async findIncoming(userId: string) {
  const now = new Date();

  // Obtener transferencias PENDING vencidas
  const expired = await this.prisma.transfer.findMany({
    where: {
      recipientId: userId,
      status: TransferStatus.PENDING,
      expiresAt: { lt: now },
    },
    select: { id: true, ticketId: true },
  });

  if (expired.length > 0) {
    await this.prisma.$transaction([
      this.prisma.transfer.updateMany({
        where: { id: { in: expired.map((t) => t.id) } },
        data: { status: TransferStatus.EXPIRED },
      }),
      this.prisma.ticket.updateMany({
        where: { id: { in: expired.map((t) => t.ticketId) } },
        data: { status: TicketStatus.ACTIVE },
      }),
    ]);
  }

  return this.prisma.transfer.findMany({
    where: {
      recipientId: userId,
      status: TransferStatus.PENDING,
    },
    include: {
      ticket: { include: { event: true } },
      sender: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

 async findOutgoing(userId: string) {
  return this.prisma.transfer.findMany({
    where: { senderId: userId },
    include: {
      ticket: {
        include: {
          event: true,   // ← igual aquí
        },
      },
      recipient: {
        select: { id: true, fullName: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

  // ─────────────────────────────────────────────────────────────
  // HELPERS PRIVADOS
  // ─────────────────────────────────────────────────────────────

  private async executeAccept(
    transfer: any,
    recipientSignature: string,
    payloadToVerify: string,
  ) {
    const now = new Date();
    const [updatedTransfer] = await this.prisma.$transaction([
      this.prisma.transfer.update({
        where: { id: transfer.id },
        data: {
          status: TransferStatus.ACCEPTED,
          acceptedAt: now,
          recipientSignature,
          recipientPayloadHash: this.hashPayload(payloadToVerify),
        },
      }),
      this.prisma.ticket.update({
        where: { id: transfer.ticketId },
        data: {
          ownerId: transfer.recipientId,
          status: TicketStatus.ACTIVE,
          transferCount: { increment: 1 },
        },
      }),
    ]);
    return updatedTransfer;
  }

  private async executeReject(transfer: any) {
    const [updatedTransfer] = await this.prisma.$transaction([
      this.prisma.transfer.update({
        where: { id: transfer.id },
        data: { status: TransferStatus.REJECTED },
      }),
      this.prisma.ticket.update({
        where: { id: transfer.ticketId },
        data: { status: TicketStatus.ACTIVE },
      }),
    ]);
    return updatedTransfer;
  }

  /**
   * Construye el string JSON que el REMITENTE debe firmar.
   * Las claves van en orden fijo para que el hash sea determinístico
   * independientemente del motor JS que lo serialice.
   */
  private buildInitiatorPayload(fields: {
    ticketId: string;
    senderId: string;
    recipientId: string;
    expiresAt: string;
    nonce: string;
  }): string {
    return JSON.stringify({
      ticketId: fields.ticketId,
      senderId: fields.senderId,
      recipientId: fields.recipientId,
      expiresAt: fields.expiresAt,
      nonce: fields.nonce,
    });
  }

  /**
   * Construye el string JSON que el RECEPTOR debe firmar.
   */
  private buildRecipientPayload(fields: {
    transferId: string;
    recipientId: string;
    action: string;
    timestamp: string;
  }): string {
    return JSON.stringify({
      transferId: fields.transferId,
      recipientId: fields.recipientId,
      action: fields.action,
      timestamp: fields.timestamp,
    });
  }

  /**
   * Verifica una firma ECDSA P-256 usando @noble/curves.
   * Acepta la clave pública en formato base64 (raw, 65 bytes sin comprimir).
   * Acepta la firma en base64 estándar o URL-safe (normaliza antes).
   */
  private verifySignature(
    payload: string,
    signatureB64: string,
    publicKeyB64: string,
  ): boolean {
    try {
      const normalizedSig = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
      const sigBytes = Uint8Array.from(Buffer.from(normalizedSig, 'base64'));
      const pubKeyBytes = Uint8Array.from(Buffer.from(publicKeyB64, 'base64'));
      const hash = sha256(new TextEncoder().encode(payload));
      return p256.verify(sigBytes, hash, pubKeyBytes);
    } catch {
      // Cualquier error de parsing (clave malformada, firma inválida) → false
      return false;
    }
  }

  /** SHA-256 del payload como hex, para almacenar en auditoría. */
  private hashPayload(payload: string): string {
    const hash = sha256(new TextEncoder().encode(payload));
    return Buffer.from(hash).toString('hex');
  }
}