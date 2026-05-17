import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ValidateScanDto {
  @IsUUID()
  ticketId: string;

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