import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AddressFieldConfig } from '../entities/address-field-config.entity';
import { LocationType } from '../../location/entities/location.entity';

export interface LocationChainItem {
  type: string;
  display: string;
}

const DEFAULT_KE_SCHEMA: Record<string, unknown> = {
  version: 1,
  // Frontend can use this to drive parent->child selection via /api/v1/locations
  locationChain: [
    { type: 'country', display: 'Country' },
    { type: 'county', display: 'County' },
    { type: 'sub_county', display: 'Sub-County' },
    { type: 'ward', display: 'Ward' },
    { type: 'town', display: 'Town' },
  ],
  fields: [
    { key: 'firstName', type: 'text', required: true },
    { key: 'lastName', type: 'text', required: true },
    { key: 'phone', type: 'text', required: true },
    // The following live in Address.fieldsJson
    { key: 'addressLine1', type: 'text', required: true },
    { key: 'addressLine2', type: 'text', required: false },
    { key: 'notes', type: 'text', required: false },
  ],
};

@Injectable()
export class AddressFieldConfigService {
  constructor(
    @InjectRepository(AddressFieldConfig)
    private readonly repo: Repository<AddressFieldConfig>,
  ) {}

  async getActive(countryCode: string) {
    const code = (countryCode || 'KE').toUpperCase();

    const row = await this.repo.findOne({
      where: { countryCode: code, isActive: true },
      order: { updatedAt: 'DESC' },
    });

    if (row) return row;

    // fallback to default schema if not configured
    return {
      id: null,
      countryCode: code,
      isActive: true,
      schemaJson:
        code === 'KE' ? DEFAULT_KE_SCHEMA : { version: 1, fields: [] },
    };
  }

  async upsertActive(countryCode: string, schemaJson: Record<string, unknown>) {
    const code = (countryCode || 'KE').toUpperCase();

    let row = await this.repo.findOne({
      where: { countryCode: code, isActive: true },
    });

    if (!row) {
      row = this.repo.create({ countryCode: code, isActive: true, schemaJson });
    } else {
      row.schemaJson = schemaJson;
    }

    return this.repo.save(row);
  }

  /**
   * Get location chain with display names
   */
  async getLocationChainFull(countryCode: string): Promise<LocationChainItem[]> {
    const active = await this.getActive(countryCode);
    const schemaJson = (active as any)?.schemaJson as
      | Record<string, unknown>
      | undefined;
    const raw = schemaJson?.locationChain ?? [];

    // Default fallback with display names
    const fallback: LocationChainItem[] =
      (countryCode || 'KE').toUpperCase() === 'KE'
        ? [
            { type: LocationType.COUNTRY, display: 'Country' },
            { type: LocationType.COUNTY, display: 'County' },
            { type: LocationType.SUB_COUNTY, display: 'Sub-County' },
            { type: LocationType.WARD, display: 'Ward' },
            { type: LocationType.TOWN, display: 'Town' },
          ]
        : [{ type: LocationType.COUNTRY, display: 'Country' }];

    const chain = Array.isArray(raw) ? raw : [];

    // Handle both old format (string[]) and new format (LocationChainItem[])
    const normalized: LocationChainItem[] = chain
      .map((item) => {
        if (typeof item === 'string') {
          // Legacy format: convert string to object with auto-generated display
          const type = item.trim().toLowerCase();
          const display = type
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          return { type, display };
        }
        if (item && typeof item === 'object' && 'type' in item) {
          // New format: { type, display }
          return {
            type: String(item.type || '').trim().toLowerCase(),
            display: String(item.display || item.type || '').trim(),
          };
        }
        return null;
      })
      .filter((item): item is LocationChainItem => item !== null && !!item.type);

    return normalized.length ? normalized : fallback;
  }

  /**
   * Get location chain types only (for backwards compatibility)
   */
  async getLocationChain(countryCode: string): Promise<string[]> {
    const chain = await this.getLocationChainFull(countryCode);
    return chain.map((item) => item.type);
  }
}
