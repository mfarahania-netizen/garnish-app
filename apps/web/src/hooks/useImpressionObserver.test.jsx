import { renderHook, act } from '@testing-library/react';

// Mock the HTTP client so we can assert the impression POST.
const post = vi.fn().mockResolvedValue({});
vi.mock('../lib/apiClient', () => ({ default: { post: (...a) => post(...a) } }));
const consent = vi.hoisted(() => ({ active: true }));
vi.mock('../lib/analytics-init', () => ({
  ANALYTICS_RUNTIME_EVENT: 'garnish:analytics-runtime-changed',
  hasAnalyticsConsent: () => consent.active,
}));

import { useImpressionObserver } from './useImpressionObserver';

let ioCallback;
let disconnect;
let unobserve;
beforeEach(() => {
  consent.active = true;
  post.mockClear();
  ioCallback = null;
  disconnect = vi.fn();
  unobserve = vi.fn();
  vi.useFakeTimers();
  // capture the IntersectionObserver callback so we can drive visibility deterministically
  global.IntersectionObserver = class {
    constructor(cb) { ioCallback = cb; }
    observe() {}
    unobserve(node) { unobserve(node); }
    disconnect() { disconnect(); }
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

  it('unobserves a detached ref and cancels its pending dwell timer', () => {
    const { result } = renderHook(() => useImpressionObserver({ enabled: true }));
    const node = document.createElement('div');
    const ref = result.current.observe('r-detached');
    act(() => { ref(node); });
    act(() => ioCallback([{ target: node, isIntersecting: true, intersectionRatio: 0.7 }]));
    act(() => vi.advanceTimersByTime(500));

    act(() => { ref(null); });
    act(() => vi.advanceTimersByTime(2000));

    expect(unobserve).toHaveBeenCalledWith(node);
    expect(post).not.toHaveBeenCalled();
  });
});

describe('useImpressionObserver — requestId echo', () => {
  it('echoes the served-slate requestId on qualifying impressions', () => {
    const { result } = renderHook(() => useImpressionObserver({ enabled: true, source: 'home' }));
    const node = document.createElement('div');
    act(() => { result.current.observe('r1', 'req-123')(node); });

    act(() => ioCallback([{ target: node, isIntersecting: true, intersectionRatio: 0.6 }]));
    act(() => vi.advanceTimersByTime(1100));
    act(() => vi.advanceTimersByTime(600));

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toMatchObject({ recipeIds: ['r1'], requestId: 'req-123', source: 'home' });
  });

  it('keeps different requestIds in separate impression posts', () => {
    const { result } = renderHook(() => useImpressionObserver({ enabled: true, source: 'home' }));
    const a = document.createElement('div');
    const b = document.createElement('div');
    act(() => { result.current.observe('r1', 'req-a')(a); });
    act(() => { result.current.observe('r2', 'req-b')(b); });

    act(() => ioCallback([
      { target: a, isIntersecting: true, intersectionRatio: 0.6 },
      { target: b, isIntersecting: true, intersectionRatio: 0.7 },
    ]));
    act(() => vi.advanceTimersByTime(1100));
    act(() => vi.advanceTimersByTime(600));

    expect(post).toHaveBeenCalledTimes(2);
    const bodies = post.mock.calls.map(([, body]) => body).sort((x, y) => x.requestId.localeCompare(y.requestId));
    expect(bodies[0]).toMatchObject({ recipeIds: ['r1'], requestId: 'req-a' });
    expect(bodies[1]).toMatchObject({ recipeIds: ['r2'], requestId: 'req-b' });
  });
});

describe('useImpressionObserver — reactive analytics withdrawal', () => {
  const withdraw = () => {
    consent.active = false;
    globalThis.dispatchEvent(new Event('garnish:analytics-runtime-changed'));
  };
  const regrant = () => {
    consent.active = true;
    globalThis.dispatchEvent(new Event('garnish:analytics-runtime-changed'));
  };

  it('does not create an observer or send when analytics is already inactive', () => {
    consent.active = false;
    renderHook(() => useImpressionObserver({ enabled: true, source: 'home' }));

    expect(ioCallback).toBeNull();
    act(() => vi.advanceTimersByTime(3000));
    expect(post).not.toHaveBeenCalled();
  });

  it('withdrawal during dwell cancels the timer and sends zero impressions', () => {
    const { result } = renderHook(() => useImpressionObserver({ enabled: true, source: 'home' }));
    const node = document.createElement('div');
    act(() => { result.current.observe('r-withdraw-dwell')(node); });
    act(() => ioCallback([{ target: node, isIntersecting: true, intersectionRatio: 0.8 }]));
    act(() => vi.advanceTimersByTime(500));
    act(withdraw);
    act(() => vi.advanceTimersByTime(3000));

    expect(post).not.toHaveBeenCalled();
  });

  it('withdrawal after qualification clears a pending batch before flush', () => {
    const { result } = renderHook(() => useImpressionObserver({ enabled: true, source: 'home' }));
    const node = document.createElement('div');
    act(() => { result.current.observe('r-withdraw-pending')(node); });
    act(() => ioCallback([{ target: node, isIntersecting: true, intersectionRatio: 0.8 }]));
    act(() => vi.advanceTimersByTime(1100));
    act(withdraw);
    act(() => vi.advanceTimersByTime(1000));

    expect(post).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });

  it('does not replay a withdrawn pending batch, but sends after a new qualification on re-consent', () => {
    const { result } = renderHook(() => useImpressionObserver({ enabled: true, source: 'home' }));
    const node = document.createElement('div');
    act(() => { result.current.observe('r-withdraw-regrant')(node); });

    // The first visibility window qualifies and is queued, but has not reached the 600ms flush yet.
    act(() => ioCallback([{ target: node, isIntersecting: true, intersectionRatio: 0.8 }]));
    act(() => vi.advanceTimersByTime(1100));
    act(withdraw);

    // Withdrawal and re-consent alone must never replay the dropped queue.
    act(() => vi.advanceTimersByTime(3000));
    expect(post).not.toHaveBeenCalled();
    act(regrant);
    act(() => vi.advanceTimersByTime(3000));
    expect(post).not.toHaveBeenCalled();

    // A fresh observer callback starts a fresh dwell window after re-consent.
    act(() => ioCallback([{ target: node, isIntersecting: true, intersectionRatio: 0.75 }]));
    act(() => vi.advanceTimersByTime(1100));
    act(() => vi.advanceTimersByTime(600));

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toMatchObject({
      recipeIds: ['r-withdraw-regrant'],
      source: 'home',
    });
  });
});
