import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { vi } from 'vitest';

describe('PWA cache contract', () => {
  const configSource = readFileSync(path.resolve(process.cwd(), 'vite.config.js'), 'utf8');
  const workerCleanupSource = readFileSync(
    path.resolve(process.cwd(), 'public/sw-private-cache-cleanup.js'),
    'utf8',
  );
  const indexSource = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

  const readPngSize = (assetPath) => {
    const bytes = readFileSync(assetPath);
    expect(bytes.byteLength).toBeGreaterThan(1024);
    expect(bytes.subarray(0, 8)).toEqual(Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]));
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  };

  const runWorkerActivation = async ({ cacheNames, deleteResult, deleteError = null }) => {
    let activateHandler;
    let activationPromise;
    const windowClient = {
      navigate: vi.fn(),
      postMessage: vi.fn(),
    };
    const clients = {
      claim: vi.fn().mockResolvedValue(undefined),
      matchAll: vi.fn().mockResolvedValue([windowClient]),
    };
    const cacheStorage = {
      keys: vi.fn().mockResolvedValue(cacheNames),
      delete: deleteError
        ? vi.fn().mockRejectedValue(deleteError)
        : vi.fn().mockResolvedValue(deleteResult),
    };
    const workerScope = {
      clients,
      addEventListener: vi.fn((type, handler) => {
        if (type === 'activate') activateHandler = handler;
      }),
    };

    runInNewContext(workerCleanupSource, {
      caches: cacheStorage,
      self: workerScope,
    });
    activateHandler({
      waitUntil: (promise) => {
        activationPromise = promise;
      },
    });
    await activationPromise;

    return {
      cacheStorage,
      clients,
      windowClient,
    };
  };

  it('contains no authenticated API runtime cache route or legacy api-cache', () => {
    expect(configSource).not.toMatch(/urlPattern\s*:\s*\/\\\/api/i);
    expect(configSource).not.toMatch(/cacheName\s*:\s*['"]api-cache['"]/i);
    expect(configSource).not.toContain("handler: 'NetworkFirst'");
  });

  it('runtime-caches only an explicit same-origin public immutable allowlist', () => {
    expect(configSource).toContain('sameOrigin');
    expect(configSource).toContain("cacheName: 'public-immutable-assets'");
    expect(configSource).toContain("handler: 'CacheFirst'");
    expect(configSource).not.toMatch(/\.(png\|jpg\|jpeg\|svg)/i);
  });

  it('imports worker-side activate cleanup for legacy private cache families', () => {
    expect(configSource).toContain("importScripts: ['/sw-private-cache-cleanup.js']");
    expect(workerCleanupSource).toContain("self.addEventListener('activate'");
    expect(workerCleanupSource).toContain('event.waitUntil(');
    expect(workerCleanupSource).toContain('api-cache');
    expect(workerCleanupSource).toContain("new Set(['asset-cache'])");
    expect(workerCleanupSource).toContain('await self.clients.claim()');
    expect(workerCleanupSource).toContain('includeUncontrolled: true');
    expect(workerCleanupSource).toContain('deletedCacheNames.length === 0');
    expect(workerCleanupSource).toContain('GARNISH_LEGACY_PRIVATE_CACHE_CLEARED');
    expect(workerCleanupSource).toContain('client.postMessage');
    expect(workerCleanupSource).not.toContain('client.navigate');
    expect(workerCleanupSource).not.toContain('public-immutable-assets');
  });

  it('notifies tabs without navigating only after a legacy cache was actually deleted', async () => {
    const failedDeletion = await runWorkerActivation({
      cacheNames: ['api-cache'],
      deleteResult: false,
    });
    expect(failedDeletion.cacheStorage.delete).toHaveBeenCalledWith('api-cache');
    expect(failedDeletion.clients.claim).not.toHaveBeenCalled();
    expect(failedDeletion.clients.matchAll).not.toHaveBeenCalled();
    expect(failedDeletion.windowClient.postMessage).not.toHaveBeenCalled();
    expect(failedDeletion.windowClient.navigate).not.toHaveBeenCalled();

    const completedDeletion = await runWorkerActivation({
      cacheNames: ['api-cache', 'public-immutable-assets'],
      deleteResult: true,
    });
    expect(completedDeletion.cacheStorage.delete).toHaveBeenCalledTimes(1);
    expect(completedDeletion.cacheStorage.delete).toHaveBeenCalledWith('api-cache');
    expect(completedDeletion.clients.claim).toHaveBeenCalledTimes(1);
    expect(completedDeletion.clients.matchAll).toHaveBeenCalledWith({
      type: 'window',
      includeUncontrolled: true,
    });
    expect(completedDeletion.windowClient.postMessage).toHaveBeenCalledWith({
      type: 'GARNISH_LEGACY_PRIVATE_CACHE_CLEARED',
      cacheNames: ['api-cache'],
    });
    expect(completedDeletion.windowClient.navigate).not.toHaveBeenCalled();
  });

  it('does not fail activation or notify tabs when Cache Storage deletion rejects', async () => {
    const rejectedDeletion = await runWorkerActivation({
      cacheNames: ['api-cache'],
      deleteError: new Error('storage blocked'),
    });

    expect(rejectedDeletion.cacheStorage.delete).toHaveBeenCalledWith('api-cache');
    expect(rejectedDeletion.clients.claim).not.toHaveBeenCalled();
    expect(rejectedDeletion.windowClient.postMessage).not.toHaveBeenCalled();
    expect(rejectedDeletion.windowClient.navigate).not.toHaveBeenCalled();
  });

  it.each([
    ['icon-192.png', 192],
    ['icon-512.png', 512],
  ])('ships a real %s manifest asset with the declared dimensions', (filename, size) => {
    const assetPath = path.resolve(process.cwd(), 'public', filename);

    expect(existsSync(assetPath)).toBe(true);
    expect(readPngSize(assetPath)).toEqual({ width: size, height: size });
    expect(configSource).toContain(`/${filename}`);
  });

  it('uses an existing public favicon rather than the Vite placeholder', () => {
    const faviconPath = path.resolve(process.cwd(), 'public/logo-garnish.png');

    expect(existsSync(faviconPath)).toBe(true);
    expect(indexSource).toContain('href="/logo-garnish.png"');
    expect(indexSource).not.toContain('/vite.svg');
  });
});
