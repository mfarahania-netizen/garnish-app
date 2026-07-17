import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const SOURCE_PATTERN = /^[A-Za-z0-9_-]+$/;

export class TrackImpressionDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @Matches(ID_PATTERN, { each: true })
  recipeIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(ID_PATTERN)
  recipeId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600_000)
  viewportMs?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  visibleRatio?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(SOURCE_PATTERN)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(ID_PATTERN)
  requestId?: string;
}
