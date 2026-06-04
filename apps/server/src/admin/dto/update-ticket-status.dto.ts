import { IsIn } from 'class-validator';

export class UpdateTicketStatusDto {
  @IsIn(['open', 'in-progress', 'closed'])
  status: string;
}