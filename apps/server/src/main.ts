import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import { validateEnv } from './config/env.validation';

async function bootstrap() {
  // E1: fail fast if any required secret is missing/placeholder/weak.
  const env = validateEnv();

  const app = await NestFactory.create(AppModule);

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
    origin: env.FRONTEND_URL,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
  });

  await app.listen(env.PORT);
}
bootstrap();
