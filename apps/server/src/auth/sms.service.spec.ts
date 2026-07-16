import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { SmsService } from './sms.service';

function response(body: string, ok = true) {
  return { ok, text: jest.fn().mockResolvedValue(body) } as any;
}

describe('SmsService Melipayamak transport', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.SMS_PROVIDER = 'melipayamak';
    process.env.MELIPAYAMAK_ENABLED = 'true';
    process.env.MELIPAYAMAK_USERNAME = 'panel-user';
    process.env.MELIPAYAMAK_API_KEY = 'test-api-key-not-secret';
    process.env.MELIPAYAMAK_PATTERN_BODY_ID = '484419';
    process.env.SMS_PROVIDER_TIMEOUT_MS = '1000';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('accepts a numeric message receipt and sends exactly one pattern variable', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    (global.fetch as jest.Mock).mockResolvedValue(
      response(
        '<?xml version="1.0"?><string xmlns="http://tempuri.org/">123456789</string>',
      ),
    );

    await new SmsService().sendOtpCode('09125859634', '123456');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const params = options.body as URLSearchParams;
    expect(params.get('text')).toBe('123456');
    expect(params.get('to')).toBe('09125859634');
    expect(params.get('bodyId')).toBe('484419');
    expect(log).toHaveBeenCalledWith('melipayamak accepted');
    expect(log.mock.calls.flat().join(' ')).not.toContain('09125859634');
    expect(log.mock.calls.flat().join(' ')).not.toContain('123456');
    expect(log.mock.calls.flat().join(' ')).not.toContain('123456789');
  });

  it('accepts an opaque numeric receipt wider than the JavaScript safe integer range', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    (global.fetch as jest.Mock).mockResolvedValue(
      response(
        '<?xml version="1.0"?><string xmlns="http://tempuri.org/">9007199254740993</string>',
      ),
    );

    await expect(
      new SmsService().sendOtpCode('09125859634', '123456'),
    ).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith('melipayamak accepted');
    expect(log.mock.calls.flat().join(' ')).not.toContain('9007199254740993');
  });

  it.each(['-2', '14', 'not-a-provider-result'])(
    'maps provider failure result %s to one stable public error',
    async (providerResult) => {
      (global.fetch as jest.Mock).mockResolvedValue(
        response(`<string>${providerResult}</string>`),
      );

      const error = await new SmsService()
        .sendOtpCode('09125859634', '123456')
        .catch((caught) => caught);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(error.message).toBe('sms_send_failed');
      expect(error.message).not.toContain(providerResult);
    },
  );

  it('rejects a numeric value outside the exact provider XML envelope', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(response('<result>123456789</result>'));

    await expect(new SmsService().sendOtpCode('09125859634', '123456'))
      .rejects.toThrow('sms_send_failed');
  });

  it('maps response stream failures to the stable public error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: jest.fn().mockRejectedValue(new Error('body stream failed')),
    });

    await expect(new SmsService().sendOtpCode('09125859634', '123456'))
      .rejects.toThrow('sms_send_failed');
  });

  it('requires an explicit body id instead of silently using another account template', async () => {
    delete process.env.MELIPAYAMAK_PATTERN_BODY_ID;

    await expect(
      new SmsService().sendOtpCode('09125859634', '123456'),
    ).rejects.toThrow('sms_provider_not_configured');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('allows raw OTP logging only in an explicit development or test environment', async () => {
    process.env.SMS_PROVIDER = 'disabled';
    process.env.SMS_DEV_LOG_OTP = 'true';
    const info = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    process.env.NODE_ENV = 'test';
    await expect(
      new SmsService().sendOtpCode('09125859634', '123456'),
    ).resolves.toBeUndefined();
    expect(info).toHaveBeenCalledWith('[dev-sms] otp 0912***34 code=123456');

    info.mockClear();
    process.env.NODE_ENV = 'staging';
    await expect(
      new SmsService().sendOtpCode('09125859634', '654321'),
    ).rejects.toThrow('sms_provider_not_configured');
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it('aborts a hung provider call at the bounded timeout', async () => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    );

    const assertion = expect(
      new SmsService().sendOtpCode('09125859634', '123456'),
    ).rejects.toThrow('sms_send_failed');
    await jest.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});
