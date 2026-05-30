import { AddressMappingService } from './address-mapping.service';

describe('AddressMappingService', () => {
  function createService() {
    const prisma = {
      provinceMapping: {
        findFirst: jest.fn().mockResolvedValue({
          sapoId: 2,
          sapoName: 'Ho Chi Minh',
          pancakeId: 1,
        }),
      },
      districtMapping: {
        findFirst: jest.fn().mockResolvedValue({
          sapoId: 55,
          sapoName: 'Hoc Mon',
          pancakeId: 688,
        }),
      },
      wardMapping: {
        findFirst: jest.fn().mockResolvedValue({
          sapoId: 947,
          sapoName: 'Xuan Thoi Thuong',
          sapoDistrictId: 55,
          sapoCityId: 2,
          pancakeId: 12345,
        }),
      },
    };

    return {
      prisma,
      service: new AddressMappingService(prisma as any),
    };
  }

  it('maps Pancake province, district, and ward ids to Sapo address identifiers', async () => {
    const { service, prisma } = createService();

    await expect(
      service.resolvePancakeAddress({
        provinceId: 1,
        districtId: 688,
        wardId: 12345,
      }),
    ).resolves.toEqual({
      provinceId: 2,
      districtId: 55,
      wardId: 947,
      wardName: 'Xuan Thoi Thuong',
      cityName: 'Ho Chi Minh',
      districtName: 'Hoc Mon',
    });

    expect(prisma.provinceMapping.findFirst).toHaveBeenCalledWith({
      where: { pancakeId: 1 },
      orderBy: { similarity: 'asc' },
    });
    expect(prisma.districtMapping.findFirst).toHaveBeenCalledWith({
      where: { pancakeId: 688 },
      orderBy: { similarity: 'asc' },
    });
    expect(prisma.wardMapping.findFirst).toHaveBeenCalledWith({
      where: { pancakeId: 12345 },
      orderBy: { similarity: 'asc' },
    });
  });

  it('falls back to provided Sapo ids when a mapping row is missing', async () => {
    const { service, prisma } = createService();
    prisma.provinceMapping.findFirst.mockResolvedValue(null);
    prisma.districtMapping.findFirst.mockResolvedValue(null);
    prisma.wardMapping.findFirst.mockResolvedValue(null);

    await expect(
      service.resolvePancakeAddress({
        provinceId: 1,
        districtId: 688,
        wardId: 12345,
        fallbackProvinceId: 1,
        fallbackDistrictId: 688,
        fallbackWardId: 12345,
        fallbackWardName: 'Xa fallback',
      }),
    ).resolves.toEqual({
      provinceId: 1,
      districtId: 688,
      wardId: 12345,
      wardName: 'Xa fallback',
      cityName: null,
      districtName: null,
    });
  });

  it('resolves text-only addresses from mapping tables for Shopify fallback', async () => {
    const { service, prisma } = createService();
    prisma.provinceMapping.findFirst.mockResolvedValueOnce({
      sapoId: 2,
      sapoName: 'Ho Chi Minh',
    });
    prisma.districtMapping.findFirst.mockResolvedValueOnce({
      sapoId: 55,
      sapoName: 'Hoc Mon',
    });
    prisma.wardMapping.findFirst.mockResolvedValueOnce({
      sapoId: 947,
      sapoName: 'Xuan Thoi Thuong',
      sapoDistrictId: 55,
      sapoCityId: 2,
    });

    await expect(
      service.resolveSapoAddressText({
        provinceName: 'Ho Chi Minh',
        districtName: 'Hoc Mon',
        wardName: 'Xuan Thoi Thuong',
        fullAddress: 'Xuan Thoi Thuong Hoc Mon Ho Chi Minh',
      }),
    ).resolves.toEqual({
      provinceId: 2,
      districtId: 55,
      wardId: 947,
      wardName: 'Xuan Thoi Thuong',
      cityName: 'Ho Chi Minh',
      districtName: 'Hoc Mon',
    });

    expect(prisma.provinceMapping.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { sapoName: { contains: 'Ho Chi Minh', mode: 'insensitive' } },
          { pancakeName: { contains: 'Ho Chi Minh', mode: 'insensitive' } },
        ],
      },
      orderBy: { similarity: 'asc' },
    });
  });
});
