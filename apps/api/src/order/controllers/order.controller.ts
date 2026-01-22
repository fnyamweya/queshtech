import {
  Body,
  Controller,
  Get,
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
    const summary = await this.orderPaymentService.getSummary(id);
    return ResponseUtil.success(
      {
        ...(order as any),
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

    const itemsHtml = (order.items ?? [])
      .map(
        (item) => `
        <tr>
          <td style="padding: 6px 0;">${item.productName}</td>
          <td style="padding: 6px 0; text-align:right;">${item.quantity}</td>
          <td style="padding: 6px 0; text-align:right;">${order.currencyCode} ${Number(item.total || 0).toFixed(2)}</td>
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
        items: (order.items ?? []).map((item) => ({
          id: item.id,
          name: item.productName,
          quantity: item.quantity,
          total: item.total,
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

    (order.items ?? []).forEach((item) => {
      const line = `${item.quantity} x ${item.productName}`;
      const total = `${order.currencyCode} ${Number(item.total || 0).toFixed(2)}`;
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
