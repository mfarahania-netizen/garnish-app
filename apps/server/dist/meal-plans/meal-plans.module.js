"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealPlansModule = void 0;
const common_1 = require("@nestjs/common");
const meal_plans_service_1 = require("./meal-plans.service");
const meal_plans_controller_1 = require("./meal-plans.controller");
let MealPlansModule = class MealPlansModule {
};
exports.MealPlansModule = MealPlansModule;
exports.MealPlansModule = MealPlansModule = __decorate([
    (0, common_1.Module)({
        providers: [meal_plans_service_1.MealPlansService],
        controllers: [meal_plans_controller_1.MealPlansController],
    })
], MealPlansModule);
//# sourceMappingURL=meal-plans.module.js.map