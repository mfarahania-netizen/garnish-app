import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
export declare class AuthService {
    private usersService;
    private jwtService;
    constructor(usersService: UsersService, jwtService: JwtService);
    register(phone: string, password: string, name?: string): Promise<{
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
    login(phone: string, password: string): Promise<{
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
