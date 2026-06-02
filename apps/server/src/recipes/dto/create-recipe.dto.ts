import { IsString, IsOptional, IsInt, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class IngredientDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class StepDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  instruction: string;

  @IsOptional()
  @IsInt()
  duration?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class CreateRecipeDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsInt()
  cookingTime?: number;

  @IsOptional()
  @IsInt()
  servings?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  prepTime?: string;

  @IsOptional()
  @IsString()
  totalTime?: string;

  @IsOptional()
  @IsString()
  mealType?: string;

  @IsOptional()
  @IsString()
  diet?: string;

  @IsOptional()
  @IsString()
  cost?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tools?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tips?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  faq?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergens?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  occasion?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientDto)
  ingredients?: IngredientDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StepDto)
  steps?: StepDto[];
}