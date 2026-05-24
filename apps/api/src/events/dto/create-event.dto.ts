import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsIn,
  IsArray,
  ValidateNested,
  Min,
  IsInt,
  IsPositive,
  MaxLength,
  ValidateIf,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SectionPriceDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['IZQ', 'CTR', 'DER'])
  sectionCode!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsString()
  @IsOptional()
  currency?: string = 'MXN';
}

export class TicketTypeDto {
  @IsOptional()   // ← agregar
  @IsUUID()       // ← agregar
  id?: string;    // ← agregar
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @IsString()
  price!: string;   // string decimal, igual que CreateTicketTypeDto

  @IsString()
  @IsOptional()
  @MaxLength(10)
  currency?: string;

  @IsInt()
  @IsPositive()
  capacity!: number;
}

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  venueName!: string;

  @IsString()
  @IsNotEmpty()
  venueCity!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @IsOptional()
  @IsUrl()
  bannerUrl?: string;

  @IsOptional()
  @IsIn(['music', 'theater', 'sport', 'festival', 'other'])
  category?: string;

  // ── Nuevo campo: indica qué modo de boletos usa el evento ──
  @IsBoolean()
  @IsOptional()
  useVenueMap?: boolean;

  // Requerido cuando useVenueMap = true
  @ValidateIf((o) => o.useVenueMap !== false)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionPriceDto)
  sectionPrices?: SectionPriceDto[];

  // Requerido cuando useVenueMap = false
  @ValidateIf((o) => o.useVenueMap === false)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TicketTypeDto)
  ticketTypes?: TicketTypeDto[];
}