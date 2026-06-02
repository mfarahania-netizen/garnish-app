import { PrismaService } from '../prisma/prisma.service';
export declare class ShoppingListService {
    private prisma;
    constructor(prisma: PrismaService);
    getList(userId: string): Promise<{
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
    addItems(userId: string, items: {
        name: string;
        amount?: string;
        unit?: string;
        category?: string;
    }[]): Promise<import("@prisma/client").Prisma.BatchPayload>;
    toggleItem(itemId: string): Promise<{
        name: string;
        amount: string | null;
        unit: string | null;
        category: string | null;
        id: string;
        addedAt: Date;
        shoppingListId: string;
        isChecked: boolean;
    }>;
    removeItem(itemId: string): Promise<{
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
