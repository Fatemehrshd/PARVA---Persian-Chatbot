import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ChatController } from '../src/modules/chat/chat.controller';
import { ChatService } from '../src/modules/chat/chat.service';
import { JwtAuthGuard } from '../src/shared/jwt-auth.guard';
import { HttpExceptionFilter } from '../src/shared/http-exception.filter';
import { NotFoundException } from '@nestjs/common';

/**
 * Chat invariants: every conversation belongs to ONE user.
 * A user must NOT be able to read or post into another user's conversation.
 * The right error is 404 (not 403) so an attacker cannot enumerate IDs.
 *
 * We mock ChatService directly so the test exercises only the controller's
 * ownership-check + response-format behavior.
 */

const MY_ID = 'user-1';
const OTHER_ID = 'user-2';

function makeChatService() {
  const convs = [
    { id: 'mine', userId: MY_ID, modelId: 'm1', title: 'mine' },
    { id: 'theirs', userId: OTHER_ID, modelId: 'm1', title: 'theirs' },
  ];
  return {
    list: async (userId: string) => convs.filter((c) => c.userId === userId),
    create: async (userId: string, modelId?: string, title?: string) => ({
      id: 'new',
      userId,
      modelId: modelId ?? 'default-model',
      title: title ?? 'New conversation',
    }),
    history: async (userId: string, id: string) => {
      const owned = convs.find((c) => c.id === id && c.userId === userId);
      if (!owned) throw new NotFoundException('Resource not found');
      return [];
    },
    delete: async (userId: string, id: string) => {
      const idx = convs.findIndex((c) => c.id === id && c.userId === userId);
      if (idx < 0) throw new NotFoundException('Resource not found');
      convs.splice(idx, 1);
    },
    updateTitle: async (userId: string, id: string, title: string) => {
      const conv = convs.find((c) => c.id === id && c.userId === userId);
      if (!conv) throw new NotFoundException('Resource not found');
      conv.title = title;
      return conv;
    },
    generate: async function* (userId: string, id: string, content: string) {
      const owned = convs.find((c) => c.id === id && c.userId === userId);
      if (!owned) throw new NotFoundException('Resource not found');
      for (const w of `Echo: ${content}`.split(/(\s+)/)) {
        if (w) yield { token: w };
      }
      yield {
        saved: { id: 'm-new', conversationId: id, role: 'assistant', content: `Echo: ${content}` },
      };
    },
    setModel: async (userId: string, id: string, modelId: string) => {
      const conv = convs.find((c) => c.id === id && c.userId === userId);
      if (!conv) throw new NotFoundException('Resource not found');
      conv.modelId = modelId;
      return conv;
    },
  };
}

function makeAppWithFakeGuard() {
  const chatService = makeChatService();
  return Test.createTestingModule({
    controllers: [ChatController],
    providers: [
      { provide: ChatService, useValue: chatService },
      // Provide the real JwtAuthGuard backed by a stub JwtService that
      // returns MY_ID for any token. Tests must send an Authorization header.
      JwtAuthGuard,
      { provide: JwtService, useValue: { verify: () => ({ sub: MY_ID, role: 'user' }) } },
    ],
  })
    .compile()
    .then(async (mod) => {
      const innerApp = mod.createNestApplication();
      innerApp.useGlobalFilters(new HttpExceptionFilter());
      innerApp.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
      await innerApp.init();
      return innerApp;
    });
}

const AUTH = 'Bearer test-token';

describe('Chat ownership invariants', () => {
  it('GET /chat/conversations returns only my conversations (not other users)', async () => {
    const app = await makeAppWithFakeGuard();
    try {
      const res = await request(app.getHttpServer())
        .get('/chat/conversations')
        .set('Authorization', AUTH);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = (res.body as { id: string }[]).map((c) => c.id);
      expect(ids).toContain('mine');
      expect(ids).not.toContain('theirs');
    } finally {
      await app.close();
    }
  });

  it('GET /chat/conversations/theirs/messages returns 404 (not 403 — no ID enumeration)', async () => {
    const app = await makeAppWithFakeGuard();
    try {
      const res = await request(app.getHttpServer())
        .get('/chat/conversations/theirs/messages')
        .set('Authorization', AUTH);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({
          statusCode: 404,
          message: expect.any(String),
          error: 'Not Found',
        }),
      );
    } finally {
      await app.close();
    }
  });

  it('POST /chat/conversations/theirs/messages returns 404 (ownership enforced)', async () => {
    const app = await makeAppWithFakeGuard();
    try {
      const res = await request(app.getHttpServer())
        .post('/chat/conversations/theirs/messages')
        .set('Authorization', AUTH)
        .send({ content: 'hello' });
      expect(res.status).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('POST /chat/conversations/mine/messages with empty content returns 400', async () => {
    const app = await makeAppWithFakeGuard();
    try {
      const res = await request(app.getHttpServer())
        .post('/chat/conversations/mine/messages')
        .set('Authorization', AUTH)
        .send({ content: '' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('statusCode', 400);
    } finally {
      await app.close();
    }
  });

  it('streaming response emits event: token chunks followed by event: done', async () => {
    const app = await makeAppWithFakeGuard();
    try {
      const res = await request(app.getHttpServer())
        .post('/chat/conversations/mine/messages')
        .set('Authorization', AUTH)
        .set('Accept', 'text/event-stream')
        .send({ content: 'hello' });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/event-stream/);
      expect(res.text).toMatch(/event: token/);
      expect(res.text).toMatch(/event: done/);
      expect(res.text).toMatch(/"messageId":/);
    } finally {
      await app.close();
    }
  });

  it('with Accept: application/json returns the saved Message, not a stream', async () => {
    const app = await makeAppWithFakeGuard();
    try {
      const res = await request(app.getHttpServer())
        .post('/chat/conversations/mine/messages')
        .set('Authorization', AUTH)
        .set('Accept', 'application/json')
        .send({ content: 'hi' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('role', 'assistant');
      expect(res.body.data).toHaveProperty('content', 'Echo: hi');
    } finally {
      await app.close();
    }
  });

  it('DELETE /chat/conversations/theirs returns 404 (cannot delete another user\'s conversation)', async () => {
    const app = await makeAppWithFakeGuard();
    try {
      const res = await request(app.getHttpServer())
        .delete('/chat/conversations/theirs')
        .set('Authorization', AUTH);
      expect(res.status).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('DELETE /chat/conversations/mine returns 204 (deletes own conversation)', async () => {
    const app = await makeAppWithFakeGuard();
    try {
      const res = await request(app.getHttpServer())
        .delete('/chat/conversations/mine')
        .set('Authorization', AUTH);
      expect(res.status).toBe(204);
    } finally {
      await app.close();
    }
  });

  it('PATCH /chat/conversations/theirs returns 404 (cannot rename another user\'s conversation)', async () => {
    const app = await makeAppWithFakeGuard();
    try {
      const res = await request(app.getHttpServer())
        .patch('/chat/conversations/theirs')
        .set('Authorization', AUTH)
        .send({ title: 'Hacked Title' });
      expect(res.status).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('PATCH /chat/conversations/mine updates conversation title', async () => {
    const app = await makeAppWithFakeGuard();
    try {
      const res = await request(app.getHttpServer())
        .patch('/chat/conversations/mine')
        .set('Authorization', AUTH)
        .send({ title: 'Updated Conversation Title' });
      expect(res.status).toBe(200);
      const title = res.body.data ? res.body.data.title : res.body.title;
      expect(title).toBe('Updated Conversation Title');
    } finally {
      await app.close();
    }
  });

  it('PATCH /chat/conversations/mine with empty title returns 400', async () => {
    const app = await makeAppWithFakeGuard();
    try {
      const res = await request(app.getHttpServer())
        .patch('/chat/conversations/mine')
        .set('Authorization', AUTH)
        .send({ title: '' });
      expect(res.status).toBe(400);
    } finally {
      await app.close();
    }
  });
});
