"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const schedule_1 = require("@nestjs/schedule");
const cache_manager_1 = require("@nestjs/cache-manager");
const cache_manager_ioredis_yet_1 = require("cache-manager-ioredis-yet");
const prisma_module_1 = require("./prisma/prisma.module");
const recipes_module_1 = require("./recipes/recipes.module");
const users_module_1 = require("./users/users.module");
const auth_module_1 = require("./auth/auth.module");
const favorites_module_1 = require("./favorites/favorites.module");
const meal_plans_module_1 = require("./meal-plans/meal-plans.module");
const ai_module_1 = require("./ai/ai.module");
const shopping_list_module_1 = require("./shopping-list/shopping-list.module");
const notifications_module_1 = require("./notifications/notifications.module");
const support_module_1 = require("./support/support.module");
const admin_module_1 = require("./admin/admin.module");
const analytics_module_1 = require("./analytics/analytics.module");
const behavior_engine_module_1 = require("./behavior-engine/behavior-engine.module");
const recommendation_module_1 = require("./recommendation/recommendation.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            schedule_1.ScheduleModule.forRoot(),
            cache_manager_1.CacheModule.registerAsync({
                isGlobal: true,
                useFactory: async () => ({
                    store: cache_manager_ioredis_yet_1.redisStore,
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT || '6379', 10),
                    ttl: 60 * 60,
                }),
            }),
            throttler_1.ThrottlerModule.forRoot([{
                    ttl: 60000,
                    limit: 30,
                }]),
            prisma_module_1.PrismaModule,
            recipes_module_1.RecipesModule,
            users_module_1.UsersModule,
            auth_module_1.AuthModule,
            favorites_module_1.FavoritesModule,
            meal_plans_module_1.MealPlansModule,
            ai_module_1.AiModule,
            shopping_list_module_1.ShoppingListModule,
            notifications_module_1.NotificationsModule,
            support_module_1.SupportModule,
            admin_module_1.AdminModule,
            analytics_module_1.AnalyticsModule,
            behavior_engine_module_1.BehaviorEngineModule,
            recommendation_module_1.RecommendationModule,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map