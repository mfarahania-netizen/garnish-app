import { GUARDS_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../app.module';
import { AuthController } from './auth.controller';

describe('AuthController throttling wiring', () => {
  it('uses the one global ThrottlerGuard and does not install a duplicate controller guard', () => {
    const controllerGuards = Reflect.getMetadata(GUARDS_METADATA, AuthController) ?? [];
    const appProviders = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppModule) ?? [];

    expect(controllerGuards).not.toContain(ThrottlerGuard);
    expect(appProviders).toContainEqual({ provide: APP_GUARD, useClass: ThrottlerGuard });
  });
});
