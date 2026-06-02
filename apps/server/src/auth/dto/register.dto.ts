import { IsString, IsNotEmpty, IsOptional, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.' })
  phone!: string; // 👈 ! اضافه شد

  @IsString()
  @IsNotEmpty({ message: 'رمز عبور الزامی است.' })
  @MinLength(6, { message: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' })
  password!: string; // 👈 ! اضافه شد

  @IsOptional()
  @IsString()
  name?: string;
}