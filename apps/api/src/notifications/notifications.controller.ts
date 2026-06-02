import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { NotificationsService } from './notifications.service';

export class SubscribeDto {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export class UnsubscribeDto {
  endpoint: string;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications/vapid-public-key
   * Endpoint público: el SW lo llama al registrarse para obtener
   * la applicationServerKey necesaria para pushManager.subscribe().
   */
  @Get('vapid-public-key')
  getVapidPublicKey() {
    return { publicKey: this.notificationsService.getVapidPublicKey() };
  }

  /**
   * POST /notifications/subscribe
   * Body: { endpoint, keys: { p256dh, auth } }
   * El frontend lo llama justo después de que el usuario acepta las notificaciones.
   */
  @Post('subscribe')
  @UseGuards(SupabaseAuthGuard)
  subscribe(@Body() dto: SubscribeDto, @Req() req: any) {
    return this.notificationsService.subscribe(req.user.id, dto);
  }

  /**
   * DELETE /notifications/subscribe
   * Body: { endpoint }
   * El frontend lo llama cuando el usuario desactiva las notificaciones.
   */
  @Delete('subscribe')
  @UseGuards(SupabaseAuthGuard)
  unsubscribe(@Body() dto: UnsubscribeDto, @Req() req: any) {
    return this.notificationsService.unsubscribe(req.user.id, dto.endpoint);
  }
}
