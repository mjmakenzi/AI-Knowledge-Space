import { Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { diskStorage } from 'multer';
import { CreateDocumentDto } from './dto/create-document.dto';
import { SanitizeUtil } from '../../utils/sanitize.util';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Get()
  list() {
    return this.docs.findAll();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.docs.findOne(id);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: 'storage',
        filename: (_, file, cb) => {
          const id = randomUUID();
          const ext = extname(file.originalname) || '';
          cb(null, `${id}${ext}`);
        },
      }),
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
      preservePath: false,
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    // Sanitize all text fields before storing in database
    const originalName = SanitizeUtil.sanitizeFilename(file.originalname);
    const mimeType = SanitizeUtil.sanitizeMimeType(file.mimetype);

    const dto: CreateDocumentDto = {
      title: originalName,
      mime: mimeType,
      bytes: String(file.size),
      storageKey: SanitizeUtil.sanitizeText(`storage/${file.filename}`),
    };

    const saved = await this.docs.create(dto);
    return { id: saved.id, title: saved.title, status: saved.status };
  }
}
