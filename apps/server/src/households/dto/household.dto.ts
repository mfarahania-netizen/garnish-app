import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateHouseholdDto {
  @Transform(trimmed)
  @IsString()
  @MaxLength(80)
  @Matches(/\S/u)
  name!: string;
}

export class CreateHouseholdInviteDto {
  @Transform(trimmed)
  @IsString()
  @MaxLength(32)
  phone!: string;
}

export class CreateHouseholdShoppingItemDto {
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  @Matches(/\S/u)
  name!: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(40)
  amount?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(30)
  unit?: string;
}

export class UpdateHouseholdShoppingItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  version!: number;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  @Matches(/\S/u)
  name?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(40)
  amount?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(30)
  unit?: string;

  @IsOptional()
  @IsIn(['NEEDED', 'BOUGHT'])
  status?: 'NEEDED' | 'BOUGHT';
}

export class MarkHouseholdItemUnavailableDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @Transform(trimmed)
  @IsString()
  @MaxLength(80)
  @Matches(/\S/u)
  alternative!: string;
}

export class ResolveHouseholdDecisionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @Transform(trimmed)
  @IsString()
  @MaxLength(80)
  selectedOption!: string;
}

export class VersionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  version!: number;
}

export class VersionQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  version!: number;
}

export class TransferHouseholdOwnerDto extends VersionDto {
  @IsUUID()
  membershipId!: string;
}
