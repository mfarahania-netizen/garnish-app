// apps/server/src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ErasureService } from './erasure/erasure.service';
import { UserExportService } from './export/user-export.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly erasureService: ErasureService,
    private readonly userExportService: UserExportService,
  ) {}

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
        avatar: true,
        isAdmin: true,
      },
    });
  }

  async getPreferences(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        preferences: true,
        allergies: { include: { allergy: true } },
        cuisines: { include: { cuisine: true } },
        healthGoals: { include: { healthGoal: true } },
      },
    });

    if (!user || !user.preferences) return null;

    return {
      id: user.preferences.id,
      diet: user.preferences.diet,
      skillLevel: user.preferences.skillLevel,
      budget: user.preferences.budget,
      allergies: user.allergies.map(ua => ua.allergy.name),
      cuisine: user.cuisines.map(uc => uc.cuisine.name),
      healthGoals: user.healthGoals.map(uhg => uhg.healthGoal.name),
      updatedAt: user.preferences.updatedAt,
    };
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const currentPrefs = await this.getPreferences(userId);
    const oldDiet = currentPrefs?.diet || null;
    const oldSkillLevel = currentPrefs?.skillLevel || null;
    const oldBudget = currentPrefs?.budget || null;
    const oldAllergies = (currentPrefs?.allergies || []).slice().sort();
    const oldCuisines = (currentPrefs?.cuisine || []).slice().sort();
    const oldHealthGoals = (currentPrefs?.healthGoals || []).slice().sort();

    const safeParseArray = (value: any): string[] => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
      }
      return [];
    };

    const allergies = safeParseArray(dto.allergies).sort();
    const cuisine = safeParseArray(dto.cuisine).sort();
    const healthGoals = safeParseArray(dto.healthGoals).sort();

    await this.prisma.$transaction(async (tx) => {
      await tx.userPreference.upsert({
        where: { userId },
        create: { userId, diet: dto.diet, skillLevel: dto.skillLevel, budget: dto.budget },
        update: { diet: dto.diet, skillLevel: dto.skillLevel, budget: dto.budget },
      });

      if (allergies !== undefined) {
        await tx.userAllergy.deleteMany({ where: { userId } });
        if (allergies.length > 0) {
          for (const name of allergies) await tx.allergy.upsert({ where: { name }, create: { name }, update: {} });
          const records = await tx.allergy.findMany({ where: { name: { in: allergies } }, select: { id: true } });
          if (records.length > 0) await tx.userAllergy.createMany({ data: records.map(a => ({ userId, allergyId: a.id })), skipDuplicates: true });
        }
      }

      if (cuisine !== undefined) {
        await tx.userCuisine.deleteMany({ where: { userId } });
        if (cuisine.length > 0) {
          for (const name of cuisine) await tx.cuisine.upsert({ where: { name }, create: { name }, update: {} });
          const records = await tx.cuisine.findMany({ where: { name: { in: cuisine } }, select: { id: true } });
          if (records.length > 0) await tx.userCuisine.createMany({ data: records.map(c => ({ userId, cuisineId: c.id })), skipDuplicates: true });
        }
      }

      if (healthGoals !== undefined) {
        await tx.userHealthGoal.deleteMany({ where: { userId } });
        if (healthGoals.length > 0) {
          for (const name of healthGoals) await tx.healthGoal.upsert({ where: { name }, create: { name }, update: {} });
          const records = await tx.healthGoal.findMany({ where: { name: { in: healthGoals } }, select: { id: true } });
          if (records.length > 0) await tx.userHealthGoal.createMany({ data: records.map(g => ({ userId, healthGoalId: g.id })), skipDuplicates: true });
        }
      }

      const historyEntries: any[] = [];
      const now = new Date();
      const addIfChanged = (field: string, oldVal: any, newVal: any) => {
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          historyEntries.push({ userId, fieldName: field, oldValue: JSON.stringify(oldVal), newValue: JSON.stringify(newVal), changedAt: now });
        }
      };
      addIfChanged('diet', oldDiet, dto.diet ?? null);
      addIfChanged('skillLevel', oldSkillLevel, dto.skillLevel ?? null);
      addIfChanged('budget', oldBudget, dto.budget ?? null);
      addIfChanged('allergies', oldAllergies, allergies);
      addIfChanged('cuisine', oldCuisines, cuisine);
      addIfChanged('healthGoals', oldHealthGoals, healthGoals);
      if (historyEntries.length > 0) await tx.preferenceHistory.createMany({ data: historyEntries });
    });

    return this.getPreferences(userId);
  }

  async updateProfile(userId: string, name?: string, email?: string, avatar?: string) {
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (avatar !== undefined) data.avatar = avatar;

    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async grantConsent(userId: string, type: string, granted: boolean) {
    return this.prisma.consentLog.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, granted },
      update: { granted, updatedAt: new Date() },
    });
  }

  // 🆕 GDPR: Right to be Forgotten — delegated to the transactional ErasureService (E39-1C).
  // The bare `prisma.user.delete()` is replaced by a safe transaction that revokes sessions,
  // scrubs residual PII on audit-long records, writes a PII-free ErasureEvent proof, then
  // deletes the user (Cascade + SetNull). Returns a PII-free erasure summary.
  async deleteUser(userId: string) {
    return this.erasureService.eraseUser(userId, { actorType: 'self' });
  }

  // 🆕 GDPR Art. 20: data portability — export the current user's own data (E39-1D).
  // Delegated to the dedicated UserExportService. `userId` always comes from the verified JWT.
  async exportUser(userId: string) {
    return this.userExportService.exportUser(userId);
  }
}