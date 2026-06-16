import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';  // ← import type
import { Request } from 'express';
import Stripe from 'stripe';                           // ← instancia por separado
import { TicketsService } from './tickets.service';

@Controller('payments')
export class PaymentsWebhookController {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  constructor(private readonly ticketsService: TicketsService) {}

  @Post('webhook')
  @HttpCode(200)
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    let event: any;  // ← usar StripeTypes

    try {
      event = this.stripe.webhooks.constructEvent(
        req.rawBody!,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch {
      return { error: 'Firma de webhook inválida' };
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as any; // ← StripeTypes
      await this.ticketsService.createAfterPayment(intent.id);
    }

    return { received: true };
  }
}