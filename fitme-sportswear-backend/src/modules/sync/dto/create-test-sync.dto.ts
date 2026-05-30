import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTestSyncDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}
