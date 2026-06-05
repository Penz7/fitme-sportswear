import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface ResolvePancakeAddressInput {
  provinceId: number | null;
  districtId: number | null;
  wardId: number | null;
  fallbackProvinceId?: number | null;
  fallbackDistrictId?: number | null;
  fallbackWardId?: number | null;
  fallbackWardName?: string | null;
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
    const provinceMapping = await this.findMapping(
      'provinceMapping',
      input.provinceId,
    );
    const districtMapping = await this.findMapping(
      'districtMapping',
      input.districtId,
    );
    const wardMapping = await this.findMapping('wardMapping', input.wardId);

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
    if (pancakeId === null || pancakeId === undefined) {
      return null;
    }

    const model = (this.prisma as any)[modelName];
    if (!model?.findFirst) {
      return null;
    }

    return model.findFirst({
      where: { pancakeId },
      orderBy: { similarity: 'asc' },
    });
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
