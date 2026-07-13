import { describe, expect, it } from 'vitest';
import { deriveSettingsStatus } from './useSettings';

describe('settings critical read status', () => {
  it('fails closed when identity, preferences, or consent fails', () => {
    expect(deriveSettingsStatus({ isError: true }, {}, {})).toBe('error');
    expect(deriveSettingsStatus({}, { isError: true }, {})).toBe('error');
    expect(deriveSettingsStatus({}, {}, { isError: true })).toBe('error');
  });

  it('shows loading only while no critical read has failed', () => {
    expect(deriveSettingsStatus({}, { isLoading: true }, {})).toBe('loading');
    expect(deriveSettingsStatus({}, { isLoading: true }, { isError: true })).toBe('error');
    expect(deriveSettingsStatus({}, {}, {})).toBe('ready');
  });
});
