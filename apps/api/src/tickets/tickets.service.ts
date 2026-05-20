import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { Prisma, OrderStatus, TicketStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TicketsService {
 constructor(
  private readonly prisma: PrismaService,
  private readonly jwtService: JwtService,
) {}


async create(userId: string, dto: CreateTicketDto) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundException('Usuario no encontrado');
  }

  if (user.role !== 'BUYER') {
    throw new ForbiddenException('Solo los compradores pueden adquirir boletos');
  }

  const event = await this.prisma.event.findUnique({
    where: { id: dto.eventId },
  });

  if (!event) {
    throw new NotFoundException('Evento no encontrado');
  }

  if (!event.isPublished) {
    throw new BadRequestException('El evento no está publicado');
  }

  const ticketType = await this.prisma.ticketType.findFirst({
    where: {
      id: dto.ticketTypeId,
      eventId: dto.eventId,
    },
  });

  if (!ticketType) {
    throw new NotFoundException('Tipo de boleto no encontrado para este evento');
  }

  // calcular ya vendidos de este tipo
  const soldCount = await this.prisma.ticket.count({
    where: {
      eventId: dto.eventId,
      ticketTypeId: ticketType.id,
      // podrías filtrar solo estados activos/used si quieres
    },
  });

  const remaining = ticketType.capacity - soldCount;

  if (remaining <= 0 || dto.quantity > remaining) {
    throw new BadRequestException(
      `No hay suficiente disponibilidad para el tipo ${ticketType.name}. Quedan ${Math.max(
        remaining,
        0,
      )} boletos.`,
    );
  }

  const totalAmount = ticketType.price.mul(dto.quantity);
  const currency = ticketType.currency ?? 'MXN';

  const result = await this.prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        buyerId: userId,
        eventId: dto.eventId,
        totalAmount,
        currency,
        status: 'PENDING',
      },
    });

    const createdTickets: string[] = [];

    for (let i = 0; i < dto.quantity; i++) {
      const ticket = await tx.ticket.create({
        data: {
          eventId: dto.eventId,
          orderId: order.id,
          ownerId: userId,
          price: ticketType.price,
          currency,
          ticketTypeId: ticketType.id,
          ticketType: ticketType.name, // opcional, para compatibilidad
          status: TicketStatus.ACTIVE,
        },
      });

      createdTickets.push(ticket.id);
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PAID }, // o deja PENDING si luego integrarás pagos reales
    });

    const firstTicket = await tx.ticket.findUnique({
      where: { id: createdTickets[0] },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            venueName: true,
            venueCity: true,
            startsAt: true,
          },
        },
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        order: true,
      },
    });

    return {
      orderId: order.id,
      quantity: dto.quantity,
      ticketsCreated: createdTickets.length,
      id: firstTicket!.id,
      eventId: firstTicket!.eventId,
      ownerId: firstTicket!.ownerId,
      status: firstTicket!.status,
      price: firstTicket!.price.toString(),
      currency: firstTicket!.currency,
      createdAt: firstTicket!.createdAt,
    };
  });

  return result;
}

  async findMine(userId: string) {
    const tickets = await this.prisma.ticket.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            venueName: true,
            venueCity: true,
            startsAt: true,
          },
        },
        order: {
          select: {
            id: true,
            totalAmount: true,
            currency: true,
            status: true,
          },
        },
      },
    });

    return tickets.map((ticket) => ({
      id: ticket.id,
      eventId: ticket.eventId,
      orderId: ticket.orderId,
      ownerId: ticket.ownerId,
      quantity: 1,
      status: ticket.status,
      createdAt: ticket.createdAt,
      price: ticket.price.toString(),
      currency: ticket.currency,
      event: ticket.event,
      order: {
        ...ticket.order,
        totalAmount: ticket.order.totalAmount.toString(),
      },
    }));
  }

  async findOneMine(userId: string, id: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id,
        ownerId: userId,
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            venueName: true,
            venueCity: true,
            startsAt: true,
          },
        },
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        order: {
          select: {
            id: true,
            totalAmount: true,
            currency: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Boleto no encontrado');
    }

    return {
      id: ticket.id,
      eventId: ticket.eventId,
      orderId: ticket.orderId,
      buyerId: ticket.ownerId,
      quantity: 1,
      status: ticket.status,
      createdAt: ticket.createdAt,
      price: ticket.price.toString(),
      currency: ticket.currency,
      event: ticket.event,
      buyer: ticket.owner,
      order: {
        ...ticket.order,
        totalAmount: ticket.order.totalAmount.toString(),
      },
    };
  }

  async getQrToken(userId: string, id: string) {
  const ticket = await this.prisma.ticket.findFirst({
    where: {
      id,
      ownerId: userId,
    },
    select: {
      id: true,
      ownerId: true,
      eventId: true,
      status: true,
    },
  });

  if (!ticket) {
    throw new NotFoundException('Boleto no encontrado');
  }

  if (ticket.status !== 'ACTIVE') {
    throw new BadRequestException('Solo los boletos activos pueden generar QR');
  }

  const expiresInSeconds = 300;

  const token = await this.jwtService.signAsync(
    {
      sub: ticket.ownerId,
      ticketId: ticket.id,
      eventId: ticket.eventId,
      type: 'ticket_access',
    },
    {
      secret: process.env.TICKET_QR_SECRET,
      expiresIn: expiresInSeconds,
    },
  );

  return {
    token,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  };
}

}