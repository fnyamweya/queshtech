import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerGroup, CustomerGroupRule } from 'src/customer-group/entities/customer-group.entity';
import { CustomerGroupMember } from 'src/customer-group/entities/customer-group-member.entity';
import { User } from 'src/user/entities/user.entity';

export type ResolvedCustomerGroup = {
  groupCode?: string;
  source: 'member' | 'rule' | 'default';
  matchedGroupId?: string;
};

@Injectable()
export class CustomerGroupMembershipService {
  constructor(
    @InjectRepository(CustomerGroup)
    private readonly groupRepository: Repository<CustomerGroup>,
    @InjectRepository(CustomerGroupMember)
    private readonly memberRepository: Repository<CustomerGroupMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private isWithinValidity(now: Date, from?: Date, to?: Date): boolean {
    if (from && now < from) return false;
    if (to && now > to) return false;
    return true;
  }

  private evaluateRule(rule: CustomerGroupRule, facts: Record<string, unknown>): boolean {
    switch (rule.type) {
      case 'tag': {
        const tags = Array.isArray(facts.tags) ? (facts.tags as string[]) : [];
        const values = rule.values ?? [];
        const has = values.some((v) => tags.includes(v));
        return rule.operator === 'not_in' ? !has : has;
      }
      case 'country': {
        const country = (facts.country as string | undefined)?.toUpperCase();
        const values = (rule.values ?? []).map((v) => v.toUpperCase());
        const has = country ? values.includes(country) : false;
        return rule.operator === 'not_in' ? !has : has;
      }
      case 'kyc_level': {
        const level = typeof facts.kycLevel === 'number' ? (facts.kycLevel as number) : undefined;
        if (typeof level !== 'number') return false;
        if (rule.operator === 'gte') return level >= rule.value;
        return level === rule.value;
      }
      case 'email_domain': {
        const domain = (facts.emailDomain as string | undefined)?.toLowerCase();
        const values = (rule.values ?? []).map((v) => v.toLowerCase());
        const has = domain ? values.includes(domain) : false;
        return has;
      }
      case 'org_id': {
        const orgId = facts.orgId as string | undefined;
        const values = rule.values ?? [];
        const has = orgId ? values.includes(orgId) : false;
        return has;
      }
      default:
        return false;
    }
  }

  private isEligibleByRules(
    group: CustomerGroup,
    facts: Record<string, unknown>,
  ): boolean {
    const rules = Array.isArray(group.eligibilityRulesJson)
      ? group.eligibilityRulesJson
      : [];
    if (!rules.length) return false;
    return rules.every((r) => this.evaluateRule(r, facts));
  }

  async resolveGroupsForUser(userId: string): Promise<ResolvedCustomerGroup[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } as any });
    if (!user) throw new NotFoundException('User not found');

    const now = new Date();
    const groups = await this.groupRepository.find({
      order: { priority: 'DESC', code: 'ASC' },
    });

    const activeGroups = groups.filter(
      (g) => g.status === 'active' && this.isWithinValidity(now, g.validFrom, g.validTo),
    );

    const members = await this.memberRepository.find({
      where: { memberType: 'customer', memberId: userId } as any,
      order: { createdAt: 'DESC' },
    });

    const validMemberGroupIds = new Set(
      members
        .filter((m) => this.isWithinValidity(now, m.validFrom, m.validTo))
        .map((m) => m.groupId),
    );

    const facts: Record<string, unknown> = {
      userId: user.id,
      email: user.email,
      emailDomain: user.email?.includes('@') ? user.email.split('@')[1] : undefined,
    };

    const memberMatches = activeGroups.filter((g) => validMemberGroupIds.has(g.id));
    const ruleMatches = activeGroups.filter((g) => this.isEligibleByRules(g, facts));

    const byPriority = (a: CustomerGroup, b: CustomerGroup) => {
      const dp = (b.priority ?? 0) - (a.priority ?? 0);
      if (dp) return dp;
      return a.code.localeCompare(b.code);
    };

    const resolved: ResolvedCustomerGroup[] = [];
    const sortedMembers = memberMatches.sort(byPriority);
    const sortedRules = ruleMatches
      .filter((g) => !validMemberGroupIds.has(g.id))
      .sort(byPriority);

    const candidates = [...sortedMembers, ...sortedRules];
    for (const g of candidates) {
      const source = validMemberGroupIds.has(g.id) ? 'member' : 'rule';
      resolved.push({ groupCode: g.code, source, matchedGroupId: g.id });
      if (!g.isStackable) break;
    }

    return resolved;
  }

  async resolvePrimaryGroupForUser(userId: string): Promise<ResolvedCustomerGroup> {
    const resolved = await this.resolveGroupsForUser(userId);
    if (resolved.length) return resolved[0];

    const fallback = await this.groupRepository.findOne({
      where: { status: 'active' } as any,
      order: { priority: 'DESC', code: 'ASC' },
    });
    return {
      groupCode: fallback?.code,
      source: 'default',
      matchedGroupId: fallback?.id,
    };
  }
}
