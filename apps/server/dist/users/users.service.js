"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const bcrypt = __importStar(require("bcryptjs"));
let UsersService = class UsersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createUser(phone, password, name) {
        const hashedPassword = await bcrypt.hash(password, 10);
        return this.prisma.user.create({
            data: { phone, password: hashedPassword, name },
        });
    }
    async findByPhone(phone) {
        return this.prisma.user.findUnique({ where: { phone } });
    }
    async findById(id) {
        return this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                phone: true,
                name: true,
                email: true,
                isAdmin: true,
            },
        });
    }
    async getPreferences(userId) {
        const prefs = await this.prisma.userPreference.findUnique({
            where: { userId },
        });
        if (!prefs)
            return null;
        const userAllergies = await this.prisma.userAllergy.findMany({
            where: { userId },
            include: { allergy: true },
        });
        const allergies = userAllergies.map(ua => ua.allergy.name);
        const userCuisines = await this.prisma.userCuisine.findMany({
            where: { userId },
            include: { cuisine: true },
        });
        const cuisine = userCuisines.map(uc => uc.cuisine.name);
        const userHealthGoals = await this.prisma.userHealthGoal.findMany({
            where: { userId },
            include: { healthGoal: true },
        });
        const healthGoals = userHealthGoals.map(uhg => uhg.healthGoal.name);
        return {
            id: prefs.id,
            diet: prefs.diet,
            skillLevel: prefs.skillLevel,
            budget: prefs.budget,
            allergies,
            cuisine,
            healthGoals,
            updatedAt: prefs.updatedAt,
        };
    }
    async updatePreferences(userId, dto) {
        const safeParseArray = (value) => {
            if (Array.isArray(value))
                return value;
            if (typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    return Array.isArray(parsed) ? parsed : [];
                }
                catch {
                    return [];
                }
            }
            return [];
        };
        const allergies = safeParseArray(dto.allergies);
        const cuisine = safeParseArray(dto.cuisine);
        const healthGoals = safeParseArray(dto.healthGoals);
        await this.prisma.userPreference.upsert({
            where: { userId },
            create: {
                userId,
                diet: dto.diet,
                skillLevel: dto.skillLevel,
                budget: dto.budget,
            },
            update: {
                diet: dto.diet,
                skillLevel: dto.skillLevel,
                budget: dto.budget,
            },
        });
        if (allergies !== undefined) {
            await this.prisma.userAllergy.deleteMany({ where: { userId } });
            if (allergies.length > 0) {
                await this.prisma.$transaction(allergies.map(name => this.prisma.allergy.upsert({
                    where: { name },
                    create: { name },
                    update: {},
                })));
                const allergyRecords = await this.prisma.allergy.findMany({
                    where: { name: { in: allergies } },
                    select: { id: true },
                });
                if (allergyRecords.length > 0) {
                    await this.prisma.userAllergy.createMany({
                        data: allergyRecords.map(a => ({ userId, allergyId: a.id })),
                        skipDuplicates: true,
                    });
                }
            }
        }
        if (cuisine !== undefined) {
            await this.prisma.userCuisine.deleteMany({ where: { userId } });
            if (cuisine.length > 0) {
                await this.prisma.$transaction(cuisine.map(name => this.prisma.cuisine.upsert({
                    where: { name },
                    create: { name },
                    update: {},
                })));
                const cuisineRecords = await this.prisma.cuisine.findMany({
                    where: { name: { in: cuisine } },
                    select: { id: true },
                });
                if (cuisineRecords.length > 0) {
                    await this.prisma.userCuisine.createMany({
                        data: cuisineRecords.map(c => ({ userId, cuisineId: c.id })),
                        skipDuplicates: true,
                    });
                }
            }
        }
        if (healthGoals !== undefined) {
            await this.prisma.userHealthGoal.deleteMany({ where: { userId } });
            if (healthGoals.length > 0) {
                await this.prisma.$transaction(healthGoals.map(name => this.prisma.healthGoal.upsert({
                    where: { name },
                    create: { name },
                    update: {},
                })));
                const goalRecords = await this.prisma.healthGoal.findMany({
                    where: { name: { in: healthGoals } },
                    select: { id: true },
                });
                if (goalRecords.length > 0) {
                    await this.prisma.userHealthGoal.createMany({
                        data: goalRecords.map(g => ({ userId, healthGoalId: g.id })),
                        skipDuplicates: true,
                    });
                }
            }
        }
        return this.getPreferences(userId);
    }
    async updateProfile(userId, name) {
        const data = {};
        if (name !== undefined) {
            data.name = name;
        }
        return this.prisma.user.update({
            where: { id: userId },
            data,
        });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map