import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_POLICY_VERSION,
} from '../../consent/consent.constants';

/** Critical, fail-closed onboarding contract. Optional taste signals are deliberately absent. */
export class CompleteOnboardingDto {
  @IsIn(['none', 'declared'])
  allergyDecision!: 'none' | 'declared';

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  allergies!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  diet?: string | null;

  @Equals(true)
  termsAccepted!: true;

  @IsBoolean()
  personalizationConsent!: boolean;

  @Equals(CURRENT_TERMS_POLICY_VERSION)
  termsPolicyVersion!: typeof CURRENT_TERMS_POLICY_VERSION;

  @Equals(CURRENT_PRIVACY_POLICY_VERSION)
  privacyPolicyVersion!: typeof CURRENT_PRIVACY_POLICY_VERSION;
}
