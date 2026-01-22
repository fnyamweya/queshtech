import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PricebookAssignment } from './entities/pricebook-assignment.entity';
import { Pricebook } from './entities/pricebook.entity';
import {
  CreatePricebookAssignmentDto,
  UpdatePricebookAssignmentDto,
  SetDefaultAssignmentDto,
} from './dto/pricebook-assignment.dto';
import { EventBusService } from '../queue/event-bus.service';

const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class PricebookAssignmentService {
  private readonly logger = new Logger(PricebookAssignmentService.name);

  constructor(
    @InjectRepository(PricebookAssignment)
    private readonly assignmentRepo: Repository<PricebookAssignment>,
    @InjectRepository(Pricebook)
    private readonly pricebookRepo: Repository<Pricebook>,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Create a new pricebook assignment
   */
  async createAssignment(dto: CreatePricebookAssignmentDto): Promise<PricebookAssignment> {
    // Validate pricebook exists
    const pricebook = await this.pricebookRepo.findOne({
      where: { id: dto.pricebookId },
    });
    if (!pricebook) {
      throw new NotFoundException({
        code: 'PRICEBOOK_NOT_FOUND',
        message: `Pricebook with ID '${dto.pricebookId}' not found`,
      });
    }

    const assignment = this.assignmentRepo.create({
      tenantId: SYSTEM_TENANT_ID,
      pricebookId: dto.pricebookId,
      channelId: dto.channelId,
      customerGroupId: dto.customerGroupId,
      countryCode: dto.countryCode,
      salesChannelId: dto.salesChannelId,
      merchantId: dto.merchantId,
      priority: dto.priority ?? 0,
      isActive: dto.isActive ?? true,
      conditionsJson: dto.conditionsJson ?? {},
    });

    const saved = await this.assignmentRepo.save(assignment);

    this.logger.log(`Assignment created: ${saved.id} (pricebook: ${dto.pricebookId})`);
    await this.eventBus.emit('pricebook.assignment.changed', {
      assignmentId: saved.id,
      pricebookId: dto.pricebookId,
      action: 'created',
    });

    return saved;
  }

  /**
   * Get assignment by ID
   */
  async getAssignment(id: string): Promise<PricebookAssignment> {
    const assignment = await this.assignmentRepo.findOne({
      where: { id },
      relations: ['pricebook', 'channel', 'customerGroup', 'salesChannel'],
    });
    if (!assignment) {
      throw new NotFoundException({
        code: 'ASSIGNMENT_NOT_FOUND',
        message: `Assignment with ID '${id}' not found`,
      });
    }
    return assignment;
  }

  /**
   * List assignments with optional filters
   */
  async listAssignments(options?: {
    pricebookId?: string;
    channelId?: string;
    customerGroupId?: string;
    countryCode?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ data: PricebookAssignment[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;

    const qb = this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.pricebook', 'pricebook')
      .leftJoinAndSelect('a.channel', 'channel')
      .leftJoinAndSelect('a.customerGroup', 'customerGroup')
      .leftJoinAndSelect('a.salesChannel', 'salesChannel')
      .where('a.tenant_id = :tenantId', { tenantId: SYSTEM_TENANT_ID })
      .orderBy('a.priority', 'DESC')
      .addOrderBy('a.created_at', 'DESC');

    if (options?.pricebookId) {
      qb.andWhere('a.pricebook_id = :pricebookId', { pricebookId: options.pricebookId });
    }
    if (options?.channelId) {
      qb.andWhere('a.channel_id = :channelId', { channelId: options.channelId });
    }
    if (options?.customerGroupId) {
      qb.andWhere('a.customer_group_id = :customerGroupId', {
        customerGroupId: options.customerGroupId,
      });
    }
    if (options?.countryCode) {
      qb.andWhere('a.country_code = :countryCode', { countryCode: options.countryCode });
    }
    if (typeof options?.isActive === 'boolean') {
      qb.andWhere('a.is_active = :isActive', { isActive: options.isActive });
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return { data, total };
  }

  /**
   * Update an assignment
   */
  async updateAssignment(
    id: string,
    dto: UpdatePricebookAssignmentDto,
  ): Promise<PricebookAssignment> {
    const assignment = await this.getAssignment(id);

    if (dto.pricebookId !== undefined) {
      const pricebook = await this.pricebookRepo.findOne({
        where: { id: dto.pricebookId },
      });
      if (!pricebook) {
        throw new NotFoundException({
          code: 'PRICEBOOK_NOT_FOUND',
          message: `Pricebook with ID '${dto.pricebookId}' not found`,
        });
      }
      assignment.pricebookId = dto.pricebookId;
    }

    if (dto.channelId !== undefined) assignment.channelId = dto.channelId ?? undefined;
    if (dto.customerGroupId !== undefined)
      assignment.customerGroupId = dto.customerGroupId ?? undefined;
    if (dto.countryCode !== undefined) assignment.countryCode = dto.countryCode ?? undefined;
    if (dto.salesChannelId !== undefined)
      assignment.salesChannelId = dto.salesChannelId ?? undefined;
    if (dto.merchantId !== undefined) assignment.merchantId = dto.merchantId ?? undefined;
    if (dto.priority !== undefined) assignment.priority = dto.priority;
    if (dto.isActive !== undefined) assignment.isActive = dto.isActive;
    if (dto.conditionsJson !== undefined) assignment.conditionsJson = dto.conditionsJson;

    const saved = await this.assignmentRepo.save(assignment);

    this.logger.log(`Assignment updated: ${saved.id}`);
    await this.eventBus.emit('pricebook.assignment.changed', {
      assignmentId: saved.id,
      pricebookId: saved.pricebookId,
      action: 'updated',
    });

    return saved;
  }

  /**
   * Delete an assignment
   */
  async deleteAssignment(id: string): Promise<{ deleted: boolean }> {
    const assignment = await this.getAssignment(id);
    await this.assignmentRepo.remove(assignment);

    this.logger.log(`Assignment deleted: ${id}`);
    await this.eventBus.emit('pricebook.assignment.changed', {
      assignmentId: id,
      pricebookId: assignment.pricebookId,
      action: 'deleted',
    });

    return { deleted: true };
  }

  /**
   * Set the default assignment (single-channel convenience)
   * This creates or updates the assignment where all routing dims are NULL
   */
  async setDefaultAssignment(dto: SetDefaultAssignmentDto): Promise<PricebookAssignment> {
    // Validate pricebook exists
    const pricebook = await this.pricebookRepo.findOne({
      where: { id: dto.pricebookId },
    });
    if (!pricebook) {
      throw new NotFoundException({
        code: 'PRICEBOOK_NOT_FOUND',
        message: `Pricebook with ID '${dto.pricebookId}' not found`,
      });
    }

    // Find existing default assignment
    const existing = await this.assignmentRepo.findOne({
      where: {
        tenantId: SYSTEM_TENANT_ID,
        channelId: IsNull(),
        customerGroupId: IsNull(),
        countryCode: IsNull(),
        salesChannelId: IsNull(),
        merchantId: IsNull(),
      },
    });

    if (existing) {
      // Update existing default
      existing.pricebookId = dto.pricebookId;
      existing.priority = dto.priority ?? existing.priority;
      existing.isActive = dto.isActive ?? existing.isActive;

      const saved = await this.assignmentRepo.save(existing);

      this.logger.log(`Default assignment updated: ${saved.id}`);
      await this.eventBus.emit('pricebook.assignment.changed', {
        assignmentId: saved.id,
        pricebookId: dto.pricebookId,
        action: 'default_updated',
      });

      return saved;
    }

    // Create new default assignment
    const assignment = this.assignmentRepo.create({
      tenantId: SYSTEM_TENANT_ID,
      pricebookId: dto.pricebookId,
      priority: dto.priority ?? 0,
      isActive: dto.isActive ?? true,
      conditionsJson: {},
    });

    const saved = await this.assignmentRepo.save(assignment);

    this.logger.log(`Default assignment created: ${saved.id}`);
    await this.eventBus.emit('pricebook.assignment.changed', {
      assignmentId: saved.id,
      pricebookId: dto.pricebookId,
      action: 'default_created',
    });

    return saved;
  }

  /**
   * Get the current default assignment
   */
  async getDefaultAssignment(): Promise<PricebookAssignment | null> {
    return this.assignmentRepo.findOne({
      where: {
        tenantId: SYSTEM_TENANT_ID,
        isActive: true,
        channelId: IsNull(),
        customerGroupId: IsNull(),
        countryCode: IsNull(),
        salesChannelId: IsNull(),
        merchantId: IsNull(),
      },
      relations: ['pricebook'],
    });
  }
}
