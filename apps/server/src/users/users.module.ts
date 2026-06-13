import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UploadController } from './upload.controller';
import { ErasureAuditService } from './erasure/erasure-audit.service';

@Module({
  imports: [MulterModule.register({ dest: './uploads' })],
  providers: [UsersService, ErasureAuditService],
  controllers: [UsersController, UploadController],
  exports: [UsersService, ErasureAuditService],
})
export class UsersModule {}