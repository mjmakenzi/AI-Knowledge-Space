import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DocumentEntity } from '../../entities/document.entity';
import { Repository } from 'typeorm';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentEntity) private readonly repo: Repository<DocumentEntity>,
  ) {}

  async create(data: CreateDocumentDto) {
    const doc = this.repo.create({
      title: data.title,
      mime: data.mime,
      bytes: data.bytes,
      storageKey: data.storageKey,
      status: 'uploaded',
    });

    return await this.repo.save(doc);
  }

  async findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    return this.repo.findOneBy({ id });
  }
}
