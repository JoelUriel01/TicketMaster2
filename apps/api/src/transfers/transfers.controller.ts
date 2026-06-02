import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { RespondTransferDto } from './dto/respond-transfer.dto';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { UseGuards } from '@nestjs/common';

/**
 * Decorador temporal — reemplaza con el guard de JWT que ya tengas en el proyecto.
 * Asumimos que el guard inyecta req.user.id como CurrentUser.
 *
 * Si tu proyecto ya usa un decorador @CurrentUser() y @UseGuards(JwtAuthGuard),
 * simplemente reemplaza los comentarios TODO con esos decoradores.
 */
import type { Request } from 'express';
import { Req } from '@nestjs/common';



@Controller('transfers')
@UseGuards(SupabaseAuthGuard) 
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  /**
   * POST /transfers
   * El remitente inicia la transferencia enviando el payload + su firma ECDSA.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateTransferDto,
    @Req() req: Request,
  ) {
    // TODO: reemplazar con @CurrentUser() cuando integres el JWT guard
    const senderId = (req as any).user?.id;
    return this.transfersService.create(senderId, dto);
  }

  /**
   * POST /transfers/:id/respond
   * El receptor acepta (ACCEPT) o rechaza (REJECT) la transferencia
   * enviando su propia firma ECDSA.
   */
  @Post(':id/respond')
  @HttpCode(HttpStatus.OK)
  respond(
    @Param('id', ParseUUIDPipe) transferId: string,
    @Body() dto: RespondTransferDto,
    @Req() req: Request,
  ) {
    const recipientId = (req as any).user?.id;
    // Aseguramos que el transferId del param y del body coincidan
    dto.transferId = transferId;
    return this.transfersService.respond(recipientId, dto);
  }

  /**
   * PATCH /transfers/:id/cancel
   * El remitente cancela una transferencia pendiente.
   * No requiere firma adicional porque el usuario ya está autenticado con JWT.
   */
  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id', ParseUUIDPipe) transferId: string,
    @Req() req: Request,
  ) {
    const senderId = (req as any).user?.id;
    return this.transfersService.cancel(senderId, transferId);
  }

  /**
   * GET /transfers/incoming
   * Lista las transferencias donde el usuario autenticado es el receptor.
   */
  @Get('incoming')
  findIncoming(@Req() req: Request) {
    const userId = (req as any).user?.id;
    return this.transfersService.findIncoming(userId);
  }

  /**
   * GET /transfers/outgoing
   * Lista las transferencias donde el usuario autenticado es el remitente.
   */
  @Get('outgoing')
  findOutgoing(@Req() req: Request) {
    const userId = (req as any).user?.id;
    return this.transfersService.findOutgoing(userId);
  }
}