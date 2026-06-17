import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmount React trees between tests so each smoke test starts from a clean DOM.
afterEach(() => cleanup());

// jsdom lacks the browser APIs that Mantine, framer-motion, and our reduced-motion
// helpers reach for. Stub them so a render() never throws on a missing global.

// matchMedia — Mantine color-scheme + lib/motion prefersReducedMotion()
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// ResizeObserver — Mantine ScrollArea / responsive primitives
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// IntersectionObserver — framer-motion whileInView, lazy rails
if (!window.IntersectionObserver) {
  window.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

// scrollTo / element.scroll — Cook Mode + drawers call these on navigation
window.scrollTo = window.scrollTo || vi.fn();
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

// localStorage / sessionStorage — this jsdom runner does not expose them, and the real
// AuthContext reads localStorage.getItem('token') at mount. Provide a minimal in-memory
// Storage so the REAL AuthProvider can mount logged-out (no token) under test, without each
// screen having to mock AuthContext. Browsers always have Storage; this is test-env only.
function createMemoryStorage() {
  let store = Object.create(null);
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = Object.create(null); },
    key: (i) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
}
if (!globalThis.localStorage) {
  Object.defineProperty(globalThis, 'localStorage', { value: createMemoryStorage(), configurable: true });
}
if (!globalThis.sessionStorage) {
  Object.defineProperty(globalThis, 'sessionStorage', { value: createMemoryStorage(), configurable: true });
}
