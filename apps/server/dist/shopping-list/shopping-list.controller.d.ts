import { ShoppingListService } from './shopping-list.service';
import { AddShoppingItemsDto } from './dto/add-shopping-items.dto';
import { UpdateShoppingItemDto } from './dto/update-shopping-item.dto';
export declare class ShoppingListController {
    private readonly shoppingListService;
    constructor(shoppingListService: ShoppingListService);
    getList(req: any): Promise<{
        items: {
            name: string;
            amount: string | null;
            unit: string | null;
            category: string | null;
            id: string;
            addedAt: Date;
            shoppingListId: string;
            isChecked: boolean;
        }[];
    } & {
        name: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
    }>;
    addItems(req: any, body: AddShoppingItemsDto): Promise<import("@prisma/client").Prisma.BatchPayload>;
    toggleItem(id: string, updateDto: UpdateShoppingItemDto): Promise<{
        name: string;
        amount: string | null;
        unit: string | null;
        category: string | null;
        id: string;
        addedAt: Date;
        shoppingListId: string;
        isChecked: boolean;
    }>;
    removeItem(id: string): Promise<{
        name: string;
        amount: string | null;
        unit: string | null;
        category: string | null;
        id: string;
        addedAt: Date;
        shoppingListId: string;
        isChecked: boolean;
    }>;
}
