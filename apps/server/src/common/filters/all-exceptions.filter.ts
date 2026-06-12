import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

/**
 * Global error contract (E7).
 *
 * Catches every unhandled exception and returns a consistent JSON shape:
 *   { statusCode, error, message, path, timestamp, traceId }
 * This is a backward-compatible superset of Nest's default body (statusCode +
 * message are preserved), so existing clients keep working.
 *
 * Logging: server-side only, and **never logs the request body** (avoids PII /
 * log-injection). 5xx → error (with stack), 4xx → warn. A `traceId` correlates the
 * client response with the server log line.
 *
 * NOTE: full structured logging with field redaction (pino) is a follow-up that
 * requires adding `nestjs-pino` (a new dependency) — intentionally not added here.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const traceId = randomUUID();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        error = exception.name;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) ?? exception.message;
        error = (b.error as string) ?? exception.name;
      }
    }

    const logLine = `${req.method} ${req.url} -> ${status} traceId=${traceId}`;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        logLine,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(logLine);
    }

    res.status(status).json({
      statusCode: status,
      error,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
      traceId,
    });
  }
}
