import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getProfile(req: any): Promise<{
        name: string | null;
        id: string;
        phone: string | null;
        email: string | null;
        isAdmin: boolean;
    } | null>;
    updateProfile(req: any, dto: UpdateProfileDto): Promise<{
        name: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        email: string | null;
        password: string | null;
        isAdmin: boolean;
    }>;
    getPreferences(req: any): Promise<{
        id: string;
        diet: string | null;
        skillLevel: string | null;
        budget: string | null;
        allergies: string[];
        cuisine: string[];
        healthGoals: string[];
        updatedAt: Date;
    } | null>;
    updatePreferences(req: any, dto: UpdatePreferencesDto): Promise<{
        id: string;
        diet: string | null;
        skillLevel: string | null;
        budget: string | null;
        allergies: string[];
        cuisine: string[];
        healthGoals: string[];
        updatedAt: Date;
    } | null>;
}
