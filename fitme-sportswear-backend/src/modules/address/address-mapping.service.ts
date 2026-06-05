import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface ResolvePancakeAddressInput {
  provinceId: number | null;
  districtId: number | null;
  wardId: number | null;
  fallbackProvinceId?: number | null;
  fallbackDistrictId?: number | null;
  fallbackWardId?: number | null;
  fallbackProvinceName?: string | null;
  fallbackDistrictName?: string | null;
  fallbackWardName?: string | null;
  fallbackFullAddress?: string | null;
}

export interface ResolvedSapoAddress {
  provinceId: number | null;
  districtId: number | null;
  wardId: number | null;
  wardName: string | null;
  cityName: string | null;
  districtName: string | null;
}

export interface ResolveSapoAddressTextInput {
  provinceName?: string | null;
  districtName?: string | null;
  wardName?: string | null;
  fullAddress?: string | null;
}

export interface ResolvedPancakeAddress {
  provinceId: number | null;
  districtId: number | null;
  wardId: number | null;
  provinceName: string | null;
  districtName: string | null;
  wardName: string | null;
}

@Injectable()
export class AddressMappingService {
  constructor(private readonly prisma: PrismaService) {}

  async resolvePancakeAddress(
    input: ResolvePancakeAddressInput,
  ): Promise<ResolvedSapoAddress> {
    const provinceMappings = await this.findMappings(
      'provinceMapping',
      input.provinceId,
    );
    const districtMappings = await this.findMappings(
      'districtMapping',
      input.districtId,
    );
    const wardMappings = await this.findMappings('wardMapping', input.wardId);
    const provinceMapping = this.selectByText(
      provinceMappings,
      input.fallbackProvinceName,
      input.fallbackFullAddress,
    );
    const districtMapping = this.selectDistrictMapping(
      districtMappings,
      provinceMapping,
      input.fallbackDistrictName,
      input.fallbackFullAddress,
    );
    const wardMapping = this.selectWardMapping(
      wardMappings,
      provinceMapping,
      districtMapping,
      input.fallbackWardName,
      input.fallbackFullAddress,
    );

    return {
      provinceId:
        this.numberOrNull(wardMapping?.sapoCityId) ??
        this.numberOrNull(provinceMapping?.sapoId) ??
        null,
      districtId:
        this.numberOrNull(wardMapping?.sapoDistrictId) ??
        this.numberOrNull(districtMapping?.sapoId) ??
        null,
      wardId:
        this.numberOrNull(wardMapping?.sapoId) ??
        null,
      wardName: wardMapping?.sapoName ?? input.fallbackWardName ?? null,
      cityName: provinceMapping?.sapoName ?? null,
      districtName: districtMapping?.sapoName ?? null,
    };
  }

  async resolveSapoAddressText(
    input: ResolveSapoAddressTextInput,
  ): Promise<ResolvedSapoAddress> {
    const { provinceMapping, districtMapping, wardMapping } =
      await this.findSapoTextMappings(input);

    return {
      provinceId:
        this.numberOrNull(wardMapping?.sapoCityId) ??
        this.numberOrNull(provinceMapping?.sapoId) ??
        null,
      districtId:
        this.numberOrNull(wardMapping?.sapoDistrictId) ??
        this.numberOrNull(districtMapping?.sapoId) ??
        null,
      wardId: this.numberOrNull(wardMapping?.sapoId) ?? null,
      wardName: wardMapping?.sapoName ?? null,
      cityName: provinceMapping?.sapoName ?? null,
      districtName: districtMapping?.sapoName ?? null,
    };
  }

  async resolvePancakeAddressFromSapoText(
    input: ResolveSapoAddressTextInput,
  ): Promise<ResolvedPancakeAddress> {
    const { provinceMapping, districtMapping, wardMapping } =
      await this.findSapoTextMappings(input);

    return {
      provinceId: this.numberOrNull(provinceMapping?.pancakeId),
      districtId: this.numberOrNull(districtMapping?.pancakeId),
      wardId: this.numberOrNull(wardMapping?.pancakeId),
      provinceName: provinceMapping?.pancakeName ?? null,
      districtName: districtMapping?.pancakeName ?? null,
      wardName: wardMapping?.pancakeName ?? null,
    };
  }

  private async findSapoTextMappings(input: ResolveSapoAddressTextInput) {
    const provinceMapping = await this.findTextMapping(
      'provinceMapping',
      input.provinceName,
      input.fullAddress,
    );
    const districtMapping = await this.findTextMapping(
      'districtMapping',
      input.districtName,
      input.fullAddress,
    );
    const wardMapping = await this.findTextMapping(
      'wardMapping',
      input.wardName,
      input.fullAddress,
    );

    return { provinceMapping, districtMapping, wardMapping };
  }

  private async findMapping(modelName: string, pancakeId: number | null) {
    const mappings = await this.findMappings(modelName, pancakeId);
    return mappings[0] ?? null;
  }

  private async findMappings(modelName: string, pancakeId: number | null) {
    if (pancakeId === null || pancakeId === undefined) {
      return [];
    }

    const model = (this.prisma as any)[modelName];
    const query = {
      where: { pancakeId },
      orderBy: [{ similarity: 'asc' }, { id: 'asc' }],
    };

    if (model?.findMany) {
      return model.findMany(query);
    }

    if (model?.findFirst) {
      const result = await model.findFirst({
        where: query.where,
        orderBy: { similarity: 'asc' },
      });
      return result ? [result] : [];
    }

    return [];
  }

  private selectDistrictMapping(
    mappings: any[],
    provinceMapping: any | null,
    preferredName: string | null | undefined,
    fullAddress: string | null | undefined,
  ) {
    const provinceId = this.numberOrNull(provinceMapping?.sapoId);
    const candidates =
      provinceId === null
        ? mappings
        : mappings.filter(
            (mapping) => this.numberOrNull(mapping?.sapoCityId) === provinceId,
          );

    return this.selectByText(
      candidates.length > 0 ? candidates : mappings,
      preferredName,
      fullAddress,
    );
  }

  private selectWardMapping(
    mappings: any[],
    provinceMapping: any | null,
    districtMapping: any | null,
    preferredName: string | null | undefined,
    fullAddress: string | null | undefined,
  ) {
    const provinceId = this.numberOrNull(provinceMapping?.sapoId);
    const districtId = this.numberOrNull(districtMapping?.sapoId);
    const candidates = mappings.filter((mapping) => {
      const cityMatches =
        provinceId === null || this.numberOrNull(mapping?.sapoCityId) === provinceId;
      const districtMatches =
        districtId === null ||
        this.numberOrNull(mapping?.sapoDistrictId) === districtId;

      return cityMatches && districtMatches;
    });

    return this.selectByText(
      candidates.length > 0 ? candidates : mappings,
      preferredName,
      fullAddress,
    );
  }

  private selectByText(
    mappings: any[],
    preferredName: string | null | undefined,
    fullAddress: string | null | undefined,
  ) {
    if (mappings.length === 0) {
      return null;
    }

    const scored = mappings.map((mapping, index) => ({
      mapping,
      index,
      score: this.textScore(mapping, preferredName, fullAddress),
    }));

    scored.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.index - right.index;
    });

    return scored[0].mapping;
  }

  private textScore(
    mapping: any,
    preferredName: string | null | undefined,
    fullAddress: string | null | undefined,
  ): number {
    const rawSapoName = this.normalizedText(mapping?.sapoName);
    const rawPancakeName = this.normalizedText(mapping?.pancakeName);
    const rawPreferred = this.normalizedText(preferredName);
    const sapoName = this.normalizedLocationText(mapping?.sapoName);
    const pancakeName = this.normalizedLocationText(mapping?.pancakeName);
    const preferred = this.normalizedLocationText(preferredName);
    const address = this.normalizedLocationText(fullAddress);
    let score = 0;

    if (rawPreferred) {
      if (rawSapoName === rawPreferred) {
        score += 80;
      }
      if (rawPancakeName === rawPreferred) {
        score += 20;
      }
    }

    if (preferred) {
      if (sapoName === preferred || pancakeName === preferred) {
        score += 40;
      } else if (sapoName.includes(preferred) || preferred.includes(sapoName)) {
        score += 20;
      } else if (pancakeName.includes(preferred) || preferred.includes(pancakeName)) {
        score += 20;
      }
    }

    if (address) {
      if (sapoName && address.includes(sapoName)) {
        score += 10;
      }
      if (pancakeName && address.includes(pancakeName)) {
        score += 10;
      }
    }

    return score;
  }

  private normalizedText(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private normalizedLocationText(value: unknown): string {
    return this.normalizedText(value)
      .replace(/\b(tp|thanh pho|tinh|quan|huyen|thi xa|phuong|xa|thi tran)\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private async findTextMapping(
    modelName: string,
    preferredText: string | null | undefined,
    fallbackText: string | null | undefined,
  ) {
    const text = this.firstText(preferredText, fallbackText);

    if (!text) {
      return null;
    }

    const model = (this.prisma as any)[modelName];
    if (!model?.findFirst) {
      return null;
    }

    return model.findFirst({
      where: {
        OR: [
          { sapoName: { contains: text, mode: 'insensitive' } },
          { pancakeName: { contains: text, mode: 'insensitive' } },
        ],
      },
      orderBy: { similarity: 'asc' },
    });
  }

  private numberOrNull(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private firstText(...values: Array<string | null | undefined>): string | null {
    for (const value of values) {
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return String(value).trim();
      }
    }

    return null;
  }
}
