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

  // دریافت ترجیحات کاربر با واکشی جداگانهٔ روابط
  async getPreferences(userId: string) {
    const prefs = await this.prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!prefs) return null;

    // واکشی آلرژی‌ها از جداول واسط
    const userAllergies = await this.prisma.userAllergy.findMany({
      where: { userId },
      include: { allergy: true },
    });
    const allergies = userAllergies.map(ua => ua.allergy.name);

    // واکشی cuisineها
    const userCuisines = await this.prisma.userCuisine.findMany({
      where: { userId },
      include: { cuisine: true },
    });
    const cuisine = userCuisines.map(uc => uc.cuisine.name);

    // واکشی healthGoals
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

  // بروزرسانی ترجیحات (با مدیریت روابط many-to-many)
  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    // به‌روزرسانی فیلدهای اصلی
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

    // مدیریت آلرژی‌ها
    if (dto.allergies !== undefined) {
      await this.prisma.userAllergy.deleteMany({ where: { userId } });
      for (const name of dto.allergies) {
        const allergy = await this.prisma.allergy.upsert({
          where: { name },
          create: { name },
          update: {},
        });
        await this.prisma.userAllergy.create({
          data: { userId, allergyId: allergy.id },
        });
      }
    }

    // مدیریت cuisineها
    if (dto.cuisine !== undefined) {
      await this.prisma.userCuisine.deleteMany({ where: { userId } });
      for (const name of dto.cuisine) {
        const cuisine = await this.prisma.cuisine.upsert({
          where: { name },
          create: { name },
          update: {},
        });
        await this.prisma.userCuisine.create({
          data: { userId, cuisineId: cuisine.id },
        });
      }
    }

    // مدیریت healthGoals
    if (dto.healthGoals !== undefined) {
      await this.prisma.userHealthGoal.deleteMany({ where: { userId } });
      for (const name of dto.healthGoals) {
        const goal = await this.prisma.healthGoal.upsert({
          where: { name },
          create: { name },
          update: {},
        });
        await this.prisma.userHealthGoal.create({
          data: { userId, healthGoalId: goal.id },
        });
      }
    }

    // بازگرداندن ترجیحات به‌روز شده
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