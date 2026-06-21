import { IsOptional, IsString, Matches } from 'class-validator';

export class GuestDto {
  // High-entropy client-generated device key (e.g. a UUID) used to RESUME the same guest on the same device.
  // Optional: omit to mint an ephemeral guest. Bounded + charset-restricted so it can't be abused as free input.
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,128}$/, { message: 'deviceKey must be 16-128 url-safe chars' })
  deviceKey?: string;
}
