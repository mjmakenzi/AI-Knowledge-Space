import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class ExtractorService {
  async extract(storageKey: string, mime: string): Promise<string> {
    const buf = await fs.readFile(storageKey);
    if (mime === 'text/plain' || mime.includes('markdown')) {
      return buf.toString('utf8');
    }
    if (mime === 'application/pdf') {
      const parser = new PDFParse({ data: buf });
      const res = await parser.getText();
      await parser.destroy();
      return res.text || '';
    }
    if (mime.includes('html') || mime === 'text/html') {
      const html = buf.toString('utf8');
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return text;
    }
    throw new UnsupportedMediaTypeException(`Unsupported mime: ${mime}`);
  }
}
