import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * P1-5 (re-audit): the body DTO for manual workflow/alert ops (run/resolve/snooze). Declares the operator reason;
 * the value rule (>=3 chars) stays in the controller so the `reason_required` 400 is preserved. The global
 * ValidationPipe (whitelist + forbidNonWhitelisted) rejects any undeclared field.
 */
export class WorkflowActionDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
