import { Module } from '@nestjs/common';
import { ChunkEntity } from '../../entities/chunk.entity';
import { EmbeddingEntity } from '../../entities/embedding.entity';
import { DocumentEntity } from '../../entities/document.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { EmbedderService } from '../ingest/embedder.service';
import { SearchService } from './search.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChunkEntity, EmbeddingEntity, DocumentEntity])],
  controllers: [SearchController],
  providers: [SearchService, EmbedderService],
  exports: [SearchService],
})
export class SearchModule {}
