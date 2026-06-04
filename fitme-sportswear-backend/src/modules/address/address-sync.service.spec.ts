import { AddressSyncService } from './address-sync.service';

describe('AddressSyncService', () => {
  function createService() {
    const prisma = {
      provinceMapping: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      districtMapping: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      wardMapping: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const sapoClient = {
      fetchCities: jest.fn().mockResolvedValue([{ id: 79, name: 'Ho Chi Minh' }]),
      fetchDistrictsByCityId: jest.fn().mockResolvedValue([{ id: 784, name: 'Hoc Mon' }]),
      fetchWardsByDistrictId: jest.fn().mockResolvedValue([{ id: 27523, name: 'Xuan Thoi Thuong' }]),
    };
    const pancakeClient = {
      fetchProvinces: jest.fn().mockResolvedValue([{ id: 1, name: 'Ho Chi Minh' }]),
      fetchDistrictsByProvinceId: jest.fn().mockResolvedValue([{ id: 688, name: 'Huyen Hoc Mon' }]),
      fetchCommunesByDistrictId: jest.fn().mockResolvedValue([{ id: 12345, name: 'Xa Xuan Thoi Thuong' }]),
    };

    return {
      prisma,
      sapoClient,
      pancakeClient,
      service: new AddressSyncService(
        prisma as any,
        sapoClient as any,
        pancakeClient as any,
      ),
    };
  }

  it('syncs province, district, and ward mapping tables from Sapo and Pancake addresses', async () => {
    const { service, prisma, sapoClient, pancakeClient } = createService();

    await expect(service.syncAddressMappings()).resolves.toEqual({
      provinces: 1,
      districts: 1,
      wards: 1,
    });

    expect(sapoClient.fetchCities).toHaveBeenCalled();
    expect(pancakeClient.fetchProvinces).toHaveBeenCalled();
    expect(sapoClient.fetchDistrictsByCityId).toHaveBeenCalledWith(79);
    expect(pancakeClient.fetchDistrictsByProvinceId).toHaveBeenCalledWith(1);
    expect(sapoClient.fetchWardsByDistrictId).toHaveBeenCalledWith(784);
    expect(pancakeClient.fetchCommunesByDistrictId).toHaveBeenCalledWith(688);
    expect(prisma.provinceMapping.deleteMany).toHaveBeenCalled();
    expect(prisma.districtMapping.deleteMany).toHaveBeenCalled();
    expect(prisma.wardMapping.deleteMany).toHaveBeenCalled();
    expect(prisma.provinceMapping.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          sapoId: 79,
          sapoName: 'Ho Chi Minh',
          pancakeId: 1,
          pancakeName: 'Ho Chi Minh',
          similarity: 0,
        }),
      ],
    });
    expect(prisma.districtMapping.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          sapoId: 784,
          sapoName: 'Hoc Mon',
          sapoCityId: 79,
          sapoCity: 'Ho Chi Minh',
          pancakeId: 688,
          pancakeName: 'Huyen Hoc Mon',
        }),
      ],
    });
    expect(prisma.wardMapping.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          sapoId: 27523,
          sapoName: 'Xuan Thoi Thuong',
          sapoDistrictId: 784,
          sapoDistrict: 'Hoc Mon',
          sapoCityId: 79,
          sapoCity: 'Ho Chi Minh',
          pancakeId: 12345,
          pancakeName: 'Xa Xuan Thoi Thuong',
        }),
      ],
    });
  });

  it('does not create low-confidence address mappings', async () => {
    const { service, prisma, sapoClient } = createService();
    sapoClient.fetchCities.mockResolvedValue([
      { id: 1000, name: 'กรุงเทพมหานคร' },
    ]);

    await expect(service.syncAddressMappings()).resolves.toEqual({
      provinces: 0,
      districts: 0,
      wards: 0,
    });

    expect(prisma.provinceMapping.createMany).toHaveBeenCalledWith({ data: [] });
  });
});
