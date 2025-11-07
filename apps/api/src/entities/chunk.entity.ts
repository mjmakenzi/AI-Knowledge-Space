import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DocumentEntity } from './document.entity';

@Entity('chunks')
export class ChunkEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => DocumentEntity, { onDelete: 'CASCADE' })
  document!: DocumentEntity;

  @Index()
  @Column({ type: 'int' })
  idx!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'int' })
  tokenCount!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
