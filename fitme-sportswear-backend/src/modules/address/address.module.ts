import { Module } from '@nestjs/common';
import { PancakeModule } from '../pancake/pancake.module';
import { SapoModule } from '../sapo/sapo.module';
import { AddressMappingService } from './address-mapping.service';
import { AddressSyncService } from './address-sync.service';

@Module({
  imports: [PancakeModule, SapoModule],
  providers: [AddressMappingService, AddressSyncService],
  exports: [AddressMappingService, AddressSyncService],
})
export class AddressModule {}
