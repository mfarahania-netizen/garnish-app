import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, Matches, MinLength } from 'class-validator';
import { normalizeIranMobile } from '../../common/phone-normalization';

export class RegisterDto {
  @Transform(({ value }) => normalizeIranMobile(value))
  @IsString()
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.' })
  phone!: string; // 👈 ! اضافه شد

  @IsString()
  @IsNotEmpty({ message: 'رمز عبور الزامی است.' })
  @MinLength(8, { message: 'رمز عبور باید حداقل ۸ کاراکتر باشد.' })
  password!: string; // 👈 ! اضافه شد

  @IsOptional()
  @IsString()
  name?: string;
}
