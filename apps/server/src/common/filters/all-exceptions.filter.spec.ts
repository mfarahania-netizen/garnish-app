import { Logger, BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter (E7)', () => {
  const filter = new AllExceptionsFilter();

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterAll(() => jest.restoreAllMocks());

  const makeHost = (req: any) => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => req,
      }),
    } as any;
    return { host, status, json };
  };

  it('maps an HttpException to the error contract, preserving status & message', () => {
    const { host, status, json } = makeHost({ method: 'GET', url: '/x' });
    filter.catch(new BadRequestException('bad input'), host);

    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0][0];
    expect(body).toMatchObject({ statusCode: 400, message: 'bad input', path: '/x' });
    expect(body.traceId).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  it('maps an unknown error to 500 without leaking internals', () => {
    const { host, status, json } = makeHost({ method: 'POST', url: '/y' });
    filter.catch(new Error('boom secret detail'), host);

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('boom secret detail');
  });
});
