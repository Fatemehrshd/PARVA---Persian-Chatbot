import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ProvidersAdminController } from '../src/modules/models-admin/providers-admin.controller';
import { ModelsController } from '../src/modules/models-admin/models.controller';
import { OpenAiCompatController } from '../src/modules/chat/openai-compat.controller';
import { ChatController } from '../src/modules/chat/chat.controller';
import { ModelsAdminService } from '../src/modules/models-admin/models-admin.service';
import { ProvidersAdminService } from '../src/modules/models-admin/providers-admin.service';
import { ChatService } from '../src/modules/chat/chat.service';
import { OpenAiCompatForwarder } from '../src/modules/ai/openai-compat.forwarder';
import { JwtAuthGuard } from '../src/shared/jwt-auth.guard';
import { AdminGuard } from '../src/shared/admin.guard';
import { HttpExceptionFilter } from '../src/shared/http-exception.filter';

function baseApp(controllers: any[], providers: any[], role: 'admin' | 'user' | null) {
  return Test.createTestingModule({
    controllers,
    providers: [
      ...providers,
      JwtAuthGuard,
      AdminGuard,
      {
        provide: JwtService,
        useValue: {
          verify: () => {
            if (role === null) throw new Error('no token');
            return { sub: 'u1', role };
          },
        },
      },
    ],
  })
    .compile()
    .then(async (mod) => {
      const app: INestApplication = mod.createNestApplication();
      app.useGlobalFilters(new HttpExceptionFilter());
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
      await app.init();
      return app;
    });
}

const AUTH = { Authorization: 'Bearer t' };

describe('/admin/providers — guards & wiring', () => {
  const svc = () => ({
    list: async () => [
      { id: 'p1', name: 'openai', isActive: true, defaultModelId: null, apiKey: 'sk-...1234' },
    ],
    create: async (d: any) => ({ id: 'p-new', ...d, apiKey: d.apiKey ? 'sk-...' : undefined }),
    update: async (_id: string, d: any) => ({ id: _id, ...d }),
    updateStatus: async (_id: string, isActive: boolean) => ({ id: _id, isActive }),
    setDefaultModel: async (_id: string, modelId: string) => ({ id: _id, defaultModelId: modelId }),
    remove: async () => undefined,
  });

  it('401 without token, 403 for plain user, 200 for admin', async () => {
    let app = await baseApp(
      [ProvidersAdminController],
      [{ provide: ProvidersAdminService, useValue: svc() }],
      null,
    );
    expect((await request(app.getHttpServer()).get('/admin/providers')).status).toBe(401);
    await app.close();

    app = await baseApp(
      [ProvidersAdminController],
      [{ provide: ProvidersAdminService, useValue: svc() }],
      'user',
    );
    expect((await request(app.getHttpServer()).get('/admin/providers').set(AUTH)).status).toBe(403);
    await app.close();

    app = await baseApp(
      [ProvidersAdminController],
      [{ provide: ProvidersAdminService, useValue: svc() }],
      'admin',
    );
    const res = await request(app.getHttpServer()).get('/admin/providers').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ name: 'openai' });
    await app.close();
  });

  it('create missing name -> 400; toggle status & set default route correctly', async () => {
    const app = await baseApp(
      [ProvidersAdminController],
      [{ provide: ProvidersAdminService, useValue: svc() }],
      'admin',
    );
    expect(
      (await request(app.getHttpServer()).post('/admin/providers').set(AUTH).send({ baseUrl: 'x' }))
        .status,
    ).toBe(400);
    const status = await request(app.getHttpServer())
      .patch('/admin/providers/p1/status')
      .set(AUTH)
      .send({ isActive: false });
    expect(status.status).toBe(200);
    expect(status.body).toHaveProperty('isActive', false);
    const def = await request(app.getHttpServer())
      .patch('/admin/providers/p1/default')
      .set(AUTH)
      .send({ modelId: 'mm' });
    expect(def.body).toHaveProperty('defaultModelId', 'mm');
    const del = await request(app.getHttpServer()).delete('/admin/providers/p1').set(AUTH);
    expect(del.status).toBe(204);
    await app.close();
  });
});

describe('GET /models — user-facing active listing', () => {
  const fake = {
    listActive: async () => [
      {
        id: 'm1',
        name: 'GPT-4o',
        provider: 'openai',
        apiIdentifier: 'gpt-4o',
        isActive: true,
        apiKey: 'sk-...1234',
      },
    ],
  };
  it('requires auth and serves plain users (no admin role)', async () => {
    let app = await baseApp(
      [ModelsController],
      [{ provide: ModelsAdminService, useValue: fake }],
      null,
    );
    expect((await request(app.getHttpServer()).get('/models')).status).toBe(401);
    await app.close();
    app = await baseApp(
      [ModelsController],
      [{ provide: ModelsAdminService, useValue: fake }],
      'user',
    );
    const res = await request(app.getHttpServer()).get('/models').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.map((m: any) => m.id)).toEqual(['m1']);
    await app.close();
  });
});

describe('/v1 OpenAI-compatible facade — now authenticated', () => {
  const modelsFake = {
    listActive: async () => [
      { id: 'm1', name: 'gpt', apiIdentifier: 'gpt-4o', provider: 'openai', createdAt: new Date() },
    ],
    resolveProvider: async () => null,
  };
  const forwarderFake = {
    resolveTarget: () => null,
    stream: () =>
      (async function* () {
        yield 'x';
      })(),
  };
  const mk = (role: 'admin' | 'user' | null) =>
    baseApp(
      [OpenAiCompatController],
      [
        { provide: ModelsAdminService, useValue: modelsFake },
        { provide: OpenAiCompatForwarder, useValue: forwarderFake },
      ],
      role,
    );

  it('401 without bearer token (was previously open)', async () => {
    const app = await mk(null);
    expect((await request(app.getHttpServer()).get('/v1/models')).status).toBe(401);
    expect(
      (
        await request(app.getHttpServer())
          .post('/v1/chat/completions')
          .send({ model: 'gpt-4o', messages: [] })
      ).status,
    ).toBe(401);
    await app.close();
  });

  it('with a token: OpenAI-shaped completion, offline echo when no credential', async () => {
    const app = await mk('user');
    const res = await request(app.getHttpServer())
      .post('/v1/chat/completions')
      .set(AUTH)
      .send({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ object: 'chat.completion', model: 'gpt-4o' });
    expect(res.body.choices[0].message.content).toBe('[gpt-4o] Echo: hi');
    await app.close();
  });

  it('unknown model name -> 404', async () => {
    const app = await mk('user');
    const res = await request(app.getHttpServer())
      .post('/v1/chat/completions')
      .set(AUTH)
      .send({ model: 'nope-9000', messages: [{ role: 'user', content: 'hi' }] });
    expect(res.status).toBe(404);
    await app.close();
  });
});

describe('PATCH /chat/conversations/:id — title and/or model switch', () => {
  function chatFake() {
    const convs = [{ id: 'mine', userId: 'u1', modelId: 'm1', title: 't' }];
    return {
      updateTitle: async (_u: string, id: string, title: string) => {
        const c = convs.find((x) => x.id === id);
        if (!c) throw new NotFoundException('Resource not found');
        c.title = title;
        return c;
      },
      setModel: async (_u: string, id: string, modelId: string) => {
        const c = convs.find((x) => x.id === id);
        if (!c) throw new NotFoundException('Resource not found');
        c.modelId = modelId;
        return c;
      },
    };
  }
  it('modelId-only switches the model', async () => {
    const app = await baseApp(
      [ChatController],
      [{ provide: ChatService, useValue: chatFake() }],
      'user',
    );
    const NEW = '00000000-0000-4000-8000-000000000002';
    const res = await request(app.getHttpServer())
      .patch('/chat/conversations/mine')
      .set(AUTH)
      .send({ modelId: NEW });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('modelId', NEW);
    await app.close();
  });
  it('title-only still works (existing rename flow)', async () => {
    const app = await baseApp(
      [ChatController],
      [{ provide: ChatService, useValue: chatFake() }],
      'user',
    );
    const res = await request(app.getHttpServer())
      .patch('/chat/conversations/mine')
      .set(AUTH)
      .send({ title: 'new title' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('title', 'new title');
    await app.close();
  });
  it('empty body -> 400', async () => {
    const app = await baseApp(
      [ChatController],
      [{ provide: ChatService, useValue: chatFake() }],
      'user',
    );
    const res = await request(app.getHttpServer())
      .patch('/chat/conversations/mine')
      .set(AUTH)
      .send({});
    expect(res.status).toBe(400);
    await app.close();
  });
});
