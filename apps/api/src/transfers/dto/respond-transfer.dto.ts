import {
  IsUUID,
  IsOptional,
  IsISO8601,
  IsIn,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
} from 'class-validator';

/**
 * El receptor firma su decisión con su propia clave privada.
 *
 * Payload que se firma (JSON.stringify en orden fijo):
 *   { transferId, recipientId, action, timestamp }
 *
 * Incluir recipientId en el payload evita que una firma de "ACCEPT"
 * de un transfer se reutilice para aceptar otro.
 */
export class RespondTransferDto {
  @IsUUID()
  @IsOptional()
  transferId: string;

  /**
   * ACCEPT → el servidor ejecuta el traspaso del boleto.
   * REJECT → la transferencia queda cancelada, el boleto no se mueve.
   */
  @IsIn(['ACCEPT', 'REJECT'])
  action: 'ACCEPT' | 'REJECT';

  /**
   * Timestamp ISO del momento en que el receptor tomó la decisión.
   * Se incluye en el payload firmado para acotar la ventana de validez.
   */
  @IsISO8601()
  timestamp: string;

  /**
   * Firma ECDSA en base64 del payload { transferId, recipientId, action, timestamp }.
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(80)
  @MaxLength(200)
  signature: string;
}