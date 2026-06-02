"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShoppingListService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ShoppingListService = class ShoppingListService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getList(userId) {
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
    async addItems(userId, items) {
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
    async toggleItem(itemId) {
        const item = await this.prisma.shoppingItem.findUnique({ where: { id: itemId } });
        if (!item)
            throw new Error('Item not found');
        return this.prisma.shoppingItem.update({
            where: { id: itemId },
            data: { isChecked: !item.isChecked },
        });
    }
    async removeItem(itemId) {
        return this.prisma.shoppingItem.delete({ where: { id: itemId } });
    }
};
exports.ShoppingListService = ShoppingListService;
exports.ShoppingListService = ShoppingListService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ShoppingListService);
//# sourceMappingURL=shopping-list.service.js.map