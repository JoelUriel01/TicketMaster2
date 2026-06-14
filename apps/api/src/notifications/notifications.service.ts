import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';

/**
 * NotificationsService
 *
 * Gestiona suscripciones Web Push y el envío de notificaciones.
 * Asume que tienes las siguientes variables de entorno:
 *
 *   VAPID_PUBLIC_KEY   – clave pública VAPID (base64url)
 *   VAPID_PRIVATE_KEY  – clave privada VAPID (base64url)
 *   VAPID_SUBJECT      – mailto: o URL de tu dominio (ej. "mailto:dev@tuapp.com")
 *
 * Genera las claves con:
 *   npx web-push generate-vapid-keys
 *
 * Modelo Prisma requerido (agregar a schema.prisma):
 *
 *   model PushSubscription {
 *     id        String   @id @default(cuid())
 *     userId    String
 *     endpoint  String   @unique
 *     p256dh    String
 *     auth      String
 *     createdAt DateTime @default(now())
 *     user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
 *   }
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  /**
   * true solo cuando VAPID está configurado Y el modelo PushSubscription
   * existe en el cliente Prisma (es decir, la migración ya se corrió).
   * Si alguno falla, las notificaciones se deshabilitan silenciosamente
   * en lugar de lanzar un TypeError en runtime.
   */
  private pushReady = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const publicKey  = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject    = process.env.VAPID_SUBJECT ?? 'mailto:dev@tuapp.com';

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID keys not set — push notifications disabled. ' +
        'Run `npx web-push generate-vapid-keys` and set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.',
      );
      return;
    }

    // Verificar que el modelo PushSubscription ya existe en el cliente Prisma.
    // Si no existe, significa que falta correr la migración del schema.
    if (!(this.prisma as any).pushSubscription) {
      this.logger.warn(
        'PushSubscription model not found in Prisma client — push notifications disabled. ' +
        'Add the model to schema.prisma and run `npx prisma migrate dev`.',
      );
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.pushReady = true;
    this.logger.log('Web Push (VAPID) initialized');
  }

  // ── SUBSCRIBE ────────────────────────────────────────────────────────────────
  /**
   * Guarda o actualiza la suscripción push de un usuario.
   * El frontend envía el objeto PushSubscription tal como lo devuelve
   * registration.pushManager.subscribe().
   */
  async subscribe(
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    if (!this.pushReady) {
      this.logger.warn('subscribe() called but push is not ready (missing model or VAPID keys)');
      return { ok: false };
    }

    await (this.prisma as any).pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        p256dh: subscription.keys.p256dh,
        auth:   subscription.keys.auth,
        userId,
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh:   subscription.keys.p256dh,
        auth:     subscription.keys.auth,
      },
    });

    this.logger.log(`Push subscription saved for user ${userId}`);
    return { ok: true };
  }

  // ── UNSUBSCRIBE ──────────────────────────────────────────────────────────────
  async unsubscribe(userId: string, endpoint: string) {
    if (!this.pushReady) return { ok: false };

    await (this.prisma as any).pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { ok: true };
  }

  // ── NOTIFY EVENT PUBLISHED ───────────────────────────────────────────────────
  /**
   * Llamado desde EventsService.publish().
   * Envía una notificación a TODOS los usuarios suscritos.
   *
   * Para escalar a millones de usuarios, extrae esto a un worker/queue
   * (Bull + Redis) en lugar de hacer los envíos en la request del organizador.
   */
  async notifyEventPublished(event: {
    id: string;
    title: string;
    venueName: string;
    venueCity: string;
    startsAt: Date;
  }) {
    if (!this.pushReady) {
      this.logger.log('notifyEventPublished() skipped — push not ready');
      return;
    }

    const subscriptions = await (this.prisma as any).pushSubscription.findMany();

    if (subscriptions.length === 0) {
      this.logger.log('No push subscribers — skipping notification');
      return;
    }

    const payload = JSON.stringify({
      type:    'EVENT_PUBLISHED',
      eventId: event.id,
      title:   `🎟️ Nuevo evento: ${event.title}`,
      body:    `${event.venueName}, ${event.venueCity} · ${this._formatDate(event.startsAt)}`,
      url:     `/events/${event.id}`,
      icon:    '/icons/icon-192.png',
      badge:   '/icons/badge-72.png',
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub: any) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        ),
      ),
    );

    // Limpiar suscripciones que ya no existen (410 Gone)
    const stale: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const err = r.reason as any;
        if (err?.statusCode === 410) stale.push(subscriptions[i].endpoint);
        else this.logger.warn(`Push send error: ${err?.message ?? err}`);
      }
    });

    if (stale.length > 0) {
      await (this.prisma as any).pushSubscription.deleteMany({
        where: { endpoint: { in: stale } },
      });
      this.logger.log(`Removed ${stale.length} stale subscription(s)`);
    }

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    this.logger.log(`Push notification sent to ${sent}/${subscriptions.length} subscribers`);
  }

  // ── VAPID PUBLIC KEY (para el frontend) ─────────────────────────────────────
  getVapidPublicKey(): string {
    const key = process.env.VAPID_PUBLIC_KEY;
    if (!key) throw new Error('VAPID_PUBLIC_KEY not configured');
    return key;
  }

  // ── HELPERS ──────────────────────────────────────────────────────────────────
  private _formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(date);
  }
}