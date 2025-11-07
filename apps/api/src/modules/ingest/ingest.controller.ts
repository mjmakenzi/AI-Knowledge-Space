import { Controller, Param, Post } from '@nestjs/common';
import { IngestService } from './ingest.service';

@Controller('ingest')
export class IngestController {
  constructor(private readonly ingest: IngestService) {}

  @Post(':documentId')
  async start(@Param('documentId') documentId: string) {
    return this.ingest.startIngest(documentId);
  }
}
