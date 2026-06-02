import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(body: RegisterDto): Promise<{
        token: string;
        user: {
            name: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            phone: string | null;
            email: string | null;
            password: string | null;
            isAdmin: boolean;
        };
    }>;
    login(body: LoginDto): Promise<{
        token: string;
        user: {
            name: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            phone: string | null;
            email: string | null;
            password: string | null;
            isAdmin: boolean;
        };
    }>;
}
