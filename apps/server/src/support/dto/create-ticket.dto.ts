import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message: string;
}