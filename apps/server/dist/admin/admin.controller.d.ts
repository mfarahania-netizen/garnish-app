import { AdminService } from './admin.service';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    getDashboard(): Promise<{
        recipeCount: number;
        userCount: number;
        ticketCount: number;
    }>;
    getTickets(page: string, limit: string): Promise<{
        data: ({
            user: {
                phone: string | null;
                name: string | null;
            };
            replies: {
                id: string;
                message: string;
                createdAt: Date;
                ticketId: string;
                isStaff: boolean;
            }[];
        } & {
            id: string;
            userId: string;
            subject: string;
            message: string;
            status: string;
            priority: string;
            createdAt: Date;
            updatedAt: Date;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    respondToTicket(id: string, message: string): Promise<{
        id: string;
        message: string;
        createdAt: Date;
        ticketId: string;
        isStaff: boolean;
    }>;
    updateTicketStatus(id: string, status: string): Promise<{
        id: string;
        userId: string;
        subject: string;
        message: string;
        status: string;
        priority: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getRecipes(page: string, limit: string): Promise<{
        data: ({
            author: {
                name: string | null;
            } | null;
        } & {
            id: string;
            status: string | null;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            description: string | null;
            category: string;
            region: string | null;
            difficulty: string | null;
            cookingTime: number | null;
            servings: number | null;
            imageUrl: string | null;
            videoUrl: string | null;
            authorId: string | null;
            isPublic: boolean;
            adminNote: string | null;
            prepTime: string | null;
            totalTime: string | null;
            tools: string | null;
            tips: string | null;
            faq: string | null;
            mealType: string | null;
            diet: string | null;
            categories: string | null;
            allergens: string | null;
            occasion: string | null;
            cost: string | null;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    approveRecipe(id: string): Promise<{
        id: string;
        status: string | null;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string | null;
        category: string;
        region: string | null;
        difficulty: string | null;
        cookingTime: number | null;
        servings: number | null;
        imageUrl: string | null;
        videoUrl: string | null;
        authorId: string | null;
        isPublic: boolean;
        adminNote: string | null;
        prepTime: string | null;
        totalTime: string | null;
        tools: string | null;
        tips: string | null;
        faq: string | null;
        mealType: string | null;
        diet: string | null;
        categories: string | null;
        allergens: string | null;
        occasion: string | null;
        cost: string | null;
    }>;
    rejectRecipe(id: string, note: string): Promise<{
        id: string;
        status: string | null;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string | null;
        category: string;
        region: string | null;
        difficulty: string | null;
        cookingTime: number | null;
        servings: number | null;
        imageUrl: string | null;
        videoUrl: string | null;
        authorId: string | null;
        isPublic: boolean;
        adminNote: string | null;
        prepTime: string | null;
        totalTime: string | null;
        tools: string | null;
        tips: string | null;
        faq: string | null;
        mealType: string | null;
        diet: string | null;
        categories: string | null;
        allergens: string | null;
        occasion: string | null;
        cost: string | null;
    }>;
    getUsers(page: string, limit: string): Promise<{
        data: {
            id: string;
            createdAt: Date;
            phone: string | null;
            email: string | null;
            name: string | null;
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
    getRecentEvents(limit: string, page: string): Promise<{
        events: {
            recipeTitle: string | null;
            user: {
                phone: string | null;
                name: string | null;
            };
            id: string;
            userId: string;
            type: string;
            timestamp: Date;
            sessionId: string | null;
            page: string | null;
            duration: number | null;
            payload: string | null;
            enrichment: string | null;
        }[];
        total: number;
    }>;
    getAnalyticsStats(): Promise<{
        totalEvents: number;
        todayEvents: number;
    }>;
    getTopSearchQueries(): Promise<{
        query: string;
        count: number;
    }[]>;
    getMealPlanningStats(): Promise<{
        topRecipes: any[];
        generateCount: number;
    }>;
    getAIInteractionStats(): Promise<{
        totalMessages: number;
        topIngredients: {
            name: string;
            count: number;
        }[];
        topConcepts: {
            name: string;
            count: number;
        }[];
        topRecipes: {
            name: string;
            count: number;
        }[];
        voiceSearches: number;
    }>;
}
