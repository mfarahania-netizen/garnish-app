import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UploadController } from './upload.controller';

@Module({
  imports: [MulterModule.register({ dest: './uploads' })],
  providers: [UsersService],
  controllers: [UsersController, UploadController],
  exports: [UsersService],
})
export class UsersModule {}