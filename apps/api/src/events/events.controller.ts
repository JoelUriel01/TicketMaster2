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

  // ── POST /events ─────────────────────────────────────────
  @Post()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  create(@Body() dto: CreateEventDto, @Req() req: any) {
    return this.eventsService.create(dto, req.user.id);
  }

  // ── GET /events ──────────────────────────────────────────
  @Get()
  findAll() {
    return this.eventsService.findAll();
  }

  // ── GET /events/me ───────────────────────────────────────
  @Get('me')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  findMine(@Req() req: any) {
    return this.eventsService.findMine(req.user.id);
  }

  // ── GET /events/:id ──────────────────────────────────────
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  // ── PATCH /events/:id ────────────────────────────────────
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

  // ── DELETE /events/:id ───────────────────────────────────
  @Delete(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.eventsService.remove(id, req.user.id, req.dbUser.role);
  }

  // ── PATCH /events/:id/publish ────────────────────────────
  @Patch(':id/publish')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  publish(@Param('id') id: string, @Req() req: any) {
    return this.eventsService.publish(id, req.user.id);
  }

  // ── PATCH /events/:id/unpublish ──────────────────────────
  @Patch(':id/unpublish')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  unpublish(@Param('id') id: string, @Req() req: any) {
    return this.eventsService.unpublish(id, req.user.id);
  }

  // ── GET /events/:id/ticket-types (legacy) ────────────────
  @Get(':id/ticket-types')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  findTicketTypes(@Param('id') id: string) {
    return this.eventsService.findTicketTypes(id);
  }

  // ── GET /events/:id/seat-map ─────────────────────────────
  // Endpoint público: devuelve todos los asientos del auditorio
  // con su precio (según la sección) y su estado de ocupación
  // para el evento solicitado. El mapa SVG del comprador consume
  // este endpoint al cargar la página de compra.
  //
  // Response shape (array):
  // [{ id, sectionCode, sectionLabel, colorHex, row, number,
  //    seatLabel, x, y, price, currency, status }, ...]
  @Get(':id/seat-map')
  getSeatMap(@Param('id') id: string) {
    return this.eventsService.getSeatMap(id);
  }
}