import { Module } from '@nestjs/common';
import { MealPlansService } from './meal-plans.service';
import { MealPlansController } from './meal-plans.controller';

@Module({
  providers: [MealPlansService],
  controllers: [MealPlansController],
})
export class MealPlansModule {}