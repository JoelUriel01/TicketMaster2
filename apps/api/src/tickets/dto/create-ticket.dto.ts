import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateTicketDto {
  @IsUUID()
  eventId: string;

  // ── Modo clásico (useVenueMap = false) ───────────────────
  @ValidateIf((o) => !o.seatIds || o.seatIds.length === 0)
  @IsUUID()
  ticketTypeId?: string;

  @ValidateIf((o) => !o.seatIds || o.seatIds.length === 0)
  @IsInt()
  @Min(1)
  @Max(10)
  quantity?: number;

  // ── Modo mapa (useVenueMap = true) ───────────────────────
  @ValidateIf((o) => !o.ticketTypeId)
  @IsArray()
  @IsString({ each: true })
  seatIds?: string[];
}