import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common'; // ← ایمپورت جدید

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // فعال‌سازی اعتبارسنجی خودکار برای تمام endpointها
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // فقط فیلدهای تعریف‌شده در DTO را قبول کن
      forbidNonWhitelisted: true, // اگر فیلد اضافی فرستاده شد، خطا بده
      transform: true,            // تبدیل خودکار انواع داده‌ها
    }),
  );

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  app.enableCors({
    origin: frontendUrl,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
  });

  await app.listen(3000);
}
bootstrap();