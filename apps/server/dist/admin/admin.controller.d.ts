import { AdminService } from './admin.service';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    getDashboard(): Promise<{
        recipeCount: number;
        userCount: number;
        ticketCount: number;
    }>;
    getTickets(): Promise<({
        user: {
            name: string | null;
            phone: string | null;
        };
        replies: {
            id: string;
            createdAt: Date;
            message: string;
            isStaff: boolean;
            ticketId: string;
        }[];
    } & {
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        message: string;
        subject: string;
        priority: string;
    })[]>;
    respondToTicket(id: string, message: string): Promise<{
        id: string;
        createdAt: Date;
        message: string;
        isStaff: boolean;
        ticketId: string;
    }>;
    updateTicketStatus(id: string, status: string): Promise<{
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        message: string;
        subject: string;
        priority: string;
    }>;
    getRecipes(): Promise<({
        author: {
            name: string | null;
        } | null;
    } & {
        title: string;
        imageUrl: string | null;
        description: string | null;
        category: string;
        region: string | null;
        difficulty: string | null;
        cookingTime: number | null;
        servings: number | null;
        videoUrl: string | null;
        isPublic: boolean;
        status: string | null;
        prepTime: string | null;
        totalTime: string | null;
        mealType: string | null;
        diet: string | null;
        cost: string | null;
        tools: string | null;
        tips: string | null;
        faq: string | null;
        categories: string | null;
        allergens: string | null;
        occasion: string | null;
        id: string;
        authorId: string | null;
        createdAt: Date;
        updatedAt: Date;
        adminNote: string | null;
    })[]>;
    approveRecipe(id: string): Promise<{
        title: string;
        imageUrl: string | null;
        description: string | null;
        category: string;
        region: string | null;
        difficulty: string | null;
        cookingTime: number | null;
        servings: number | null;
        videoUrl: string | null;
        isPublic: boolean;
        status: string | null;
        prepTime: string | null;
        totalTime: string | null;
        mealType: string | null;
        diet: string | null;
        cost: string | null;
        tools: string | null;
        tips: string | null;
        faq: string | null;
        categories: string | null;
        allergens: string | null;
        occasion: string | null;
        id: string;
        authorId: string | null;
        createdAt: Date;
        updatedAt: Date;
        adminNote: string | null;
    }>;
    rejectRecipe(id: string, note: string): Promise<{
        title: string;
        imageUrl: string | null;
        description: string | null;
        category: string;
        region: string | null;
        difficulty: string | null;
        cookingTime: number | null;
        servings: number | null;
        videoUrl: string | null;
        isPublic: boolean;
        status: string | null;
        prepTime: string | null;
        totalTime: string | null;
        mealType: string | null;
        diet: string | null;
        cost: string | null;
        tools: string | null;
        tips: string | null;
        faq: string | null;
        categories: string | null;
        allergens: string | null;
        occasion: string | null;
        id: string;
        authorId: string | null;
        createdAt: Date;
        updatedAt: Date;
        adminNote: string | null;
    }>;
    getUsers(): Promise<{
        name: string | null;
        id: string;
        createdAt: Date;
        phone: string | null;
        email: string | null;
    }[]>;
    getRecentEvents(limit: string): Promise<{
        recipeTitle: string | null;
        user: {
            name: string | null;
            phone: string | null;
        };
        duration: number | null;
        id: string;
        page: string | null;
        userId: string;
        type: string;
        timestamp: Date;
        sessionId: string | null;
        payload: string | null;
        enrichment: string | null;
    }[]>;
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
