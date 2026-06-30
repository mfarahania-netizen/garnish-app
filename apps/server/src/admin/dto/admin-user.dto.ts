import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * Type/shape DTOs for the admin user-mutation endpoints (advisor audit P1-1). The global ValidationPipe is
 * { whitelist, forbidNonWhitelisted, transform } — so these reject malformed types and any UNDECLARED field.
 * Business rules (password min-6, phone-or-email-required, uniqueness, mandatory reason) stay in the
 * service/controller so their FE-mapped error CODES (password_min_6, phone_taken, reason_required…) are
 * preserved. Every field the FE actually sends MUST be declared here, or forbidNonWhitelisted would 400 it.
 */
export class CreateAdminUserDto {
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsBoolean() isAdmin?: boolean;
  @IsOptional() @IsString() reason?: string;
}

export class UpdateAdminUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsBoolean() isAdmin?: boolean;
  @IsOptional() @IsString() reason?: string;
}

export class ResetUserPasswordDto {
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsString() reason?: string;
}

export class BanUserDto {
  @IsOptional() @IsBoolean() banned?: boolean;
  @IsOptional() @IsString() reason?: string;
}

export class ReasonDto {
  @IsOptional() @IsString() reason?: string;
}
