import { Body, Controller, Post } from '@nestjs/common';
import { QAService } from './qa.service';
import { QARequestDto } from './dto/qa-request.dto';

@Controller('qa')
export class QaController {
  constructor(private readonly qa: QAService) {}

  @Post()
  async answer(@Body() dto: QARequestDto) {
    const k = dto.k ?? 6;
    return this.qa.answer({
      question: dto.question,
      documentId: dto.documentId,
      k,
    });
  }
}
