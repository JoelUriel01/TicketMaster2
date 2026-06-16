import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { Prisma, OrderStatus, TicketStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import Stripe from 'stripe';  

@Injectable()
export class TicketsService {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,

  ) {}

  async create(userId: string, dto: CreateTicketDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role !== 'BUYER')
      throw new ForbiddenException('Solo los compradores pueden adquirir boletos');

    const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (!event.isPublished) throw new BadRequestException('El evento no está publicado');
    if (new Date(event.endsAt) < new Date())              // ← agregar
  throw new BadRequestException('Este evento ya finalizó y no acepta compras.');




    // ── MODO MAPA: compra por asientos específicos ────────────────────────────
    if (event.useVenueMap) {
      if (!dto.seatIds || dto.seatIds.length === 0)
        throw new BadRequestException('Se requieren seatIds para eventos con mapa de asientos');

      return this.prisma.$transaction(async (tx) => {
        // 1. Verificar que todos los asientos existen
        const seats = await tx.seat.findMany({
          where: { id: { in: dto.seatIds } },
          include: {
            section: {
              include: {
                eventSectionPrices: {
                  where: { eventId: dto.eventId },
                  select: { price: true, currency: true },
                },
              },
            },
          },
        });

        if (seats.length !== dto.seatIds!.length) {
          const found = seats.map((s) => s.id);
          const missing = dto.seatIds!.filter((id) => !found.includes(id));
          throw new BadRequestException(`Asientos no encontrados: ${missing.join(', ')}`);
        }

        // 2. Verificar disponibilidad — dentro de la transacción para evitar race conditions
        const conflictingTickets = await tx.ticket.findMany({
          where: {
            eventId: dto.eventId,
            seatId: { in: dto.seatIds },
            status: { notIn: ['REVOKED', 'EXPIRED'] },
          },
          select: { seatId: true },
        });

        if (conflictingTickets.length > 0) {
          const taken = conflictingTickets.map((t) => t.seatId).join(', ');
          throw new BadRequestException(`Los siguientes asientos ya no están disponibles: ${taken}`);
        }

        // 3. Calcular total
        const totalAmount = seats.reduce((sum, seat) => {
          const sectionPrice = seat.section.eventSectionPrices[0];
          if (!sectionPrice)
            throw new BadRequestException(
              `El asiento ${seat.id} no tiene precio configurado para este evento`,
            );
          return sum.add(sectionPrice.price);
        }, new Prisma.Decimal(0));

        const currency = seats[0].section.eventSectionPrices[0]?.currency ?? 'MXN';

        // 4. Crear orden
        const order = await tx.order.create({
          data: {
            buyerId: userId,
            eventId: dto.eventId,
            totalAmount,
            currency,
            status: 'PENDING',
          },
        });

        // 5. Crear un ticket por cada asiento
        const createdTickets = await Promise.all(
          seats.map((seat) => {
            const sectionPrice = seat.section.eventSectionPrices[0];
            return tx.ticket.create({
              data: {
                eventId: dto.eventId,
                orderId: order.id,
                ownerId: userId,
                seatId: seat.id,
                seatSection: seat.section.code,
                seatRow: seat.row,
                seatNumber: seat.number,
                seatLabel: seat.seatLabel ?? `Fila ${seat.row}, Asiento ${seat.number}`,
                price: sectionPrice.price,
                currency: sectionPrice.currency ?? 'MXN',
                status: TicketStatus.ACTIVE,
              },
            });
          }),
        );

        // 6. Marcar orden como pagada
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.PAID },
        });

        return {
          orderId: order.id,
          quantity: createdTickets.length,
          ticketsCreated: createdTickets.length,
          id: createdTickets[0].id,
          eventId: dto.eventId,
          ownerId: userId,
          status: createdTickets[0].status,
          price: totalAmount.toString(),
          currency,
          createdAt: createdTickets[0].createdAt,
        };
      });
    }

    // ── MODO CLÁSICO: compra por ticketType + quantity ────────────────────────
    //
    // BUG FIX: La validación de capacidad se hace DENTRO de la transacción para
    // evitar el race condition donde dos requests concurrentes leen el mismo
    // soldCount antes de que cualquiera haya insertado sus tickets.
    // Al estar dentro de $transaction con isolationLevel Serializable (o el
    // default RepeatableRead de Postgres), Prisma garantiza que el conteo
    // y la inserción son atómicos respecto a otras transacciones concurrentes.

    const ticketType = await this.prisma.ticketType.findFirst({
      where: { id: dto.ticketTypeId, eventId: dto.eventId },
    });
    if (!ticketType)
      throw new NotFoundException('Tipo de boleto no encontrado para este evento');

    const qty = dto.quantity ?? 1;
    if (qty < 1) throw new BadRequestException('La cantidad debe ser al menos 1');

    const currency = ticketType.currency ?? 'MXN';
    const totalAmount = ticketType.price.mul(qty);

    return this.prisma.$transaction(
      async (tx) => {
        // ── Conteo DENTRO de la transacción (lectura consistente) ──────────────
        const soldCount = await tx.ticket.count({
          where: {
            eventId: dto.eventId,
            ticketTypeId: ticketType.id,
            // Solo contamos boletos "vivos": excluimos revocados y expirados
            status: { notIn: [TicketStatus.REVOKED, TicketStatus.EXPIRED] },
          },
        });

        const remaining = ticketType.capacity - soldCount;

        if (remaining <= 0) {
          throw new BadRequestException(
            `El tipo de boleto "${ticketType.name}" está agotado.`,
          );
        }

        if (qty > remaining) {
          throw new BadRequestException(
            `Solo quedan ${remaining} lugar(es) disponible(s) para "${ticketType.name}". ` +
              `Solicitaste ${qty}.`,
          );
        }

        // ── Crear orden ────────────────────────────────────────────────────────
        const order = await tx.order.create({
          data: {
            buyerId: userId,
            eventId: dto.eventId,
            totalAmount,
            currency,
            status: 'PENDING',
          },
        });

        // ── Crear tickets ──────────────────────────────────────────────────────
        const createdTicketIds: string[] = [];
        for (let i = 0; i < qty; i++) {
          const ticket = await tx.ticket.create({
            data: {
              eventId: dto.eventId,
              orderId: order.id,
              ownerId: userId,
              price: ticketType.price,
              currency,
              ticketTypeId: ticketType.id,
              ticketType: ticketType.name,
              status: TicketStatus.ACTIVE,
            },
          });
          createdTicketIds.push(ticket.id);
        }

        // ── Marcar orden como pagada ───────────────────────────────────────────
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.PAID },
        });

        // ── Devolver resumen ───────────────────────────────────────────────────
        const firstTicket = await tx.ticket.findUnique({
          where: { id: createdTicketIds[0] },
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
            owner: { select: { id: true, fullName: true, email: true } },
            order: true,
          },
        });

        return {
          orderId: order.id,
          quantity: qty,
          ticketsCreated: createdTicketIds.length,
          id: firstTicket!.id,
          eventId: firstTicket!.eventId,
          ownerId: firstTicket!.ownerId,
          status: firstTicket!.status,
          price: firstTicket!.price.toString(),
          currency: firstTicket!.currency,
          createdAt: firstTicket!.createdAt,
        };
      },
      // Isolation level Serializable evita que dos transacciones concurrentes
      // lean el mismo soldCount y ambas "pasen" la validación de capacidad.
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
           endsAt: true,
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

async findByOrder(userId: string, orderId: string) {
  // Verificar que la orden pertenece al usuario
  const order = await this.prisma.order.findFirst({
    where: { id: orderId, buyerId: userId },
    select: {
      id: true,
      status: true,
      totalAmount: true,
      currency: true,
      createdAt: true,
      eventId: true,
    },
  });
 
  if (!order) throw new NotFoundException('Orden no encontrada');
 
  const tickets = await this.prisma.ticket.findMany({
    where: { orderId, ownerId: userId },
    orderBy: { createdAt: 'asc' },
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
    },
  });
 
  return {
    id: order.id,
    status: order.status,
    totalAmount: order.totalAmount.toString(),
    currency: order.currency,
    createdAt: order.createdAt,
    event: tickets[0]?.event ?? null,
    tickets: tickets.map((t) => ({
      id: t.id,
      eventId: t.eventId,
      orderId: t.orderId,
      status: t.status,
      price: t.price.toString(),
      currency: t.currency,
      ticketType: t.ticketType ?? undefined,
      seatLabel: t.seatLabel ?? undefined,
      seatSection: t.seatSection ?? undefined,
      seatRow: t.seatRow ?? undefined,
      seatNumber: t.seatNumber ?? undefined,
      createdAt: t.createdAt,
      event: t.event,
    })),
  };
}


  async findOneMine(userId: string, id: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, ownerId: userId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            venueName: true,
            venueCity: true,
            startsAt: true,
            endsAt: true,
          },
        },
        owner: {
          select: { id: true, fullName: true, email: true },
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
        seat: {
          select: {
            id: true,
            row: true,
            number: true,
            seatLabel: true,
            section: { select: { code: true, label: true, colorHex: true } },
          },
        },
        ticketTypeRef: {
          select: { id: true, name: true, description: true },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Boleto no encontrado');

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
      // Datos de asiento (null en modo clásico)
      seat: ticket.seat ?? null,
      seatLabel: ticket.seatLabel ?? null,
      // Datos de tipo de boleto (null en modo mapa)
      ticketType: ticket.ticketTypeRef ?? null,
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
      where: { id, ownerId: userId },
      select: {
        id: true,
        ownerId: true,
        eventId: true,
        status: true,
      },
    });

    if (!ticket) throw new NotFoundException('Boleto no encontrado');

    if (ticket.status !== TicketStatus.ACTIVE) {
      throw new BadRequestException('Solo los boletos activos pueden generar QR');
    }

    const expiresInSeconds = 15;

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

  // ─────────────────────────────────────────────────────────────
// STRIPE: Iniciar pago (crea PaymentIntent y orden PENDING)
// ─────────────────────────────────────────────────────────────
async initiatePayment(userId: string, dto: InitiatePaymentDto) {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundException('Usuario no encontrado');
  if (user.role !== 'BUYER')
    throw new ForbiddenException('Solo los compradores pueden adquirir boletos');

  const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
  if (!event) throw new NotFoundException('Evento no encontrado');
  if (!event.isPublished) throw new BadRequestException('El evento no está publicado');
  if (new Date(event.endsAt) < new Date())
    throw new BadRequestException('Este evento ya finalizó.');

  let totalAmount: Prisma.Decimal;
  let currency = 'MXN';
  const metadata: Record<string, string> = { userId, eventId: dto.eventId };

  if (event.useVenueMap) {
    if (!dto.seatIds || dto.seatIds.length === 0)
      throw new BadRequestException('Se requieren seatIds para eventos con mapa');

    const seats = await this.prisma.seat.findMany({
      where: { id: { in: dto.seatIds } },
      include: {
        section: {
          include: {
            eventSectionPrices: {
              where: { eventId: dto.eventId },
              select: { price: true, currency: true },
            },
          },
        },
      },
    });

    if (seats.length !== dto.seatIds.length)
      throw new BadRequestException('Algunos asientos no fueron encontrados');

    const taken = await this.prisma.ticket.findMany({
      where: {
        eventId: dto.eventId,
        seatId: { in: dto.seatIds },
        status: { notIn: [TicketStatus.REVOKED, TicketStatus.EXPIRED] },
      },
      select: { seatId: true },
    });
    if (taken.length > 0)
      throw new BadRequestException('Algunos asientos ya no están disponibles');

    totalAmount = seats.reduce((sum, seat) => {
      const sp = seat.section.eventSectionPrices[0];
      if (!sp)
        throw new BadRequestException(`Asiento ${seat.id} sin precio configurado`);
      return sum.add(sp.price);
    }, new Prisma.Decimal(0));

    currency = seats[0].section.eventSectionPrices[0]?.currency ?? 'MXN';
    metadata.mode = 'map';
    metadata.seatIds = dto.seatIds.join(',');
  } else {
    const ticketType = await this.prisma.ticketType.findFirst({
      where: { id: dto.ticketTypeId, eventId: dto.eventId },
    });
    if (!ticketType) throw new NotFoundException('Tipo de boleto no encontrado');

    const qty = dto.quantity ?? 1;
    const soldCount = await this.prisma.ticket.count({
      where: {
        eventId: dto.eventId,
        ticketTypeId: ticketType.id,
        status: { notIn: [TicketStatus.REVOKED, TicketStatus.EXPIRED] },
      },
    });
    const remaining = ticketType.capacity - soldCount;
    if (remaining <= 0)
      throw new BadRequestException(`"${ticketType.name}" está agotado.`);
    if (qty > remaining)
      throw new BadRequestException(`Solo quedan ${remaining} lugar(es).`);

    totalAmount = ticketType.price.mul(qty);
    currency = ticketType.currency ?? 'MXN';
    metadata.mode = 'classic';
    metadata.ticketTypeId = ticketType.id;
    metadata.quantity = qty.toString();
  }

  // ── Boletos gratuitos: saltar Stripe y crear tickets directamente ────────
  if (Number(totalAmount) === 0) {
    const freeOrder = await this.prisma.order.create({
      data: {
        buyerId: userId,
        eventId: dto.eventId,
        totalAmount,
        currency,
        status: 'PENDING',
      },
    });

    await this.prisma.$transaction(async (tx) => {
      if (metadata.mode === 'map') {
        const seats = await tx.seat.findMany({
          where: { id: { in: dto.seatIds } },
          include: {
            section: {
              include: {
                eventSectionPrices: {
                  where: { eventId: dto.eventId },
                  select: { price: true, currency: true },
                },
              },
            },
          },
        });
        for (const seat of seats) {
          await tx.ticket.create({
            data: {
              eventId: dto.eventId,
              orderId: freeOrder.id,
              ownerId: userId,
              seatId: seat.id,
              seatSection: seat.section.code,
              seatRow: seat.row,
              seatNumber: seat.number,
              seatLabel: seat.seatLabel ?? `Fila ${seat.row}, Asiento ${seat.number}`,
              price: new Prisma.Decimal(0),
              currency,
              status: TicketStatus.ACTIVE,
            },
          });
        }
      } else {
        const ticketType = await tx.ticketType.findFirst({
          where: { id: dto.ticketTypeId, eventId: dto.eventId },
        });
        if (!ticketType) throw new NotFoundException('Tipo de boleto no encontrado');
        const qty = dto.quantity ?? 1;
        for (let i = 0; i < qty; i++) {
          await tx.ticket.create({
            data: {
              eventId: dto.eventId,
              orderId: freeOrder.id,
              ownerId: userId,
              price: new Prisma.Decimal(0),
              currency,
              ticketTypeId: ticketType.id,
              ticketType: ticketType.name,
              status: TicketStatus.ACTIVE,
            },
          });
        }
      }

      await tx.order.update({
        where: { id: freeOrder.id },
        data: { status: OrderStatus.PAID },
      });
    });

    return {
      free: true,
      clientSecret: null,
      orderId: freeOrder.id,
      amount: '0',
      currency,
    };
  }
  // ── fin boletos gratuitos ────────────────────────────────────────────────

  // Crear orden PENDING en la BD
  const order = await this.prisma.order.create({
    data: {
      buyerId: userId,
      eventId: dto.eventId,
      totalAmount,
      currency,
      status: 'PENDING',
    },
  });

  metadata.orderId = order.id;

  // Crear PaymentIntent en Stripe
  const paymentIntent = await this.stripe.paymentIntents.create({
    amount: Math.round(Number(totalAmount) * 100),
    currency: currency.toLowerCase(),
    metadata,
    automatic_payment_methods: { enabled: true },
  });

  return {
    free: false,
    clientSecret: paymentIntent.client_secret,
    orderId: order.id,
    amount: totalAmount.toString(),
    currency,
  };
}

// ─────────────────────────────────────────────────────────────
// STRIPE: Crear tickets tras confirmación del webhook
// ─────────────────────────────────────────────────────────────
async createAfterPayment(intentId: string) {
  const paymentIntent = await this.stripe.paymentIntents.retrieve(intentId);
  const { orderId, userId, eventId, mode, seatIds, ticketTypeId, quantity } =
    paymentIntent.metadata;

  // Idempotencia: si ya fue procesado, no hacer nada
  const order = await this.prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status === OrderStatus.PAID) return;

  if (mode === 'map') {
    const seatIdList = seatIds.split(',');
    const seats = await this.prisma.seat.findMany({
      where: { id: { in: seatIdList } },
      include: {
        section: {
          include: {
            eventSectionPrices: {
              where: { eventId },
              select: { price: true, currency: true },
            },
          },
        },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const seat of seats) {
        const sp = seat.section.eventSectionPrices[0];
        await tx.ticket.create({
          data: {
            eventId,
            orderId,
            ownerId: userId,
            seatId: seat.id,
            seatSection: seat.section.code,
            seatRow: seat.row,
            seatNumber: seat.number,
            seatLabel: seat.seatLabel ?? `Fila ${seat.row}, Asiento ${seat.number}`,
            price: sp?.price ?? new Prisma.Decimal(0),
            currency: sp?.currency ?? 'MXN',
            status: TicketStatus.ACTIVE,
          },
        });
      }
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PAID },
      });
    });
  } else {
    const qty = parseInt(quantity);
    const ticketType = await this.prisma.ticketType.findUnique({
  where: { id: ticketTypeId },
});
if (!ticketType) {
  // Lanzar para que el webhook devuelva 500 y Stripe reintente
  throw new NotFoundException(
    `TicketType ${ticketTypeId} no encontrado al procesar intent ${intentId}`,
  );
}
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < qty; i++) {
        await tx.ticket.create({
          data: {
            eventId,
            orderId,
            ownerId: userId,
            price: ticketType.price,
            currency: ticketType.currency ?? 'MXN',
            ticketTypeId: ticketType.id,
            ticketType: ticketType.name,
            status: TicketStatus.ACTIVE,
          },
        });
      }
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PAID },
      });
    });
  }
}



}
