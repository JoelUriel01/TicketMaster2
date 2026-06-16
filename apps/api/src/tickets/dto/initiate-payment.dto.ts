import { IsString, IsOptional, IsInt, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class InitiatePaymentDto {
  @IsString()
  eventId!: string;          // ← agregar !

  @IsString()
  @IsOptional()
  ticketTypeId?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  quantity?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  seatIds?: string[];
}