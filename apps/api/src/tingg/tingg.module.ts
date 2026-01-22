import { Module } from '@nestjs/common';
import { TinggService } from './services/tingg.service';
import { TinggController } from './controllers/tingg.controller';
import { CommonModule } from 'src/common/common.module';
import { OrderPaymentModule } from 'src/order-payment/order-payment.module';
import { OrderModule } from 'src/order/order.module';
import { TinggSdk } from './sdk/tingg.sdk';

@Module({
  imports: [CommonModule, OrderPaymentModule, OrderModule],
  controllers: [TinggController],
  providers: [TinggService, TinggSdk],
  exports: [TinggService, TinggSdk],
})
export class TinggModule {}
