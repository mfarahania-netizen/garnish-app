import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function normalizeOtpPhone(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/[۰-۹٠-٩]/g, (digit) => {
      const fa = FA_DIGITS.indexOf(digit);
      if (fa >= 0) return String(fa);
      const ar = AR_DIGITS.indexOf(digit);
      return ar >= 0 ? String(ar) : digit;
    })
    .replace(/[\s\-()]/g, '');
}

export class RequestOtpDto {
  @Transform(({ value }) => normalizeOtpPhone(value))
  @IsString()
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.' })
  phone!: string;
}

export class VerifyOtpDto {
  @Transform(({ value }) => normalizeOtpPhone(value))
  @IsString()
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.' })
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'کد ورود باید ۶ رقم باشد.' })
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'نام بیش از حد طولانی است.' })
  name?: string;
}
