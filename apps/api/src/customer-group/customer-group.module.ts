import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerGroup } from './entities/customer-group.entity';
import { CustomerGroupMember } from './entities/customer-group-member.entity';
import { CustomerGroupEntitlement } from './entities/customer-group-entitlement.entity';
import { CustomerGroupService } from './customer-group.service';
import { CustomerGroupController } from './customer-group.controller';
import { CustomerGroupSeeder } from './seeders/customer-group.seeder';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerGroup,
      CustomerGroupMember,
      CustomerGroupEntitlement,
    ]),
  ],
  controllers: [CustomerGroupController],
  providers: [CustomerGroupService, CustomerGroupSeeder],
  exports: [CustomerGroupService, CustomerGroupSeeder, TypeOrmModule],
})
export class CustomerGroupModule {}
