import { IsString, MinLength, MaxLength, IsOptional, IsIn } from 'class-validator';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../ticket.constants';

export class CreateTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message: string;

  @IsOptional()
  @IsIn(TICKET_CATEGORIES as unknown as string[])
  category?: string;

  @IsOptional()
  @IsIn(TICKET_PRIORITIES as unknown as string[])
  priority?: string;
}
