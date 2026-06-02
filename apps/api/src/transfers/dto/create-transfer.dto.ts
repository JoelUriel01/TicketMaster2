import {
  IsUUID,
  IsISO8601,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
} from 'class-validator';

/**
 * El cliente construye el payload, lo hashea con SHA-256
 * y lo firma con su clave privada ECDSA (P-256).
 *
 * Payload que se firma (JSON.stringify en orden fijo):
 *   { ticketId, senderId, recipientId, expiresAt, nonce }
 *
 * signature = base64url( ECDSA.sign( SHA-256(payload), privateKey ) )
 */
export class CreateTransferDto {
  @IsUUID()
  ticketId: string;

  @IsUUID()
  recipientId: string;

  /**
   * Cuándo expira la invitación de transferencia.
   * El servidor rechaza si ya pasó esta fecha.
   * Recomendado: ahora + 48 h.
   */
  @IsISO8601()
  expiresAt: string;

  /**
   * UUID generado en el cliente para este intento específico.
   * El servidor lo guarda y rechaza cualquier request que lo reutilice
   * (prevención de replay attack).
   */
  @IsUUID()
  nonce: string;

  /**
   * Firma ECDSA del payload en base64 (URL-safe o standard, el servidor
   * normaliza antes de verificar).
   * Longitud típica de una firma DER P-256: ~100-144 chars en base64.
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(80)
  @MaxLength(200)
  signature: string;
}