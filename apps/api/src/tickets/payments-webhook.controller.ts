import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import Stripe from 'stripe';
import { TicketsService } from './tickets.service';

@Controller('payments')
export class PaymentsWebhookController {
  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  private readonly logger = new Logger(PaymentsWebhookController.name);

  constructor(private readonly ticketsService: TicketsService) {}

  @Post('webhook')
  @HttpCode(200)
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException(
        'rawBody no disponible — configura { rawBody: true } en main.ts',
      );
    }

    // ✅ Sin "let event: Stripe.Event" — TypeScript infiere el tipo del retorno
    const event = (() => {
      try {
        return this.stripe.webhooks.constructEvent(
          req.rawBody!,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET!,
        );
      } catch (err) {
        this.logger.warn(`Firma de webhook inválida: ${(err as Error).message}`);
        throw new BadRequestException('Firma de webhook inválida');
      }
    })();

    if (event.type === 'payment_intent.succeeded') {
      // ✅ Solo necesitamos intent.id, así que el cast es seguro y no depende del tipo global
      const intent = event.data.object as { id: string };
      try {
        await this.ticketsService.createAfterPayment(intent.id);
      } catch (err) {
        this.logger.error(`Error creando tickets para intent ${intent.id}:`, err);
        throw new InternalServerErrorException('Error procesando pago');
      }
    }

    return { received: true };
  }
}