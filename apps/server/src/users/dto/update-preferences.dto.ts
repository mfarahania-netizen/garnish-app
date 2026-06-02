import { IsOptional, IsString, IsArray } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsString()
  diet?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @IsOptional()
  @IsString()
  skillLevel?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cuisine?: string[];

  @IsOptional()
  @IsString()
  budget?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  healthGoals?: string[];
}