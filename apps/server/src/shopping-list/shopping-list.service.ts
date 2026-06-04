import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

  async toggleItem(itemId: string, userId: string) {
    // مالکیت را از طریق ShoppingList چک کن
    const item = await this.prisma.shoppingItem.findUnique({
      where: { id: itemId },
      include: { shoppingList: { select: { userId: true } } },
    });

    if (!item) throw new NotFoundException('آیتم یافت نشد');
    if (item.shoppingList.userId !== userId) throw new ForbiddenException('شما مجاز به تغییر این آیتم نیستید');

    return this.prisma.shoppingItem.update({
      where: { id: itemId },
      data: { isChecked: !item.isChecked },
    });
  }

  async removeItem(itemId: string, userId: string) {
    const item = await this.prisma.shoppingItem.findUnique({
      where: { id: itemId },
      include: { shoppingList: { select: { userId: true } } },
    });

    if (!item) throw new NotFoundException('آیتم یافت نشد');
    if (item.shoppingList.userId !== userId) throw new ForbiddenException('شما مجاز به حذف این آیتم نیستید');

    return this.prisma.shoppingItem.delete({ where: { id: itemId } });
  }
}