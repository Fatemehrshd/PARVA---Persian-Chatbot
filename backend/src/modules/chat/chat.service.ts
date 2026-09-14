import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { ModelsAdminService } from '../models-admin/models-admin.service';
import { UsersService } from '../users/users.service';
import { OpenAiCompatForwarder, ChatMessage } from '../ai/openai-compat.forwarder';

export interface ChatChunk {
  token?: string;
  saved?: Message;
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
    private users: UsersService,
    private forwarder: OpenAiCompatForwarder,
  ) {}

  list(userId: string) {
    return this.conv.find({ where: { userId }, order: { updatedAt: 'DESC' } });
  }

  async create(userId: string, modelId?: string, title?: string) {
    let mid = modelId;
    if (mid) {
      const targetModel = await this.models.getRawById(mid);
      if (targetModel && targetModel.isActive === false) {
        throw new BadRequestException('Selected AI model is currently disabled');
      }
    } else {
      // Resolution chain: the user's preferred default model, then the
      // platform default, then the legacy sentinel (offline echo path).
      const userDefault = (await this.users.findById(userId))?.defaultModelId;
      if (userDefault) {
        const m = await this.models.getRawById(userDefault);
        if (m && m.isActive !== false) mid = m.id;
      }
      mid = mid ?? (await this.models.getDefault())?.id ?? 'default-model';
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
   * Resolves the model chain (conversation -> platform default), persists the
   * user turn and streams the assistant reply. The mock echo path is kept
   * ONLY for environments without any configured credential (dev/tests);
   * once a key exists, provider failures surface instead of echoing.
   */
  async *generate(userId: string, id: string, content: string): AsyncGenerator<ChatChunk> {
    const conversation = await this.assertOwned(userId, id);

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

    await this.msg.save(this.msg.create({ conversationId: id, role: 'user', content }));

    const target = this.forwarder.resolveTarget(model, provider);
    if (!target) {
      this.logger.warn(
        'No API key configured for the resolved model/provider (and no global OPENAI_API_KEY) — using offline echo fallback.',
      );
      const full = `Echo: ${content}`;
      for (const w of full.split(/(\s+)/)) {
        if (w) yield { token: w };
      }
      const savedMock = await this.msg.save(
        this.msg.create({ conversationId: id, role: 'assistant', content: full }),
      );
      await this.conv.update(id, {});
      yield { saved: savedMock };
      return;
    }

    const history = await this.msg.find({
      where: { conversationId: id },
      order: { createdAt: 'ASC' },
      take: HISTORY_LIMIT,
    });
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    let full = '';
    try {
      for await (const token of this.forwarder.stream(target, messages)) {
        full += token;
        yield { token };
      }
    } catch (err) {
      if (!full) throw err; // failed before the first token -> plain 502 upstream
      this.logger.warn(
        `Provider "${target.apiIdentifier}" failed mid-stream, persisting partial reply: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    const saved = await this.msg.save(
      this.msg.create({ conversationId: id, role: 'assistant', content: full }),
    );
    await this.conv.update(id, {});
    yield { saved };
  }
}
