import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

/**
 * La clave pública P-256 en formato raw (sin comprimir):
 *   - 65 bytes: prefijo 0x04 + 32 bytes X + 32 bytes Y
 *   - En base64: exactamente 88 caracteres (con padding =)
 *
 * El cliente la obtiene con:
 *   const raw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
 *   const b64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
 */
export class RegisterPublicKeyDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(86)   // 88 con padding, 86 sin — aceptamos ambos
  @MaxLength(92)   // margen por si el cliente usa URL-safe base64
  publicKey: string;
}