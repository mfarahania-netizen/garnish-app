import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { normalizeIranMobile } from '../../common/phone-normalization';

export class RequestPasswordResetDto {
  @Transform(({ value }) => normalizeIranMobile(value))
  @IsString()
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.' })
  phone!: string;
}

export class ConfirmPasswordResetDto {
  @Transform(({ value }) => normalizeIranMobile(value))
  @IsString()
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.' })
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'کد تایید باید ۶ رقم باشد.' })
  code!: string;

  @IsString()
  @MinLength(8, { message: 'رمز عبور باید حداقل ۸ کاراکتر باشد.' })
  @MaxLength(128, { message: 'رمز عبور بیش از حد طولانی است.' })
  newPassword!: string;
}
