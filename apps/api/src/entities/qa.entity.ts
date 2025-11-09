import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { CitationEntity } from './citation.entity';

@Entity('qa')
export class QAEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'text' })
  question!: string;

  @Column({ type: 'text' })
  answer!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => CitationEntity, (c) => c.qa, { cascade: true })
  citations!: CitationEntity[];
}
