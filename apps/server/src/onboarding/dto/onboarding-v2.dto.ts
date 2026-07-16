import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  COOKS_FOR_COUNT_BANDS,
  DIETARY_RULES,
  DIET_PATTERNS,
  ONBOARDING_SCHEMA_VERSION,
  ONBOARDING_STEPS,
  SAFETY_STATUSES,
  TASTE_DISLIKE_LIMIT,
  TASTE_LIKE_LIMIT,
  WEEKDAY_TIME_BUCKETS,
  DietaryRule,
  DietPattern,
  OnboardingStep,
  SafetyStatus,
  WeekdayTimeBucket,
  CooksForCountBand,
} from '../onboarding-v2.contract';
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_POLICY_VERSION,
} from '../../consent/consent.constants';

class IdArrayDto {
  @IsArray()
  @ArrayMaxSize(14)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  allergyIds!: string[];

  @IsArray()
  @ArrayMaxSize(14)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  intoleranceIds!: string[];
}

export class OnboardingSafetyDto extends IdArrayDto {
  @IsIn(SAFETY_STATUSES)
  status!: SafetyStatus;

  @IsArray()
  @ArrayMaxSize(DIETARY_RULES.length)
  @ArrayUnique()
  @IsIn(DIETARY_RULES, { each: true })
  dietaryRules!: DietaryRule[];
}

export class OnboardingPreferencesDto {
  @IsOptional()
  @IsIn(DIET_PATTERNS)
  dietPattern?: DietPattern;

  @IsOptional()
  @IsIn(WEEKDAY_TIME_BUCKETS)
  weekdayTimeBucket?: WeekdayTimeBucket;

  @IsOptional()
  @IsIn(COOKS_FOR_COUNT_BANDS)
  cooksForCount?: CooksForCountBand;
}

/**
 * Ongoing editor for the non-taste, non-allergy answers collected during
 * onboarding. This is intentionally a complete snapshot of this small domain:
 * partial bodies could otherwise pair a stale screen value with a newer server
 * value. Optimistic concurrency protects that boundary.
 */
export class UpdateOnboardingProfilePreferencesDto {
  @Equals(ONBOARDING_SCHEMA_VERSION)
  schemaVersion!: 2;

  @IsUUID()
  idempotencyKey!: string;

  @IsDefined()
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  expectedRevision!: number;

  @IsDefined()
  @IsIn(DIET_PATTERNS)
  dietPattern!: DietPattern;

  @IsDefined()
  @IsIn(WEEKDAY_TIME_BUCKETS)
  weekdayTimeBucket!: WeekdayTimeBucket;

  @IsDefined()
  @IsIn(COOKS_FOR_COUNT_BANDS)
  cooksForCount!: CooksForCountBand;

  @IsDefined()
  @IsArray()
  @ArrayMaxSize(DIETARY_RULES.length)
  @ArrayUnique()
  @IsIn(DIETARY_RULES, { each: true })
  dietaryRules!: DietaryRule[];
}

export class OnboardingTasteDto {
  @IsArray()
  @ArrayMaxSize(TASTE_LIKE_LIMIT)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  likedRecipeIds!: string[];

  @IsArray()
  @ArrayMaxSize(TASTE_DISLIKE_LIMIT)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  dislikedRecipeIds!: string[];
}

export class OnboardingDraftTermsConsentDto {
  @Equals(true)
  accepted!: true;

  @Equals(CURRENT_TERMS_POLICY_VERSION)
  policyVersion!: typeof CURRENT_TERMS_POLICY_VERSION;
}

export class SaveOnboardingDraftDto {
  @Equals(ONBOARDING_SCHEMA_VERSION)
  schemaVersion!: 2;

  @IsUUID()
  idempotencyKey!: string;

  @IsIn(ONBOARDING_STEPS)
  step!: OnboardingStep;

  @IsDefined()
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  expectedRevision!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingSafetyDto)
  safety?: OnboardingSafetyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingPreferencesDto)
  preferences?: OnboardingPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingTasteDto)
  taste?: OnboardingTasteDto;

  // Safety declarations can include health-related data. Require the current,
  // explicit Terms decision on every safety write; later preference writes may
  // proceed only against the current grant already recorded by the server.
  @ValidateIf((dto: SaveOnboardingDraftDto) => dto.step === 'safety' || dto.terms !== undefined)
  @IsDefined()
  @ValidateNested()
  @Type(() => OnboardingDraftTermsConsentDto)
  terms?: OnboardingDraftTermsConsentDto;
}

export class OnboardingConsentDto {
  @IsBoolean()
  personalization!: boolean;

  @Equals(true)
  termsAccepted!: true;

  @Equals(CURRENT_TERMS_POLICY_VERSION)
  termsPolicyVersion!: typeof CURRENT_TERMS_POLICY_VERSION;

  @Equals(CURRENT_PRIVACY_POLICY_VERSION)
  privacyPolicyVersion!: typeof CURRENT_PRIVACY_POLICY_VERSION;
}

export class CompleteOnboardingV2Dto {
  @Equals(ONBOARDING_SCHEMA_VERSION)
  schemaVersion!: 2;

  @IsUUID()
  idempotencyKey!: string;

  @IsDefined()
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  expectedRevision!: number;

  @IsDefined()
  @ValidateNested()
  @Type(() => OnboardingConsentDto)
  consent!: OnboardingConsentDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => OnboardingTasteDto)
  taste!: OnboardingTasteDto;
}
