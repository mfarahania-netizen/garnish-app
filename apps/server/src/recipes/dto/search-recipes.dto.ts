import { IsString, MaxLength, IsOptional } from 'class-validator';

export class SearchRecipesDto {
  @IsString()
  @MaxLength(100)
  q: string;

  @IsOptional()
  @IsString()
  limit: string = '10'; // ← مقدار پیش‌فرض اضافه شد
}