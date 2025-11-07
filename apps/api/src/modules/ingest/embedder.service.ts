import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class EmbedderService {
  private client: OpenAI | null = null;
  private model = 'text-embedding-3-small';

  constructor(config: ConfigService) {
    const key = config.get<string>('OPENAI_API_KEY');
    if (key && key !== 'replace_me') {
      this.client = new OpenAI({ apiKey: key });
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.client) {
      // Fallback deterministic pseudo-embedding for dev without API key
      return texts.map((t) => this.fakeEmbed(t, 64));
    }
    const res = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    return res.data.map((d) => d.embedding as unknown as number[]);
  }

  private fakeEmbed(s: string, dim: number): number[] {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    const arr = Array.from({ length: dim }, (_, i) => Math.sin((h + i) % 1000));
    // normalize
    const norm = Math.sqrt(arr.reduce((a, b) => a + b * b, 0)) || 1;
    return arr.map((v) => v / norm);
  }
}
