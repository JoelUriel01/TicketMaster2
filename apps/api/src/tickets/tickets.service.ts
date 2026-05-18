import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TicketsService {
 constructor(
  private readonly prisma: PrismaService,
  private readonly jwtService: JwtService,
) {}

  private readonly TICKET_PRICE = new Prisma.Decimal('250.00');
  private readonly CURRENCY = 'MXN';

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

    const totalAmount = this.TICKET_PRICE.mul(dto.quantity);

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          buyerId: userId,
          eventId: dto.eventId,
          totalAmount,
          currency: this.CURRENCY,
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
            price: this.TICKET_PRICE,
            currency: this.CURRENCY,
            ticketType: 'GENERAL',
            status: 'ACTIVE',
          },
        });

        createdTickets.push(ticket.id);
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAID' },
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
  const nowSeconds = Math.floor(Date.now() / 1000);

  const token = await this.jwtService.signAsync(
    {
      sub: ticket.ownerId,
      ticketId: ticket.id,
      eventId: ticket.eventId,
      type: 'ticket_access',
      iat: nowSeconds,
      exp: nowSeconds + expiresInSeconds,
    },
    {
      secret: process.env.TICKET_QR_SECRET,
    },
  );

  return {
    token,
    expiresAt: new Date((nowSeconds + expiresInSeconds) * 1000).toISOString(),
  };
}

}