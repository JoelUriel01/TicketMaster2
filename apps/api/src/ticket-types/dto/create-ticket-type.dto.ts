import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { IsDecimal } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTicketTypeDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  // price llega como string y lo transformas a string decimal
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