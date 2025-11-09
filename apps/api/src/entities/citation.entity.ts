import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { QAEntity } from './qa.entity';
import { ChunkEntity } from './chunk.entity';

@Entity('citations')
export class CitationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => QAEntity, (qa) => qa.citations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'qaId' })
  qa!: QAEntity;

  @Column({ type: 'uuid' })
  qaId!: string;

  @ManyToOne(() => ChunkEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chunkId' })
  chunk!: ChunkEntity;

  @Column({ type: 'uuid' })
  chunkId!: string;

  @Column({ type: 'float' })
  score!: number;

  @Column({ type: 'int', nullable: true })
  startChar!: number | null;

  @Column({ type: 'int', nullable: true })
  endChar!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}
