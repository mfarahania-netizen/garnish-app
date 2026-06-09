import { Injectable } from '@nestjs/common';

@Injectable()
export class ContributionCalculatorService {
  calculate(scores: Record<string, number>, weights: Record<string, number>) {
    const weightedEntries = Object.entries(scores).map(([key, value]) => ({
      key,
      value: Number(value) * Number(weights[key] ?? 0),
    }));

    const total = weightedEntries.reduce((sum, entry) => sum + entry.value, 0);
    if (total <= 0) {
      return Object.fromEntries(Object.keys(scores).map((key) => [key, 0]));
    }

    return Object.fromEntries(
      weightedEntries.map((entry) => [
        entry.key,
        Math.round((entry.value / total) * 100),
      ]),
    );
  }
}
