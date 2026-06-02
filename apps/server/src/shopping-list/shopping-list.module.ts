import { Module } from '@nestjs/common';
import { ShoppingListService } from './shopping-list.service';
import { ShoppingListController } from './shopping-list.controller';

@Module({
  providers: [ShoppingListService],
  controllers: [ShoppingListController],
})
export class ShoppingListModule {}