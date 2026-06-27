import { Module } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';

@Module({
  providers: [FavoritesService],
  controllers: [FavoritesController],
  exports: [FavoritesService], // reused by the agentic write-action tools (AgenticWriteToolsService)
})
export class FavoritesModule {}