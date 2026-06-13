import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Thrown when a sensitive (health/medical) fact is rejected — not stored in A2. */
export class SensitiveFactRejectedError extends Error {
  constructor(key: string) {
    super(`Refusing to store a sensitive health/medical fact: "${key}"`);
    this.name = 'SensitiveFactRejectedError';
  }
}

export interface UpsertUserFactInput {
  userId: string;
  key: string;
  value: unknown;
  source: string;
  confidence?: number | null;
  expiresAt?: Date | null;
}

/**
 * UserFact (FactStore) persistence (E47-A2). Stores ONLY safe, non-sensitive preference facts.
 *
 * Sensitive health/medical/allergy facts are REJECTED here (no health inference yet — that path
 * is governed by the existing product allergy/health models and is out of E47-A2 scope).
 */
@Injectable()
export class UserFactService {
  private readonly sensitiveKeyPatterns: RegExp[] = [
    /allerg/i,
    /\bhealth\b|health[_-]?goal/i,
    /medical|medicine|medication|drug/i,
    /diagnos|disease|condition|symptom|illness/i,
    /diabet|cholesterol|blood[_-]?(pressure|sugar)|insulin/i,
    /pregnan|fertility/i,
    /therapeutic|clinical|strict[_-]?diet/i,
  ];

  constructor(private readonly prisma: PrismaService) {}

  isSensitiveKey(key: string): boolean {
    return this.sensitiveKeyPatterns.some((re) => re.test(key));
  }

  async upsert(input: UpsertUserFactInput) {
    if (this.isSensitiveKey(input.key)) {
      throw new SensitiveFactRejectedError(input.key);
    }
    const value = input.value as object;
    return this.prisma.userFact.upsert({
      where: { userId_key: { userId: input.userId, key: input.key } },
      create: {
        userId: input.userId,
        key: input.key,
        value: value as any,
        source: input.source,
        confidence: input.confidence ?? null,
        expiresAt: input.expiresAt ?? null,
      },
      update: {
        value: value as any,
        source: input.source,
        confidence: input.confidence ?? null,
        expiresAt: input.expiresAt ?? null,
      },
    });
  }

  async get(userId: string, key: string) {
    return this.prisma.userFact.findUnique({ where: { userId_key: { userId, key } } });
  }

  async listByUser(userId: string) {
    return this.prisma.userFact.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
  }
}
