import { Injectable } from '@nestjs/common';

@Injectable()
export class ChunkerService {
  chunk(
    text: string,
    targetTokens = 600,
    overlap = 100,
  ): { content: string; tokenCount: number }[] {
    const approxTokens = (s: string) => Math.ceil(s.length / 4); // heuristic
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let cur: string[] = [];
    let curTokens = 0;

    for (const s of sentences) {
      const t = approxTokens(s);
      if (curTokens + t > targetTokens && cur.length) {
        chunks.push(cur.join(' '));
        const keep = cur
          .join(' ')
          .split(' ')
          .slice(-(overlap * 4))
          .join(' ');
        cur = keep ? [keep] : [];
        curTokens = approxTokens(cur.join(' '));
      }
      cur.push(s);
      curTokens += t;
    }
    if (cur.length) chunks.push(cur.join(' '));
    return chunks.map((c) => ({ content: c, tokenCount: approxTokens(c) }));
  }
}
