// src/ticket-types/dto/ticket-type.dto.ts
import { IsInt, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class TicketTypeDto {
  @IsUUID()
  id: string;

  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsString()
  @Transform(({ value }) => value.toString())
  price: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsInt()
  @IsPositive()
  capacity: number;
}