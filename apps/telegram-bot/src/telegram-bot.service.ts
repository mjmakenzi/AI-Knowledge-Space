import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Context, Telegraf, NarrowedContext } from 'telegraf';
import { message } from 'telegraf/filters';
import FormData from 'form-data';
import { Document, QAResponse } from './telegram-bot.interface';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Telegraf<Context>;
  private apiUrl: string;

  constructor(private readonly config: ConfigService) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }
    this.bot = new Telegraf(token);
    this.apiUrl = this.config.get<string>('API_URL') || 'http://localhost:3001';
  }

  async onModuleInit() {
    this.setupErrorHandling();
    this.setupCommands();
    this.setupHandlers();

    // Enable graceful stop
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));

    await this.bot.launch();
    this.logger.log('Telegram bot started successfully');
  }

  async onModuleDestroy() {
    this.logger.log('Stopping Telegram bot...');
    this.bot.stop('SIGTERM');
  }

  private setupErrorHandling() {
    this.bot.catch((err, ctx) => {
      this.logger.error(`Error for update ${ctx.update.update_id}:`, err);
      // Only reply if chat exists (some updates like inline queries don't have chat)
      if (ctx.chat) {
        ctx.reply('❌ An error occurred. Please try again later.').catch(() => {
          // Ignore errors when replying to errors
        });
      }
    });
  }

  private setupCommands() {
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        `👋 Welcome to AI Knowledge Space!\n\n` +
          `📚 Commands:\n` +
          `• /list - List your documents\n` +
          `• /ask <question> - Ask a question\n` +
          `• /help - Show this help\n\n` +
          `💡 You can also just send a file or ask a question directly!`,
      );
    });

    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        `📚 Available Commands:\n\n` +
          `• /list - List all documents\n` +
          `• /ask <question> - Ask a question about your documents\n` +
          `• /help - Show this help\n\n` +
          `💡 Tips:\n` +
          `• Send a file directly to upload it (PDF, TXT, HTML)\n` +
          `• Type a question to get an answer from your documents`,
      );
    });

    this.bot.command('list', async (ctx) => {
      await this.handleListDocuments(ctx);
    });

    this.bot.command('ask', async (ctx) => {
      if (!ctx.message.text) {
        await ctx.reply('❌ Please provide a question. Example: /ask What is this document about?');
        return;
      }
      const question = ctx.message.text.replace('/ask', '').trim();
      if (!question) {
        await ctx.reply('❌ Please provide a question. Example: /ask What is this document about?');
        return;
      }
      await this.handleQuestion(ctx, question);
    });
  }

  private setupHandlers() {
    // Handle file uploads using message filter (Telegraf v4 way)
    // The context is automatically narrowed to have message.document
    this.bot.on(message('document'), async (ctx) => {
      await this.handleFileUpload(ctx);
    });

    // Handle photo uploads
    this.bot.on(message('photo'), async (ctx) => {
      await ctx.reply('📸 Photo uploads are not supported yet. Please send PDF or text files.');
    });

    // Handle text messages as questions (only if not a command)
    this.bot.on(message('text'), async (ctx) => {
      const text = ctx.message.text;
      // Ignore commands (they're handled by command handlers)
      if (text.startsWith('/')) {
        return;
      }
      // Treat as question
      await this.handleQuestion(ctx, text);
    });
  }

  private async handleFileUpload(ctx: Context) {
    // Guard: Ensure chat exists (required for message updates)
    if (!ctx.chat) {
      this.logger.warn('Received document update without chat context');
      return;
    }

    // Guard: Ensure message exists and has document property
    if (!ctx.message || !('document' in ctx.message)) {
      this.logger.warn('Received update without document message');
      await ctx.reply('❌ No file found in message').catch(() => {
        // Ignore reply errors
      });
      return;
    }

    const chatId = ctx.chat.id; // Store chat ID once

    // TypeScript now knows ctx.message has document property
    const file = ctx.message.document;
    if (!file) {
      await ctx.reply('❌ Document file is missing').catch(() => {});
      return;
    }

    try {
      // Check file type
      const mimeTypes = ['application/pdf', 'text/plain', 'text/html'];
      const mimeType = file.mime_type || 'application/octet-stream';
      if (!mimeTypes.includes(mimeType)) {
        await ctx.reply(`❌ Unsupported file type: ${mimeType}\n` + `✅ Supported: PDF, TXT, HTML`);
        return;
      }

      const msg = await ctx.reply('📤 Downloading file...');
      const msgId = msg.message_id;

      try {
        // Get file URL
        const fileLink = await ctx.telegram.getFileLink(file.file_id);

        // Download file - preserve binary data
        const fileResponse = await axios.get(fileLink.toString(), {
          responseType: 'arraybuffer',
          timeout: 60000, // 60 second timeout for large files
        });

        // Create buffer from arraybuffer (preserves binary data correctly)
        const fileBuffer = Buffer.from(fileResponse.data);

        // Handle filename - preserve UTF-8 encoding
        const originalFilename = file.file_name || `document${this.getFileExtension(mimeType)}`;

        await ctx.telegram.editMessageText(chatId, msgId, undefined, '🔄 Uploading to server...');

        // Upload to API using FormData
        const form = new FormData();
        form.append('file', fileBuffer, {
          filename: originalFilename, // Send original filename, let server handle encoding
          contentType: mimeType,
          knownLength: fileBuffer.length,
        });

        const uploadResponse = await axios.post(`${this.apiUrl}/documents/upload`, form, {
          headers: {
            ...form.getHeaders(),
          },
          maxContentLength: 50 * 1024 * 1024, // 50MB
          maxBodyLength: 50 * 1024 * 1024,
          timeout: 60000,
        });

        const docId = uploadResponse.data.id;

        await ctx.telegram.editMessageText(chatId, msgId, undefined, '⏳ Processing document...');

        // Trigger ingest
        await axios.post(`${this.apiUrl}/ingest/${docId}`, {}, { timeout: 5000 });

        // Poll for status with timeout
        let status = 'processing';
        let attempts = 0;
        const maxAttempts = 30;
        const pollInterval = 2000;

        while (status === 'processing' && attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, pollInterval));
          try {
            const docResponse = await axios.get(`${this.apiUrl}/documents/${docId}`, {
              timeout: 5000,
            });
            status = docResponse.data.status || 'processing';
          } catch (pollError) {
            this.logger.warn(`Error polling document status: ${pollError}`);
            // Continue polling on error
          }
          attempts++;
        }

        if (status === 'ready') {
          await ctx.telegram.editMessageText(
            chatId,
            msgId,
            undefined,
            `✅ Document uploaded and processed!\n\n` +
              `📄 Title: ${uploadResponse.data.title}\n` +
              `🆔 ID: ${docId.substring(0, 8)}...\n\n` +
              `You can now ask questions about it!`,
          );
        } else if (status === 'error') {
          await ctx.telegram.editMessageText(
            chatId,
            msgId,
            undefined,
            '❌ Error processing document. Please try again or contact support.',
          );
        } else {
          await ctx.telegram.editMessageText(
            chatId,
            msgId,
            undefined,
            '⏳ Document is still processing. It will be ready shortly. Use /list to check status.',
          );
        }
      } catch (uploadError: any) {
        this.logger.error('File upload error:', uploadError);
        if (msgId) {
          await ctx.telegram.editMessageText(
            chatId,
            msgId,
            undefined,
            `❌ Upload failed: ${uploadError.response?.data?.message || uploadError.message}`,
          );
        } else {
          await ctx.reply(
            `❌ Upload failed: ${uploadError.response?.data?.message || uploadError.message}`,
          );
        }
      }
    } catch (error: any) {
      this.logger.error('Unexpected error in handleFileUpload:', error);
      await ctx.reply(`❌ Unexpected error: ${error.message}`);
    }
  }

  private async handleListDocuments(ctx: Context) {
    // Guard: Ensure chat exists
    if (!ctx.chat) {
      this.logger.warn('Received command without chat context');
      return;
    }

    try {
      const response = await axios.get(`${this.apiUrl}/documents`, {
        timeout: 10000,
      });
      const docs: Document[] = response.data;

      if (docs.length === 0) {
        await ctx.reply('📭 No documents found. Upload one by sending a file!');
        return;
      }

      const statusEmoji: Record<string, string> = {
        uploaded: '📤',
        processing: '⏳',
        ready: '✅',
        error: '❌',
      };

      // Telegram message limit is 4096 characters, so we need to paginate if needed
      const list = docs
        .map((doc, idx) => {
          const emoji = statusEmoji[doc.status] || '📄';
          const shortId = doc.id.substring(0, 8);
          return `${idx + 1}. ${emoji} ${doc.title}\n   ID: ${shortId}... | Status: ${doc.status}`;
        })
        .join('\n\n');

      const message = `📚 Your Documents (${docs.length}):\n\n${list}`;

      // Split message if too long
      if (message.length > 4000) {
        const chunks = this.splitMessage(message, 4000);
        for (const chunk of chunks) {
          await ctx.reply(chunk);
        }
      } else {
        await ctx.reply(message);
      }
    } catch (error: any) {
      this.logger.error('List documents error:', error);
      await ctx.reply(`❌ Error fetching documents: ${error.message}`);
    }
  }

  private async handleQuestion(ctx: Context, question: string) {
    // Guard: Ensure chat exists
    if (!ctx.chat) {
      this.logger.warn('Received question without chat context');
      return;
    }

    const chatId = ctx.chat.id; // Store chat ID once

    try {
      const msg = await ctx.reply('🤔 Thinking...');
      const msgId = msg.message_id;

      const response = await axios.post<QAResponse>(
        `${this.apiUrl}/qa`,
        {
          question,
          k: 6,
        },
        {
          timeout: 60000, // 60 second timeout for LLM responses
        },
      );

      const { answer, citations } = response.data;

      let reply = `💬 Answer:\n\n${answer}\n\n`;

      if (citations && citations.length > 0) {
        reply += `📚 Sources (${citations.length}):\n`;
        citations.slice(0, 3).forEach((cit, idx) => {
          const excerpt = cit.content.substring(0, 100) + '...';
          reply += `\n${idx + 1}. ${excerpt}`;
        });
      }

      // Split message if too long (Telegram limit is 4096 chars)
      if (reply.length > 4000) {
        const answerPart = `💬 Answer:\n\n${answer}`;
        await ctx.telegram.editMessageText(chatId, msgId, undefined, answerPart);

        if (citations && citations.length > 0) {
          let citationText = `📚 Sources (${citations.length}):\n`;
          citations.slice(0, 3).forEach((cit, idx) => {
            const excerpt = cit.content.substring(0, 100) + '...';
            citationText += `\n${idx + 1}. ${excerpt}`;
          });
          await ctx.reply(citationText);
        }
      } else {
        await ctx.telegram.editMessageText(chatId, msgId, undefined, reply);
      }
    } catch (error: any) {
      this.logger.error('Question error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
      await ctx.reply(`❌ Error: ${errorMsg}`);
    }
  }

  private getFileExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'text/html': '.html',
    };
    return extensions[mimeType] || '';
  }

  private splitMessage(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    for (const line of text.split('\n')) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = line;
        } else {
          // Single line is too long, split it
          chunks.push(line.substring(0, maxLength));
          currentChunk = line.substring(maxLength);
        }
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
}
