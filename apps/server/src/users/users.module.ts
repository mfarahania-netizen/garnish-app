import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UploadController } from './upload.controller';
import { ErasureAuditService } from './erasure/erasure-audit.service';
import { ErasureService } from './erasure/erasure.service';
import { UserExportService } from './export/user-export.service';

@Module({
  imports: [MulterModule.register({ dest: './uploads' })],
  providers: [UsersService, ErasureAuditService, ErasureService, UserExportService],
  controllers: [UsersController, UploadController],
  exports: [UsersService, ErasureAuditService, ErasureService, UserExportService],
})
export class UsersModule {}