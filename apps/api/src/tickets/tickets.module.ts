import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { PaymentsWebhookController } from './payments-webhook.controller';


@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.TICKET_QR_SECRET,
      signOptions: { algorithm: 'HS256' },
    }),
  ],
  controllers: [TicketsController, PaymentsWebhookController],
  providers: [TicketsService],
})
export class TicketsModule {}