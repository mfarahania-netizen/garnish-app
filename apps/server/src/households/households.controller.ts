import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import {
  CreateHouseholdDto,
  CreateHouseholdInviteDto,
  CreateHouseholdShoppingItemDto,
  MarkHouseholdItemUnavailableDto,
  ResolveHouseholdDecisionDto,
  TransferHouseholdOwnerDto,
  UpdateHouseholdShoppingItemDto,
  VersionDto,
  VersionQueryDto,
} from './dto/household.dto';
import { HouseholdsService } from './households.service';

@Controller('households')
@UseGuards(AuthGuard('jwt'))
export class HouseholdsController {
  constructor(private readonly households: HouseholdsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() req: AuthenticatedRequest) {
    return this.households.list(req.user.userId);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateHouseholdDto,
  ) {
    return this.households.create(req.user.userId, idempotencyKey, dto);
  }

  @Get('invites/pending')
  @Header('Cache-Control', 'no-store')
  pendingInvites(@Req() req: AuthenticatedRequest) {
    return this.households.pendingInvites(req.user.userId);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':id/invites')
  invite(
    @Req() req: AuthenticatedRequest,
    @Param('id') householdId: string,
    @Body() dto: CreateHouseholdInviteDto,
  ) {
    return this.households.invite(req.user.userId, householdId, dto);
  }

  @Get(':id/invites')
  @Header('Cache-Control', 'no-store')
  outgoingInvites(
    @Req() req: AuthenticatedRequest,
    @Param('id') householdId: string,
  ) {
    return this.households.outgoingInvites(req.user.userId, householdId);
  }

  @Post(':id/invites/:inviteId/revoke')
  revokeInvite(
    @Req() req: AuthenticatedRequest,
    @Param('id') householdId: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.households.revokeInvite(req.user.userId, householdId, inviteId);
  }

  @Post('invites/:inviteId/accept')
  acceptInvite(
    @Req() req: AuthenticatedRequest,
    @Param('inviteId') inviteId: string,
  ) {
    return this.households.acceptInvite(req.user.userId, inviteId);
  }

  @Post('invites/:inviteId/decline')
  declineInvite(
    @Req() req: AuthenticatedRequest,
    @Param('inviteId') inviteId: string,
  ) {
    return this.households.declineInvite(req.user.userId, inviteId);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  get(@Req() req: AuthenticatedRequest, @Param('id') householdId: string) {
    return this.households.get(req.user.userId, householdId);
  }

  @Get(':id/shopping')
  @Header('Cache-Control', 'no-store')
  shopping(@Req() req: AuthenticatedRequest, @Param('id') householdId: string) {
    return this.households.shopping(req.user.userId, householdId);
  }

  @Post(':id/shopping/items')
  addItem(
    @Req() req: AuthenticatedRequest,
    @Param('id') householdId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateHouseholdShoppingItemDto,
  ) {
    return this.households.addItem(
      req.user.userId,
      householdId,
      idempotencyKey,
      dto,
    );
  }

  @Patch(':id/shopping/items/:itemId')
  updateItem(
    @Req() req: AuthenticatedRequest,
    @Param('id') householdId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateHouseholdShoppingItemDto,
  ) {
    return this.households.updateItem(
      req.user.userId,
      householdId,
      itemId,
      dto,
    );
  }

  @Delete(':id/shopping/items/:itemId')
  deleteItem(
    @Req() req: AuthenticatedRequest,
    @Param('id') householdId: string,
    @Param('itemId') itemId: string,
    @Query() query: VersionQueryDto,
  ) {
    return this.households.deleteItem(
      req.user.userId,
      householdId,
      itemId,
      query.version,
    );
  }

  @Post(':id/shopping/items/:itemId/unavailable')
  unavailable(
    @Req() req: AuthenticatedRequest,
    @Param('id') householdId: string,
    @Param('itemId') itemId: string,
    @Body() dto: MarkHouseholdItemUnavailableDto,
  ) {
    return this.households.markUnavailable(
      req.user.userId,
      householdId,
      itemId,
      dto,
    );
  }

  @Post(':id/shopping/decisions/:decisionId/resolve')
  resolveDecision(
    @Req() req: AuthenticatedRequest,
    @Param('id') householdId: string,
    @Param('decisionId') decisionId: string,
    @Body() dto: ResolveHouseholdDecisionDto,
  ) {
    return this.households.resolveDecision(
      req.user.userId,
      householdId,
      decisionId,
      dto,
    );
  }

  @Post(':id/shopping/decisions/:decisionId/cancel')
  cancelDecision(
    @Req() req: AuthenticatedRequest,
    @Param('id') householdId: string,
    @Param('decisionId') decisionId: string,
    @Body() dto: VersionDto,
  ) {
    return this.households.cancelDecision(
      req.user.userId,
      householdId,
      decisionId,
      dto.version,
    );
  }

  @Post(':id/shopping/sessions')
  startSession(
    @Req() req: AuthenticatedRequest,
    @Param('id') householdId: string,
  ) {
    return this.households.startSession(req.user.userId, householdId);
  }

  @Post(':id/shopping/sessions/:sessionId/end')
  endSession(
    @Req() req: AuthenticatedRequest,
    @Param('id') householdId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: VersionDto,
  ) {
    return this.households.endSession(
      req.user.userId,
      householdId,
      sessionId,
      dto.version,
    );
  }

  @Delete(':id/members/:membershipId')
  removeMember(
    @Req() req: AuthenticatedRequest,
    @Param('id') householdId: string,
    @Param('membershipId') membershipId: string,
    @Query() query: VersionQueryDto,
  ) {
    return this.households.removeMember(
      req.user.userId,
      householdId,
      membershipId,
      query.version,
    );
  }

  @Post(':id/leave')
  leave(
    @Req() req: AuthenticatedRequest,
    @Param('id') householdId: string,
    @Body() dto: VersionDto,
  ) {
    return this.households.leave(req.user.userId, householdId, dto.version);
  }

  @Post(':id/transfer-owner')
  transferOwner(
    @Req() req: AuthenticatedRequest,
    @Param('id') householdId: string,
    @Body() dto: TransferHouseholdOwnerDto,
  ) {
    return this.households.transferOwner(req.user.userId, householdId, dto);
  }
}
