import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('documents')
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  mime!: string;

  @Column({ type: 'bigint' })
  bytes!: string; // store as string to avoid bigint issues

  @Column({ type: 'text' })
  storageKey!: string;

  @Column({ type: 'text', default: 'uploaded' })
  status!: 'uploaded' | 'processing' | 'ready' | 'error';

  @CreateDateColumn()
  createdAt!: Date;
}
