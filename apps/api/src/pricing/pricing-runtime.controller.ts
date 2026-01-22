import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { PermissionModule } from 'src/auth/entities/permission.entity';
import { ResponseUtil } from 'src/common/utils/response.util';
import { PricebookRoutingService } from './pricebook-routing.service';
import { PricingSnapshotService } from './pricing-snapshot.service';
import { ResolvePricebookDto, UpsertOrderPricingSnapshotDto } from './dto';

@Controller('pricing')
@ApiTags('Pricing Runtime')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class PricingRuntimeController {
  constructor(
    private readonly routingService: PricebookRoutingService,
    private readonly snapshotService: PricingSnapshotService,
  ) {}

  @Post('resolve-pricebook')
  @RequirePermissions({ module: PermissionModule.PRICING, permission: 'read' })
  @ApiOperation({
    summary: 'Resolve effective pricebook + revision for an order context',
  })
  @ApiBody({ type: ResolvePricebookDto })
  @ApiOkResponse({ description: 'Resolution result' })
  @ApiNotFoundResponse({ description: 'No default assignment or effective revision found' })
  async resolvePricebook(@Body() dto: ResolvePricebookDto) {
    const resolution = await this.routingService.resolvePricebook(dto);
    return ResponseUtil.success({ resolution }, 'Pricebook resolved');
  }
}

@Controller('orders')
@ApiTags('Order Pricing Snapshot')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class OrderPricingSnapshotController {
  constructor(private readonly snapshotService: PricingSnapshotService) {}

  @Put(':orderId/pricing-snapshot')
  @RequirePermissions({ module: PermissionModule.ORDERS, permission: 'update' })
  @ApiOperation({ summary: 'Upsert order pricing snapshot (unlocked only)' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  @ApiBody({ type: UpsertOrderPricingSnapshotDto })
  @ApiOkResponse({ description: 'Snapshot upserted' })
  @ApiConflictResponse({ description: 'Snapshot is locked' })
  @ApiNotFoundResponse({ description: 'Revision not found' })
  async upsertSnapshot(
    @Param('orderId') orderId: string,
    @Body() dto: UpsertOrderPricingSnapshotDto,
  ) {
    const snapshot = await this.snapshotService.upsertSnapshot(orderId, dto);
    return ResponseUtil.success({ snapshot }, 'Pricing snapshot upserted');
  }

  @Get(':orderId/pricing-snapshot')
  @RequirePermissions({ module: PermissionModule.ORDERS, permission: 'read' })
  @ApiOperation({ summary: 'Get order pricing snapshot' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  @ApiOkResponse({ description: 'Snapshot retrieved' })
  @ApiNotFoundResponse({ description: 'Snapshot not found' })
  async getSnapshot(@Param('orderId') orderId: string) {
    const snapshot = await this.snapshotService.getSnapshotByOrderId(orderId);
    return ResponseUtil.success({ snapshot }, 'Pricing snapshot retrieved');
  }

  @Post(':orderId/pricing-snapshot/lock')
  @RequirePermissions({ module: PermissionModule.ORDERS, permission: 'update' })
  @ApiOperation({ summary: 'Lock order pricing snapshot (checkout boundary)' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  @ApiOkResponse({ description: 'Snapshot locked' })
  @ApiConflictResponse({ description: 'Snapshot already locked' })
  @ApiNotFoundResponse({ description: 'Snapshot not found' })
  async lockSnapshot(@Param('orderId') orderId: string) {
    const snapshot = await this.snapshotService.lockSnapshot(orderId);
    return ResponseUtil.success({ snapshot }, 'Pricing snapshot locked');
  }

  @Get(':orderId/pricing-snapshot/config')
  @RequirePermissions({ module: PermissionModule.ORDERS, permission: 'read' })
  @ApiOperation({ summary: 'Get the config snapshot for an order' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  @ApiOkResponse({ description: 'Config snapshot retrieved' })
  @ApiNotFoundResponse({ description: 'Snapshot not found' })
  async getConfigSnapshot(@Param('orderId') orderId: string) {
    const result = await this.snapshotService.getOrderConfigSnapshot(orderId);
    return ResponseUtil.success(
      {
        configSnapshot: result.configSnapshot,
        revisionId: result.revision.id,
        revisionNumber: result.revision.revisionNumber,
        pricebookId: result.revision.pricebookId,
        lockedAt: result.snapshot.lockedAt,
      },
      'Config snapshot retrieved',
    );
  }
}
