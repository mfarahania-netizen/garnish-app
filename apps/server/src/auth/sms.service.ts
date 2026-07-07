import { Injectable, ServiceUnavailableException } from '@nestjs/common';

function maskPhone(phone: string) {
  return phone.length >= 6 ? `${phone.slice(0, 4)}***${phone.slice(-2)}` : '***';
}

function devOtpLogEnabled() {
  return String(process.env.SMS_DEV_LOG_OTP || '').toLowerCase() === 'true' && process.env.NODE_ENV !== 'production';
}

@Injectable()
export class SmsService {
  async sendOtpCode(phone: string, code: string): Promise<void> {
    const provider = String(process.env.SMS_PROVIDER || 'disabled').trim().toLowerCase();

    if (provider !== 'melipayamak') {
      if (devOtpLogEnabled()) {
        // eslint-disable-next-line no-console
        console.info(`[dev-sms] otp ${maskPhone(phone)} code=${code}`);
        return;
      }
      throw new ServiceUnavailableException('sms_provider_not_configured');
    }

    if (String(process.env.MELIPAYAMAK_ENABLED || '').toLowerCase() !== 'true') {
      if (devOtpLogEnabled()) {
        // eslint-disable-next-line no-console
        console.info(`[dev-sms] melipayamak disabled ${maskPhone(phone)} code=${code}`);
        return;
      }
      throw new ServiceUnavailableException('sms_provider_disabled');
    }

    await this.sendMelipayamakPattern(phone, code);
  }

  async sendPasswordResetCode(phone: string, code: string): Promise<void> {
    const provider = String(process.env.SMS_PROVIDER || 'disabled').trim().toLowerCase();

    if (provider === 'kavenegar') {
      await this.sendKavenegarLookup(phone, code);
      return;
    }

    if (provider === 'disabled') {
      if (String(process.env.SMS_DEV_LOG_OTP || '').toLowerCase() === 'true' && process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.info(`[dev-sms] password reset ${maskPhone(phone)} code=${code}`);
      }
      return;
    }

    throw new ServiceUnavailableException('sms_provider_not_configured');
  }

  private async sendKavenegarLookup(phone: string, code: string): Promise<void> {
    const apiKey = process.env.KAVENEGAR_API_KEY;
    const template = process.env.KAVENEGAR_RESET_TEMPLATE;
    if (!apiKey || !template) throw new ServiceUnavailableException('sms_provider_not_configured');

    const url = new URL(`https://api.kavenegar.com/v1/${encodeURIComponent(apiKey)}/verify/lookup.json`);
    url.searchParams.set('receptor', phone);
    url.searchParams.set('token', code);
    url.searchParams.set('template', template);

    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new ServiceUnavailableException('sms_send_failed');
  }

  private async sendMelipayamakPattern(phone: string, code: string): Promise<void> {
    const apiKey = process.env.MELIPAYAMAK_API_KEY;
    const bodyId = process.env.MELIPAYAMAK_PATTERN_BODY_ID || '484419';
    const username = process.env.MELIPAYAMAK_USERNAME || '';
    if (!apiKey || !bodyId || !username) throw new ServiceUnavailableException('sms_provider_not_configured');

    const params = new URLSearchParams();
    params.set('username', username);
    params.set('password', apiKey);
    params.set('text', code);
    params.set('to', phone);
    params.set('bodyId', bodyId);

    const res = await fetch('https://api.payamak-panel.com/post/Send.asmx/SendByBaseNumber2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const body = await res.text();
    if (!res.ok) throw new ServiceUnavailableException('sms_send_failed');

    const normalized = body.replace(/<[^>]+>/g, '').trim();
    if (/^-\d+$|^0$|^2$|^6$|^7$|^10$|^11$|^12$|^16$|^17$|^35$/.test(normalized)) {
      throw new ServiceUnavailableException(`sms_send_failed:${normalized}`);
    }
  }
}
