// apps/server/src/users/dto/update-profile.dto.ts
import { IsOptional, IsString, IsEmail, MaxLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  @Matches(/^$|^(\/uploads\/avatars\/[A-Za-z0-9._-]+|https:\/\/[^<>"'\s]+)$/)
  avatar?: string;
}
