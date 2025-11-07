import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentEntity } from '../../entities/document.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChunkEntity } from '../../entities/chunk.entity';
import { EmbeddingEntity } from '../../entities/embedding.entity';
import { ExtractorService } from './extractor.service';
import { ChunkerService } from './chunker.service';
import { EmbedderService } from './embedder.service';

@Injectable()
export class IngestService {
  constructor(
    @InjectRepository(DocumentEntity) private readonly docs: Repository<DocumentEntity>,
    @InjectRepository(ChunkEntity) private readonly chunks: Repository<ChunkEntity>,
    @InjectRepository(EmbeddingEntity) private readonly embeddings: Repository<EmbeddingEntity>,
    private readonly extractor: ExtractorService,
    private readonly chunker: ChunkerService,
    private readonly embedder: EmbedderService,
  ) {}

  async startIngest(documentId: string) {
    const doc = await this.docs.findOneBy({ id: documentId });
    if (!doc) throw new NotFoundException('Doucument not found');

    await this.docs.update({ id: doc.id }, { status: 'processing' });

    void this.runPipeline(doc.id).catch(async () => {
      await this.docs.update({ id: doc.id }, { status: 'error' });
    });

    return { ok: true, documentId: doc.id, status: 'processing' };
  }

  private async runPipeline(docId: string) {
    const doc = await this.docs.findOneByOrFail({ id: docId });

    const text = await this.extractor.extract(doc.storageKey, doc.mime);
    const pieces = this.chunker.chunk(text);

    // persist chunks
    const chunkEntities = await this.chunks.save(
      pieces.map((p, i) =>
        this.chunks.create({
          document: { id: doc.id } as DocumentEntity,
          idx: i,
          content: p.content,
          tokenCount: p.tokenCount,
        }),
      ),
    );

    // embed in batches
    const batch = 64;
    for (let i = 0; i < chunkEntities.length; i += batch) {
      const slice = chunkEntities.slice(i, i + batch);
      const vectors = await this.embedder.embed(slice.map((c) => c.content));
      await this.embeddings.save(
        slice.map((c, j) =>
          this.embeddings.create({
            chunk: { id: c.id } as ChunkEntity,
            vector: vectors[j],
          }),
        ),
      );
    }

    await this.docs.update({ id: doc.id }, { status: 'ready' });
  }
}
