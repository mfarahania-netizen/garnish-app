import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * P1-5 (re-audit): real controller-level DTOs for the ticket-mutation endpoints. The global ValidationPipe is
 * { whitelist, forbidNonWhitelisted, transform }, so these reject malformed types + any UNDECLARED field; the
 * VALUE rules (valid status/priority/category enums) stay in AdminTicketsService (isStatus/isPriority/isCategory)
 * so the FE-mapped error codes are preserved. Every field the FE actually sends MUST be declared here, or
 * forbidNonWhitelisted would 400 it.
 */
export class RespondTicketDto {
  @IsOptional() @IsString() @MaxLength(5000) message?: string;
}

export class UpdateTicketDto {
  @IsOptional() @IsString() @MaxLength(32) status?: string;
  @IsOptional() @IsString() @MaxLength(32) priority?: string;
  @IsOptional() @IsString() @MaxLength(64) category?: string;
  @IsOptional() @IsString() @MaxLength(64) assigneeId?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(32, { each: true }) tags?: string[];
}

export class CreateTicketNoteDto {
  @IsOptional() @IsString() @MaxLength(5000) body?: string;
}
