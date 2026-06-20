import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import { validateEnv } from './config/env.validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  // Load apps/server/.env into process.env (Node built-in `loadEnvFile`, no dependency).
  // The app reads process.env directly (auth/ai/redis); in production the platform
  // provides env, so only load the file when it exists.
  const envPath = join(process.cwd(), '.env');
  if (typeof process.loadEnvFile === 'function' && existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }

  // E1: fail fast if any required secret is missing/placeholder/weak.
  const env = validateEnv();

  const app = await NestFactory.create(AppModule);

  // E7: consistent error contract + server-side error logging (no PII in logs).
  app.useGlobalFilters(new AllExceptionsFilter());

  // سرو فایل‌های استاتیک از پوشهٔ uploads
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    // accept a comma-separated list so multiple dev frontends (e.g. 5173 + a preview on 5176) work without
    // reconfiguring; a single value still behaves exactly as before (split returns a 1-element array).
    origin: String(env.FRONTEND_URL).split(',').map((o) => o.trim()).filter(Boolean),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
  });

  await app.listen(env.PORT);
}
bootstrap();
