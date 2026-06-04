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
exports.ShoppingListController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const shopping_list_service_1 = require("./shopping-list.service");
const add_shopping_items_dto_1 = require("./dto/add-shopping-items.dto");
const update_shopping_item_dto_1 = require("./dto/update-shopping-item.dto");
let ShoppingListController = class ShoppingListController {
    shoppingListService;
    constructor(shoppingListService) {
        this.shoppingListService = shoppingListService;
    }
    getList(req) {
        return this.shoppingListService.getList(req.user.userId);
    }
    addItems(req, body) {
        return this.shoppingListService.addItems(req.user.userId, body.items);
    }
    toggleItem(id, req, updateDto) {
        return this.shoppingListService.toggleItem(id, req.user.userId);
    }
    removeItem(id, req) {
        return this.shoppingListService.removeItem(id, req.user.userId);
    }
};
exports.ShoppingListController = ShoppingListController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ShoppingListController.prototype, "getList", null);
__decorate([
    (0, common_1.Post)('items'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, add_shopping_items_dto_1.AddShoppingItemsDto]),
    __metadata("design:returntype", void 0)
], ShoppingListController.prototype, "addItems", null);
__decorate([
    (0, common_1.Patch)('items/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, update_shopping_item_dto_1.UpdateShoppingItemDto]),
    __metadata("design:returntype", void 0)
], ShoppingListController.prototype, "toggleItem", null);
__decorate([
    (0, common_1.Delete)('items/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ShoppingListController.prototype, "removeItem", null);
exports.ShoppingListController = ShoppingListController = __decorate([
    (0, common_1.Controller)('shopping-list'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __metadata("design:paramtypes", [shopping_list_service_1.ShoppingListService])
], ShoppingListController);
//# sourceMappingURL=shopping-list.controller.js.map