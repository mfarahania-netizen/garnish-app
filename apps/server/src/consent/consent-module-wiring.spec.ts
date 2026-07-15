import { MODULE_METADATA } from '@nestjs/common/constants';
import { AppModule } from '../app.module';
import { ConsentModule } from './consent.module';
import { ConsentService } from './consent.service';

type MetadataTarget = object;

const moduleType = (entry: unknown): MetadataTarget | undefined => {
  if (typeof entry === 'function') return entry;
  if (entry && typeof entry === 'object' && 'module' in entry) {
    const nested = (entry as { module?: unknown }).module;
    return typeof nested === 'function' ? nested : undefined;
  }
  return undefined;
};

const providerType = (entry: unknown): MetadataTarget | undefined => {
  if (typeof entry === 'function') return entry;
  if (entry && typeof entry === 'object' && 'useClass' in entry) {
    const nested = (entry as { useClass?: unknown }).useClass;
    return typeof nested === 'function' ? nested : undefined;
  }
  return undefined;
};

describe('ConsentService module wiring', () => {
  it('imports ConsentModule wherever a local provider injects ConsentService', () => {
    const pending: MetadataTarget[] = [AppModule];
    const visited = new Set<MetadataTarget>();
    const missing: string[] = [];

    while (pending.length > 0) {
      const current = pending.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, current) ?? []) as unknown[];
      const importedTypes = imports.map(moduleType).filter(Boolean) as MetadataTarget[];
      pending.push(...importedTypes);

      if (current === ConsentModule) continue;

      const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, current) ?? []) as unknown[];
      const injectsConsent = providers
        .map(providerType)
        .filter(Boolean)
        .some((provider) => {
          const dependencies = (Reflect.getMetadata('design:paramtypes', provider!) ?? []) as unknown[];
          return dependencies.includes(ConsentService);
        });

      if (injectsConsent && !importedTypes.includes(ConsentModule)) {
        missing.push((current as { name?: string }).name ?? '(anonymous module)');
      }
    }

    expect(missing).toEqual([]);
  });
});
