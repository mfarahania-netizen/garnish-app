import { IsBoolean, IsIn, IsString } from 'class-validator';
import {
  OPTIONAL_CONSENT_PURPOSES,
  OptionalConsentPurpose,
} from '../../consent/consent.constants';

/** Generic Settings consent command. Core and Terms are intentionally not accepted here. */
export class UpdateConsentDto {
  @IsString()
  @IsIn([...OPTIONAL_CONSENT_PURPOSES])
  type: OptionalConsentPurpose;

  @IsBoolean()
  granted: boolean;
}
