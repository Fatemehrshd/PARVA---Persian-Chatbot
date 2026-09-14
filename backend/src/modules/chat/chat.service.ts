import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { ModelsAdminService } from '../models-admin/models-admin.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation) private conv: Repository<Conversation>,
    @InjectRepository(Message) private msg: Repository<Message>,
    private models: ModelsAdminService,
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

  async answer(userId: string, id: string, content: string) {
    const conversation = await this.assertOwned(userId, id);

    // Validate active model status
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

    await this.msg.save(this.msg.create({ conversationId: id, role: 'user', content }));

    let reply = `Echo: ${content}`;

    // OpenAI-Compatible execution
    const apiKey = model?.apiKey || process.env.OPENAI_API_KEY;
    const baseUrl = model?.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const isOpenAiCompat =
      model?.provider === 'openai' ||
      model?.provider === 'openai-compatible' ||
      Boolean(apiKey) ||
      Boolean(model?.baseUrl);

    if (isOpenAiCompat && apiKey && typeof fetch === 'function') {
      try {
        const history = await this.msg.find({
          where: { conversationId: id },
          order: { createdAt: 'ASC' },
          take: 20,
        });

        const messages = [
          { role: 'system', content: 'You are a helpful and knowledgeable AI assistant.' },
          ...history.map((m) => ({ role: m.role, content: m.content })),
        ];

        const targetUrl = baseUrl.endsWith('/chat/completions')
          ? baseUrl
          : `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model?.apiIdentifier || 'gpt-4o',
            messages,
            stream: false,
          }),
        });

        if (res.ok) {
          const resJson: any = await res.json();
          const llmReply = resJson.choices?.[0]?.message?.content;
          if (llmReply) {
            reply = llmReply;
          }
        }
      } catch {
        // Graceful fallback for offline test environments
      }
    }

    const saved = await this.msg.save(
      this.msg.create({ conversationId: id, role: 'assistant', content: reply }),
    );
    await this.conv.update(id, {});
    return { reply, saved };
  }
}
