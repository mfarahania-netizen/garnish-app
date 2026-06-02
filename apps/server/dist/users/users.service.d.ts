import { PrismaService } from '../prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    createUser(phone: string, password: string, name?: string): Promise<{
        name: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        email: string | null;
        password: string | null;
        isAdmin: boolean;
    }>;
    findByPhone(phone: string): Promise<{
        name: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        email: string | null;
        password: string | null;
        isAdmin: boolean;
    } | null>;
    findById(id: string): Promise<{
        name: string | null;
        id: string;
        phone: string | null;
        email: string | null;
        isAdmin: boolean;
    } | null>;
    getPreferences(userId: string): Promise<{
        id: string;
        diet: string | null;
        skillLevel: string | null;
        budget: string | null;
        allergies: string[];
        cuisine: string[];
        healthGoals: string[];
        updatedAt: Date;
    } | null>;
    updatePreferences(userId: string, dto: UpdatePreferencesDto): Promise<{
        id: string;
        diet: string | null;
        skillLevel: string | null;
        budget: string | null;
        allergies: string[];
        cuisine: string[];
        healthGoals: string[];
        updatedAt: Date;
    } | null>;
    updateProfile(userId: string, name?: string): Promise<{
        name: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        email: string | null;
        password: string | null;
        isAdmin: boolean;
    }>;
}
