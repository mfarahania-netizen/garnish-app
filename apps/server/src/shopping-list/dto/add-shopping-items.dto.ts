import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AddShoppingItemDto } from './add-shopping-item.dto';

export class AddShoppingItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddShoppingItemDto)
  items: AddShoppingItemDto[];
}