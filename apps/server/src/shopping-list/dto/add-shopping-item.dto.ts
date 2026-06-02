import { IsString, IsOptional } from 'class-validator';

export class AddShoppingItemDto {
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
  category?: string;
}