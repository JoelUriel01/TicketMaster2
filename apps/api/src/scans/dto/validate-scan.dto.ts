import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class ValidateScanDto {
  @ValidateIf((o) => !o.qrToken)
  @IsUUID()
  @IsOptional()
  ticketId?: string;

  @ValidateIf((o) => !o.ticketId)
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  qrToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  gate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  requestNonce?: string;
}