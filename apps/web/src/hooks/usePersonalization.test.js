import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// mock the analytics hook so we can assert the P0 signal-capture emits (and keep the unit tests offline)
const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('./useAnalytics', () => ({ useAnalytics: () => ({ trackEvent }) }));

import { usePersonalization } from './usePersonalization';

// The shared session-state layer both the recipe page and Cook Mode read from.
describe('usePersonalization', () => {
  beforeEach(() => { sessionStorage.clear(); trackEvent.mockClear(); });

  it('starts empty and computes a neutral scale factor', () => {
    const { result } = renderHook(() => usePersonalization('r1', 4));
    expect(result.current.servedFor).toBeNull();
    expect(result.current.scaleFactor).toBe(1);
    expect(result.current.isPersonalized).toBe(false);
  });

  it('derives scaleFactor from servedFor / baseServings', () => {
    const { result } = renderHook(() => usePersonalization('r1', 4));
    act(() => result.current.setServedFor(8));
    expect(result.current.servedFor).toBe(8);
    expect(result.current.scaleFactor).toBe(2);
    expect(result.current.isPersonalized).toBe(true);
  });

  it('applies and clears swaps keyed by source ingredient name', () => {
    const { result } = renderHook(() => usePersonalization('r1', 4));
    act(() => result.current.applySwap('کره', 'روغن زیتون', { reason: 'taste', quality: 'good' }));
    expect(result.current.swapFor('کره')).toMatchObject({ to: 'روغن زیتون', reason: 'taste' });
    act(() => result.current.clearSwap('کره'));
    expect(result.current.swapFor('کره')).toBeNull();
  });

  it('toggles removed ingredients', () => {
    const { result } = renderHook(() => usePersonalization('r1', 4));
    act(() => result.current.toggleRemoved('قارچ'));
    expect(result.current.isRemoved('قارچ')).toBe(true);
    act(() => result.current.toggleRemoved('قارچ'));
    expect(result.current.isRemoved('قارچ')).toBe(false);
  });

  it('persists across mounts (so Cook Mode reads what the recipe page set)', () => {
    const first = renderHook(() => usePersonalization('r1', 4));
    act(() => { first.result.current.setServedFor(6); first.result.current.toggleRemoved('پیاز'); });
    first.unmount();

    const second = renderHook(() => usePersonalization('r1', 4));
    expect(second.result.current.servedFor).toBe(6);
    expect(second.result.current.isRemoved('پیاز')).toBe(true);
  });

  it('scopes personalization per recipe id', () => {
    const a = renderHook(() => usePersonalization('r1', 4));
    act(() => a.result.current.setServedFor(8));
    a.unmount();
    const b = renderHook(() => usePersonalization('r2', 4));
    expect(b.result.current.servedFor).toBeNull();
  });

  it('reset clears storage', () => {
    const { result } = renderHook(() => usePersonalization('r1', 4));
    act(() => result.current.setServedFor(8));
    act(() => result.current.reset());
    expect(result.current.isPersonalized).toBe(false);
    expect(sessionStorage.getItem('garnish:personalization:r1')).toBeNull();
  });

  // P0 signal capture — the strongest taste signals must now reach the server (were sessionStorage-only)
  describe('emits taste signals', () => {
    it('applySwap → ingredient_swapped with from/to/meta + recipeId', () => {
      const { result } = renderHook(() => usePersonalization('r1', 4));
      act(() => result.current.applySwap('کره', 'روغن زیتون', { reason: 'taste' }));
      expect(trackEvent).toHaveBeenCalledWith('ingredient_swapped', { recipeId: 'r1', from: 'کره', to: 'روغن زیتون', reason: 'taste' });
    });

    it('setServedFor → portion_scaled with servedFor + baseServings (only on a real change)', () => {
      const { result } = renderHook(() => usePersonalization('r1', 4));
      act(() => result.current.setServedFor(6));
      expect(trackEvent).toHaveBeenCalledWith('portion_scaled', { recipeId: 'r1', servedFor: 6, baseServings: 4 });
    });

    it('toggleRemoved emits ingredient_removed on REMOVE only, not on restore', () => {
      const { result } = renderHook(() => usePersonalization('r1', 4));
      act(() => result.current.toggleRemoved('قارچ')); // remove
      expect(trackEvent).toHaveBeenCalledWith('ingredient_removed', { recipeId: 'r1', ingredient: 'قارچ' });
      trackEvent.mockClear();
      act(() => result.current.toggleRemoved('قارچ')); // restore → no event
      expect(trackEvent).not.toHaveBeenCalled();
    });
  });
});
