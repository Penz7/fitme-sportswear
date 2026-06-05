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

  it('does not use Pancake fallback ids as Sapo address ids when a mapping row is missing', async () => {
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
      provinceId: null,
      districtId: null,
      wardId: null,
      wardName: 'Xa fallback',
      cityName: null,
      districtName: null,
    });
  });

  it('keeps duplicate Pancake mappings on the same Sapo district and city', async () => {
    const prisma = {
      provinceMapping: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 12,
            sapoId: 12,
            sapoName: 'Binh Phuoc',
            pancakeId: 707,
            pancakeName: 'Binh Phuoc',
          },
        ]),
      },
      districtMapping: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 143,
            sapoId: 138,
            sapoName: 'Huyen Chon Thanh',
            sapoCityId: 12,
            sapoCity: 'Binh Phuoc',
            pancakeId: 70708,
            pancakeName: 'Thi xa Chon Thanh',
          },
          {
            id: 148,
            sapoId: 10934,
            sapoName: 'Thi xa Chon Thanh',
            sapoCityId: 12,
            sapoCity: 'Binh Phuoc',
            pancakeId: 70708,
            pancakeName: 'Thi xa Chon Thanh',
          },
        ]),
      },
      wardMapping: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 2189,
            sapoId: 8769,
            sapoName: 'Xa Thanh Tam',
            sapoDistrictId: 138,
            sapoDistrict: 'Huyen Chon Thanh',
            sapoCityId: 12,
            sapoCity: 'Binh Phuoc',
            pancakeId: 7070802,
            pancakeName: 'Xa Thanh Tam',
          },
          {
            id: 2251,
            sapoId: 107618,
            sapoName: 'Phuong Thanh Tam',
            sapoDistrictId: 10934,
            sapoDistrict: 'Thi xa Chon Thanh',
            sapoCityId: 12,
            sapoCity: 'Binh Phuoc',
            pancakeId: 7070802,
            pancakeName: 'Xa Thanh Tam',
          },
        ]),
      },
    };
    const service = new AddressMappingService(prisma as any);

    await expect(
      service.resolvePancakeAddress({
        provinceId: 707,
        districtId: 70708,
        wardId: 7070802,
        fallbackProvinceName: 'Binh Phuoc',
        fallbackDistrictName: 'Thi xa Chon Thanh',
        fallbackWardName: 'Xa Thanh Tam',
        fallbackFullAddress:
          'Khu cong nghiep Chon Thanh II, Xa Thanh Tam, Thi xa Chon Thanh, Binh Phuoc',
      }),
    ).resolves.toEqual({
      provinceId: 12,
      districtId: 10934,
      wardId: 107618,
      wardName: 'Phuong Thanh Tam',
      cityName: 'Binh Phuoc',
      districtName: 'Thi xa Chon Thanh',
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
