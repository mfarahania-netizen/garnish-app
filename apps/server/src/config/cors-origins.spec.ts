import { resolveCorsOrigins } from './cors-origins';

describe('resolveCorsOrigins', () => {
  it('defaults to both localhost and 127.0.0.1 for the Vite dev port', () => {
    expect(resolveCorsOrigins(undefined)).toEqual(['http://localhost:5173', 'http://127.0.0.1:5173']);
  });

  it('adds the loopback peer for an explicitly configured localhost frontend', () => {
    expect(resolveCorsOrigins('http://localhost:5173')).toEqual(['http://localhost:5173', 'http://127.0.0.1:5173']);
  });

  it('adds the loopback peer for an explicitly configured 127.0.0.1 frontend', () => {
    expect(resolveCorsOrigins('http://127.0.0.1:5173')).toEqual(['http://127.0.0.1:5173', 'http://localhost:5173']);
  });

  it('keeps production origins narrow and expands only loopback entries', () => {
    expect(resolveCorsOrigins('https://app.garnish.test, http://localhost:5174')).toEqual([
      'https://app.garnish.test',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
    ]);
  });
});