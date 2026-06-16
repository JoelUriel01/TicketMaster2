import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('tickets')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @Roles(UserRole.BUYER)
  create(@Req() req, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(req.user.id, dto);
  }

  @Post('initiate-payment')
  @Roles(UserRole.BUYER)
  initiatePayment(@Req() req, @Body() dto: InitiatePaymentDto) {
    return this.ticketsService.initiatePayment(req.user.id, dto);
  }

  @Get('me')
  @Roles(UserRole.BUYER)
  findMine(@Req() req) {
    return this.ticketsService.findMine(req.user.id);
  }

  // ↓ NUEVO — debe ir antes de @Get(':id')
  @Get('order/:orderId')
  @Roles(UserRole.BUYER)
  findByOrder(@Req() req, @Param('orderId') orderId: string) {
    return this.ticketsService.findByOrder(req.user.id, orderId);
  }

  @Get(':id')
  @Roles(UserRole.BUYER)
  findOneMine(@Req() req, @Param('id') id: string) {
    return this.ticketsService.findOneMine(req.user.id, id);
  }

  @Get(':id/qr-token')
  @Roles(UserRole.BUYER)
  getQrToken(@Req() req, @Param('id') id: string) {
    return this.ticketsService.getQrToken(req.user.id, id);
  }
}