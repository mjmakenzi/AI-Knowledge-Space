import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from '../../entities/document.entity';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { ExtractorService } from './extractor.service';
import { ChunkEntity } from '../../entities/chunk.entity';
import { EmbeddingEntity } from '../../entities/embedding.entity';
import { EmbedderService } from './embedder.service';
import { ChunkerService } from './chunker.service';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentEntity, ChunkEntity, EmbeddingEntity])],
  controllers: [IngestController],
  providers: [IngestService, ExtractorService, ChunkerService, EmbedderService],
  exports: [IngestService],
})
export class IngestModule {}
