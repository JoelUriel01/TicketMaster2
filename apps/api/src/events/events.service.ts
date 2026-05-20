import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

    async create(dto: CreateEventDto, organizerId: string) {
    return this.prisma.event.create({
        data: {
        title: dto.title,
        description: dto.description,
        venueName: dto.venueName,
        venueCity: dto.venueCity,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        isPublished: dto.isPublished ?? false,
        organizerId,
        },
    });
    }

  async findAll() {
  return this.prisma.event.findMany({
    where: {
      isPublished: true,
    },
    orderBy: { startsAt: 'asc' },
    include: {
      organizer: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
}

  async findMine(organizerId: string) {
    return this.prisma.event.findMany({
      where: { organizerId },
      orderBy: { startsAt : 'asc' },
    });
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: { id: true, fullName: true, email: true },
        },
        ticketTypes: {
          select: {
            id: true,
            name: true,
            price: true,
            currency: true,
            // capacity, etc. si lo necesitas
          },
        },
      },
    });

    if (!event) throw new NotFoundException('Evento no encontrado');
    return event;
  }

  async update(id: string, dto: UpdateEventDto, requesterId: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });

    if (!event) throw new NotFoundException('Evento no encontrado');

    if (event.organizerId !== requesterId) {
      throw new ForbiddenException('Solo el organizador puede editar este evento');
    }

    return this.prisma.event.update({
      where: { id },
      data: {
        ...dto,
        startsAt: dto.startsAt  ? new Date(dto.startsAt ) : undefined,
        endsAt: dto.endsAt  ? new Date(dto.endsAt ) : undefined,
      },
    });
  }

  async remove(id: string, requesterId: string, requesterRole: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });

    if (!event) throw new NotFoundException('Evento no encontrado');

    const isOwner = event.organizerId === requesterId;
    const isAdmin = requesterRole === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('No tienes permiso para eliminar este evento');
    }

    return this.prisma.event.delete({ where: { id } });
  }

  async publish(id: string, requesterId: string) {
  const event = await this.prisma.event.findUnique({
    where: { id },
  });

  if (!event) {
    throw new NotFoundException('Evento no encontrado');
  }

  if (event.organizerId !== requesterId) {
    throw new ForbiddenException('Solo el organizador puede publicar este evento');
  }

  return this.prisma.event.update({
    where: { id },
    data: {
      isPublished: true,
    },
  });
}

async unpublish(id: string, requesterId: string) {
  const event = await this.prisma.event.findUnique({
    where: { id },
  });

  if (!event) {
    throw new NotFoundException('Evento no encontrado');
  }

  if (event.organizerId !== requesterId) {
    throw new ForbiddenException('Solo el organizador puede despublicar este evento');
  }

  return this.prisma.event.update({
    where: { id },
    data: {
      isPublished: false,
    },
  });
}

async findTicketTypes(eventId: string) {
  return this.prisma.ticketType.findMany({
    where: { eventId },
    orderBy: { price: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      currency: true,
      capacity: true,
    },
  });
}

}

