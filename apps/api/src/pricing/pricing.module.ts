import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceList } from 'src/catalog/entities/price-list.entity';
import { CurrencyModule } from 'src/currency/currency.module';
import { QueueModule } from 'src/queue/queue.module';
import { Channel } from 'src/channels/entities/channel.entity';
import { CustomerGroup } from 'src/customer-group/entities/customer-group.entity';
import { SalesChannel } from 'src/catalog/entities/sales-channel.entity';

// Existing price list controller/service
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

// Pricebook entities
import {
  Pricebook,
  PricebookRevision,
  PricebookAssignment,
  OrderPricingSnapshot,
} from './entities';

// Pricebook services
import { PricebookService } from './pricebook.service';
import { PricebookRoutingService } from './pricebook-routing.service';
import { PricingSnapshotService } from './pricing-snapshot.service';
import { PricebookAssignmentService } from './pricebook-assignment.service';

// Pricebook controllers
import { PricebookController } from './pricebook.controller';
import { PricebookAssignmentController } from './pricebook-assignment.controller';
import {
  PricingRuntimeController,
  OrderPricingSnapshotController,
} from './pricing-runtime.controller';

// Seeder
import { PricebookSeeder } from './seeders/pricebook.seeder';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Existing
      PriceList,
      // Pricebook entities
      Pricebook,
      PricebookRevision,
      PricebookAssignment,
      OrderPricingSnapshot,
      // Related entities for relationships
      Channel,
      CustomerGroup,
      SalesChannel,
    ]),
    CurrencyModule,
    QueueModule,
  ],
  controllers: [
    // Existing
    PricingController,
    // Pricebook admin
    PricebookController,
    PricebookAssignmentController,
    // Runtime
    PricingRuntimeController,
    OrderPricingSnapshotController,
  ],
  providers: [
    // Existing
    PricingService,
    // Pricebook services
    PricebookService,
    PricebookRoutingService,
    PricingSnapshotService,
    PricebookAssignmentService,
    // Seeder
    PricebookSeeder,
  ],
  exports: [
    PricingService,
    PricebookService,
    PricebookRoutingService,
    PricingSnapshotService,
    PricebookAssignmentService,
    PricebookSeeder,
  ],
})
export class PricingModule {}

