import { Module } from '@nestjs/common';
import { QAEntity } from '../../entities/qa.entity';
import { CitationEntity } from '../../entities/citation.entity';
import { ChunkEntity } from '../../entities/chunk.entity';
import { DocumentEntity } from '../../entities/document.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchModule } from '../search/search.module';
import { QaController } from './qa.controller';
import { QAService } from './qa.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([QAEntity, CitationEntity, ChunkEntity, DocumentEntity]),
    SearchModule,
  ],
  controllers: [QaController],
  providers: [QAService],
})
export class QaModule {}
