import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  async query(
    @Query('q') q: string,
    @Query('k') k = '8',
    @Query('documentId') documentId?: string,
  ) {
    const topK = Math.max(1, Math.min(50, Number(k) || 8));
    return this.search.search({ q, k: topK, documentId });
  }
}
