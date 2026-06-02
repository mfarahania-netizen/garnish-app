import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ShoppingListService } from './shopping-list.service';
import { AddShoppingItemsDto } from './dto/add-shopping-items.dto';
import { UpdateShoppingItemDto } from './dto/update-shopping-item.dto';

@Controller('shopping-list')
@UseGuards(AuthGuard('jwt'))
export class ShoppingListController {
  constructor(private readonly shoppingListService: ShoppingListService) {}

  @Get()
  getList(@Req() req) {
    return this.shoppingListService.getList(req.user.userId);
  }

  @Post('items')
  addItems(@Req() req, @Body() body: AddShoppingItemsDto) {
    return this.shoppingListService.addItems(req.user.userId, body.items);
  }

  @Patch('items/:id')
  toggleItem(@Param('id') id: string, @Body() updateDto: UpdateShoppingItemDto) {
    // در صورت نیاز به بروزرسانی سایر فیلدها در آینده
    return this.shoppingListService.toggleItem(id);
  }

  @Delete('items/:id')
  removeItem(@Param('id') id: string) {
    return this.shoppingListService.removeItem(id);
  }
}