import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaystackService } from './services/paystack.service';
import { PaystackController } from './controllers/paystack.controller';
import { OrderPaymentModule } from 'src/order-payment/order-payment.module';
import { OrderModule } from 'src/order/order.module';
import { CommonModule } from 'src/common/common.module';
import { Order } from 'src/order/entities/order.entity';
import { OrderPayment } from 'src/order-payment/entities/order-payment.entity';
import { PaystackSdk } from './sdk/paystack.sdk';

@Module({
  imports: [CommonModule, OrderPaymentModule, OrderModule, TypeOrmModule.forFeature([Order, OrderPayment])],
  controllers: [PaystackController],
  providers: [PaystackService, PaystackSdk],
  exports: [PaystackService, PaystackSdk],
})
export class PaystackModule {}
