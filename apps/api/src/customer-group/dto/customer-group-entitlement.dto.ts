import { EntitlementKey } from '../entities/customer-group-entitlement.entity';

export class CustomerGroupEntitlementDto {
  id: string;
  groupId: string;
  key: EntitlementKey;
  isEnabled: boolean;
  paramsJson: Record<string, unknown>;
  createdAt: string;
}
