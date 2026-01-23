import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import { PromotionModule } from '../promotion/promotion.module';
import { SettingModule } from '../setting/setting.module';
import { TaxService } from './services/tax.service';
import { Order } from './entities/order.entity';
import { ShippingModule } from '../shipping/shipping.module';
import { OrderItem } from './entities/order-item.entity';
import { OrderLevelCharge } from './entities/order-level-charge.entity';
import { OrderShippingAddress } from './entities/order-shipping-address.entity';
import { OrderService } from './services/order.service';
import { OrderController } from './controllers/order.controller';
import { CustomerOrdersController } from './controllers/customer-orders.controller';
import { User } from '../user/entities/user.entity';
import { Location } from '../location/entities/location.entity';
import { CurrencyModule } from '../currency/currency.module';
import { CustomerShippingAddressModule } from '../customer-shipping-address/customer-shipping-address.module';
import { SmsModule } from '../sms/sms.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { OrderNotificationService } from './services/order-notification.service';
import { OrderPaymentModule } from '../order-payment/order-payment.module';
import { PricingModule } from '../pricing/pricing.module';
import { OrderPricingPipelineService } from './services/order-pricing-pipeline.service';
import {
  ChargeAllocation,
  ChargeComponent,
  PricingAppliedRule,
  PricingRun,
} from '../pricing/entities';
import { Batch, BatchItem } from './batches/entities';
import { ProductSku } from '../catalog/entities/product-sku.entity';
import { AddressModule } from '../address/address.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      OrderLevelCharge,
      OrderShippingAddress,
      PricingRun,
      ChargeComponent,
      ChargeAllocation,
      PricingAppliedRule,
      Batch,
      BatchItem,
      User,
      Location,
      ProductSku,
    ]),
    CatalogModule,
    PromotionModule,
    PricingModule,
    // need settings for shipping & tax
    SettingModule,
    // Shipping module provides the shipping matrix
    ShippingModule,
    CurrencyModule,
    CustomerShippingAddressModule,
    OrderPaymentModule,
    AddressModule,
    SmsModule,
    WhatsappModule,
  ],
  controllers: [OrderController, CustomerOrdersController],
  providers: [OrderService, TaxService, OrderNotificationService, OrderPricingPipelineService],
  exports: [TypeOrmModule, OrderService, OrderPricingPipelineService],
})
export class OrderModule {}
