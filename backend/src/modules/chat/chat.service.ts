import { Injectable, NotFoundException, BadRequestException, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { ModelsAdminService } from '../models-admin/models-admin.service';
import { OpenAiCompatForwarder, ChatMessage } from '../ai/openai-compat.forwarder';
import { SettingsService } from '../admin/settings.service';
import { UsersService } from '../users/users.service';
import { ActiveStreamService, ActiveStreamStatus } from './active-stream.service';

export interface ChatChunk {
  token?: string;
  sync?: string;
  saved?: Message;
  title?: string;
}

const SYSTEM_PROMPT = 'You are a helpful and knowledgeable AI assistant.';
const HISTORY_LIMIT = 20;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(Conversation) private conv: Repository<Conversation>,
    @InjectRepository(Message) private msg: Repository<Message>,
    private models: ModelsAdminService,
    private forwarder: OpenAiCompatForwarder,
    @Optional() private settings?: SettingsService,
    @Optional() private users?: UsersService,
    @Optional() private activeStream?: ActiveStreamService,
  ) {}

  list(userId: string) {
    return this.conv.find({ where: { userId }, order: { updatedAt: 'DESC' } });
  }

  async create(userId: string, modelId?: string, title?: string) {
    // If user's latest conversation is empty (has 0 messages), reuse it instead of creating a duplicate
    const latest =
      typeof this.conv.findOne === 'function'
        ? await this.conv.findOne({
            where: { userId },
            order: { createdAt: 'DESC' },
          })
        : null;
    if (latest && typeof this.msg.count === 'function') {
      const messageCount = await this.msg.count({ where: { conversationId: latest.id } });
      if (messageCount === 0) {
        if (modelId && latest.modelId !== modelId) {
          latest.modelId = modelId;
          return this.conv.save(latest);
        }
        return latest;
      }
    }

    let mid = modelId;
    if (mid) {
      const targetModel = await this.models.getRawById(mid);
      if (targetModel && targetModel.isActive === false) {
        throw new BadRequestException('Selected AI model is currently disabled');
      }
    } else {
      // Resolution chain: platform default, then the legacy sentinel
      // (offline echo path).
      mid = (await this.models.getDefault())?.id ?? 'default-model';
    }
    const c = await this.conv.save(
      this.conv.create({ userId, modelId: mid, title: title ?? 'New conversation' }),
    );
    return c;
  }

  async assertOwned(userId: string, id: string) {
    let c;
    try {
      c = await this.conv.findOne({ where: { id, userId } });
    } catch (err: any) {
      if (err?.code === '22P02') {
        throw new NotFoundException('Resource not found');
      }
      throw err;
    }
    if (!c) throw new NotFoundException('Resource not found');
    return c;
  }

  history(userId: string, id: string) {
    return this.assertOwned(userId, id).then(() =>
      this.msg.find({ where: { conversationId: id }, order: { createdAt: 'ASC' } }),
    );
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.assertOwned(userId, id);
    await this.msg.delete({ conversationId: id });
    await this.conv.delete(id);
  }

  async updateTitle(userId: string, id: string, title: string) {
    const c = await this.assertOwned(userId, id);
    c.title = title;
    return this.conv.save(c);
  }

  /** Switch the model an existing conversation is answered by. */
  async setModel(userId: string, id: string, modelId: string) {
    const c = await this.assertOwned(userId, id);
    const m = await this.models.getRawById(modelId);
    if (!m) throw new BadRequestException('Selected AI model does not exist');
    if (m.isActive === false)
      throw new BadRequestException('Selected AI model is currently disabled');
    const provider = await this.models.resolveProvider(m);
    if (provider && provider.isActive === false) {
      throw new BadRequestException(`Provider "${provider.name}" is disabled`);
    }
    c.modelId = m.id;
    return this.conv.save(c);
  }

  /**
   * Generates a concise title (3-5 words) using AI forwarder if available,
   * with fallback to clean prefix of the prompt.
   */
  async generateTitle(target: any, prompt: string): Promise<string> {
    if (target && typeof (this.forwarder as any)?.complete === 'function') {
      try {
        const titleMessages: ChatMessage[] = [
          {
            role: 'system',
            content:
              'You are a title generator. Generate an extremely brief, descriptive, and natural title (maximum 3 to 5 words) summarizing the core topic of the user message. Answer strictly in the same language as the user query. Do not wrap in quotes or brackets. Do not add punctuation or prefixes like "Title:". Return ONLY the title text.',
          },
          { role: 'user', content: prompt.slice(0, 500) },
        ];
        const res = await (this.forwarder as any).complete(target, titleMessages, 30);
        const cleaned = (res || '')
          .replace(/^["'«»“]+|["'«»”]+$/g, '')
          .replace(/^(Title|عنوان)\s*:\s*/i, '')
          .trim();
        if (cleaned && cleaned.length <= 100) return cleaned;
      } catch (err) {
        this.logger.warn(
          `AI title generation failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    // Heuristic fallback for offline/echo/unconfigured API
    const trimmed = prompt.trim().replace(/\s+/g, ' ');
    if (trimmed.length <= 35) return trimmed;
    const boundary = trimmed.slice(0, 35).lastIndexOf(' ');
    return (boundary > 10 ? trimmed.slice(0, boundary) : trimmed.slice(0, 35)).trim() + '...';
  }

  /**
   * Resolves the model chain (conversation -> platform default), persists the
   * user turn and streams the assistant reply. The mock echo path is kept
   * ONLY for environments without any configured credential (dev/tests);
   * once a key exists, provider failures surface instead of echoing.
   */
  async *generate(userId: string, id: string, content: string): AsyncGenerator<ChatChunk> {
    const conversation = await this.assertOwned(userId, id);

    // If there is already an active ongoing generation for this conversation, attach to it!
    const existing = this.activeStream?.getSession(id);
    if (existing && (existing.status === 'thinking' || existing.status === 'streaming')) {
      yield* this.attachToActiveStream(id, existing);
      return;
    }

    // Validate active model status (same resolution order as before)
    let model = null;
    if (conversation.modelId) {
      model = await this.models.getRawById(conversation.modelId);
    }
    if (!model) {
      model = await this.models.getDefault();
    }
    if (model && model.isActive === false) {
      throw new BadRequestException('Selected AI model is currently disabled');
    }
    const provider = await this.models.resolveProvider(model);
    if (provider && provider.isActive === false) {
      throw new BadRequestException(`Provider "${provider.name}" is disabled`);
    }

    const isDefaultTitle =
      !conversation.title ||
      conversation.title === 'New conversation' ||
      conversation.title === 'گفتگوی جدید' ||
      conversation.title === 'New Chat';

    let existingMsgCount = 0;
    if (typeof this.msg.count === 'function') {
      try {
        existingMsgCount = await this.msg.count({ where: { conversationId: id } });
      } catch {
        existingMsgCount = 0;
      }
    }
    const shouldGenerateTitle = isDefaultTitle && existingMsgCount === 0;

    const session = this.activeStream?.startSession(id, userId, content);
    await this.msg.save(this.msg.create({ conversationId: id, role: 'user', content }));

    const target = this.forwarder.resolveTarget(model, provider);
    const titlePromise = shouldGenerateTitle ? this.generateTitle(target, content) : null;

    if (!target) {
      this.logger.warn(
        'No API key configured for the resolved model/provider (and no global OPENAI_API_KEY) — using offline echo fallback.',
      );
      const full = `Echo: ${content}`;
      for (const w of full.split(/(\s+)/)) {
        if (w) {
          this.activeStream?.appendToken(id, w);
          yield { token: w };
        }
      }
      const savedMock = await this.msg.save(
        this.msg.create({
          conversationId: id,
          role: 'assistant',
          content: full,
          isInterrupted: false,
          stoppedByUser: false,
        }),
      );
      const consumedTokens = Math.ceil((content.length + full.length) / 4);
      if (typeof this.users?.incrementUsedTokens === 'function') {
        await this.users.incrementUsedTokens(userId, consumedTokens);
      }

      if (titlePromise) {
        const genTitle = await titlePromise;
        if (genTitle) {
          await this.conv.update(id, { title: genTitle });
          this.activeStream?.setTitle(id, genTitle);
          yield { title: genTitle };
        }
      } else {
        await this.conv.update(id, {});
      }
      this.activeStream?.completeSession(id, savedMock.id);
      yield { saved: savedMock };
      return;
    }

    const history = await this.msg.find({
      where: { conversationId: id },
      order: { createdAt: 'ASC' },
      take: HISTORY_LIMIT,
    });
    const activeSystemPrompt = this.settings
      ? await this.settings.getSystemPrompt()
      : SYSTEM_PROMPT;
    const messages: ChatMessage[] = [
      { role: 'system', content: activeSystemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    let full = '';
    let savedAssistant: Message | null = null;
    let failedMidStream = false;
    try {
      try {
        for await (const token of this.forwarder.stream(target, messages)) {
          if (session?.abortController.signal.aborted) break;
          full += token;
          this.activeStream?.appendToken(id, token);
          yield { token };
        }
      } catch (err) {
        if (!full) {
          this.activeStream?.failSession(
            id,
            err instanceof Error ? err.message : String(err),
          );
          throw err; // failed before the first token -> plain 502 upstream
        }
        failedMidStream = true;
        this.logger.warn(
          `Provider "${target.apiIdentifier}" failed mid-stream, persisting partial reply: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    } finally {
      if (full && !savedAssistant) {
        savedAssistant = await this.msg.save(
          this.msg.create({
            conversationId: id,
            role: 'assistant',
            content: full,
            isInterrupted: failedMidStream,
            stoppedByUser: false,
          }),
        );
        await this.conv.update(id, {});
        this.activeStream?.completeSession(id, savedAssistant.id);
      }
    }

    if (titlePromise) {
      try {
        const genTitle = await titlePromise;
        if (genTitle) {
          await this.conv.update(id, { title: genTitle });
          this.activeStream?.setTitle(id, genTitle);
          yield { title: genTitle };
        }
      } catch (err) {
        this.logger.warn(
          `Failed saving auto title: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (savedAssistant) {
      yield { saved: savedAssistant };
    }
  }

  /**
   * Resumes an interrupted message stream from where it stopped.
   */
  async *resume(
    userId: string,
    conversationId: string,
    messageId: string,
  ): AsyncGenerator<ChatChunk> {
    const conversation = await this.assertOwned(userId, conversationId);

    let targetMsg =
      typeof this.msg.findOne === 'function'
        ? await this.msg.findOne({ where: { id: messageId, conversationId } })
        : null;

    if (!targetMsg && (messageId.startsWith('msg-') || messageId.startsWith('temp-'))) {
      const allMsgs = await this.msg.find({
        where: { conversationId },
        order: { createdAt: 'DESC' },
      });
      targetMsg = allMsgs.find((m) => m.role === 'assistant' && m.isInterrupted) ?? null;
    }

    if (!targetMsg) {
      throw new NotFoundException('Resource not found');
    }

    if (targetMsg.role !== 'assistant') {
      throw new BadRequestException('تنها پیام‌های پاسخ دستیار قابل ادامه دادن هستند');
    }

    let model = null;
    if (conversation.modelId) {
      model = await this.models.getRawById(conversation.modelId);
    }
    if (!model) {
      model = await this.models.getDefault();
    }
    if (model && model.isActive === false) {
      throw new BadRequestException('Selected AI model is currently disabled');
    }
    const provider = await this.models.resolveProvider(model);
    if (provider && provider.isActive === false) {
      throw new BadRequestException(`Provider "${provider.name}" is disabled`);
    }

    const target = this.forwarder.resolveTarget(model, provider);
    if (!target) {
      this.logger.warn('No API key configured — using offline echo fallback for resume.');
      const continuation = ' (resumed)';
      for (const w of continuation.split(/(\s+)/)) {
        if (w) yield { token: w };
      }
      targetMsg.content = targetMsg.content + continuation;
      targetMsg.isInterrupted = false;
      targetMsg.stoppedByUser = false;
      const saved = await this.msg.save(targetMsg);
      yield { saved };
      return;
    }

    const allHistory = await this.msg.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      take: HISTORY_LIMIT,
    });

    const targetIdx = allHistory.findIndex((m) => m.id === targetMsg.id);
    const prior =
      targetIdx >= 0
        ? allHistory.slice(0, targetIdx)
        : allHistory.filter((m) => m.id !== targetMsg.id);

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...prior.map((m) => ({ role: m.role, content: m.content })),
      { role: 'assistant', content: targetMsg.content },
      {
        role: 'user',
        content:
          'Please continue generating your previous response directly from where you stopped. Maintain the exact same language, tone, formatting, and structure (e.g., continue markdown tables, lists, or code blocks if interrupted mid-block). Do not repeat any words, phrases, or sentences from before. Do not add any conversational preamble or acknowledgments. Begin immediately with the next word.',
      },
    ];

    let continuationText = '';
    let failedMidStream = false;
    try {
      for await (const token of this.forwarder.stream(target, messages)) {
        continuationText += token;
        yield { token };
      }
    } catch (err) {
      failedMidStream = true;
      this.logger.warn(
        `Resume stream failed mid-stream: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      targetMsg.content = targetMsg.content + continuationText;
      targetMsg.isInterrupted = failedMidStream;
      targetMsg.stoppedByUser = false;
      const saved = await this.msg.save(targetMsg);
      yield { saved };
    }
  }

  /**
   * Sets stoppedByUser on a message and marks isInterrupted false.
   */
  async stopMessage(userId: string, conversationId: string, messageId: string): Promise<Message> {
    await this.assertOwned(userId, conversationId);
    let targetMsg =
      typeof this.msg.findOne === 'function'
        ? await this.msg.findOne({ where: { id: messageId, conversationId } })
        : null;

    if (
      !targetMsg &&
      (messageId.startsWith('msg-') ||
        messageId.startsWith('temp-') ||
        messageId.startsWith('active-'))
    ) {
      const allMsgs = await this.msg.find({
        where: { conversationId },
        order: { createdAt: 'DESC' },
      });
      targetMsg = allMsgs.find((m) => m.role === 'assistant') ?? null;
    }
    if (!targetMsg) {
      throw new NotFoundException('Resource not found');
    }
    targetMsg.stoppedByUser = true;
    targetMsg.isInterrupted = false;
    return this.msg.save(targetMsg);
  }

  private async *attachToActiveStream(id: string, session: any): AsyncGenerator<ChatChunk> {
    if (session.accumulatedText) {
      yield { sync: session.accumulatedText };
    }
    if (session.title) {
      yield { title: session.title };
    }

    const queue: ChatChunk[] = [];
    let resolveNext: (() => void) | null = null;
    let isDone = session.status === 'completed' || session.status === 'error';

    const unsubscribe = this.activeStream?.subscribe(id, (event: any) => {
      if (event.type === 'token') {
        queue.push({ token: event.content });
      } else if (event.type === 'title') {
        queue.push({ title: event.title });
      } else if (event.type === 'done') {
        queue.push({ saved: { id: event.messageId } as any });
        isDone = true;
      } else if (event.type === 'error') {
        isDone = true;
      }
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
    });

    try {
      while (!isDone || queue.length > 0) {
        while (queue.length > 0) {
          yield queue.shift()!;
        }
        if (isDone) break;
        await new Promise<void>((r) => (resolveNext = r));
      }
    } finally {
      unsubscribe?.();
    }
  }

  async getActiveStreamStatus(userId: string, id: string): Promise<ActiveStreamStatus> {
    await this.assertOwned(userId, id);
    return (
      this.activeStream?.getActiveStatus(id) ?? {
        active: false,
        status: 'completed',
        accumulatedText: '',
      }
    );
  }

  async *subscribeToStream(userId: string, id: string): AsyncGenerator<ChatChunk> {
    await this.assertOwned(userId, id);
    const session = this.activeStream?.getSession(id);
    if (!session || session.status === 'completed' || session.status === 'error') {
      return;
    }
    yield* this.attachToActiveStream(id, session);
  }

  async stopStream(userId: string, id: string): Promise<{ stopped: boolean }> {
    await this.assertOwned(userId, id);
    const stopped = this.activeStream?.abortSession(id) ?? false;
    return { stopped };
  }

  /**
   * Search through conversations by title and message contents.
   */
  async search(userId: string, query: string) {
    if (!query || !query.trim()) return [];
    const q = query.trim();

    // 1. Matches in conversation titles
    const titleMatches = await this.conv
      .createQueryBuilder('c')
      .where('c.userId = :userId', { userId })
      .andWhere('c.title ILIKE :q', { q: `%${q}%` })
      .orderBy('c.updatedAt', 'DESC')
      .take(20)
      .getMany();

    // 2. Matches in message contents
    const messageMatches = await this.msg
      .createQueryBuilder('m')
      .innerJoin(Conversation, 'c', 'c.id = m.conversationId')
      .where('c.userId = :userId', { userId })
      .andWhere('m.content ILIKE :q', { q: `%${q}%` })
      .select([
        'm.id AS "msgId"',
        'm.conversationId AS "conversationId"',
        'm.content AS "content"',
        'm.createdAt AS "msgCreatedAt"',
        'c.title AS "convTitle"',
        'c.updatedAt AS "convUpdatedAt"',
      ])
      .orderBy('m.createdAt', 'DESC')
      .take(30)
      .getRawMany();

    const resultMap = new Map<string, any>();

    for (const c of titleMatches) {
      resultMap.set(c.id, {
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt,
        matchedIn: 'title',
        snippet: c.title,
      });
    }

    for (const row of messageMatches) {
      const convId = row.conversationId;
      if (!resultMap.has(convId)) {
        const content: string = row.content || '';
        const idx = content.toLowerCase().indexOf(q.toLowerCase());
        const start = Math.max(0, idx - 40);
        const end = Math.min(content.length, idx + q.length + 40);
        const snippet =
          (start > 0 ? '...' : '') +
          content.substring(start, end) +
          (end < content.length ? '...' : '');

        resultMap.set(convId, {
          id: convId,
          title: row.convTitle,
          updatedAt: row.convUpdatedAt,
          matchedIn: 'message',
          snippet,
        });
      }
    }

    return Array.from(resultMap.values());
  }
}
