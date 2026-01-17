import { CustomerGroupFeatures, CustomerGroupPricePolicy, CustomerGroupRule, CustomerGroupStatus, CustomerGroupType } from '../entities/customer-group.entity';

export class CustomerGroupDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  groupType: CustomerGroupType;
  status: CustomerGroupStatus;
  priority: number;
  isStackable: boolean;
  validFrom?: string;
  validTo?: string;
  featuresJson: CustomerGroupFeatures;
  eligibilityRulesJson: CustomerGroupRule[];
  pricePolicyJson: CustomerGroupPricePolicy;
  metaJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
