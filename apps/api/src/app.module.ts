import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { TicketsModule } from './tickets/tickets.module';
import { TransfersModule } from './transfers/transfers.module';
import { ScansModule } from './scans/scans.module';
import { TicketTypesModule } from './ticket-types/ticket-types.module';



@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HealthModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    EventsModule,
    TicketsModule,
    TransfersModule,
    ScansModule,
    TicketTypesModule,

  ],
})
export class AppModule {}