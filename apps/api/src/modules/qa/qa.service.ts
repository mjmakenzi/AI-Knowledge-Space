import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QAEntity } from '../../entities/qa.entity';
import { In, Repository } from 'typeorm';
import { CitationEntity } from '../../entities/citation.entity';
import { DocumentEntity } from '../../entities/document.entity';
import { SearchService } from '../search/search.service';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

type QAParams = {
  question: string;
  documentId?: string;
  k: number;
};

@Injectable()
export class QAService {
  private client: OpenAI | null = null;
  private model: string;

  constructor(
    @InjectRepository(QAEntity) private readonly qaRepo: Repository<QAEntity>,
    @InjectRepository(CitationEntity) private readonly citationRepo: Repository<CitationEntity>,
    @InjectRepository(DocumentEntity) private readonly docs: Repository<DocumentEntity>,
    private readonly search: SearchService,
    config: ConfigService,
  ) {
    const openrouterKey = config.get<string>('OPENROUTER_API_KEY');
    const openaiKey = config.get<string>('OPENAI_API_KEY');
    this.model = config.get<string>('CHAT_MODEL') || 'gpt-4o-mini';

    if (openrouterKey && openrouterKey !== 'replace_me') {
      this.client = new OpenAI({
        apiKey: openrouterKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': config.get<string>('OPENROUTER_SITE_URL') || 'http://localhost',
          'X-Title': config.get<string>('OPENROUTER_APP_NAME') || 'AI Knowledge Space',
        },
      });
    } else if (openaiKey && openaiKey !== 'replace_me') {
      this.client = new OpenAI({ apiKey: openaiKey });
      if (!config.get<string>('CHAT_MODEL')) {
        this.model = 'gpt-4o-mini';
      }
    }
  }

  async answer(params: QAParams) {
    const { question, documentId, k } = params;

    const search = await this.search.search({ q: question, k, documentId });

    if (!search.results.length) {
      return {
        question,
        answer: "I couldn't find information related to that question.",
        citations: [],
      };
    }

    const documentIds = search.results.map((r) => r.documentId);
    const documents = await this.docs.find({
      where: { id: In(documentIds) },
    });

    const documentsMap = new Map(documents.map((doc) => [doc.id, doc.title]));

    // Build prompt context
    const contextBlocks = search.results
      .map((res, idx) => {
        const title = documentsMap.get(res.documentId) || 'Untitled Document';
        return `[[DOC:${res.documentId} | CHUNK:${res.id} | RANK:${idx + 1} | SCORE:${res.scores.rrf.toFixed(
          4,
        )} | TITLE:${title}]]
${res.content}
`;
      })
      .join('\n---\n');

    const systemPrompt = `
You are an AI assistant that answers strictly from the provided context.
If the context does not contain the answer, respond with "I don't know."
Return JSON with schema:
{
  "answer": string,
  "citations": [
    {
      "chunkId": string,
      "excerpt": string
    }
  ]
}
Keep answers concise and grounded. Only cite chunks actually used.
`;

    let answerText = '';
    let citations: { chunkId: string; excerpt: string }[] = [];

    if (this.client) {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt.trim(),
          },
          {
            role: 'user',
            content: `Question: ${question}\n\nContext:\n${contextBlocks}`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const jsonText = completion.choices[0]?.message?.content || '{}';

      try {
        const parsed = JSON.parse(jsonText);
        answerText = parsed.answer || '';
        citations = Array.isArray(parsed.citations) ? parsed.citations : [];
      } catch {
        answerText = jsonText;
        citations = [];
      }
    } else {
      // offline fallback
      answerText = 'Offline mode: LLM not configured.';
      citations = search.results.slice(0, 2).map((res) => ({
        chunkId: res.id,
        excerpt: res.content.slice(0, 160),
      }));
    }

    // Persist
    const qa = await this.qaRepo.save(
      this.qaRepo.create({
        question,
        answer: answerText,
      }),
    );

    if (citations.length) {
      await this.citationRepo.save(
        citations.map((c) =>
          this.citationRepo.create({
            qaId: qa.id,
            chunkId: c.chunkId,
            score:
              search.results.find((r) => r.id === c.chunkId)?.scores.rrf ??
              search.results[0].scores.rrf,
            startChar: null,
            endChar: null,
          }),
        ),
      );
    } else {
      // fallback: log top K as citations
      await this.citationRepo.save(
        search.results.slice(0, 2).map((res) =>
          this.citationRepo.create({
            qaId: qa.id,
            chunkId: res.id,
            score: res.scores.rrf,
            startChar: null,
            endChar: null,
          }),
        ),
      );
    }

    return {
      id: qa.id,
      question,
      answer: answerText,
      citations: search.results
        .filter((res) => citations.find((c) => c.chunkId === res.id))
        .map((res) => ({
          chunkId: res.id,
          documentId: res.documentId,
          content: res.content,
          score: res.scores,
        })),
    };
  }
}
