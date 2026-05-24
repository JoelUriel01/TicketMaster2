import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Prisma } from '@prisma/client';


@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── CREATE ────────────────────────────────────────────────
  async create(dto: CreateEventDto, organizerId: string) {
    const useMap = dto.useVenueMap !== false;

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          title: dto.title,
          description: dto.description,
          venueName: dto.venueName,
          venueCity: dto.venueCity,
          startsAt: new Date(dto.startsAt),
          endsAt: new Date(dto.endsAt),
          isPublished: dto.isPublished ?? false,
          bannerUrl: dto.bannerUrl,
          category: dto.category,
          useVenueMap: useMap,
          organizerId,
        },
      });

      if (useMap) {
        const codes = (dto.sectionPrices ?? []).map((sp) => sp.sectionCode);
        if (codes.length === 0) {
          throw new BadRequestException(
            'Se requieren sectionPrices cuando useVenueMap es true',
          );
        }

        const sections = await tx.venueSection.findMany({
          where: { code: { in: codes } },
          select: { id: true, code: true },
        });

        if (sections.length !== codes.length) {
          const found = sections.map((s) => s.code);
          const missing = codes.filter((c) => !found.includes(c));
          throw new BadRequestException(
            `Secciones no encontradas en BD: ${missing.join(', ')}`,
          );
        }

        const codeToId = Object.fromEntries(sections.map((s) => [s.code, s.id]));

        await tx.eventSectionPrice.createMany({
          data: dto.sectionPrices!.map((sp) => ({
            eventId: event.id,
            sectionId: codeToId[sp.sectionCode],
            price: sp.price,
            currency: sp.currency ?? 'MXN',
          })),
        });
      } else {
        const types = dto.ticketTypes ?? [];
        if (types.length === 0) {
          throw new BadRequestException(
            'Se requiere al menos un ticketType cuando useVenueMap es false',
          );
        }

        await tx.ticketType.createMany({
          data: types.map((tt) => ({
            eventId: event.id,
            name: tt.name,
            description: tt.description,
            price: new Prisma.Decimal(tt.price),
            currency: tt.currency ?? 'MXN',
            capacity: tt.capacity,
          })),
        });
      }

      return tx.event.findUnique({
        where: { id: event.id },
        include: {
          eventSectionPrices: {
            include: { section: { select: { code: true, label: true, colorHex: true } } },
          },
          ticketTypes: {
            select: { id: true, name: true, price: true, currency: true, capacity: true },
          },
        },
      });
    });
  }

  // ── FIND ALL (públicos) ───────────────────────────────────
  async findAll() {
    return this.prisma.event.findMany({
      where: { isPublished: true },
      orderBy: { startsAt: 'asc' },
      include: {
        organizer: { select: { id: true, fullName: true, email: true } },
        eventSectionPrices: {
          include: { section: { select: { code: true, label: true, colorHex: true } } },
        },
      },
    });
  }

  // ── FIND MINE (organizador) ───────────────────────────────
  async findMine(organizerId: string) {
    return this.prisma.event.findMany({
      where: { organizerId },
      orderBy: { startsAt: 'asc' },
      include: {
        eventSectionPrices: {
          include: { section: { select: { code: true, label: true, colorHex: true } } },
        },
        ticketTypes: {
          select: { id: true, name: true, price: true, currency: true, capacity: true },
        },
      },
    });
  }

  // ── FIND ONE ──────────────────────────────────────────────
  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        organizer: { select: { id: true, fullName: true, email: true } },
        ticketTypes: {
          select: { id: true, name: true, price: true, currency: true, capacity: true },
        },
        eventSectionPrices: {
          include: { section: { select: { code: true, label: true, colorHex: true } } },
        },
      },
    });
    if (!event) throw new NotFoundException('Evento no encontrado');
    return event;
  }

  // ── UPDATE ────────────────────────────────────────────────
  // Soporta actualización de campos base, sectionPrices (modo mapa)
  // y ticketTypes (modo clásico).
  //
  // Reglas para ticketTypes:
  //   • Si el TicketType tiene `id` → se actualiza (nombre, descripción, precio, capacidad)
  //     SOLO si no tiene boletos vendidos con status activo; si los tiene, solo se permite
  //     cambiar capacity hacia arriba o cambiar precio/descripción, nunca reducir capacity
  //     por debajo de los boletos ya vendidos.
  //   • Si no tiene `id` → se crea como nuevo tipo.
  //   • Los tipos que ya existían y NO vienen en el array se eliminan SOLO si no tienen
  //     boletos vendidos; de lo contrario se ignoran (no se eliminan para no romper
  //     registros históricos).
  async update(id: string, dto: UpdateEventDto, requesterId: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (event.organizerId !== requesterId) {
      throw new ForbiddenException('Solo el organizador puede editar este evento');
    }

    const { sectionPrices, ticketTypes, useVenueMap, ...eventFields } = dto;

    return this.prisma.$transaction(async (tx) => {
      // ── Actualizar campos base del evento ──────────────────
      await tx.event.update({
        where: { id },
        data: {
          ...eventFields,
          startsAt: eventFields.startsAt ? new Date(eventFields.startsAt) : undefined,
          endsAt: eventFields.endsAt ? new Date(eventFields.endsAt) : undefined,
        },
      });

      // ── Actualizar precios de sección (modo mapa) ──────────
      if (sectionPrices && sectionPrices.length > 0) {
        const codes = sectionPrices.map((sp) => sp.sectionCode);
        const sections = await tx.venueSection.findMany({
          where: { code: { in: codes } },
          select: { id: true, code: true },
        });

        if (sections.length !== codes.length) {
          const found = sections.map((s) => s.code);
          const missing = codes.filter((c) => !found.includes(c));
          throw new BadRequestException(
            `Secciones no encontradas en BD: ${missing.join(', ')}`,
          );
        }

        const codeToId = Object.fromEntries(sections.map((s) => [s.code, s.id]));

        await Promise.all(
          sectionPrices.map((sp) =>
            tx.eventSectionPrice.upsert({
              where: {
                eventId_sectionId: { eventId: id, sectionId: codeToId[sp.sectionCode] },
              },
              update: { price: sp.price, currency: sp.currency ?? 'MXN' },
              create: {
                eventId: id,
                sectionId: codeToId[sp.sectionCode],
                price: sp.price,
                currency: sp.currency ?? 'MXN',
              },
            }),
          ),
        );
      }

      // ── Actualizar tipos de boleto (modo clásico) ──────────
      if (ticketTypes && ticketTypes.length > 0) {
        const incomingIds = ticketTypes
          .filter((tt) => tt.id)
          .map((tt) => tt.id as string);

        // Tipos existentes en BD para este evento
        const existingTypes = await tx.ticketType.findMany({
          where: { eventId: id },
          select: { id: true },
        });
        const existingIds = existingTypes.map((t) => t.id);

        // Tipos que ya no vienen en el body → candidatos a eliminar
        const toRemoveIds = existingIds.filter((eid) => !incomingIds.includes(eid));

        // Eliminar solo los que no tengan boletos vendidos
        if (toRemoveIds.length > 0) {
          const ticketsOnRemoving = await tx.ticket.count({
            where: {
              ticketTypeId: { in: toRemoveIds },
              status: { notIn: ['REVOKED', 'EXPIRED'] },
            },
          });

          if (ticketsOnRemoving > 0) {
            // No eliminamos; hay boletos activos vinculados a esos tipos.
            // El organizador debe revocarlos manualmente si quiere eliminarlos.
          } else {
            await tx.ticketType.deleteMany({ where: { id: { in: toRemoveIds } } });
          }
        }

        // Upsert de cada tipo
        for (const tt of ticketTypes) {
          if (tt.id) {
            // ── Actualizar tipo existente ──────────────────────
            // Verificar que no se reduzca capacity por debajo de boletos vendidos
            const soldForType = await tx.ticket.count({
              where: {
                ticketTypeId: tt.id,
                status: { notIn: ['REVOKED', 'EXPIRED'] },
              },
            });

            if (tt.capacity !== undefined && tt.capacity < soldForType) {
              throw new BadRequestException(
                `No puedes reducir la capacidad de "${tt.name ?? 'este tipo'}" ` +
                  `a ${tt.capacity} porque ya se vendieron ${soldForType} boleto(s).`,
              );
            }

            await tx.ticketType.update({
              where: { id: tt.id },
              data: {
                name: tt.name,
                description: tt.description,
                price: tt.price !== undefined ? new Prisma.Decimal(tt.price) : undefined,
                currency: tt.currency ?? 'MXN',
                capacity: tt.capacity,
              },
            });
          } else {
            // ── Crear nuevo tipo ───────────────────────────────
            await tx.ticketType.create({
              data: {
                eventId: id,
                name: tt.name!,
                description: tt.description,
                price: new Prisma.Decimal(tt.price!),
                currency: tt.currency ?? 'MXN',
                capacity: tt.capacity!,
              },
            });
          }
        }
      }

      // ── Devolver evento actualizado con todo incluido ──────
      return tx.event.findUnique({
        where: { id },
        include: {
          eventSectionPrices: {
            include: { section: { select: { code: true, label: true, colorHex: true } } },
          },
          ticketTypes: {
            select: { id: true, name: true, price: true, currency: true, capacity: true },
          },
        },
      });
    });
  }

  // ── REMOVE ────────────────────────────────────────────────
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

  // ── PUBLISH / UNPUBLISH ───────────────────────────────────
  async publish(id: string, requesterId: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (event.organizerId !== requesterId)
      throw new ForbiddenException('Solo el organizador puede publicar este evento');

    return this.prisma.event.update({ where: { id }, data: { isPublished: true } });
  }

  async unpublish(id: string, requesterId: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (event.organizerId !== requesterId)
      throw new ForbiddenException('Solo el organizador puede despublicar este evento');

    return this.prisma.event.update({ where: { id }, data: { isPublished: false } });
  }

  // ── TICKET TYPES (legacy / consulta) ─────────────────────
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

  // ── SEAT MAP ──────────────────────────────────────────────
  async getSeatMap(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) throw new NotFoundException('Evento no encontrado');

    const seats = await this.prisma.seat.findMany({
      orderBy: [{ sectionId: 'asc' }, { row: 'asc' }, { number: 'asc' }],
      include: {
        section: {
          select: {
            code: true,
            label: true,
            colorHex: true,
            eventSectionPrices: {
              where: { eventId },
              select: { price: true, currency: true },
            },
          },
        },
      },
    });

    const issuedTickets = await this.prisma.ticket.findMany({
      where: {
        eventId,
        seatId: { not: null },
        status: { notIn: ['REVOKED', 'EXPIRED'] },
      },
      select: { seatId: true, status: true },
    });

    const heldTickets = await this.prisma.ticket.findMany({
      where: {
        eventId,
        seatId: { not: null },
        status: 'ACTIVE',
        order: {
          status: 'PENDING',
          createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
        },
      },
      select: { seatId: true },
    });

    const soldSet = new Set(issuedTickets.map((t) => t.seatId));
    const heldSet = new Set(heldTickets.map((t) => t.seatId));

    return seats.map((seat) => {
      const sectionPrice = seat.section.eventSectionPrices[0];

      let status: 'available' | 'sold' | 'held' = 'available';
      if (soldSet.has(seat.id)) status = 'sold';
      else if (heldSet.has(seat.id)) status = 'held';

      return {
        id: seat.id,
        sectionCode: seat.section.code,
        sectionLabel: seat.section.label,
        colorHex: seat.section.colorHex,
        row: seat.row,
        number: seat.number,
        seatLabel: seat.seatLabel ?? `Fila ${seat.row}, Asiento ${seat.number}`,
        x: seat.x,
        y: seat.y,
        price: sectionPrice ? Number(sectionPrice.price) : null,
        currency: sectionPrice?.currency ?? 'MXN',
        status,
      };
    });
  }
}
