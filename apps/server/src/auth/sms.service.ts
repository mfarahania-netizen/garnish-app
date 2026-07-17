import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

const MELIPAYAMAK_ERROR_CODES = new Set([
  '0',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '9',
  '10',
  '11',
  '12',
  '14',
  '15',
  '16',
  '17',
  '35',
]);

function maskPhone(phone: string) {
  return phone.length >= 6
    ? `${phone.slice(0, 4)}***${phone.slice(-2)}`
    : '***';
}

function devOtpLogEnabled() {
  const nodeEnv = String(process.env.NODE_ENV || '')
    .trim()
    .toLowerCase();
  return (
    String(process.env.SMS_DEV_LOG_OTP || '')
      .trim()
      .toLowerCase() === 'true' &&
    (nodeEnv === 'development' || nodeEnv === 'test')
  );
}

function providerTimeoutMs() {
  const configured = Number(process.env.SMS_PROVIDER_TIMEOUT_MS || 5000);
  if (!Number.isInteger(configured)) return 5000;
  return Math.min(15_000, Math.max(1000, configured));
}

async function providerFetch(input: string | URL, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), providerTimeoutMs());
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch {
    // Never expose provider URLs, credentials, phone numbers or raw upstream
    // errors through the public auth response.
    throw new ServiceUnavailableException('sms_send_failed');
  } finally {
    clearTimeout(timeout);
  }
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async sendOtpCode(phone: string, code: string): Promise<void> {
    const provider = String(process.env.SMS_PROVIDER || 'disabled')
      .trim()
      .toLowerCase();

    if (provider !== 'melipayamak') {
      if (devOtpLogEnabled()) {
        console.info(`[dev-sms] otp ${maskPhone(phone)} code=${code}`);
        return;
      }
      throw new ServiceUnavailableException('sms_provider_not_configured');
    }

    if (
      String(process.env.MELIPAYAMAK_ENABLED || '').toLowerCase() !== 'true'
    ) {
      if (devOtpLogEnabled()) {
        // eslint-disable-next-line no-console
        console.info(
          `[dev-sms] melipayamak disabled ${maskPhone(phone)} code=${code}`,
        );
        return;
      }
      throw new ServiceUnavailableException('sms_provider_disabled');
    }

    await this.sendMelipayamakPattern(phone, code);
  }

  async sendPasswordResetCode(phone: string, code: string): Promise<void> {
    const provider = String(process.env.SMS_PROVIDER || 'disabled')
      .trim()
      .toLowerCase();

    if (provider === 'melipayamak') {
      if (
        String(process.env.MELIPAYAMAK_ENABLED || '').toLowerCase() !== 'true'
      ) {
        if (devOtpLogEnabled()) {
          // eslint-disable-next-line no-console
          console.info(
            `[dev-sms] melipayamak disabled password reset ${maskPhone(phone)} code=${code}`,
          );
          return;
        }
        throw new ServiceUnavailableException('sms_provider_disabled');
      }

      await this.sendMelipayamakPattern(phone, code);
      return;
    }

    if (provider === 'kavenegar') {
      await this.sendKavenegarLookup(phone, code);
      return;
    }

    if (provider === 'disabled') {
      if (devOtpLogEnabled()) {
        // eslint-disable-next-line no-console
        console.info(
          `[dev-sms] password reset ${maskPhone(phone)} code=${code}`,
        );
        return;
      }
    }

    throw new ServiceUnavailableException('sms_provider_not_configured');
  }

  private async sendKavenegarLookup(
    phone: string,
    code: string,
  ): Promise<void> {
    const apiKey = process.env.KAVENEGAR_API_KEY;
    const template = process.env.KAVENEGAR_RESET_TEMPLATE;
    if (!apiKey || !template)
      throw new ServiceUnavailableException('sms_provider_not_configured');

    const url = new URL(
      `https://api.kavenegar.com/v1/${encodeURIComponent(apiKey)}/verify/lookup.json`,
    );
    url.searchParams.set('receptor', phone);
    url.searchParams.set('token', code);
    url.searchParams.set('template', template);

    const res = await providerFetch(url, { method: 'GET' });
    if (!res.ok) throw new ServiceUnavailableException('sms_send_failed');
  }

  private async sendMelipayamakPattern(
    phone: string,
    code: string,
  ): Promise<void> {
    const apiKey = process.env.MELIPAYAMAK_API_KEY;
    const bodyId = process.env.MELIPAYAMAK_PATTERN_BODY_ID;
    const username = process.env.MELIPAYAMAK_USERNAME || '';
    if (!apiKey || !bodyId || !username)
      throw new ServiceUnavailableException('sms_provider_not_configured');

    const params = new URLSearchParams();
    params.set('username', username);
    params.set('password', apiKey);
    params.set('text', code);
    params.set('to', phone);
    params.set('bodyId', bodyId);

    const res = await providerFetch(
      'https://api.payamak-panel.com/post/Send.asmx/SendByBaseNumber2',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      },
    );
    if (!res.ok) throw new ServiceUnavailableException('sms_send_failed');
    let body: string;
    try {
      body = await res.text();
    } catch {
      throw new ServiceUnavailableException('sms_send_failed');
    }

    const match = body.match(
      /^\uFEFF?\s*(?:<\?xml[^>]*\?>\s*)?<string\b[^>]*>\s*([+-]?\d+)\s*<\/string>\s*$/i,
    );
    const receipt = match?.[1] ?? '';
    if (
      !/^[1-9]\d*$/.test(receipt)
      || MELIPAYAMAK_ERROR_CODES.has(receipt)
    ) {
      throw new ServiceUnavailableException('sms_send_failed');
    }

    this.logger.log('melipayamak accepted');
  }
}
