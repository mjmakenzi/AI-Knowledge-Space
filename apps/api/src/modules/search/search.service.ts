import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ChunkEntity } from '../../entities/chunk.entity';
import { EmbeddingEntity } from '../../entities/embedding.entity';
import { DocumentEntity } from '../../entities/document.entity';
import { DataSource, Repository } from 'typeorm';
import { EmbedderService } from '../ingest/embedder.service';

type SearchParams = { q: string; k: number; documentId?: string };

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(ChunkEntity) private readonly chunks: Repository<ChunkEntity>,
    @InjectRepository(EmbeddingEntity) private readonly embeddings: Repository<EmbeddingEntity>,
    @InjectRepository(DocumentEntity) private readonly docs: Repository<DocumentEntity>,
    private readonly ds: DataSource,
    private readonly embedder: EmbedderService,
  ) {}

  async search(params: SearchParams) {
    const { q, k, documentId } = params;
    if (!q || !q.trim()) throw new BadRequestException('Missing q');

    const toPgVectorLiteral = (vector: number[]) => `[${vector.join(',')}]`;

    // 1) Embed the query
    const [qVec] = await this.embedder.embed([q]);
    const qVecLiteral = toPgVectorLiteral(qVec);

    // 2) Vector search (quote camelCase columns)
    const vectorSql = `
      SELECT c.id, c."documentId", c.idx, c.content,
             (1 - (e.vector <=> $1::vector)) AS vscore
      FROM embeddings e
      JOIN chunks c ON c.id = e."chunkId"
      ${documentId ? 'WHERE c."documentId" = $2' : ''}
      ORDER BY e.vector <=> $1
      LIMIT ${Math.max(k, 16)}
    `;
    const vectorRows = await this.ds.query(
      vectorSql,
      documentId ? [qVecLiteral, documentId] : [qVecLiteral],
    );

    // 3) Text search (quote camelCase too)
    const textSql = `
      SELECT c.id, c."documentId", c.idx, c.content,
             ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', $1)) AS tscore
      FROM chunks c
      ${documentId ? 'WHERE c."documentId" = $2' : ''}
      ORDER BY tscore DESC
      LIMIT ${Math.max(k, 16)}
    `;
    const textRows = await this.ds.query(textSql, documentId ? [q, documentId] : [q]);

    // 4) RRF merge (keep property as documentId)
    const kRrf = 60;
    const ranks = new Map<string, { item: any; rrf: number; v?: number; t?: number }>();
    vectorRows.forEach((r: any, i: number) => {
      const prev = ranks.get(r.id) || { item: r, rrf: 0 };
      prev.rrf += 1 / (kRrf + i + 1);
      prev.v = r.vscore;
      ranks.set(r.id, prev);
    });
    textRows.forEach((r: any, i: number) => {
      const prev = ranks.get(r.id) || { item: r, rrf: 0 };
      prev.rrf += 1 / (kRrf + i + 1);
      prev.t = r.tscore;
      prev.item = prev.item || r;
      ranks.set(r.id, prev);
    });

    const merged = Array.from(ranks.values())
      .sort((a, b) => (b.rrf ?? 0) - (a.rrf ?? 0))
      .slice(0, k)
      .map((x) => ({
        id: x.item.id,
        documentId: x.item.documentId, // now consistently present
        idx: x.item.idx,
        content: x.item.content,
        scores: { vector: x.v ?? 0, text: x.t ?? 0, rrf: x.rrf },
      }));

    return { q, k, results: merged };
  }
}
