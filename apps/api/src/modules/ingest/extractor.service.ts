import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class ExtractorService {
  async extract(storageKey: string, mime: string): Promise<string> {
    const buf = await fs.readFile(storageKey);
    if (mime === 'text/plain' || mime.includes('markdown')) {
      // Remove UTF-8 BOM if present and decode as UTF-8
      let text = buf.toString('utf8');
      if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1); // Remove BOM
      }
      return text;
    }
    if (mime === 'application/pdf') {
      const parser = new PDFParse({ data: buf });
      const res = await parser.getText();
      await parser.destroy();
      return res.text || '';
    }
    if (mime.includes('html') || mime === 'text/html') {
      // Remove UTF-8 BOM if present and decode as UTF-8
      let html = buf.toString('utf8');
      if (html.charCodeAt(0) === 0xfeff) {
        html = html.slice(1); // Remove BOM
      }
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
