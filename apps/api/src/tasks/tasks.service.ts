// tasks/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireEndedEventTickets() {
    const now = new Date();

    // 1. Expirar tickets ACTIVE de eventos terminados
    const { count: ticketsExpired } = await this.prisma.ticket.updateMany({
      where: {
        status: 'ACTIVE',
        event: { endsAt: { lt: now } },
      },
      data: { status: 'EXPIRED' },
    });

    // 2. Cancelar transferencias PENDING de eventos terminados
    const { count: transfersCancelled } = await this.prisma.transfer.updateMany({
      where: {
        status: 'PENDING',
        ticket: { event: { endsAt: { lt: now } } },
      },
      data: { status: 'EXPIRED' },
    });

    if (ticketsExpired > 0 || transfersCancelled > 0) {
      this.logger.log(
        `Expirados: ${ticketsExpired} tickets, ${transfersCancelled} transferencias`,
      );
    }
  }
}