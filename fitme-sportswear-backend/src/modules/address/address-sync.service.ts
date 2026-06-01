import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { PancakeAddressUnit, PancakeClient } from '../pancake/pancake.client';
import { SapoAddressUnit, SapoClient } from '../sapo/sapo.client';

interface MatchedAddressUnit {
  sapo: SapoAddressUnit;
  pancake: PancakeAddressUnit;
  similarity: number;
}

interface DistrictMappingRow {
  sapoId: number;
  sapoName: string;
  sapoCityId: number;
  sapoCity: string;
  pancakeId: number;
  pancakeName: string;
  similarity: number;
}

interface WardMappingRow {
  sapoId: number;
  sapoName: string;
  sapoDistrictId: number;
  sapoDistrict: string;
  sapoCityId: number;
  sapoCity: string;
  pancakeId: number;
  pancakeName: string;
  similarity: number;
}

@Injectable()
export class AddressSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sapoClient: SapoClient,
    private readonly pancakeClient: PancakeClient,
    private readonly configService?: ConfigService,
  ) {}

  async syncAddressMappings() {
    if (!this.configBoolean('sync.address.enabled', true)) {
      return { provinces: 0, districts: 0, wards: 0, skipped: true };
    }

    const sapoCities = await this.sapoClient.fetchCities();
    const pancakeProvinces = await this.pancakeClient.fetchProvinces();
    this.assertMinimumCount('Sapo cities', sapoCities.length, this.configNumber('sync.address.minProvinces', 1));
    this.assertMinimumCount('Pancake provinces', pancakeProvinces.length, this.configNumber('sync.address.minProvinces', 1));
    const provinceMatches = this.matchAddressUnits(sapoCities, pancakeProvinces);
    this.assertMinimumCount('Province matches', provinceMatches.length, this.configNumber('sync.address.minProvinces', 1));

    const provinceRows = provinceMatches.map((match) => ({
      sapoId: match.sapo.id,
      sapoName: match.sapo.name,
      pancakeId: match.pancake.id,
      pancakeName: match.pancake.name,
      similarity: match.similarity,
    }));

    const districtRows: DistrictMappingRow[] = [];
    const wardRows: WardMappingRow[] = [];

    for (const province of provinceMatches) {
      const sapoDistricts = await this.sapoClient.fetchDistrictsByCityId(
        province.sapo.id,
      );
      const pancakeDistricts = await this.pancakeClient.fetchDistrictsByProvinceId(
        province.pancake.id,
      );
      const districtMatches = this.matchAddressUnits(sapoDistricts, pancakeDistricts);

      for (const district of districtMatches) {
        districtRows.push({
          sapoId: district.sapo.id,
          sapoName: district.sapo.name,
          sapoCityId: province.sapo.id,
          sapoCity: province.sapo.name,
          pancakeId: district.pancake.id,
          pancakeName: district.pancake.name,
          similarity: district.similarity,
        });

        const sapoWards = await this.sapoClient.fetchWardsByDistrictId(
          district.sapo.id,
        );
        const pancakeCommunes =
          await this.pancakeClient.fetchCommunesByDistrictId(district.pancake.id);
        const wardMatches = this.matchAddressUnits(sapoWards, pancakeCommunes);

        wardRows.push(
          ...wardMatches.map((ward) => ({
            sapoId: ward.sapo.id,
            sapoName: ward.sapo.name,
            sapoDistrictId: district.sapo.id,
            sapoDistrict: district.sapo.name,
            sapoCityId: province.sapo.id,
            sapoCity: province.sapo.name,
            pancakeId: ward.pancake.id,
            pancakeName: ward.pancake.name,
            similarity: ward.similarity,
          })),
        );
      }
    }

    this.assertMinimumCount('District matches', districtRows.length, this.configNumber('sync.address.minDistricts', 1));
    this.assertMinimumCount('Ward matches', wardRows.length, this.configNumber('sync.address.minWards', 1));

    await this.runInTransaction(async (tx) => {
      await tx.provinceMapping.deleteMany();
      await tx.provinceMapping.createMany({ data: provinceRows });
      await tx.districtMapping.deleteMany();
      await tx.districtMapping.createMany({ data: districtRows });
      await tx.wardMapping.deleteMany();
      await tx.wardMapping.createMany({ data: wardRows });
    });

    return {
      provinces: provinceMatches.length,
      districts: districtRows.length,
      wards: wardRows.length,
    };
  }

  private matchAddressUnits(
    sapoUnits: SapoAddressUnit[],
    pancakeUnits: PancakeAddressUnit[],
  ): MatchedAddressUnit[] {
    const maxDistance = this.configNumber('sync.address.maxDistance', 0.75);

    return sapoUnits
      .map((sapo) => {
        const ranked = pancakeUnits
          .map((pancake) => ({
            sapo,
            pancake,
            similarity: this.distance(sapo.name, pancake.name),
          }))
          .sort((left, right) => left.similarity - right.similarity);
        const best = ranked[0] ?? null;
        return best && best.similarity <= maxDistance ? best : null;
      })
      .filter((match): match is MatchedAddressUnit => match !== null);
  }

  private distance(left: string, right: string): number {
    const leftTokens = new Set(this.normalize(left).split(' ').filter(Boolean));
    const rightTokens = new Set(this.normalize(right).split(' ').filter(Boolean));
    const allTokens = new Set([...leftTokens, ...rightTokens]);
    let shared = 0;

    for (const token of allTokens) {
      if (leftTokens.has(token) && rightTokens.has(token)) {
        shared += 1;
      }
    }

    if (allTokens.size === 0) {
      return 0;
    }

    return 1 - shared / allTokens.size;
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\b(tp|tinh|thanh pho|huyen|quan|thi xa|xa|phuong|thi tran)\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private async runInTransaction(work: (tx: PrismaService) => Promise<void>): Promise<void> {
    if (typeof (this.prisma as any).$transaction === 'function') {
      await (this.prisma as any).$transaction((tx: PrismaService) => work(tx));
      return;
    }

    await work(this.prisma);
  }

  private assertMinimumCount(label: string, count: number, minimum: number): void {
    if (count < minimum) {
      throw new Error(`${label} count ${count} is below minimum ${minimum}`);
    }
  }

  private configBoolean(key: string, fallback: boolean): boolean {
    const value = this.configService?.get<boolean | string | undefined>(key);
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    return value === true || value === 'true';
  }

  private configNumber(key: string, fallback: number): number {
    const value = this.configService?.get<number | string | undefined>(key);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
