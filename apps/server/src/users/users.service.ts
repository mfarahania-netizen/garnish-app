import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async createUser(phone: string, password: string, name?: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: { phone, password: hashedPassword, name },
    });
  }

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  async findById(id: string) {
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

  async getPreferences(userId: string) {
    const prefs = await this.prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!prefs) return null;

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

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    // اگر مقدار string باشه، تبدیل به آرایه می‌کنیم
    const safeParseArray = (value: any): string[] => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
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

    // آلرژی‌ها
    if (allergies !== undefined) {
      await this.prisma.userAllergy.deleteMany({ where: { userId } });

      if (allergies.length > 0) {
        await this.prisma.$transaction(
          allergies.map(name =>
            this.prisma.allergy.upsert({
              where: { name },
              create: { name },
              update: {},
            })
          )
        );

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

    // cuisine
    if (cuisine !== undefined) {
      await this.prisma.userCuisine.deleteMany({ where: { userId } });

      if (cuisine.length > 0) {
        await this.prisma.$transaction(
          cuisine.map(name =>
            this.prisma.cuisine.upsert({
              where: { name },
              create: { name },
              update: {},
            })
          )
        );

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

    // healthGoals
    if (healthGoals !== undefined) {
      await this.prisma.userHealthGoal.deleteMany({ where: { userId } });

      if (healthGoals.length > 0) {
        await this.prisma.$transaction(
          healthGoals.map(name =>
            this.prisma.healthGoal.upsert({
              where: { name },
              create: { name },
              update: {},
            })
          )
        );

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

  async updateProfile(userId: string, name?: string) {
    const data: { name?: string } = {};
    if (name !== undefined) {
      data.name = name;
    }
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}