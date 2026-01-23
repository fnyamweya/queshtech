import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { PermissionModule } from 'src/auth/entities/permission.entity';
import { OrderService } from '../services/order.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { ResponseUtil } from 'src/common/utils/response.util';
import { OrderCreatedResponseDto } from '../dto/order-created-response.dto';
import { OrderPaymentService } from 'src/order-payment/order-payment.service';
import {
  OrderResponseDto,
  OrdersListResponseDto,
} from '../dto/order-response.dto';
import { CreateOrderShippingQuoteDto } from '../dto/order-shipping-quote.dto';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import { RepriceOrderDto } from '../dto/order-reprice.dto';
import { OrderPricingPipelineService } from '../services/order-pricing-pipeline.service';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProductSku } from 'src/catalog/entities/product-sku.entity';

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
import { LockPricingDto } from '../dto/order-lock-pricing.dto';
import { ApplyPricingAdjustmentsDto } from '../dto/order-pricing-adjustments.dto';
import { ResolveBatchesDto } from '../dto/resolve-batches.dto';

@Controller('orders')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
@ApiTags('Orders')
@ApiBearerAuth('access-token')
@ApiExtraModels(
  OrderCreatedResponseDto,
  OrderResponseDto,
  OrdersListResponseDto,
)
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderPaymentService: OrderPaymentService,
    private readonly pricingPipeline: OrderPricingPipelineService,
    @InjectRepository(ProductSku)
    private readonly productSkuRepo: Repository<ProductSku>,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ module: PermissionModule.ORDERS, permission: 'read' })
  @ApiOperation({ summary: 'List orders (minimal)' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page size (default 10)',
  })
  @ApiOkResponse({
    description: 'Orders retrieved successfully',
    type: OrdersListResponseDto,
  })
  async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await this.orderService.findAndCount({
      skip,
      take: safeLimit,
      order: { createdAt: 'DESC' },
    });

    const summaryMap = await this.orderPaymentService.getSummaryMapForOrders(
      data.map((o) => ({ id: o.id, grandTotal: o.grandTotal })),
    );

    const withPaymentSummary = data.map((o) => ({
      ...o,
      paymentSummary:
        summaryMap[o.id] ??
        ({
          capturedTotal: '0.0000',
          adjustedTotal: '0.0000',
          reversedTotal: '0.0000',
          refundedTotal: '0.0000',
          netPaidTotal: '0.0000',
          status: 'PENDING',
        } as any),
    }));

    return ResponseUtil.paginated(
      withPaymentSummary as any,
      total,
      safePage,
      safeLimit,
      'Orders retrieved successfully',
    );
  }

  @Post(':id/reprice')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ module: PermissionModule.ORDERS, permission: 'update' })
  @ApiOperation({ summary: 'Reprice a DRAFT order (resolve revision, upsert snapshot, run pricing)' })
  @ApiBody({ type: RepriceOrderDto })
  async reprice(@Param('id') id: string, @Body() dto: RepriceOrderDto) {
    const result = await this.pricingPipeline.repriceDraftOrder(id, dto);
    return ResponseUtil.success(result as any, 'Order repriced');
  }

  @Post(':id/lock-pricing')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ module: PermissionModule.ORDERS, permission: 'update' })
  @ApiOperation({ summary: 'Lock pricing at checkout boundary (prevents repricing drift)' })
  @ApiBody({ type: LockPricingDto })
  async lockPricing(@Param('id') id: string, @Body() dto: LockPricingDto) {
    const result = await this.pricingPipeline.lockPricing(id, dto);
    return ResponseUtil.success(result as any, 'Pricing locked');
  }

  @Post(':id/pricing-adjustments')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ module: PermissionModule.ORDERS, permission: 'update' })
  @ApiOperation({ summary: 'Apply append-only pricing adjustments (requires locked pricing)' })
  @ApiBody({ type: ApplyPricingAdjustmentsDto })
  async applyPricingAdjustments(
    @Param('id') id: string,
    @Body() dto: ApplyPricingAdjustmentsDto,
  ) {
    const result = await this.pricingPipeline.applyPricingAdjustments(id, dto);
    return ResponseUtil.success(result as any, 'Pricing adjustments applied');
  }

  @Get(':id/batches')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ module: PermissionModule.ORDERS, permission: 'read' })
  @ApiOperation({ summary: 'Get batches for an order' })
  async getBatches(@Param('id') id: string) {
    const result = await this.pricingPipeline.getBatches(id);
    return ResponseUtil.success(result as any, 'Batches retrieved');
  }

  @Post(':id/batches/resolve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ module: PermissionModule.ORDERS, permission: 'update' })
  @ApiOperation({ summary: 'Resolve batches for an order (groundwork for multi-warehouse shipping)' })
  @ApiBody({ type: ResolveBatchesDto })
  async resolveBatches(
    @Param('id') id: string,
    @Body() dto: ResolveBatchesDto,
  ) {
    const result = await this.pricingPipeline.resolveBatches(id, dto);
    return ResponseUtil.success(result as any, 'Batches resolved');
  }

  @Get(':id/pricing')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ module: PermissionModule.ORDERS, permission: 'read' })
  @ApiOperation({ summary: 'Get current pricing artifacts for an order (snapshot + latest pricing run)' })
  async getPricing(@Param('id') id: string) {
    const result = await this.pricingPipeline.getCurrentPricing(id);
    return ResponseUtil.success(result as any, 'Order pricing retrieved');
  }

  @Get('/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ module: PermissionModule.ORDERS, permission: 'read' })
  @ApiOperation({ summary: 'Get order by id' })
  @ApiOkResponse({
    description: 'Order retrieved successfully',
    type: OrderResponseDto,
  })
  async findOne(@Param('id') id: string) {
    const order = await this.orderService.findOneHydrated(id);
    const pricing = await this.pricingPipeline.getCurrentPricing(id);

    // Fetch product/SKU details for all items
    const skuIds = (order.items ?? []).map((item) => item.productSkuId).filter(Boolean);
    const skus = skuIds.length
      ? await this.productSkuRepo.find({
          where: { id: In(skuIds) },
          relations: ['product', 'images'],
        })
      : [];
    const skuMap = new Map(skus.map((s) => [s.id, s]));

    const items = (order.items ?? []).map((item) => {
      const sku = skuMap.get(item.productSkuId);
      const primaryImage = sku?.images?.find((img) => img.isPrimary) ?? sku?.images?.[0];
      return {
        ...(item as any),
        product: sku?.product
          ? {
              id: sku.product.id,
              title: sku.product.title,
              slug: sku.product.slug,
              shortDescription: sku.product.shortDescription ?? null,
            }
          : null,
        skuDetails: sku
          ? {
              id: sku.id,
              sku: sku.sku,
              title: sku.title,
              options: sku.options ?? {},
              imageUrl: primaryImage?.url ?? null,
            }
          : null,
        pricing: buildItemPricing(item, pricing),
      };
    });
    const summary = await this.orderPaymentService.getSummary(id);
    return ResponseUtil.success(
      {
        ...(order as any),
        items,
        paymentSummary: {
          capturedTotal: summary.capturedTotal,
          adjustedTotal: summary.adjustedTotal,
          reversedTotal: summary.reversedTotal,
          refundedTotal: summary.refundedTotal,
          netPaidTotal: summary.netPaidTotal,
          status: summary.status,
        },
      },
      'Order retrieved successfully',
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ module: PermissionModule.ORDERS, permission: 'create' })
  @ApiOperation({ summary: 'Create an order' })
  @ApiBody({ type: CreateOrderDto })
  @ApiCreatedResponse({
    description: 'Order created successfully',
    type: OrderCreatedResponseDto,
  })
  async create(@Body() payload: CreateOrderDto) {
    const order = await this.orderService.create(payload);
    return ResponseUtil.created(order, 'Order created successfully');
  }

  @Post('/:id/shipping/quote')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ module: PermissionModule.ORDERS, permission: 'update' })
  @ApiOperation({ summary: 'Apply a negotiated shipping quote to an order' })
  @ApiBody({ type: CreateOrderShippingQuoteDto })
  @ApiOkResponse({ description: 'Shipping quote applied', type: OrderResponseDto })
  async applyShippingQuote(
    @Param('id') id: string,
    @Body() payload: CreateOrderShippingQuoteDto,
  ) {
    const order = await this.orderService.applyShippingQuote({
      orderId: id,
      amount: payload.amount,
      currencyCode: payload.currencyCode,
      note: payload.note,
      sendNotifications: payload.sendNotifications,
    });
    return ResponseUtil.success(order, 'Shipping quote applied');
  }

  @Get('/:id/invoice')
  @ApiExcludeEndpoint()
  async invoiceHtml(
    @Param('id') id: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const order = await this.orderService.findOneHydrated(id);
    this.orderService.assertInvoiceToken(order, token);
    const links = await this.orderService.getInvoiceLinks(order);
    const pricing = await this.pricingPipeline.getCurrentPricing(id);
    const items = (order.items ?? []).map((item) => ({
      ...(item as any),
      pricing: buildItemPricing(item, pricing),
    }));

    const itemsHtml = items
      .map(
        (item) => `
        <tr>
          <td style="padding: 6px 0;">${item.sku || item.productSkuId}</td>
          <td style="padding: 6px 0; text-align:right;">${item.quantity}</td>
          <td style="padding: 6px 0; text-align:right;">${order.currencyCode} ${Number(item.pricing?.total || 0).toFixed(2)}</td>
        </tr>
      `,
      )
      .join('');

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Invoice ${order.orderNumber}</title>
        </head>
        <body style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
          <h2>Invoice ${order.orderNumber}</h2>
          <p>Customer: ${order.customerName || order.customerEmail}</p>
          <p>Status: ${order.status}</p>
          <table style="width:100%; border-collapse: collapse; margin-top: 12px;">
            <thead>
              <tr>
                <th style="text-align:left; padding-bottom: 6px;">Item</th>
                <th style="text-align:right; padding-bottom: 6px;">Qty</th>
                <th style="text-align:right; padding-bottom: 6px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <hr style="margin: 16px 0;" />
          <p>Items subtotal: ${order.currencyCode} ${Number(order.itemsSubtotal || 0).toFixed(2)}</p>
          <p>Discount: ${order.currencyCode} ${Number(order.discountTotal || 0).toFixed(2)}</p>
          <p>Shipping: ${order.currencyCode} ${Number(order.shippingTotal || 0).toFixed(2)}</p>
          <p>Tax: ${order.currencyCode} ${(Number(order.taxTotal || 0) + Number(order.shippingTax || 0)).toFixed(2)}</p>
          <h3>Total: ${order.currencyCode} ${Number(order.grandTotal || 0).toFixed(2)}</h3>
          <p><a href="${links.paymentUrl}">Pay now</a></p>
          <p><a href="${links.pdfUrl}">Download PDF</a></p>
        </body>
      </html>
    `;

    res.status(HttpStatus.OK).setHeader('Content-Type', 'text/html');
    return res.send(html);
  }

  @Get('/:id/invoice/summary')
  @ApiExcludeEndpoint()
  async invoiceSummary(@Param('id') id: string, @Query('token') token: string) {
    const order = await this.orderService.findOneHydrated(id);
    this.orderService.assertInvoiceToken(order, token);
    const pricing = await this.pricingPipeline.getCurrentPricing(id);
    const items = (order.items ?? []).map((item) => ({
      ...(item as any),
      pricing: buildItemPricing(item, pricing),
    }));

    const shippingCharge = (order.orderLevelCharges ?? [])
      .filter((c) => c.chargeKind === 'shipping')
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];

    const meta: any = order.metaJson ?? {};
    const shippingQuoteNote = meta?.shippingQuote?.note
      ? String(meta.shippingQuote.note)
      : undefined;

    return ResponseUtil.success(
      {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        currencyCode: order.currencyCode,
        status: order.status,
        itemsSubtotal: order.itemsSubtotal,
        discountTotal: order.discountTotal,
        shippingSubtotal: order.shippingSubtotal,
        shippingTotal: order.shippingTotal,
        taxTotal: order.taxTotal,
        shippingTax: order.shippingTax,
        grandTotal: order.grandTotal,
        shippingMethodLabel: shippingCharge?.displayName || 'Shipping',
        shippingRate: shippingCharge?.amount ?? order.shippingSubtotal,
        shippingQuoteNote,
        items: items.map((item) => ({
          id: item.id,
          name: item.sku || item.productSkuId,
          quantity: item.quantity,
          total: item.pricing?.total,
        })),
      },
      'Invoice summary retrieved',
    );
  }

  @Get('/:id/invoice.pdf')
  @ApiExcludeEndpoint()
  async invoicePdf(
    @Param('id') id: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const order = await this.orderService.findOneHydrated(id);
    this.orderService.assertInvoiceToken(order, token);
    const pricing = await this.pricingPipeline.getCurrentPricing(id);
    const items = (order.items ?? []).map((item) => ({
      ...(item as any),
      pricing: buildItemPricing(item, pricing),
    }));

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="invoice-${order.orderNumber}.pdf"`,
    );

    doc.pipe(res);
    doc.fontSize(18).text(`Invoice ${order.orderNumber}`, { align: 'left' });
    doc.moveDown();
    doc.fontSize(11).text(`Customer: ${order.customerName || order.customerEmail}`);
    doc.text(`Status: ${order.status}`);
    doc.moveDown();

    doc.fontSize(12).text('Items', { underline: true });
    doc.moveDown(0.5);

    items.forEach((item) => {
      const line = `${item.quantity} x ${item.sku || item.productSkuId}`;
      const total = `${order.currencyCode} ${Number(item.pricing?.total || 0).toFixed(2)}`;
      doc.fontSize(10).text(line, { continued: true });
      doc.text(total, { align: 'right' });
    });

    doc.moveDown();
    doc.fontSize(11).text(`Items subtotal: ${order.currencyCode} ${Number(order.itemsSubtotal || 0).toFixed(2)}`);
    doc.text(`Discount: ${order.currencyCode} ${Number(order.discountTotal || 0).toFixed(2)}`);
    doc.text(`Shipping: ${order.currencyCode} ${Number(order.shippingTotal || 0).toFixed(2)}`);
    doc.text(`Tax: ${order.currencyCode} ${(Number(order.taxTotal || 0) + Number(order.shippingTax || 0)).toFixed(2)}`);
    doc.moveDown();
    doc.fontSize(13).text(`Total: ${order.currencyCode} ${Number(order.grandTotal || 0).toFixed(2)}`);

    doc.end();
  }
}
