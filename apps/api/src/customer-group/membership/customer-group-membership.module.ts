import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerGroup } from 'src/customer-group/entities/customer-group.entity';
import { CustomerGroupMember } from 'src/customer-group/entities/customer-group-member.entity';
import { User } from 'src/user/entities/user.entity';
import { CustomerGroupMembershipService } from './customer-group-membership.service';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerGroup, CustomerGroupMember, User])],
  providers: [CustomerGroupMembershipService],
  exports: [CustomerGroupMembershipService],
})
export class CustomerGroupMembershipModule {}
