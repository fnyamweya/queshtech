import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { PermissionModule } from 'src/auth/entities/permission.entity';
import { ResponseUtil } from 'src/common/utils/response.util';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from 'src/auth/interfaces/user.interface';
import { Order } from 'src/order/entities/order.entity';
import { Repository } from 'typeorm';
import { PaystackService } from '../services/paystack.service';

@ApiTags('Paystack')
@Controller('paystack')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class PaystackController {
  constructor(
    private readonly paystackService: PaystackService,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Initialize Paystack transaction' })
  async initialize(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    const payload = await this.paystackService.initializeForOrder(body?.orderId, user?.id);
    return ResponseUtil.success(payload, 'Paystack initialized');
  }

  @Post('verify/:reference')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ module: PermissionModule.ORDERS, permission: 'read' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verify Paystack transaction (admin)' })
  async verify(@Param('reference') reference: string) {
    const payload = await this.paystackService.verifyTransaction(reference);
    return ResponseUtil.success(payload, 'Paystack verified');
  }

  @Post('confirm/:reference')
  async confirm(@Param('reference') reference: string) {
    const payload = await this.paystackService.confirm(reference);
    return ResponseUtil.success(payload, 'Paystack confirmed');
  }

  @Get('pay/:orderId')
  @ApiExcludeEndpoint()
  async payForOrder(
    @Param('orderId') orderId: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const meta: any = order.metaJson ?? {};
    const expected = String(meta.invoiceToken || '').trim();
    if (!expected || expected !== String(token || '').trim()) {
      throw new BadRequestException('Invalid payment token');
    }

    const payload = await this.paystackService.initializeForOrder(orderId);
    const url = payload?.authorization_url || payload?.data?.authorization_url;
    if (!url) throw new BadRequestException('Missing Paystack authorization URL');

    return res.redirect(url);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Paystack webhook' })
  async webhook(@Req() req: Request, @Headers('x-paystack-signature') signature?: string) {
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (rawBody) {
      this.paystackService.validateWebhookSignature(rawBody, signature);
    }
    await this.paystackService.handleWebhook(req.body);
    return ResponseUtil.success({ received: true }, 'Webhook received');
  }
}
