import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  create(@Body() dto: CreateEventDto, @Req() req: any) {
    return this.eventsService.create(dto, req.user.id);
  }

  @Get()
  findAll() {
    return this.eventsService.findAll();
  }

  @Get('me')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  findMine(@Req() req: any) {
    return this.eventsService.findMine(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @Req() req: any,
  ) {
    return this.eventsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.eventsService.remove(id, req.user.id, req.dbUser.role);
  }

  @Patch(':id/publish')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZER)
publish(@Param('id') id: string, @Req() req: any) {
  return this.eventsService.publish(id, req.user.id);
}

@Patch(':id/unpublish')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZER)
unpublish(@Param('id') id: string, @Req() req: any) {
  return this.eventsService.unpublish(id, req.user.id);
}

@Get(':id/ticket-types')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZER)
findTicketTypes(@Param('id') id: string) {
  return this.eventsService.findTicketTypes(id);
}

}