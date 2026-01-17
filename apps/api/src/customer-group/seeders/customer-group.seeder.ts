import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerGroup } from '../entities/customer-group.entity';

@Injectable()
export class CustomerGroupSeeder {
  constructor(
    @InjectRepository(CustomerGroup)
    private readonly groupRepository: Repository<CustomerGroup>,
  ) {}

  async seed(): Promise<void> {
    const defaults: Array<
      Pick<
        CustomerGroup,
        | 'code'
        | 'name'
        | 'description'
        | 'groupType'
        | 'status'
        | 'priority'
        | 'isStackable'
        | 'featuresJson'
        | 'eligibilityRulesJson'
        | 'pricePolicyJson'
        | 'metaJson'
      >
    > = [
      {
        code: 'RETAIL',
        name: 'Retail',
        description: 'Default retail customer group',
        groupType: 'retail',
        status: 'active',
        priority: 0,
        isStackable: false,
        featuresJson: {},
        eligibilityRulesJson: [],
        pricePolicyJson: {},
        metaJson: {},
      },
    ];

    for (const g of defaults) {
      const exists = await this.groupRepository.findOne({
        where: { code: g.code } as any,
      });
      if (exists) continue;
      await this.groupRepository.save(this.groupRepository.create(g as any));
    }
  }
}
