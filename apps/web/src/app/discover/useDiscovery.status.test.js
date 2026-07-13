import { describe, expect, it } from 'vitest';
import { deriveBrowseStatus, deriveSearchStatus } from './useDiscovery';

describe('discover state derivation', () => {
  it('keeps browse loading, error, empty, and ready distinct', () => {
    expect(deriveBrowseStatus({ isLoading: true })).toBe('loading');
    expect(deriveBrowseStatus({ isError: true })).toBe('error');
    expect(deriveBrowseStatus({})).toBe('empty');
    expect(deriveBrowseStatus({ itemCount: 2, isError: true })).toBe('ready');
  });

  it('keeps search state independent from browse state', () => {
    expect(deriveSearchStatus({ active: false })).toBe('idle');
    expect(deriveSearchStatus({ active: true, isLoading: true })).toBe('loading');
    expect(deriveSearchStatus({ active: true, isError: true })).toBe('error');
    expect(deriveSearchStatus({ active: true })).toBe('noresults');
    expect(deriveSearchStatus({ active: true, resultCount: 1 })).toBe('results');
  });
});
