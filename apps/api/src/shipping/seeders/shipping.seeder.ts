import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShippingZone } from '../entities/shipping-zone.entity';
import { ShippingZoneLocation } from '../entities/shipping-zone-location.entity';
import { ShippingMethod } from '../entities/shipping-method.entity';
import { ShippingRate } from '../entities/shipping-rate.entity';
import { ShippingZoneMethod } from '../entities/shipping-zone-method.entity';
import { ShippingProvider } from '../entities/shipping-provider.entity';
import {
  Location,
  LocationType,
} from '../../location/entities/location.entity';

@Injectable()
export class ShippingSeeder {
  constructor(
    @InjectRepository(ShippingZone)
    private readonly zoneRepo: Repository<ShippingZone>,
    @InjectRepository(ShippingZoneLocation)
    private readonly locRepo: Repository<ShippingZoneLocation>,
    @InjectRepository(ShippingMethod)
    private readonly methodRepo: Repository<ShippingMethod>,
    @InjectRepository(ShippingZoneMethod)
    private readonly zoneMethodRepo: Repository<ShippingZoneMethod>,
    @InjectRepository(ShippingRate)
    private readonly rateRepo: Repository<ShippingRate>,
    @InjectRepository(ShippingProvider)
    private readonly providerRepo: Repository<ShippingProvider>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
  ) {}

  async seed() {
    // Seed default provider
    let internal = await this.providerRepo.findOne({ where: { code: 'internal' } });
    if (!internal) {
      internal = this.providerRepo.create({
        code: 'internal',
        name: 'Internal Fleet',
        isActive: true,
        metaJson: {
          seededBy: 'ShippingSeeder',
          configVersion: '1',
          mode: 'sandbox',
        },
      });
      await this.providerRepo.save(internal);
    }

    // Create a global zone if missing
    let global = await this.zoneRepo.findOne({ where: { code: 'global' } });
    if (!global) {
      global = this.zoneRepo.create({
        code: 'global',
        name: 'Global',
        description: 'Default fallback zone',
      });
      await this.zoneRepo.save(global);
    }

    // Add Kenya zone example
    let kenya = await this.zoneRepo.findOne({ where: { code: 'kenya' } });
    if (!kenya) {
      kenya = this.zoneRepo.create({
        code: 'kenya',
        name: 'Kenya',
        description: 'Kenya shipping zone',
      });
      await this.zoneRepo.save(kenya);
    }

    // Ensure Kenya zone has a locationId mapping (required for the locationId-only matcher)
    const kenyaCountry = await this.locationRepo.findOne({
      where: { type: LocationType.COUNTRY, countryCode: 'KE' },
    });
    if (kenya && kenyaCountry) {
      const existing = await this.locRepo.findOne({
        where: { zoneId: kenya.id, locationId: kenyaCountry.id },
      });
      if (!existing) {
        await this.locRepo.save(
          this.locRepo.create({
            zoneId: kenya.id,
            type: 'location',
            locationId: kenyaCountry.id,
            countryCode: 'KE',
          }),
        );
      }
    }

    // Seed basic methods/rates if missing
    if (kenya) {
      let standard = await this.methodRepo.findOne({
        where: { code: 'standard' },
      });
      if (!standard) {
        standard = this.methodRepo.create({
          code: 'standard',
          displayName: 'Standard Shipping',
          isActive: true,
          providerId: internal?.id,
        });
        await this.methodRepo.save(standard);
      } else if (!standard.providerId && internal?.id) {
        standard.providerId = internal.id;
        await this.methodRepo.save(standard);
      }

      const standardAttach = await this.zoneMethodRepo.findOne({
        where: { zoneId: kenya.id, shippingMethodId: standard.id },
      });
      if (!standardAttach) {
        await this.zoneMethodRepo.save(
          this.zoneMethodRepo.create({
            zoneId: kenya.id,
            shippingMethodId: standard.id,
            isActive: true,
          }),
        );
      }

      const standardRates = await this.rateRepo.find({
        where: { methodId: standard.id },
      });
      const hasFreeFlat = standardRates.some(
        (r) => r.calculationType === 'flat' && Number(r.price) === 0,
      );
      if (!standardRates.length || !hasFreeFlat) {
        await this.rateRepo.save(
          this.rateRepo.create({
            methodId: standard.id,
            calculationType: 'flat',
            price: '0.00',
            priority: 10,
            metaJson: { seededBy: 'ShippingSeeder', seedKey: 'kenya-flat-free' },
          }),
        );
      }

      let express = await this.methodRepo.findOne({
        where: { code: 'express' },
      });
      if (!express) {
        express = this.methodRepo.create({
          code: 'express',
          displayName: 'Express Shipping',
          isActive: true,
          providerId: internal?.id,
        });
        await this.methodRepo.save(express);
      } else if (!express.providerId && internal?.id) {
        express.providerId = internal.id;
        await this.methodRepo.save(express);
      }

      const expressAttach = await this.zoneMethodRepo.findOne({
        where: { zoneId: kenya.id, shippingMethodId: express.id },
      });
      if (!expressAttach) {
        await this.zoneMethodRepo.save(
          this.zoneMethodRepo.create({
            zoneId: kenya.id,
            shippingMethodId: express.id,
            isActive: true,
          }),
        );
      }

      const expressRates = await this.rateRepo.find({
        where: { methodId: express.id },
      });
      if (!expressRates.length) {
        await this.rateRepo.save(
          this.rateRepo.create({
            methodId: express.id,
            calculationType: 'per_weight',
            price: '0',
            pricePerUnit: '20.00',
            minWeight: '0',
            maxWeight: '5',
            priority: 5,
          }),
        );
        await this.rateRepo.save(
          this.rateRepo.create({
            methodId: express.id,
            calculationType: 'per_weight',
            price: '0',
            pricePerUnit: '15.00',
            minWeight: '5',
            priority: 1,
          }),
        );
      }

      let negotiated = await this.methodRepo.findOne({
        where: { code: 'internal_negotiated' },
      });
      if (!negotiated) {
        negotiated = this.methodRepo.create({
          code: 'internal_negotiated',
          displayName: 'Standard Negotiated',
          isActive: true,
          providerId: internal?.id,
        });
        await this.methodRepo.save(negotiated);
      } else if (!negotiated.providerId && internal?.id) {
        negotiated.providerId = internal.id;
        await this.methodRepo.save(negotiated);
      }

      const negotiatedAttach = await this.zoneMethodRepo.findOne({
        where: { zoneId: kenya.id, shippingMethodId: negotiated.id },
      });
      if (!negotiatedAttach) {
        await this.zoneMethodRepo.save(
          this.zoneMethodRepo.create({
            zoneId: kenya.id,
            shippingMethodId: negotiated.id,
            isActive: true,
          }),
        );
      }

      const negotiatedRates = await this.rateRepo.find({
        where: { methodId: negotiated.id },
      });
      const hasNegotiatedZero = negotiatedRates.some(
        (r) => r.calculationType === 'flat' && Number(r.price) === 0,
      );
      if (!negotiatedRates.length || !hasNegotiatedZero) {
        await this.rateRepo.save(
          this.rateRepo.create({
            methodId: negotiated.id,
            calculationType: 'flat',
            price: '0.00',
            priority: 20,
            metaJson: {
              seededBy: 'ShippingSeeder',
              seedKey: 'kenya-negotiated',
              negotiated: true,
              description: 'Negotiated shipping quote required',
            },
          }),
        );
      }
    }
  }
}
