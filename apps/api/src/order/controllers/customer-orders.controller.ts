import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from 'src/auth/interfaces/user.interface';
import { ResponseUtil } from 'src/common/utils/response.util';
import { OrderService } from '../services/order.service';
import { OrderPaymentService } from 'src/order-payment/order-payment.service';
import { OrderPricingPipelineService } from '../services/order-pricing-pipeline.service';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProductSku } from 'src/catalog/entities/product-sku.entity';
import { OrderShippingAddress } from '../entities/order-shipping-address.entity';
import { Location } from 'src/location/entities/location.entity';
import { Batch } from '../batches/entities';
import { AddressFieldConfigService } from 'src/address/services/address-field-config.service';

function buildItemPricing(item: any, pricing: { charges: any[]; allocations: any[] }) {
  const charges = (pricing.charges ?? []).filter((c) => c.orderItemId === item.id);
  const allocations = (pricing.allocations ?? []).filter((a) => a.orderItemId === item.id);

  const baseCharges = charges.filter((c) => c.chargeType === 'BASE');
  const taxCharges = charges.filter((c) => c.chargeType === 'TAX');
  const feeCharges = charges.filter((c) => c.chargeType === 'FEE');
  const discountCharges = charges.filter((c) => c.chargeType === 'DISCOUNT');

  const base = baseCharges.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const tax = taxCharges.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const fee = feeCharges.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const discount = allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0);

  const unitPrice = item.quantity ? base / item.quantity : base;
  const total = base + fee + tax + discount;

  // Build charge components breakdown
  const components = [
    ...baseCharges.map((c) => ({
      type: 'BASE',
      name: c.displayName || 'Base Price',
      amount: c.amount,
      sourceType: c.sourceType,
      sourceReference: c.sourceReference,
    })),
    ...taxCharges.map((c) => ({
      type: 'TAX',
      name: c.displayName || 'Tax',
      amount: c.amount,
      rate: (c.metaJson as any)?.rate,
      sourceType: c.sourceType,
      sourceReference: c.sourceReference,
    })),
    ...feeCharges.map((c) => ({
      type: 'FEE',
      name: c.displayName || 'Fee',
      amount: c.amount,
      sourceType: c.sourceType,
      sourceReference: c.sourceReference,
    })),
    ...discountCharges.map((c) => ({
      type: 'DISCOUNT',
      name: c.displayName || 'Discount',
      amount: c.amount,
      sourceType: c.sourceType,
      sourceReference: c.sourceReference,
    })),
  ];

  return {
    unitPrice: unitPrice.toFixed(4),
    baseSubtotal: base.toFixed(4),
    discountTotal: discount.toFixed(4),
    feeTotal: fee.toFixed(4),
    taxTotal: tax.toFixed(4),
    total: total.toFixed(4),
    components,
  };
}

@Controller('customer/orders')
@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
@ApiTags('Customer Orders')
@ApiBearerAuth('access-token')
export class CustomerOrdersController {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderPaymentService: OrderPaymentService,
    private readonly pricingPipeline: OrderPricingPipelineService,
    private readonly dataSource: DataSource,
    private readonly addressFieldConfigService: AddressFieldConfigService,
    @InjectRepository(ProductSku)
    private readonly productSkuRepo: Repository<ProductSku>,
  ) {}

  /**
   * Get location hierarchy from a location up to its root (country)
   * Uses the country's address field config to determine the location chain order and display names
   */
  private async getLocationHierarchy(
    locationId: string,
    countryCode: string,
  ): Promise<Array<{ id: string; name: string; type: string; typeDisplay: string }>> {
    const treeRepo = this.dataSource.getTreeRepository(Location);
    const location = await treeRepo.findOne({ where: { id: locationId } });
    if (!location) return [];
    
    const ancestors = await treeRepo.findAncestors(location);
    // ancestors is from child to root, so we reverse for display (country first)
    const rawResult = [...ancestors, location]
      .filter((loc, idx, arr) => arr.findIndex(l => l.id === loc.id) === idx); // dedupe
    
    // Get location chain with display names from address field config (dynamic per country)
    const locationChain = await this.addressFieldConfigService.getLocationChainFull(countryCode);
    const typeToDisplay = new Map(locationChain.map((item) => [item.type, item.display]));
    const typeOrder = locationChain.map((item) => item.type);

    const result = rawResult.map((loc) => ({
      id: loc.id,
      name: loc.name,
      type: loc.type,
      typeDisplay: typeToDisplay.get(loc.type) || loc.type,
    }));

    result.sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));
    
    return result;
  }

  @Get()
  @ApiOperation({ summary: 'List orders for the current customer' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Customer orders retrieved successfully' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await this.orderService.findAndCount({
      where: { customerId: user.id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        currencyCode: true,
        grandTotal: true,
        placedAt: true,
        createdAt: true,
      } as any,
      skip,
      take: safeLimit,
      order: { createdAt: 'DESC' },
    });

    const summaryMap = await this.orderPaymentService.getSummaryMapForOrders(
      data.map((o) => ({ id: o.id, grandTotal: o.grandTotal })),
    );

    const withSummary = data.map((order) => {
      const summary = summaryMap[order.id];
      return {
        ...(order as any),
        paymentSummary: summary
          ? {
              capturedTotal: summary.capturedTotal,
              adjustedTotal: summary.adjustedTotal,
              reversedTotal: summary.reversedTotal,
              refundedTotal: summary.refundedTotal,
              netPaidTotal: summary.netPaidTotal,
              status: summary.status,
            }
          : undefined,
      };
    });

    return ResponseUtil.paginated(
      withSummary,
      total,
      safePage,
      safeLimit,
      'Customer orders retrieved successfully',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an order for the current customer' })
  @ApiOkResponse({ description: 'Customer order retrieved successfully' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const order = await this.orderService.findOneHydrated(id);
    if (!order.customerId || order.customerId !== user.id) {
      throw new ForbiddenException('Access denied: Order does not belong to user');
    }

    const pricing = await this.pricingPipeline.getCurrentPricing(id);

    // Fetch shipping address with location hierarchy
    const shippingAddressRow = await this.dataSource
      .getRepository(OrderShippingAddress)
      .findOne({ where: { orderId: id } });

    let shippingAddress: any = null;
    if (shippingAddressRow) {
      // Get country name from country code (simple lookup)
      const countryNames: Record<string, string> = {
        KE: 'Kenya',
        UG: 'Uganda',
        TZ: 'Tanzania',
        RW: 'Rwanda',
        NG: 'Nigeria',
        GH: 'Ghana',
        ZA: 'South Africa',
        US: 'United States',
        GB: 'United Kingdom',
      };
      const countryName = shippingAddressRow.countryCode
        ? countryNames[shippingAddressRow.countryCode] ?? shippingAddressRow.countryCode
        : null;

      // Get location hierarchy using country's field config for ordering
      let locationHierarchy: Array<{ id: string; name: string; type: string }> = [];
      if (shippingAddressRow.locationId) {
        locationHierarchy = await this.getLocationHierarchy(
          shippingAddressRow.locationId,
          shippingAddressRow.countryCode ?? 'KE',
        );
      }

      shippingAddress = {
        firstName: shippingAddressRow.firstName,
        lastName: shippingAddressRow.lastName,
        phone: shippingAddressRow.phone,
        countryCode: shippingAddressRow.countryCode,
        countryName,
        locationId: shippingAddressRow.locationId,
        locationHierarchy,
        fields: shippingAddressRow.fieldsJson ?? {},
      };
    }

    // Fetch batches for this order
    const batchRows = await this.dataSource.getRepository(Batch).find({
      where: { orderId: id },
      relations: ['items'],
      order: { createdAt: 'ASC' },
    });

    const batches = batchRows.map((b) => ({
      id: b.id,
      warehouseId: b.warehouseId,
      status: b.status,
      shippingAddress: b.shippingAddressSnapshotJson,
      items: (b.items ?? []).map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        quantity: item.quantity,
      })),
      createdAt: b.createdAt,
    }));

    // Fetch product/SKU details for all items
    const skuIds = (order.items ?? []).map((item) => item.productSkuId).filter(Boolean);
    const skuMap = new Map<string, any>();
    if (skuIds.length > 0) {
      const skus = await this.productSkuRepo.find({
        where: skuIds.map((skuId) => ({ id: skuId })),
        relations: ['product', 'images'],
      });
      for (const sku of skus) {
        skuMap.set(sku.id, sku);
      }
    }

    const items = (order.items ?? []).map((item) => {
      const sku = skuMap.get(item.productSkuId);
      const product = sku?.product;
      const primaryImage = sku?.images?.find((img: any) => img.isPrimary) ?? sku?.images?.[0];

      // Find which batch this item belongs to
      const batchInfo = batches.find((b) =>
        b.items.some((bi) => bi.orderItemId === item.id)
      );

      return {
        ...(item as any),
        // Product details
        product: product
          ? {
              id: product.id,
              title: product.title,
              slug: product.slug,
              shortDescription: product.shortDescription ?? null,
            }
          : null,
        // SKU details
        skuDetails: sku
          ? {
              id: sku.id,
              sku: sku.sku,
              title: sku.title,
              options: sku.options ?? {},
              imageUrl: primaryImage?.url ?? null,
            }
          : null,
        // Pricing breakdown
        pricing: buildItemPricing(item, pricing),
        // Batch info (for multi-shipment orders)
        batchId: batchInfo?.id ?? null,
      };
    });

    const summary = await this.orderPaymentService.getSummary(id);
    return ResponseUtil.success(
      {
        ...(order as any),
        items,
        shippingAddress,
        batches,
        paymentSummary: {
          capturedTotal: summary.capturedTotal,
          adjustedTotal: summary.adjustedTotal,
          reversedTotal: summary.reversedTotal,
          refundedTotal: summary.refundedTotal,
          netPaidTotal: summary.netPaidTotal,
          status: summary.status,
        },
      },
      'Customer order retrieved successfully',
    );
  }
}
