"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealPlansController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const meal_plans_service_1 = require("./meal-plans.service");
let MealPlansController = class MealPlansController {
    mealPlansService;
    constructor(mealPlansService) {
        this.mealPlansService = mealPlansService;
    }
    getCurrentPlan(req) {
        return this.mealPlansService.getCurrentPlan(req.user.userId);
    }
    savePlan(req, body) {
        return this.mealPlansService.savePlan(req.user.userId, body.weekStart, body.slots);
    }
    generatePlan(req) {
        return this.mealPlansService.generateSmartPlan(req.user.userId);
    }
};
exports.MealPlansController = MealPlansController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MealPlansController.prototype, "getCurrentPlan", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], MealPlansController.prototype, "savePlan", null);
__decorate([
    (0, common_1.Post)('generate'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MealPlansController.prototype, "generatePlan", null);
exports.MealPlansController = MealPlansController = __decorate([
    (0, common_1.Controller)('meal-plans'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __metadata("design:paramtypes", [meal_plans_service_1.MealPlansService])
], MealPlansController);
//# sourceMappingURL=meal-plans.controller.js.map