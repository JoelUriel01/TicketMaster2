import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TicketTypesService } from './ticket-types.service';
import { TicketTypesController } from './ticket-types.controller';

@Module({
  imports: [PrismaModule],
  providers: [TicketTypesService],
  controllers: [TicketTypesController],
  exports: [TicketTypesService],
})
export class TicketTypesModule {}