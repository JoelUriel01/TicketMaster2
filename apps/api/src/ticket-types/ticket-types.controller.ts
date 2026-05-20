import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { TicketTypesService } from './ticket-types.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';

@Controller('events/:eventId/ticket-types')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class TicketTypesController {
  constructor(private readonly ticketTypesService: TicketTypesService) {}

  @Post()
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  createForEvent(@Req() req, @Param('eventId') eventId: string, @Body() dto: CreateTicketTypeDto) {
    return this.ticketTypesService.createForEvent(req.user.id, eventId, dto);
  }

  @Get()
  findForEvent(@Param('eventId') eventId: string) {
    return this.ticketTypesService.findForEvent(eventId);
  }
}