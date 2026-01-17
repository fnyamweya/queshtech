import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerGroup } from './entities/customer-group.entity';
import { CustomerGroupMember } from './entities/customer-group-member.entity';
import { CustomerGroupEntitlement } from './entities/customer-group-entitlement.entity';
import { CreateCustomerGroupDto } from './dto/create-customer-group.dto';
import { UpdateCustomerGroupDto } from './dto/update-customer-group.dto';
import { CustomerGroupDto } from './dto/customer-group.dto';
import { CustomerGroupMemberDto } from './dto/customer-group-member.dto';
import { CreateCustomerGroupMemberDto } from './dto/create-customer-group-member.dto';
import { UpdateCustomerGroupMemberDto } from './dto/update-customer-group-member.dto';
import { CustomerGroupEntitlementDto } from './dto/customer-group-entitlement.dto';
import { UpsertCustomerGroupEntitlementDto } from './dto/upsert-customer-group-entitlement.dto';

@Injectable()
export class CustomerGroupService {
  constructor(
    @InjectRepository(CustomerGroup)
    private readonly groupRepository: Repository<CustomerGroup>,
    @InjectRepository(CustomerGroupMember)
    private readonly memberRepository: Repository<CustomerGroupMember>,
    @InjectRepository(CustomerGroupEntitlement)
    private readonly entitlementRepository: Repository<CustomerGroupEntitlement>,
  ) {}

  private normalizeCode(code: string): string {
    const normalized = (code ?? '').trim().toUpperCase();
    if (!normalized) throw new BadRequestException('Group code cannot be empty');
    return normalized;
  }

  private toGroupDto(row: CustomerGroup): CustomerGroupDto {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      groupType: row.groupType,
      status: row.status,
      priority: row.priority,
      isStackable: row.isStackable,
      validFrom: row.validFrom ? row.validFrom.toISOString() : undefined,
      validTo: row.validTo ? row.validTo.toISOString() : undefined,
      featuresJson: (row.featuresJson ?? {}) as any,
      eligibilityRulesJson: (row.eligibilityRulesJson ?? []) as any,
      pricePolicyJson: (row.pricePolicyJson ?? {}) as any,
      metaJson: (row.metaJson ?? {}) as any,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toMemberDto(row: CustomerGroupMember): CustomerGroupMemberDto {
    return {
      id: row.id,
      groupId: row.groupId,
      memberType: row.memberType,
      memberId: row.memberId,
      validFrom: row.validFrom ? row.validFrom.toISOString() : undefined,
      validTo: row.validTo ? row.validTo.toISOString() : undefined,
      metaJson: (row.metaJson ?? {}) as any,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toEntitlementDto(
    row: CustomerGroupEntitlement,
  ): CustomerGroupEntitlementDto {
    return {
      id: row.id,
      groupId: row.groupId,
      key: row.key,
      isEnabled: row.isEnabled,
      paramsJson: (row.paramsJson ?? {}) as any,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async listGroups(): Promise<CustomerGroupDto[]> {
    const rows = await this.groupRepository.find({
      order: { priority: 'DESC', code: 'ASC' },
    });
    return rows.map((r) => this.toGroupDto(r));
  }

  async createGroup(payload: CreateCustomerGroupDto): Promise<CustomerGroupDto> {
    const code = this.normalizeCode(payload.code);

    const exists = await this.groupRepository.exist({
      where: { code } as any,
    });
    if (exists) throw new BadRequestException('Group code already exists');

    const row = this.groupRepository.create({
      code,
      name: payload.name.trim(),
      description: payload.description?.trim(),
      groupType: payload.groupType ?? 'retail',
      status: payload.status ?? 'active',
      priority: payload.priority ?? 0,
      isStackable: payload.isStackable ?? false,
      validFrom: payload.validFrom ? new Date(payload.validFrom) : undefined,
      validTo: payload.validTo ? new Date(payload.validTo) : undefined,
      featuresJson: (payload.featuresJson ?? {}) as any,
      eligibilityRulesJson: (payload.eligibilityRulesJson ?? []) as any,
      pricePolicyJson: (payload.pricePolicyJson ?? {}) as any,
      metaJson: (payload.metaJson ?? {}) as any,
    });

    const saved = await this.groupRepository.save(row);
    return this.toGroupDto(saved);
  }

  async updateGroup(
    code: string,
    payload: UpdateCustomerGroupDto,
  ): Promise<CustomerGroupDto> {
    const normalized = this.normalizeCode(code);
    const row = await this.groupRepository.findOne({
      where: { code: normalized } as any,
    });
    if (!row) throw new NotFoundException('Group not found');

    Object.assign(row, {
      name: payload.name !== undefined ? payload.name.trim() : row.name,
      description:
        payload.description !== undefined
          ? payload.description?.trim()
          : row.description,
      groupType: payload.groupType ?? row.groupType,
      status: payload.status ?? row.status,
      priority: payload.priority ?? row.priority,
      isStackable: payload.isStackable ?? row.isStackable,
      validFrom:
        payload.validFrom !== undefined
          ? payload.validFrom
            ? new Date(payload.validFrom)
            : undefined
          : row.validFrom,
      validTo:
        payload.validTo !== undefined
          ? payload.validTo
            ? new Date(payload.validTo)
            : undefined
          : row.validTo,
      featuresJson: payload.featuresJson ?? row.featuresJson,
      eligibilityRulesJson:
        payload.eligibilityRulesJson ?? row.eligibilityRulesJson,
      pricePolicyJson: payload.pricePolicyJson ?? row.pricePolicyJson,
      metaJson: payload.metaJson ?? row.metaJson,
    });

    const saved = await this.groupRepository.save(row);
    return this.toGroupDto(saved);
  }

  async deleteGroup(code: string): Promise<void> {
    const normalized = this.normalizeCode(code);
    const row = await this.groupRepository.findOne({
      where: { code: normalized } as any,
    });
    if (!row) throw new NotFoundException('Group not found');
    await this.groupRepository.remove(row);
  }

  async listMembers(filters?: {
    groupId?: string;
    memberType?: string;
    memberId?: string;
  }): Promise<CustomerGroupMemberDto[]> {
    const where: Record<string, unknown> = {};
    if (filters?.groupId) where.groupId = filters.groupId;
    if (filters?.memberType) where.memberType = filters.memberType;
    if (filters?.memberId) where.memberId = filters.memberId;

    const rows = await this.memberRepository.find({
      where: where as any,
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.toMemberDto(r));
  }

  async createMember(
    payload: CreateCustomerGroupMemberDto,
  ): Promise<CustomerGroupMemberDto> {
    const group = await this.groupRepository.findOne({
      where: { id: payload.groupId } as any,
    });
    if (!group) throw new NotFoundException('Group not found');

    const row = this.memberRepository.create({
      groupId: payload.groupId,
      memberType: payload.memberType,
      memberId: payload.memberId,
      validFrom: payload.validFrom ? new Date(payload.validFrom) : undefined,
      validTo: payload.validTo ? new Date(payload.validTo) : undefined,
      metaJson: (payload.metaJson ?? {}) as any,
    });

    const saved = await this.memberRepository.save(row);
    return this.toMemberDto(saved);
  }

  async updateMember(
    id: string,
    payload: UpdateCustomerGroupMemberDto,
  ): Promise<CustomerGroupMemberDto> {
    const row = await this.memberRepository.findOne({ where: { id } as any });
    if (!row) throw new NotFoundException('Member not found');

    Object.assign(row, {
      validFrom:
        payload.validFrom !== undefined
          ? payload.validFrom
            ? new Date(payload.validFrom)
            : undefined
          : row.validFrom,
      validTo:
        payload.validTo !== undefined
          ? payload.validTo
            ? new Date(payload.validTo)
            : undefined
          : row.validTo,
      metaJson: payload.metaJson ?? row.metaJson,
    });

    const saved = await this.memberRepository.save(row);
    return this.toMemberDto(saved);
  }

  async deleteMember(id: string): Promise<void> {
    const row = await this.memberRepository.findOne({ where: { id } as any });
    if (!row) throw new NotFoundException('Member not found');
    await this.memberRepository.remove(row);
  }

  async listEntitlements(groupId?: string): Promise<CustomerGroupEntitlementDto[]> {
    const where: Record<string, unknown> = {};
    if (groupId) where.groupId = groupId;
    const rows = await this.entitlementRepository.find({
      where: where as any,
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.toEntitlementDto(r));
  }

  async upsertEntitlement(
    payload: UpsertCustomerGroupEntitlementDto,
  ): Promise<CustomerGroupEntitlementDto> {
    const group = await this.groupRepository.findOne({
      where: { id: payload.groupId } as any,
    });
    if (!group) throw new NotFoundException('Group not found');

    let row = await this.entitlementRepository.findOne({
      where: { groupId: payload.groupId, key: payload.key } as any,
    });

    if (!row) {
      row = this.entitlementRepository.create({
        groupId: payload.groupId,
        key: payload.key,
        isEnabled: payload.isEnabled ?? true,
        paramsJson: (payload.paramsJson ?? {}) as any,
      });
    } else {
      row.isEnabled = payload.isEnabled ?? row.isEnabled;
      row.paramsJson = (payload.paramsJson ?? row.paramsJson) as any;
    }

    const saved = await this.entitlementRepository.save(row);
    return this.toEntitlementDto(saved);
  }

  async deleteEntitlement(id: string): Promise<void> {
    const row = await this.entitlementRepository.findOne({ where: { id } as any });
    if (!row) throw new NotFoundException('Entitlement not found');
    await this.entitlementRepository.remove(row);
  }
}
