import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class CreateTicketDto {
  @IsUUID()
  eventId: string;

  @IsUUID()
  ticketTypeId: string;

  @IsInt()
  @Min(1)
  @Max(10)
  quantity: number;
}