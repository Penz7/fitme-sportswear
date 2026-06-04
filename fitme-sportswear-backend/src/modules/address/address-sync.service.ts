import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PancakeAddressUnit, PancakeClient } from '../pancake/pancake.client';
import { SapoAddressUnit, SapoClient } from '../sapo/sapo.client';

interface MatchedAddressUnit {
  sapo: SapoAddressUnit;
  pancake: PancakeAddressUnit;
  similarity: number;
}

@Injectable()
export class AddressSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sapoClient: SapoClient,
    private readonly pancakeClient: PancakeClient,
  ) {}

  async syncAddressMappings() {
    const sapoCities = await this.sapoClient.fetchCities();
    const pancakeProvinces = await this.pancakeClient.fetchProvinces();
    const provinceMatches = this.matchAddressUnits(sapoCities, pancakeProvinces);

    await this.prisma.provinceMapping.deleteMany();
    await this.prisma.provinceMapping.createMany({
      data: provinceMatches.map((match) => ({
        sapoId: match.sapo.id,
        sapoName: match.sapo.name,
        pancakeId: match.pancake.id,
        pancakeName: match.pancake.name,
        similarity: match.similarity,
      })),
    });

    const districtRows = [];
    const wardRows = [];

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

    await this.prisma.districtMapping.deleteMany();
    await this.prisma.districtMapping.createMany({ data: districtRows });
    await this.prisma.wardMapping.deleteMany();
    await this.prisma.wardMapping.createMany({ data: wardRows });

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
    return sapoUnits
      .map((sapo) => {
        const ranked = pancakeUnits
          .map((pancake) => ({
            sapo,
            pancake,
            similarity: this.distance(sapo.name, pancake.name),
          }))
          .sort((left, right) => left.similarity - right.similarity);
        return ranked[0] ?? null;
      })
      .filter(
        (match): match is MatchedAddressUnit =>
          match !== null && match.similarity <= 0.5,
      );
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
      .replace(/\b(tp|tinh|thanh pho|huyen|quan|thi xa|xa|phuong|thi tran)\b/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
}
