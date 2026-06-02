import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateShoppingItemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isChecked?: boolean;
}