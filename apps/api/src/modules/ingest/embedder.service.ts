import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class EmbedderService {
  private client: OpenAI | null = null;
  private model: string;
  private dim = 1536;

  constructor(config: ConfigService) {
    const openrouterKey = config.get<string>('OPENROUTER_API_KEY');
    const openaiKey = config.get<string>('OPENAI_API_KEY');
    this.model = config.get<string>('EMBEDDING_MODEL') || 'openai/text-embedding-3-small';

    if (openrouterKey && openrouterKey !== 'replace_me') {
      this.client = new OpenAI({
        apiKey: openrouterKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': config.get<string>('OPENROUTER_SITE_URL') || 'http://localhost',
          'X-Title': config.get<string>('OPENROUTER_APP_NAME') || 'AI Knowledge Space',
        },
      });
      return;
    }

    if (openaiKey && openaiKey !== 'replace_me') {
      this.client = new OpenAI({ apiKey: openaiKey });
      if (!config.get<string>('EMBEDDING_MODEL')) {
        this.model = 'text-embedding-3-small';
      }
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.client) {
      return texts.map((t) => this.fakeEmbed(t, this.dim));
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
    const norm = Math.sqrt(arr.reduce((a, b) => a + b * b, 0)) || 1;
    return arr.map((v) => v / norm);
  }
}
