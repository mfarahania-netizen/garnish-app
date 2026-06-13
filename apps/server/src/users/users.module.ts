import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UploadController } from './upload.controller';
import { ErasureAuditService } from './erasure/erasure-audit.service';
import { ErasureService } from './erasure/erasure.service';

@Module({
  imports: [MulterModule.register({ dest: './uploads' })],
  providers: [UsersService, ErasureAuditService, ErasureService],
  controllers: [UsersController, UploadController],
  exports: [UsersService, ErasureAuditService, ErasureService],
})
export class UsersModule {}