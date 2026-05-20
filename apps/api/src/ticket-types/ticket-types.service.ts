import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TicketTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async createForEvent(organizerId: string, eventId: string, dto: CreateTicketTypeDto) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Evento no encontrado');
    }

    if (event.organizerId !== organizerId) {
      throw new ForbiddenException('Solo el organizador puede definir tipos de boleto');
    }

    const priceDecimal = new Prisma.Decimal(dto.price);

    const ticketType = await this.prisma.ticketType.create({
      data: {
        eventId,
        name: dto.name,
        description: dto.description,
        price: priceDecimal,
        currency: dto.currency ?? 'MXN',
        capacity: dto.capacity,
      },
    });

    return ticketType;
  }

  async findForEvent(eventId: string) {
    const types = await this.prisma.ticketType.findMany({
      where: { eventId },
      orderBy: { price: 'asc' },
    });

    return types;
  }
}