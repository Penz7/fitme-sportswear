import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateSapoToPancakeOrderSyncDto {
  @IsString()
  @IsNotEmpty()
  sapoOrderId!: string;
}

export class CreateSapoToPancakeOrderBulkSyncDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  status?: string;

  @IsOptional()
  @IsDateString()
  createdOnMin?: string;

  @IsOptional()
  @IsDateString()
  createdOnMax?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(250)
  limit?: number;
}
