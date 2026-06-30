import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

const ADMIN_ROLES = ['user', 'readonly', 'support', 'privacy', 'ops', 'content', 'finance', 'admin', 'owner'];

/**
 * Type/shape DTOs for the admin user-mutation endpoints (advisor audit P1-1). The global ValidationPipe is
 * { whitelist, forbidNonWhitelisted, transform } — so these reject malformed types and any UNDECLARED field.
 * Business rules (password min-6, phone-or-email-required, uniqueness, mandatory reason) stay in the
 * service/controller so their FE-mapped error CODES (password_min_6, phone_taken, reason_required…) are
 * preserved. Every field the FE actually sends MUST be declared here, or forbidNonWhitelisted would 400 it.
 */
export class CreateAdminUserDto {
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @ValidateIf((_, v) => v !== undefined && v !== '') @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(128) password?: string;
  @IsOptional() @IsBoolean() isAdmin?: boolean;
  @IsOptional() @IsString() @IsIn(ADMIN_ROLES) adminRole?: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class UpdateAdminUserDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @ValidateIf((_, v) => v !== undefined && v !== '') @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsBoolean() isAdmin?: boolean;
  @IsOptional() @IsString() @IsIn(ADMIN_ROLES) adminRole?: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ResetUserPasswordDto {
  @IsOptional() @IsString() @MaxLength(128) password?: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class BanUserDto {
  @IsOptional() @IsBoolean() banned?: boolean;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ReasonDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
