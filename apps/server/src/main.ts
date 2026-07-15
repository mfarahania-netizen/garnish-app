import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import { validateEnv } from './config/env.validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { resolveCorsOrigins } from './config/cors-origins';

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

  // Safe default: trust no forwarding headers. Deployments behind a known,
  // network-enforced proxy chain may set the exact hop count so req.ip (and
  // ThrottlerGuard) identifies the real client without blindly trusting XFF.
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', env.TRUST_PROXY_HOPS);

  // E7: consistent error contract + server-side error logging (no PII in logs).
  app.useGlobalFilters(new AllExceptionsFilter());

  // سرو فایل‌های استاتیک از پوشهٔ uploads — SECURITY (advisor audit): nosniff stops a browser from
  // reinterpreting a stored file as HTML/JS, and a locked-down CSP neutralizes any script even if one slips
  // through; together with the server-derived extension + magic-byte check in upload.controller this closes
  // the stored-XSS / content-sniffing vector on user-uploaded files.
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads'), {
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    },
  }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    // Accept a comma-separated list and include the same-port localhost/127.0.0.1 loopback peer for dev.
    // This stays narrow (no wildcard) but prevents Vite's 127.0.0.1 URL from breaking browser auth via CORS.
    origin: resolveCorsOrigins(env.FRONTEND_URL),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
  });

  await app.listen(env.PORT);
}
bootstrap();
