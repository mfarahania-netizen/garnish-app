import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const RECIPE_STATUSES = ['all', 'pending', 'active', 'rejected', 'archived'] as const;
const RECIPE_VISIBILITY = ['all', 'public', 'private'] as const;
const RECIPE_SORTS = ['updatedAt', 'createdAt', 'title', 'status'] as const;
const DIRECTIONS = ['asc', 'desc'] as const;

export class ListAdminRecipesQueryDto {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsIn(RECIPE_STATUSES) status?: string = 'all';
  @IsOptional() @IsIn(RECIPE_VISIBILITY) visibility?: string = 'all';
  @IsOptional() @IsIn(RECIPE_SORTS) sort?: string = 'updatedAt';
  @IsOptional() @IsIn(DIRECTIONS) direction?: 'asc' | 'desc' = 'desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}

export class ModerateRecipeDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
