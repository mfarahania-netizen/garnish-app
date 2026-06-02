import { PrismaService } from '../prisma/prisma.service';
interface FilterRule {
    name: string;
    apply: (recipes: any[]) => any[];
}
export declare class PersonalizationService {
    private prisma;
    constructor(prisma: PrismaService);
    getUserRules(userId: string): Promise<FilterRule[]>;
    applyRules(recipes: any[], rules: FilterRule[]): any[];
}
export {};
