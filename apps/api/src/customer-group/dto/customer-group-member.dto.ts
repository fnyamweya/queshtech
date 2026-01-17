import { MemberType } from '../entities/customer-group-member.entity';

export class CustomerGroupMemberDto {
  id: string;
  groupId: string;
  memberType: MemberType;
  memberId: string;
  validFrom?: string;
  validTo?: string;
  metaJson: Record<string, unknown>;
  createdAt: string;
}
