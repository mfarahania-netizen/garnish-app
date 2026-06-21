import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UploadController } from './upload.controller';
import { ErasureAuditService } from './erasure/erasure-audit.service';
import { ErasureService } from './erasure/erasure.service';
import { UserExportService } from './export/user-export.service';
import { GuestReaperService } from './guest-reaper.service';
import { ConsentModule } from '../consent/consent.module';

@Module({
  imports: [MulterModule.register({ dest: './uploads' }), ConsentModule],
  providers: [UsersService, ErasureAuditService, ErasureService, UserExportService, GuestReaperService],
  controllers: [UsersController, UploadController],
  exports: [UsersService, ErasureAuditService, ErasureService, UserExportService],
})
export class UsersModule {}