import { renderHook, act } from '@testing-library/react';

// Mock the HTTP client so we can assert the impression POST.
const post = vi.fn().mockResolvedValue({});
vi.mock('../lib/apiClient', () => ({ default: { post: (...a) => post(...a) } }));

import { useImpressionObserver } from './useImpressionObserver';

let ioCallback;
beforeEach(() => {
  post.mockClear();
  ioCallback = null;
  vi.useFakeTimers();
  // capture the IntersectionObserver callback so we can drive visibility deterministically
  global.IntersectionObserver = class {
    constructor(cb) { ioCallback = cb; }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
});
afterEach(() => vi.useRealTimers());

describe('useImpressionObserver — qualifies only at ≥50% for ≥1000ms', () => {
  it('posts a recommendation_impression after the threshold, with real viewportMs/visibleRatio', () => {
    const { result } = renderHook(() => useImpressionObserver({ enabled: true, source: 'home' }));
    const node = document.createElement('div');
    act(() => { result.current.observe('r1')(node); });

    act(() => ioCallback([{ target: node, isIntersecting: true, intersectionRatio: 0.6 }]));
    act(() => vi.advanceTimersByTime(900)); // still < 1000ms dwell
    expect(post).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(200)); // crosses 1000ms → qualifies
    act(() => vi.advanceTimersByTime(600)); // flush debounce
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.mock.calls[0];
    expect(url).toBe('/recommendations/impression');
    expect(body.recipeIds).toEqual(['r1']);
    expect(body.viewportMs).toBeGreaterThanOrEqual(1000);
    expect(body.visibleRatio).toBeGreaterThanOrEqual(0.5);
    expect(body.source).toBe('home');
  });

  it('does NOT post while visibility stays below 50%', () => {
    const { result } = renderHook(() => useImpressionObserver({ enabled: true }));
    const node = document.createElement('div');
    act(() => { result.current.observe('r2')(node); });
    act(() => ioCallback([{ target: node, isIntersecting: true, intersectionRatio: 0.3 }]));
    act(() => vi.advanceTimersByTime(3000));
    expect(post).not.toHaveBeenCalled();
  });

  it('does NOT post if the card leaves the viewport before 1000ms', () => {
    const { result } = renderHook(() => useImpressionObserver({ enabled: true }));
    const node = document.createElement('div');
    act(() => { result.current.observe('r3')(node); });
    act(() => ioCallback([{ target: node, isIntersecting: true, intersectionRatio: 0.7 }]));
    act(() => vi.advanceTimersByTime(500));
    act(() => ioCallback([{ target: node, isIntersecting: false, intersectionRatio: 0 }])); // scrolled away
    act(() => vi.advanceTimersByTime(2000));
    expect(post).not.toHaveBeenCalled();
  });
});
