import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { normalizeIranMobile } from '../../common/phone-normalization';

export class LoginDto {
  @Transform(({ value }) => normalizeIranMobile(value))
  @IsString()
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.' })
  phone!: string; // 👈 ! اضافه شد

  @IsString()
  @IsNotEmpty({ message: 'رمز عبور الزامی است.' })
  password!: string; // 👈 ! اضافه شد
}
