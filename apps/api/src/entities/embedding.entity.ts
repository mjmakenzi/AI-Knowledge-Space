import { Column, Entity, Index, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ChunkEntity } from './chunk.entity';

@Entity('embeddings')
export class EmbeddingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => ChunkEntity, { onDelete: 'CASCADE' })
  @JoinColumn()
  @Index()
  chunk!: ChunkEntity;

  // pgvector 'vector' type; ensure pgvector extension is available (your docker image has it)
  @Column({ type: 'vector', length: 1536 })
  vector!: number[];
}
