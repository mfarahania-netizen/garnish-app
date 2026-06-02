import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShoppingListService {
  constructor(private prisma: PrismaService) {}

  async getList(userId: string) {
    let list = await this.prisma.shoppingList.findFirst({
      where: { userId },
      include: { items: true },
    });
    if (!list) {
      list = await this.prisma.shoppingList.create({
        data: { userId },
        include: { items: true },
      });
    }
    return list;
  }

  async addItems(userId: string, items: { name: string; amount?: string; unit?: string; category?: string }[]) {
    const list = await this.getList(userId);
    return this.prisma.shoppingItem.createMany({
      data: items.map(item => ({
        shoppingListId: list.id,
        name: item.name,
        amount: item.amount || null,
        unit: item.unit || null,
        category: item.category || null,
      })),
    });
  }

  async toggleItem(itemId: string) {
    const item = await this.prisma.shoppingItem.findUnique({ where: { id: itemId } });
    if (!item) throw new Error('Item not found');
    return this.prisma.shoppingItem.update({
      where: { id: itemId },
      data: { isChecked: !item.isChecked },
    });
  }

  async removeItem(itemId: string) {
    return this.prisma.shoppingItem.delete({ where: { id: itemId } });
  }
}