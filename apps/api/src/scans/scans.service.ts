import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidateScanDto } from './dto/validate-scan.dto';
import { ScanResult, TicketStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class ScansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateScan(staffUserId: string, dto: ValidateScanDto) {
    const now = new Date();

    // 1) Resolver ticketId desde qrToken o del propio dto
    let ticketId = dto.ticketId;

    if (dto.qrToken && !ticketId) {
      try {
        const payload = await this.jwtService.verifyAsync(dto.qrToken, {
          secret: process.env.TICKET_QR_SECRET,
        });

        if (!payload?.ticketId || typeof payload.ticketId !== 'string') {
          throw new BadRequestException('QR inválido: no contiene ticketId.');
        }

        ticketId = payload.ticketId;
      } catch {
        return {
          ok: false,
          result: ScanResult.INVALID,
          message: 'QR inválido o expirado.',
        };
      }
    }

    if (!ticketId) {
      return {
        ok: false,
        result: ScanResult.INVALID,
        message: 'No se proporcionó identificador de boleto.',
      };
    }

    // 2) Lógica original usando ticketId ya resuelto
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              startsAt: true,
              endsAt: true,
              venueName: true,
              venueCity: true,
            },
          },
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      if (!ticket) {
        return {
          ok: false,
          result: ScanResult.INVALID,
          message: 'Boleto no encontrado',
        };
      }

      if (ticket.revokedAt || ticket.status === TicketStatus.REVOKED) {
        await tx.scanLog.create({
          data: {
            ticketId: ticket.id,
            scannedByUserId: staffUserId,
            gate: dto.gate,
            deviceId: dto.deviceId,
            requestNonce: dto.requestNonce,
            result: ScanResult.REVOKED,
            reason: 'Boleto revocado',
          },
        });

        return {
          ok: false,
          result: ScanResult.REVOKED,
          message: 'Boleto revocado',
          ticketId: ticket.id,
        };
      }

      if (ticket.usedAt || ticket.status === TicketStatus.USED) {
        await tx.scanLog.create({
          data: {
            ticketId: ticket.id,
            scannedByUserId: staffUserId,
            gate: dto.gate,
            deviceId: dto.deviceId,
            requestNonce: dto.requestNonce,
            result: ScanResult.ALREADY_USED,
            reason: 'Boleto ya utilizado',
          },
        });

        return {
          ok: false,
          result: ScanResult.ALREADY_USED,
          message: 'Boleto ya fue escaneado',
          ticketId: ticket.id,
        };
      }

      if (ticket.event.endsAt < now) {
        await tx.scanLog.create({
          data: {
            ticketId: ticket.id,
            scannedByUserId: staffUserId,
            gate: dto.gate,
            deviceId: dto.deviceId,
            requestNonce: dto.requestNonce,
            result: ScanResult.EXPIRED,
            reason: 'Evento finalizado',
          },
        });

        return {
          ok: false,
          result: ScanResult.EXPIRED,
          message: 'El boleto expiró',
          ticketId: ticket.id,
        };
      }

      const updatedTicket = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          usedAt: now,
          status: TicketStatus.USED,
        },
      });

      await tx.scanLog.create({
        data: {
          ticketId: ticket.id,
          scannedByUserId: staffUserId,
          gate: dto.gate,
          deviceId: dto.deviceId,
          requestNonce: dto.requestNonce,
          result: ScanResult.VALID,
          reason: 'Acceso permitido',
        },
      });

      return {
        ok: true,
        result: ScanResult.VALID,
        message: 'Boleto válido',
        ticket: {
          id: updatedTicket.id,
          status: updatedTicket.status,
          usedAt: updatedTicket.usedAt,
          event: ticket.event,
          owner: ticket.owner,
        },
      };
    });
  }
}