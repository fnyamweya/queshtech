import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Pricebook,
  PricebookRevision,
  PricebookAssignment,
} from '../entities';
import { Channel } from 'src/channels/entities/channel.entity';
import { CustomerGroup } from 'src/customer-group/entities/customer-group.entity';

const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class PricebookSeeder {
  private readonly logger = new Logger(PricebookSeeder.name);

  constructor(
    @InjectRepository(Pricebook)
    private readonly pricebookRepo: Repository<Pricebook>,
    @InjectRepository(PricebookRevision)
    private readonly revisionRepo: Repository<PricebookRevision>,
    @InjectRepository(PricebookAssignment)
    private readonly assignmentRepo: Repository<PricebookAssignment>,
    @InjectRepository(Channel)
    private readonly channelRepo: Repository<Channel>,
    @InjectRepository(CustomerGroup)
    private readonly customerGroupRepo: Repository<CustomerGroup>,
  ) {}

  async seed(): Promise<void> {
    // 1. Create a default pricebook if none exists
    let defaultPricebook = await this.pricebookRepo.findOne({
      where: { code: 'DEFAULT' },
    });

    if (!defaultPricebook) {
      defaultPricebook = await this.pricebookRepo.save(
        this.pricebookRepo.create({
          tenantId: SYSTEM_TENANT_ID,
          code: 'DEFAULT',
          name: 'Default Pricebook',
          description: 'System default pricebook for all channels and customer groups',
          isActive: true,
        }),
      );
      this.logger.log(`Created default pricebook: ${defaultPricebook.id}`);
    } else {
      this.logger.log(`Default pricebook already exists: ${defaultPricebook.id}`);
    }

    // 2. Create a published revision for the default pricebook
    let defaultRevision = await this.revisionRepo.findOne({
      where: { pricebookId: defaultPricebook.id, status: 'PUBLISHED' },
      order: { revisionNumber: 'DESC' },
    });

    if (!defaultRevision) {
      // Get next revision number
      const lastRevision = await this.revisionRepo.findOne({
        where: { pricebookId: defaultPricebook.id },
        order: { revisionNumber: 'DESC' },
      });
      const nextRevision = (lastRevision?.revisionNumber ?? 0) + 1;

      const created = this.revisionRepo.create({
        tenantId: SYSTEM_TENANT_ID,
        pricebookId: defaultPricebook.id,
        revisionNumber: nextRevision,
        status: 'PUBLISHED' as const,
        effectiveFrom: new Date('2020-01-01'),
        effectiveTo: undefined,
        currencyCode: 'KES',
        configSnapshot: {
          version: '1.0.0',
          taxStrategy: 'INCLUSIVE',
          allocationStrategy: 'PROPORTIONAL',
          roundingMode: 'HALF_EVEN',
          decimals: 4,
          hints: {
            taxEnabled: true,
            promotionsEnabled: true,
            shippingAllocation: true,
          },
        },
        publishedAt: new Date(),
      });
      defaultRevision = await this.revisionRepo.save(created);
      this.logger.log(`Created published revision: ${defaultRevision.id} (rev ${nextRevision})`);
    } else {
      this.logger.log(`Published revision already exists: ${defaultRevision.id}`);
    }

    // 3. Create default assignment (wildcard - applies to all when no other matches)
    let defaultAssignment = await this.assignmentRepo.findOne({
      where: {
        pricebookId: defaultPricebook.id,
        channelId: undefined as any,
        customerGroupId: undefined as any,
        countryCode: undefined as any,
        salesChannelId: undefined as any,
        merchantId: undefined as any,
        isActive: true,
      },
    });

    // Check using query to handle NULL columns
    const existingDefault = await this.assignmentRepo
      .createQueryBuilder('a')
      .where('a.pricebook_id = :pbId', { pbId: defaultPricebook.id })
      .andWhere('a.channel_id IS NULL')
      .andWhere('a.customer_group_id IS NULL')
      .andWhere('a.country_code IS NULL')
      .andWhere('a.sales_channel_id IS NULL')
      .andWhere('a.merchant_id IS NULL')
      .andWhere('a.is_active = true')
      .getOne();

    if (!existingDefault) {
      defaultAssignment = await this.assignmentRepo.save(
        this.assignmentRepo.create({
          tenantId: SYSTEM_TENANT_ID,
          pricebookId: defaultPricebook.id,
          channelId: undefined,
          customerGroupId: undefined,
          countryCode: undefined,
          salesChannelId: undefined,
          merchantId: undefined,
          priority: 0, // lowest priority - fallback
          isActive: true,
          conditionsJson: {},
        }),
      );
      this.logger.log(`Created default assignment: ${defaultAssignment.id}`);
    } else {
      this.logger.log(`Default assignment already exists: ${existingDefault.id}`);
    }

    // 4. Optionally create channel-specific assignments
    const webChannel = await this.channelRepo.findOne({ where: { code: 'WEB' } });
    if (webChannel) {
      const existingWebAssignment = await this.assignmentRepo.findOne({
        where: { pricebookId: defaultPricebook.id, channelId: webChannel.id, isActive: true },
      });

      if (!existingWebAssignment) {
        await this.assignmentRepo.save(
          this.assignmentRepo.create({
            tenantId: SYSTEM_TENANT_ID,
            pricebookId: defaultPricebook.id,
            channelId: webChannel.id,
            priority: 10,
            isActive: true,
            conditionsJson: {},
          }),
        );
        this.logger.log(`Created WEB channel assignment`);
      }
    }

    // 5. Optionally create RETAIL customer group assignment
    const retailGroup = await this.customerGroupRepo.findOne({ where: { code: 'RETAIL' } });
    if (retailGroup) {
      const existingRetailAssignment = await this.assignmentRepo.findOne({
        where: { pricebookId: defaultPricebook.id, customerGroupId: retailGroup.id, isActive: true },
      });

      if (!existingRetailAssignment) {
        await this.assignmentRepo.save(
          this.assignmentRepo.create({
            tenantId: SYSTEM_TENANT_ID,
            pricebookId: defaultPricebook.id,
            customerGroupId: retailGroup.id,
            priority: 20,
            isActive: true,
            conditionsJson: {},
          }),
        );
        this.logger.log(`Created RETAIL customer group assignment`);
      }
    }

    this.logger.log('Pricebook seeding completed');
  }
}
