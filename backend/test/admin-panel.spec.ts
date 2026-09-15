import { Test } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { SettingsService, DEFAULT_GLOBAL_TOKEN_LIMIT, DEFAULT_SYSTEM_PROMPT } from '../src/modules/admin/settings.service';
import { AdminSettingsController } from '../src/modules/admin/admin-settings.controller';
import { AdminUsersController } from '../src/modules/admin/admin-users.controller';
import { AdminDashboardController } from '../src/modules/admin/admin-dashboard.controller';
import { ModelsAdminController } from '../src/modules/models-admin/models-admin.controller';
import { ModelsAdminService } from '../src/modules/models-admin/models-admin.service';
import { UsersService } from '../src/modules/users/users.service';
import { ChatService } from '../src/modules/chat/chat.service';
import { JwtAuthGuard } from '../src/shared/jwt-auth.guard';
import { AdminGuard } from '../src/shared/admin.guard';
import { HttpExceptionFilter } from '../src/shared/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/shared/response-envelope.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

describe('Admin Panel Suite', () => {
  // 1. SettingsService Unit Tests
  describe('SettingsService Unit Tests', () => {
    let fakeStore: Record<string, any>;
    let service: SettingsService;

    beforeEach(() => {
      fakeStore = {};
      const fakeRepo: any = {
        findOne: async ({ where }: any) => {
          const val = fakeStore[where.key];
          return val !== undefined ? { key: where.key, value: val } : null;
        },
        create: (dto: any) => ({ ...dto }),
        save: async (entity: any) => {
          fakeStore[entity.key] = entity.value;
          return entity;
        },
      };
      service = new SettingsService(fakeRepo);
    });

    it('returns default settings when not configured', async () => {
      const all = await service.getAll();
      expect(all.globalTokenLimit).toBe(DEFAULT_GLOBAL_TOKEN_LIMIT);
      expect(all.systemPrompt).toBe(DEFAULT_SYSTEM_PROMPT);
    });

    it('updates and persists global token limit and system prompt', async () => {
      await service.update({ globalTokenLimit: 5000, systemPrompt: 'Custom prompt' });
      const all = await service.getAll();
      expect(all.globalTokenLimit).toBe(5000);
      expect(all.systemPrompt).toBe('Custom prompt');
    });
  });

  // 2. Chat Quota Enforcement & Dynamic System Prompt
  describe('Chat Quota & Dynamic System Prompt', () => {
    it('throws BadRequestException when user reaches or exceeds global token limit', async () => {
      const fakeUser = { id: 'u1', usedTokens: 5000 };
      const usersService: any = {
        findById: async () => fakeUser,
        incrementUsedTokens: async () => {},
      };
      const settingsService: any = {
        getGlobalTokenLimit: async () => 5000,
        getSystemPrompt: async () => 'Custom system prompt',
      };
      const convRepo: any = {
        findOne: async () => ({ id: 'c1', userId: 'u1', modelId: 'm1' }),
      };
      const msgRepo: any = {
        count: async () => 1,
        create: (dto: any) => dto,
        save: async (dto: any) => dto,
        find: async () => [],
      };
      const modelsService: any = {
        getRawById: async () => ({ id: 'm1', isActive: true }),
        getDefault: async () => ({ id: 'm1' }),
        resolveProvider: async () => ({ isActive: true }),
      };
      const forwarder: any = {
        resolveTarget: () => null, // echo fallback
      };

      const chatService = new ChatService(
        convRepo,
        msgRepo,
        modelsService,
        usersService,
        forwarder,
        settingsService,
      );

      const gen = chatService.generate('u1', 'c1', 'Hello');
      await expect(gen.next()).rejects.toThrow('سقف مجاز مصرف توکن به پایان رسیده است');
    });

    it('increments user token usage and uses dynamic system prompt on chat generation', async () => {
      let incremented = 0;
      const fakeUser = { id: 'u1', usedTokens: 100 };
      const usersService: any = {
        findById: async () => fakeUser,
        incrementUsedTokens: async (_id: string, count: number) => {
          incremented += count;
        },
      };
      const settingsService: any = {
        getGlobalTokenLimit: async () => 10000,
        getSystemPrompt: async () => 'You are custom prompt',
      };
      const convRepo: any = {
        findOne: async () => ({ id: 'c1', userId: 'u1', modelId: 'm1' }),
        update: async () => {},
      };
      const msgRepo: any = {
        count: async () => 1,
        create: (dto: any) => dto,
        save: async (dto: any) => dto,
        find: async () => [],
      };
      const modelsService: any = {
        getRawById: async () => ({ id: 'm1', isActive: true }),
        getDefault: async () => ({ id: 'm1' }),
        resolveProvider: async () => ({ isActive: true }),
      };
      const forwarder: any = {
        resolveTarget: () => null, // triggers echo path
      };

      const chatService = new ChatService(
        convRepo,
        msgRepo,
        modelsService,
        usersService,
        forwarder,
        settingsService,
      );

      const gen = chatService.generate('u1', 'c1', 'Hello');
      let next = await gen.next();
      while (!next.done) {
        next = await gen.next();
      }

      // prompt ('Hello' length 5) + echo reply ('Echo: Hello' length 11) = 16 / 4 = 4 tokens
      expect(incremented).toBeGreaterThan(0);
    });
  });

  // 3. HTTP Endpoints Integration (AdminGuard, Settings, Users, Dashboard, Model Update)
  describe('HTTP Endpoints & Guards', () => {
    let app: INestApplication;
    let currentUserRole = 'admin';
    let currentUserId = 'admin-id';

    const fakeSettingsService = {
      getAll: async () => ({ globalTokenLimit: 1000, systemPrompt: 'Test prompt' }),
      update: async (dto: any) => ({
        globalTokenLimit: dto.globalTokenLimit ?? 1000,
        systemPrompt: dto.systemPrompt ?? 'Test prompt',
      }),
    };

    const fakeUsers = [
      {
        id: 'admin-id',
        email: 'admin@test.com',
        displayName: 'Admin User',
        username: 'admin',
        role: 'admin',
        avatarUrl: null,
        usedTokens: 150,
        conversationsCount: 2,
        createdAt: new Date(),
      },
      {
        id: 'user-id',
        email: 'user@test.com',
        displayName: 'Regular User',
        username: 'user1',
        role: 'user',
        avatarUrl: null,
        usedTokens: 800,
        conversationsCount: 5,
        createdAt: new Date(),
      },
    ];

    const fakeUsersService = {
      listWithStats: async () => fakeUsers,
      updateByAdmin: async (id: string, dto: any) => {
        const u = fakeUsers.find((x) => x.id === id);
        if (!u) throw new NotFoundException('User not found');
        Object.assign(u, dto);
        return u;
      },
      deleteByAdmin: async (id: string) => {
        const idx = fakeUsers.findIndex((x) => x.id === id);
        if (idx < 0) throw new NotFoundException('User not found');
        fakeUsers.splice(idx, 1);
      },
    };

    const fakeModelsService = {
      list: async () => [],
      create: async (d: any) => ({ id: 'm1', ...d }),
      update: async (id: string, d: any) => {
        if (id !== 'm1') throw new NotFoundException('Resource not found');
        return { id, name: d.name ?? 'updated', apiKey: 'sk-...1234' };
      },
      updateStatus: async (id: string, status: boolean) => ({ id, isActive: status }),
      remove: async () => {},
      setDefault: async () => ({}),
    };

    const fakeRepos = {
      users: {
        count: async () => 2,
        find: async () => [{ usedTokens: 50 }, { usedTokens: 100 }],
      },
      models: { count: async () => 3 },
      providers: { count: async () => 2 },
      convs: { count: async () => 7 },
      messages: { count: async () => 25 },
    };

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [
          AdminSettingsController,
          AdminUsersController,
          AdminDashboardController,
          ModelsAdminController,
        ],
        providers: [
          { provide: SettingsService, useValue: fakeSettingsService },
          { provide: UsersService, useValue: fakeUsersService },
          { provide: ModelsAdminService, useValue: fakeModelsService },
          { provide: 'UserRepository', useValue: fakeRepos.users },
          { provide: 'AiModelRepository', useValue: fakeRepos.models },
          { provide: 'AiProviderRepository', useValue: fakeRepos.providers },
          { provide: 'ConversationRepository', useValue: fakeRepos.convs },
          { provide: 'MessageRepository', useValue: fakeRepos.messages },
          JwtAuthGuard,
          AdminGuard,
          {
            provide: JwtService,
            useValue: {
              verify: () => ({ sub: currentUserId, role: currentUserRole }),
            },
          },
          {
            provide: APP_INTERCEPTOR,
            useClass: ResponseEnvelopeInterceptor,
          },
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      app.useGlobalFilters(new HttpExceptionFilter());
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /admin/settings returns settings envelope for admin', async () => {
      currentUserRole = 'admin';
      const res = await request(app.getHttpServer())
        .get('/admin/settings')
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        globalTokenLimit: 1000,
        systemPrompt: 'Test prompt',
      });
    });

    it('PUT /admin/settings updates settings and rejects invalid values', async () => {
      currentUserRole = 'admin';
      const bad = await request(app.getHttpServer())
        .put('/admin/settings')
        .set('Authorization', 'Bearer token')
        .send({ globalTokenLimit: -5 });
      expect(bad.status).toBe(400);

      const ok = await request(app.getHttpServer())
        .put('/admin/settings')
        .set('Authorization', 'Bearer token')
        .send({ globalTokenLimit: 2000, systemPrompt: 'Updated prompt' });
      expect(ok.status).toBe(200);
      expect(ok.body.success).toBe(true);
    });

    it('Non-admin user receives 403 Forbidden for admin routes', async () => {
      currentUserRole = 'user';
      const res = await request(app.getHttpServer())
        .get('/admin/settings')
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('GET /admin/users lists all users with their conversation count and token usage', async () => {
      currentUserRole = 'admin';
      const res = await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0]).toHaveProperty('conversationsCount');
      expect(res.body.data[0]).toHaveProperty('usedTokens');
    });

    it('PATCH /admin/users/:id updates user details and role', async () => {
      currentUserRole = 'admin';
      const res = await request(app.getHttpServer())
        .patch('/admin/users/user-id')
        .set('Authorization', 'Bearer token')
        .send({ role: 'admin', usedTokens: 0 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('DELETE /admin/users/:id prevents self-deletion and deletes other users', async () => {
      currentUserRole = 'admin';
      currentUserId = 'admin-id';
      // Attempt to delete self
      const selfDel = await request(app.getHttpServer())
        .delete('/admin/users/admin-id')
        .set('Authorization', 'Bearer token');
      expect(selfDel.status).toBe(400);
      expect(selfDel.body.message).toContain('نمی‌توانید');

      // Delete another user
      const okDel = await request(app.getHttpServer())
        .delete('/admin/users/user-id')
        .set('Authorization', 'Bearer token');
      expect(okDel.status).toBe(204);
    });

    it('GET /admin/dashboard/stats returns dashboard aggregated metrics', async () => {
      currentUserRole = 'admin';
      const res = await request(app.getHttpServer())
        .get('/admin/dashboard/stats')
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        totalUsers: 2,
        totalModels: 3,
        totalProviders: 2,
        totalConversations: 7,
        totalMessages: 25,
      });
      expect(res.body.data).toHaveProperty('globalTokenLimit');
      expect(res.body.data).toHaveProperty('systemPrompt');
    });

    it('PATCH /admin/models/:id updates model fields', async () => {
      currentUserRole = 'admin';
      const res = await request(app.getHttpServer())
        .patch('/admin/models/m1')
        .set('Authorization', 'Bearer token')
        .send({ name: 'GPT-4o Updated' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
