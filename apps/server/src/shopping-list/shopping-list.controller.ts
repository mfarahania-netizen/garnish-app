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

  /**
   * PLANNER-L4-09: build/sync the shopping list from the current meal plan — aggregate + resolve+merge
   * vs the 1008 dictionary, scale by household, categorize, de-dupe against existing items. Manual
   * add/edit/check stays intact (only NEW items are added).
   */
  @Post('from-plan')
  buildFromPlan(@Req() req) {
    return this.shoppingListService.buildFromPlan(req.user.userId);
  }

  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Req() req, @Body() updateDto: UpdateShoppingItemDto) {
    return this.shoppingListService.updateItem(id, req.user.userId, updateDto);
  }

  @Delete('items/:id')
  removeItem(@Param('id') id: string, @Req() req) {
    return this.shoppingListService.removeItem(id, req.user.userId);
  }

  @Post('clear-checked')
  clearChecked(@Req() req) {
    return this.shoppingListService.clearChecked(req.user.userId);
  }

  @Post('clear-all')
  clearAll(@Req() req) {
    return this.shoppingListService.clearAll(req.user.userId);
  }

  @Post('uncheck-all')
  uncheckAll(@Req() req) {
    return this.shoppingListService.uncheckAll(req.user.userId);
  }
}